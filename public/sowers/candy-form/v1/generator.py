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
import numpy as np
import trimesh
import manifold3d as md
from shapely.geometry import Polygon, box, LineString
from shapely.geometry.polygon import orient

HEIGHT = 30.0
DEPTH = 6.0
MASK_DEPTH = 0.65
EYE_DEPTH = 0.4


def cross(poly):
    return md.CrossSection([np.asarray(orient(poly, sign=1).exterior.coords)[:-1].tolist()])


def rounded_rect(cx, cy, width, height, radius):
    return box(cx-width/2+radius, cy-height/2+radius,
               cx+width/2-radius, cy+height/2-radius).buffer(radius, quad_segs=8)


def cut_recess(solid, poly, floor, top=6.1):
    # A straight open recess: its section is constant towards the opening.
    return solid - cross(poly).extrude(top-floor).translate([0, 0, floor])


def svg_sheet(name, poly, face, eyes, metrics):
    minx, miny, maxx, maxy = poly.bounds
    pts = ' '.join(f'{x:.4f},{HEIGHT-y:.4f}' for x,y in poly.exterior.coords)
    def path(p, fill):
        xy = ' '.join(f'{x:.4f},{HEIGHT-y:.4f}' for x,y in p.exterior.coords)
        return f'<polygon points="{xy}" fill="{fill}" stroke="#26392e" stroke-width=".13"/>'
    front = path(poly, '#e3ce62') + path(face, '#baa847') + ''.join(path(e, '#716927') for e in eyes)
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
<text x="93" y="29" font-size="2.6">Mask recess 0.65</text><text x="93" y="34" font-size="2.6">Eye recess +0.40</text>
<text x="93" y="39" font-size="2.6">Back plane z = 0</text><text x="93" y="44" font-size="2.6">Front plane z = 6</text>
<text x="8" y="80" font-size="2.7">One connected solid · flat back · open straight relief · no separate limbs</text>
<text x="8" y="86" font-size="2.5">Sharp relief depth transitions and zero outer draft remain unresolved for tooling.</text>
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


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    repo=Path(__file__).resolve().parents[1]
    parser.add_argument('--source',type=Path,default=repo/'sowers/candy/silhouettes.mjs')
    parser.add_argument('--output',type=Path,default=repo/'public/sowers/candy-form')
    args=parser.parse_args()
    js='import {pathToFileURL} from "node:url"; const m=await import(pathToFileURL(process.argv[1])); console.log(JSON.stringify(["scout","seed","bud"].map(id=>({id,segments:m.getCandyRoundedSegments(id),outline:m.getCandyRoundedSegments(id).flatMap(s=>[s.before,...Array.from({length:8},(_,i)=>{const t=(i+1)/8;return s.before.map((a,k)=>(1-t)*(1-t)*a+2*(1-t)*t*s.corner[k]+t*t*s.after[k])})]),description:m.describeCandyOutline(id)}))));'
    source=json.loads(subprocess.check_output(['node','--input-type=module','-e',js,str(args.source.resolve())],text=True))
    args.output.mkdir(parents=True,exist_ok=True)
    report={'units':'mm','kind':'positive-master-preview','source':str(args.source.relative_to(repo)),
        'sourceSha256':hashlib.sha256(args.source.read_bytes()).hexdigest(),
        'parameters':{'height':HEIGHT,'depth':DEPTH,'maskDepth':MASK_DEPTH,'eyeAdditionalDepth':EYE_DEPTH,'outerDraftDegrees':0},
        'assumptions':{'targetWebMm':3,'targetOutlineRadiusMm':.6,'supplierConfirmedNumericMinima':False},
        'limits':['No tooling approval','No food-contact material claim','No shrink compensation','Sharp relief depth transitions','Zero outer draft','No sanding or release trial'],
        'variants':[]}
    for item in source:
        name=item['id']; raw=item['outline']
        if isinstance(raw,dict): raw=raw.get('points',raw.get('outline'))
        coords=[(p['x'],p['y']) if isinstance(p,dict) else tuple(p[:2]) for p in raw]
        ymin=min(y for x,y in coords); ymax=max(y for x,y in coords); factor=HEIGHT/(ymax-ymin)
        coords=[(x*factor,(y-ymin)*factor) for x,y in coords]
        poly=Polygon(coords)
        radii=[]
        for seg in item['segments']:
            a,b,c=[np.array(seg[k],dtype=float)*factor for k in ['before','corner','after']]
            dd=2*(c-2*b+a)
            for t in np.linspace(0,1,101):
                d=2*((1-t)*(b-a)+t*(c-b)); determinant=abs(d[0]*dd[1]-d[1]*dd[0])
                if determinant>1e-12: radii.append(float(np.linalg.norm(d)**3/determinant))
        if not poly.is_valid or poly.interiors or poly.area<=0:
            raise ValueError(f'{name}: canonical contour must be a simple polygon')
        minx,miny,maxx,maxy=poly.bounds
        # API must honour height; prevent silently exporting a mis-scaled master.
        if not math.isclose(maxy-miny,HEIGHT,abs_tol=.01):
            raise ValueError(f'{name}: canonical outline height {maxy-miny}, expected 30')
        # Face location follows the broad upper body; all profiles share normalized y-up coordinates.
        spec=item['description']['face']; cx=spec['x']*factor; cy=(spec['y']-ymin)*factor
        face=rounded_rect(cx,cy,spec['width']*factor,spec['height']*factor,spec['radius']*factor)
        eyes=[LineString([(cx+dx+x,cy+.7*(1-(x/1.0)**2)) for x in np.linspace(-1,1,17)]).buffer(.5,quad_segs=8) for dx in [-2.3,2.3]]
        if not poly.contains(face.buffer(1.0)):
            raise ValueError(f'{name}: face clearance needs review')
        solid=cross(poly).extrude(DEPTH)
        solid=cut_recess(solid,face,DEPTH-MASK_DEPTH)
        for eye in eyes: solid=cut_recess(solid,eye,DEPTH-MASK_DEPTH-EYE_DEPTH)
        if str(solid.status())!='Error.NoError': raise ValueError(solid.status())
        buf=solid.to_mesh(); mesh=trimesh.Trimesh(vertices=np.asarray(buf.vert_properties)[:,:3],faces=np.asarray(buf.tri_verts),process=True)
        target=args.output/f'{name}-positive-mm.stl'; mesh.export(target)
        # Reimport the actual STL and independently check topology after float32 serialization.
        check=trimesh.load_mesh(target,process=True)
        edges=check.edges_unique_inverse; counts=np.bincount(edges)
        eroded=poly.buffer(-1.5)
        metrics={'id':name,'boundsMm':check.bounds.tolist(),'widthMm':maxx-minx,'heightMm':maxy-miny,'depthMm':DEPTH,
            'volumeMm3':float(check.volume),'faceCount':len(check.faces),'vertexCount':len(check.vertices),
            'watertight':bool(check.is_watertight),'windingConsistent':bool(check.is_winding_consistent),
            'positiveVolume':bool(check.volume>0),'connectedComponents':component_count(check),
            'eulerNumber':int(check.euler_number),'allEdgesTwoFaces':bool(np.all(counts==2)),
            'outlineValid':True,'outlineHoles':len(poly.interiors),'erosionAt1p5MmComponents':0 if eroded.is_empty else (1 if eroded.geom_type=='Polygon' else len(eroded.geoms)),
            'faceClearanceMm':float(face.distance(poly.boundary)),
            'stlSha256':hashlib.sha256(target.read_bytes()).hexdigest(),
            'minimumQuadraticRadiusMmSampled':min(radii),
            'outlineRadiusTargetMet':bool(min(radii)>=.6),
            'engineeringStatus':'geometry-preview-needs-supplier-proof' if min(radii)>=.6 else 'outline-radius-target-missed',
            'maskWidthMm':spec['width']*factor,'maskHeightMm':spec['height']*factor,
            'eyeStrokeMm':1.0,'eyeFloorMm':DEPTH-MASK_DEPTH-EYE_DEPTH,
            'downwardFacesOnlyOnBack':bool(np.all(check.triangles[check.face_normals[:,2]<-.1][:,:,2] < .00001)),
            'description':item['description']}
        if not (metrics['watertight'] and metrics['windingConsistent'] and metrics['positiveVolume'] and metrics['connectedComponents']==1 and metrics['allEdgesTwoFaces']):
            raise ValueError(f'{name}: failed exported topology check')
        # Erosion is a diagnostic; it does not prove every appendage is >=3 mm wide.
        (args.output/f'{name}-dimensions.svg').write_text(svg_sheet(name,poly,face,eyes,metrics))
        (args.output/f'{name}-positive-preview.svg').write_text(iso_svg(check,name))
        report['variants'].append(metrics)
    (args.output/'geometry-report.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))

if __name__=='__main__': main()
