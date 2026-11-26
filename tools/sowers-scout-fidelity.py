#!/usr/bin/env python3
"""Compare the canonical Scout candy master with a crown-band refinement."""
import hashlib, json, math, shutil, subprocess, sys
from pathlib import Path

import numpy as np
import trimesh
from shapely.geometry import Polygon, LineString
from shapely.geometry.polygon import orient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
import importlib.util
spec = importlib.util.spec_from_file_location('sowers_candy_form', ROOT/'tools/sowers-candy-form.py')
form = importlib.util.module_from_spec(spec); spec.loader.exec_module(form)

OUT = ROOT/'public/sowers/prototypes/scout-fidelity'
OUT.mkdir(parents=True, exist_ok=True)
ENV = Path('/tmp/sowers-candy-form-venv/bin/python')

def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def component_count(mesh):
    parent=list(range(len(mesh.vertices)))
    def root(i):
        while parent[i]!=i:
            parent[i]=parent[parent[i]]; i=parent[i]
        return i
    for a,b in mesh.edges_unique:
        parent[root(int(a))]=root(int(b))
    return len({root(i) for i in range(len(parent))})

js = '''import {pathToFileURL} from "node:url"; const m=await import(pathToFileURL(process.argv[1])); console.log(JSON.stringify({outline:m.sampleCandySegments(m.getCandyRoundedSegments("scout")),features:m.getCandyFeatures("scout")}));'''
source = json.loads(subprocess.check_output(['node','--input-type=module','-e',js,str(ROOT/'sowers/candy/silhouettes.mjs')],text=True))
outline_data = source['outline']; all_features = source['features']
YMIN=min(y for x,y in outline_data); YMAX=max(y for x,y in outline_data)
FACTOR=30.0/(YMAX-YMIN)
def polygon(points):
    coords=[]
    for x,y in points:
        p=(x*FACTOR,(y-YMIN)*FACTOR)
        if not coords or np.linalg.norm(np.asarray(p)-coords[-1])>1e-9: coords.append(p)
    if np.linalg.norm(np.asarray(coords[-1])-coords[0])<1e-9: coords.pop()
    poly=orient(Polygon(coords),sign=1)
    if not poly.is_valid or poly.interiors or poly.area<=0: raise ValueError('canonical sampled path is not a simple polygon')
    return poly
body=polygon(outline_data)
features={}
for key, entries in all_features.items():
    entries=entries if isinstance(entries,list) else [entries]
    for item in entries: features[item['id']]=polygon(item['points'])
body_front=6.0-all_features['helmet']['surface']['heightMm']
helmet_top=6.0
mask_floor=helmet_top-all_features['face']['surface']['depthMm']

# This is a shallow engraved crown stripe, cut into the existing 6 mm top.
# Its tapered top approaches the exact canonical crown; the broad lower span
# visually joins the helmet rim without creating a closed pill or badge.
band=orient(Polygon([(0.0,29.82),(1.20,28.85),(2.00,26.90),(1.42,26.62),
                     (-1.42,26.62),(-2.00,26.90),(-1.20,28.85)]),sign=1)
if not body.buffer(1e-7).covers(band) or band.intersects(features['face']):
    raise ValueError('crown band must stay inside Scout outline and clear the face')

def mesh_export(solid, name):
    raw=solid.to_mesh()
    mesh=trimesh.Trimesh(vertices=np.asarray(raw.vert_properties)[:,:3],faces=np.asarray(raw.tri_verts),process=True)
    path=OUT/f'{name}.stl'; mesh.export(path)
    check=trimesh.load_mesh(path,process=True)
    edges=np.bincount(check.edges_unique_inverse)
    components=component_count(check)
    metrics={'boundsMm':check.bounds.tolist(),'widthMm':float(check.extents[0]),'heightMm':float(check.extents[1]),'depthMm':float(check.extents[2]),'volumeMm3':float(check.volume),'vertices':len(check.vertices),'faces':len(check.faces),'finiteVertices':bool(np.isfinite(check.vertices).all()),'watertight':bool(check.is_watertight),'allEdgesTwoFaces':bool(np.all(edges==2)),'positiveRecomputedVolume':bool(check.volume>0),'windingConsistent':bool(check.is_winding_consistent),'eulerNumber':int(check.euler_number),'connectedComponents':components,'stlSha256':sha(path)}
    good=(metrics['finiteVertices'] and metrics['watertight'] and metrics['allEdgesTwoFaces'] and metrics['positiveRecomputedVolume'] and metrics['windingConsistent'] and metrics['eulerNumber']==2 and components==1 and np.allclose(check.extents,[body.bounds[2]-body.bounds[0],30,6],atol=.015))
    if not good: raise RuntimeError((name,metrics))
    return path,check,metrics

