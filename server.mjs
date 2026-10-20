import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {activity} from './server/activity.mjs';
const root=fileURLToPath(new URL('.',import.meta.url)),port=Number(process.env.PORT||8770);
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.glb':'model/gltf-binary'};
http.createServer(async(req,res)=>{
 try{
  const base=`http://${req.headers.host}`;
  if(!['127.0.0.1','localhost','[::1]'].includes(new URL(base).hostname)){res.writeHead(403);return res.end();}
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end();}
  const url=new URL(req.url,base);
  if(url.pathname==='/api/activity'){
   if((req.headers.origin&&req.headers.origin!==base)||req.headers['sec-fetch-site']==='cross-site'){res.writeHead(403);return res.end();}
   const data=await activity();res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(req.method==='HEAD'?'':JSON.stringify(data));
  }
  const rel=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index.html';
  if(!/^(?:index\.html|animation-preview\.html|(?:style|preview)\.css|(?:src|vendor|assets)\/[^\\]+)$/.test(rel))throw Error();
  const file=path.resolve(root,rel),relative=path.relative(root,file);
  if(relative.startsWith('..')||path.isAbsolute(relative)||relative.replaceAll('\\','/')!==rel)throw Error();
  const data=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?'':data);
 }catch{res.writeHead(503,{'Cache-Control':'no-store'});res.end('Unavailable');}
}).listen(port,'127.0.0.1',()=>console.log(`Office demo: http://127.0.0.1:${port}`));
