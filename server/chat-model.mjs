// SmartClass گفتگو — pure domain model (no I/O).
// Everything that decides "who may do what" and "what a message may contain" lives here,
// so it can be unit-tested without a database (see tests/chat-model.test.mjs).

export class ChatError extends Error{constructor(status,message){super(message);this.status=status}}
const fail=(status,message)=>{throw new ChatError(status,message)};

export const CHAT_TYPES=['personal','group','class','channel','saved'];
export const REACTIONS=['❤️','👍','🔥','👏','😂','🤩','😮','🙏','🎉','🌱','📖','💯'];
export const ID_RE=/^[A-Za-z0-9_-]{3,48}$/;
export const KEY_RE=/^srv:[A-Za-z0-9_-]{3,48}\/[A-Za-z0-9_-]{8,64}$/;
export const LIMITS={text:4000,name:60,title:60,members:300,opts:6,bars:64,sysText:160,note:600,fileName:120};

const isObj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function str(v,max,{required=false,trim=true}={}){
  if(v===undefined||v===null){if(required)fail(400,'یک فیلد ضروری خالی است.');return ''}
  if(typeof v!=='string')fail(400,'نوع داده معتبر نیست.');
  // Remove control characters except newline / tab, keep Persian ZWNJ (U+200C).
  let s=v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,'');
  if(trim)s=s.trim();
  if(required&&!s)fail(400,'یک فیلد ضروری خالی است.');
  if(s.length>max)fail(413,'متن بیش از حد طولانی است.');
  return s;
}
const num=(v,min,max,def)=>{const n=Number(v);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):def};
export const isEducator=u=>!!u&&(u.role==='teacher'||u.role==='admin');
export const cid=uid=>'u'+uid;
export function uid(clientId){const m=/^u(\d{1,15})$/.exec(String(clientId||''));return m?Number(m[1]):null}
export const personalId=(a,b)=>'pm-'+Math.min(a,b)+'-'+Math.max(a,b);
export const savedId=a=>'sv-'+a;

/* ---------- membership & permissions ---------- */
export function memberOf(members,userId){return members.find(m=>m.user_id===userId)||null}
export function isChatAdmin(chat,member){return !!member&&(member.role==='owner'||member.role==='admin')}
export function canSee(chat,member){return !!member}
export function canPost(chat,member,user){
  if(!member)return false;
  if(chat.type==='channel')return isChatAdmin(chat,member);
  if(chat.type==='saved')return member.user_id===user.id;
  return true;
}
export function canTeach(chat,member,user){
  // assignments, quizzes, attendance, live class: an educator who runs this chat
  return isEducator(user)&&!!member&&(chat.type==='class'||chat.type==='group'||chat.type==='channel')&&(isChatAdmin(chat,member)||chat.type!=='channel');
}
export function canModerate(chat,member,user){return isChatAdmin(chat,member)||(isEducator(user)&&!!member&&chat.type!=='saved')}
export function canCreate(type,user){
  if(!CHAT_TYPES.includes(type)||type==='saved')return false;
  if(type==='class'||type==='channel')return isEducator(user);
  return true;
}
// Who a user may start a conversation with / add to a chat.
export function canReach(user,target,sharedChat){
  if(!target||!target.active)return false;
  if(target.id===user.id)return false;
  if(isEducator(user)||isEducator(target))return true;
  return !!sharedChat; // students reach other students only when they already share a chat
}

/* ---------- chat create validation ---------- */
export function validateNewChat(input,user){
  if(!isObj(input))fail(400,'درخواست ساخت گفتگو معتبر نیست.');
  const type=String(input.type||'');
  if(!canCreate(type,user))fail(403,'ساختن این نوع گفتگو برای نقش شما مجاز نیست.');
  const members=[...new Set((Array.isArray(input.members)?input.members:[]).map(uid).filter(Boolean))].filter(x=>x!==user.id);
  if(members.length>LIMITS.members)fail(413,'تعداد اعضا بیش از حد است.');
  let id=String(input.id||'');
  if(type==='personal'){
    if(members.length!==1)fail(400,'گفتگوی خصوصی باید دقیقاً یک طرف داشته باشد.');
    id=personalId(user.id,members[0]);
  }else if(!ID_RE.test(id)||/^(pm|sv)-/.test(id))fail(400,'شناسهٔ گفتگو معتبر نیست.');
  return{
    id,type,members,
    name:type==='personal'?'':str(input.name,LIMITS.name,{required:true}),
    sym:str(input.sym,16),
    color:Math.round(num(input.g,0,15,0)),
  };
}

