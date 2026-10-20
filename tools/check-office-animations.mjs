import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {OFFICE_CLIPS,OFFICE_ANIMATIONS,OFFICE_ANIMATION_VERSION} from '../src/agents/office-animations.js';
const root=new URL('../',import.meta.url),manifest=JSON.parse(readFileSync(new URL('OFFICE-ANIMATIONS.json',root),'utf8'));
for(const [file,expected]of Object.entries(manifest.sha256)){
 const actual=createHash('sha256').update(readFileSync(new URL(file,root))).digest('hex');
 if(actual!==expected)throw Error(`Office animation source differs: ${file}`);
}
if(manifest.version!==OFFICE_ANIMATION_VERSION||Object.keys(OFFICE_CLIPS).length!==13||OFFICE_ANIMATIONS.length!==11)throw Error('Animation catalogue differs');
console.log(JSON.stringify({ok:true,version:manifest.version,animations:OFFICE_ANIMATIONS.length,clips:Object.keys(OFFICE_CLIPS).length,verifiedFiles:Object.keys(manifest.sha256).length,picker:'/animations/'},null,2));