# Canonical v3 source positive is the untouched control; its STL is copied byte-for-byte.
control_src=ROOT/'public/sowers/candy-form/scout-positive-mm.stl'
control_path=OUT/'canonical-scout-control.stl'; shutil.copyfile(control_src,control_path)
control_mesh=trimesh.load_mesh(control_path,process=True)
control_edges=np.bincount(control_mesh.edges_unique_inverse)
control_metrics={'boundsMm':control_mesh.bounds.tolist(),'widthMm':float(control_mesh.extents[0]),'heightMm':float(control_mesh.extents[1]),'depthMm':float(control_mesh.extents[2]),'volumeMm3':float(control_mesh.volume),'vertices':len(control_mesh.vertices),'faces':len(control_mesh.faces),'finiteVertices':bool(np.isfinite(control_mesh.vertices).all()),'watertight':bool(control_mesh.is_watertight),'allEdgesTwoFaces':bool(np.all(control_edges==2)),'positiveRecomputedVolume':bool(control_mesh.volume>0),'windingConsistent':bool(control_mesh.is_winding_consistent),'eulerNumber':int(control_mesh.euler_number),'connectedComponents':component_count(control_mesh),'stlSha256':sha(control_path)}
if not (control_metrics['finiteVertices'] and control_metrics['watertight'] and control_metrics['allEdgesTwoFaces'] and control_metrics['positiveRecomputedVolume'] and control_metrics['windingConsistent'] and control_metrics['eulerNumber']==2 and control_metrics['connectedComponents']==1): raise RuntimeError(control_metrics)

outer_z=np.linspace(0,body_front,25).tolist(); offsets=[z*math.tan(math.radians(form.OUTER_DRAFT)) for z in outer_z]
rings,sections=form.offset_rings(body,offsets)
if not all(a.buffer(1e-8).covers(b) for a,b in zip(sections,sections[1:])): raise ValueError('outer drafted profiles are not nested')
solid=form.loft([rings[0],rings[-1]],[0,body_front])
def add_raised(key,base,height,radius): return form.raised_profiles(features[key],base,base+height,radius)[0]
solid=solid+add_raised('helmet',body_front,.65,.12)+add_raised('chest',body_front,.40,.05)
cutter,_=form.recess_profiles(features['face'],mask_floor,helmet_top,.05); solid=solid-cutter
for key in ['left-eye','right-eye']: solid=solid+add_raised(key,mask_floor,.40,.05)
# Cutter extends just above the top plane to ensure a clean open-front recess.
band_cutter=form.loft([np.asarray(band.exterior.coords)[:-1]]*2,[5.73,6.03])
solid=solid-band_cutter
refined_path,refined_mesh,refined_metrics=mesh_export(solid,'scout-crown-band-refinement')

def band_width_at(y):
    x=band.intersection(LineString([(-30,y),(30,y)]))
    if x.is_empty:return 0.0
    if x.geom_type=='LineString':return x.length
    return max((g.length for g in getattr(x,'geoms',[]) if g.geom_type=='LineString'),default=0.0)
def range_width(region):
    ys=np.linspace(*region,301)
    widths=[]
    for y in ys:
        hit=body.intersection(LineString([(-30,y),(30,y)]))
        for g in ([hit] if hit.geom_type=='LineString' else getattr(hit,'geoms',[])):
            if g.geom_type=='LineString' and g.length>1e-4: widths.append(g.length)
    return float(max(widths))
