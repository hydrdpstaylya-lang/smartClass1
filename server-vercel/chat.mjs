// SmartClass گفتگو — HTTP layer for the school messenger (Vercel serverless).
// Transport: short polling on /api/chat/sync with a global revision cursor + batched writes on /api/chat/push.
// Media: private Supabase Storage bucket "sc-chat" with signed upload / download URLs.
import {ApiError,db,eq,requireUser,input,send,randomToken} from './db.mjs';
import * as M from '../server/chat-model.mjs';

const BUCKET='sc-chat';
const RECENT=80;              // messages delivered per chat on first load
const OVERLAP=8;              // revision overlap so rows committed out of order are never skipped
const MAX_FILE=50*1024*1024;

/* ---------- helpers ---------- */
const wrap=async fn=>{try{return await fn()}catch(e){if(e instanceof M.ChatError)throw new ApiError(e.status,e.message);throw e}};
const inList=ids=>'in.('+ids.map(v=>'"'+encodeURIComponent(String(v))+'"').join(',')+')';
const now=()=>Date.now();
const buckets=new Map();
function rate(key,max,ms=60000){const t=now(),b=buckets.get(key);const v=!b||b.until<t?{n:0,until:t+ms}:b;if(++v.n>max)throw new ApiError(429,'کمی آهسته‌تر؛ چند لحظه بعد دوباره امتحان کن.');if(buckets.size>5000)buckets.delete(buckets.keys().next().value);buckets.set(key,v)}
function storageBase(){let base=String(process.env.SUPABASE_URL||'').trim();while(base.endsWith('/'))base=base.slice(0,-1);return base}
async function storage(path,body){
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!key)throw new ApiError(503,'فضای ذخیره‌سازی متصل نیست.');
  const headers={apikey:key,'Content-Type':'application/json',...(key.startsWith('sb_secret_')?{}:{Authorization:'Bearer '+key})};
  let r;try{r=await fetch(storageBase()+'/storage/v1'+path,{method:'POST',headers,body:JSON.stringify(body||{}),signal:AbortSignal.timeout(12000)})}catch{throw new ApiError(503,'فضای ذخیره‌سازی پاسخ نداد.')}
  const j=await r.json().catch(()=>({}));if(!r.ok)throw new ApiError(503,'فضای ذخیره‌سازی خطا داد ('+r.status+'). database/chat.sql را اجرا کرده‌ای؟');return j;
}
const userPublic=(u,p)=>({id:M.cid(u.id),name:u.name,role:M.displayRole(u.role),admin:u.role==='admin',title:p?.title||'',av:p?.avatar_ver||0,seen:p?.last_seen||0});

async function users(ids){
  ids=[...new Set(ids.filter(Boolean))];if(!ids.length)return new Map();
  const [rows,profiles]=await Promise.all([db('sc_users','select=id,name,role,active&id='+inList(ids)),db('sc_chat_profiles','select=user_id,title,avatar_ver,last_seen,rev&user_id='+inList(ids))]);
  const pm=new Map(profiles.map(p=>[p.user_id,p]));return new Map(rows.map(u=>[u.id,{...u,profile:pm.get(u.id)}]));
}
// Everything needed to authorise and project messages in a set of chats.
async function chatContext(ids){
  if(!ids.length)return new Map();
  const [chats,members]=await Promise.all([db('sc_chats','select=*&id='+inList(ids)),db('sc_chat_members','select=*&chat_id='+inList(ids))]);
  const people=await users(members.map(m=>m.user_id));const out=new Map();
  for(const c of chats){const ms=members.filter(m=>m.chat_id===c.id);out.set(c.id,{chat:c,members:ms,memberIds:ms.map(m=>m.user_id),studentIds:ms.filter(m=>people.get(m.user_id)?.role==='student').map(m=>m.user_id),people})}
  return out;
}
const viewOf=(ctx,u)=>{const member=M.memberOf(ctx.members,u.id);return{member,teach:M.canTeach(ctx.chat,member,u)||(M.isEducator(u)&&ctx.chat.owner===u.id)}};
function projectRow(row,ctx,u){const {teach}=viewOf(ctx,u);return{chat:row.chat_id,...M.project(row,{viewer:u.id,chat:ctx.chat,teach,studentIds:ctx.studentIds})}}
function chatPublic(ctx,u){const c=ctx.chat,me=M.memberOf(ctx.members,u.id);
  return{id:c.id,type:c.type,name:c.name,sym:c.sym,g:c.color,owner:c.owner?M.cid(c.owner):null,pinnedMsg:c.pinned_msg,live:c.live,created:c.created,rev:c.rev,
    admin:M.isChatAdmin(c,me),members:ctx.members.map(m=>M.cid(m.user_id)),admins:ctx.members.filter(m=>m.role!=='member').map(m=>M.cid(m.user_id))}}
function memberPublic(m,u){const o={chat:m.chat_id,user:M.cid(m.user_id),read:m.last_read,typing:m.typing_until,role:m.role,rev:m.rev};if(m.user_id===u.id)Object.assign(o,{pinned:m.pinned,muted:m.muted,hidden:m.hidden_before});return o}

async function ensureSaved(u){
  const id=M.savedId(u.id),t=now();
  await db('sc_chats','on_conflict=id','POST',{id,type:'saved',name:'پیام‌های ذخیره‌شده',owner:u.id,created:t},'resolution=ignore-duplicates,return=minimal');
  await db('sc_chat_members','on_conflict=chat_id,user_id','POST',{chat_id:id,user_id:u.id,role:'owner',joined:t},'resolution=ignore-duplicates,return=minimal');
}
// Users visible to me in the "new chat" directory.
async function directory(u,myIds){
  let rows;
  if(M.isEducator(u))rows=await db('sc_users','select=id,name,role,active&active=is.true&order=name.asc&limit=600');
  else{
    const shared=myIds.length?await db('sc_chat_members','select=user_id&chat_id='+inList(myIds)+'&limit=3000'):[];
    const [edu,peers]=await Promise.all([db('sc_users','select=id,name,role,active&active=is.true&role=in.(teacher,admin)&limit=300'),users(shared.map(s=>s.user_id))]);
    rows=[...edu,...[...peers.values()].filter(p=>p.active)];
  }
  const ids=[...new Set(rows.map(r=>r.id))],full=await users(ids);
  return [...full.values()].filter(x=>x.active&&x.id!==u.id).map(x=>userPublic(x,x.profile));
}

