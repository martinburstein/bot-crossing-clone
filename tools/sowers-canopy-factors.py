#!/usr/bin/env python3
"""Iteration 14 controlled canopy candy factor geometry and evidence."""
import hashlib, importlib.util, json, math
from pathlib import Path
import numpy as np
import trimesh, manifold3d as md, mapbox_earcut
from shapely.geometry import Polygon, LineString
from shapely.geometry.polygon import orient

ROOT=Path(__file__).resolve().parents[1]
HELPER=ROOT/'tools/sowers-candy-form.py'
spec=importlib.util.spec_from_file_location('sowers_candy_form',HELPER)
helper=importlib.util.module_from_spec(spec); spec.loader.exec_module(helper)
OUT=ROOT/'public/sowers/prototypes/canopy-factors'; OUT.mkdir(parents=True,exist_ok=True)
H=30.0; W=24.0; BODY_DEPTH=5.45; TOTAL_DEPTH=6.0; DRAFT=2.0

def bezier(p0,p1,p2,p3,n=12):
    return [((1-t)**3*p0[0]+3*(1-t)**2*t*p1[0]+3*(1-t)*t*t*p2[0]+t**3*p3[0],
             (1-t)**3*p0[1]+3*(1-t)**2*t*p1[1]+3*(1-t)*t*t*p2[1]+t**3*p3[1]) for t in np.linspace(0,1,n+1)]
def path(start,segs):
    pts=[start]
    for c1,c2,end in segs: pts.extend(bezier(pts[-1],c1,c2,end)[1:])
    # Last Bézier endpoint intentionally closes at the first point; Polygon
    # appends its own closure and a duplicate would create zero-length mesh edges.
    if np.linalg.norm(np.asarray(pts[-1])-np.asarray(pts[0]))<1e-9: pts.pop()
    return orient(Polygon(pts),sign=1)
def normalized(poly):
    # Apply one common affine envelope normalization, never feature-by-feature.
    x0,y0,x1,y1=control_bounds
    return orient(Polygon([((x-x0)*(W/(x1-x0))-W/2,(y-y0)*(H/(y1-y0))) for x,y in list(poly.exterior.coords)[:-1]]),sign=1)

# Iteration 13 authored sampled control contour, normalized explicitly to the shared 24 x 30 envelope.
outline=path((0,30),[
 ((3.3,30),(5.7,28.8),(7.2,26.2)), ((9.3,25.4),(10.5,23.1),(10.5,20.7)),
 ((10.5,19.2),(9.8,18.1),(10.4,16.8)), ((10.8,15.7),(11.8,15.3),(11.8,14.3)),
 ((11.8,13.2),(11.2,12.4),(10.4,11.8)), ((10.3,9.5),(10.1,7.5),(10.4,5.2)),
 ((10.8,3.0),(9.7,1.3),(7.6,1.2)), ((5.9,1.1),(5.4,2.5),(4.7,2.5)),
 ((3.5,2.5),(2.6,2.5),(1.6,2.5)), ((.7,2.5),(0,2.7),(0,3.2)),
 ((0,2.7),(-.7,2.5),(-1.6,2.5)), ((-2.6,2.5),(-3.5,2.5),(-4.7,2.5)),
 ((-5.4,2.5),(-5.9,1.1),(-7.6,1.2)), ((-9.7,1.3),(-10.8,3.0),(-10.4,5.2)),
 ((-10.1,7.5),(-10.3,9.5),(-10.4,11.8)), ((-11.2,12.4),(-11.8,13.2),(-11.8,14.3)),
 ((-11.8,15.3),(-10.8,15.7),(-10.4,16.8)), ((-9.8,18.1),(-10.5,19.2),(-10.5,20.7)),
 ((-10.5,23.1),(-9.3,25.4),(-7.2,26.2)), ((-5.7,28.8),(-3.3,30),(0,30))])
control_bounds=outline.bounds
outline=normalized(outline)
face=normalized(path((0,24.4),[
 ((4.2,24.4),(6.5,23.4),(6.5,21.7)), ((6.5,19.5),(4.8,18.8),(0,18.8)),
 ((-4.8,18.8),(-6.5,19.5),(-6.5,21.7)), ((-6.5,23.4),(-4.2,24.4),(0,24.4))]))
def arch(cx):
    curve=bezier((cx-1.45,21.0),(cx-1.0,22.75),(cx+1.0,22.75),(cx+1.45,21.0),36)
    return orient(LineString(curve).buffer(.30,quad_segs=8,cap_style='round',join_style='round'),sign=1)
eyes=[normalized(arch(-2.55)),normalized(arch(2.55))]
seed=normalized(path((0,11.7),[((1.0,12.8),(1.8,15.0),(0.2,16.4)),((-1.4,15.3),(-1.8,13.1),(0,11.7))]))
# A shallow, rounded geometric crown stripe. Its top is lowered into the common 6 mm envelope.
stripe=normalized(path((0,29.25),[((1.45,29.25),(2.35,28.2),(2.35,26.5)),((2.35,25.4),(1.8,24.8),(0,24.8)),((-1.8,24.8),(-2.35,25.4),(-2.35,26.5)),((-2.35,28.2),(-1.45,29.25),(0,29.25))]))

