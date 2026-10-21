import fs from 'node:fs/promises';
import {appendMemorial} from '../server/memorial.mjs';
import {approveMemorialPreview,createMemorialPreview,requireApprovedPreview} from '../server/memorial-preview.mjs';
const args=process.argv.slice(2),mode=args[0]?.startsWith('--')?args.shift():'--preview',file=args[0];
if(!file)throw Error('Usage: node tools/memorial.mjs [--preview|--approve-preview|--commit] <completed-session.json>');
const input=JSON.parse(await fs.readFile(file,'utf8'));
if(mode==='--preview'){
  const preview=await createMemorialPreview(input,file);
  console.log(JSON.stringify({previewed:true,image:preview.image,legibility:preview.legibility,next:`Inspect the PNG, then run: node tools/memorial.mjs --approve-preview ${file}`},null,2));
}else if(mode==='--approve-preview'){
  const preview=await approveMemorialPreview(input,file);
  console.log(JSON.stringify({approved:true,image:preview.image,next:`node tools/memorial.mjs --commit ${file}`},null,2));
}else if(mode==='--commit'){
  const preview=await requireApprovedPreview(input,file),saved=await appendMemorial(input);
  console.log(JSON.stringify({saved:true,iteration:saved.iteration,agent:saved.agent,symbol:saved.symbol,preview:preview.image},null,2));
}else throw Error('Unknown memorial action');
