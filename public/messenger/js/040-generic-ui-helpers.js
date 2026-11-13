/* =========================================================
   Generic UI helpers
   ========================================================= */
document.addEventListener('pointerdown', e => {
  const el = e.target.closest('.rp,.citem,.btn,.abtn,.pill-btn,.chip,.acard'); if(!el) return;
  if(getComputedStyle(el).position==='static') el.style.position='relative';
  el.style.overflow = el.style.overflow || 'hidden';
  const r = el.getBoundingClientRect(), s = Math.max(r.width, r.height)*2.2;
  const w = document.createElement('span'); w.className = 'rip';
  w.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX-r.left-s/2}px;top:${e.clientY-r.top-s/2}px`;
  el.appendChild(w); setTimeout(() => w.remove(), 700);
});
function toast(msg, ico='✓'){
  const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = `<span>${ico}</span>${msg}<span class="tb"></span>`;
  $('#toasts').appendChild(t); setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 360); }, 2800);
}
function avHTML(spec, cls=''){
  // spec: person id | {sym,g} | {ai} | chat
  if(typeof spec === 'string'){
    if(spec==='@me') spec = meId();
    const p = P[spec]; if(!p) return `<div class="av ${cls}"></div>`;
    if(p.ai) return `<div class="av ai ${cls}"></div>`;
    const ini = p.name.split(' ').map(w=>w[0]).slice(-2).join('‌');
    const img = p.img ? `<img src="${p.img}" alt="" onerror="this.remove()">` : '';
    return `<div class="av ${cls}" style="background:${GR[p.g]}">${img ? img : ini}${p.online && !cls.includes('noon') ? '<span class="on"></span>' : ''}</div>`;
  }
  if(spec.ai) return `<div class="av ai ${cls}"></div>`;
  if(spec.p) return avHTML(spec.p, cls);
  return `<div class="av sq ${cls}" style="background:${GR[spec.g]}">${spec.sym}</div>`;
}
function chatAv(c, cls=''){
  if(c.bot) return `<div class="av ai ${cls}"></div>`;
  if(c.saved) return `<div class="av ${cls}" style="background:${GR[0]}"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#fff" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></div>`;
  if(c.type==='personal') return avHTML(peer(c), cls);
  return avHTML({sym:c.sym, g:c.g}, cls);
}
const peer = c => c.members.find(x => x!==meId() && x!=='@me') || c.members[0];
const chatName = c => c.name || P[peer(c)].name;
const visibleChats = () => chats.filter(canSeeChatUI);
const lastMsg = c => c.msgs.filter(m => !m.sys).slice(-1)[0];
function preview(m){
  if(!m) return '';
  if(m.stk) return m.stk+' استیکر';
  if(m.voice) return '🎤 پیام صوتی';
  if(m.assign) return '📝 تکلیف: '+m.assign.title;
  if(m.quiz) return '📊 آزمونک: '+m.quiz.q;
  if(m.file) return '📄 '+m.file.name;
  if(m.grade) return '🏅 کارنامه: '+m.grade.subject;
  if(m.img) return '🖼️ '+(m.t||'عکس');
  if(m.att) return '✅ حضور و غیاب';
  return (m.t||'').replace(/\*\*/g,'');
}
function fmtText(t){
  return esc(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/(^|\s)@([\u0600-\u06FF‌]+(?:\s[\u0600-\u06FF‌]+)?)/g,'$1<span class="mn">@$2</span>');
}
