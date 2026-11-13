/* =========================================================
   Sending & receiving
   ========================================================= */
function pushMsg(c, m, opts={}){
  m.id ||= 'm'+nid(); c.msgs.push(m);
  if(state.cur===c){
    const nb = nearBottom() || isMe(m.by);
    const row = appendMsg(m, c, {anim:true});
    if(nb) toBottom();
    else if(!isMe(m.by)){ sdCount++; const b = $('#sdBadge'); b.style.display = ''; b.textContent = fa(sdCount); b.animate([{transform:'scale(1.5)'},{transform:'none'}],{duration:350}); }
    if(!isMe(m.by) && !m.sys) setChips(c.bot ? [] : smartFor(c, m));
    return row;
  } else if(!isMe(m.by) && !m.sys){
    c.unread = (c.unread||0) + 1;
    if(/@/.test(m.t||'') && (m.t||'').includes(P[meId()].name.replace(/\s/g,'_'))) c.mention = true;
    notify(c, m);
  }
  flipRender(c.id);
}
function pushOut(extra){
  const c = state.cur; if(!c) return;
  const m = Object.assign({by: c.saved ? '@me' : meId(), ts:Date.now(), pending:true}, extra);
  if(c.type==='channel') m.views = 1;
  if(state.replyTo){ m.reply = state.replyTo.id; }
  cancelReply();
  pushMsg(c, m);
  const row = rowOf(m.id);
  setTimeout(() => { m.pending = false; refreshMeta(row, m); }, 650);
  if(c.saved) setTimeout(() => { m.read = 1; refreshMeta(row, m); }, 900);
  else scheduleReply(c, m);
  return m;
}
function refreshMeta(row, m){
  if(!row || !row.isConnected) return;
  const meta = $('.meta', row); if(!meta) return;
  const tmp = document.createElement('div'); tmp.innerHTML = metaHTML(m, state.cur, true);
  const n = tmp.firstChild; n.style.cssText = meta.style.cssText; if(meta.classList.contains('ov')) n.classList.add('ov');
  meta.replaceWith(n);
  const ck = $('.ck', n); if(ck) ck.animate([{transform:'scale(.3)',opacity:0},{transform:'scale(1.25)'},{transform:'none',opacity:1}],{duration:420, easing:'cubic-bezier(.34,1.56,.64,1)'});
}
function flyFrom(text){
  const r = inp.getBoundingClientRect(), f = document.createElement('div');
  f.className = 'fly'; f.textContent = text.slice(0,60);
  Object.assign(f.style, {left:r.left+'px', top:r.top+'px', width:r.width+'px', fontSize:'15px', color:'var(--ink)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', direction:'rtl'});
  document.body.appendChild(f);
  requestAnimationFrame(() => { f.style.transform = 'translateY(-60px) scale(.9)'; f.style.opacity = 0; });
  setTimeout(() => f.remove(), 520);
}
function send(){
  const c = state.cur, v = inp.value.trim(); if(!c || !v) return;
  if(state.editing){
    const m = state.editing; m.t = v; m.edited = true; inp.value = ''; autosize(); cancelReply(); refreshRow(m);
    const b = $('.bub', rowOf(m.id)); b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash');
    toast('پیام ویرایش شد','✎'); return;
  }
  const cmd = v.match(/^\/(\S+)/); if(cmd){ const x = CMDS.find(k => k.k===cmd[1] && (!k.teacher || state.role==='teacher')); if(x){ inp.value=''; autosize(); x.run(); return; } }
  flyFrom(v);
  inp.value = ''; autosize(); closePops();
  sendb.classList.remove('go'); void sendb.offsetWidth; sendb.classList.add('go');
  if(/^[\p{Emoji_Presentation}\u2764\uFE0F]{1,3}$/u.test(v) && [...new Intl.Segmenter().segment(v)].length <= 2) pushOut({stk:v});
  else pushOut({t:v});
}
function sendSticker(s){ if(!state.cur || !canPost(state.cur)) return; pushOut({stk:s}); }
function sendFile(){
  const names = state.role==='teacher' ? ['کاربرگ الگوها - هفته ۳.pdf','خلاصهٔ درس علوم.pdf'] : ['تمرین صفحه ۴۲ - ایلیا.pdf','گزارش آزمایش.pdf'];
  pushOut({file:{name:pick(names), size:fa(rnd(.6,3.8).toFixed(1))+' مگابایت', ok:true}});
}
function sendPhoto(){ pushOut({img:SITE+'/images/quest-island.webp', t:state.role==='teacher' ? 'مرحلهٔ بعدی ماجراجویی 🌋' : 'عکس تمرینم 📸'}); }