head_range=[19.5,29.0]; torso_range=[4.0,9.5]
head_width=range_width(head_range); torso_width=range_width(torso_range)
canonical_path=ROOT/'sowers/candy/silhouettes.mjs'
params={'heightMm':30.0,'depthMm':6.0,'outerDraftDegrees':form.OUTER_DRAFT,'reliefWallDraftDegrees':form.RELIEF_DRAFT,'blendStepsPerQuarterCircle':form.BLEND_STEPS,'contourStepsPerQuadratic':12,'crownBand':'engraved polygon; top z=6.03 mm, floor z=5.73 mm; same canonical XY contour and features'}
param_json=json.dumps(params,sort_keys=True,separators=(',',':'))
report={'iteration':16,'title':'Scout fidelity: canonical control and crown-band refinement','kind':'canonical-contour-positive-solid-fidelity-study','units':'mm','variants':[{'id':'canonical-control','label':'Canonical Scout control','stl':'sowers/prototypes/scout-fidelity/canonical-scout-control.stl','metrics':control_metrics},{'id':'crown-band-refinement','label':'Scout with recessed crown band','stl':'sowers/prototypes/scout-fidelity/scout-crown-band-refinement.stl','metrics':refined_metrics}], 'canonicalSource':{'path':'sowers/candy/silhouettes.mjs','sha256':sha(canonical_path),'outlineMethod':'getCandyOutline/getCandyRoundedSegments with shared sampleCandySegments(…,12)','featuresMethod':'getCandyFeatures("scout"); helmet, face, eyes and chest XY are exact shared paths','heightNormalization':'30 mm using canonical sampled outline min/max Y','actualWidthMm':float(body.bounds[2]-body.bounds[0])},'parameters':params,'parametersCanonicalJson':param_json,'parametersSha256':hashlib.sha256(param_json.encode()).hexdigest(),'sourceHashes':{p:sha(ROOT/p) for p in ['tools/sowers-scout-fidelity.py','tools/sowers-candy-form.py','sowers/candy/silhouettes.mjs','public/sowers/candy-form/scout-positive-mm.stl','docs/sowers/prototypes/preference-anchor.md','docs/sowers/prototypes/iteration-15-contour-candies.json','/Users/martinburstein/Downloads/goat4.png']},'dimensions':{'canonicalWidthMm':float(body.bounds[2]-body.bounds[0]),'heightMm':30.0,'maximumDepthMm':6.0,'controlBoundsMm':control_mesh.bounds.tolist(),'refinedBoundsMm':refined_mesh.bounds.tolist()},'proportionReadout':{'headYRangeMm':head_range,'coreTorsoYRangeMm':torso_range,'exclusion':'Mitten tabs occur above the torso measurement range; boots are below it. Width is maximum horizontal span of the exact canonical body path within each stated range.','headWidthMm':head_width,'coreTorsoWidthMm':torso_width,'headToCoreTorsoWidthRatio':head_width/torso_width},'crownBand':{'planform':'Broad tapered stripe reaching to 29.82 mm, near the canonical crown at 30 mm; it widens toward the helmet rim and has no closed pill/badge outline.','widthAt26_9Mm':band_width_at(26.9),'widthAt28_85Mm':band_width_at(28.85),'depthMm':0.27,'bottomMm':5.73,'topMm':6.03,'strategy':'Shallow recessed cut in the existing 6 mm front envelope; no added bulk.'},'comparisonViews':{'path':'public/sowers/prototypes/scout-fidelity/comparison.png','method':'Front, side and three-quarter orthographic views rendered from each exact final STL; common camera scale, lighting, material and flat back.'},'observations':['The refined mesh keeps the exact canonical Scout outline and shared canonical helmet, face, eyes and chest paths.','The crown-band recess is the only geometry change from the canonical v3 solid.','The canonical outline width is measured from source and is not forced to 24 mm.','Mitten cues and the narrow core torso come from the original canonical contour.'],'limits':['Positive geometry study only; no mold-release, coating readability, food-contact, supplier, tolerance, shrink, tooling or manufacturing approval.','The recessed stripe has faceted straight side walls; it is a shape cue, not a proven production relief.','Source contour and feature sampling remain faceted at the shared 12-step quadratic sampling.']}
(ROOT/'docs/sowers/prototypes/iteration-16-scout-fidelity.json').write_text(json.dumps(report,indent=2)+'\n')
(OUT/'geometry-report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
