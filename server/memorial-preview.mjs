import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import {assessMemorialLegibility,validateMemorial} from '../src/office/memorial.js';

const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export const previewPaths=file=>({
  image:file.replace(/\.json$/i,'')+'.preview.png',
  receipt:file.replace(/\.json$/i,'')+'.preview.json',
});
export const payloadDigest=input=>crypto.createHash('sha256').update(JSON.stringify(validateMemorial(input))).digest('hex');

export async function createMemorialPreview(input,file,{size=640}={}) {
  const entry=validateMemorial(input),{image,receipt}=previewPaths(file),digest=payloadDigest(entry);
  const body=entry.strokes.map(stroke=>{
    if(stroke.points.length===1){const [x,y]=stroke.points[0];return `<circle cx="${x*size}" cy="${y*size}" r="${stroke.width*size/2}" fill="${escape(stroke.color)}"/>`;}
    return `<polyline points="${stroke.points.map(([x,y])=>`${x*size},${y*size}`).join(' ')}" fill="none" stroke="${escape(stroke.color)}" stroke-width="${stroke.width*size}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }).join('');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="100%" height="100%" fill="#beb5a5"/>${body}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(image);
  const record={schemaVersion:1,token:crypto.randomUUID(),payloadDigest:digest,previewedAt:new Date().toISOString(),image:path.resolve(image),legibility:assessMemorialLegibility(entry),approved:false};
  await fs.writeFile(receipt,JSON.stringify(record,null,2)+'\n');return record;
}

export async function approveMemorialPreview(input,file) {
  const {receipt}=previewPaths(file),record=JSON.parse(await fs.readFile(receipt,'utf8'));
  if(record.payloadDigest!==payloadDigest(input))throw Error('Memorial changed after preview; generate and inspect a new preview');
  record.approved=true;record.approvedAt=new Date().toISOString();await fs.writeFile(receipt,JSON.stringify(record,null,2)+'\n');return record;
}

export async function requireApprovedPreview(input,file) {
  const {receipt,image}=previewPaths(file),record=JSON.parse(await fs.readFile(receipt,'utf8'));
  if(record.payloadDigest!==payloadDigest(input)||!record.approved)throw Error('Generate, inspect, and approve the current memorial preview before committing');
  await fs.access(image);return record;
}