function scheduleReply(c, m){
  if(!c.bot && !SET.sim) return;
  if(c.bot){ return raivaAnswer(c, m); }
  if(c.type==='channel') return;
  const others = c.members.filter(id => id!==meId() && id!=='@me' && P[id] && id!=='s_ilya' && id!=='t_sadeghi' && !P[id].ai);
  if(!others.length) return;
  const who = c.type==='personal' ? others[0] : pick(others.filter(x => P[x].online).length ? others.filter(x => P[x].online) : others);
  setTimeout(() => { m.read = 1; refreshMeta(rowOf(m.id), m); }, 1300);
  const txt = m.t || '';
  let reply;
  if(m.voice) reply = P[who].role==='teacher' ? 'صدایت را شنیدم، خیلی خوب توضیح دادی 👏' : 'وویست رسید 😄';
  else if(m.stk) reply = {stk: pick(STK)};
  else if(m.file) reply = P[who].role==='teacher' ? 'فایل دریافت شد، بررسی می‌کنم 🙏' : 'مرسی، دانلودش کردم 📥';
  else if(/سلام/.test(txt)) reply = 'سلام 🌱 خوبی؟';
  else if(/ممنون|مرسی|متشکر/.test(txt)) reply = P[who].role==='teacher' ? 'خواهش می‌کنم عزیزم 🌸' : 'قربونت 😊';
  else if(/\?|؟|چطور|چرا|کی/.test(txt)) reply = P[who].role==='teacher' ? 'سؤال خوبی است 🤔 فردا سر کلاس با مثال توضیح می‌دهم.' : 'فکر کنم صفحهٔ ۴۲ کتاب توضیح داده 📖';
  else reply = pick(P[who].role==='teacher' ? ['آفرین، عالیه 👏','بسیار خوب 🌟','ممنون از پیامت 🙏'] : ['باشه 👍','عالیه 😍','حتماً','😂😂']);
  if(Math.random() < .2 && c.type==='class') return;
  const delay = rnd(1600, 2600);
  setTimeout(() => setTyping(c, who), delay);
  setTimeout(() => { setTyping(c, null); pushMsg(c, Object.assign({by:who, ts:Date.now()}, typeof reply==='string' ? {t:reply} : reply)); }, delay + rnd(1400, 2400));
}
function setTyping(c, who){
  c.typing = who;
  if(state.cur===c){
    setSt(c);
    $('.typing-row', msgsEl)?.remove();
    if(who){
      const r = document.createElement('div'); r.className = 'typing-row';
      r.innerHTML = (c.type==='class' ? `<div class="ra" style="visibility:visible">${avHTML(who,'noon')}</div>` : '') + '<div class="tbub"><i></i><i></i><i></i></div>';
      msgsEl.appendChild(r); if(nearBottom()) toBottom();
    }
  }
  renderList();
}

