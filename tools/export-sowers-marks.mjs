import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { CANDY_VARIANTS,getCandyContour,getCandyRoundedSegments,sampleCandySegments,getCandyFeatures,candySegmentsPath } from '../sowers/candy/silhouettes.mjs'

const root=fileURLToPath(new URL('../',import.meta.url))
const output=path.resolve(root,process.argv[2] || 'public/sowers/marks')
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')
const variants=Object.keys(CANDY_VARIANTS)
const colors={scout:'#f58b38',seed:'#b1c947',bud:'#e76492'}
function bounds(variant) {
 const points=sampleCandySegments(getCandyRoundedSegments(variant),32)
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1])
 return {minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)}
}
function mark(variant,mode) {
 const feature=getCandyFeatures(variant),parts=[]
 const fill=mode==='color'?colors[variant]:'#263b32'
 parts.push(`<path d="${getCandyContour(variant)}" fill="${fill}"/>`)
 if(mode!=='silhouette') {
  const front=(item,color)=>`<path d="${candySegmentsPath(item.segments)}" fill="${color}"/>`
  parts.push(front(feature.helmet,mode==='color'?'#fff5df':'#fff'))
  parts.push(front(feature.face,'#263b32'))
  for(const eye of feature.eyes)parts.push(front(eye,mode==='color'?'#fff5df':'#fff'))
  parts.push(front(feature.chest,mode==='color'?'#d66b26':'#fff'))
 }
 return `<g transform="scale(1,-1)">${parts.join('')}</g>`
}
function svg(variant,mode) {
 const b=bounds(variant),pad=.035
 const view=[b.minX-pad,-b.maxY-pad,b.maxX-b.minX+pad*2,b.maxY-b.minY+pad*2].join(' ')
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}" role="img" aria-label="Sowers ${variant} ${mode} graphic"><title>Sowers ${escape(CANDY_VARIANTS[variant].name)} / ${mode}</title>${mark(variant,mode)}</svg>\n`
}
await fs.mkdir(output,{recursive:true})
const files=[]
for(const variant of variants)for(const mode of ['color','ink','silhouette']) {
 const file=`${variant}-${mode}.svg`;await fs.writeFile(path.join(output,file),svg(variant,mode));files.push(file)
}
const rows=[16,24,32,48,96]
const sheet=[`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="760" viewBox="0 0 1000 760"><rect width="1000" height="760" fill="#fbf7ee"/><g font-family="Arial,sans-serif" fill="#263b32"><text x="35" y="42" font-size="24" font-weight="700">SOWERS / SMALL-SIZE GRAPHIC CHECK</text><text x="35" y="68" font-size="12">Native SVG pixels at 100% · design comparison, not consumer recognition testing</text>`]
for(const [index,variant] of variants.entries())sheet.push(`<text x="${240+index*280}" y="112" text-anchor="middle" font-size="15" font-weight="700">${variant.toUpperCase()}</text>`)
for(const [row,size] of rows.entries()) {
 const centerY=160+row*115
 sheet.push(`<text x="35" y="${centerY+4}" font-size="13">${size} px</text>`)
 for(const [column,variant]of variants.entries()) {
  const b=bounds(variant),scale=size/(b.maxY-b.minY)
  for(const [index,mode]of ['color','ink','silhouette'].entries()) {
   const centerX=150+column*280+index*90
   sheet.push(`<g transform="translate(${centerX},${centerY+size/2}) scale(${scale}) translate(${-(b.minX+b.maxX)/2},${b.minY})">${mark(variant,mode)}</g>`)
  }
 }
}
sheet.push('<text x="35" y="738" font-size="12">Per column: color / one ink on white / pure silhouette. These graphics do not represent candy surface relief.</text></g></svg>')
await fs.writeFile(path.join(output,'readability-sheet.svg'),sheet.join(''))
const source=await fs.readFile(path.join(root,'sowers/candy/silhouettes.mjs'))
await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify({kind:'graphic-marks',source:'sowers/candy/silhouettes.mjs',sourceSha256:createHash('sha256').update(source).digest('hex'),files:[...files,'readability-sheet.svg'],note:'Color and one-ink print graphics; physical relief is the separate positive-master STL.'},null,2)+'\n')
console.log(`Exported ${files.length} vector marks and a native-size readability sheet to ${path.relative(root,output)}`)
