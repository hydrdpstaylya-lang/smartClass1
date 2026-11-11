/* =========================================================
   Composer
   ========================================================= */
function autosize(){
  inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 150) + 'px';
  sendb.classList.toggle('txt', inp.value.trim().length > 0 || !!state.editing);
}
function closePops(except){
  ['#attm','#cmdp','#mentp','#emop','#ctx'].forEach(s => { if(s!==except) $(s).classList.remove('show'); });
  if(except!=='#ctx'){ $('#rbar').classList.remove('show'); $('#dim').classList.remove('show'); $$('.row.ctx-on').forEach(r => r.classList.remove('ctx-on')); }
}
inp.addEventListener('input', () => {
  autosize(); popFromInput();
  const c = state.cur; if(c && !c.bot) { clearTimeout(inp._t); inp._t = setTimeout(()=>{}, 1); }
});
inp.addEventListener('keydown', e => {
  const pop = ['#cmdp','#mentp'].map(s => $(s)).find(p => p.classList.contains('show'));
  if(pop && ['ArrowDown','ArrowUp','Enter','Tab'].includes(e.key)){
    const its = $$('.it', pop); let i = its.findIndex(x => x.classList.contains('sel'));
    if(e.key==='ArrowDown'){ i = (i+1)%its.length; } else if(e.key==='ArrowUp'){ i = (i-1+its.length)%its.length; }
    else { e.preventDefault(); (its[i] || its[0])?.click(); return; }
    e.preventDefault(); its.forEach((x,k) => x.classList.toggle('sel', k===i)); its[i]?.scrollIntoView({block:'nearest'}); return;
  }
  if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); send(); }
  if(e.key==='Escape'){ if(state.replyTo || state.editing) cancelReply(); closePops(); }
  if(e.key==='ArrowUp' && !inp.value && state.cur){ const m = [...state.cur.msgs].reverse().find(x => isMe(x.by) && x.t && !x.assign && !x.quiz); if(m){ e.preventDefault(); startEdit(m); } }
});
const CMDS = [
  {k:'تکلیف', d:'ایجاد تکلیف جدید با مهلت', i:'📝', teacher:1, run:() => assignModal()},
  {k:'آزمونک', d:'ساخت نظرسنجی آموزشی', i:'📊', teacher:1, run:() => quizModal()},
  {k:'حضور', d:'حضور و غیاب سریع کلاس', i:'✅', teacher:1, run:() => sendAtt()},
  {k:'کلاس', d:'شروع کلاس آنلاین', i:'🎥', teacher:1, run:() => startLive()},
  {k:'رایوا', d:'پرسیدن از همیار هوشمند', i:'✦', run:() => { openChat('c3'); }},
  {k:'یادآوری', d:'یادآوری در پیام‌های ذخیره‌شده', i:'⏰', run:() => { const c9 = chats.find(c=>c.id==='c9'); pushMsg(c9, {by:'@me', t:'⏰ یادآوری: مرور درس «'+(state.cur?chatName(state.cur):'')+'»', ts:Date.now(), read:1}); toast('یادآوری در پیام‌های ذخیره‌شده ثبت شد','⏰'); }},
  {k:'استیکر', d:'ارسال استیکر تصادفی', i:'🦉', run:() => sendSticker(pick(STK))},
];
function popFromInput(){
  const v = inp.value, c = state.cur;
  if(v.startsWith('/') && !v.includes(' ')){
    const q = v.slice(1), list = CMDS.filter(x => (!x.teacher || canTeachUI()) && x.k.startsWith(q));
    const p = $('#cmdp');
    if(!list.length){ p.classList.remove('show'); return; }
    p.innerHTML = '<div class="ttl">فرمان‌ها</div>' + list.map((x,i) => `<div class="it ${i?'':'sel'}" data-k="${x.k}" style="animation-delay:${i*.03}s"><span style="font-size:19px;width:24px;text-align:center">${x.i}</span><span class="ltr" style="font-weight:800;color:var(--green)">/${x.k}</span><small>${x.d}</small>${x.teacher?'<span class="tbadge" style="font-size:9.5px;font-weight:800;padding:0 6px;border-radius:6px;background:color-mix(in srgb,var(--orange) 25%,transparent);color:#a4600f">معلم</span>':''}</div>`).join('');
    $$('.it', p).forEach(it => it.onclick = () => { inp.value = ''; autosize(); p.classList.remove('show'); CMDS.find(x => x.k===it.dataset.k).run(); });
    closePops('#cmdp'); p.classList.add('show'); return;
  }
  $('#cmdp').classList.remove('show');
  const at = v.match(/@([^\s@]*)$/);
  if(at && c && c.type==='class'){
    const q = at[1], list = c.members.filter(id => id!==meId() && P[id].name.includes(q));
    const p = $('#mentp');
    if(!list.length){ p.classList.remove('show'); return; }
    p.innerHTML = '<div class="ttl">نام بردن</div>' + list.map((id,i) => `<div class="it ${i?'':'sel'}" data-id="${id}" style="animation-delay:${i*.03}s">${avHTML(id,'xs')}<span>${esc(P[id].name)}</span><small>${P[id].role==='teacher'?'معلم':'دانش‌آموز'}</small></div>`).join('');
    $$('.it', p).forEach(it => it.onclick = () => { inp.value = v.replace(/@([^\s@]*)$/, '@'+P[it.dataset.id].name.replace(/\s/g,'_')+' '); autosize(); p.classList.remove('show'); inp.focus(); });
    closePops('#mentp'); p.classList.add('show'); return;
  }
  $('#mentp').classList.remove('show');
}