/* Raiva AI */
function raivaReply(q){
  const n = en(q).replace(/[×x]/g,'*').replace(/÷/g,'/').replace(/[^\d+\-*/().\s]/g,'').trim();
  if(/\d\s*[+\-*/]\s*\d/.test(n) && /^[\d+\-*/().\s]+$/.test(n)){
    try{ const v = Function('"use strict";return (' + n + ')')(); if(isFinite(v)) return `حسابش این میشه:\n\n**${fa(n.replace(/\*/g,' × ').replace(/\//g,' ÷ ').replace(/\s+/g,' '))} = ${fa(Math.round(v*1000)/1000)}**\n\nیک ترفند: برای ضرب‌های بزرگ می‌تونی عدد رو بشکنی؛ مثلاً ۱۲ × ۸ = (۱۰ × ۸) + (۲ × ۸) ✦`; }catch(e){}
  }
  if(/فتوسنتز/.test(q)) return '🌿 **فتوسنتز** یعنی گیاه با کمک **نور خورشید**، **آب** و **کربن‌دی‌اکسید** برای خودش غذا (قند) می‌سازد و **اکسیژن** آزاد می‌کند.\n\nمثل یک آشپزخانهٔ سبز کوچک در هر برگ! آزمایش پیشنهادی: یک گیاه را چند روز در تاریکی بگذار و تغییر رنگ برگ‌ها را ببین 🔬';
  if(/کسر/.test(q)) return '🍕 **کسر** یعنی بخشی از یک کل.\n\nاگر یک پیتزا را **۴** قسمت مساوی کنیم و **۱** قسمتش را بخوریم، خورده‌ایم: **۱/۴**\nعدد پایین (مخرج) = چند قسمت کردیم\nعدد بالا (صورت) = چند قسمت برداشتیم ✦';
  if(/الگو/.test(q)) return '🔢 در **الگوی عددی** دنبال قانون تکرار می‌گردیم.\n\n۲، ۴، ۶، ۸ … هر بار **۲ تا** اضافه می‌شود، پس بعدی **۱۰** است.\nبرای تمرین ۳ صفحهٔ ۴۲ هم همین را امتحان کن 😉';
  if(/تکلیف|مهلت/.test(q)){ const a = allAssign().filter(x => !x.m.assign.subs.includes(meId())); return a.length ? `📝 تو **${fa(a.length)} تکلیف** فعال داری:\n\n` + a.map(x => `• **${x.m.assign.title}** (${x.m.assign.subject}) · ${cdText(x.m.assign.due)} مانده`).join('\n') + '\n\nاز همین الان شروع کنیم؟ 💪' : '🎉 همهٔ تکالیفت را تحویل داده‌ای. آفرین کاوشگر'; }
  if(/امتحان/.test(q)) return '📅 **امتحان کسرها** شنبه است (کلاس آقای رحیمی).\n\nبرنامهٔ پیشنهادی من:\n• امروز: مرور تعریف کسر\n• فردا: مقایسهٔ کسرها\n• جمعه: ۱۰ تمرین مرور با من ✦';
  if(/سلام|درود/.test(q)) return 'سلام کاوشگر 👋 امروز چه چیزی رو می‌خوای کشف کنیم؟';
  if(/ممنون|مرسی|متشکر/.test(q)) return 'خواهش می‌کنم 🌱 یادت باشه: «اشتباه کردن هم بخشی از کشف کردن است.»';
  return `سؤال جالبیه 🤔\n\nدربارهٔ «**${q.slice(0,40)}**» بهتره اول با معلمت هم مطرح کنی. من در حال حاضر می‌تونم دربارهٔ **فتوسنتز، کسر، الگوها، تکالیف و امتحان‌ها** کمکت کنم، یا هر محاسبه‌ای رو برات حل کنم ✦`;
}
async function raivaAnswer(c, m){
  await sleep(500); m.read = 1; refreshMeta(rowOf(m.id), m);
  c.typing = 'raiva'; if(state.cur===c) setSt(c);
  let think = null;
  if(state.cur===c){
    think = document.createElement('div'); think.className = 'row in first tail a-in';
    think.innerHTML = `<div class="bub"><div class="think"><span class="ob"></span><span>رایوا در حال فکر کردن…</span></div></div>`;
    msgsEl.appendChild(think); toBottom();
  }
  await sleep(rnd(1100, 1700));
  think?.remove();
  const full = raivaReply(m.t || (m.stk ? 'سلام' : '')), am = {by:'raiva', ai:true, t:'', ts:Date.now()};
  const row = pushMsg(c, am) || null;
  const words = full.split(/(\s+)/);
  for(let i=0; i<words.length; i++){
    am.t += words[i];
    if(row && row.isConnected){ const tx = $('.txt', row); tx.innerHTML = fmtText(am.t) + '<span class="caret"></span>'; if(nearBottom()) msgsEl.scrollTop = msgsEl.scrollHeight; }
    await sleep(words[i].trim() ? rnd(22, 55) : 0);
  }
  c.typing = null; if(state.cur===c) setSt(c);
  if(row && row.isConnected){ $('.bub', row).classList.remove('streaming'); $('.txt', row).innerHTML = fmtText(am.t); }
  if(state.cur===c) setChips(['بیشتر توضیح بده','یک مثال دیگر','۲۴ ÷ ۶ چند میشه؟','چه تکلیفی دارم؟']);
  renderList();
}