/* ---------- message validation (client wire format -> stored body) ---------- */
function fileRef(v,{needKey=false}={}){
  if(!isObj(v))fail(400,'پیوست معتبر نیست.');
  const key=v.key===undefined||v.key===null?'':String(v.key);
  if(key&&!KEY_RE.test(key))fail(400,'کلید فایل معتبر نیست.');
  if(needKey&&!key)fail(400,'فایل بارگذاری نشده است.');
  return{key,name:str(v.name,LIMITS.fileName),mime:str(v.mime,100),size:str(String(v.size??''),40)};
}
export function kindOf(m){
  if(m.sys)return 'sys';if(m.assign)return 'assign';if(m.quiz)return 'quiz';if(m.att)return 'att';if(m.grade)return 'grade';
  if(m.voice)return 'voice';if(m.file)return 'file';if(m.imgKey||m.img)return 'image';if(m.stk)return 'sticker';return 'text';
}
export function validateMessage(input,{chat,member,user,memberIds}){
  if(!isObj(input))fail(400,'پیام معتبر نیست.');
  const id=String(input.id||'');if(!ID_RE.test(id))fail(400,'شناسهٔ پیام معتبر نیست.');
  if(!canPost(chat,member,user))fail(403,'ارسال پیام در این گفتگو برای شما مجاز نیست.');
  const kind=kindOf(input);
  const teach=canTeach(chat,member,user);
  if(['assign','quiz','att'].includes(kind)&&!teach)fail(403,'فقط آموزگار این کلاس می‌تواند این مورد را بفرستد.');
  if(kind==='grade'&&!(isEducator(user)&&chat.type==='personal'))fail(403,'کارنامه فقط از طرف آموزگار در گفتگوی خصوصی فرستاده می‌شود.');
  const body={};
  if(input.t!==undefined&&input.t!=='')body.t=str(input.t,LIMITS.text);
  if(input.reply!==undefined&&input.reply!==null){const r=String(input.reply);if(ID_RE.test(r))body.reply=r}
  if(input.fwd)body.fwd=str(input.fwd,LIMITS.name);
  switch(kind){
    case 'sys':body.sys=str(input.sys,LIMITS.sysText,{required:true});break;
    case 'sticker':body.stk=str(input.stk,24,{required:true});break;
    case 'image':{
      if(input.imgKey){const k=String(input.imgKey);if(!KEY_RE.test(k))fail(400,'کلید عکس معتبر نیست.');body.imgKey=k}
      else{const u=String(input.img||'');if(!/^\/images\/[A-Za-z0-9_.-]{1,80}$/.test(u)&&!/^https:\/\/smart-class1\.vercel\.app\/images\/[A-Za-z0-9_.-]{1,80}$/.test(u))fail(400,'نشانی عکس مجاز نیست.');body.img=u}
      break}
    case 'file':body.file=fileRef(input.file,{needKey:true});break;
    case 'voice':{const v=input.voice;if(!isObj(v))fail(400,'پیام صوتی معتبر نیست.');const f=fileRef(v,{needKey:true});
      body.voice={key:f.key,dur:Math.round(num(v.dur,1,600,1)),bars:(Array.isArray(v.bars)?v.bars:[]).slice(0,LIMITS.bars).map(b=>Math.round(num(b,2,40,4)))};break}
    case 'assign':{const a=input.assign;if(!isObj(a))fail(400,'تکلیف معتبر نیست.');const now=Date.now();
      body.assign={title:str(a.title,LIMITS.title,{required:true}),subject:str(a.subject,30),desc:str(a.desc,1200),created:now,due:Math.round(num(a.due,now+60000,now+180*864e5,now+864e5)),subs:[],files:{},grades:{}};break}
    case 'quiz':{const q=input.quiz;if(!isObj(q)||!Array.isArray(q.opts))fail(400,'آزمونک معتبر نیست.');
      const opts=q.opts.slice(0,LIMITS.opts).map(o=>str(o,120,{required:true}));if(opts.length<2)fail(400,'آزمونک دست‌کم دو گزینه لازم دارد.');
      body.quiz={q:str(q.q,300,{required:true}),opts,correct:Math.round(num(q.correct,0,opts.length-1,0)),voted:{}};break}
    case 'att':{const a=input.att;if(!isObj(a)||!isObj(a.list))fail(400,'حضور و غیاب معتبر نیست.');const list={};
      for(const [k,v] of Object.entries(a.list)){const u=uid(k);if(u&&memberIds.includes(u))list[u]=!!v}
      body.att={list,done:false};break}
    case 'grade':{const g=input.grade;if(!isObj(g))fail(400,'کارنامه معتبر نیست.');
      body.grade={subject:str(g.subject,80),score:num(g.score,0,100,0),max:Math.round(num(g.max,1,100,20)),note:str(g.note,LIMITS.note)};break}
    default:if(!body.t)fail(400,'پیام خالی است.');
  }
  return{id,kind,body};
}
export function fileKeys(body){
  const out=[];if(body.imgKey)out.push(body.imgKey);if(body.file?.key)out.push(body.file.key);if(body.voice?.key)out.push(body.voice.key);
  if(body.assign?.files)for(const f of Object.values(body.assign.files))if(f?.key)out.push(f.key);
  return out;
}
export const keyPath=key=>String(key).slice(4);

