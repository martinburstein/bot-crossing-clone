import { getCandyContour,getCandyFeatures,candySegmentsPath } from './silhouettes.mjs'

/** A small vector mark uses the same neutral paths as the character and master. */
export function createSowerMark({variant='scout',color='#f58b38'}={}) {
  const ns='http://www.w3.org/2000/svg'
  const svg=document.createElementNS(ns,'svg')
  svg.setAttribute('viewBox','-.53 -1.06 1.06 1.12')
  svg.setAttribute('aria-hidden','true')
  const group=document.createElementNS(ns,'g');group.setAttribute('transform','scale(1,-1)')
  const add=(d,fill)=>{const p=document.createElementNS(ns,'path');p.setAttribute('d',d);p.setAttribute('fill',fill);group.append(p)}
  add(getCandyContour(variant),color)
  const features=getCandyFeatures(variant)
  add(candySegmentsPath(features.helmet.segments),'#fff4da')
  add(candySegmentsPath(features.face.segments),'#2b4035')
  for(const eye of features.eyes)add(candySegmentsPath(eye.segments),'#fff4da')
  add(candySegmentsPath(features.chest.segments),color)
  svg.append(group)
  return svg
}
