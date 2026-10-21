import fs from 'node:fs/promises';
import {appendMemorial} from '../server/memorial.mjs';
const [file]=process.argv.slice(2);
if(!file)throw Error('Usage: node tools/memorial.mjs <completed-session.json> (optional BOT_CROSSING_OFFICE_ROOT)');
const saved=await appendMemorial(JSON.parse(await fs.readFile(file,'utf8')));
console.log(JSON.stringify({saved:true,iteration:saved.iteration,agent:saved.agent,symbol:saved.symbol},null,2));
