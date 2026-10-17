import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyMacLayout,openMacOffice} from '../tools/financial-office-macos.mjs';

test('Mac receipt rejects minimum-width clamping and missing readbacks',()=>{
  const r={left:{position:[0,26],size:[718,824]},right:{position:[722,26],size:[718,824]},target:{leftPosition:[0,26],rightPosition:[722,26],size:[718,824]}};
  assert.equal(verifyMacLayout(r),true);
  assert.equal(verifyMacLayout({...r,left:{...r.left,size:[900,824]}}),false);
  assert.equal(verifyMacLayout({...r,right:{}}),false);
});

test('Mac launcher refuses remote browser URLs before touching the OS',()=>{
  assert.throws(()=>openMacOffice('https://example.com'),/loopback/);
  assert.throws(()=>openMacOffice('http://127.0.0.1:57986',{callerName:'bad\nname'}),/Invalid caller/);
});
