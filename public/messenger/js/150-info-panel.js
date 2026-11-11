/* =========================================================
   Info panel
   ========================================================= */
function renderInfo(){
  const c = state.cur; if(!c) return;
  const box = $('#infoIn'), p = c.type==='personal' && !c.bot && !c.saved ? P[peer(c)] : null;
  const cover = p?.img ? `<img class="bgimg" src="${p.img}" alt="">` : c.id==='c1' ? `<img class="bgimg" src="${SITE}/images/quest-island.webp" alt="">` : `<div class="bgimg" style="background:${GR[(p?p.g:c.g)||0]}"></div>`;
  const big = p?.img ? '' : c.bot ? '✦' : p ? esc(p.name.split(' ').slice(-1)[0][0]) : (c.sym || '◎');
  const sub = c.bot ? 'همیار هوشمند یادگیری' : p ? p.title : c.type==='channel' ? 'کانال رسمی' : `${fa(c.members.length)} عضو`;
  const media = c.msgs.filter(m => m.img || m.file).length;
  let html = `<div class="inf-top"><button class="ibtn rp" id="infX">${IC.close||'✕'}</button>اطلاعات</div>
  <div class="inf-cover">${cover}<div class="shade"></div><div class="big">${big}</div><div class="nm"><b>${esc(chatName(c))}</b><small>${esc(sub)}</small></div></div>
  <div class="inf-actions">${[['🔔', c.muted?'بی‌صدا':'اعلان'],['🔍','جستجو'],['📌','سنجاق'],['⋯','بیشتر']].map((x,i) => `<button style="animation-delay:${.1+i*.05}s" data-a="${i}"><span style="font-size:19px">${x[0]}</span>${x[1]}</button>`).join('')}</div>`;
  if(state.role==='student' && (c.id==='c2' || c.id==='c1' || c.bot)){
    html += `<div class="inf-sec" style="animation-delay:.2s"><h4>پیشرفت یادگیری من</h4><div class="prog-card"><div class="gring" data-v="82" data-max="100" style="width:74px;height:74px;position:relative;flex-shrink:0"><svg viewBox="0 0 92 92" style="width:100%;height:100%;transform:rotate(-90deg)"><circle class="tr" cx="46" cy="46" r="40" fill="none" stroke-width="8"/><circle class="pr" cx="46" cy="46" r="40" fill="none" stroke="url(#gGrad)" stroke-width="8" stroke-linecap="round" stroke-dasharray="251.3" stroke-dashoffset="251.3"/></svg><span style="position:absolute;inset:0;display:grid;place-items:center;text-align:center;line-height:1.1"><b class="gv" style="font-size:19px">۰</b></span></div><div style="position:relative"><b>کاوشگر سطح ۴</b><small>۸۲٪ تا نشان «قلعهٔ دانش» · ۳ تکلیف تحویل‌شده این هفته</small></div></div>
    <div class="badges">${[['🔥','۵ روز پیاپی'],['🧮','استاد الگو'],['📚','کتاب‌خوان'],['🌱','کنجکاو']].map((b,i) => `<span class="bdg" style="animation-delay:${.35+i*.07}s">${b[0]} ${b[1]}</span>`).join('')}</div></div>`;
  }
  if(c.type==='class' && state.role==='teacher' && c.id==='c1'){
    const a = c.msgs.find(m => m.assign)?.assign;
    if(a) html += `<div class="inf-sec" style="animation-delay:.2s"><h4>داشبورد کلاس</h4><div class="prog-card"><div style="position:relative;font-size:34px;font-weight:900;color:#fff">${fa(Math.round(a.subs.length/a.total*100))}٪</div><div style="position:relative"><b>تحویل «${esc(a.title)}»</b><small>${fa(a.subs.length)} از ${fa(a.total)} دانش‌آموز · میانگین نمره کلاس ۱۸٫۲</small></div></div></div>`;
  }
  html += `<div class="inf-sec" style="animation-delay:.28s"><h4>اطلاعات</h4>
    <div class="inf-row">${IC.eye||''}<div>${c.type==='channel' ? 'کانال رسمی مدرسهٔ هوشمند' : c.type==='class' ? 'کلاس درس · سال تحصیلی ۱۴۰۵-۱۴۰۶' : esc(sub)}<small>${c.bot?'پاسخ‌گویی ۲۴ ساعته':'توضیحات'}</small></div></div>
    <div class="inf-row"><span style="font-size:20px;width:21px">🔔</span><div>اعلان‌ها<small>${c.muted?'بی‌صدا':'روشن'}</small></div><span class="sw ${c.muted?'':'on'}" id="infMute"></span></div></div>`;
  if(c.members.length > 1 && c.type!=='personal'){
    html += `<div class="inf-sec" style="animation-delay:.34s"><h4>اعضا · ${fa(c.members.length)}</h4>${c.members.map(id => `<div class="mem">${avHTML(id,'sm')}<div><b>${esc(P[id].name)}${id===meId()?' (شما)':''}</b><small>${P[id].online?'<span style="color:var(--green)">آنلاین</span>':'آخرین بازدید به‌تازگی'}</small></div>${P[id].role==='teacher'?'<span class="rl">معلم</span>':''}</div>`).join('')}</div>`;
  }
  html += `<div class="inf-sec" style="animation-delay:.4s"><h4>رسانه و فایل · ${fa(media)}</h4><div class="media-g">${Array.from({length:6},(_,i) => `<div style="background:${GR[i%8]};animation-delay:${.45+i*.05}s"></div>`).join('')}</div></div>`;
  box.innerHTML = html;
  $('#infX').onclick = closeInfo;
  $('#infMute').onclick = e => { c.muted = !c.muted; e.target.classList.toggle('on', !c.muted); toast(c.muted?'اعلان‌ها بی‌صدا شد':'اعلان‌ها روشن شد', c.muted?'🔕':'🔔'); renderList(); };
  $$('.inf-actions button', box).forEach(b => b.onclick = () => { const a = +b.dataset.a; if(a===1) openSpot(); else if(a===2 && c.pinnedMsg){ jumpTo(c.pinnedMsg); } else if(a===0){ $('#infMute').click(); } else toast('به‌زودی در نسخهٔ کامل','✦'); });
  $$('.gring', box).forEach(g => setTimeout(() => animateCard(g), 450));
}
function openInfo(){ if(!state.cur) return; renderInfo(); $('#info').classList.add('show'); }
function closeInfo(){ $('#info').classList.remove('show'); }
$('#infoBtn').onclick = () => $('#info').classList.contains('show') ? closeInfo() : openInfo();
$('#chWho').onclick = openInfo;
$('#searchIn').onclick = () => openSpot();
$('#muteCh').onclick = () => { const c = state.cur; c.muted = !c.muted; $('#muteCh').textContent = c.muted ? '🔕 روشن کردن اعلان‌ها' : '🔔 بی‌صدا کردن کانال'; toast(c.muted?'کانال بی‌صدا شد':'اعلان‌های کانال روشن شد', c.muted?'🔕':'🔔'); renderList(); };
