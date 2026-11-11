/* =========================================================
   Message interactions (delegated)
   ========================================================= */
msgsEl.addEventListener('click', e => {
  const row = e.target.closest('.row'), m = row && row._m, c = state.cur;
  const go = e.target.closest('.rq[data-go]'); if(go){ jumpTo(go.dataset.go); return; }
  const rc = e.target.closest('.rc'); if(rc && m){ toggleReact(row, rc.dataset.e); return; }
  const mn = e.target.closest('.mn'); if(mn){ toast(`پروفایل ${mn.textContent.slice(1)}`,'👤'); return; }
  if(!m) return;
  const ab = e.target.closest('.abtn');
  if(ab && ab.dataset.act==='submit') return submitAssign(row, m, ab);
  if(ab && ab.dataset.act==='att') return finishAtt(row, m);
  const tg = e.target.closest('.tg'); if(tg && !tg.classList.contains('ro')){ tg.classList.toggle('on'); m.att.list[tg.dataset.s] = tg.classList.contains('on'); return; }
  const qo = e.target.closest('.quiz-o'); if(qo) return answerQuiz(row, m, +qo.dataset.i, qo);
  const fic = e.target.closest('.fic'); if(fic) return downloadFile(row, m, fic);
  const vp = e.target.closest('.vplay'); if(vp) return playVoice(row, m, vp);
  const sp = e.target.closest('.vt .sp'); if(sp){ const s = ['۱×','۱٫۵×','۲×'], i = (s.indexOf(sp.textContent)+1)%3; sp.textContent = s[i]; sp.animate([{transform:'scale(1.3)'},{transform:'none'}],{duration:300}); return; }
  const wv = e.target.closest('.wave'); if(wv){ const r = wv.getBoundingClientRect(), k = (r.right - e.clientX)/r.width; const bars = $$('i', wv); bars.forEach((x,i) => x.classList.toggle('on', i < bars.length*k)); return; }
  const im = e.target.closest('.ph img'); if(im) return lightbox(im);
});

