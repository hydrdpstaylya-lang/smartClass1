/* =========================================================
   Message rendering
   ========================================================= */
function renderMsgs(c){
  msgsEl.style.scrollBehavior = 'auto'; msgsEl.innerHTML = '';
  const n = c.msgs.length;
  c.msgs.forEach((m,i) => appendMsg(m, c, {anim: n-i <= 10, delay: Math.max(0, (i-(n-10)))*0.045}));
  msgsEl.scrollTop = msgsEl.scrollHeight; msgsEl.style.scrollBehavior = '';
  $('#sdown').classList.remove('show'); sdCount = 0; $('#sdBadge').style.display='none';
}
function lastRow(){ const r = [...msgsEl.children].reverse().find(x => x.classList.contains('row') || x.classList.contains('sysmsg') || x.classList.contains('dchip')); return r; }
function metaHTML(m, c, out){
  const eye = m.views ? `<span class="eye">${IC.eye}${fa(m.views)}</span>` : '';
  const ed = m.edited ? '<span class="edited">ویرایش‌شده</span>' : '';
  const st = out ? (m.pending ? IC.clk : (m.read ? IC.ck.replace('class="ck"','class="ck read"') : IC.ck)) : '';
  return `<span class="meta">${eye}${ed}${tfmt(m.ts)}${st}</span>`;
}
function whoHTML(id){
  const p = P[id]; if(!p) return '';
  return `<div class="who" style="color:${p.color}">${esc(p.name)}${p.role==='teacher'?'<span class="role">معلم</span>':''}</div>`;
}
function ringSVG(r, cls='pr'){ const C = (2*Math.PI*r).toFixed(1); return `<svg viewBox="0 0 ${r*2+6} ${r*2+6}"><circle class="tr" cx="${r+3}" cy="${r+3}" r="${r}"/><circle class="${cls}" cx="${r+3}" cy="${r+3}" r="${r}" stroke-dasharray="${C}" stroke-dashoffset="${C}"/></svg>`; }

