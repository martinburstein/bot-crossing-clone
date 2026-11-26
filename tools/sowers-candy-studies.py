#!/usr/bin/env python3
"""Separate Scout relief studies and a geometric negative proof coupon.
Reuses the baseline loft/validation helpers; never writes canonical assets.
"""
import copy, hashlib, importlib.util, json, math, shutil, subprocess, tempfile
from pathlib import Path
import numpy as np
import trimesh
import manifold3d as md
from shapely.geometry import Polygon, LineString, box

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'public/sowers/candy-studies'
SOURCE=DEST/'source-silhouettes.mjs' if (DEST/'source-silhouettes.mjs').exists() else ROOT/'sowers/candy/silhouettes.mjs'
BASE_SOURCE=DEST/'source-base-generator.py' if (DEST/'source-base-generator.py').exists() else ROOT/'tools/sowers-candy-form.py'
spec=importlib.util.spec_from_file_location('candy_base',BASE_SOURCE)
base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
DEST=ROOT/'public/sowers/candy-studies'

def sample(segments):
    points=[]
    for seg in segments:
        a,b,c=[np.asarray(seg[k]) for k in ['before','corner','after']]
        points.append(a.tolist())
        for t in np.linspace(1/12,1,12): points.append(((1-t)**2*a+2*(1-t)*t*b+t*t*c).tolist())
    return points

def eye_segments(outer,inner,roof,innerroof,bottom=-.015,tip=-.035):
    # Quadratic tips have horizontal tangents at their lowest points, no cusp.
    midpoint=(outer+inner)/2
    return [
        {'before':[-outer,bottom],'corner':[-outer,roof],'after':[0,roof]},
        {'before':[0,roof],'corner':[outer,roof],'after':[outer,bottom]},
        {'before':[outer,bottom],'corner':[outer,tip],'after':[midpoint,tip]},
        {'before':[midpoint,tip],'corner':[inner,tip],'after':[inner,bottom]},
        {'before':[inner,bottom],'corner':[inner,innerroof],'after':[0,innerroof]},
        {'before':[0,innerroof],'corner':[-inner,innerroof],'after':[-inner,bottom]},
        {'before':[-inner,bottom],'corner':[-inner,tip],'after':[-midpoint,tip]},
        {'before':[-midpoint,tip],'corner':[-outer,tip],'after':[-outer,bottom]},
    ]

def quadratic_radius_range(segments,factor):
    radii=[]
    for seg in segments:
        a,b,c=[np.asarray(seg[k],dtype=float)*factor for k in ['before','corner','after']]
        velocity=2*(b-a);acceleration=2*(c-2*b+a)
        cross=abs(velocity[0]*acceleration[1]-velocity[1]*acceleration[0])
        if cross<1e-12:continue
        optimum=float(np.clip(-velocity@acceleration/(acceleration@acceleration),0,1))
        radii.extend(float(np.linalg.norm(velocity+t*acceleration)**3/cross) for t in [0,optimum,1])
    return {'minimumMm':min(radii),'maximumMm':max(radii),'method':'analytic quadratic speed extrema; excludes straight joins, tessellation and surface fillets'}

def render(mesh,name):
    # Read-only cache lock prevents the helper hashing the full mesh per face.
    mesh.face_normals
    with mesh._cache:return base.iso_svg(mesh,name)

def ray_top(mesh,xy):
    tri=mesh.triangles; x,y=xy
    a,b,c=tri[:,0],tri[:,1],tri[:,2]
    den=(b[:,1]-c[:,1])*(a[:,0]-c[:,0])+(c[:,0]-b[:,0])*(a[:,1]-c[:,1])
    valid=np.abs(den)>1e-12; den=np.where(valid,den,1)
    s=((b[:,1]-c[:,1])*(x-c[:,0])+(c[:,0]-b[:,0])*(y-c[:,1]))/den
    t=((c[:,1]-a[:,1])*(x-c[:,0])+(a[:,0]-c[:,0])*(y-c[:,1]))/den
    inside=valid&(s>=-1e-7)&(t>=-1e-7)&(s+t<=1+1e-7)
    return float(np.max((s*a[:,2]+t*b[:,2]+(1-s-t)*c[:,2])[inside]))

def mesh_solid(solid,path):
    if str(solid.status())!='Error.NoError': raise ValueError(solid.status())
    buf=solid.to_mesh()
    mesh=trimesh.Trimesh(vertices=np.asarray(buf.vert_properties)[:,:3],faces=np.asarray(buf.tri_verts),process=True)
    mesh.export(path)
    return trimesh.load_mesh(path,process=True)

