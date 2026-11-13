// In-memory stand-in for the parts of Supabase (PostgREST + Storage) used by server-vercel/*.mjs.
// It understands exactly the query shapes the server sends: select / eq / in / gt / is, order, limit,
// on_conflict upserts with Prefer resolution, PATCH / DELETE with filters, and the chat revision trigger.
// Installing it replaces globalThis.fetch for https://mock.supabase.co only; everything else passes through.
import {createHash,randomBytes} from 'node:crypto';

export const MOCK_URL='https://mock.supabase.co';
const REV_TABLES=new Set(['sc_chat_profiles','sc_chats','sc_chat_members','sc_messages']);
const KEYS={sc_users:['id'],sc_sessions:['token_hash'],sc_chat_profiles:['user_id'],sc_chats:['id'],sc_chat_members:['chat_id','user_id'],sc_messages:['id'],sc_chat_files:['path']};
const DEFAULTS={
  sc_chat_profiles:{title:'',avatar:null,avatar_ver:0,last_seen:0},
  sc_chats:{name:'',sym:'',color:0,owner:null,pinned_msg:null,live:false},
  sc_chat_members:{role:'member',last_read:0,typing_until:0,pinned:false,muted:false,hidden_before:0},
  sc_messages:{kind:'text',edited:null,deleted:false},
  sc_chat_files:{chat_ids:[],name:'',mime:'',size:0},
};
const CASCADE={sc_chats:[['sc_chat_members','chat_id'],['sc_messages','chat_id'],['sc_chat_files','chat_id']]};