function bodyHTML(m, c, out, showWho){
  const who = showWho ? whoHTML(m.by) : '';
  const meta = metaHTML(m, c, out);
  let rq = '';
  if(m.reply){ const r = c.msgs.find(x => x.id===m.reply) || chats.flatMap(x=>x.msgs).find(x => x.id===m.reply); if(r) rq = `<div class="rq" data-go="${r.id}"><b>${esc(isMe(r.by)?'شما':pname(r.by)||chatName(c))}</b><span>${esc(preview(r))}</span></div>`; }
  const fwd = m.fwd ? `<div class="rq" style="cursor:default"><b>هدایت‌شده از ${esc(m.fwd)}</b></div>` : '';
  if(m.stk) return {cls:'stk', html:`<span class="emo">${m.stk}</span>${meta}`};
  if(m.voice){
    const bars = (m.voice.bars ||= Array.from({length:34}, () => Math.round(rnd(5,28))));
    return {cls:'', html:`${who}${rq}<div class="voice"><button class="vplay">${IC.play}</button><div><div class="wave">${bars.map((h,i) => `<i style="height:${h}px;animation-delay:${i*.012}s"></i>`).join('')}</div><div class="vt"><span class="vd">${fa('0:'+String(m.voice.dur).padStart(2,'0'))}</span><span class="sp">۱×</span></div></div></div>${meta}`};
  }
  if(m.img) return {cls:'img-msg', html:`${who}<div class="ph"><img src="${m.img}" alt="" loading="lazy" onload="this.classList.add('ld')" onerror="this.parentElement.style.background='var(--soft)';this.remove()">${m.t?'':meta.replace('class="meta"','class="meta ov"')}</div>${m.t?`<div class="cap"><span class="txt">${fmtText(m.t)}</span>${meta}</div>`:''}`};
  if(m.file) return {cls:'card', html:`${showWho?`<div class="who-in-card">${whoHTML(m.by)}</div>`:''}<div class="file"><div class="fic ${m.file.ok?'ok':''}" data-act="dl">${m.file.ok?IC.doc:IC.dl}<svg class="fring" viewBox="0 0 54 54"><circle cx="27" cy="27" r="25"/></svg></div><div class="fn"><b>${esc(m.file.name)}</b><small>${m.file.ok?'دانلود شد · برای باز کردن بزنید':m.file.size+' · PDF'}</small></div></div>${meta}`};
  if(m.grade){
    const g = m.grade, lab = g.score/g.max >= .9 ? 'عالی 🌟' : g.score/g.max >= .75 ? 'خیلی خوب 👏' : 'قابل قبول 🌱';
    return {cls:'card', html:`<div class="grade"><div class="gring" data-v="${g.score}" data-max="${g.max}">${'<svg viewBox="0 0 92 92"><circle class="tr" cx="46" cy="46" r="40"/><circle class="pr" cx="46" cy="46" r="40"/></svg>'}<span><b class="gv" style="font-size:24px;font-weight:900">۰</b><small>از ${fa(g.max)}</small></span></div><div class="gtxt"><small>کارنامه · ${esc(g.subject)}</small><b>${lab}</b><p>${esc(g.note)}</p><div class="stars">${'<i>⭐</i>'.repeat(5)}</div></div></div>${meta}`};
  }
  if(m.assign){
    const a = m.assign, S = SUBJ[a.subject] || SUBJ['ریاضی'], mine = a.subs.includes(meId()), teacher = state.role==='teacher' || isMe(m.by);
    const pct = Math.round(a.subs.length / a.total * 100);
    const btn = !teacher ? `<button class="abtn ${mine?'done':''}" data-act="submit"><span class="albl">${mine ? IC.check+' تحویل شد' : IC.up+' تحویل تکلیف'}</span><svg class="prog" viewBox="0 0 38 38" style="transform:rotate(-90deg)"><circle cx="19" cy="19" r="15" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-dasharray="94.2" stroke-dashoffset="94.2"/></svg></button>` : '';
    return {cls:'card assign', html:`${showWho?`<div class="who-in-card">${whoHTML(m.by)}</div>`:''}
      <div class="card-h"><div class="sym" style="background:${S.c};color:${S.ink}">${S.sym}</div><div class="tt"><small>تکلیف · ${a.subject}</small><b>${esc(a.title)}</b></div>${meta.replace('class="meta"','class="meta" style="position:static;align-self:flex-start;margin:2px 0 0"')}</div>
      <div class="card-b">${esc(a.desc)}</div>
      <div class="card-f"><div class="due"><div class="ring" data-cr="${a.created}" data-due="${a.due}">${ringSVG(17)}<span>⏳</span></div><div class="due-t"><b data-cd="${a.due}">${cdText(a.due)}</b><small>تا پایان مهلت</small></div></div>${btn}</div>
      <div class="card-f"><div class="subs"><div class="stack">${a.subs.slice(-4).map(s => avHTML(s,'xs noon')).join('')}</div><div style="flex:1;min-width:0"><small class="subt" style="display:block;margin-bottom:5px;color:var(--muted);font-size:12px">${teacher ? `${fa(a.subs.length)} از ${fa(a.total)} دانش‌آموز تحویل داده‌اند` : `${fa(a.subs.filter(s=>s!==meId()).length)} نفر از همکلاسی‌ها تحویل داده‌اند`}</small><div class="bar"><i style="width:${pct}%"></i></div></div></div></div>`};
  }
  if(m.quiz){
    const q = m.quiz, my = q.voted[meId()], teacher = state.role==='teacher' || isMe(m.by), done = my!==undefined || teacher;
    const tot = q.votes.reduce((a,b) => a+b, 0) || 1;
    return {cls:'card quiz'+(done?' done':''), html:`${showWho?`<div class="who-in-card">${whoHTML(m.by)}</div>`:''}
      <div class="card-h"><div class="sym" style="background:var(--soft);color:var(--green)">📊</div><div class="tt"><small class="qn">آزمونک · ${fa(q.votes.reduce((a,b)=>a+b,0))} پاسخ</small><b>${esc(q.q)}</b></div>${meta.replace('class="meta"','class="meta" style="position:static;align-self:flex-start;margin:2px 0 0"')}</div>
      ${q.opts.map((o,i) => { const cls = done ? (i===q.correct ? 'right' : (i===my ? 'wrong' : '')) : ''; const p = Math.round(q.votes[i]/tot*100);
        return `<div class="quiz-o ${cls}" data-i="${i}"><span class="fill" style="width:${done?p:0}%"></span><span class="rd">${i===q.correct?IC.check:IC.x}</span><span class="ot">${esc(o)}</span><span class="pc">${fa(p)}٪</span></div>`; }).join('')}
      <div class="quiz-r">${done ? (teacher ? `<span class="ok" style="color:var(--green);font-weight:700">پاسخ درست: «${esc(q.opts[q.correct])}»</span>` : (my===q.correct ? '<span class="ok" style="color:var(--green);font-weight:700">آفرین! پاسخ درست بود 🎉 +۱۰ امتیاز</span>' : `<span class="no" style="color:var(--danger);font-weight:600">پاسخ درست «${esc(q.opts[q.correct])}» است؛ اشتباه هم بخشی از کشف است 🌱</span>`)) : '<small style="color:var(--muted)">یک گزینه را انتخاب کن</small>'}</div>`};
  }
  if(m.att){
    const t = state.role==='teacher' && isMe(m.by) && !m.att.done, on = Object.values(m.att.list).filter(Boolean).length, all = Object.keys(m.att.list).length;
    return {cls:'card att-card', html:`<div class="card-h"><div class="sym" style="background:var(--soft);color:var(--green)">✅</div><div class="tt"><small>حضور و غیاب · ${new Date(m.ts).toLocaleDateString('fa-IR',{weekday:'long', day:'numeric', month:'long'})}</small><b>${esc(chatName(c))}</b></div>${meta.replace('class="meta"','class="meta" style="position:static;align-self:flex-start;margin:2px 0 0"')}</div>
      <div class="att-list">${Object.keys(m.att.list).map(s => `<div class="att" ${s===meId()?'style="background:var(--soft)"':''}>${avHTML(s,'xs noon')}<b>${esc(P[s].name)}${s===meId()?' (شما)':''}</b><span class="tg ${m.att.list[s]?'on':''} ${t?'':'ro'}" data-s="${s}"></span></div>`).join('')}</div>
      <div class="card-f">${t ? `<button class="abtn" data-act="att" style="flex:1"><span class="albl">${IC.check} ثبت حضور و غیاب</span></button>` : `<div class="subs"><small style="font-weight:700;color:var(--green)">${fa(on)} حاضر · ${fa(all-on)} غایب</small><div class="bar"><i style="width:${on/all*100}%"></i></div></div>`}</div>`};
  }
  const aiTag = m.ai ? '<span class="ai-tag">✦ رایوا</span><br>' : '';
  return {cls:'', html:`${who}${fwd}${rq}${aiTag}<span class="txt">${fmtText(m.t||'')}</span>${meta}`};
}
function reactsHTML(m, freshKey){
  const r = m.react || {}, keys = Object.keys(r).filter(k => r[k] > 0); if(!keys.length) return '';
  const my = m.my || [];
  return `<div class="reacts">${keys.map(k => `<span class="rc ${my.includes(k)?'mine':''}" data-e="${k}" ${k===freshKey?'':'style="animation:none"'}>${k}<small>${fa(r[k])}</small></span>`).join('')}</div>`;
}
function appendMsg(m, c, {anim=true, delay=0}={}){
  // day chip
  const lr = lastRow(), day = dayLabel(m.ts);
  if(!lr || lr.dataset.day !== day){ const d = document.createElement('div'); d.className = 'dchip'; d.textContent = day; d.dataset.day = day; msgsEl.appendChild(d); }
  if(m.sys){ const s = document.createElement('div'); s.className='sysmsg'; s.textContent = m.sys; s.dataset.day = day; msgsEl.appendChild(s); return s; }
  const out = isMe(m.by) && c.type!=='channel', grp = c.type==='class' && !out;
  const prev = lastRow(), same = prev && prev.classList.contains('row') && prev.dataset.by===m.by && (Math.abs(m.ts - (+prev.dataset.ts)) < 10*60e3);
  const row = document.createElement('div');
  row.className = `row ${out?'out':'in'} ${grp?'grp':''} ${same?'':'first'} tail ${anim?(out?'a-out':'a-in'):''}`;
  row.dataset.id = m.id; row.dataset.by = m.by; row.dataset.ts = m.ts; row.dataset.day = day;
  if(same){ prev.classList.remove('tail'); const pa = $('.ra', prev); if(pa) pa.innerHTML = ''; }
  const b = bodyHTML(m, c, out, grp && !same);
  row.innerHTML = `${grp ? `<div class="ra">${avHTML(m.by,'noon')}</div>` : ''}<div class="bub ${b.cls}" ${delay?`style="animation-delay:${delay}s"`:''}>${b.html}${reactsHTML(m)}</div><span class="swr">${IC.reply}</span>`;
  if(m.ai && !m.t) row.querySelector('.bub').classList.add('streaming');
  msgsEl.appendChild(row);
  row._m = m; row._json = JSON.stringify(m);
  observeCards(row);
  return row;
}
function rowOf(id){ return $(`.row[data-id="${id}"]`, msgsEl); }
function refreshRow(m, c=state.cur){
  const row = rowOf(m.id); if(!row) return;
  const out = row.classList.contains('out'), grp = row.classList.contains('grp'), showWho = grp && row.classList.contains('first');
  const b = bodyHTML(m, c, out, showWho), bub = $('.bub', row);
  bub.className = 'bub ' + b.cls; bub.style.animation = 'none';
  bub.innerHTML = b.html + reactsHTML(m);
  observeCards(row, true);
}
function jumpTo(id){
  const row = rowOf(id); if(!row) return;
  row.scrollIntoView({block:'center', behavior:'smooth'});
  const b = $('.bub', row); b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash');
}

