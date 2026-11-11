/* =========================================================
   Chat open / header
   ========================================================= */
const msgsEl = $('#msgs'), inp = $('#inp'), sendb = $('#sendb');
function showEmpty(){
  $('#chat').classList.remove('show'); $('#empty').classList.remove('hide'); $('#stage').classList.remove('open');
  $('#emptyH').textContent = state.role==='teacher' ? 'کلاس منتظر شماست.' : 'یک گفتگو، هزار کشف.';
}
function stText(c){
  if(c.typing) return {t:(c.type!=='personal' ? pname(c.typing)+' ' : '')+'در حال نوشتن…', hl:1, dots:1};
  if(c.bot) return {t:'همیار هوشمند یادگیری · همیشه آنلاین', hl:1};
  if(c.saved) return {t:'فضای شخصی تو'};
  if(c.type==='channel') return {t:fa(c.id==='c4'?312:184)+' مشترک'};
  if(c.type==='class'){ const on = c.members.filter(x => P[x]?.online).length; return {t:`${fa(c.members.length)} عضو، ${fa(on)} آنلاین`}; }
  const p = P[peer(c)];
  return p.online ? {t:'آنلاین'+(p.role==='teacher'?' · '+p.title:''), hl:1} : {t:'آخرین بازدید به‌تازگی'};
}
function setSt(c, anim=true){
  const box = $('#chSt'), s = stText(c), html = esc(s.t) + (s.dots ? '<span class="tdots"><i></i><i></i><i></i></span>' : '');
  const old = $('span', box);
  if(old && old.innerHTML===html) return;
  box.classList.toggle('hl', !!s.hl);
  if(!anim || !old){ box.innerHTML = `<span>${html}</span>`; return; }
  const n = document.createElement('span'); n.innerHTML = html;
  n.style.cssText = 'position:absolute;top:0;right:0;transform:translateY(100%);opacity:0;transition:transform .4s cubic-bezier(.22,.8,.2,1),opacity .3s';
  old.style.transition = 'transform .4s cubic-bezier(.22,.8,.2,1),opacity .3s';
  box.appendChild(n);
  requestAnimationFrame(() => requestAnimationFrame(() => { n.style.transform='none'; n.style.opacity=1; old.style.transform='translateY(-100%)'; old.style.opacity=0; }));
  setTimeout(() => { old.remove(); n.style.position=''; }, 420);
}
function shiftWall(){ $$('.wall .bl').forEach(b => b.style.transform = `translate(${rnd(-22,22)}%,${rnd(-22,22)}%) scale(${rnd(.85,1.2)})`); }
function canPost(c){ return !(c.type==='channel' && c.admin!==state.role); }

function openChat(id, focusId){
  const c = chats.find(x => x.id===id); if(!c || !c.vis.includes(state.role)) return;
  const prev = state.cur;
  if(prev && prev!==c){ prev.draft = inp.value.trim(); }
  closePops(); cancelReply(); closeSum();
  state.cur = c; c.unread = 0; c.mention = false;
  $('#empty').classList.add('hide'); $('#chat').classList.add('show'); $('#stage').classList.add('open');
  if(prev!==c){
    const old = $('#chAv'); old.insertAdjacentHTML('afterend', chatAv(c,'sm').replace('class="av', 'id="chAv" class="av')); old.remove();
    $('#chName').innerHTML = esc(chatName(c)) + (c.verified ? IC.vf : '');
    setSt(c, false);
    $('#chWho').animate([{opacity:0, transform:'translateX(-14px)'},{opacity:1, transform:'none'}],{duration:420, easing:'cubic-bezier(.22,.8,.2,1)'});
    $('#sumBtn').style.display = c.type==='class' ? 'flex' : 'none';
    $('#livebar').classList.toggle('show', !!c.live);
    $('#liveSub').textContent = c.id==='c1' && P.t_sadeghi ? `${pname('t_sadeghi')} و ${fa(4)} دانش‌آموز · ریاضی` : 'کلاس آنلاین';
    updatePin(c);
    $('#chat').classList.toggle('ro', !canPost(c));
    $('#muteCh').textContent = c.muted ? '🔕 روشن کردن اعلان‌ها' : '🔔 بی‌صدا کردن کانال';
    inp.value = c.draft || ''; c.draft = ''; autosize();
    inp.placeholder = c.bot ? 'از رایوا بپرس… (مثلاً ۱۲ × ۸)' : c.type==='class' ? (state.role==='teacher' ? 'پیام به کلاس… ( / برای فرمان‌ها )' : 'پیام به کلاس… ( @ برای نام بردن )') : 'پیام…';
    renderMsgs(c);
    shiftWall();
    const lastIn = c.msgs.filter(m => !m.sys && !isMe(m.by)).slice(-1)[0];
    setChips(c.bot ? ['۱۲ × ۸ چند میشه؟','فتوسنتز چیه؟','چه تکلیفی دارم؟','کسر را با مثال بگو'] : smartFor(c, lastIn));
    if($('#info').classList.contains('show')) renderInfo();
  }
  if(focusId) setTimeout(() => jumpTo(focusId), 350);
  flipRender();
  if(innerWidth > 900 && canPost(c)) setTimeout(() => inp.focus({preventScroll:true}), 250);
}
$('#back').onclick = () => { $('#stage').classList.remove('open'); closePops(); };
function updatePin(c){
  const m = c.pinnedMsg && c.msgs.find(x => x.id===c.pinnedMsg);
  $('#pinbar').classList.toggle('show', !!m);
  if(m){ $('#pinTxt').textContent = preview(m); $('#pinTxt').animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{duration:350,easing:'ease-out'}); }
}
$('#pinbar').onclick = () => state.cur && jumpTo(state.cur.pinnedMsg);
