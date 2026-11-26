#!/usr/bin/env python3
"""Generate geometry-review positive masters. STL coordinates are millimetres.
Install: python -m pip install trimesh==4.11.0 manifold3d==3.3.2 mapbox-earcut==2.0.0 shapely==2.0.7
No food-contact tooling, mould cavity, shrink compensation or production approval.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import subprocess
import tempfile
import shutil
import numpy as np
import trimesh
import manifold3d as md
import mapbox_earcut
from shapely.geometry import Polygon
from shapely.geometry.polygon import orient

HEIGHT = 30.0
DEPTH = 6.0
OUTER_DRAFT = 2.0
RELIEF_DRAFT = 8.0
BLEND_STEPS = 12
VERSION = 'v2-drafted-rounded-shared-features'


def offset_rings(poly, offsets):
    """Corresponding vertices of true parallel polygon offsets, never XY scaling.

    Each straight sampled contour edge moves exactly `offset` along its inward
    normal. Mitre intersections retain vertex correspondence for the loft. A
    failed/self-crossing offset is rejected, never silently cleaned/replaced.
    """
    p = np.asarray(orient(poly, sign=1).exterior.coords)[:-1]
    tangent = np.roll(p, -1, axis=0)-p
    tangent /= np.linalg.norm(tangent, axis=1)[:, None]
    normal = np.column_stack((-tangent[:, 1], tangent[:, 0]))
    previous = np.roll(normal, 1, axis=0)
    denom = 1+np.sum(previous*normal, axis=1)
    if np.any(denom < .01):
        raise ValueError('offset encounters an acute/reversing contour')
    bisector = (previous+normal)/denom[:, None]
    rings = [p+float(d)*bisector for d in offsets]
    polygons = [Polygon(ring) for ring in rings]
    for candidate in polygons:
        if not candidate.is_valid or candidate.interiors or candidate.area <= 0:
            raise ValueError('parallel offset changed contour topology')
    for d, ring in zip(offsets, rings):
        # The midpoint of every edge has exactly the requested normal displacement.
        delta = (ring+np.roll(ring, -1, axis=0)-p-np.roll(p, -1, axis=0))/2
        if not np.allclose(np.sum(delta*normal, axis=1), d, atol=1e-8):
            raise ValueError('parallel-offset distance mismatch')
    return rings, polygons


def loft(rings, heights):
    """Closed oriented loft; corresponding rings triangulated without resampling."""
    n = len(rings[0])
    vertices = np.concatenate([np.column_stack((ring, np.full(n, z))) for ring,z in zip(rings, heights)])
    faces = []
    for level in range(len(rings)-1):
        for i in range(n):
            j = (i+1)%n; a=level*n+i; b=level*n+j; c=(level+1)*n+j; d=(level+1)*n+i
            faces.extend([[a,b,c],[a,c,d]])
    for level, reverse in [(0, True), (len(rings)-1, False)]:
        triangles = mapbox_earcut.triangulate_float64(np.asarray(rings[level], dtype=np.float64), np.array([n], dtype=np.uint32)).reshape(-1, 3)
        faces.extend((tri[::-1] if reverse else tri)+level*n for tri in triangles)
    solid = md.Manifold(md.Mesh(vert_properties=np.asarray(vertices, dtype=np.float32), tri_verts=np.asarray(faces, dtype=np.uint32)))
    if str(solid.status()) != 'Error.NoError':
        raise ValueError(f'loft: {solid.status()}')
    return solid


def recess_profiles(poly, floor, top, radius):
    """Monotone opening, sampled circular corner transitions, draft between them.

    These are faceted approximations of two quarter-circle blends in the normal
    offset/depth plane. No analytic surface-fillet or tooling approval is claimed.
    """
    if top-floor <= 2*radius:
        raise ValueError('recess depth must exceed both transition radii')
    side_height = top-floor-2*radius
    lower_side_inset = radius+math.tan(math.radians(RELIEF_DRAFT))*side_height
    heights=[]; offsets=[]
    for theta in np.linspace(0, math.pi/2, BLEND_STEPS+1):
        heights.append(floor+radius*(1-math.cos(theta)))
        offsets.append(lower_side_inset+radius*(1-math.sin(theta)))
    for theta in np.linspace(0, math.pi/2, BLEND_STEPS+1):
        heights.append(top-radius+radius*math.sin(theta))
        offsets.append(radius*math.cos(theta))
    heights.append(top+.03); offsets.append(0)
    rings, polygons = offset_rings(poly, offsets)
    nested = all(b.buffer(1e-8).covers(a) for a,b in zip(polygons, polygons[1:]))
    if not nested:
        raise ValueError('recess does not open monotonically towards +Z')
    return loft(rings, heights), {'floorMm':floor,'openingMm':top,'depthMm':top-floor,
        'transitionRadiusMm':radius,'transitionKind':'12-facet quarter-circle normal-offset approximation',
        'wallDraftDegrees':RELIEF_DRAFT,'maximumFloorInsetMm':max(offsets),'nestedProfiles':nested,
        'profileZMm':heights,'profileInsetMm':offsets,'openingPolygonMm':rings[-1].tolist(),
        'floorPolygonMm':rings[0].tolist()}


def raised_profiles(poly, floor, top, radius):
    _, evidence = recess_profiles(poly, floor, top, radius)
    heights = [floor-.03]+[floor+top-z for z in evidence['profileZMm'][-2::-1]]
    offsets = [0]+evidence['profileInsetMm'][-2::-1]
    rings, polygons = offset_rings(poly, offsets)
    nested = all(a.buffer(1e-8).covers(b) for a,b in zip(polygons, polygons[1:]))
    if not nested:
        raise ValueError('raised relief does not narrow towards +Z')
    evidence.update({'profileZMm':heights,'profileInsetMm':offsets,'nestedProfiles':nested,
        'baseMm':floor,'topMm':top,'heightMm':top-floor,'basePolygonMm':rings[0].tolist(),
        'tipPolygonMm':rings[-1].tolist()})
    return loft(rings, heights), evidence


def svg_sheet(name, poly, face, eyes, metrics):
    minx, miny, maxx, maxy = poly.bounds
    pts = ' '.join(f'{x:.4f},{HEIGHT-y:.4f}' for x,y in poly.exterior.coords)
    def path(p, fill):
        xy = ' '.join(f'{x:.4f},{HEIGHT-y:.4f}' for x,y in p.exterior.coords)
        return f'<polygon points="{xy}" fill="{fill}" stroke="#26392e" stroke-width=".13"/>'
    front = path(poly, '#e3ce62')
    for key in ['helmet','chest']:
        front += path(Polygon(metrics['features'][key]['basePolygonMm']), '#dfc45a')
    front += path(face, '#baa847') + ''.join(path(e, '#dfc45a') for e in eyes)
    w=maxx-minx
    # Physical viewport is 100 mm wide; dimensions are explicit and not inferred from screen pixels.
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="150mm" height="100mm" viewBox="0 0 150 100">
<rect width="150" height="100" fill="#f8f6ed"/>
<g font-family="sans-serif" fill="#26392e"><text x="8" y="10" font-size="4">SOWERS / {name.upper()} / POSITIVE MASTER</text>
<text x="8" y="16" font-size="2.5">Geometry review only · all dimensions mm · no shrink allowance</text>
<g transform="translate({31-(minx+maxx)/2:.3f},25)">{front}
<g fill="none" stroke="#4b6353" stroke-width=".18"><path d="M {minx-3},0 h -3 M {minx-3},30 h -3 M {minx-5},0 v 30"/>
<path d="M {minx},34 v 4 M {maxx},34 v 4 M {minx},36 H {maxx}"/></g>
<text x="{minx-8}" y="16" font-size="2.8" transform="rotate(-90 {minx-8} 16)">30.00</text>
<text x="{(minx+maxx)/2}" y="41" text-anchor="middle" font-size="2.8">{w:.2f}</text></g>
<g transform="translate(75,25)"><rect width="6" height="30" fill="#e3ce62" stroke="#26392e" stroke-width=".15"/>
<path d="M 0,34 v 4 M 6,34 v 4 M 0,36 h 6" fill="none" stroke="#4b6353" stroke-width=".18"/>
<text x="3" y="41" text-anchor="middle" font-size="2.8">6.00</text><text x="-1" y="-3" font-size="2.6">SIDE / schematic</text></g>
<text x="93" y="29" font-size="2.6">Helmet +0.65</text><text x="93" y="34" font-size="2.6">Mask -0.30 / eyes +0.22</text>
<text x="93" y="39" font-size="2.6">Back plane z = 0</text><text x="93" y="44" font-size="2.6">Front plane z = 6</text>
<text x="8" y="80" font-size="2.7">One connected solid · flat back · 2° constant-normal outer draft · chest +0.40</text>
<text x="8" y="86" font-size="2.5">Canonical base footprints shown. Relief has 8° walls and faceted circular transition approximations.</text>
<text x="8" y="92" font-size="2.5">Validate release, sanding legibility, radii, draft, shrink and deposit volume with supplier.</text></g></svg>'''


def iso_svg(mesh, name):
    # Rasterize the actual mesh with a depth buffer: painter sorting fails at recesses.
    import base64, struct, zlib
    v=mesh.vertices
    u=np.array([.8944,0,-.4472]); u/=np.linalg.norm(u)
    up=np.array([.196,.899,.392]); up-=u*(u@up); up/=np.linalg.norm(up)
    view=np.cross(u,up)
    xy=np.column_stack((v@u, -(v@up)))
    lo=xy.min(axis=0); hi=xy.max(axis=0); scale=220/(hi[1]-lo[1]); xy=(xy-lo)*scale+[36,36]
    depth=v@view
    w,h=340,280
    pixels=np.full((h,w,3),[244,241,228],dtype=np.uint8)
    zbuf=np.full((h,w),-np.inf)
    light=np.array([-.3,.5,1]); light/=np.linalg.norm(light)
    for i,face in enumerate(mesh.faces):
        p=xy[face]; z=depth[face]
        xmin=max(0,int(np.floor(p[:,0].min()))); xmax=min(w-1,int(np.ceil(p[:,0].max())))
        ymin=max(0,int(np.floor(p[:,1].min()))); ymax=min(h-1,int(np.ceil(p[:,1].max())))
        if xmin>xmax or ymin>ymax: continue
        x,y=np.meshgrid(np.arange(xmin,xmax+1)+.5,np.arange(ymin,ymax+1)+.5)
        a,b,c=p; den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
        if abs(den)<1e-10: continue
        s=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/den
        t=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/den
        r=1-s-t; d=s*z[0]+t*z[1]+r*z[2]
        region=zbuf[ymin:ymax+1,xmin:xmax+1]
        visible=(s>=-1e-8)&(t>=-1e-8)&(r>=-1e-8)&(d>region)
        shade=.48+.45*max(0,float(mesh.face_normals[i]@light))
        pixels[ymin:ymax+1,xmin:xmax+1][visible]=[int(k*shade) for k in [243,199,56]]
        region[visible]=d[visible]
    def chunk(kind,payload):
        return struct.pack('!I',len(payload))+kind+payload+struct.pack('!I',zlib.crc32(kind+payload)&0xffffffff)
    raw=b''.join(b'\x00'+row.tobytes() for row in pixels)
    png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!IIBBBBB',w,h,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(raw))+chunk(b'IEND',b'')
    embedded=base64.b64encode(png).decode()
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="340" height="320" viewBox="0 0 340 320"><rect width="340" height="320" fill="#f4f1e4"/><image width="340" height="280" href="data:image/png;base64,{embedded}"/><text x="20" y="302" font-family="sans-serif" font-size="12" fill="#26392e">{name} · positive form / 30 mm</text></svg>'


def component_count(mesh):
    parent=list(range(len(mesh.vertices)))
    def find(i):
        while parent[i]!=i:
            parent[i]=parent[parent[i]]; i=parent[i]
        return i
    for a,b in mesh.edges_unique:
        parent[find(int(a))]=find(int(b))
    return len({find(i) for i in range(len(parent))})


def canonical_polygon(points, factor, ymin):
    coords=[]
    for x,y in points:
        p=(x*factor,(y-ymin)*factor)
        if not coords or np.linalg.norm(np.array(p)-coords[-1])>1e-9:
            coords.append(p)
    if np.linalg.norm(np.array(coords[-1])-coords[0])<1e-9:
        coords.pop()
    poly=orient(Polygon(coords), sign=1)
    if not poly.is_valid or poly.interiors or poly.area<=0:
        raise ValueError('canonical contour must be a simple polygon')
    return poly


def sampled_radius(segments, factor, inward_offset=0, winding=1):
    radii=[]
    for seg in segments:
        a,b,c=[np.array(seg[k],dtype=float)*factor for k in ['before','corner','after']]
        dd=2*(c-2*b+a)
        for t in np.linspace(0,1,201):
            d=2*((1-t)*(b-a)+t*(c-b)); signed=(d[0]*dd[1]-d[1]*dd[0])*winding
            if abs(signed)>1e-12:
                # Smooth parallel-curve estimate: inward offset decreases a
                # convex radius and increases a concave radius. Never subtract
                # blindly from an absolute minimum that may be concave.
                radii.append(float(np.linalg.norm(d)**3/abs(signed)-math.copysign(inward_offset,signed)))
    return min(radii)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def horizontal_section(mesh, z):
    """Trace the actual STL triangle/plane intersection without optional SciPy."""
    from shapely.geometry import GeometryCollection
    lines=trimesh.intersections.mesh_plane(mesh,[0,0,1],[0,0,z])
    if not len(lines):
        raise ValueError('missing STL section')
    points={}; adjacency={}
    for line in lines:
        keys=[tuple(np.round(p[:2],7)) for p in line]
        if keys[0]==keys[1]:
            continue
        for i,key in enumerate(keys):
            points[key]=line[i,:2]; adjacency.setdefault(key,set()).add(keys[1-i])
    if any(len(v)!=2 for v in adjacency.values()):
        raise ValueError('section graph is not closed degree-two loops')
    region=GeometryCollection(); remaining=set(points)
    while remaining:
        start=next(iter(remaining)); previous=None; current=start; loop=[]
        while True:
            loop.append(points[current]);remaining.discard(current)
            nxt=next(k for k in adjacency[current] if k!=previous)
            previous,current=current,nxt
            if current==start:
                break
            if len(loop)>len(points):
                raise ValueError('section loop did not close')
        region=region.symmetric_difference(Polygon(loop))
    return region


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    repo=Path(__file__).resolve().parents[1]
    parser.add_argument('--source',type=Path,default=repo/'sowers/candy/silhouettes.mjs')
    parser.add_argument('--output',type=Path,default=repo/'public/sowers/candy-form')
    args=parser.parse_args()
    destination=args.output
    # Failed geometry validation must never replace a retained candidate.
    args.output=Path(tempfile.mkdtemp(prefix='sowers-positive-candidate-'))
    js='import {pathToFileURL} from "node:url"; const m=await import(pathToFileURL(process.argv[1])); console.log(JSON.stringify(["scout","seed","bud"].map(id=>({id,segments:m.getCandyRoundedSegments(id),outline:m.sampleCandySegments(m.getCandyRoundedSegments(id)),features:m.getCandyFeatures(id),description:m.describeCandyOutline(id)}))));'
    source=json.loads(subprocess.check_output(['node','--input-type=module','-e',js,str(args.source.resolve())],text=True))
    args.output.mkdir(parents=True,exist_ok=True)
    paths=[args.source,repo/'sowers/candy/mascot.js',Path(__file__).resolve()]
    sources={str(p.relative_to(repo)):sha(p) for p in paths}
    parameters={'height':HEIGHT,'depth':DEPTH,'outerDraftDegrees':OUTER_DRAFT,
        'reliefWallDraftDegrees':RELIEF_DRAFT,'blendStepsPerQuarterCircle':BLEND_STEPS,
        'contourStepsPerQuadratic':12,'surfaceDimensions':'canonical getCandyFeatures.surface at nominal 30mm'}
    parameter_json=json.dumps(parameters,sort_keys=True,separators=(',',':'))
    report={'version':VERSION,'units':'mm','kind':'positive-master-preview','source':str(args.source.relative_to(repo)),
        'sourceSha256':sha(args.source),'generatorSha256':sha(Path(__file__)),
        'sourceHashes':sources,'parameters':parameters,
        'parametersCanonicalJson':parameter_json,'parametersSha256':hashlib.sha256(parameter_json.encode()).hexdigest(),
        'pullDirection':[0,0,-1],
        'assumptions':{'targetWebMm':3,'targetOutlineRadiusMm':.6,'supplierConfirmedNumericMinima':False},
        'limits':['No tooling approval','No food-contact material claim','No shrink compensation',
            'Faceted quarter-circle relief blends, not analytic fillets','No sanding or release trial',
            'No rounded outer-front or back perimeter edge; positive drafted wall meets planes sharply',
            'Contour curvature sampled on source quadratics; STL is faceted'], 'variants':[]}
    body_front=DEPTH-source[0]['features']['helmet']['surface']['heightMm']
    for item in source:
        name=item['id']; ymin=min(y for x,y in item['outline']); ymax=max(y for x,y in item['outline'])
        factor=HEIGHT/(ymax-ymin); poly=canonical_polygon(item['outline'],factor,ymin)
        minx,miny,maxx,maxy=poly.bounds
        if not math.isclose(maxy-miny,HEIGHT,abs_tol=1e-8):
            raise ValueError('actual contour must be 30mm tall')
        outer_z=np.linspace(0,body_front,25).tolist()
        outer_offsets=[z*math.tan(math.radians(OUTER_DRAFT)) for z in outer_z]
        rings, sections=offset_rings(poly,outer_offsets)
        nested=all(a.buffer(1e-8).covers(b) for a,b in zip(sections,sections[1:]))
        if not nested:
            raise ValueError(name+': outer sections are not nested')
        # Constant offsets are affine in Z: only endpoint rings are needed to
        # represent exactly the same wall. The 25 intermediate profiles above
        # verify nesting without adding coplanar triangles to the STL.
        solid=loft([rings[0],rings[-1]],[outer_z[0],outer_z[-1]])
        polygons={}; features={}
        for key,feature in item['features'].items():
            entries=feature if isinstance(feature,list) else [feature]
            for entry in entries:
                polygons[entry['id']]=canonical_polygon(entry['points'],factor,ymin)
        helmet=item['features']['helmet']; mask=item['features']['face']; chest=item['features']['chest']
        helmet_top=body_front+helmet['surface']['heightMm']
        mask_floor=helmet_top-mask['surface']['depthMm']
        def add_raised(entry,base):
            part,evidence=raised_profiles(polygons[entry['id']],base,base+entry['surface']['heightMm'],entry['surface']['edgeRoundMm'])
            evidence['kind']='raised'; evidence['canonicalSurface']=entry['surface']
            evidence['minimumSourceQuadraticRadiusMmSampled']=sampled_radius(entry['segments'],factor)
            features[entry['id']]=evidence
            return part
        if not sections[-1].contains(polygons['helmet']):
            raise ValueError(name+': helmet not contained in drafted front')
        solid=solid+add_raised(helmet,body_front)+add_raised(chest,body_front)
        cutter,evidence=recess_profiles(polygons['face'],mask_floor,helmet_top,mask['surface']['edgeRoundMm'])
        evidence['kind']='recess'; evidence['canonicalSurface']=mask['surface'];features['face']=evidence
        evidence['minimumSourceQuadraticRadiusMmSampled']=sampled_radius(mask['segments'],factor)
        solid=solid-cutter
        for eye in item['features']['eyes']:
            solid=solid+add_raised(eye,mask_floor)
        # Probe top planes away from blends/overlap boundaries; the independent
        # STL test casts rays through these positions and checks actual Z.
        probe_regions={key:Polygon(features[key]['tipPolygonMm']) for key in ['helmet','chest','left-eye','right-eye']}
        probe_regions['helmet']=probe_regions['helmet'].difference(polygons['face'].buffer(.02))
        probe_regions['face']=Polygon(features['face']['floorPolygonMm']).difference(polygons['left-eye'].union(polygons['right-eye']).buffer(.02))
        probes=[]
        for key,region in probe_regions.items():
            point=region.representative_point()
            expected=mask_floor if key=='face' else features[key]['topMm']
            probes.append({'feature':key,'xyMm':list(point.coords)[0],'expectedTopZMm':expected})
        if str(solid.status())!='Error.NoError':
            raise ValueError(solid.status())
        buf=solid.to_mesh(); mesh=trimesh.Trimesh(vertices=np.asarray(buf.vert_properties)[:,:3],faces=np.asarray(buf.tri_verts),process=True)
        target=args.output/f'{name}-positive-mm.stl';mesh.export(target)
        check=trimesh.load_mesh(target,process=True)
        counts=np.bincount(check.edges_unique_inverse)
        # Global cross-sections of the FINAL boolean solid must nest towards +Z.
        # Profile/event planes plus interior samples test actual serialized triangles.
        sample_z=sorted(set(np.linspace(.001,DEPTH-.001,81).tolist()+[body_front-.001,body_front+.001,mask_floor-.001,mask_floor+.001]))
        final_sections=[]
        for z in sample_z:
            final_sections.append(horizontal_section(check,z))
        missing=[float(b.difference(a.buffer(2e-5)).area) for a,b in zip(final_sections,final_sections[1:])]
        no_undercuts=max(missing,default=0)<1e-7
        radii=sampled_radius(item['segments'],factor)
        front_radius=sampled_radius(item['segments'],factor,outer_offsets[-1])
        eroded=poly.buffer(-1.5)
        side_normals=check.face_normals[(check.triangles[:,:,2].max(axis=1)<=body_front+1e-5)&(check.triangles[:,:,2].min(axis=1)<body_front-1e-5)&(np.abs(check.face_normals[:,2])<.5)]
        drafts=np.degrees(np.arcsin(np.clip(side_normals[:,2],-1,1)))
        metrics={'id':name,'boundsMm':check.bounds.tolist(),'widthMm':float(check.extents[0]),'heightMm':float(check.extents[1]),'depthMm':float(check.extents[2]),
            'volumeMm3':float(check.volume),'faceCount':len(check.faces),'vertexCount':len(check.vertices),
            'watertight':bool(check.is_watertight),'windingConsistent':bool(check.is_winding_consistent),
            'positiveVolume':bool(check.volume>0),'connectedComponents':component_count(check),'eulerNumber':int(check.euler_number),
            'allEdgesTwoFaces':bool(np.all(counts==2)),'outlineValid':True,'outlineHoles':len(poly.interiors),
            'erosionAt1p5MmComponents':0 if eroded.is_empty else (1 if eroded.geom_type=='Polygon' else len(eroded.geoms)),
            'faceClearanceMm':float(polygons['face'].distance(poly.boundary)),'stlSha256':sha(target),
            'minimumQuadraticRadiusMmSampled':radii,'outlineRadiusTargetMet':bool(radii>=.6),
            'curvature':{'canonicalBackMinimumQuadraticRadiusMmSampled':radii,
                'smoothParallelFrontMinimumRadiusMmEstimateSampled':front_radius,
                'frontEstimateMethod':'signed source curvature: convex R minus inset, concave R plus inset',
                'sampleCountPerQuadratic':201,'backTargetMet':bool(radii>=.6),'frontEstimateTargetMet':bool(front_radius>=.6),
                'scope':'smooth source/parallel-curve estimate only; actual STL edges are faceted and unfilleted'},
            'engineeringStatus':'drafted-faceted-blend-candidate-needs-supplier-proof',
            'bodyFrontMm':body_front,'features':features,'measurementProbes':probes,
            'outerDraft':{'nominalDegrees':OUTER_DRAFT,'measuredFaceNormalRangeDegrees':[float(min(drafts)),float(max(drafts))],
                'method':'constant inward normal offset of every sampled contour edge; corresponding-vertex loft',
                'backToBodyFrontInsetMm':outer_offsets[-1],'nestedProfileCount':len(sections),'nestedProfiles':nested},
            'sectionCheck':{'sampleCount':len(sample_z),'zMm':sample_z,'maxNonNestedAreaMm2':max(missing,default=0),'nested':no_undercuts},
            'downwardFacesOnlyOnBack':bool(np.all(check.triangles[check.face_normals[:,2]<-1e-5][:,:,2]<.00001)),
            'description':item['description']}
        if not (metrics['watertight'] and metrics['windingConsistent'] and metrics['positiveVolume'] and metrics['connectedComponents']==1 and metrics['allEdgesTwoFaces'] and metrics['eulerNumber']==2 and no_undercuts and metrics['downwardFacesOnlyOnBack']):
            raise ValueError(f'{name}: failed exported geometry check')
        (args.output/f'{name}-dimensions.svg').write_text(svg_sheet(name,poly,polygons['face'],[polygons[e['id']] for e in item['features']['eyes']],metrics))
        (args.output/f'{name}-positive-preview.svg').write_text(iso_svg(check,name))
        report['variants'].append(metrics)
    (args.output/'canonical-geometry.json').write_text(json.dumps({'version':VERSION,'sourceHashes':sources,'variants':source},indent=2)+'\n')
    report['canonicalGeometrySha256']=sha(args.output/'canonical-geometry.json')
    if sources!={str(p.relative_to(repo)):sha(p) for p in paths}:
        raise ValueError('source changed during export; rerun with stable canonical files')
    (args.output/'geometry-report.json').write_text(json.dumps(report,indent=2)+'\n')
    destination.mkdir(parents=True,exist_ok=True)
    for file in sorted(args.output.iterdir(),key=lambda p:p.name=='geometry-report.json'):
        temporary=destination/(file.name+'.tmp')
        shutil.copyfile(file,temporary)
        temporary.replace(destination/file.name)
    shutil.rmtree(args.output)
    print(json.dumps({k:v for k,v in report.items() if k!='variants'},indent=2))
    for v in report['variants']:
        print(json.dumps({k:v[k] for k in ['id','widthMm','heightMm','depthMm','volumeMm3','faceCount','minimumQuadraticRadiusMmSampled','outerDraft','sectionCheck']},indent=2))

if __name__=='__main__': main()