/* Teacher tools: modals */
function segHTML(id, opts){ return `<div class="seg" id="${id}"><span class="si"></span>${opts.map((o,i) => `<button class="${i?'':'on'}" data-v="${o}">${o}</button>`).join('')}</div>`; }
function wireSeg(el){
  const si = $('.si', el), mv = () => { const b = $('.on', el); si.style.width = b.offsetWidth+'px'; si.style.left = b.offsetLeft+'px'; };
  $$('button', el).forEach(b => b.onclick = () => { $$('button', el).forEach(x => x.classList.remove('on')); b.classList.add('on'); mv(); });
  requestAnimationFrame(mv);
}
function assignModal(){
  const o = openOvl(`<div class="modal"><div class="modal-h"><div class="sym" style="background:var(--mint);color:var(--mint-ink)">📝</div><div><b>تکلیف جدید</b><small>برای ${esc(chatName(state.cur))}</small></div></div>
    <div class="modal-b"><div class="fld"><label>عنوان</label><input id="aT" value="حل مسئله‌های الگو"></div>
    <div class="fld"><label>درس</label>${segHTML('aS', Object.keys(SUBJ))}</div>
    <div class="fld"><label>توضیحات</label><textarea id="aD">تمرین‌های ۶ تا ۹ صفحهٔ ۴۳ را حل کنید.</textarea></div>
    <div class="fld"><label>مهلت</label>${segHTML('aW', ['۲ ساعت','فردا','۳ روز','یک هفته'])}</div></div>
    <div class="modal-f"><button class="btn pri" id="aOk">انتشار تکلیف</button><button class="btn sec" id="aNo">انصراف</button></div></div>`);
  wireSeg($('#aS')); wireSeg($('#aW'));
  $('#aNo').onclick = closeOvl; o.onclick = e => { if(e.target===o) closeOvl(); };
  $('#aOk').onclick = () => {
    const w = {'۲ ساعت':2*HOUR,'فردا':DAY,'۳ روز':3*DAY,'یک هفته':7*DAY}[$('#aW .on').dataset.v];
    const a = {title:$('#aT').value.trim()||'تکلیف', subject:$('#aS .on').dataset.v, desc:$('#aD').value.trim(), subs:[], total:Math.max(1,state.cur.members.filter(x=>P[x]?.role==='student').length), created:Date.now(), due:Date.now()+w};
    closeOvl(); const m = pushOut({assign:a});
    toast('تکلیف منتشر شد و برای دانش‌آموزان اعلان رفت','📝');
    // simulate submissions
    if(SET.sim) STUDENTS.filter(s => s!=='s_ilya').forEach((s,i) => setTimeout(() => { if(a.subs.includes(s)) return; a.subs.push(s); if(state.cur?.msgs.includes(m)) refreshRow(m); if(i===0) toast(`${P[s].name} تکلیف را تحویل داد`,'📥'); updateTaskDot(); }, 4500 + i*3200));
  };
}
function quizModal(){
  const o = openOvl(`<div class="modal"><div class="modal-h"><div class="sym" style="background:color-mix(in srgb,var(--orange) 25%,transparent)">📊</div><div><b>آزمونک سریع</b><small>گزینهٔ درست را با دایره مشخص کنید</small></div></div>
    <div class="modal-b"><div class="fld"><label>پرسش</label><input id="qQ" value="۵ × ۶ چند می‌شود؟"></div>
    ${['۲۵','۳۰','۳۶'].map((v,i) => `<div class="opt-row"><span class="rdo ${i===1?'on':''}" data-i="${i}">${IC.check}</span><input type="text" class="fld-o" value="${v}" style="border:1.5px solid var(--line);background:var(--panel2);border-radius:13px;padding:10px 13px;outline:0"></div>`).join('')}</div>
    <div class="modal-f"><button class="btn pri" id="qOk">ارسال آزمونک</button><button class="btn sec" id="qNo">انصراف</button></div></div>`);
  $$('.rdo', o).forEach(r => r.onclick = () => { $$('.rdo', o).forEach(x => x.classList.remove('on')); r.classList.add('on'); });
  $('#qNo').onclick = closeOvl; o.onclick = e => { if(e.target===o) closeOvl(); };
  $('#qOk').onclick = () => {
    const opts = $$('.fld-o', o).map(x => x.value.trim()).filter(Boolean); if(opts.length < 2) return toast('حداقل دو گزینه لازم است','⚠️');
    const q = {q:$('#qQ').value.trim(), opts, correct:+$('.rdo.on', o).dataset.i, votes:opts.map(()=>0), voted:{}};
    closeOvl(); const m = pushOut({quiz:q});
    if(SET.sim) STUDENTS.filter(s => s!=='s_ilya').forEach((s,i) => setTimeout(() => { const v = Math.random() < .7 ? q.correct : rnd(0, opts.length)|0; q.voted[s] = v; q.votes[v]++; if(state.cur?.msgs.includes(m)) refreshRow(m); }, 2500 + i*1800));
  };
}
function sendAtt(){
  const c = state.cur;
  if(!canTeachUI() || !c || c.type!=='class') return toast('حضور و غیاب فقط برای آموزگار کلاس فعال است','🔒');
  openTeacherAttendance(c.id);
}