/* ---------- GET /chat/sync ---------- */
async function sync(req,res,u){
  const q=new URL(req.url,'https://x').searchParams;
  const since=Math.max(0,Math.floor(Number(q.get('rev'))||0)),at=Math.max(0,Number(q.get('at'))||0);
  // full snapshot on first load (or when the client asks to resynchronise); otherwise incremental from the cursor
  const first=q.has('full')?q.get('full')==='1':since===0;
  if(first)await ensureSaved(u);
  if(q.get('beat')==='1'||first)await db('sc_chat_profiles','on_conflict=user_id','POST',{user_id:u.id,last_seen:now()},'resolution=merge-duplicates,return=minimal');
  const mine=await db('sc_chat_members','select=*&user_id='+eq(u.id));
  const ids=mine.map(m=>m.chat_id);
  const fresh=first?ids:mine.filter(m=>m.joined>=at-15000).map(m=>m.chat_id);
  const old=ids.filter(id=>!fresh.includes(id));
  let maxRev=since;const seen=r=>{if(r.rev>maxRev)maxRev=r.rev;return r};
  // incremental rows
  const [chg,memb,msgs]=old.length&&!first?await Promise.all([
    db('sc_chats','select=id,rev&id='+inList(old)+'&rev=gt.'+since),
    db('sc_chat_members','select=*&chat_id='+inList(old)+'&rev=gt.'+since+'&order=rev.asc&limit=1500'),
    db('sc_messages','select=*&chat_id='+inList(old)+'&rev=gt.'+since+'&order=rev.asc&limit=400'),
  ]):[[],[],[]];
  const touched=[...new Set([...fresh,...chg.map(c=>c.id),...msgs.map(m=>m.chat_id),...memb.map(m=>m.chat_id)])];
  const ctx=await chatContext(touched);
  const hidden=new Map(mine.map(m=>[m.chat_id,m.hidden_before||0]));
  const out={rev:0,at:now(),ids,chats:[],members:[],messages:[],fresh,users:[]};
  for(const id of touched){const c=ctx.get(id);if(!c)continue;seen(c.chat);out.chats.push(chatPublic(c,u))}
  for(const id of fresh){const c=ctx.get(id);if(!c)continue;c.members.forEach(m=>{seen(m);out.members.push(memberPublic(m,u))})}
  memb.forEach(m=>{seen(m);out.members.push(memberPublic(m,u))});
  // fresh chats: most recent messages
  const recent=await Promise.all(fresh.map(id=>db('sc_messages','select=*&chat_id='+eq(id)+'&created=gt.'+(hidden.get(id)||0)+'&order=created.desc&limit='+RECENT)));
  recent.flat().forEach(r=>{seen(r);const c=ctx.get(r.chat_id);if(c)out.messages.push(projectRow(r,c,u))});
  msgs.forEach(r=>{seen(r);if(r.created<=(hidden.get(r.chat_id)||0))return;const c=ctx.get(r.chat_id);if(c)out.messages.push(projectRow(r,c,u))});
  // people
  if(first){out.me=userPublic(u,(await users([u.id])).get(u.id)?.profile);out.directory=await directory(u,ids)}
  const people=new Map();for(const c of ctx.values())for(const [k,v] of c.people)people.set(k,v);
  const allMemberIds=first?[]:[...new Set((await db('sc_chat_members','select=user_id&chat_id='+inList(ids.length?ids:['-'])+'&limit=4000')).map(r=>r.user_id))];
  const changed=allMemberIds.length?await db('sc_chat_profiles','select=user_id&rev=gt.'+since+'&user_id='+inList(allMemberIds)):[];
  if(changed.length){const more=await users(changed.map(r=>r.user_id));for(const [k,v] of more)people.set(k,v)}
  out.users=[...people.values()].map(p=>{if(p.profile)seen(p.profile);return userPublic(p,p.profile)});
  out.rev=Math.max(0,maxRev);out.next=Math.max(0,maxRev-OVERLAP);
  return send(res,200,out);
}

