/* =========================================================
   Rail
   ========================================================= */
function moveRail(btn){
  const ind = $('#railInd'), nav = $('#railNav');
  if(innerWidth<=900){ ind.style.transform = `translateX(${btn.offsetLeft - (nav.offsetWidth - 58)}px)`; ind.style.right='0'; }
  else ind.style.transform = `translateY(${btn.offsetTop}px)`;
}
$('#railNav').addEventListener('click', e => {
  const b = e.target.closest('.rbtn'); if(!b) return;
  $$('#railNav .rbtn').forEach(x => x.classList.toggle('active', x===b)); moveRail(b);
  const r = b.dataset.r;
  closeTasks();
  if(r==='chats') setFolder('all');
  if(r==='classes') setFolder('class');
  if(r==='tasks') openTasks();
  if(r==='ai') openChat('c3');
});
addEventListener('resize', () => { moveRail($('#railNav .rbtn.active')); moveFold(); });
function renderRole(){
  const p = P[meId()];
  $('#roleBtn').innerHTML = avHTML(meId(),'noon').replace('class="av','class="av').replace(/<span class="on"><\/span>/,'') + `<span class="rtag">${state.role==='teacher'?'معلم':'دانش‌آموز'}</span>`;
  $('#roleBtn').title = `${p.name} — برای تغییر نقش کلیک کنید`;
}

/* Focus mode */
$('#focusBtn').addEventListener('click', () => {
  state.focus = !state.focus; $('#focusBtn').classList.toggle('focus-on', state.focus);
  if(!state.focus && state.focusMissed){ toast(`${fa(state.focusMissed)} پیام در حالت تمرکز دریافت شد`,'🌙'); state.focusMissed=0; $('#focusDot').style.display='none'; }
  else toast(state.focus ? 'حالت تمرکز روشن شد؛ اعلان‌ها بی‌صدا هستند' : 'حالت تمرکز خاموش شد', state.focus?'🌙':'🔔');
});

/* Theme circular reveal */
$('#themeBtn').addEventListener('click', e => {
  const dark = document.documentElement.dataset.theme !== 'dark';
  const x = e.clientX, y = e.clientY, R = Math.hypot(Math.max(x, innerWidth-x), Math.max(y, innerHeight-y));
  const apply = () => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; state.theme = dark?'dark':'light'; };
  if(!document.startViewTransition){ apply(); return; }
  document.startViewTransition(apply).ready.then(() => {
    document.documentElement.animate({clipPath:[`circle(0 at ${x}px ${y}px)`,`circle(${R}px at ${x}px ${y}px)`]},{duration:750,easing:'cubic-bezier(.65,0,.35,1)',pseudoElement:'::view-transition-new(root)'});
  });
});

/* Role switch with wave */
$('#roleBtn').addEventListener('click', async e => {
  const to = state.role==='student' ? 'teacher' : 'student';
  const w = $('#rolewave'), c = $('.c', w), t = $('.t', w), r = e.currentTarget.getBoundingClientRect();
  const cx = r.left + r.width/2, cy = r.top + r.height/2, R = Math.hypot(Math.max(cx, innerWidth-cx), Math.max(cy, innerHeight-cy))/20 + 2;
  c.style.left = (cx-20)+'px'; c.style.top = (cy-20)+'px';
  t.innerHTML = `<b>${to==='teacher'?'حالت معلم':'حالت دانش‌آموز'}</b><small>${esc(P[ROLE_ID(to)].name)} · ${esc(P[ROLE_ID(to)].title||'')}</small>`;
  w.style.pointerEvents='auto';
  const A=[]; const a1=c.animate([{transform:'scale(0)'},{transform:`scale(${R})`}],{duration:650,easing:'cubic-bezier(.65,0,.35,1)',fill:'forwards'}); A.push(a1); await a1.finished;
  A.push(t.animate([{opacity:0,transform:'translateY(20px)'},{opacity:1,transform:'none'}],{duration:400,easing:'cubic-bezier(.22,.8,.2,1)',fill:'forwards'}));
  saveUnread(); state.role = to; sessionStorage.setItem('sc_role', to); loadUnread(); state.cur = null; closeInfo(); closeTasks();
  renderRole(); renderList(true); renderStories(); showEmpty();
  await sleep(750);
  A.push(t.animate([{opacity:1},{opacity:0,transform:'translateY(-14px)'}],{duration:300,fill:'forwards'}));
  const a4=c.animate([{transform:`scale(${R})`, opacity:1},{transform:`scale(${R})`, opacity:0}],{duration:450,fill:'forwards'}); A.push(a4); await a4.finished;
  A.forEach(a=>a.cancel()); t.style.opacity=0; w.style.pointerEvents='none';
  toast(to==='teacher' ? 'اکنون با نقش معلم وارد شدید؛ ابزارهای کلاس فعال شد' : 'اکنون با نقش دانش‌آموز وارد شدید', to==='teacher'?'🎓':'🎒');
  updateTaskDot();
});