/* Smart summary — generated from the real conversation, never seeded demo facts */
function closeSum(){ $('#sumc').classList.remove('show'); }
$('#sumBtn').onclick = async e => {
  e.stopPropagation();
  const box=$('#sumc');
  if(box.dataset.loading==='1') return;
  if(box.classList.contains('show')){ closeSum(); return; }
  const c=state.cur;
  if(!c) return;
  const context=c.msgs.filter(m=>!m.sys&&!m.ai).slice(-24).map(m=>{
    const who=isMe(m.by)?'من':(pname(m.by)||'عضو کلاس');
    const parts=[];
    if(m.t) parts.push(m.t);
    if(m.assign) parts.push('تکلیف: '+m.assign.title+'، درس: '+(m.assign.subject||'نامشخص')+'، مهلت: '+new Date(m.assign.due).toLocaleString('fa-IR'));
    if(m.quiz) parts.push('آزمونک: '+m.quiz.q+'، گزینه‌ها: '+(m.quiz.opts||[]).join('، '));
    if(m.att) parts.push('حضور و غیاب ثبت شده');
    if(m.grade) parts.push('کارنامه: '+m.grade.subject+'، نمره '+m.grade.score+' از '+(m.grade.max||20));
    if(m.file) parts.push('فایل: '+m.file.name);
    if(m.voice) parts.push('پیام صوتی');
    return parts.length ? who+': '+parts.join(' | ') : '';
  }).filter(Boolean).join('\n').slice(-9000);
  box.classList.add('show');
  if(!context){
    box.innerHTML='<h4>✦ خلاصهٔ گفتگو</h4><div class="sum-result">هنوز پیام کافی برای خلاصه‌سازی در این گفتگو وجود ندارد.</div>';
    return;
  }
  box.dataset.loading='1';box.setAttribute('aria-busy','true');
  box.innerHTML='<h4>✦ خلاصهٔ هوشمند رایوا</h4><div class="sum-result">رایوا در حال بررسی پیام‌های واقعی این کلاس است…</div>';
  try{
    const response=await fetch('/api/ai',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:'این متن، پیام‌های واقعی یک کلاس مدرسه است. آن را به فارسی خلاصه کن. فقط اطلاعات موجود را بنویس؛ نام‌ها، تکالیف و مهلت‌ها را دقیق نگه دار. موارد مهم، تکالیف باز و تصمیم‌های ثبت‌شده را جدا کن و چیزی را حدس نزن.\n\n'+context}]})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data.error||'سرویس رایوا در دسترس نیست.');
    const summary=String(data.text||'').trim();
    if(!summary) throw new Error('رایوا خلاصه‌ای برنگرداند.');
    box.innerHTML='<h4><span style="color:var(--green)">✦</span> خلاصهٔ واقعی گفتگو</h4><div class="sum-result">'+esc(summary).replace(/\r?\n/g,'<br>')+'</div>';
  }catch(err){
    box.innerHTML='<h4>✦ خلاصهٔ هوشمند رایوا</h4><div class="sum-result">خلاصه‌سازی انجام نشد: '+esc(err.message||'خطای ارتباط با رایوا')+'</div>';
  }finally{
    delete box.dataset.loading;box.removeAttribute('aria-busy');
  }
};