/* ---------- POST /chat/push ---------- */
async function loadMessage(id){const r=await db('sc_messages','select=*&id='+eq(id)+'&limit=1');if(!r[0])throw new ApiError(404,'پیام پیدا نشد.');return r[0]}
async function needChat(id,u){const ctx=(await chatContext([String(id||'')])).get(String(id||''));if(!ctx)throw new ApiError(404,'گفتگو پیدا نشد.');const v=viewOf(ctx,u);if(!v.member)throw new ApiError(403,'عضو این گفتگو نیستید.');return{ctx,...v}}
async function authorizeKeys(keys,u,chatId){
  if(!keys.length)return;
  const paths=keys.map(M.keyPath),rows=await db('sc_chat_files','select=*&path='+inList(paths));
  const mine=new Set((await db('sc_chat_members','select=chat_id&user_id='+eq(u.id))).map(r=>r.chat_id));
  for(const p of paths){const f=rows.find(r=>r.path===p);if(!f)throw new ApiError(400,'فایل پیوست پیدا نشد.');
    const access=[f.chat_id,...(f.chat_ids||[])];if(!(f.owner===u.id||access.some(c=>mine.has(c))))throw new ApiError(403,'دسترسی به این فایل ندارید.');
    if(!access.includes(chatId))await db('sc_chat_files','path='+eq(p),'PATCH',{chat_ids:[...(f.chat_ids||[]),chatId].slice(-50)},'return=minimal')}
}
async function canReachAll(u,targets){
  const ppl=await users(targets);if(ppl.size!==new Set(targets).size)throw new ApiError(400,'یکی از اعضا پیدا نشد.');
  if(M.isEducator(u))return ppl;
  const mineIds=(await db('sc_chat_members','select=chat_id&user_id='+eq(u.id))).map(r=>r.chat_id);
  const shared=new Set(mineIds.length?(await db('sc_chat_members','select=user_id&chat_id='+inList(mineIds)+'&limit=4000')).map(r=>r.user_id):[]);
  for(const t of targets)if(!M.canReach(u,ppl.get(t),shared.has(t)))throw new ApiError(403,'برای شروع گفتگو با این شخص، باید در یک کلاس مشترک باشید.');
  return ppl;
}
const OPS={
  async 'chat.create'(op,u){
    const c=M.validateNewChat(op.chat,u),t=now();
    const exists=await db('sc_chats','select=id&id='+eq(c.id));
    if(exists[0]){const mem=await db('sc_chat_members','select=chat_id&chat_id='+eq(c.id)+'&user_id='+eq(u.id));if(!mem[0]){if(c.type!=='personal')throw new ApiError(409,'این شناسهٔ گفتگو قبلاً استفاده شده است.');await db('sc_chat_members','','POST',{chat_id:c.id,user_id:u.id,role:'member',joined:t},'return=minimal')}
      else await db('sc_chat_members','chat_id='+eq(c.id)+'&user_id='+eq(u.id),'PATCH',{hidden_before:0},'return=minimal');return{id:c.id}}
    await canReachAll(u,c.members);
    await db('sc_chats','','POST',{id:c.id,type:c.type,name:c.name,sym:c.sym,color:c.color,owner:u.id,created:t},'return=minimal');
    await db('sc_chat_members','','POST',[{chat_id:c.id,user_id:u.id,role:c.type==='personal'?'member':'owner',joined:t},...c.members.map(m=>({chat_id:c.id,user_id:m,role:'member',joined:t}))],'return=minimal');
    if(op.sys&&M.ID_RE.test(String(op.sys.id||'')))await db('sc_messages','on_conflict=id','POST',{id:op.sys.id,chat_id:c.id,sender:u.id,kind:'sys',body:{sys:M.str(op.sys.text,M.LIMITS.sysText)||'گفتگو ساخته شد'},created:t},'resolution=ignore-duplicates,return=minimal');
    return{id:c.id};
  },
  async 'chat.members'(op,u){
    const {ctx,member}=await needChat(op.chat,u);
    if(!(M.isChatAdmin(ctx.chat,member)||(ctx.chat.type==='group')||(M.isEducator(u)&&ctx.chat.type==='class')))throw new ApiError(403,'افزودن عضو برای شما مجاز نیست.');
    if(['personal','saved'].includes(ctx.chat.type))throw new ApiError(400,'به این گفتگو نمی‌توان عضو اضافه کرد.');
    const add=[...new Set((op.members||[]).map(M.uid).filter(Boolean))].filter(x=>!ctx.memberIds.includes(x));
    if(!add.length)return{added:0};if(add.length+ctx.memberIds.length>M.LIMITS.members)throw new ApiError(413,'تعداد اعضا بیش از حد است.');
    await canReachAll(u,add);const t=now();
    await db('sc_chat_members','on_conflict=chat_id,user_id','POST',add.map(m=>({chat_id:ctx.chat.id,user_id:m,role:'member',joined:t})),'resolution=ignore-duplicates,return=minimal');
    if(op.sys&&M.ID_RE.test(String(op.sys.id||'')))await db('sc_messages','on_conflict=id','POST',{id:op.sys.id,chat_id:ctx.chat.id,sender:u.id,kind:'sys',body:{sys:M.str(op.sys.text,M.LIMITS.sysText)}, created:t},'resolution=ignore-duplicates,return=minimal');
    return{added:add.length};
  },
  async 'chat.update'(op,u){
    const {ctx,member,teach}=await needChat(op.chat,u),patch={},admin=M.isChatAdmin(ctx.chat,member);
    if(op.name!==undefined||op.sym!==undefined||op.g!==undefined){if(!admin||['personal','saved'].includes(ctx.chat.type))throw new ApiError(403,'فقط مدیر گفتگو مشخصات را تغییر می‌دهد.');if(op.name!==undefined)patch.name=M.str(op.name,M.LIMITS.name,{required:true});if(op.sym!==undefined)patch.sym=M.str(op.sym,16);if(op.g!==undefined)patch.color=Math.max(0,Math.min(15,Math.round(Number(op.g)||0)))}
    if(op.pinnedMsg!==undefined){if(!(admin||teach||['personal','saved'].includes(ctx.chat.type)))throw new ApiError(403,'سنجاق کردن برای شما مجاز نیست.');patch.pinned_msg=op.pinnedMsg&&M.ID_RE.test(String(op.pinnedMsg))?String(op.pinnedMsg):null}
    if(op.live!==undefined){if(!teach)throw new ApiError(403,'فقط آموزگار کلاس آنلاین را شروع می‌کند.');patch.live=!!op.live}
    if(Object.keys(patch).length)await db('sc_chats','id='+eq(ctx.chat.id),'PATCH',patch,'return=minimal');return{};
  },
  async 'chat.pref'(op,u){
    const patch={};for(const k of ['pinned','muted'])if(op[k]!==undefined)patch[k]=!!op[k];
    if(op.read!==undefined)patch.last_read=Math.min(now(),Math.max(0,Math.round(Number(op.read)||0)));
    if(op.hide)patch.hidden_before=now();
    if(op.typing)patch.typing_until=now()+6000;
    if(op.typing===false)patch.typing_until=0;
    if(!Object.keys(patch).length)return{};
    const r=await db('sc_chat_members','chat_id='+eq(String(op.chat||''))+'&user_id='+eq(u.id),'PATCH',patch);if(!r.length)throw new ApiError(404,'گفتگو پیدا نشد.');return{};
  },
  async 'chat.leave'(op,u){
    const {ctx}=await needChat(op.chat,u);
    if(['personal','saved'].includes(ctx.chat.type)){await db('sc_chat_members','chat_id='+eq(ctx.chat.id)+'&user_id='+eq(u.id),'PATCH',{hidden_before:now()},'return=minimal');return{hidden:true}}
    await db('sc_chat_members','chat_id='+eq(ctx.chat.id)+'&user_id='+eq(u.id),'DELETE',undefined,'return=minimal');
    if(ctx.chat.owner===u.id&&ctx.members.length<=1)await db('sc_chats','id='+eq(ctx.chat.id),'DELETE',undefined,'return=minimal');
    return{left:true};
  },
  async 'msg.send'(op,u){
    const {ctx,member}=await needChat(op.chat,u);
    const m=M.validateMessage(op.msg,{chat:ctx.chat,member,user:u,memberIds:ctx.memberIds});
    const dup=await db('sc_messages','select=*&id='+eq(m.id));
    if(dup[0]){if(dup[0].sender!==u.id)throw new ApiError(409,'شناسهٔ پیام تکراری است.');return{msg:projectRow(dup[0],ctx,u)}}
    await authorizeKeys(M.fileKeys(m.body),u,ctx.chat.id);
    const row=(await db('sc_messages','','POST',{id:m.id,chat_id:ctx.chat.id,sender:u.id,kind:m.kind,body:m.body,created:now()}))[0];
    await db('sc_chat_members','chat_id='+eq(ctx.chat.id)+'&user_id='+eq(u.id),'PATCH',{last_read:row.created,typing_until:0},'return=minimal');
    return{msg:projectRow(row,ctx,u)};
  },
  async 'msg.op'(op,u){
    // optimistic concurrency: many students voting / submitting at once → retry on revision conflict
    let row=await loadMessage(String(op.id||''));const {ctx,member}=await needChat(row.chat_id,u);
    if(op.op==='submit'&&op.file?.key)await authorizeKeys([String(op.file.key)],u,ctx.chat.id);
    for(let attempt=0;attempt<4;attempt++){
      const r=M.applyOp(op,{msg:row,chat:ctx.chat,member,user:u,memberIds:ctx.memberIds,studentIds:ctx.studentIds});
      const patch={body:r.body};if(r.edited)patch.edited=r.edited;if(r.deleted)patch.deleted=true;
      const upd=await db('sc_messages','id='+eq(row.id)+'&rev='+eq(row.rev),'PATCH',patch);
      if(upd[0]){
        if(r.deleted&&ctx.chat.pinned_msg===row.id)await db('sc_chats','id='+eq(ctx.chat.id),'PATCH',{pinned_msg:null},'return=minimal');
        return{msg:projectRow(upd[0],ctx,u)};
      }
      await new Promise(ok=>setTimeout(ok,40+Math.random()*120));row=await loadMessage(row.id);
    }
    throw new ApiError(409,'پیام هم‌زمان تغییر کرد؛ دوباره امتحان کن.');
  },
  async 'profile'(op,u){
    const p={user_id:u.id,last_seen:now()};
    if(op.title!==undefined)p.title=M.str(op.title,M.LIMITS.title);
    if(op.avatar!==undefined){p.avatar=M.avatarData(op.avatar);const cur=await db('sc_chat_profiles','select=avatar_ver&user_id='+eq(u.id));p.avatar_ver=(cur[0]?.avatar_ver||0)+1}
    await db('sc_chat_profiles','on_conflict=user_id','POST',p,'resolution=merge-duplicates,return=minimal');
    if(op.name!==undefined){const n=M.str(op.name,30,{required:true});await db('sc_users','id='+eq(u.id),'PATCH',{name:n},'return=minimal')}
    return{av:p.avatar_ver};
  },
};
async function push(req,res,u){
  const b=await input(req,600000),ops=M.batch(b?.ops);rate('push:'+u.id,240);
  const results=[];
  for(const op of ops){
    const fn=OPS[op.type];
    if(!fn){results.push({ok:false,status:400,error:'نوع عملیات ناشناخته است.'});continue}
    try{results.push({ok:true,...await wrap(()=>fn(op,u))})}
    catch(e){results.push({ok:false,status:e.status||500,error:e instanceof ApiError||e instanceof M.ChatError?e.message:'خطای سرور'})}
  }
  return send(res,200,{results,at:now()});
}

