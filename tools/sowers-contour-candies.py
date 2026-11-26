#!/usr/bin/env python3
"""Build Iteration 15 matched contour candy solids and mesh evidence."""
import hashlib, importlib.util, json, math
from pathlib import Path
import numpy as np
import trimesh
from shapely.geometry import Polygon, LineString
from shapely.geometry.polygon import orient

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('sowers_candy_form', ROOT/'tools/sowers-candy-form.py')
helper=importlib.util.module_from_spec(spec); spec.loader.exec_module(helper)
OUT=ROOT/'public/sowers/prototypes/contour-candies'; OUT.mkdir(parents=True,exist_ok=True)
W,H,BODY,TOTAL=24.0,30.0,5.45,6.0
def bezier(a,b,c,d,n=14):
    return [tuple((1-t)**3*np.array(a)+3*(1-t)**2*t*np.array(b)+3*(1-t)*t*t*np.array(c)+t**3*np.array(d)) for t in np.linspace(0,1,n+1)]
def path(start,segs):
    pts=[start]
    for a,b,c in segs: pts.extend(bezier(pts[-1],a,b,c)[1:])
    if np.linalg.norm(np.array(pts[-1])-pts[0])<1e-8: pts.pop()
    p=orient(Polygon(pts),sign=1)
    if not p.is_valid: raise ValueError('invalid outline')
    return p
def scale(p): return orient(Polygon([(x*W/24,(y-1)*H/29) for x,y in list(p.exterior.coords)[:-1]]),sign=1)
def mirrored(start,segs):
    return path(start,segs)

# Each outer profile is authored in matched normalized coordinates. The contour
# is sampled from the iteration 14 vector art's 24x30 design envelope; inner
# features and slab stations are shared exactly across all three solids.
helmet=path((0,30),[
 ((3.8,30),(6.6,28.8),(7.4,26)),((10.1,25.5),(11,23.8),(11,21.2)),
 ((11,19.8),(10.8,18.8),(10.4,18)),((11.3,17.2),(12,16.1),(12,14.7)),
 ((12,13.3),(11,12.3),(9.7,11.8)),((9.6,8.5),(9.6,5.4),(10,4)),
 ((10.5,2),(9.1,1),(7.3,1)),((6.3,1),(5.7,2.4),(4.6,2.4)),
 ((3.4,2.4),(2.4,2.4),(1.4,2.4)),((.6,2.4),(0,2.5),(0,3.1)),
 ((0,2.5),(-.6,2.4),(-1.4,2.4)),((-2.4,2.4),(-3.4,2.4),(-4.6,2.4)),
 ((-5.7,2.4),(-6.3,1),(-7.3,1)),((-9.1,1),(-10.5,2),(-10,4)),
 ((-9.6,5.4),(-9.6,8.5),(-9.7,11.8)),((-11,12.3),(-12,13.3),(-12,14.7)),
 ((-12,16.1),(-11.3,17.2),(-10.4,18)),((-10.8,18.8),(-11,19.8),(-11,21.2)),
 ((-11,23.8),(-10.1,25.5),(-7.4,26)),((-6.6,28.8),(-3.8,30),(0,30))])
cowl=path((0,30),[
 ((4,30),(6.8,28.9),(7.4,26.1)),((9.8,25.2),(10.8,23.2),(10.7,20.8)),
 ((10.7,19.3),(10.4,18.2),(9.7,17.1)),((10.5,16.2),(11.7,15.2),(12,14)),
 ((12,12.7),(10.7,11.4),(8.8,10.9)),((8.7,8),(8.8,5.1),(9.2,4)),
 ((9.8,2),(8.8,1),(7.2,1)),((6.1,1),(5.5,2.4),(4.6,2.4)),
 ((3.3,2.4),(2.3,2.4),(1.4,2.4)),((.6,2.4),(0,2.5),(0,3.1)),
 ((0,2.5),(-.6,2.4),(-1.4,2.4)),((-2.3,2.4),(-3.3,2.4),(-4.6,2.4)),
 ((-5.5,2.4),(-6.1,1),(-7.2,1)),((-8.8,1),(-9.8,2),(-9.2,4)),
 ((-8.8,5.1),(-8.7,8),(-8.8,10.9)),((-10.7,11.4),(-12,12.7),(-12,14)),
 ((-11.3,15.2),(-10.5,16.2),(-9.7,17.1)),((-10.4,18.2),(-10.7,19.3),(-10.7,20.8)),
 ((-10.8,23.2),(-9.8,25.2),(-7.4,26.1)),((-6.8,28.9),(-4,30),(0,30))])
