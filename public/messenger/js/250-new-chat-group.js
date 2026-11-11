/* ---------- New chat / group / channel / member ---------- */
const SYMS = ['📘','🧮','🔬','🎨','🌍','🎵','⚽','📖','🧪','💡','🏫','✏️'];
function newChatModal(tab='p'){
  const T = state.role==='teacher';
  const tabs = [['p','گفتگوی خصوصی'],['g', T?'کلاس / گروه':'گروه'], ...(T ? [['ch','کانال'],['u','عضو جدید']] : [])];
  const o = openOvl(`<div class="modal wide"><div class="modal-h"><div class="sym" style="background:var(--mint);color:var(--mint-ink)">✚</div><div><b>ساختن</b><small>گفتگو، کلاس، کانال یا افزودن عضو</small></div></div>
    <div class="modal-b"><div class="seg" id="ncSeg"><span class="si"></span>${tabs.map(t => `<button data-v="${t[0]}" class="${t[0]===tab?'on':''}">${t[1]}</button>`).join('')}</div><div id="ncBody" class="nc-body"></div></div>
    <div class="modal-f"><button class="btn pri" id="ncOk">ساختن</button><button class="btn sec" id="ncNo">انصراف</button></div></div>`);
  const seg = $('#ncSeg'); wireSeg(seg);
  $$('button', seg).forEach(b => b.addEventListener('click', () => draw(b.dataset.v)));
  $('#ncNo').onclick = closeOvl; o.onclick = e => { if(e.target===o) closeOvl(); };
  const people = () => Object.keys(P).filter(id => id!==meId() && !P[id].ai && id!=='@me');
  let cur = tab, sel = new Set(), sym = SYMS[0], g = 0;
  const peopleHTML = (multi) => `<div class="fld"><input id="ncQ" placeholder="جستجوی نام…"></div><div class="plist" id="ncList">${people().map((id,i) => `<div class="subr pk" data-id="${id}" style="animation-delay:${i*.025}s">${avHTML(id,'sm noon')}<div class="sb"><b>${esc(P[id].name)}</b><small>${P[id].role==='teacher'?'معلم':'دانش‌آموز'}${P[id].title?' · '+esc(P[id].title):''}</small></div>${multi?'<span class="ck2"></span>':''}</div>`).join('') || '<div style="color:var(--muted);text-align:center;padding:20px">هنوز عضوی نیست؛ از «عضو جدید» اضافه کنید.</div>'}</div>`;
  const symHTML = () => `<div class="fld"><label>نماد و رنگ</label><div class="symc">${SYMS.map(s => `<button data-s="${s}" class="${s===sym?'on':''}">${s}</button>`).join('')}</div><div class="swc">${GR.map((x,i) => `<button data-g="${i}" class="${i===g?'on':''}" style="background:${x}"></button>`).join('')}</div></div>`;
  function draw(t){
    cur = t; sel = new Set(); const b = $('#ncBody');
    $('#ncOk').style.display = t==='p' ? 'none' : '';
    if(t==='p') b.innerHTML = peopleHTML(false);
    if(t==='g') b.innerHTML = `<div class="fld"><label>نام ${T?'کلاس یا گروه':'گروه'}</label><input id="ncN" placeholder="${T?'مثلاً: کلاس چهارم ب':'مثلاً: گروه مطالعهٔ علوم'}"></div>${symHTML()}<label style="font-size:12.5px;font-weight:700;color:var(--muted)">اعضا</label>${peopleHTML(true)}`;
    if(t==='ch') b.innerHTML = `<div class="fld"><label>نام کانال</label><input id="ncN" placeholder="مثلاً: اخبار پایهٔ سوم"></div>${symHTML()}<div class="fld"><label>اولین پیام کانال</label><textarea id="ncD" placeholder="به کانال خوش آمدید 📣"></textarea></div>`;
    if(t==='u') b.innerHTML = `<div class="fld"><label>نام و نام خانوادگی</label><input id="ncN" placeholder="مثلاً: مهسا کریمی"></div><div class="fld"><label>نقش</label>${segHTML('ncR',['دانش‌آموز','معلم'])}</div><div class="fld"><label>عنوان</label><input id="ncT" placeholder="مثلاً: پایهٔ سوم / دبیر علوم"></div>
      <div class="fld"><label>افزودن به کلاس‌ها</label><div class="symc">${visibleChats().filter(c => c.type==='class').map(c => `<button data-c="${c.id}" class="cls">${esc(chatName(c))}</button>`).join('') || '<small style="color:var(--muted)">کلاسی وجود ندارد</small>'}</div></div>`;
    if(t==='u'){ wireSeg($('#ncR')); $$('.cls', b).forEach(x => x.onclick = () => x.classList.toggle('on')); }
    $$('.symc button[data-s]', b).forEach(x => x.onclick = () => { sym = x.dataset.s; $$('.symc button[data-s]', b).forEach(y => y.classList.toggle('on', y===x)); });
    $$('.swc button', b).forEach(x => x.onclick = () => { g = +x.dataset.g; $$('.swc button', b).forEach(y => y.classList.toggle('on', y===x)); });
    const q = $('#ncQ', b); if(q) q.oninput = () => $$('#ncList .pk', b).forEach(r => r.style.display = P[r.dataset.id].name.includes(q.value.trim()) ? '' : 'none');
    $$('#ncList .pk', b).forEach(r => r.onclick = () => {
      if(t==='p'){ const c = personalWith(r.dataset.id); closeOvl(); renderList(); setTimeout(() => openChat(c.id), 300); return; }
      r.classList.toggle('on'); sel.has(r.dataset.id) ? sel.delete(r.dataset.id) : sel.add(r.dataset.id);
    });
    setTimeout(() => $('#ncN', b)?.focus(), 120);
  }
  draw(tab);
  $('#ncOk').onclick = () => {
    const n = $('#ncN')?.value.trim(); if(!n) return $('#ncN').animate([{transform:'translateX(-6px)'},{transform:'translateX(6px)'},{transform:'none'}],{duration:300}), toast('نام را وارد کنید','✎');
    if(cur==='u'){
      const role = $('#ncR .on').dataset.v==='معلم' ? 'teacher' : 'student', id = 'u' + nid();
      P[id] = {name:n, role, title:$('#ncT').value.trim() || (role==='teacher'?'معلم':'دانش‌آموز'), g:Math.floor(Math.random()*8), color:['#16866f','#2c7aa6','#c47a1c','#8b5cf6','#d9485f'][Math.floor(Math.random()*5)], online:false};
      if(role==='student') STUDENTS.push(id);
      $$('#ncBody .cls.on').forEach(x => { const c = chats.find(y => y.id===x.dataset.c); c.members.push(id); c.msgs.push({id:'m'+nid(), sys:`${P[meId()].name} «${n}» را به کلاس اضافه کرد`, ts:Date.now()}); });
      closeOvl(); toast(`${n} اضافه شد`,'👤'); renderList(); return;
    }
    const members = [meId(), ...sel];
    const c = {id:'c'+nid(), type: cur==='ch' ? 'channel' : 'class', name:n, sym, g, members, vis: cur==='ch' ? ['student','teacher'] : visFor(members), msgs:[{id:'m'+nid(), sys: cur==='ch' ? `کانال «${n}» ساخته شد` : `${P[meId()].name} ${T?'کلاس':'گروه'} «${n}» را ساخت`, ts:Date.now()}]};
    if(cur==='ch'){ c.admin = 'teacher'; c.verified = true; const d = $('#ncD').value.trim(); if(d) c.msgs.push({id:'m'+nid(), by:meId(), t:d, ts:Date.now()+1, views:1}); }
    chats.push(c); closeOvl(); toast(`«${n}» ساخته شد`,'✨'); playSound('ok');
    renderList(); setTimeout(() => { openChat(c.id); const r = $(`.citem[data-id="${c.id}"]`)?.getBoundingClientRect(); if(r) confetti(r.left + r.width/2, r.top + r.height/2, 70, .7); }, 320);
  };
}
$('#newBtnTop').onclick = () => newChatModal('p');
$('#fab').onclick = () => newChatModal(state.role==='teacher' ? 'g' : 'p');
