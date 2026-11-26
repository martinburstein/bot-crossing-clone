#!/usr/bin/env python3
"""Build one review-only canopy candy solid and orthographic evidence."""
import hashlib, importlib.util, json, math
from pathlib import Path
import numpy as np
import trimesh
import manifold3d as md
from shapely.geometry import Polygon, LineString
from shapely.geometry.polygon import orient

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('candy_form', ROOT/'tools/sowers-candy-form.py')
candy=importlib.util.module_from_spec(spec); spec.loader.exec_module(candy)

def bezier(p0,p1,p2,p3,n=12):
    return [((1-t)**3*p0[0]+3*(1-t)**2*t*p1[0]+3*(1-t)*t*t*p2[0]+t**3*p3[0],
             (1-t)**3*p0[1]+3*(1-t)**2*t*p1[1]+3*(1-t)*t*t*p2[1]+t**3*p3[1]) for t in np.linspace(0,1,n+1)]

def path(start, segs):
    pts=[start]
    for c1,c2,end in segs: pts.extend(bezier(pts[-1],c1,c2,end)[1:])
    return Polygon(pts)

def bezier_poly(points):
    return Polygon(points)

def ellipse(cx,cy,rx,ry,n=48):
    return Polygon([(cx+rx*math.cos(t),cy+ry*math.sin(t)) for t in np.linspace(0,2*math.pi,n,endpoint=False)])

def poly_solid(poly,z0,z1):
    poly=orient(poly,sign=1)
    return candy.loft([np.asarray(poly.exterior.coords)[:-1]]*2,[z0,z1])

def raised(poly, base, height, inset=.42):
    # Positive relief narrows toward its tip, so its sidewall drafts inward.
    rings,_=candy.offset_rings(poly,[0,inset])
    return candy.loft([rings[0],rings[1]],[base,base+height])

# An authored, sampled contour: broad shallow crown flows directly into shoulders;
# mitten and boot lobes remain joined by necks with a small gap between the boots.
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
# Feature shapes are all planar in the front view. The visor is a shallow inset;
# arch eyes and seed are simple continuous raised shapes.
face=path((0,24.4),[
 ((4.2,24.4),(6.5,23.4),(6.5,21.7)), ((6.5,19.5),(4.8,18.8),(0,18.8)),
 ((-4.8,18.8),(-6.5,19.5),(-6.5,21.7)), ((-6.5,23.4),(-4.2,24.4),(0,24.4))])
def arch(cx):
    left=(cx-1.45,21.0); right=(cx+1.45,21.0)
    curve=bezier(left,(cx-1.0,22.75),(cx+1.0,22.75),right,36)
    # A round-ended stroked inverted-U keeps a visibly open eye gap underneath.
    return LineString(curve).buffer(.30,quad_segs=8,cap_style='round',join_style='round')
eyes=[arch(-2.55),arch(2.55)]
seed=path((0,11.7),[((1.0,12.8),(1.8,15.0),(0.2,16.4)),((-1.4,15.3),(-1.8,13.1),(0,11.7))])

# Millimetres: 30 high, 23.6 wide, 6 total including the relief.
scale=12/11.8
def scale_poly(p): return Polygon([(x*scale,(y-1.2)*(30/28.8)) for x,y in p.exterior.coords])
outline=scale_poly(outline)
face=scale_poly(face)
eyes=[scale_poly(p) for p in eyes]
seed=scale_poly(seed)
basefront=5.45; solid=poly_solid(outline,0,basefront)
solid=solid-candy.loft([candy.offset_rings(face,[.24,.24])[0][0],candy.offset_rings(face,[0,0])[0][1]],[basefront-.72,basefront+.03])
for e in eyes: solid=solid+raised(e,basefront-.72,.78,.08)
solid=solid+raised(seed,basefront,.55,.08)
buf=solid.to_mesh(); mesh=trimesh.Trimesh(vertices=np.asarray(buf.vert_properties)[:,:3],faces=np.asarray(buf.tri_verts),process=True)
outdir=ROOT/'public/sowers/prototypes/canopy-blockout'; outdir.mkdir(parents=True,exist_ok=True)
stl=outdir/'canopy-solid-mm.stl'; mesh.export(stl)
mesh=trimesh.load_mesh(stl,process=True)
def components(m):
    parent=list(range(len(m.vertices)))
    def find(i):
        while parent[i]!=i: parent[i]=parent[parent[i]]; i=parent[i]
        return i
    for a,b in m.edges_unique: parent[find(int(a))]=find(int(b))
    return len({find(i) for i in range(len(parent))})
edgeCounts=np.bincount(mesh.edges_unique_inverse)
metrics={'units':'mm','boundsMm':mesh.bounds.tolist(),'widthMm':float(mesh.extents[0]),'heightMm':float(mesh.extents[1]),'depthMm':float(mesh.extents[2]),'volumeMm3':float(mesh.volume),'vertices':len(mesh.vertices),'faces':len(mesh.faces),'finiteVertices':bool(np.isfinite(mesh.vertices).all()),'watertight':bool(mesh.is_watertight),'allEdgesTwoFaces':bool(np.all(edgeCounts==2)),'positiveVolume':bool(mesh.volume>0),'windingConsistent':bool(mesh.is_winding_consistent),'eulerNumber':int(mesh.euler_number),'oneComponent':components(mesh)==1,'componentCount':components(mesh),'stlSha256':hashlib.sha256(stl.read_bytes()).hexdigest(),'frontRelief':'face recess 0.72 mm; arch eyes rise 0.78 mm from recess floor; seed rises 0.55 mm','profile':'single polygon slab; flat back at z=0'}
if not (metrics['finiteVertices'] and metrics['watertight'] and metrics['allEdgesTwoFaces'] and metrics['positiveVolume'] and metrics['windingConsistent'] and metrics['eulerNumber']==2 and metrics['oneComponent'] and abs(metrics['widthMm']-24)<.01 and abs(metrics['heightMm']-30)<.01 and abs(metrics['depthMm']-6)<.01): raise RuntimeError(metrics)
source='tools/sowers-canopy-blockout.py'; metrics['generatorSha256']=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
metrics['sourceSha256']=hashlib.sha256((ROOT/'tools/sowers-candy-form.py').read_bytes()).hexdigest()
(outdir/'geometry-report.json').write_text(json.dumps(metrics,indent=2)+'\n')
print(json.dumps(metrics,indent=2))