/* Live class — local animation remains demo-only; real accounts never get a fake call */
let liveT = 0;
function startLive(){
  const c=state.cur;
  if(!c) return;
  if(NET.on){
    toast('تماس تصویری هنوز به سرویس امن جلسهٔ آنلاین متصل نشده است؛ این دکمه جلسهٔ ساختگی ایجاد نمی‌کند.','⚠️');
    return;
  }
  if(state.role==='teacher'&&!c.live){c.live=true;$('#livebar').classList.add('show');pushMsg(c,{sys:'🎥 کلاس آنلاین شروع شد',ts:Date.now()});}
  joinLive();
}
function joinLive(){
  if(NET.on){
    toast('برای تماس واقعی باید سرویس جلسهٔ آنلاین مدرسه پیکربندی شود. فعلاً هیچ تماس یا میکروفونی شروع نشده است.','⚠️');
    return;
  }
  const pip=$('#pip'),lc=state.cur;
  const lead=(lc&&lc.members.find(x=>P[x]?.role==='teacher'))||(P.t_sadeghi?'t_sadeghi':meId());
  const ppl=[lead,...((lc?lc.members.filter(x=>P[x]?.role==='student'):STUDENTS).filter(x=>x!==lead).slice(0,5))].filter(x=>P[x]);
  pip.innerHTML=`<div class="pip-h"><span class="rd" style="width:8px;height:8px;border-radius:50%;background:var(--danger);animation:blink 1s infinite"></span><b>کلاس آنلاین · نسخهٔ نمایشی</b><small id="pipT">۰۰:۰۰</small></div>
    <div class="pip-g">${ppl.map(id=>`<div class="pip-p" data-id="${id}">${avHTML(id,'noon')}<span>${esc(id===meId()?'شما':P[id].name.split(' ').slice(-1)[0])}</span></div>`).join('')}</div>
    <div class="pip-c"><button id="pMic" class="off" title="میکروفون"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5"/></svg></button><button id="pHand" title="اجازه گرفتن" style="font-size:20px">✋</button><button id="pCam" class="off" title="دوربین">${SVGI.cam}</button><button class="end" id="pEnd" title="خروج"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 15.5c5-5 13-5 18 0l-2.4 2.4-3.6-1.6v-3a12 12 0 0 0-6 0v3l-3.6 1.6z"/></svg></button></div>`;
  pip.classList.add('show');
  const t0=Date.now();clearInterval(liveT);
  liveT=setInterval(()=>{
    const s=Math.floor((Date.now()-t0)/1000);$('#pipT').textContent=fa(`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`);
    $$('.pip-p .av',pip).forEach(a=>a.classList.remove('spk'));
    const sp=Math.random()<.6?$('.pip-p[data-id="'+lead+'"] .av',pip):pick($$('.pip-p .av',pip));if(sp&&!sp.closest('[data-id="'+meId()+'"]'))sp.classList.add('spk');
  },700);
  $('#pMic').onclick=e=>{e.currentTarget.classList.toggle('off');toast(e.currentTarget.classList.contains('off')?'میکروفون خاموش شد':'میکروفون روشن شد','🎙️');};
  $('#pCam').onclick=e=>e.currentTarget.classList.toggle('off');
  $('#pHand').onclick=e=>{const r=e.currentTarget.getBoundingClientRect();burst(r.left+r.width/2,r.top,['✋','✨'],10);toast('درخواست اجازه برای معلم ارسال شد','✋');};
  $('#pEnd').onclick=()=>{clearInterval(liveT);pip.classList.remove('show');toast('از نسخهٔ نمایشی خارج شدید','👋');};
  const h=$('.pip-h',pip);let d=null;
  h.onpointerdown=e=>{const r=pip.getBoundingClientRect();d={dx:e.clientX-r.left,dy:e.clientY-r.top};pip.classList.add('dragging');h.setPointerCapture(e.pointerId);};
  h.onpointermove=e=>{if(!d)return;pip.style.left=Math.max(8,Math.min(innerWidth-pip.offsetWidth-8,e.clientX-d.dx))+'px';pip.style.top=Math.max(8,Math.min(innerHeight-pip.offsetHeight-8,e.clientY-d.dy))+'px';pip.style.bottom='auto';};
  h.onpointerup=()=>{if(!d)return;d=null;pip.classList.remove('dragging');const r=pip.getBoundingClientRect();pip.style.left=(r.left+r.width/2<innerWidth/2?20:innerWidth-r.width-20)+'px';};
}
$('#joinBtn').onclick=joinLive;