export function createMock(){
  const tables=new Map(),objects=new Map(),tokens=new Map();let rev=0,serial=0;
  const T=name=>tables.get(name)||tables.set(name,[]).get(name);
  const keyOf=(name,row)=>(KEYS[name]||['id']).map(k=>String(row[k])).join('|');
  const parseVal=v=>{v=decodeURIComponent(v);if(v==='true')return true;if(v==='false')return false;if(v==='null')return null;return v};
  const same=(a,b)=>String(a)===String(b);
  function filters(params){
    const out=[];
    for(const [k,v] of params){
      if(['select','order','limit','on_conflict','offset'].includes(k))continue;
      const i=v.indexOf('.'),op=v.slice(0,i),arg=v.slice(i+1);
      if(op==='eq')out.push(r=>same(r[k],parseVal(arg)));
      else if(op==='gt')out.push(r=>Number(r[k])>Number(parseVal(arg)));
      else if(op==='gte')out.push(r=>Number(r[k])>=Number(parseVal(arg)));
      else if(op==='lt')out.push(r=>Number(r[k])<Number(parseVal(arg)));
      else if(op==='is')out.push(r=>parseVal(arg)===null?r[k]==null:r[k]===parseVal(arg));
      else if(op==='in'){const list=arg.replace(/^\(|\)$/g,'').split(',').map(s=>decodeURIComponent(s).replace(/^"|"$/g,''));out.push(r=>list.some(x=>same(r[k],x)))}
      else throw new Error('mock: unsupported filter '+k+'='+v);
    }
    return r=>out.every(f=>f(r));
  }
  const project=(row,select)=>{if(!select||select==='*')return structuredClone(row);const o={};for(const c of select.split(','))o[c]=structuredClone(row[c]===undefined?null:row[c]);return o};
  function bump(name,row){if(REV_TABLES.has(name))row.rev=++rev}
  function insert(name,body,prefer,conflict){
    const rows=Array.isArray(body)?body:[body],out=[];
    for(const input of rows){
      const row={...(DEFAULTS[name]||{}),...structuredClone(input)};
      if(name==='sc_users'&&row.id==null)row.id=++serial;
      const t=T(name),k=keyOf(name,row),ex=t.find(r=>keyOf(name,r)===k);
      if(ex){
        if(prefer.includes('ignore-duplicates'))continue;
        if(prefer.includes('merge-duplicates')||conflict){Object.assign(ex,structuredClone(input));bump(name,ex);out.push(ex);continue}
        const e=new Error('duplicate');e.code='23505';throw e;
      }
      bump(name,row);t.push(row);out.push(row);
    }
    return out;
  }
  async function rest(url,init){
    const name=url.pathname.replace('/rest/v1/',''),params=[...url.searchParams.entries()],sp=url.searchParams;
    const method=init.method||'GET',prefer=String(init.headers?.Prefer||'');
    const body=init.body?JSON.parse(init.body):undefined;
    const match=filters(params);
    if(method==='GET'){
      let rows=T(name).filter(match);
      const order=sp.get('order');if(order){const [col,dir]=order.split('.');rows=[...rows].sort((a,b)=>(a[col]>b[col]?1:a[col]<b[col]?-1:0)*(dir==='desc'?-1:1))}
      const lim=Number(sp.get('limit'));if(lim)rows=rows.slice(0,lim);
      return json(200,rows.map(r=>project(r,sp.get('select'))));
    }
    if(method==='POST'){try{return json(201,insert(name,body,prefer,sp.get('on_conflict')&&prefer.includes('merge')))}catch(e){return json(409,{code:e.code||'X'})}}
    if(method==='PATCH'){const rows=T(name).filter(match);for(const r of rows){Object.assign(r,structuredClone(body));bump(name,r)}return json(200,rows.map(r=>project(r)))}
    if(method==='DELETE'){
      const t=T(name),gone=t.filter(match);tables.set(name,t.filter(r=>!gone.includes(r)));
      for(const [child,col] of CASCADE[name]||[])for(const g of gone)tables.set(child,T(child).filter(r=>!same(r[col],g.id)));
      return json(200,gone);
    }
    return json(405,{});
  }
  async function storage(url,init){
    const p=url.pathname.replace('/storage/v1','');
    let m;
    if((m=/^\/object\/upload\/sign\/([^/]+)\/(.+)$/.exec(p))&&init.method==='POST'){const token=randomBytes(8).toString('hex');tokens.set(token,m[1]+'/'+m[2]);return json(200,{url:'/object/upload/sign/'+m[1]+'/'+m[2]+'?token='+token})}
    if((m=/^\/object\/upload\/sign\/([^/]+)\/(.+)$/.exec(p))&&init.method==='PUT'){const t=url.searchParams.get('token');if(tokens.get(t)!==m[1]+'/'+m[2])return json(403,{});
      let blob=init.body;if(blob instanceof FormData){blob=[...blob.values()].find(v=>typeof v!=='string')}
      const buf=Buffer.from(await new Response(blob).arrayBuffer());objects.set(m[1]+'/'+m[2],{buf,type:blob?.type||'application/octet-stream'});return json(200,{Key:m[1]+'/'+m[2]})}
    if((m=/^\/object\/sign\/([^/]+)\/(.+)$/.exec(p))&&init.method==='POST'){const token=randomBytes(8).toString('hex');tokens.set(token,m[1]+'/'+m[2]);return json(200,{signedURL:'/object/sign/'+m[1]+'/'+m[2]+'?token='+token})}
    if((m=/^\/object\/sign\/([^/]+)\/(.+)$/.exec(p))){const o=objects.get(m[1]+'/'+m[2]);if(!o||tokens.get(url.searchParams.get('token'))!==m[1]+'/'+m[2])return json(404,{});return new Response(o.buf,{status:200,headers:{'content-type':o.type}})}
    return json(404,{});
  }
  const json=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
  async function handle(input,init={}){
    const url=new URL(typeof input==='string'?input:input.url);
    if(url.pathname.startsWith('/rest/v1/'))return rest(url,init);
    if(url.pathname.startsWith('/storage/v1/'))return storage(url,init);
    return json(404,{});
  }
  // seed helpers
  function user(name,role,username=name.toLowerCase().replace(/\W+/g,'')||'user'+(serial+1)){const [u]=insert('sc_users',{name,role,username,active:true},'',false);return u}
  function session(userId){const raw=randomBytes(18).toString('base64url');insert('sc_sessions',{token_hash:createHash('sha256').update(raw).digest('hex'),user_id:userId,expires:Date.now()+864e5},'',false);return raw}
  const seed=(name,rows)=>insert(name,rows,'',false);
  return {handle,tables,objects,T,user,session,seed,get rev(){return rev}};
}

export function installMock(mock){
  const real=globalThis.fetch;
  process.env.SUPABASE_URL=MOCK_URL;process.env.SUPABASE_SERVICE_ROLE_KEY='sb_secret_mock_key_for_tests';
  globalThis.fetch=(input,init)=>{const u=typeof input==='string'?input:input.url;return u.startsWith(MOCK_URL)?mock.handle(input,init):real(input,init)};
  return ()=>{globalThis.fetch=real};
}