/* ---------- media ---------- */
async function upload(req,res,u){
  rate('up:'+u.id,40);const b=await input(req,4000);
  const {ctx,member}=await needChat(b?.chat,u);
  const isSub=ctx.chat.type!=='channel'||M.isChatAdmin(ctx.chat,member);if(!isSub)throw new ApiError(403,'ارسال فایل در این گفتگو برای شما مجاز نیست.');
  const size=Number(b.size)||0;if(size<=0||size>MAX_FILE)throw new ApiError(413,'حداکثر اندازهٔ فایل ۵۰ مگابایت است.');
  const path=ctx.chat.id+'/'+randomToken(18);
  await db('sc_chat_files','','POST',{path,chat_id:ctx.chat.id,chat_ids:[ctx.chat.id],owner:u.id,name:M.str(b.name,M.LIMITS.fileName),mime:M.str(b.mime,100),size,created:now()},'return=minimal');
  const s=await storage('/object/upload/sign/'+BUCKET+'/'+path,{});
  const rel=s.url||(s.token?'/object/upload/sign/'+BUCKET+'/'+path+'?token='+s.token:'');if(!rel)throw new ApiError(503,'نشانی بارگذاری ساخته نشد.');
  return send(res,200,{key:'srv:'+path,url:storageBase()+'/storage/v1'+rel});
}
async function file(req,res,u){
  const key=new URL(req.url,'https://x').searchParams.get('key')||'';if(!M.KEY_RE.test(key))throw new ApiError(400,'کلید فایل معتبر نیست.');
  const path=M.keyPath(key),f=(await db('sc_chat_files','select=*&path='+eq(path)))[0];if(!f)throw new ApiError(404,'فایل پیدا نشد.');
  const mine=new Set((await db('sc_chat_members','select=chat_id&user_id='+eq(u.id))).map(r=>r.chat_id));
  if(!(f.owner===u.id||[f.chat_id,...(f.chat_ids||[])].some(c=>mine.has(c))))throw new ApiError(403,'دسترسی به این فایل ندارید.');
  const s=await storage('/object/sign/'+BUCKET+'/'+path,{expiresIn:3600});
  const rel=s.signedURL||s.signedUrl;if(!rel)throw new ApiError(503,'نشانی دانلود ساخته نشد.');
  return send(res,200,{url:storageBase()+'/storage/v1'+rel,name:f.name,mime:f.mime,size:f.size,ttl:3600});
}
async function avatar(req,res,u){
  const id=Number(new URL(req.url,'https://x').searchParams.get('u'));if(!Number.isInteger(id)||id<=0)throw new ApiError(400,'شناسه نادرست است.');
  const p=(await db('sc_chat_profiles','select=avatar&user_id='+eq(id)))[0];
  const m=/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(p?.avatar||'');if(!m)throw new ApiError(404,'تصویری ثبت نشده است.');
  const buf=Buffer.from(m[2],'base64');res.statusCode=200;res.setHeader('Content-Type',m[1]);res.setHeader('Cache-Control','private, max-age=604800, immutable');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Length',buf.length);res.end(buf);
}