def topology(mesh,path):
    result={'stlSha256':base.sha(path),'boundsMm':mesh.bounds.tolist(),'extentsMm':mesh.extents.tolist(),
        'volumeMm3':float(mesh.volume),'faceCount':len(mesh.faces),'vertexCount':len(mesh.vertices),
        'watertight':bool(mesh.is_watertight),'windingConsistent':bool(mesh.is_winding_consistent),
        'connectedComponents':base.component_count(mesh),'eulerNumber':int(mesh.euler_number),
        'allEdgesTwoFaces':bool(np.all(np.bincount(mesh.edges_unique_inverse)==2))}
    assert result['watertight'] and result['windingConsistent'] and result['connectedComponents']==1 and result['eulerNumber']==2 and result['allEdgesTwoFaces'] and mesh.volume>0
    return result

def serialize_check(mesh,extra):
    zs=sorted(set(np.linspace(.001,5.999,85).tolist()+extra))
    regions=[base.horizontal_section(mesh,z) for z in zs]
    excess=[float(b.difference(a.buffer(2e-5)).area) for a,b in zip(regions,regions[1:])]
    normal_ok=bool(np.all(mesh.triangles[mesh.face_normals[:,2]<-1e-5][:,:,2]<.00001))
    assert max(excess)<1e-7 and normal_ok
    return {'zMm':zs,'maxNonNestedAreaMm2':max(excess),'nestedTowardsPositiveZ':True,'downwardFacesOnlyOnBack':normal_ok}

def line_spans(poly,y):
    parts=poly.intersection(LineString([[-100,y],[100,y]]))
    if parts.is_empty: return []
    parts=[parts] if parts.geom_type=='LineString' else list(parts.geoms)
    return sorted([float(p.length) for p in parts if p.geom_type=='LineString'])

def make_candidate(source,params,out):
    item=copy.deepcopy(source); features=item['features']
    if params['eyeLocalSegments']:
        for eye in features['eyes']:
            eye['segments']=[{k:[p[0]+eye['x'],p[1]+eye['y']] for k,p in seg.items()} for seg in params['eyeLocalSegments']]
            eye['points']=sample(eye['segments'])
    features['face']['surface']['depthMm']=params['maskDepthMm']
    for eye in features['eyes']: eye['surface']['heightMm']=params['eyeRiseMm']
    ymin=min(y for x,y in item['outline']);factor=30/(max(y for x,y in item['outline'])-ymin)
    poly=base.canonical_polygon(item['outline'],factor,ymin)
    front=5.35; rad=params['topPerimeterRoundMm']; tan=math.tan(math.radians(2))
    if rad:
        zs=[0,front-rad];offsets=[0,(front-rad)*tan]
        for angle in np.linspace(0,math.pi/2,13)[1:]:
            z=front-rad+rad*math.sin(angle);zs.append(z);offsets.append(z*tan+rad*(1-math.cos(angle)))
    else: zs=[0,front];offsets=[0,front*tan]
    rings,sections=base.offset_rings(poly,offsets)
    assert all(a.buffer(1e-8).covers(b) for a,b in zip(sections,sections[1:]))
    solid=base.loft(rings,zs); polygons={};evidence={}
    for feature in features.values():
        for entry in feature if isinstance(feature,list) else [feature]: polygons[entry['id']]=base.canonical_polygon(entry['points'],factor,ymin)
    assert sections[-1].contains(polygons['helmet'])
    def raised(entry,floor):
        part,ev=base.raised_profiles(polygons[entry['id']],floor,floor+entry['surface']['heightMm'],entry['surface']['edgeRoundMm'])
        ev['minimumSourceQuadraticRadiusMmSampled']=base.sampled_radius(entry['segments'],factor)
        ev['sourceQuadraticRadiusRangeMm']=quadratic_radius_range(entry['segments'],factor)
        ev['sourceRadiusScope']='sampled quadratic interiors only; joins/tessellated STL edges not analytic fillets'
        evidence[entry['id']]=ev
        return part
    solid=solid+raised(features['helmet'],front)+raised(features['chest'],front)
    floor=6-params['maskDepthMm']
    cutter,evidence['face']=base.recess_profiles(polygons['face'],floor,6,.05)
    solid=solid-cutter
    for eye in features['eyes']: solid=solid+raised(eye,floor)
    path=out/(params['id']+'-positive-mm.stl');mesh=mesh_solid(solid,path)
    measured=topology(mesh,path);measured['sectionCheck']=serialize_check(mesh,[front-.001,front+.001,floor-.001,floor+.001])
    assert np.allclose(mesh.extents[1:],[30,6],atol=2e-5)
    probes=[]
    for key,ev in evidence.items():
        region=Polygon(ev['floorPolygonMm'] if key=='face' else ev['tipPolygonMm'])
        if key=='face': region=region.difference(polygons['left-eye'].union(polygons['right-eye']).buffer(.02))
        if key=='helmet': region=region.difference(polygons['face'].buffer(.02))
        point=list(region.representative_point().coords)[0]; expected=floor if key=='face' else ev['topMm']
        actual=ray_top(mesh,point); assert abs(actual-expected)<1e-5
        probes.append({'feature':key,'xyMm':point,'expectedZMm':expected,'serializedTopZMm':actual})
    eye=features['eyes'][0];center=[eye['x']*factor,(eye['y']-ymin)*factor]
    # Intersect FINAL serialized triangles immediately above mask and below crest.
    eye_region=polygons['left-eye'].union(polygons['right-eye']).buffer(.001)
    actual_base=base.horizontal_section(mesh,floor+.0001).intersection(eye_region)
    actual_crest=base.horizontal_section(mesh,floor+params['eyeRiseMm']-.0001).intersection(eye_region)
    y=center[1]
    widths={'measurementMethod':'horizontal sections through serialized STL; arm width at unchanged eye-center Y; crest section .0001mm below top; base .0001mm above mask floor',
        'baseArmSpansAtCenterYMm':line_spans(actual_base,y),'crestArmSpansAtCenterYMm':line_spans(actual_crest,y)}
    # Crown thickness along vertical centerline of left arch, based on serialized sections.
    def crown(region):
        line=region.intersection(LineString([[center[0],center[1]-.1],[center[0],center[1]+3]]))
        return float(line.length)
    widths['baseCrownStrokeMm']=crown(actual_base);widths['crestCrownStrokeMm']=crown(actual_crest)
    measured.update({'id':params['id'],'parameters':params,'normalizedSource':item,'scaleMmPerNormalizedUnit':factor,
        'bodyFrontMm':front,'features':evidence,'measurementProbes':probes,'eyeStrokeMeasurements':widths,
        'topPerimeter':{'radiusMm':rad,'profileZMm':zs,'profileInsetMm':offsets,'kind':'faceted quarter-circle top transition plus 2 degree monotone draft; back remains flat and widest'}})
    (out/(params['id']+'-preview.svg')).write_text(render(mesh,params['id']))
    (out/(params['id']+'-candidate.json')).write_text(json.dumps(measured,indent=2)+'\n')
    return measured,solid,mesh

