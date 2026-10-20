import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('./',import.meta.url),manifest=JSON.parse(readFileSync(new URL('BACKUP.json',root),'utf8'));
for(const [file,expected]of Object.entries(manifest.sha256)){
 if(file.startsWith('/')||file.split('/').includes('..'))throw Error('Invalid manifest path');
 const hash=createHash('sha256').update(readFileSync(new URL(file,root))).digest('hex');
 if(hash!==expected)throw Error(`Backup file differs: ${file}`);
}
console.log(JSON.stringify({ok:true,files:Object.keys(manifest.sha256).length,branch:'office-demo',scene:'eight anonymous colleagues'},null,2));
