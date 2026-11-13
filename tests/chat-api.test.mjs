// End-to-end checks of /api/chat/* against the in-memory Supabase mock.
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createMock,installMock} from './helpers/mock-supabase.mjs';

const mock=createMock();const restore=installMock(mock);
const {default:handler}=await import('../server-vercel/handler.mjs');
const T=mock.user('خانم صادقی','teacher','sadeghi'),S=mock.user('ایلیا','student','ilya'),S2=mock.user('نورا','student','noura'),X=mock.user('غریبه','student','stranger');
const cookie=Object.fromEntries([T,S,S2,X].map(u=>[u.id,'sc_session='+mock.session(u.id)]));
let server,base;
before(async()=>{
  server=http.createServer((req,res)=>{const u=new URL(req.url,'http://x');req.url='/api/index?route='+encodeURIComponent(u.pathname.slice(5))+(u.search?'&'+u.search.slice(1):'');handler(req,res)});
  await new Promise(r=>server.listen(0,r));base='http://127.0.0.1:'+server.address().port;
});
after(()=>{server.close();restore()});
async function call(user,path,body){
  const r=await fetch(base+'/api/chat'+path,{method:body?'POST':'GET',headers:{cookie:user?cookie[user.id]:'',...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  return {status:r.status,data:await r.json()};
}
const push=(u,...ops)=>call(u,'/push',{ops});

test('requires a session', async()=>{
  const r=await call(null,'/sync?rev=0');assert.equal(r.status,401);
});

test('rejects cross-site and plain-http origins', async()=>{
  const r=await fetch(base+'/api/chat/sync?rev=0',{headers:{cookie:cookie[T.id],origin:'https://evil.example'}});
  assert.equal(r.status,403);
});

let rev=0;
test('teacher creates a class, students see it and exchange messages', async()=>{
  const c=await push(T,{type:'chat.create',chat:{type:'class',id:'math-7',name:'ریاضی هفتم',members:['u'+S.id,'u'+S2.id]},sys:{id:'sys-math7',text:'کلاس ساخته شد'}});
  assert.equal(c.status,200);assert.equal(c.data.results[0].ok,true,JSON.stringify(c.data));
  const s1=await call(S,'/sync?rev=0');
  assert.ok(s1.data.chats.some(x=>x.id==='math-7'),'student is a member');
  assert.ok(s1.data.chats.some(x=>x.type==='saved'),'saved messages chat is provisioned');
  rev=s1.data.rev;const at=s1.data.at+20000;
  const m=await push(S,{type:'msg.send',chat:'math-7',msg:{id:'msg-hello1',t:'سلام خانم'}});
  assert.equal(m.data.results[0].ok,true,JSON.stringify(m.data));
  const t1=await call(T,'/sync?rev=0');
  const got=t1.data.messages.find(x=>x.id==='msg-hello1');
  assert.equal(got.t,'سلام خانم');assert.equal(got.by,'u'+S.id);
  const inc=await call(S,'/sync?rev='+rev+'&at='+at);
  assert.deepEqual(inc.data.messages.map(x=>x.id),['msg-hello1'],'incremental sync returns only new rows');
});

test('outsiders cannot read or write a class', async()=>{
  const r=await call(X,'/sync?rev=0');
  assert.ok(!r.data.chats.some(x=>x.id==='math-7'));
  const w=await push(X,{type:'msg.send',chat:'math-7',msg:{id:'msg-intrude',t:'hi'}});
  assert.equal(w.data.results[0].ok,false);
});

test('only the teacher posts quizzes; students vote once', async()=>{
  const bad=await push(S,{type:'msg.send',chat:'math-7',msg:{id:'quiz-bad1',quiz:{q:'?',opts:['a','b'],correct:0}}});
  assert.equal(bad.data.results[0].status,403);
  const q=await push(T,{type:'msg.send',chat:'math-7',msg:{id:'quiz-good1',quiz:{q:'۵×۶؟',opts:['۲۵','۳۰'],correct:1}}});
  assert.equal(q.data.results[0].ok,true);
  const v1=await push(S,{type:'msg.op',id:'quiz-good1',op:'vote',i:1});assert.equal(v1.data.results[0].ok,true,JSON.stringify(v1.data));
  const v2=await push(S,{type:'msg.op',id:'quiz-good1',op:'vote',i:0});assert.equal(v2.data.results[0].status,409);
  const t=await call(T,'/sync?rev=0');
  assert.deepEqual(t.data.messages.find(x=>x.id==='quiz-good1').quiz.votes,[0,1]);
});

test('assignment submissions stay private between student and teacher', async()=>{
  await push(T,{type:'msg.send',chat:'math-7',msg:{id:'asg-0001',assign:{title:'تمرین ۶',due:Date.now()+864e5}}});
  await push(S,{type:'msg.op',id:'asg-0001',op:'submit',file:{note:'پاسخ ایلیا'}});
  await push(S2,{type:'msg.op',id:'asg-0001',op:'submit',file:{note:'پاسخ نورا'}});
  const g=await push(T,{type:'msg.op',id:'asg-0001',op:'grade',user:'u'+S.id,grade:19});assert.equal(g.data.results[0].ok,true);
  const s=(await call(S,'/sync?rev=0')).data.messages.find(x=>x.id==='asg-0001').assign;
  assert.deepEqual(Object.keys(s.files),['u'+S.id]);assert.deepEqual(s.grades,{['u'+S.id]:19});
  const t=(await call(T,'/sync?rev=0')).data.messages.find(x=>x.id==='asg-0001').assign;
  assert.equal(Object.keys(t.files).length,2);
});

test('reactions, edits and deletes', async()=>{
  const r=await push(T,{type:'msg.op',id:'msg-hello1',op:'react',emos:['❤️']});assert.equal(r.data.results[0].ok,true);
  const e=await push(T,{type:'msg.op',id:'msg-hello1',op:'edit',t:'hack'});assert.equal(e.data.results[0].status,403);
  const s=(await call(S,'/sync?rev=0')).data.messages.find(x=>x.id==='msg-hello1');
  assert.deepEqual(s.react,{'❤️':1});
  const d=await push(T,{type:'msg.op',id:'msg-hello1',op:'delete'});assert.equal(d.data.results[0].ok,true);
  const after=(await call(S,'/sync?rev=0')).data.messages.find(x=>x.id==='msg-hello1');
  assert.ok(!after||after.deleted);
});

test('personal chats and reachability', async()=>{
  const ok=await push(S,{type:'chat.create',chat:{type:'personal',members:['u'+T.id]}});assert.equal(ok.data.results[0].ok,true,JSON.stringify(ok.data));
  const no=await push(X,{type:'chat.create',chat:{type:'personal',members:['u'+S.id]}});assert.equal(no.data.results[0].ok,false,'strangers cannot DM students');
  const t=await call(T,'/sync?rev=0');
  assert.ok(t.data.chats.some(c=>c.id==='pm-'+Math.min(T.id,S.id)+'-'+Math.max(T.id,S.id)));
});

test('signed uploads are scoped to chat members', async()=>{
  const up=await call(S,'/upload',{chat:'math-7',name:'a.png',mime:'image/png',size:10});
  assert.equal(up.status,200);assert.match(up.data.key,/^srv:math-7\//);
  const fd=new FormData();fd.append('',new Blob([new Uint8Array(10)],{type:'image/png'}),'a.png');
  const put=await fetch(up.data.url,{method:'PUT',body:fd});assert.equal(put.status,200);
  const mine=await call(S2,'/file?key='+encodeURIComponent(up.data.key));assert.equal(mine.status,200);
  const theirs=await call(X,'/file?key='+encodeURIComponent(up.data.key));assert.equal(theirs.status,403);
  const deny=await call(X,'/upload',{chat:'math-7',name:'a',mime:'x',size:1});assert.ok(deny.status>=400);
});