/* In-app banner */
let banT = 0;
function notifyBanner(c, m){
  if(c.muted) return;
  if(state.focus){ state.focusMissed++; const d = $('#focusDot'); d.style.display = ''; d.textContent = fa(state.focusMissed); return; }
  const b = $('#banner');
  b.innerHTML = `${chatAv(c,'sm')}<div class="bb"><b>${esc(chatName(c))}</b><span>${esc((c.type==='class' ? pname(m.by)+': ' : '') + preview(m))}</span></div><small>اکنون</small>`;
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  b.onclick = () => { b.classList.remove('show'); openChat(c.id); };
  clearTimeout(banT); banT = setTimeout(() => b.classList.remove('show'), 4200);
}

/* Context menu + reactions bar */
function openCtx(row, x, y){
  const m = row._m, c = state.cur; if(!m) return;
  closePops(); row.classList.add('ctx-on'); $('#dim').classList.add('show');
  const mine = isMe(m.by), T = state.role==='teacher';
  const items = [
    canPost(c) && ['reply','پاسخ', () => startReply(m)],
    m.t && ['copy','کپی متن', () => { navigator.clipboard?.writeText(m.t).catch(()=>{}); toast('متن کپی شد','📋'); }],
    (T || c.type==='personal') && ['pin', c.pinnedMsg===m.id ? 'برداشتن سنجاق' : 'سنجاق کردن', () => { c.pinnedMsg = c.pinnedMsg===m.id ? null : m.id; updatePin(c); toast(c.pinnedMsg ? 'پیام سنجاق شد' : 'سنجاق برداشته شد','📌'); }],
    ['fwd2','هدایت به…', () => forwardPick(m)],
    ['fwd','ذخیره در پیام‌های من', () => { const s = chats.find(x => x.id==='c9'); s.msgs.push(Object.assign({}, m, {id:'m'+nid(), by:'@me', fwd:chatName(c), ts:Date.now(), react:null, my:null, reply:null, read:1})); flipRender('c9'); toast('در پیام‌های ذخیره‌شده قرار گرفت','🔖'); }],
    m.t && !m.ai && ['ai','پرسیدن از رایوا', () => { const q = m.t; openChat('c3'); setTimeout(() => { inp.value = q; send(); }, 450); }],
    mine && m.t && !m.ai && ['edit','ویرایش', () => startEdit(m)],
    (mine || T) && ['del','حذف', () => delMsg(row, m), 1],
  ].filter(Boolean);
  const ICS = {
    fwd2:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 5l6 6-6 6M21 11H9a6 6 0 0 0-6 6v2"/></svg>',reply:IC.reply, copy:SVGI.doc, pin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 17v5M9 10.8V4h6v6.8l3 3.2v2H6v-2z"/></svg>', fwd:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 3h12v18l-6-4-6 4z"/></svg>', ai:SVGI.spark, edit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>', del:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>'};
  const ctx = $('#ctx');
  ctx.innerHTML = items.map(([k,l,,dg],i) => `<div class="it ${dg?'dg':''}" data-i="${i}" style="animation-delay:${i*.03}s">${ICS[k]}${l}</div>`).join('');
  $$('.it', ctx).forEach(it => it.onclick = e => { e.stopPropagation(); closePops(); items[+it.dataset.i][2](); });
  const rb = $('#rbar'); rb.innerHTML = REACTS.map((r,i) => `<button style="animation-delay:${i*.035}s">${r}</button>`).join('');
  $$('button', rb).forEach(b => b.onclick = e => { e.stopPropagation(); closePops(); toggleReact(row, b.textContent); });
  const W = 230, H = items.length*42 + 14;
  let lx = Math.min(Math.max(10, x - W/2), innerWidth - W - 10), ly = y + 10; if(ly + H > innerHeight - 10) ly = Math.max(70, y - H - 10);
  ctx.style.left = lx+'px'; ctx.style.top = ly+'px'; ctx.style.transformOrigin = `${x-lx}px ${ly>y?0:H}px`;
  const rw = REACTS.length*41 + 16; rb.style.left = Math.min(Math.max(10, x - rw/2), innerWidth - rw - 10)+'px';
  rb.style.top = (ly > y ? Math.max(10, y - 62) : Math.min(innerHeight - 60, ly + H + 8)) + 'px';
  ctx.classList.add('show'); rb.classList.add('show');
}
function delMsg(row, m){
  const c = state.cur;
  dust($('.bub', row));
  setTimeout(() => {
    row.style.transition = 'height .35s cubic-bezier(.22,.8,.2,1), margin .35s'; row.style.height = row.offsetHeight+'px'; void row.offsetWidth; row.style.height = '0px'; row.style.margin = '0'; row.style.overflow = 'hidden';
    setTimeout(() => { row.remove(); DELETED.add(m.id); c.msgs = c.msgs.filter(x => x!==m); if(c.pinnedMsg===m.id){ c.pinnedMsg = null; updatePin(c); } flipRender(); }, 360);
  }, 600);
}
$('#dim').onclick = () => closePops();
msgsEl.addEventListener('contextmenu', e => { const row = e.target.closest('.row'); if(!row || !row._m) return; e.preventDefault(); openCtx(row, e.clientX, e.clientY); });
msgsEl.addEventListener('dblclick', e => {
  const row = e.target.closest('.row'); if(!row || !row._m || e.target.closest('.quiz-o,.abtn,.wave')) return;
  getSelection()?.removeAllRanges();
  const h = document.createElement('div'); h.className = 'bheart'; h.textContent = '❤️'; h.style.left = (e.clientX - 46)+'px'; h.style.top = (e.clientY - 60)+'px'; document.body.appendChild(h); setTimeout(() => h.remove(), 1150);
  if(!(row._m.my||[]).includes('❤️')) toggleReact(row, '❤️');
});
// long-press & swipe-to-reply (touch / pen / mouse drag)
let sw = null;
msgsEl.addEventListener('pointerdown', e => {
  const row = e.target.closest('.row'); if(!row || !row._m || e.button===2 || e.target.closest('.quiz-o,.abtn,.vplay,.wave,.tg,.fic,.rc,img')) return;
  sw = {row, x:e.clientX, y:e.clientY, dx:0, lp: setTimeout(() => { if(sw && Math.abs(sw.dx) < 8){ navigator.vibrate && navigator.vibrate(15); openCtx(row, e.clientX, e.clientY); sw = null; } }, 520)};
});
msgsEl.addEventListener('pointermove', e => {
  if(!sw) return; const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
  if(Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)){ clearTimeout(sw.lp); resetSw(); return; }
  sw.dx = Math.max(0, Math.min(90, dx)); if(sw.dx > 6) clearTimeout(sw.lp);
  const b = $('.bub', sw.row), s = $('.swr', sw.row);
  b.style.transition = 'none'; b.style.transform = `translateX(${sw.dx}px)`;
  s.style.transform = `translateY(-50%) scale(${Math.min(1, sw.dx/60)})`; s.style.opacity = Math.min(1, sw.dx/60);
});
function resetSw(){
  if(!sw) return; const b = $('.bub', sw.row), s = $('.swr', sw.row);
  b.style.transition = 'transform .45s cubic-bezier(.34,1.56,.64,1)'; b.style.transform = ''; s.style.transform = ''; s.style.opacity = '';
  sw = null;
}
['pointerup','pointercancel','pointerleave'].forEach(t => msgsEl.addEventListener(t, () => {
  if(!sw) return; clearTimeout(sw.lp);
  if(sw.dx >= 60 && canPost(state.cur)){ navigator.vibrate && navigator.vibrate(12); startReply(sw.row._m); }
  resetSw();
}));

/* Keys */
document.addEventListener('keydown', e => {
  if((e.ctrlKey || e.metaKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); openSpot(); return; }
  if(e.key==='Escape'){
    if($('#lb').classList.contains('show')) return $('#lb').click();
    if($('#ovl').classList.contains('show')) return closeOvl();
    if($('#sumc').classList.contains('show')) return closeSum();
    if($('#info').classList.contains('show')) return closeInfo();
    if(document.activeElement!==inp && state.cur && innerWidth > 900) showEmpty();
  }
});
window.addEventListener('resize', () => { if(innerWidth > 900) $('#stage').classList.remove('open'); if(state.cur && innerWidth<=900) $('#stage').classList.add('open'); });