/* ---------- secure live class rooms (Daily private rooms + short-lived tokens) ---------- */
async function dailyRequest(path,method='POST',body){
  const key=String(process.env.DAILY_API_KEY||'').trim();
  if(!key)throw new ApiError(503,'تماس زنده هنوز پیکربندی نشده است. مدیر مدرسه باید DAILY_API_KEY را در تنظیمات محرمانهٔ Vercel قرار دهد.');
  let response;
  try{
    response=await fetch('https://api.daily.co/v1'+path,{
      method,
      headers:{Authorization:'Bearer '+key,Accept:'application/json','Content-Type':'application/json'},
      ...(body!==undefined?{body:JSON.stringify(body)}:{}),
      signal:AbortSignal.timeout(15000)
    });
  }catch{throw new ApiError(503,'سرویس تماس آنلاین پاسخ نداد. چند لحظه بعد دوباره امتحان کن.')}
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    const detail=String(data.info||data.error||data.message||'').slice(0,180);
    throw new ApiError(502,'سرویس تماس آنلاین درخواست را نپذیرفت ('+response.status+'). '+detail);
  }
  return data;
}
async function createDailyToken(call,u,isOwner){
  const exp=Math.floor(call.expires_at/1000);
  const result=await dailyRequest('/meeting-tokens','POST',{properties:{
    room_name:call.room_name,
    user_id:String(u.id),
    user_name:String(u.name||'عضو کلاس').slice(0,80),
    is_owner:!!isOwner,
    exp,
    eject_at_token_exp:true,
    start_audio_off:true,
    start_video_off:true,
    enable_recording:false,
    ...(isOwner?{}:{permissions:{hasPresence:true,canSend:['video'],canReceive:{},canAdmin:false}})
  }});
  if(!result.token)throw new ApiError(502,'سرویس تماس، کد ورود معتبر برنگرداند.');
  return{url:call.room_url,token:result.token,expires_at:call.expires_at,is_owner:!!isOwner};
}
async function liveCall(req,res,u){
  rate('call:'+u.id,30);
  const b=await input(req,5000);
  const action=String(b?.action||'').trim();
  if(!['start','join','end'].includes(action))throw new ApiError(400,'درخواست تماس معتبر نیست.');
  const chatId=String(b?.chat||'').trim();
  if(!M.ID_RE.test(chatId))throw new ApiError(400,'شناسهٔ کلاس معتبر نیست.');
  const {ctx,teach}=await needChat(chatId,u);
  if(ctx.chat.type!=='class')throw new ApiError(400,'تماس زنده فقط داخل کلاس مدرسه فعال است.');
  const educator=M.isEducator(u)&&teach;
  if((action==='start'||action==='end')&&!educator)throw new ApiError(403,'فقط آموزگار یا مدیر همان کلاس می‌تواند جلسه را شروع یا پایان دهد.');
  const rows=await db('sc_chat_calls','select=*&chat_id='+eq(chatId)+'&limit=1');
  let call=rows[0]||null;
  const stamp=now();
  if(action==='end'){
    if(!call||call.ended_at||call.expires_at<=stamp)throw new ApiError(404,'جلسهٔ فعالی برای پایان دادن وجود ندارد.');
    await db('sc_chat_calls','chat_id='+eq(chatId),'PATCH',{ended_at:stamp},'return=minimal');
    await db('sc_chats','id='+eq(chatId),'PATCH',{live:false},'return=minimal');
    try{await dailyRequest('/rooms/'+encodeURIComponent(call.room_name),'DELETE')}catch{}
    return send(res,200,{ok:true,ended:true});
  }
  if(action==='start'){
    if(call&&!call.ended_at&&call.expires_at>stamp+30000){
      const access=await createDailyToken(call,u,true);
      return send(res,200,{ok:true,...access,reused:true});
    }
    if(call&&!call.ended_at)await db('sc_chat_calls','chat_id='+eq(chatId),'PATCH',{ended_at:stamp},'return=minimal');
    const expires=stamp+90*60*1000;
    const roomName='sc-'+randomToken(22);
    const room=await dailyRequest('/rooms','POST',{name:roomName,privacy:'private',properties:{
      exp:Math.floor(expires/1000),
      max_participants:40,
      enable_prejoin_ui:true,
      enable_chat:true,
      enable_screenshare:true,
      enable_recording:false
    }});
    if(!room.url||!room.name)throw new ApiError(502,'سرویس تماس، اتاق خصوصی معتبری نساخت.');
    const next={chat_id:chatId,room_name:room.name,room_url:room.url,started_by:u.id,started_at:stamp,expires_at:expires,ended_at:null};
    try{
      await db('sc_chat_calls','on_conflict=chat_id','POST',next,'resolution=merge-duplicates,return=minimal');
      await db('sc_chats','id='+eq(chatId),'PATCH',{live:true},'return=minimal');
      call=next;
      const access=await createDailyToken(call,u,true);
      return send(res,200,{ok:true,...access,reused:false});
    }catch(error){
      try{await dailyRequest('/rooms/'+encodeURIComponent(room.name),'DELETE')}catch{}
      throw error;
    }
  }
  // Students and teachers may join only while an authenticated member's class has an active private room.
  if(!call||call.ended_at||call.expires_at<=stamp)throw new ApiError(404,'کلاس هنوز جلسهٔ زنده ندارد؛ منتظر بمان تا آموزگار آن را شروع کند.');
  const access=await createDailyToken(call,u,educator);
  return send(res,200,{ok:true,...access,reused:true});
}