/* Emoji panel */
let epTab = 'e';
function renderEp(){
  const g = $('#epGrid'), set = epTab==='e' ? [...new Intl.Segmenter().segment(EMO)].map(s => s.segment).filter(s => s.trim()) : epTab==='s' ? STK : EDU;
  g.className = 'ep-grid' + (epTab==='s' ? ' stk' : '');
  g.innerHTML = set.map((x,i) => `<button style="animation:pop .4s var(--spring) ${Math.min(i,40)*.008}s both">${x}</button>`).join('');
  const b = $(`#epTabs button[data-t="${epTab}"]`), ind = $('#epInd');
  $$('#epTabs button').forEach(x => x.classList.toggle('active', x===b));
  ind.style.width = b.offsetWidth+'px'; ind.style.transform = `translateX(${b.offsetLeft - ind.offsetParent.clientWidth + b.offsetWidth + (ind.offsetParent.clientWidth - b.offsetWidth - b.offsetLeft)*0}px)`;
  ind.style.left = b.offsetLeft+'px'; ind.style.right = 'auto'; ind.style.transform = 'none';
}
$('#emoBtn').onclick = e => { e.stopPropagation(); const p = $('#emop'), s = !p.classList.contains('show'); closePops(); if(s){ p.classList.add('show'); renderEp(); } };
$('#epTabs').onclick = e => { const b = e.target.closest('button'); if(!b) return; epTab = b.dataset.t; renderEp(); };
$('#epGrid').onclick = e => {
  const b = e.target.closest('button'); if(!b) return;
  if(epTab==='s'){ sendSticker(b.textContent); $('#emop').classList.remove('show'); return; }
  const s = inp.selectionStart ?? inp.value.length; inp.value = inp.value.slice(0,s) + b.textContent + inp.value.slice(inp.selectionEnd ?? s); autosize();
  b.animate([{transform:'scale(1.5)'},{transform:'none'}],{duration:300, easing:'cubic-bezier(.34,1.56,.64,1)'});
};

/* Attach menu */
const SVGI = {
  doc:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v5h5M6 3h8l5 5v13H6z"/><path d="M9 13h6M9 17h4"/></svg>',
  img:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>',
  poll:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 20V10M12 20V4M19 20v-7"/></svg>',
  task:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="3"/><path d="m9 12 2 2 4-4"/></svg>',
  att:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 11l2 2 4-4"/></svg>',
  cam:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="14" height="12" rx="3"/><path d="m16 10 6-3v10l-6-3"/></svg>',
  spark:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 2.8a1 1 0 0 1 2 0l1 5.6a2 2 0 0 0 1.6 1.6l5.6 1a1 1 0 0 1 0 2l-5.6 1a2 2 0 0 0-1.6 1.6l-1 5.6a1 1 0 0 1-2 0l-1-5.6a2 2 0 0 0-1.6-1.6l-5.6-1a1 1 0 0 1 0-2l5.6-1A2 2 0 0 0 10 8.4z"/></svg>',
  smile:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/></svg>',
};
function attItems(){
  const T = canTeachUI(), cls = state.cur?.type==='class';
  const L = [];
  if(T && cls){
    L.push(['task','تکلیف جدید','#16866f',assignModal,1],['poll','آزمونک','#efa457',quizModal,1],['att','حضور و غیاب','#5aa9d6',sendAtt,1],['cam','کلاس آنلاین','#e2737b',startLive,1]);
  }
  if(T) L.push(['doc','جزوه / فایل','#8b7fd6',sendFile]);
  else L.push(['doc','فایل','#8b7fd6',sendFile]);
  L.push(['img','عکس','#2c7aa6',sendPhoto]);
  if(!T) L.push(['spark','پرسش از رایوا','#16866f',() => { const q = inp.value.trim(); openChat('c3'); if(q){ inp.value = q; autosize(); } }]);
  L.push(['smile','استیکر','#e6b55b',() => sendSticker(pick(STK))]);
  return L;
}
$('#attBtn').onclick = e => {
  e.stopPropagation(); const p = $('#attm'), s = !p.classList.contains('show'); closePops(); if(!s) return;
  const L = attItems();
  p.innerHTML = L.map(([ic,lb,col,,t],i) => `<div class="it" data-i="${i}" style="animation-delay:${i*.035}s"><span class="ai" style="background:${col}">${SVGI[ic]}</span>${lb}${t?'<span class="tbadge">معلم</span>':''}</div>`).join('');
  $$('.it', p).forEach(it => it.onclick = () => { p.classList.remove('show'); L[+it.dataset.i][3](); });
  p.classList.add('show');
};
document.addEventListener('click', e => {
  if(!e.target.closest('.pop,.emop,#attBtn,#emoBtn,.rbar')) closePops();
});

