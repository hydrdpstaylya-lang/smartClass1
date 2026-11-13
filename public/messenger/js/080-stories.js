/* =========================================================
   Stories
   ========================================================= */
function storyInner(spec){
  if(spec.ai) return `<div style="background:conic-gradient(from 0deg,#8b7fd6,#65c7a8,#efa457,#8b7fd6)">✦</div>`;
  if(spec.p){ const p = P[spec.p]; return `<div style="background:${GR[p.g]}">${p.img?`<img src="${p.img}" alt="" onerror="this.remove()">`:p.name[0]}</div>`; }
  return `<div style="background:${GR[spec.g]}">${spec.sym}</div>`;
}
function renderStories(){
  const add = canTeachUI() ? `<div class="story add" id="addStory"><div class="story-ring"><div style="font-size:26px">+</div></div><b>${NET.on?'اعلان کلاس':'استوری کلاس'}</b></div>` : '';
  $('#stories').innerHTML = add + STORIES.map((s,i) => `<div class="story ${s.seen?'seen':''}" data-i="${i}" style="animation-delay:${.1+i*.07}s"><div class="story-ring">${storyInner(s.av)}</div><b>${s.who}</b></div>`).join('');
  $('#miniStories').innerHTML = STORIES.filter(s => !s.seen).slice(0,3).map(s => `<span style="background:${s.av.g!==undefined?GR[s.av.g]:(s.av.p?GR[P[s.av.p].g]:'#8b7fd6')}">${s.av.p&&P[s.av.p].img?`<img src="${P[s.av.p].img}" alt="">`:(s.av.ai?'✦':(s.av.sym||''))}</span>`).join('');
}
$('#stories').addEventListener('click', e => {
  if(e.target.closest('#addStory')){ openStoryMaker(); return; }
  const s = e.target.closest('.story'); if(s) openStory(+s.dataset.i);
});
let sv = null;
function openStory(i){
  const s = STORIES[i]; if(!s) return closeStory();
  const box = $('#sv');
  box.innerHTML = `<div class="sv-card">
    <div class="sv-bars">${s.slides.map(() => '<i><b></b></i>').join('')}</div>
    <div class="sv-who"><div class="av xs" style="overflow:hidden;border-radius:50%">${storyInner(s.av).replace('<div ','<div class="svav" ')}</div><b>${s.who}</b><small>همین حالا</small><button class="ibtn x" id="svX" style="color:#fff">${IC.close}</button></div>
    ${s.slides.map((sl,k) => `<div class="sv-slide" style="background:${sl.bg}"><span class="tag ltr">${sl.tag}</span><div class="em" style="font-size:84px">${sl.em}</div><h2>${sl.h}</h2><p>${sl.p}</p></div>`).join('')}
    <div class="sv-nav"><div data-d="1"></div><div data-d="-1"></div></div>
    <div class="sv-reply"><input placeholder="پاسخ به ${s.who}…"><button>❤️</button></div>
  </div>`;
  $$('.svav', box).forEach(d => { d.style.cssText += ';width:100%;height:100%;display:grid;place-items:center;color:#fff;font-weight:800'; });
  box.classList.add('show');
  if(sv) cancelAnimationFrame(sv.raf);
  sv = {i, k:0, t0:performance.now(), paused:false, pAt:0, n:s.slides.length};
  showSlide(0);
  sv.raf = requestAnimationFrame(svTick);
  $('#svX').onclick = e => { e.stopPropagation(); closeStory(); };
  const nav = $('.sv-nav', box);
  let downAt = 0;
  nav.onpointerdown = () => { downAt = performance.now(); sv.paused = true; sv.pAt = performance.now(); };
  nav.onpointerup = e => {
    const held = performance.now() - downAt; sv.t0 += performance.now() - sv.pAt; sv.paused = false;
    if(held < 250){ const d = +e.target.dataset.d; stepStory(d); }
  };
  const inp = $('.sv-reply input', box);
  inp.onfocus = () => { sv.paused = true; sv.pAt = performance.now(); };
  inp.onblur = () => { if(sv && sv.paused){ sv.t0 += performance.now()-sv.pAt; sv.paused=false; } };
  inp.onkeydown = e => { if(e.key==='Enter' && inp.value.trim()){ toast(`پاسخ برای ${s.who} فرستاده شد`,'💬'); closeStory(); } };
  $('.sv-reply button', box).onclick = e => { const r = e.currentTarget.getBoundingClientRect(); burst(r.left+r.width/2, r.top, ['❤️','💚','✨'], 14); };
}
function showSlide(k){
  const box = $('#sv'); sv.k = k; sv.t0 = performance.now();
  $$('.sv-slide', box).forEach((el,j) => el.classList.toggle('on', j===k));
  $$('.sv-bars i b', box).forEach((b,j) => b.style.width = j<k ? '100%' : '0%');
}
function stepStory(d){
  if(!sv) return;
  const k = sv.k + d;
  if(k < 0){ if(sv.i>0) openStory(sv.i-1); else showSlide(0); return; }
  if(k >= sv.n){ STORIES[sv.i].seen = true; if(sv.i+1 < STORIES.length) openStory(sv.i+1); else closeStory(); return; }
  showSlide(k);
}
function svTick(t){
  if(!sv) return;
  if(!sv.paused){
    const p = Math.min(1, (t - sv.t0) / 5200), b = $$('#sv .sv-bars i b')[sv.k];
    if(b) b.style.width = (p*100)+'%';
    if(p >= 1) stepStory(1);
  }
  if(sv) sv.raf = requestAnimationFrame(svTick);
}
function closeStory(){
  if(sv){ STORIES[sv.i].seen = true; cancelAnimationFrame(sv.raf); }
  sv = null; $('#sv').classList.remove('show'); renderStories();
}
$('#sv').addEventListener('click', e => { if(e.target.id==='sv') closeStory(); });
