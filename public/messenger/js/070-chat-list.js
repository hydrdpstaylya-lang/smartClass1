/* =========================================================
   Chat list
   ========================================================= */
const TICK = r => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12.5 6 16l7-8"/>${r?'<path d="m10 15 1 1 7-8"/>':''}</svg>`;
function folderOk(c, f){ return f==='all' || c.type===f; }
function sortedChats(){
  return visibleChats().filter(c => folderOk(c, state.folder))
    .sort((a,b) => (b.pinned?1:0)-(a.pinned?1:0) || ((lastMsg(b)?.ts||0) - (lastMsg(a)?.ts||0)));
}
function ciHTML(c, i, anim){
  const m = lastMsg(c), active = state.cur===c;
  let pv;
  if(c.typing) pv = `<span class="ci-m typing">${c.type!=='personal' ? esc(pname(c.typing).split(' ')[0])+' ' : ''}در حال نوشتن<span class="tdots"><i></i><i></i><i></i></span></span>`;
  else if(c.draft && !active) pv = `<span class="ci-m"><span class="draft">پیش‌نویس: </span>${esc(c.draft)}</span>`;
  else {
    let who = '';
    if(m){
      if(isMe(m.by) && !c.saved && c.type!=='channel') who = '<b>شما: </b>';
      else if(c.type==='class' && m.by) who = `<b>${esc(pname(m.by).split(' ').slice(-1)[0])}: </b>`;
    }
    pv = `<span class="ci-m">${who}${esc(preview(m))}</span>`;
  }
  const tick = m && isMe(m.by) && !c.saved && c.type!=='channel' ? TICK(m.read) : '';
  const right = c.unread ? `${c.mention?'<span class="badge mention">@</span>':''}<span class="badge ${c.muted?'muted':''}">${fa(c.unread)}</span>` : (c.pinned ? IC.pin : '');
  const chip = c.type==='class' ? '<span class="chip-class">کلاس</span>' : '';
  return `<div class="citem ${active?'active':''} ${anim?'in':''}" data-id="${c.id}" style="animation-delay:${i*0.045}s">
    ${chatAv(c)}
    <div class="ci-b">
      <div class="ci-r"><span class="ci-n">${esc(chatName(c))}${c.verified?IC.vf:''}${chip}${c.muted?IC.mute:''}</span><span class="ci-t">${tick}${m?listTime(m.ts):''}</span></div>
      <div class="ci-r">${pv}<span class="ci-ic">${right}</span></div>
    </div></div>`;
}
function renderList(anim=false){
  const list = $('#clist'), arr = sortedChats();
  list.innerHTML = arr.length ? arr.map((c,i) => ciHTML(c,i,anim)).join('')
    : `<div style="text-align:center;color:var(--muted);padding:60px 20px;animation:fadeUp .5s both"><div style="font-size:54px;margin-bottom:8px">🗂️</div>گفتگویی در این پوشه نیست</div>`;
  if(!anim) $$('.badge,.av .on', list).forEach(b => b.style.animation = 'none');
  ['all','class','personal','channel'].forEach(f => {
    const n = visibleChats().filter(c => folderOk(c,f) && c.unread).length, el = $('#fn-'+f);
    el.textContent = fa(n); el.style.display = n ? 'grid' : 'none';
  });
  const tot = visibleChats().filter(c => c.unread && !c.muted).length;
  $('#railUnread').style.display = tot ? 'grid' : 'none'; $('#railUnread').textContent = fa(tot);
  document.title = (tot ? `(${fa(tot)}) ` : '') + 'SmartClass | گفتگوی کلاس';
}
function flipRender(bumpId){
  const list = $('#clist'), first = {};
  $$('.citem', list).forEach(el => first[el.dataset.id] = el.getBoundingClientRect().top);
  renderList(false);
  $$('.citem', list).forEach(el => {
    const f = first[el.dataset.id], now = el.getBoundingClientRect().top;
    if(f===undefined){ el.animate([{opacity:0,transform:'scale(.92)'},{opacity:1,transform:'none'}],{duration:420,easing:'cubic-bezier(.22,.8,.2,1)'}); return; }
    const d = f - now;
    if(Math.abs(d) > 1) el.animate([{transform:`translateY(${d}px)`},{transform:'none'}],{duration:560,easing:'cubic-bezier(.22,.8,.2,1)'});
    if(el.dataset.id===bumpId){ const b = $('.badge:not(.mention)', el); if(b){ b.style.animation=''; b.classList.add('bump'); } }
  });
}
function skeleton(){
  $('#clist').innerHTML = Array.from({length:8}, (_,i) => `<div class="skel" style="opacity:${1-i*.09}"><i class="shim" style="width:54px;height:54px;border-radius:50%;flex-shrink:0"></i><div style="flex:1"><i class="shim" style="height:12px;width:${rnd(38,62)}%;border-radius:6px;margin-bottom:9px"></i><i class="shim" style="height:10px;width:${rnd(60,88)}%;border-radius:6px"></i></div></div>`).join('');
}
$('#clist').addEventListener('click', e => { const it = e.target.closest('.citem'); if(it) openChat(it.dataset.id); });

/* list spotlight hover (pointer-follow glow) */
$('#clist').addEventListener('pointermove', e => {
  const it = e.target.closest('.citem'); if(!it) return;
  const r = it.getBoundingClientRect();
  it.style.setProperty('--mx', (e.clientX - r.left)+'px'); it.style.setProperty('--my', (e.clientY - r.top)+'px');
});

/* collapse stories + hide FAB on scroll */
let lastSc = 0;
$('#clist').addEventListener('scroll', function(){
  $('#listCol').classList.toggle('collapsed', this.scrollTop > 24);
  $('#fab').classList.toggle('hide', this.scrollTop > lastSc && this.scrollTop > 60);
  lastSc = this.scrollTop;
});
$('#miniStories').addEventListener('click', () => { $('#clist').scrollTo({top:0, behavior:'smooth'}); });

/* Folders */
function moveFold(){
  const a = $('.fold.active'), ind = $('#foldInd'); if(!a) return;
  ind.style.width = a.offsetWidth+'px'; ind.style.transform = `translateX(${a.offsetLeft}px)`;
}
function setFolder(f){
  state.folder = f;
  $$('.fold').forEach(x => x.classList.toggle('active', x.dataset.f===f));
  moveFold(); renderList(true);
  const rb = $(`#railNav .rbtn[data-r="${f==='class'?'classes':'chats'}"]`);
  if(rb && !rb.classList.contains('active') && !$('#tasks').classList.contains('show')){ $$('#railNav .rbtn').forEach(x => x.classList.toggle('active', x===rb)); moveRail(rb); }
}
$('#folders').addEventListener('click', e => { const f = e.target.closest('.fold'); if(f) setFolder(f.dataset.f); });