/* ---------- operations on an existing message ---------- */
// Returns {body, edited?, deleted?} — a new body, never mutates the input.
export function applyOp(op,{msg,chat,member,user,memberIds,studentIds}){
  const body=structuredClone(msg.body||{});
  const mine=msg.sender===user.id;
  if(msg.deleted)fail(410,'این پیام حذف شده است.');
  switch(op.op){
    case 'edit':{
      if(!mine)fail(403,'فقط فرستنده می‌تواند پیام را ویرایش کند.');
      if(!['text','image','file'].includes(msg.kind))fail(400,'این پیام قابل ویرایش نیست.');
      if(Date.now()-msg.created>48*3600e3)fail(403,'مهلت ویرایش این پیام تمام شده است.');
      body.t=str(op.t,LIMITS.text);if(!body.t&&msg.kind==='text')fail(400,'پیام خالی است.');
      return{body,edited:Date.now()}}
    case 'delete':
      if(!mine&&!canModerate(chat,member,user))fail(403,'حذف این پیام برای شما مجاز نیست.');
      return{body:{},deleted:true};
    case 'react':{
      if(!member)fail(403,'عضو این گفتگو نیستید.');
      const want=new Set((Array.isArray(op.emos)?op.emos:[]).map(String).filter(e=>REACTIONS.includes(e)).slice(0,3));
      const r=isObj(body.reacts)?body.reacts:{};
      for(const e of Object.keys(r)){r[e]=(r[e]||[]).filter(x=>x!==user.id);if(!r[e].length)delete r[e]}
      for(const e of want){(r[e]||=[]).push(user.id)}
      body.reacts=r;return{body}}
    case 'vote':{
      const q=body.quiz;if(!q)fail(400,'این پیام آزمونک نیست.');
      if(isEducator(user)||mine)fail(403,'آموزگار در آزمونک رأی نمی‌دهد.');
      if(!studentIds.includes(user.id))fail(403,'فقط دانش‌آموزان این کلاس پاسخ می‌دهند.');
      if(q.voted[user.id]!==undefined)fail(409,'پاسخ شما قبلاً ثبت شده است.');
      const i=Math.round(Number(op.i));if(!(i>=0&&i<q.opts.length))fail(400,'گزینه معتبر نیست.');
      q.voted[user.id]=i;return{body}}
    case 'submit':{
      const a=body.assign;if(!a)fail(400,'این پیام تکلیف نیست.');
      if(!studentIds.includes(user.id))fail(403,'فقط دانش‌آموزان این کلاس تکلیف تحویل می‌دهند.');
      const f=isObj(op.file)?op.file:{};
      const rec={note:str(f.note,LIMITS.note),ts:Date.now()};
      if(f.key){const r=fileRef(f,{needKey:true});Object.assign(rec,{key:r.key,name:r.name,mime:r.mime,size:r.size})}
      if(!a.subs.includes(user.id))a.subs.push(user.id);
      a.files[user.id]=rec;return{body}}
    case 'grade':{
      const a=body.assign;if(!a)fail(400,'این پیام تکلیف نیست.');
      if(!canTeach(chat,member,user))fail(403,'فقط آموزگار نمره می‌دهد.');
      const s=uid(op.user);if(!s||!studentIds.includes(s))fail(400,'دانش‌آموز در این کلاس نیست.');
      a.grades[s]=Math.round(num(op.grade,0,20,0)*4)/4;return{body}}
    case 'att':{
      const a=body.att;if(!a)fail(400,'این پیام حضور و غیاب نیست.');
      if(!mine||!isEducator(user))fail(403,'فقط آموزگار فرستنده حضور و غیاب را ثبت می‌کند.');
      if(a.done)fail(409,'حضور و غیاب قبلاً بسته شده است.');
      if(isObj(op.list))for(const [k,v] of Object.entries(op.list)){const u=uid(k);if(u&&memberIds.includes(u))a.list[u]=!!v}
      if(op.done)a.done=true;return{body}}
    default:fail(400,'عملیات ناشناخته است.');
  }
}