def coupon(positive,positive_metrics,out):
    # A 2x2 coupon is an unvalidated stock/layout assumption, not a machine tray.
    # Positive is reflected into -Z so flat broad backs become openings at z=0.
    pitch=[32.,38.];margin=5.;floor=3.;depth=6.;height=depth+floor
    width=positive_metrics['extentsMm'][0]+pitch[0]+2*margin
    length=30+pitch[1]+2*margin
    stock=md.Manifold.cube([width,length,height]).translate([-width/2,-length/2,-height])
    cutters=[];centers=[]
    reflected=positive.mirror([0,0,1])
    for x in [-pitch[0]/2,pitch[0]/2]:
        for y in [-pitch[1]/2,pitch[1]/2]:
            # Actual body is y=0..30: center it on the coupon grid.
            centers.append([x,y]);cutters.append(reflected.translate([x,y-15,0]))
    solid=stock
    for cutter in cutters: solid=solid-cutter
    path=out/'broad-moderate-2x2-negative-coupon-mm.stl';mesh=mesh_solid(solid,path)
    evidence=topology(mesh,path)
    # More solid appears down into stock: cavity opens monotonically towards +Z.
    zs=np.linspace(-5.999,-.001,65).tolist();sections=[base.horizontal_section(mesh,z) for z in zs]
    # Coupon solid shrinks towards opening; holes grow towards +Z.
    excess=[float(b.difference(a.buffer(2e-5)).area) for a,b in zip(sections,sections[1:])]
    assert max(excess)<1e-7
    expected=width*length*height-4*positive_metrics['volumeMm3']
    assert abs(mesh.volume-expected)<.03
    evidence.update({'id':'broad-moderate-2x2-negative-coupon','sourcePositiveId':positive_metrics['id'],
        'sourcePositiveStlSha256':positive_metrics['stlSha256'],'sourceTransform':'mirror positive Z; translate XY to grid; subtract actual positive solids from rectangular stock',
        'cavityCount':4,'centersMm':centers,'pitchMm':pitch,'stockDimensionsMm':[width,length,height],
        'minimumFloorStockMm':floor,'minimumPerimeterStockMm':margin,
        'minimumBetweenOpeningBoundsStockMm':min(pitch[0]-positive_metrics['extentsMm'][0],pitch[1]-30),
        'openingPlaneZMm':0,'deepestCavityZMm':-6,'stockBottomZMm':-height,
        'extractionAxis':[0,0,1],'expectedSubtractedVolumeMm3':4*positive_metrics['volumeMm3'],
        'expectedRemainingVolumeMm3':expected,'serializedVolumeDifferenceMm3':float(mesh.volume-expected),
        'openingSectionCheck':{'zMm':zs,'maxNonNestedSolidAreaMm2':max(excess),'cavitiesWidenTowardsPositiveZ':True},
        'assumptions':'5mm edge stock, 3mm floor and 32x38mm pitch are layout hypotheses; no recipe, material, process, food-contact or tooling approval'})
    (out/'negative-coupon-report.json').write_text(json.dumps(evidence,indent=2)+'\n')
    (out/'negative-coupon-preview.svg').write_text(render(mesh,'2x2 negative proof coupon'))
    return evidence

