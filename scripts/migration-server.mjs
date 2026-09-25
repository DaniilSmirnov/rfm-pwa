import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const [mainDirArg='migration-main-dist',branchDirArg='dist',portArg='4175']=process.argv.slice(2);
const mainDir=resolve(mainDirArg);
const branchDir=resolve(branchDirArg);
const port=Number(portArg)||4175;
let active='main';

const mime={
  '.html':'text/html; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.webmanifest':'application/manifest+json; charset=utf-8',
  '.svg':'image/svg+xml',
  '.png':'image/png',
  '.woff2':'font/woff2',
  '.ttf':'font/ttf',
  '.pbf':'application/x-protobuf'
};

async function fileResponse(root,pathname){
  const safe=pathname.replace(/^\/+/, '');
  let target=join(root,safe || 'index.html');
  try{
    const info=await stat(target);
    if(info.isDirectory()) target=join(target,'index.html');
    const data=await readFile(target);
    return {status:200,headers:{'content-type':mime[extname(target)]||'application/octet-stream','cache-control':'no-store'},body:data};
  }catch{
    if(!extname(pathname)){
      try{
        const data=await readFile(join(root,'index.html'));
        return {status:200,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'},body:data};
      }catch{}
    }
    return {status:404,headers:{'content-type':'text/plain; charset=utf-8'},body:Buffer.from('Not found')};
  }
}

const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/__migration/reset' && req.method==='POST'){
    active='main';
    res.writeHead(204,{'cache-control':'no-store'});
    res.end();
    return;
  }
  if(url.pathname==='/__migration/state' && req.method==='POST'){
    res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
    res.end(JSON.stringify({active}));
    return;
  }
  if(url.pathname==='/__migration/switch' && req.method==='POST'){
    active='branch';
    res.writeHead(204,{'cache-control':'no-store'});
    res.end();
    return;
  }
  const root=active==='main'?mainDir:branchDir;
  const result=await fileResponse(root,url.pathname);
  res.writeHead(result.status,result.headers);
  res.end(result.body);
});

server.listen(port,'127.0.0.1',()=>{
  console.log(`Migration server on http://127.0.0.1:${port}; serving main first`);
});