/* ---------- SmartClass Voice Studio: classroom events, permissions, consent and breakouts ---------- */
async function dailyPresence(roomName){
  const data=await dailyRequest('/rooms/'+encodeURIComponent(roomName)+'/presence','GET');
  const list=Array.isArray(data.data)?data.data:Array.isArray(data.participants)?data.participants:[];
  return list.filter(p=>p&&p.session_id&&p.user_id!==undefined);
}
async function dailyPermissions(roomName,updates){
  if(!Object.keys(updates).length)return;
  return dailyRequest('/rooms/'+encodeURIComponent(roomName)+'/update-permissions','POST',{data:updates});
}
async function broadcastVoice(roomName,event){
  try{await dailyRequest('/rooms/'+encodeURIComponent(roomName)+'/send-app-message','POST',{data:{type:'smartclass-voice-event',event},recipient:'*'});}catch{}
}
async function voiceEvent(call,u,type,payload){
  const row=(await db('sc_voice_events','','POST',{
    chat_id:call.chat_id,room_name:call.room_name,actor:u.id,event_type:type,
    payload:payload||{},created:now()
  }))[0];
  if(row)await broadcastVoice(call.room_name,{id:row.id,type:row.event_type,payload:row.payload,actor:M.cid(u.id),created:row.created});
  return row;
}
async function voiceContext(chatId,u){
  const {ctx,member,teach}=await needChat(chatId,u);
  if(ctx.chat.type!=='class')throw new ApiError(400,'استودیوی صوتی فقط در کلاس مدرسه فعال است.');
  const call=(await db('sc_chat_calls','select=*&chat_id='+eq(chatId)+'&limit=1'))[0];
  if(!call||call.ended_at||call.expires_at<=now())throw new ApiError(404,'کلاس آنلاین فعالی وجود ندارد.');
  return{ctx,member,teach,call};
}
function voiceCleanText(value,max=800){
  return String(value??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').trim().slice(0,max);
}
async function voice(req,res,u){
  if(req.method==='GET'){
    const q=new URL(req.url,'https://x').searchParams;
    const chatId=String(q.get('chat')||'');
    const since=Math.max(0,Number(q.get('since'))||0);
    const {ctx,teach,call}=await voiceContext(chatId,u);
    const [events,consents,presence]=await Promise.all([
      db('sc_voice_events','select=id,event_type,payload,actor,created&chat_id='+eq(chatId)+'&room_name='+eq(call.room_name)+'&id=gt.'+since+'&order=id.asc&limit=250'),
      db('sc_voice_consents','select=user_id,allowed,updated&chat_id='+eq(chatId)+'&room_name='+eq(call.room_name)),
      dailyPresence(call.room_name)
    ]);
    const members=new Map(ctx.members.map(m=>[String(m.user_id),ctx.people.get(m.user_id)]));
    const self=consents.find(x=>String(x.user_id)===String(u.id));
    const publicParticipants=presence.map(p=>{
      const account=members.get(String(p.user_id));
      return{
        id:M.cid(Number(p.user_id)||p.user_id),
        name:voiceCleanText(p.user_name||account?.name||'عضو کلاس',80),
        role:account?.role||'student',
        owner:!!p.owner,
        network:voiceCleanText(p.networkQualityState||'unknown',20),
        ...(teach?{sessionId:p.session_id}:{}),
        ...(teach?{canSend:p.permissions?.canSend??[]}:{})
      };
    });
    const breakoutRows=await db('sc_voice_breakouts','select=id,label,members,expires_at&chat_id='+eq(chatId)+'&parent_room_name='+eq(call.room_name)+'&ended_at=is.null&expires_at=gt.'+now()+'&order=created.asc');
    const ownBreakout=breakoutRows.find(x=>(x.members||[]).some(id=>String(id)===String(u.id)));
    return send(res,200,{
      ok:true,active:true,room:call.room_name,live:ctx.chat.live,
      events:events.map(e=>({id:e.id,type:e.event_type,payload:e.payload,actor:M.cid(e.actor),created:e.created})),
      next:events.length?events[events.length-1].id:since,
      consents:teach?consents.map(c=>({user:M.cid(c.user_id),allowed:c.allowed,updated:c.updated})):[],
      selfConsent:!!self?.allowed,
      me:M.cid(u.id),
      participants:publicParticipants,
      breakouts:teach?breakoutRows.map(x=>({id:x.id,label:x.label,members:(x.members||[]).map(M.cid)})):ownBreakout?[{id:ownBreakout.id,label:ownBreakout.label,members:[]}]:[]
    });
  }
  if(req.method!=='POST')throw new ApiError(405,'روش درخواست پشتیبانی نمی‌شود.');
  rate('voice:'+u.id,180);
  const b=await input(req,12000);
  const action=voiceCleanText(b?.action,40);
  const chatId=voiceCleanText(b?.chat,48);
  const {ctx,member,teach,call}=await voiceContext(chatId,u);
  const educator=M.isEducator(u)&&teach;
  const nowAt=now();
  if(action==='consent'){
    await db('sc_voice_consents','on_conflict=chat_id,room_name,user_id','POST',{
      chat_id:chatId,room_name:call.room_name,user_id:u.id,
      allowed:!!b.allowed,updated:nowAt
    },'resolution=merge-duplicates,return=minimal');
    return send(res,200,{ok:true,allowed:!!b.allowed});
  }
  if(action==='transcription-start'){
    if(!educator)throw new ApiError(403,'فقط آموزگار می‌تواند متن‌برداری زنده را شروع کند.');
    const present=await dailyPresence(call.room_name);
    const consents=await db('sc_voice_consents','select=user_id,allowed&chat_id='+eq(chatId)+'&room_name='+eq(call.room_name));
    const allowed=new Set(consents.filter(x=>x.allowed).map(x=>String(x.user_id)));
    const missing=present.filter(p=>!allowed.has(String(p.user_id)));
    if(missing.length)throw new ApiError(409,'تا وقتی همهٔ افراد حاضر رضایت نداده‌اند، متن‌برداری آغاز نمی‌شود. افراد بدون رضایت: '+missing.map(p=>voiceCleanText(p.user_name||'عضو کلاس',60)).join('، '));
    if(!present.length)throw new ApiError(409,'هنوز کسی به کلاس وصل نیست.');
    await voiceEvent(call,u,'transcription_start',{participants:present.length,storage:'SmartClass text only; no audio recording'});
    return send(res,200,{ok:true,participants:present.map(p=>p.session_id)});
  }
  if(action==='transcription-stop'){
    if(!educator)throw new ApiError(403,'فقط آموزگار می‌تواند متن‌برداری زنده را متوقف کند.');
    const row=await voiceEvent(call,u,'transcription_stop',{stopped:true});
    return send(res,200,{ok:true,eventId:row?.id});
  }
  if(action==='transcript-line'){
    if(!educator)throw new ApiError(403,'فقط آموزگار می‌تواند متن جلسه را ثبت کند.');
    const text=voiceCleanText(b.text,1800);
    if(!text)return send(res,200,{ok:true,ignored:true});
    const present=await dailyPresence(call.room_name);
    const consents=await db('sc_voice_consents','select=user_id,allowed&chat_id='+eq(chatId)+'&room_name='+eq(call.room_name));
    const allowed=new Set(consents.filter(x=>x.allowed).map(x=>String(x.user_id)));
    if(present.some(p=>!allowed.has(String(p.user_id))))throw new ApiError(409,'رضایت یکی از افراد حاضر برداشته شده است؛ متن‌برداری متوقف شد.');
    const row=await voiceEvent(call,u,'transcript_line',{
      text,speaker:voiceCleanText(b.speaker||u.name,80),timestamp:Number(b.timestamp)||nowAt
    });
    return send(res,200,{ok:true,id:row?.id});
  }
  if(action==='turn'){
    if(!educator)throw new ApiError(403,'مدیریت نوبت صحبت فقط برای آموزگار است.');
    const target=M.uid(b.user);
    if(!target||!ctx.memberIds.includes(target))throw new ApiError(404,'دانش‌آموز عضو این کلاس نیست.');
    const present=await dailyPresence(call.room_name);
    const participant=present.find(p=>String(p.user_id)===String(target));
    if(!participant)throw new ApiError(404,'این دانش‌آموز اکنون در اتاق زنده حضور ندارد.');
    const grant=b.grant!==false;
    await dailyPermissions(call.room_name,{[participant.session_id]:{canSend:grant?['audio','video']:['video']}});
    const targetUser=ctx.people.get(target);
    const row=await voiceEvent(call,u,grant?'turn_granted':'turn_revoked',{
      user:M.cid(target),name:targetUser?.name||participant.user_name||'دانش‌آموز',grant
    });
    return send(res,200,{ok:true,eventId:row?.id,grant});
  }
  if(action==='mute-all'){
    if(!educator)throw new ApiError(403,'بی‌صدا کردن کلاس فقط برای آموزگار است.');
    const present=await dailyPresence(call.room_name),updates={};
    present.filter(p=>!p.owner&&String(p.user_id)!==String(u.id)).forEach(p=>{updates[p.session_id]={canSend:['video']};});
    await dailyPermissions(call.room_name,updates);
    const row=await voiceEvent(call,u,'mute_all',{count:Object.keys(updates).length});
    return send(res,200,{ok:true,count:Object.keys(updates).length,eventId:row?.id});
  }
  if(action==='breakouts-create'){
    if(!educator)throw new ApiError(403,'ساخت اتاق گروهی فقط برای آموزگار است.');
    const count=Math.max(2,Math.min(8,Math.floor(Number(b.count)||2)));
    const students=ctx.studentIds.slice();
    if(students.length<2)throw new ApiError(400,'برای ساخت اتاق گروهی دست‌کم دو دانش‌آموز لازم است.');
    const size=Math.ceil(students.length/count),groups=[];
    for(let i=0;i<count;i++){
      const chunk=students.slice(i*size,(i+1)*size);
      if(chunk.length)groups.push({label:'گروه '+(i+1),members:chunk});
    }
    const old=await db('sc_voice_breakouts','select=id,room_name&chat_id='+eq(chatId)+'&parent_room_name='+eq(call.room_name)+'&ended_at=is.null');
    for(const x of old){try{await dailyRequest('/rooms/'+encodeURIComponent(x.room_name),'DELETE')}catch{}}
    if(old.length)await db('sc_voice_breakouts','chat_id='+eq(chatId)+'&parent_room_name='+eq(call.room_name)+'&ended_at=is.null','PATCH',{ended_at:nowAt},'return=minimal');
    const created=[];
    try{
      for(const group of groups){
        const roomName='sc-group-'+randomToken(18);
        const room=await dailyRequest('/rooms','POST',{name:roomName,privacy:'private',properties:{
          exp:Math.floor(call.expires_at/1000),max_participants:16,
          enable_prejoin_ui:true,enable_chat:true,enable_screenshare:true,enable_recording:false
        }});
        if(!room.url||!room.name)throw new ApiError(502,'سرویس تماس نتوانست یکی از اتاق‌های گروهی را بسازد.');
        const row=(await db('sc_voice_breakouts','','POST',{
          chat_id:chatId,parent_room_name:call.room_name,room_name:room.name,
          room_url:room.url,label:group.label,members:group.members,
          created:nowAt,expires_at:call.expires_at
        }))[0];
        created.push({id:row.id,label:row.label,members:group.members.map(M.cid)});
      }
    }catch(error){
      for(const x of created){
        const existing=(await db('sc_voice_breakouts','select=room_name&id='+eq(x.id)))[0];
        if(existing)try{await dailyRequest('/rooms/'+encodeURIComponent(existing.room_name),'DELETE')}catch{}
      }
      throw error;
    }
    const row=await voiceEvent(call,u,'group_plan',{groups:created});
    return send(res,200,{ok:true,groups:created,eventId:row?.id});
  }
  if(action==='breakout-join'){
    const id=voiceCleanText(b.id,60);
    const group=(await db('sc_voice_breakouts','select=*&id='+eq(id)+'&chat_id='+eq(chatId)+'&parent_room_name='+eq(call.room_name)+'&ended_at=is.null&expires_at=gt.'+nowAt))[0];
    if(!group)throw new ApiError(404,'اتاق گروهی فعالی وجود ندارد.');
    if(!educator&&!(group.members||[]).some(x=>String(x)===String(u.id)))throw new ApiError(403,'این اتاق برای گروه دیگری است.');
    const access=await createDailyToken({room_name:group.room_name,room_url:group.room_url,expires_at:group.expires_at},u,educator);
    return send(res,200,{ok:true,...access,label:group.label,room:group.room_name});
  }
  if(action==='breakouts-end'){
    if(!educator)throw new ApiError(403,'پایان دادن اتاق‌های گروهی فقط برای آموزگار است.');
    const groups=await db('sc_voice_breakouts','select=id,room_name&chat_id='+eq(chatId)+'&parent_room_name='+eq(call.room_name)+'&ended_at=is.null');
    for(const group of groups){try{await dailyRequest('/rooms/'+encodeURIComponent(group.room_name),'DELETE')}catch{}}
    if(groups.length)await db('sc_voice_breakouts','chat_id='+eq(chatId)+'&parent_room_name='+eq(call.room_name)+'&ended_at=is.null','PATCH',{ended_at:nowAt},'return=minimal');
    await voiceEvent(call,u,'group_plan',{ended:true,count:groups.length});
    return send(res,200,{ok:true,ended:groups.length});
  }
  const teacherOnly=new Set(['board_stroke','board_note','board_clear','quiz_start','quiz_end','quiz_grade','command_executed','summary_saved']);
  if(teacherOnly.has(action)&&!educator)throw new ApiError(403,'این ابزار فقط برای آموزگار فعال است.');
  const supported=new Set(['hand_raise','hand_lower','board_stroke','board_note','board_clear','quiz_start','quiz_end','quiz_answer','quiz_grade','command_executed','summary_saved']);
  if(!supported.has(action))throw new ApiError(400,'فرمان استودیوی صوتی شناخته نشد.');
  let payload={};
  if(action==='hand_raise'||action==='hand_lower')payload={user:M.cid(u.id),name:voiceCleanText(u.name,80)};
  else if(action==='board_stroke'){
    payload={stroke:b.stroke};
    if(!Array.isArray(payload.stroke)||payload.stroke.length>180)throw new ApiError(400,'مسیر تخته معتبر نیست.');
  }else if(action==='board_note')payload={text:voiceCleanText(b.text,400),x:Math.max(0,Math.min(1,Number(b.x)||0)),y:Math.max(0,Math.min(1,Number(b.y)||0))};
  else if(action==='quiz_start')payload={question:voiceCleanText(b.question,500),options:Array.isArray(b.options)?b.options.slice(0,5).map(x=>voiceCleanText(x,100)):[],quizId:randomToken(10)};
  else if(action==='quiz_end')payload={quizId:voiceCleanText(b.quizId,40)};
  else if(action==='quiz_answer')payload={quizId:voiceCleanText(b.quizId,40),answer:voiceCleanText(b.answer,500),student:M.cid(u.id),name:voiceCleanText(u.name,80)};
  else if(action==='quiz_grade'){
    const target=M.uid(b.user),score=Number(b.score);
    if(!target||!ctx.memberIds.includes(target)||!Number.isFinite(score)||score<0||score>20)throw new ApiError(400,'نمره یا دانش‌آموز معتبر نیست.');
    payload={quizId:voiceCleanText(b.quizId,40),user:M.cid(target),score,feedback:voiceCleanText(b.feedback,300)};
  }else if(action==='command_executed')payload={command:voiceCleanText(b.command,160)};
  else if(action==='summary_saved')payload={summary:voiceCleanText(b.summary,5000)};
  const json=JSON.stringify(payload);
  if(json.length>3800)throw new ApiError(413,'محتوای ارسالی برای استودیوی صوتی بیش از حد است.');
  const row=await voiceEvent(call,u,action,payload);
  return send(res,200,{ok:true,id:row?.id,event:{id:row?.id,type:action,payload,actor:M.cid(u.id),created:row?.created||nowAt}});
}

/* ---------- router ---------- */
export async function chat(req,res,path){
  const u=await requireUser(req);
  if(path==='/chat/sync'&&req.method==='GET'){rate('sync:'+u.id,90);return await wrap(()=>sync(req,res,u))}
  if(path==='/chat/push'&&req.method==='POST')return await push(req,res,u);
  if(path==='/chat/upload'&&req.method==='POST')return await wrap(()=>upload(req,res,u));
  if(path==='/chat/file'&&req.method==='GET')return await wrap(()=>file(req,res,u));
  if(path==='/chat/avatar'&&req.method==='GET')return await wrap(()=>avatar(req,res,u));
  if(path==='/chat/call'&&req.method==='POST')return await wrap(()=>liveCall(req,res,u));
  if(path==='/chat/voice'&&(req.method==='GET'||req.method==='POST'))return await wrap(()=>voice(req,res,u));
  if(path==='/chat/directory'&&req.method==='GET'){const ids=(await db('sc_chat_members','select=chat_id&user_id='+eq(u.id))).map(r=>r.chat_id);return send(res,200,{directory:await directory(u,ids)})}
  throw new ApiError(404,'مسیر پیام‌رسان وجود ندارد.');
}