function submitAssignAnim(row, m, ab){
  const a = m.assign; if(a.subs.includes(meId()) || ab.classList.contains('loading')) return;
  ab.style.width = ab.offsetWidth+'px'; void ab.offsetWidth;
  ab.classList.add('loading');
  const c = $('.prog circle', ab);
  c.animate([{strokeDashoffset:94.2},{strokeDashoffset:0}],{duration:1600, easing:'cubic-bezier(.65,0,.35,1)', fill:'forwards'}).finished.then(() => {
    a.subs.push(meId());
    ab.classList.remove('loading'); ab.classList.add('done'); ab.style.width = '';
    $('.albl', ab).innerHTML = IC.check+' تحویل شد';
    const r = ab.getBoundingClientRect(); confetti(r.left + r.width/2, r.top, 110);
    toast('تکلیف با موفقیت تحویل داده شد · +۲۰ امتیاز یادگیری','🎉');
    setTimeout(() => refreshRow(m), 700);
    updateTaskDot();
  });
}
function answerQuiz(row, m, i, el){
  const q = m.quiz; if(state.role==='teacher' || isMe(m.by) || q.voted[meId()]!==undefined) return;
  q.voted[meId()] = i; q.votes[i]++;
  const r = el.getBoundingClientRect();
  if(i===q.correct){ confetti(r.left + r.width/2, r.top + r.height/2, 120); navigator.vibrate && navigator.vibrate(20); }
  else navigator.vibrate && navigator.vibrate([30,40,30]);
  const bub = $('.bub', row), tot = q.votes.reduce((a,b) => a+b, 0);
  bub.classList.add('done');
  $$('.quiz-o', bub).forEach((o,k) => {
    if(k===q.correct) o.classList.add('right'); else if(k===i) o.classList.add('wrong');
    const p = Math.round(q.votes[k]/tot*100), f = $('.fill', o), pc = $('.pc', o);
    f.style.transition = 'width .9s cubic-bezier(.22,.8,.2,1)'; requestAnimationFrame(() => f.style.width = p+'%');
    const t0 = performance.now(); const st = t => { const kk = Math.min(1,(t-t0)/900); pc.textContent = fa(Math.round(p*(1-Math.pow(1-kk,3))))+'٪'; if(kk<1) requestAnimationFrame(st); }; requestAnimationFrame(st);
  });
  $('.qn', bub).textContent = `آزمونک · ${fa(tot)} پاسخ`;
  $('.quiz-r', bub).innerHTML = i===q.correct ? '<span class="ok" style="color:var(--green);font-weight:700">آفرین! پاسخ درست بود 🎉 +۱۰ امتیاز</span>' : `<span class="no" style="color:var(--danger);font-weight:600">پاسخ درست «${esc(q.opts[q.correct])}» است؛ اشتباه هم بخشی از کشف است 🌱</span>`;
}
function downloadFileSim(row, m, fic){
  if(m.file.ok){ toast(`در حال باز کردن «${m.file.name}»…`,'📄'); return; }
  if(fic.classList.contains('dl')) return;
  fic.classList.add('dl');
  const ring = $('.fring circle', fic), sm = $('.fn small', row), total = parseFloat(en(m.file.size).replace('٫','.')) || 2.4;
  const t0 = performance.now(), D = 1900;
  const st = t => {
    const k = Math.min(1, (t-t0)/D), e = k<.5 ? 2*k*k : 1-Math.pow(-2*k+2,2)/2;
    ring.style.strokeDashoffset = 157*(1-e);
    sm.textContent = `${fa((total*e).toFixed(1))} از ${m.file.size}`;
    if(k<1) requestAnimationFrame(st);
    else { m.file.ok = true; fic.classList.remove('dl'); fic.classList.add('ok'); fic.innerHTML = IC.doc + '<svg class="fring" viewBox="0 0 54 54"><circle cx="27" cy="27" r="25"/></svg>'; fic.animate([{transform:'scale(.6) rotate(-20deg)'},{transform:'none'}],{duration:500, easing:'cubic-bezier(.34,1.56,.64,1)'}); sm.textContent = 'دانلود شد · برای باز کردن بزنید'; }
  };
  requestAnimationFrame(st);
}
let playing = null;
function playVoiceSim(row, m, btn){
  const bars = $$('.wave i', row), vd = $('.vd', row), sp = $('.vt .sp', row);
  if(playing && playing.btn===btn){ clearInterval(playing.t); playing = null; btn.innerHTML = IC.play; return; }
  if(playing){ clearInterval(playing.t); playing.btn.innerHTML = IC.play; }
  btn.innerHTML = IC.pause;
  let i = bars.findIndex(x => !x.classList.contains('on')); if(i < 0){ bars.forEach(x => x.classList.remove('on')); i = 0; }
  const dur = m.voice.dur;
  playing = {btn, t: setInterval(() => {
    const speed = sp.textContent==='۲×' ? 2 : sp.textContent==='۱٫۵×' ? 1.5 : 1;
    bars.forEach(x => x.classList.remove('cur'));
    if(i >= bars.length){ clearInterval(playing.t); playing = null; btn.innerHTML = IC.play; vd.textContent = fa('0:'+String(dur).padStart(2,'0')); setTimeout(() => bars.forEach(x => x.classList.remove('on')), 500); return; }
    bars[i].classList.add('on','cur'); i += speed >= 2 ? 2 : 1;
    const left = Math.max(0, Math.round(dur*(1-i/bars.length))); vd.textContent = fa('0:'+String(left).padStart(2,'0'));
  }, (dur*1000)/bars.length / (sp.textContent==='۲×'?1:sp.textContent==='۱٫۵×'?1.5:1))};
}
function finishAtt(row, m){
  m.att.done = true; refreshRow(m);
  const on = Object.values(m.att.list).filter(Boolean).length;
  toast(`حضور و غیاب ثبت شد · ${fa(on)} حاضر`,'✅');
  const r = rowOf(m.id).getBoundingClientRect(); confetti(r.left + r.width/2, r.top + 40, 60, .7);
}