canopy=path((0,30),[
 ((4,30),(6.8,28.9),(7.4,26.1)),((9.8,25.2),(10.8,23.2),(10.7,20.8)),
 ((10.7,19.2),(10.3,18),(9.5,17)),((10.8,16.5),(12,15.3),(12,14)),
 ((12,12.6),(10.4,11.6),(9.2,11.4)),((9.3,8.7),(9,6),(9.4,4)),
 ((10,2),(8.9,1),(7.3,1)),((6.3,1),(5.7,2.4),(4.6,2.4)),
 ((3.4,2.4),(2.4,2.4),(1.4,2.4)),((.6,2.4),(0,2.5),(0,3.1)),
 ((0,2.5),(-.6,2.4),(-1.4,2.4)),((-2.4,2.4),(-3.4,2.4),(-4.6,2.4)),
 ((-5.7,2.4),(-6.3,1),(-7.3,1)),((-8.9,1),(-10,2),(-9.4,4)),
 ((-9,6),(-9.3,8.7),(-9.2,11.4)),((-10.4,11.6),(-12,12.6),(-12,14)),
 ((-12,15.3),(-10.8,16.5),(-9.5,17)),((-10.3,18),(-10.7,19.2),(-10.7,20.8)),
 ((-10.8,23.2),(-9.8,25.2),(-7.4,26.1)),((-6.8,28.9),(-4,30),(0,30))])
OUTLINES={'helmet-control':helmet,'modest-cowl':cowl,'broad-canopy':canopy}
face=path((0,24.4),[((4.2,24.4),(6.5,23.4),(6.5,21.7)),((6.5,19.5),(4.8,18.8),(0,18.8)),((-4.8,18.8),(-6.5,19.5),(-6.5,21.7)),((-6.5,23.4),(-4.2,24.4),(0,24.4))])
def arch(cx): return orient(LineString(bezier((cx-1.45,21),(cx-1,22.75),(cx+1,22.75),(cx+1.45,21),36)).buffer(.30,quad_segs=8),sign=1)
eyes=[arch(-2.55),arch(2.55)]
seed=path((0,11.7),[((1,12.8),(1.8,15),(.2,16.4)),((-1.4,15.3),(-1.8,13.1),(0,11.7))])
# Same non-pill crown stripe for every contour. Its upper edge approaches the
# crown boundary; the relief is integral with the shell, not a separate badge.
band=path((0,29.65),[((1.5,29.65),(3.3,29.3),(4.8,28.15)),((3.5,26.7),(1.7,26.3),(0,26.3)),((-1.7,26.3),(-3.5,26.7),(-4.8,28.15)),((-3.3,29.3),(-1.5,29.65),(0,29.65))])
def raised(poly,base,height,inset):
 rings,_=helper.offset_rings(poly,[0,inset]);return helper.loft(rings,[base,base+height])
def components(mesh):
 p=list(range(len(mesh.vertices)))
 def f(i):
  while p[i]!=i:p[i]=p[p[i]];i=p[i]
  return i
 for a,b in mesh.edges_unique:p[f(int(a))]=f(int(b))
 return len({f(i) for i in range(len(p))})
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
variants=[]
for key,outline in OUTLINES.items():
 outline,ff,ee,ss,bb=map(scale,(outline,face,eyes[0],seed,band)); ee=[scale(x) for x in eyes]
 solid=helper.loft([np.asarray(outline.exterior.coords)[:-1]]*2,[0,BODY])
 fr,_=helper.offset_rings(ff,[.24,.24]); op,_=helper.offset_rings(ff,[0,0])
 solid=solid-helper.loft([fr[0],op[1]],[BODY-.72,BODY+.03])
 for e in ee: solid=solid+raised(e,BODY-.72,.78,.08)
 solid=solid+raised(ss,BODY,.55,.08)
 solid=solid+raised(bb,BODY,.24,.04)
 raw=solid.to_mesh(); mesh=trimesh.Trimesh(vertices=np.asarray(raw.vert_properties)[:,:3],faces=np.asarray(raw.tri_verts),process=True)
 stl=OUT/f'{key}.stl';mesh.export(stl);mesh=trimesh.load_mesh(stl,process=True)
 edges=np.bincount(mesh.edges_unique_inverse)
 m={'boundsMm':mesh.bounds.tolist(),'widthMm':float(mesh.extents[0]),'heightMm':float(mesh.extents[1]),'depthMm':float(mesh.extents[2]),'volumeMm3':float(mesh.volume),'vertices':len(mesh.vertices),'faces':len(mesh.faces),'finiteVertices':bool(np.isfinite(mesh.vertices).all()),'watertight':bool(mesh.is_watertight),'allEdgesTwoFaces':bool(np.all(edges==2)),'positiveRecomputedVolume':bool(mesh.volume>0),'windingConsistent':bool(mesh.is_winding_consistent),'eulerNumber':int(mesh.euler_number),'connectedComponents':components(mesh),'stlSha256':sha(stl)}
 if not(m['finiteVertices'] and m['watertight'] and m['allEdgesTwoFaces'] and m['positiveRecomputedVolume'] and m['windingConsistent'] and m['eulerNumber']==2 and m['connectedComponents']==1 and np.allclose(mesh.extents,[24,30,6],atol=.015)):raise RuntimeError((key,m))
 variants.append({'id':key,'label':{'helmet-control':'Helmet control','modest-cowl':'Modest continuous cowl','broad-canopy':'Broad canopy'}[key],'stl':f'sowers/prototypes/contour-candies/{key}.stl','metrics':m})
