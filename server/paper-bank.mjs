import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {newPaperBank,validatePaperBank,applyBankAction} from '../src/office/paper-bank.js';
const viewerRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const officeRoot=()=>process.env.BOT_CROSSING_OFFICE_ROOT??path.resolve(viewerRoot,'../crypto-research-lab/projects/crypto-swarm-2026-10-15/office');
export async function readPaperBank({root=officeRoot()}={}){
  try{const bytes=await fs.readFile(path.join(root,'paper-bank.json'),'utf8');if(bytes.length>500000)throw Error('Bank file too large');return validatePaperBank(JSON.parse(bytes));}
  catch(e){if(e.code==='ENOENT')return newPaperBank();throw e;}
}
export async function operatePaperBank(action,{root=officeRoot()}={}){
  await fs.mkdir(root,{recursive:true});const lockPath=path.join(root,'paper-bank.lock');
  let lock;try{lock=await fs.open(lockPath,'wx');}catch(e){if(e.code==='EEXIST')throw Error('Paper bank busy; retry after refreshing');throw e;}
  try{
    const current=await readPaperBank({root});
    if(action.baseRevision!==undefined&&action.baseRevision!==current.revision)throw Error('Paper bank changed; refresh before retrying');
    const next=applyBankAction(current,action),pending=path.join(root,'paper-bank.next.json');
    await fs.writeFile(pending,JSON.stringify(next,null,2)+'\n');await fs.rename(pending,path.join(root,'paper-bank.json'));return next;
  }finally{await lock.close();await fs.unlink(lockPath);}
}