/* Smart reply chips */
function smartFor(c, m){
  if(!c || !canPost(c)) return [];
  if(c.saved) return ['📌 یادداشت جدید','✅ کارهای امروز'];
  const t = (m && (m.t||'')) || '';
  if(m?.assign) return state.role==='student' ? ['چشم خانم 🙏','سؤال دارم درباره تمرین','مهلت تا کِیه؟'] : ['یادآوری مهلت ⏰','آفرین به همه 👏'];
  if(m?.grade) return ['ممنون خانم 🙏','خیلی خوشحال شدم 😍'];
  if(/سلام/.test(t)) return ['سلام 👋','سلام، صبح بخیر 🌱'];
  if(/\?|؟/.test(t)) return ['بله ✅','نه، هنوز نه','الان بررسی می‌کنم'];
  if(canTeachUI() && c.type==='class') return ['آفرین بچه‌ها 👏','سؤالی هست؟','فردا مرور می‌کنیم 📚'];
  return ['👍','ممنون 🙏','باشه 😊'];
}
function setChips(list){
  const box = $('#chips');
  [...box.children].forEach(ch => { ch.classList.add('out'); setTimeout(() => ch.remove(), 300); });
  setTimeout(() => {
    list.forEach((t,i) => { const b = document.createElement('button'); b.className = 'chip'; b.style.animationDelay = (i*.06)+'s'; b.innerHTML = (i===0 && !state.cur?.bot ? '<span class="sp">✦</span>' : '') + esc(t); b.onclick = () => { inp.value = t; send(); }; box.appendChild(b); });
  }, list.length ? 200 : 0);
}

/* Reply / edit bar */
function startReply(m){
  state.editing = null; state.replyTo = m;
  $('#rbN').textContent = 'پاسخ به ' + (isMe(m.by) ? 'خودتان' : pname(m.by) || chatName(state.cur));
  $('#rbT').textContent = preview(m);
  $('#replybar').classList.add('show'); inp.focus();
}
function startEdit(m){
  state.replyTo = null; state.editing = m;
  $('#rbN').textContent = 'ویرایش پیام'; $('#rbT').textContent = m.t;
  $('#replybar').classList.add('show'); inp.value = m.t; autosize(); inp.focus();
}
function cancelReply(){ const had = state.editing; state.replyTo = null; state.editing = null; $('#replybar').classList.remove('show'); if(had){ inp.value=''; autosize(); } }
$('#rbX').onclick = cancelReply;

/* Voice recording (hold the mic button) */
let rec = null;
function startRecSim(e){
  if(inp.value.trim() || state.editing || !state.cur) return;
  const t0 = performance.now(), lv = $('#recL'); lv.innerHTML = '<i></i>'.repeat(18);
  sendb.classList.add('rec'); $('#recov').classList.add('show');
  rec = {t0, x0:e.clientX, cancel:false, raf:0};
  const tick = () => {
    const s = (performance.now()-t0)/1000, l = Math.abs(Math.sin(s*7))*.6 + Math.random()*.4;
    $('#recT').textContent = fa(`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}.${Math.floor(s*10%10)}`);
    $('#pl1').style.transform = `scale(${1+l*.55})`; $('#pl2').style.transform = `scale(${1+l*.95})`;
    const bars = $$('i', lv); bars.forEach((b,i) => b.style.height = (4 + Math.abs(Math.sin(s*9 + i*.7))*l*15) + 'px');
    rec.raf = requestAnimationFrame(tick);
  };
  tick();
}
function endRecSim(send_){
  if(!rec) return; cancelAnimationFrame(rec.raf);
  const dur = Math.max(1, Math.round((performance.now()-rec.t0)/1000));
  sendb.classList.remove('rec'); $('#recov').classList.remove('show'); $('#pl1').style.transform = $('#pl2').style.transform = '';
  sendb.style.translate = '';
  const ok = send_ && !rec.cancel && dur >= 1 && performance.now()-rec.t0 > 450; rec = null;
  if(ok){ pushOut({voice:{dur:Math.min(dur,59)}}); }
  else if(send_) toast('برای ضبط صدا دکمه را نگه دارید','🎙️');
}
let pressT = 0;
sendb.addEventListener('pointerdown', e => {
  if(sendb.classList.contains('txt')) return;
  sendb.setPointerCapture(e.pointerId); pressT = setTimeout(() => startRec(e), 160);
});
sendb.addEventListener('pointermove', e => {
  if(!rec) return; const dx = Math.max(0, e.clientX - rec.x0);
  sendb.style.translate = `${dx*.6}px 0`;
  if(dx > 120 && !rec.cancel){ rec.cancel = true; toast('ضبط لغو شد','🗑️'); endRec(false); }
});
sendb.addEventListener('pointerup', () => { clearTimeout(pressT); if(rec) endRec(true); else if(!sendb.classList.contains('txt')) toast('برای ضبط صدا دکمه را نگه دارید','🎙️'); });
sendb.addEventListener('click', () => { if(sendb.classList.contains('txt')) send(); });