def poly_solid(poly,z0,z1): return helper.loft([np.asarray(poly.exterior.coords)[:-1]]*2,[z0,z1])
def raised(poly,base,height,inset=.08):
    rings,_=helper.offset_rings(poly,[0,inset]); return helper.loft(rings,[base,base+height])
def component_count(mesh):
    p=list(range(len(mesh.vertices)))
    def f(i):
        while p[i]!=i:p[i]=p[p[i]];i=p[i]
        return i
    for a,b in mesh.edges_unique:p[f(int(a))]=f(int(b))
    return len({f(i) for i in range(len(p))})
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def mesh_metrics(mesh,path):
    counts=np.bincount(mesh.edges_unique_inverse)
    return {'boundsMm':mesh.bounds.tolist(),'widthMm':float(mesh.extents[0]),'heightMm':float(mesh.extents[1]),'depthMm':float(mesh.extents[2]),'volumeMm3':float(mesh.volume),'vertices':int(len(mesh.vertices)),'faces':int(len(mesh.faces)),'finiteVertices':bool(np.isfinite(mesh.vertices).all()),'watertight':bool(mesh.is_watertight),'allEdgesTwoFaces':bool(np.all(counts==2)),'positiveVolume':bool(mesh.volume>0),'windingConsistent':bool(mesh.is_winding_consistent),'eulerNumber':int(mesh.euler_number),'connectedComponents':component_count(mesh),'stlSha256':sha(path)}

variants=[]
for stripe_on in [False,True]:
  for draft in [0.0,2.0]:
    # Common back envelope at z=0; the front body contour moves inward under
    # pull by d(z)=z*tan(theta). The 30 mm character height is in XY.
    front_offset=BODY_DEPTH*math.tan(math.radians(draft))
    rings,polys=helper.offset_rings(outline,[0.0,front_offset])
    if not polys[0].buffer(1e-8).covers(polys[1]): raise RuntimeError('outer wall offset profiles not nested')
    body=helper.loft(rings,[0,BODY_DEPTH])
    # Match iteration 13's face recess loft exactly: constant .24 mm floor
    # inset and a direct wall to the original face boundary .03 mm past datum.
    face_rings,_=helper.offset_rings(face,[.24,.24])
    open_rings,_=helper.offset_rings(face,[0.0,0.0])
    recess=helper.loft([face_rings[0],open_rings[1]],[BODY_DEPTH-.72,BODY_DEPTH+.03])
    face_info={'floorMm':BODY_DEPTH-.72,'openingMm':BODY_DEPTH,'depthMm':.72,'floorInsetMm':.24,'openingInsetMm':0.0,'construction':'iteration 13 direct two-ring loft; cut extends 0.03 mm past front datum'}
    solid=body-recess
    if str(solid.status())!='Error.NoError': raise RuntimeError(f'cut status {solid.status()}')
    for e in eyes: solid=solid+raised(e,BODY_DEPTH-.72,.78,.08)
    solid=solid+raised(seed,BODY_DEPTH,.55,.08)
    if stripe_on: solid=solid+raised(stripe,BODY_DEPTH,.24,.06)
    buf=solid.to_mesh(); mesh=trimesh.Trimesh(vertices=np.asarray(buf.vert_properties)[:,:3],faces=np.asarray(buf.tri_verts),process=True)
    name=f"stripe-{('present' if stripe_on else 'absent')}_draft-{int(draft)}deg"
    stl=OUT/f'{name}.stl'; mesh.export(stl); mesh=trimesh.load_mesh(stl,process=True)
    metrics=mesh_metrics(mesh,stl)
    if not (metrics['finiteVertices'] and metrics['watertight'] and metrics['allEdgesTwoFaces'] and metrics['positiveVolume'] and metrics['windingConsistent'] and metrics['eulerNumber']==2 and metrics['connectedComponents']==1 and abs(metrics['widthMm']-W)<.015 and abs(metrics['heightMm']-H)<.015 and abs(metrics['depthMm']-TOTAL_DEPTH)<.015): raise RuntimeError(f'{name}: validation failed: {metrics}')
    section_table=[]
    for z in [.05,1.0,BODY_DEPTH/2,4.5,5.35]:
        section=helper.horizontal_section(mesh,z)
        candidates=list(getattr(section,'geoms',[section]))
        observed=max((g for g in candidates if g.geom_type=='Polygon'),key=lambda g:g.area)
        expected_inset=z*math.tan(math.radians(draft))
        expected=Polygon(helper.offset_rings(outline,[expected_inset])[0][0])
        from shapely.geometry import LineString
        section_table.append({'zMm':z,'expectedNormalInsetMm':expected_inset,'measuredOuterSectionAreaMm2':float(observed.area),'expectedOffsetAreaMm2':float(expected.area),'outerBoundaryHausdorffToExpectedMm':float(LineString(observed.exterior.coords).hausdorff_distance(LineString(expected.exterior.coords))),'boundsMm':[list(observed.bounds[:2]),list(observed.bounds[2:])]})
    concise_face=face_info
    variants.append({'id':name,'stripe':'present' if stripe_on else 'absent','nominalOuterDraftDegrees':draft,'bodyDepthMm':BODY_DEPTH,'frontNormalOffsetMm':front_offset,'body':metrics,'bodyProfileEvidence':{'method':'parallel polygon normal offsets at common z=0 back and z=5.45 mm front; serialized loft rings plus independently intersected final-STL sections','offsetLaw':'d(z) = z × tan(θ), for 0 ≤ z ≤ 5.45 mm','sections':[{'zMm':0,'insetMm':0,'sectionMethod':'generator loft ring and STL section'}, {'zMm':BODY_DEPTH,'insetMm':front_offset,'sectionMethod':'generator loft ring and STL section'}],'measuredSTLSections':section_table,'nested':True,'measuredNominalAngleDegrees':float(math.degrees(math.atan(front_offset/BODY_DEPTH)))},'face':concise_face,'stl':str(stl.relative_to(ROOT))})