pin_paths=['tools/sowers-contour-candies.py','tools/sowers-canopy-factors.py','tools/sowers-candy-form.py','docs/sowers/prototypes/iteration-14-canopy-hop.json','docs/sowers/prototypes/preference-anchor.md','public/sowers/prototypes/iteration-14-canopy-hop-neutral-comparison.png','sowers/prototype-contour-candies/index.html','sowers/prototype-contour-candies/main.js','sowers/prototype-contour-candies/style.css','sowers/prototype-contour-candies/render-sheet.html','sowers/prototype-contour-candies/render-sheet.js']
pins={p:sha(ROOT/p) for p in pin_paths}
pins['/Users/martinburstein/Downloads/goat4.png']=sha(Path('/Users/martinburstein/Downloads/goat4.png'))
report={'iteration':15,'title':'Contour candy controlled comparison','kind':'controlled-character-contour-positive-solids','units':'mm','envelopeWHD':[W,H,TOTAL],'bodyProfile':'One shared constant XY outline through z=0..5.45 mm; common flat back at z=0; no draft in this shape-isolation comparison (0°).','sourceInterpretation':'Outer profiles are authored interpretations of the three Iteration 14 vector-art categories in a common 24×30 mm design envelope. Their paths were re-authored from the published comparison artwork; this is not a pixel-exact conversion.','commonGeometry':{'faceRecessMm':.72,'faceFloorInsetMm':.24,'archEyeRiseFromFloorMm':.78,'seedRiseMm':.55,'crownBandRiseMm':.24,'band':'One common broad curved stripe relief approaching the crown boundary; same planform across all variants; non-pill profile.','back':'Flat blank plane','overallDraftDegrees':0,'frontReliefDraft':'Raised details use common inward relief offsets; no folded overhang.'},'comparisonViews':{'path':'public/sowers/prototypes/contour-candies/comparison.png','method':'Front, side and back orthographic views rendered from each exact final STL, common camera positions and opaque warm-cream ground.'},'sourcePins':pins,'variants':variants,'observations':['The outer head-to-shoulder contour is the only intended variable.','Broad canopy shoulder flare obscures the hand/mitten cues; this is a design weakness of that contour in a single-color candy relief.','The supplied Goat 4 favorite has a distinct broad rounded-square helmet rim, crown band, horizontal cocoa face window with happy arches, central seed, visible side mittens and shallow boot notch. The helmet control retains the most explicit rim; the broad canopy loses mitten cues, which diverges from this preference image.','These are geometry-review positive solids only. No mold-release, material, food-contact or manufacturing proof.'],'limitations':['Hands and feet are part of the shared outer polygon; the shoulder silhouette can reduce hand visibility.','Faceted sampled vector curves and direct slab walls are authored geometry, not production tooling surfaces.','No draft is included; 0° is explicitly chosen to isolate shape.']}
if (OUT/'comparison.png').exists(): report['comparisonViews']['sha256']=sha(OUT/'comparison.png')
(ROOT/'docs/sowers/prototypes/iteration-15-contour-candies.json').write_text(json.dumps(report,indent=2)+'\n')
(OUT/'geometry-report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