/* Animated rings & counters when visible */
const io = new IntersectionObserver(es => es.forEach(e => {
  if(!e.isIntersecting) return; io.unobserve(e.target); animateCard(e.target);
}), {threshold:.4});
function observeCards(row, instant){ $$('.gring,.ring', row).forEach(el => instant ? animateCard(el, true) : io.observe(el)); }
function animateCard(el, instant){
  if(el.classList.contains('gring')){
    const v = +el.dataset.v, max = +el.dataset.max, pr = $('.pr', el), gv = $('.gv', el), C = 251.3;
    pr.style.strokeDasharray = C;
    pr.animate([{strokeDashoffset:C},{strokeDashoffset:C*(1-v/max)}],{duration:instant?1:1600, easing:'cubic-bezier(.22,.8,.2,1)', fill:'forwards'});
    const t0 = performance.now(), D = instant?1:1500;
    const step = t => { const k = Math.min(1,(t-t0)/D), e = 1-Math.pow(1-k,3); gv.textContent = fa((v*e).toFixed(v%1?1:0)); if(k<1) requestAnimationFrame(step); else { const gr = el.closest('.grade'), st = gr && $('.stars', gr); if(st){ st.classList.add('on'); $$('i',st).forEach((x,i) => { x.style.transition = `all .5s cubic-bezier(.34,1.56,.64,1) ${i*.09}s`; }); const r = el.getBoundingClientRect(); if(!instant && v/max>=.9) confetti(r.left+r.width/2, r.top+r.height/2, 50, .6); } } };
    requestAnimationFrame(step);
  } else updateRing(el, !instant);
}
function updateRing(el, anim){
  const cr = +el.dataset.cr, due = +el.dataset.due, pr = $('.pr', el), C = +pr.getAttribute('stroke-dasharray');
  const left = Math.max(0, Math.min(1, (due - Date.now()) / (due - cr)));
  const col = left < .15 ? 'var(--danger)' : left < .4 ? 'var(--orange)' : 'var(--green)';
  pr.style.stroke = col;
  const off = C*(1-left);
  if(anim) pr.animate([{strokeDashoffset:C},{strokeDashoffset:off}],{duration:1300, easing:'cubic-bezier(.22,.8,.2,1)', fill:'forwards'});
  else { pr.getAnimations().forEach(a => a.cancel()); pr.setAttribute('stroke-dashoffset', off); }
}
setInterval(() => {
  $$('[data-cd]').forEach(el => { el.textContent = cdText(+el.dataset.cd); });
  $$('.ring[data-due]', msgsEl).forEach(el => { if(!el.dataset.live){ el.dataset.live = 1; return; } updateRing(el, false); });
}, 1000);
