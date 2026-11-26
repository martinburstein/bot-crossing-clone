import test from 'node:test'
import assert from 'node:assert/strict'
import { mountUsageHUD } from '../sowers/usage-hud.js'

class Node {
  constructor(tag='div'){this.tagName=tag;this.children=[];this.attrs={};this.hidden=false;this.textContent='';this.classList={values:new Set(),toggle:(name,on)=>on?this.classList.values.add(name):this.classList.values.delete(name)}}
  setAttribute(key,value){this.attrs[key]=value}
  replaceChildren(...children){this.children=children}
}
class Host {
  constructor(){this.nodes=new Map();this.innerHTML=''}
  set innerHTML(_value){for(const key of ['[data-chat]','[data-wave]','[data-chat-status]','[data-wave-status]','[data-allowance]','[data-details]','[data-panel]','[data-description]','[data-time]','[data-workers]','[data-warning]'])this.nodes.set(key,new Node())}
  get innerHTML(){return ''}
  querySelector(selector){return this.nodes.get(selector)}
}

test('historical chat and wave totals are labelled separately from a fresh account allowance',async()=>{
  const old={fetch:globalThis.fetch,createElement:globalThis.document?.createElement,setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval}
  const now=new Date().toISOString(),host=new Host()
  globalThis.document={createElement:tag=>new Node(tag)};globalThis.setInterval=()=>1;globalThis.clearInterval=()=>{}
  globalThis.fetch=async()=>({ok:true,json:async()=>({chat:{status:'error',stale:true,reportedAt:now,totalTokens:1200},workers:[1,2,3].map(i=>({id:`agent-${i}`,status:'error',stale:true,totalTokens:100*i})),waveTokens:600,waveStale:true,workersFresh:false,account:{status:'connected',reportedAt:now,remainingPercent:5},warnings:['Prior totals retained after source failure.']})})
  try {
    const hud=mountUsageHUD(host)
    hud.setObservation({id:'wave',agents:[1,2,3].map(i=>({id:`agent-${i}`}))})
    await new Promise(resolve=>setImmediate(resolve))
    assert.equal(host.querySelector('[data-chat]').textContent,'1.2K')
    assert.equal(host.querySelector('[data-chat-status]').textContent,' · last known')
    assert.equal(host.querySelector('[data-wave]').textContent,'600')
    assert.equal(host.querySelector('[data-wave-status]').textContent,' · last known')
    assert.equal(host.querySelector('[data-allowance]').textContent,'5% left')
    assert.ok(host.querySelector('[data-workers]').children.every(row=>row.textContent.includes('last known')))
    hud.dispose()
  } finally {globalThis.fetch=old.fetch;globalThis.document=old.createElement?{createElement:old.createElement}:undefined;globalThis.setInterval=old.setInterval;globalThis.clearInterval=old.clearInterval}
})

test('worker tokens stay unknown unless all three distinct participant IDs match exactly',async()=>{
  const saved={fetch:globalThis.fetch,createElement:globalThis.document?.createElement,setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval},host=new Host(),now=new Date().toISOString()
  globalThis.document={createElement:tag=>new Node(tag)};globalThis.setInterval=()=>1;globalThis.clearInterval=()=>{}
  globalThis.fetch=async()=>({ok:true,json:async()=>({chat:{status:'connected',reportedAt:now,totalTokens:7},workers:[{id:'a',status:'connected',totalTokens:0},{id:'a',status:'connected',totalTokens:5},{id:'c',status:'connected',totalTokens:8}],waveTokens:13,account:{status:'connected',reportedAt:now,remainingPercent:5}})})
  try {
    const hud=mountUsageHUD(host);hud.setObservation({id:'w',agents:[{id:'a'},{id:'b'},{id:'c'}]});await new Promise(resolve=>setImmediate(resolve))
    assert.equal(host.querySelector('[data-wave]').textContent,'—');hud.dispose()
  } finally {globalThis.fetch=saved.fetch;globalThis.document=saved.createElement?{createElement:saved.createElement}:undefined;globalThis.setInterval=saved.setInterval;globalThis.clearInterval=saved.clearInterval}
})
