import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../server/chat-model.mjs';

const teacher={id:1,role:'teacher',active:true}, student={id:3,role:'student',active:true}, other={id:4,role:'student',active:true}, admin={id:6,role:'admin',active:true};
const cls={id:'class-3a',type:'class'}, chan={id:'news',type:'channel'}, saved={id:'sv-3',type:'saved'}, pm={id:'pm-1-3',type:'personal'};
const mem=(user_id,role='member')=>({user_id,role});
const ctx=(chat,user,extra={})=>({chat,user,member:mem(user.id,user===teacher?'owner':'member'),memberIds:[1,3,4],studentIds:[3,4],...extra});
const throwsStatus=(fn,status)=>assert.throws(fn,e=>e instanceof M.ChatError&&e.status===status);

test('ids and helpers', ()=>{
  assert.equal(M.personalId(7,2),'pm-2-7');
  assert.equal(M.savedId(3),'sv-3');
  assert.equal(M.uid('u42'),42);
  assert.equal(M.uid('s_ilya'),null);
  assert.equal(M.cid(5),'u5');
  assert.ok(M.KEY_RE.test('srv:class-3a/abcdefgh12'));
  assert.ok(!M.KEY_RE.test('srv:../etc/passwd'));
});

test('who may post / teach / create', ()=>{
  assert.equal(M.canPost(cls,null,student),false,'non-members cannot post');
  assert.equal(M.canPost(cls,mem(3),student),true);
  assert.equal(M.canPost(chan,mem(3),student),false,'channels are read-only for members');
  assert.equal(M.canPost(chan,mem(1,'owner'),teacher),true);
  assert.equal(M.canPost(saved,mem(3),student),true);
  assert.equal(M.canTeach(cls,mem(1,'owner'),teacher),true);
  assert.equal(M.canTeach(cls,mem(3),student),false);
  assert.equal(M.canTeach(pm,mem(1),teacher),false);
  assert.equal(M.canCreate('class',student),false);
  assert.equal(M.canCreate('channel',admin),true);
  assert.equal(M.canCreate('group',student),true);
  assert.equal(M.canCreate('saved',teacher),false);
});

test('reachability keeps students from cold-messaging strangers', ()=>{
  assert.equal(M.canReach(student,teacher,false),true);
  assert.equal(M.canReach(student,other,false),false);
  assert.equal(M.canReach(student,other,true),true);
  assert.equal(M.canReach(student,{...teacher,active:false},true),false);
  assert.equal(M.canReach(student,student,true),false);
});

test('validateNewChat', ()=>{
  const p=M.validateNewChat({type:'personal',members:['u1']},student);
  assert.equal(p.id,'pm-1-3');
  throwsStatus(()=>M.validateNewChat({type:'class',id:'c-abc',name:'x'},student),403);
  throwsStatus(()=>M.validateNewChat({type:'group',id:'pm-9-9',name:'x'},student),400);
  throwsStatus(()=>M.validateNewChat({type:'group',id:'grp1'},student),400);
  const g=M.validateNewChat({type:'group',id:'grp1',name:' گروه ریاضی ',members:['u4','u4','u3','bad']},student);
  assert.deepEqual(g.members,[4]);
  assert.equal(g.name,'گروه ریاضی');
});

test('validateMessage enforces roles and shapes', ()=>{
  const ok=M.validateMessage({id:'m-1234',t:'سلام'},ctx(cls,student));
  assert.equal(ok.kind,'text');
  throwsStatus(()=>M.validateMessage({id:'m-1235',quiz:{q:'?',opts:['a','b']}},ctx(cls,student)),403);
  const q=M.validateMessage({id:'m-1236',quiz:{q:'۵×۶؟',opts:['۲۵','۳۰'],correct:9}},ctx(cls,teacher));
  assert.equal(q.body.quiz.correct,1,'correct index is clamped');
  throwsStatus(()=>M.validateMessage({id:'m-1237',img:'https://evil.example/x.png'},ctx(cls,student)),400);
  throwsStatus(()=>M.validateMessage({id:'m-1238',file:{name:'a.pdf'}},ctx(cls,student)),400);
  throwsStatus(()=>M.validateMessage({id:'x',t:'hi'},ctx(cls,student)),400);
  throwsStatus(()=>M.validateMessage({id:'m-1239',t:''},ctx(cls,student)),400);
  const att=M.validateMessage({id:'m-1240',att:{list:{u3:true,u99:true}}},ctx(cls,teacher));
  assert.deepEqual(att.body.att.list,{3:true},'attendance only lists members');
});