def main():
    js='import {pathToFileURL} from "node:url";const m=await import(pathToFileURL(process.argv[1]));console.log(JSON.stringify({id:"scout",segments:m.getCandyRoundedSegments("scout"),outline:m.sampleCandySegments(m.getCandyRoundedSegments("scout")),features:m.getCandyFeatures("scout")}))'
    source=json.loads(subprocess.check_output(['node','--input-type=module','-e',js,str(SOURCE)],cwd=ROOT,text=True))
    configs=[
        {'id':'baseline','maskDepthMm':.30,'eyeRiseMm':.22,'topPerimeterRoundMm':0,'eyeLocalSegments':None},
        {'id':'broad-moderate','maskDepthMm':.55,'eyeRiseMm':.40,'topPerimeterRoundMm':0,'eyeLocalSegments':eye_segments(.053,.012,.054,.012)},
        {'id':'broad-strong','maskDepthMm':.65,'eyeRiseMm':.55,'topPerimeterRoundMm':0,'eyeLocalSegments':eye_segments(.058,.011,.060,.011)},
        {'id':'broad-moderate-rounded-top','maskDepthMm':.55,'eyeRiseMm':.40,'topPerimeterRoundMm':.30,'eyeLocalSegments':eye_segments(.053,.012,.054,.012)},
    ]
    out=Path(tempfile.mkdtemp(prefix='sowers-relief-studies-'))
    source_paths={'tools/sowers-candy-studies.py':Path(__file__).resolve(),'tools/sowers-candy-form.py':BASE_SOURCE,'sowers/candy/silhouettes.mjs':SOURCE}
    sources={label:base.sha(path) for label,path in source_paths.items()}
    snapshots={'tools/sowers-candy-studies.py':'source-study-generator.py','tools/sowers-candy-form.py':'source-base-generator.py','sowers/candy/silhouettes.mjs':'source-silhouettes.mjs'}
    for label,path in source_paths.items():shutil.copyfile(path,out/snapshots[label])
    parameter_json=json.dumps(configs,sort_keys=True,separators=(',',':'))
    report={'version':'v1-separate-relief-studies','units':'mm','sourceHashes':sources,'sourceSnapshotFiles':snapshots,'parametersCanonicalJson':parameter_json,
        'parametersSha256':hashlib.sha256(parameter_json.encode()).hexdigest(),'pullDirection':[0,0,-1],
        'assumptions':{'desiredEyeStrokeAboutMm':1,'supplierConfirmedNumericMinimum':False},
        'limits':['geometric studies only; no food-contact/tooling approval','no shrink compensation or physical release/sanding trial','sampled quadratic curvature does not bound join curvature; faceted STL blends'], 'candidates':[]}
    chosen=None
    for config in configs:
        metrics,solid,mesh=make_candidate(source,config,out);report['candidates'].append({k:metrics[k] for k in ['id','stlSha256','extentsMm','volumeMm3','watertight','windingConsistent','connectedComponents','eulerNumber','allEdgesTwoFaces','eyeStrokeMeasurements']})
        print(json.dumps(report['candidates'][-1]),flush=True)
        if config['id']=='broad-moderate': chosen=(solid,metrics)
    report['coupon']=coupon(chosen[0],chosen[1],out)
    assert sources=={label:base.sha(path) for label,path in source_paths.items()},'source changed during export'
    report['files']={p.name:base.sha(p) for p in out.iterdir()}
    (out/'study-report.json').write_text(json.dumps(report,indent=2)+'\n')
    DEST.mkdir(parents=True,exist_ok=True)
    for path in sorted(out.iterdir(),key=lambda p:p.name=='study-report.json'): shutil.copyfile(path,DEST/path.name)
    shutil.rmtree(out)
    print('Published studies and coupon to '+str(DEST),flush=True)

if __name__=='__main__':main()
