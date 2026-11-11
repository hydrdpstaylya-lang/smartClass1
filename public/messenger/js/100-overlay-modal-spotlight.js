/* =========================================================
   Overlay (modal / spotlight)
   ========================================================= */
function openOvl(html){ const o = $('#ovl'); o.innerHTML = html; requestAnimationFrame(() => o.classList.add('show')); return o; }
function closeOvl(){ const o = $('#ovl'); o.classList.remove('show'); setTimeout(() => { if(!o.classList.contains('show')) o.innerHTML=''; }, 450); }
$('#ovl').addEventListener('click', e => { if(e.target.id==='ovl') closeOvl(); });

/* Spotlight search (Ctrl+K) */
const QUICK = [
  {ic:'🌗', t:'تغییر تم روشن / تیره', run:() => $('#themeBtn').click()},
  {ic:'🌙', t:'حالت تمرکز', run:() => $('#focusBtn').click()},
  {ic:'📝', t:'تکالیف و مهلت‌ها', run:() => $('#railNav .rbtn[data-r="tasks"]').click()},
  {ic:'✦', t:'پرسش از رایوا', run:() => openChat('c3')},
  {ic:'🔁', t:'تغییر نقش معلم / دانش‌آموز', run:() => $('#roleBtn').click()},
];
function openSpot(q=''){
  openOvl(`<div class="spot"><div class="spot-in">${'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>'}<input id="spotIn" placeholder="جستجوی گفتگو، پیام، تکلیف…" autocomplete="off"><span class="kbd">Esc</span></div><div class="spot-r" id="spotR"></div><div class="spot-f"><span><span class="kbd">↑↓</span> حرکت</span><span><span class="kbd">Enter</span> باز کردن</span><span><span class="kbd">Esc</span> بستن</span></div></div>`);
  const inp = $('#spotIn'); inp.value = q; setTimeout(() => inp.focus(), 60);
  let sel = 0, items = [];
  const hl = (s, q) => q ? esc(s).replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'), m => `<mark>${m}</mark>`) : esc(s);
  const draw = () => {
    const v = inp.value.trim(); items = []; let html = '';
    if(!v){
      html += '<div class="spot-h">میان‌برها</div>';
      QUICK.forEach(x => { items.push(x.run); html += `<div class="sr" style="animation-delay:${items.length*.03}s"><div class="av xs sq" style="background:var(--soft);color:var(--green);font-size:15px">${x.ic}</div><div class="sb"><b>${x.t}</b></div><span class="go">↵</span></div>`; });
    } else {
      const cs = visibleChats().filter(c => chatName(c).includes(v));
      if(cs.length){ html += '<div class="spot-h">گفتگوها</div>'; cs.forEach(c => { items.push(() => openChat(c.id)); html += `<div class="sr" style="animation-delay:${items.length*.03}s">${chatAv(c,'xs')}<div class="sb"><b>${hl(chatName(c),v)}</b><small>${esc(preview(lastMsg(c)))}</small></div><span class="go">↵</span></div>`; }); }
      const ms = []; visibleChats().forEach(c => c.msgs.forEach(m => { const p = preview(m); if(!m.sys && p.includes(v)) ms.push({c,m,p}); }));
      if(ms.length){ html += '<div class="spot-h">پیام‌ها</div>'; ms.slice(0,12).forEach(x => { items.push(() => openChat(x.c.id, x.m.id)); html += `<div class="sr" style="animation-delay:${items.length*.03}s">${avHTML(x.m.by==='@me'?meId():x.m.by,'xs noon')}<div class="sb"><b>${esc(chatName(x.c))} <small style="display:inline;color:var(--muted)">· ${listTime(x.m.ts)}</small></b><small>${hl(x.p,v)}</small></div><span class="go">↵</span></div>`; }); }
      if(!items.length) html = `<div style="text-align:center;padding:34px;color:var(--muted)"><div style="font-size:40px">🔍</div>نتیجه‌ای برای «${esc(v)}» پیدا نشد</div>`;
    }
    $('#spotR').innerHTML = html; sel = 0; mark();
  };
  const mark = () => $$('#spotR .sr').forEach((el,i) => el.classList.toggle('sel', i===sel));
  inp.oninput = draw;
  inp.onkeydown = e => {
    if(e.key==='ArrowDown'){ e.preventDefault(); sel = Math.min(items.length-1, sel+1); mark(); $$('#spotR .sr')[sel]?.scrollIntoView({block:'nearest'}); }
    if(e.key==='ArrowUp'){ e.preventDefault(); sel = Math.max(0, sel-1); mark(); $$('#spotR .sr')[sel]?.scrollIntoView({block:'nearest'}); }
    if(e.key==='Enter' && items[sel]){ closeOvl(); items[sel](); }
  };
  $('#spotR').onclick = e => { const r = e.target.closest('.sr'); if(!r) return; const i = $$('#spotR .sr').indexOf(r); closeOvl(); items[i] && items[i](); };
  draw();
}
$('#openSpot').onclick = () => openSpot();
$('#newBtnTop').onclick = () => openSpot();
$('#fab').onclick = () => openSpot();
