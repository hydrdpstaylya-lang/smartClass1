#!/usr/bin/env node
// Local playground for the school messenger — no Supabase, no Vercel needed.
//   node scripts/dev-messenger.mjs [port]
// Serves public/ (so /messenger/ works), runs the real API handler against the in-memory
// Supabase mock, seeds a small school and prints one sign-in link per account.
// DEV ONLY: it relaxes the same-origin HTTPS check because localhost is plain HTTP.
import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {extname,join,normalize} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createMock,installMock,MOCK_URL} from '../tests/helpers/mock-supabase.mjs';

const root=fileURLToPath(new URL('../public/',import.meta.url));
const port=Number(process.argv[2]||process.env.PORT||5180);
const mock=createMock();installMock(mock);
const {default:handler}=await import('../server-vercel/handler.mjs');

// --- seed a tiny school -------------------------------------------------------------
const people=[mock.user('خانم صادقی','teacher','sadeghi'),mock.user('آقای رحیمی','teacher','rahimi'),mock.user('ایلیا حیدری','student','ilya'),mock.user('نورا کریمی','student','noura'),mock.user('امیر احمدی','student','amir'),mock.user('مدیر مدرسه','admin','admin')];
const sessions=new Map(people.map(u=>[u.id,mock.session(u.id)]));
const t=Date.now();
mock.seed('sc_chats',{id:'class-3a',type:'class',name:'کلاس سوم الف',sym:'۳',color:0,owner:people[0].id,created:t});
mock.seed('sc_chat_members',[people[0],people[2],people[3],people[4]].map((u,i)=>({chat_id:'class-3a',user_id:u.id,role:i?'member':'owner',joined:t})));
mock.seed('sc_messages',[{id:'welcome1',chat_id:'class-3a',sender:people[0].id,kind:'sys',body:{sys:'کلاس سوم الف ساخته شد'},created:t-5000},
  {id:'welcome2',chat_id:'class-3a',sender:people[0].id,kind:'text',body:{t:'سلام بچه‌ها 🌱 به گفتگوی کلاس خوش آمدید.'},created:t-4000}]);

const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.json':'application/json','.webmanifest':'application/manifest+json'};
async function file(res,path){
  let p=normalize(join(root,decodeURIComponent(path)));if(!p.startsWith(root))return false;
  try{if((await stat(p)).isDirectory())p=join(p,'index.html');const buf=await readFile(p);res.writeHead(200,{'Content-Type':TYPES[extname(p)]||'application/octet-stream','Cache-Control':'no-store'});res.end(buf);return true}catch{return false}
}
const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://localhost');
  // sign-in links: /dev/login?u=<id>
  if(u.pathname==='/dev/login'){const raw=sessions.get(Number(u.searchParams.get('u')));if(!raw){res.writeHead(404);return res.end('no such user')}
    res.writeHead(302,{'Set-Cookie':`sc_session=${raw}; HttpOnly; SameSite=Lax; Path=/`,Location:'/messenger/'});return res.end()}
  if(u.pathname==='/dev/logout'){res.writeHead(302,{'Set-Cookie':'sc_session=; Path=/; Max-Age=0',Location:'/messenger/'});return res.end()}
  // the browser talks to "Supabase Storage" through this prefix
  if(u.pathname.startsWith('/__supabase/')){
    const chunks=[];for await(const c of req)chunks.push(c);
    const target=MOCK_URL+u.pathname.replace('/__supabase','')+u.search;
    let body;if(chunks.length){const ct=req.headers['content-type']||'';body=ct.includes('multipart')?await new Response(Buffer.concat(chunks),{headers:{'content-type':ct}}).formData():Buffer.concat(chunks)}
    const r=await mock.handle(target,{method:req.method,body});res.writeHead(r.status,{'Content-Type':r.headers.get('content-type')||'application/octet-stream','Access-Control-Allow-Origin':'*'});return res.end(Buffer.from(await r.arrayBuffer()))}
  if(u.pathname.startsWith('/api/')){
    req.url='/api/index?route='+encodeURIComponent(u.pathname.slice(5))+(u.search?'&'+u.search.slice(1):'');
    delete req.headers.origin;                   // dev only: localhost is not https
    const end=res.end.bind(res);
    res.end=chunk=>end(typeof chunk==='string'?chunk.replaceAll(MOCK_URL,'http://localhost:'+port+'/__supabase'):chunk);
    return handler(req,res);
  }
  if(await file(res,u.pathname))return;
  res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('not found');
});
server.listen(port,()=>{
  console.log(`SmartClass messenger dev server → http://localhost:${port}/messenger/`);
  for(const u of people)console.log(`  ${u.role.padEnd(7)} ${u.name.padEnd(14)} http://localhost:${port}/dev/login?u=${u.id}`);
});