test('applyOp: vote, submit, grade, react, edit, delete', ()=>{
  const quiz={id:'q1',sender:1,kind:'quiz',created:Date.now(),body:{quiz:{q:'?',opts:['a','b'],correct:1,voted:{}}}};
  const v=M.applyOp({op:'vote',i:1},{...ctx(cls,student),msg:quiz});
  assert.equal(v.body.quiz.voted[3],1);
  assert.equal(quiz.body.quiz.voted[3],undefined,'input is not mutated');
  throwsStatus(()=>M.applyOp({op:'vote',i:0},{...ctx(cls,student),msg:{...quiz,body:v.body}}),409);
  throwsStatus(()=>M.applyOp({op:'vote',i:0},{...ctx(cls,teacher),msg:quiz}),403);

  const asg={id:'a1',sender:1,kind:'assign',created:Date.now(),body:{assign:{title:'t',subs:[],files:{},grades:{}}}};
  const s=M.applyOp({op:'submit',file:{note:'حل شد'}},{...ctx(cls,student),msg:asg});
  assert.deepEqual(s.body.assign.subs,[3]);
  throwsStatus(()=>M.applyOp({op:'grade',user:'u3',grade:18},{...ctx(cls,student),msg:{...asg,body:s.body}}),403);
  const g=M.applyOp({op:'grade',user:'u3',grade:18.3},{...ctx(cls,teacher),msg:{...asg,body:s.body}});
  assert.equal(g.body.assign.grades[3],18.25);

  const txt={id:'t1',sender:3,kind:'text',created:Date.now(),body:{t:'x'}};
  const r1=M.applyOp({op:'react',emos:['❤️','💩']},{...ctx(cls,teacher),msg:txt});
  assert.deepEqual(r1.body.reacts,{'❤️':[1]});
  const r2=M.applyOp({op:'react',emos:[]},{...ctx(cls,teacher),msg:{...txt,body:r1.body}});
  assert.deepEqual(r2.body.reacts,{});
  throwsStatus(()=>M.applyOp({op:'edit',t:'y'},{...ctx(cls,teacher),msg:txt}),403);
  assert.equal(M.applyOp({op:'edit',t:'y'},{...ctx(cls,student),msg:txt}).body.t,'y');
  throwsStatus(()=>M.applyOp({op:'delete'},{...ctx(cls,other),member:mem(4),msg:txt}),403);
  assert.equal(M.applyOp({op:'delete'},{...ctx(cls,teacher),msg:txt}).deleted,true,'teachers moderate their class');
});

test('project hides classmates’ submissions and grades from students', ()=>{
  const msg={id:'a1',sender:1,created:1,rev:9,body:{assign:{title:'t',subs:[3,4],files:{3:{note:'mine'},4:{note:'theirs'}},grades:{3:17,4:20}},reacts:{'👍':[3,4]}}};
  const st=M.project(msg,{viewer:3,chat:cls,teach:false,studentIds:[3,4]});
  assert.deepEqual(Object.keys(st.assign.files),['u3']);
  assert.deepEqual(st.assign.grades,{u3:17});
  assert.deepEqual(st.assign.subs,['u3','u4']);
  assert.deepEqual(st.react,{'👍':2});
  assert.deepEqual(st.my,['👍']);
  const te=M.project(msg,{viewer:1,chat:cls,teach:true,studentIds:[3,4]});
  assert.equal(Object.keys(te.assign.files).length,2);
  assert.equal(M.project({id:'d',deleted:true,created:1,rev:2},{viewer:1,chat:cls}).deleted,true);
});

test('avatarData only accepts small inline images', ()=>{
  assert.equal(M.avatarData(null),null);
  assert.ok(M.avatarData('data:image/png;base64,iVBORw0KGgo='));
  throwsStatus(()=>M.avatarData('data:text/html;base64,PHA+'),400);
  throwsStatus(()=>M.avatarData('data:image/png;base64,'+'A'.repeat(150000)),400);
});
