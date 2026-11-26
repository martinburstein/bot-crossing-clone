import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { CANDY_VARIANTS, getCandyFeatures, getCandyRoundedSegments, sampleCandySegments } from '../sowers/candy/silhouettes.mjs';
const dir = new URL('../public/sowers/candy-form/', import.meta.url);
const report = JSON.parse(await readFile(new URL('geometry-report.json', dir), 'utf8'));
const sha = data => createHash('sha256').update(data).digest('hex');

test('positive masters retain canonical source provenance and millimetre dimensions', async () => {
  assert.equal(report.units, 'mm');
  assert.equal(report.kind, 'positive-master-preview');
  assert.equal(report.sourceSha256, sha(await readFile(new URL('../sowers/candy/silhouettes.mjs', import.meta.url))));
  assert.equal(report.assumptions.supplierConfirmedNumericMinima, false);
  assert.deepEqual(report.variants.map(v => v.id).sort(), Object.keys(CANDY_VARIANTS).sort());
  assert.equal(report.version, 'v2-drafted-rounded-shared-features');
  for (const [path, expected] of Object.entries(report.sourceHashes)) {
    assert.equal(sha(await readFile(new URL('../'+path, import.meta.url))), expected, path+' changed; regenerate physical masters');
  }
  assert.equal(report.generatorSha256, report.sourceHashes['tools/sowers-candy-form.py']);
  const canonicalBytes = await readFile(new URL('canonical-geometry.json',dir));
  assert.equal(sha(canonicalBytes),report.canonicalGeometrySha256);
  const canonical=JSON.parse(canonicalBytes);
  for(const variant of canonical.variants) {
    assert.deepEqual(variant.features,getCandyFeatures(variant.id));
    assert.deepEqual(variant.outline,sampleCandySegments(getCandyRoundedSegments(variant.id)));
  }
  assert.deepEqual(JSON.parse(report.parametersCanonicalJson),report.parameters);
  assert.equal(sha(report.parametersCanonicalJson),report.parametersSha256);
  const old=JSON.parse(await readFile(new URL('v1/geometry-report.json',dir)));
  assert.equal(old.parameters.outerDraftDegrees,0);
  assert.equal(old.sourceSha256,sha(await readFile(new URL('v1/silhouettes.mjs',dir))));
  const evidence=JSON.parse(await readFile(new URL('v1/evidence-manifest.json',dir)));
  for(const [path,expected] of Object.entries(evidence.files)) assert.equal(sha(await readFile(new URL('v1/'+path,dir))),expected,'v1 evidence '+path);
  for(const v of old.variants) assert.equal(sha(await readFile(new URL('v1/'+v.id+'-positive-mm.stl',dir))),v.stlSha256);
});