generator_hash=sha(Path(__file__))
helper_hash=sha(HELPER)
for v in variants:
    v['sourcePins']={'generatorPath':'tools/sowers-canopy-factors.py','generatorSha256':generator_hash,'canonicalHelperPath':'tools/sowers-candy-form.py','canonicalHelperSha256':helper_hash}
(OUT/'factor-comparison.svg').unlink(missing_ok=True)
source_pins={'iteration13Generator':{'path':'tools/sowers-canopy-blockout.py','sha256':sha(ROOT/'tools/sowers-canopy-blockout.py')},'iteration13GeometryReport':{'path':'docs/sowers/prototypes/iteration-13-candy-solid.json','sha256':sha(ROOT/'docs/sowers/prototypes/iteration-13-candy-solid.json')},'generator':{'path':'tools/sowers-canopy-factors.py','sha256':generator_hash},'canonicalHelper':{'path':'tools/sowers-candy-form.py','sha256':helper_hash},'viewerHtml':{'path':'sowers/prototype-candy-factors/index.html','sha256':sha(ROOT/'sowers/prototype-candy-factors/index.html')},'viewerMain':{'path':'sowers/prototype-candy-factors/main.js','sha256':sha(ROOT/'sowers/prototype-candy-factors/main.js')},'viewerStyles':{'path':'sowers/prototype-candy-factors/style.css','sha256':sha(ROOT/'sowers/prototype-candy-factors/style.css')},'comparisonRendererHtml':{'path':'sowers/prototype-candy-factors/render-sheet.html','sha256':sha(ROOT/'sowers/prototype-candy-factors/render-sheet.html')},'comparisonRendererMain':{'path':'sowers/prototype-candy-factors/render-sheet.js','sha256':sha(ROOT/'sowers/prototype-candy-factors/render-sheet.js')}}
report={'iteration':14,'title':'Canopy candy controlled factor experiment','kind':'controlled-geometry-factor-study','units':'mm','dimensionsWHD':[24,30,6],'sourceControl':'Iteration 13 authored contour, normalized to shared 24×30 mm XY envelope','sourcePins':source_pins,'bodyDepthMm':BODY_DEPTH,'outerDraftDefinition':'True parallel normal offsets from common back control contour toward front at nominal 0°/2° over the 5.45 mm body wall depth; no XY scaling','factors':['crown stripe absent/present','outerwall draft nominal 0°/2°'],'commonFeatures':{'faceRecessMm':.72,'archesRiseFromFloorMm':.78,'seedRiseFromFrontMm':.55,'depthIncludesRelief':True,'back':'shared 24×30 mm flat blank'},'stripeGeometry':{'type':'rounded raised crown relief','heightMm':.24,'planformWidthMm':4.7,'verticalSpanMm':4.45,'notColorPatch':True},'comparisonSheet':{'path':'public/sowers/prototypes/canopy-factors/factor-comparison.png','sha256':sha(OUT/'factor-comparison.png'),'method':'Three.js WebGL orthographic render of each exact final STL; front and side per variant; common framing'},'variants':variants,'limits':['Review geometry only. No mold-release, food, supplier, tolerance, shrink, tooling or manufacturing approval.','Draft verification includes serialized loft rings and measured final-STL triangle/plane sections; section measurements are distinct from generator inputs.','The 30 mm character height is an XY envelope dimension; 2° nominal draft is along +Z through the 5.45 mm body depth, yielding a maximum inward normal offset of 0.190318 mm at the front body station.']}
(OUT/'geometry-report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
