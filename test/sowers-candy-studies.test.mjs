import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dir=new URL('../public/sowers/candy-studies/',import.meta.url);
const sha=data=>createHash('sha256').update(data).digest('hex');
const json=async file=>JSON.parse(await readFile(new URL(file,dir),'utf8'));
const report=await json('study-report.json');
function parse(data){
  const n=data.readUInt32LE(80);assert.equal(data.length,84+50*n);
  const vertices=[],triangles=[],ids=new Map(),edges=new Map(),parents=[];
  const root=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
  let volume6=0;const bounds=[[Infinity,Infinity,Infinity],[-Infinity,-Infinity,-Infinity]];
  for(let f=0;f<n;f++){
    const face=[];
    for(let i=0;i<3;i++){
      const p=Array.from({length:3},(_,k)=>data.readFloatLE(84+50*f+12+12*i+4*k));assert(p.every(Number.isFinite));
      p.forEach((x,k)=>{bounds[0][k]=Math.min(bounds[0][k],x);bounds[1][k]=Math.max(bounds[1][k],x);});
      const key=p.join(',');if(!ids.has(key)){ids.set(key,vertices.length);parents.push(vertices.length);vertices.push(p);}face.push(ids.get(key));
    }
    assert.equal(new Set(face).size,3);
    const [a,b,c]=face.map(i=>vertices[i]);triangles.push([a,b,c]);
    volume6+=a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]);
    for(let i=0;i<3;i++){const a=face[i],b=face[(i+1)%3],key=Math.min(a,b)+','+Math.max(a,b),e=edges.get(key)||[0,0];e[0]++;e[1]+=a<b?1:-1;edges.set(key,e);parents[root(a)]=root(b);}
  }
  for(const e of edges.values())assert.deepEqual(e,[2,0]);
  assert.equal(new Set(vertices.map((_,i)=>root(i))).size,1);assert.equal(vertices.length-edges.size+n,2);assert(volume6>0);
  return {vertices,triangles,bounds,volume:volume6/6};
}
function ray(mesh,[x,y]){
  const hits=[];
  for(const [a,b,c] of mesh.triangles){
    const den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-12)continue;
    const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/den,v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/den;
    if(u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7)hits.push(u*a[2]+v*b[2]+(1-u-v)*c[2]);
  }
  return Math.max(...hits);
}
test('studies pin retained sources, exact reusable parameters and every published artifact',async()=>{
  assert.equal(report.assumptions.supplierConfirmedNumericMinimum,false);
  assert.equal(sha(report.parametersCanonicalJson),report.parametersSha256);
  for(const [path,expected] of Object.entries(report.sourceHashes))assert.equal(sha(await readFile(new URL(report.sourceSnapshotFiles[path],dir))),expected,path);
  assert.equal(sha(await readFile(new URL('../tools/sowers-candy-studies.py',import.meta.url))),report.sourceHashes['tools/sowers-candy-studies.py']);
  for(const [file,expected] of Object.entries(report.files))assert.equal(sha(await readFile(new URL(file,dir))),expected,file);
});
const baseline=await json('baseline-candidate.json');
for(const entry of report.candidates)test(entry.id+' actual STL preserves Scout, feature heights and closed orientation',async()=>{
  const meta=await json(entry.id+'-candidate.json'),data=await readFile(new URL(entry.id+'-positive-mm.stl',dir)),mesh=parse(data);
  assert.equal(sha(data),entry.stlSha256);assert(Math.abs(mesh.volume-entry.volumeMm3)<.01);
  assert.deepEqual(meta.normalizedSource.outline,baseline.normalizedSource.outline);
  const dimensions=mesh.bounds[1].map((x,k)=>x-mesh.bounds[0][k]);assert(Math.abs(dimensions[1]-30)<1e-5);assert(Math.abs(dimensions[2]-6)<1e-5);assert.equal(mesh.bounds[0][2],0);
  for(let i=0;i<2;i++)for(const key of ['x','y'])assert.equal(meta.normalizedSource.features.eyes[i][key],baseline.normalizedSource.features.eyes[i][key]);
  for(const [x,y] of baseline.normalizedSource.outline)assert(mesh.vertices.some(p=>Math.hypot(p[0]-x*meta.scaleMmPerNormalizedUnit,p[1]-y*meta.scaleMmPerNormalizedUnit,p[2])<1e-5));
  for(const probe of meta.measurementProbes)assert(Math.abs(ray(mesh,probe.xyMm)-probe.expectedZMm)<1e-5,probe.feature+' serialized top');
  for(const [a,b,c] of mesh.triangles){const nz=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);if(nz< -1e-8)assert([a,b,c].every(p=>Math.abs(p[2])<1e-6));}
  assert(meta.sectionCheck.nestedTowardsPositiveZ);assert(meta.sectionCheck.maxNonNestedAreaMm2<1e-7);
  if(entry.id!=='baseline'){
    assert.equal(meta.parameters.eyeLocalSegments.length,8);
    assert.equal(meta.eyeStrokeMeasurements.crestArmSpansAtCenterYMm.length,4);
    assert(Math.min(...meta.eyeStrokeMeasurements.crestArmSpansAtCenterYMm)>.95);
    assert(meta.features['left-eye'].sourceQuadraticRadiusRangeMm.minimumMm>.20);
    const segments=meta.parameters.eyeLocalSegments;
    // Every adjacent quadratic has tangent continuity, including lower tips.
    for(let i=0;i<segments.length;i++){
      const a=segments[i],b=segments[(i+1)%segments.length];assert.deepEqual(a.after,b.before);
      const u=a.after.map((v,k)=>v-a.corner[k]),v=b.corner.map((v,k)=>v-b.before[k]);assert(Math.abs(u[0]*v[1]-u[1]*v[0])<1e-12);assert(u[0]*v[0]+u[1]*v[1]>0);
    }
  }
});
test('2x2 negative coupon subtracts the actual positive and has measured open cavities with stock',async()=>{
  const entry=await json('negative-coupon-report.json'),mesh=parse(await readFile(new URL('broad-moderate-2x2-negative-coupon-mm.stl',dir))),positive=await json('broad-moderate-candidate.json');
  assert.equal(entry.sourcePositiveStlSha256,positive.stlSha256);assert.equal(entry.cavityCount,4);assert.deepEqual(entry.extractionAxis,[0,0,1]);
  assert(Math.abs(mesh.volume-entry.expectedRemainingVolumeMm3)<.03);assert.equal(entry.minimumFloorStockMm,3);assert.equal(entry.minimumPerimeterStockMm,5);assert(entry.minimumBetweenOpeningBoundsStockMm>=8);
  assert.deepEqual(mesh.bounds.map(p=>p[2]),[-9,0]);
  for(const [x,y] of entry.centersMm)for(const p of positive.measurementProbes)assert(Math.abs(ray(mesh,[p.xyMm[0]+x,p.xyMm[1]+y-15])+p.expectedZMm)<1e-5,'cavity '+p.feature);
  assert(entry.openingSectionCheck.cavitiesWidenTowardsPositiveZ);assert(entry.openingSectionCheck.maxNonNestedSolidAreaMm2<1e-7);
});