for (const entry of report.variants) {
  test(entry.id + ' serialized STL is one oriented closed solid with a flat back and no downward relief', async () => {
    const data = await readFile(new URL(entry.id + '-positive-mm.stl', dir));
    assert.equal(sha(data), entry.stlSha256);
    const count = data.readUInt32LE(80);
    assert.equal(data.length, 84 + count * 50);
    const verts = []; const vertexMap = new Map(); const edges = new Map(); const parent = []; const triangles=[];
    const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    let volume6 = 0; let backFaces = 0; const bounds = [[Infinity,Infinity,Infinity],[-Infinity,-Infinity,-Infinity]];
    for (let f = 0; f < count; f++) {
      const ids = [];
      for (let p = 0; p < 3; p++) {
        const v = Array.from({length:3}, (_,k) => data.readFloatLE(84 + f*50 + 12 + p*12 + k*4));
        assert(v.every(Number.isFinite));
        v.forEach((n,k) => { bounds[0][k]=Math.min(bounds[0][k],n);bounds[1][k]=Math.max(bounds[1][k],n); });
        const key=v.join(',');
        if (!vertexMap.has(key)) { const i=verts.length;vertexMap.set(key,i);verts.push(v);parent.push(i); }
        ids.push(vertexMap.get(key));
      }
      assert.equal(new Set(ids).size,3,'no collapsed triangles');
      const [a,b,c]=ids.map(i=>verts[i]);
      triangles.push([a,b,c]);
      const ab=b.map((n,k)=>n-a[k]);const ac=c.map((n,k)=>n-a[k]);
      const n=[ab[1]*ac[2]-ab[2]*ac[1], ab[2]*ac[0]-ab[0]*ac[2], ab[0]*ac[1]-ab[1]*ac[0]];
      assert(Math.hypot(...n)>1e-8);
      if (n[2]<-1e-8) { assert([a,b,c].every(v=>Math.abs(v[2])<1e-6),'downward face must be on back');backFaces++; }
      volume6+=a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]);
      for(let j=0;j<3;j++) {
        const a=ids[j],b=ids[(j+1)%3];parent[find(a)]=find(b);
        const key=Math.min(a,b)+':'+Math.max(a,b);const e=edges.get(key)||{count:0,orientation:0};
        e.count++;e.orientation+=a<b?1:-1;edges.set(key,e);
      }
    }
    assert(backFaces>0);
    for(const edge of edges.values()) { assert.equal(edge.count,2);assert.equal(edge.orientation,0); }
    assert.equal(new Set(verts.map((_,i)=>find(i))).size,1);
    assert.equal(verts.length-edges.size+count,2);
    assert(volume6>0);
    assert(Math.abs(volume6/6-entry.volumeMm3)<.01);
    assert(Math.abs(bounds[1][1]-bounds[0][1]-30)<1e-5);
    assert(Math.abs(bounds[1][2]-bounds[0][2]-6)<1e-5);
    assert.equal(bounds[0][2],0);
    assert.equal(count,entry.faceCount);
    assert(entry.outlineRadiusTargetMet);
    assert(entry.minimumQuadraticRadiusMmSampled>=.6);
    assert(entry.curvature.backTargetMet);
    assert(entry.curvature.frontEstimateTargetMet);
    assert.match(entry.curvature.scope,/faceted/);
    assert(entry.outerDraft.nestedProfiles);
    assert(entry.sectionCheck.nested);
    assert(entry.outerDraft.measuredFaceNormalRangeDegrees[0]>1.99);
    assert(entry.outerDraft.measuredFaceNormalRangeDegrees[1]<2.01);
    assert.equal(entry.bodyFrontMm,5.35);
    // Every canonical sampled point must appear at its actual physical plane:
    // this catches an independently invented contour, eye shape or eye spacing.
    const outline=sampleCandySegments(getCandyRoundedSegments(entry.id));
    const ymin=Math.min(...outline.map(p=>p[1]));
    const factor=30/(Math.max(...outline.map(p=>p[1]))-ymin);
    const shared=[{id:'outline',points:outline},...Object.values(getCandyFeatures(entry.id)).flat()];
    for(const feature of shared) {
      const z={outline:0,helmet:5.35,chest:5.35,face:6,'left-eye':5.7,'right-eye':5.7}[feature.id];
      for(const [x,y] of feature.points) {
        assert(verts.some(v=>Math.hypot(v[0]-x*factor,v[1]-(y-ymin)*factor,v[2]-z)<1e-5),feature.id+' shared point must exist in STL');
      }
    }
    // Ray/triangle intersection independently verifies actual relief plane
    // locations in the exported STL, not merely the JSON's nominal depths.
    for(const probe of entry.measurementProbes) {
      const [x,y]=probe.xyMm; const hits=[];
      for(const [a,b,c] of triangles) {
        const den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
        if(Math.abs(den)<1e-12) continue;
        const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/den;
        const v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/den;
        if(u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7) hits.push(u*a[2]+v*b[2]+(1-u-v)*c[2]);
      }
      const expected={helmet:6,face:5.7,'left-eye':5.92,'right-eye':5.92,chest:5.75}[probe.feature];
      assert.equal(probe.expectedTopZMm,expected);
      assert(Math.abs(Math.max(...hits)-expected)<1e-5,probe.feature+' actual STL relief height');
      assert(Math.abs(Math.min(...hits))<1e-6);
    }
  });
}
