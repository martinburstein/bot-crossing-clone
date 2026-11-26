import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCandySower} from '../sowers/candy/mascot.js';
import {CANDY_VARIANTS,getCandyRoundedSegments,getCandyFeatures,sampleCandySegments,getCandyFrontBulge} from '../sowers/candy/silhouettes.mjs';
const variants=Object.keys(CANDY_VARIANTS);
function inside([x,y],polygon) {
  let result=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[i],b=polygon[j];
    if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])result=!result;
  }
  return result;
}
function minimumRadiusMm(segments) {
  const outline=sampleCandySegments(segments,100),ys=outline.map(p=>p[1]),factor=30/(Math.max(...ys)-Math.min(...ys));
  let minimum=Infinity;
  for(const {before:a,corner:b,after:c} of segments) {
    const dd=c.map((n,k)=>2*(n-2*b[k]+a[k]));
    for(let j=0;j<=100;j++) {
      const t=j/100,d=a.map((n,k)=>2*((1-t)*(b[k]-n)+t*(c[k]-b[k])));
      const cross=Math.abs(d[0]*dd[1]-d[1]*dd[0]);
      if(cross>1e-12)minimum=Math.min(minimum,Math.hypot(...d)**3/cross*factor);
    }
  }
  return minimum;
}
for(const variant of variants) {
  test(variant+' keeps broad corners and contains all canonical front features',()=>{
    const segments=getCandyRoundedSegments(variant),outline=sampleCandySegments(segments,40),features=getCandyFeatures(variant);
    assert(minimumRadiusMm(segments)>=.6,'30mm contour curvature target');
    for(const feature of [features.helmet,features.face,...features.eyes,features.chest]) {
      assert(feature.points.every(point=>point.every(Number.isFinite)&&inside(point,outline)),feature.id+' inside one-piece body');
      assert.deepEqual(feature.points,sampleCandySegments(feature.segments));
    }
    assert(Math.abs(features.eyes[0].x-(features.face.x-.09))<1e-12);
    assert(Math.abs(features.eyes[1].x-(features.face.x+.09))<1e-12);
    assert.equal(features.eyes[0].y,features.face.y+.008);
    assert(features.eyes.every(eye=>eye.points.every(p=>inside(p,features.face.points))));
  });
  test(variant+' has real neutral relief, grounded height and one-color gummy geometry',()=>{
    for(const mode of ['matte','gummy','silhouette']) {
      const model=createCandySower({variant,materialMode:mode}),box=new THREE.Box3().setFromObject(model);
      assert(Math.abs(box.min.y)<1e-7);assert(Math.abs(box.max.y-1.85)<1e-6);
      const face=model.userData.face,children=face.children;
      assert.deepEqual(children.map(c=>c.name),['domed-helmet-boundary','recessed-mask','left-eye-relief','right-eye-relief','chest-leaf-stamp']);
      assert.equal(face.visible,mode!=='silhouette');
      if(mode==='gummy')assert(children.every(child=>child.material===model.userData.body.material),'no implied dark inserts');
      // Compare actual relief heights after removing the shared curved body
      // baseline; the middle of a dome may project beyond its outer rim.
      const sourceFace=CANDY_VARIANTS[variant].face,scale=face.position.y/sourceFace.y;
      const reliefCrest=mesh=>{
        const positions=mesh.geometry.attributes.position;let maximum=-Infinity;
        for(let i=0;i<positions.count;i++)maximum=Math.max(maximum,mesh.position.z+positions.getZ(i)-
          getCandyFrontBulge(variant,positions.getX(i)/scale+sourceFace.x,positions.getY(i)/scale+sourceFace.y)*scale);
        return maximum;
      };
      const millimetres=30/1.85,features=getCandyFeatures(variant);
      const expected=[features.helmet.surface.heightMm,
        features.helmet.surface.heightMm-features.face.surface.depthMm,
        ...features.eyes.map(eye=>features.helmet.surface.heightMm-features.face.surface.depthMm+eye.surface.heightMm),
        features.chest.surface.heightMm];
      children.forEach((child,index)=>assert(Math.abs(reliefCrest(child)*millimetres-expected[index])<1e-5,
        child.name+' matches nominal relief mm at final 30mm body height'));
      assert.equal(children[1].position.z,features.face.surface.edgeRoundMm/millimetres);
      assert(reliefCrest(children[0])>reliefCrest(children[1]),'recessed mask below its local helmet crest');
      assert(getCandyFrontBulge(variant,0,CANDY_VARIANTS[variant].face.y)>0);
      model.traverse(object=>{if(object.geometry)for(const value of object.geometry.attributes.position.array)assert(Number.isFinite(value));});
    }
  });
  test(variant+' keeps connected-body poses finite and restores the complete neutral state',()=>{
    const model=createCandySower({variant,seed:17}),positions=model.userData.body.geometry.attributes.position;
    const original=positions.array.slice();
    const surfaces=model.userData.face.children.map(mesh=>({mesh,positions:mesh.geometry.attributes.position.array.slice()}));
    const originalFace=model.userData.face.position.clone();
    for(const status of ['idle','working','review','waiting','complete','error'])for(const moving of [false,true]) {
      for(let frame=0;frame<120;frame++) {
        model.userData.animate(frame/60,1/60,{status,moving,selected:frame%2===0});model.updateMatrixWorld(true);
        if(frame%20===0) {
          model.traverse(object=>{assert(object.matrixWorld.elements.every(Number.isFinite));assert.deepEqual(object.scale.toArray(),[1,1,1],'no balloon scaling');});
          assert(model.userData.face.position.equals(originalFace),'helmet stays attached to body coordinates');
          const box=new THREE.Box3().setFromObject(model);assert(box.min.y>=-1e-7,'world ground remains clear');
          for(let i=0;i<positions.count;i++) {
            assert(Number.isFinite(positions.getX(i))&&Number.isFinite(positions.getY(i))&&Number.isFinite(positions.getZ(i)));
            assert(positions.getY(i)>=-1e-7,'attached vertices never fall below neutral ground');
          }
        }
      }
    }
    model.userData.animate(NaN,Infinity,{status:'working',moving:true});
    assert(positions.array.every(Number.isFinite));
    model.userData.resetPose();assert.deepEqual(positions.array,original);assert.equal(model.userData.getStatus(),'idle');
    assert.equal(model.children[0].position.y,0);assert.equal(model.userData.face.rotation.z,0);
    for(const {mesh,positions:neutral} of surfaces)assert.deepEqual(mesh.geometry.attributes.position.array,neutral,'exact canonical relief restored');
  });
}
test('Scout helmet is wider than its compact attached hand span',()=>{
  const points=CANDY_VARIANTS.scout.points;
  const span=predicate=>{const xs=points.filter(([,y])=>predicate(y)).map(([x])=>x);return Math.max(...xs)-Math.min(...xs);};
  assert(span(y=>y>.60)>=span(y=>y>.33&&y<.50));
});

test('Six held Scout poses have distinct connected contours and eye pivots',()=>{
  const model=createCandySower({variant:'scout',seed:0}),poses=[];
  for(const status of ['idle','working','review','waiting','complete','error']) {
    model.userData.resetPose();model.userData.animate(0,.1,{status});
    const body=model.userData.body.geometry.attributes.position.array;
    const eyes=model.userData.face.children.filter(mesh=>mesh.name.includes('eye')).map(mesh=>Array.from(mesh.geometry.attributes.position.array));
    poses.push({status,body:Array.from(body),eyes:eyes.flat()});
  }
  for(let i=0;i<poses.length;i++)for(let j=i+1;j<poses.length;j++) {
    assert(poses[i].body.some((value,k)=>Math.abs(value-poses[j].body[k])>.035),poses[i].status+'/'+poses[j].status+' body gesture');
    assert(poses[i].eyes.some((value,k)=>Math.abs(value-poses[j].eyes[k])>.012),poses[i].status+'/'+poses[j].status+' eye expression');
  }
});