/* ---------- projection: stored row -> what a viewer is allowed to see ---------- */
export function project(msg,{viewer,chat,teach,studentIds}){
  if(msg.deleted)return{id:msg.id,deleted:true,ts:msg.created,rev:msg.rev};
  const b=msg.body||{};
  const out={id:msg.id,ts:msg.created,rev:msg.rev};
  if(b.sys){out.sys=b.sys;return out}
  out.by=chat.type==='saved'?'@me':(msg.sender?cid(msg.sender):'@gone');
  for(const k of ['t','reply','fwd','imgKey','img','stk'])if(b[k]!==undefined)out[k]=b[k];
  if(b.file)out.file={...b.file,ok:true};
  if(b.voice)out.voice={...b.voice};
  if(b.grade)out.grade={...b.grade};
  if(msg.edited)out.edited=true;
  if(isObj(b.reacts)){const react={},my=[];for(const [e,list] of Object.entries(b.reacts)){if(!list?.length)continue;react[e]=list.length;if(list.includes(viewer))my.push(e)}
    if(Object.keys(react).length)out.react=react;if(my.length)out.my=my}
  if(b.quiz){const q=b.quiz,votes=q.opts.map(()=>0),voted={};for(const [u,i] of Object.entries(q.voted||{})){if(votes[i]!==undefined)votes[i]++;voted[cid(u)]=i}
    out.quiz={q:q.q,opts:q.opts,correct:q.correct,votes,voted}}
  if(b.assign){const a=b.assign,see=u=>teach||Number(u)===viewer,pick=o=>Object.fromEntries(Object.entries(o||{}).filter(([u])=>see(u)).map(([u,v])=>[cid(u),v]));
    out.assign={title:a.title,subject:a.subject,desc:a.desc,created:a.created,due:a.due,subs:(a.subs||[]).map(cid),total:Math.max(1,studentIds.length),files:pick(a.files),grades:pick(a.grades)}}
  if(b.att){out.att={list:Object.fromEntries(Object.entries(b.att.list||{}).map(([u,v])=>[cid(u),!!v])),done:!!b.att.done}}
  return out;
}

/* ---------- small helpers used by the HTTP layer ---------- */
export function displayRole(role){return role==='admin'?'teacher':role==='teacher'?'teacher':'student'}
export function avatarData(v){
  if(v===null||v==='')return null;
  if(typeof v!=='string'||v.length>140000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v))fail(400,'تصویر نمایه معتبر نیست (حداکثر حدود ۱۰۰ کیلوبایت).');
  return v;
}
export function batch(ops,max=40){
  if(!Array.isArray(ops)||!ops.length)fail(400,'فهرست عملیات خالی است.');
  if(ops.length>max)fail(413,'تعداد عملیات در یک درخواست زیاد است.');
  return ops.filter(isObj);
}