/* Lightbox with FLIP zoom */
function lightbox(img){
  const r = img.getBoundingClientRect(), lb = $('#lb');
  lb.innerHTML = `<img src="${img.src}" alt="">`;
  const im = $('img', lb), ar = img.naturalWidth/img.naturalHeight || 1.6;
  let w = Math.min(innerWidth*.92, 1100), h = w/ar; if(h > innerHeight*.86){ h = innerHeight*.86; w = h*ar; }
  const to = {left:(innerWidth-w)/2, top:(innerHeight-h)/2, width:w, height:h};
  Object.assign(im.style, {left:r.left+'px', top:r.top+'px', width:r.width+'px', height:r.height+'px', borderRadius:'14px'});
  lb.style.background = 'rgba(8,20,18,0)'; lb.style.transition = 'background .4s'; lb.classList.add('show');
  requestAnimationFrame(() => { lb.style.background = 'rgba(8,20,18,.86)'; });
  im.animate([{left:r.left+'px', top:r.top+'px', width:r.width+'px', height:r.height+'px'},{left:to.left+'px', top:to.top+'px', width:to.width+'px', height:to.height+'px'}],{duration:480, easing:'cubic-bezier(.22,.8,.2,1)', fill:'forwards'});
  lb.onclick = () => {
    const r2 = img.getBoundingClientRect(); lb.style.background = 'rgba(8,20,18,0)';
    im.animate([{left:to.left+'px', top:to.top+'px', width:to.width+'px', height:to.height+'px'},{left:r2.left+'px', top:r2.top+'px', width:r2.width+'px', height:r2.height+'px'}],{duration:380, easing:'cubic-bezier(.22,.8,.2,1)', fill:'forwards'}).finished.then(() => { lb.classList.remove('show'); lb.innerHTML=''; });
  };
}

/* Reactions */
function toggleReact(row, emo){
  const m = row._m; m.react ||= {}; m.my ||= [];
  const had = m.my.includes(emo);
  if(had){ m.my = m.my.filter(x => x!==emo); m.react[emo] = (m.react[emo]||1) - 1; }
  else { m.my.push(emo); m.react[emo] = (m.react[emo]||0) + 1; }
  const bub = $('.bub', row), old = $('.reacts', bub); if(old) old.remove();
  bub.insertAdjacentHTML('beforeend', reactsHTML(m, had ? null : emo));
  if(!had){ const rc = $(`.rc[data-e="${emo}"]`, bub); if(rc) setTimeout(() => { const q = rc.getBoundingClientRect(); burst(q.left + q.width/2, q.top + q.height/2, [emo,'✨',emo], 12); }, 80); }
}

/* Scroll-to-bottom */
let sdCount = 0;
msgsEl.addEventListener('scroll', () => {
  const far = msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight > 260;
  $('#sdown').classList.toggle('show', far);
  if(!far){ sdCount = 0; $('#sdBadge').style.display = 'none'; }
});
$('#sdown').onclick = () => msgsEl.scrollTo({top:msgsEl.scrollHeight, behavior:'smooth'});
const nearBottom = () => msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight < 260;
const toBottom = () => msgsEl.scrollTo({top:msgsEl.scrollHeight, behavior:'smooth'});
msgsEl._stick = true;
msgsEl.addEventListener('scroll', () => { msgsEl._stick = msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight < 60; });
msgsEl.addEventListener('load', e => { if(e.target.tagName==='IMG' && msgsEl._stick) msgsEl.scrollTop = msgsEl.scrollHeight; }, true);
