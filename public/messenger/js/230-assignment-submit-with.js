/* ---------- Assignment: submit with attachment, teacher review & grading ---------- */
function submitAssign(row, m, ab){
  const a = m.assign; if(a.subs.includes(meId()) || ab.classList.contains('loading')) return;
  let file = null;
  const o = openOvl(`<div class="modal"><div class="modal-h"><div class="sym" style="background:var(--mint);color:var(--mint-ink)">📤</div><div><b>تحویل تکلیف</b><small>${esc(a.title)} · ${esc(a.subject)}</small></div></div>
    <div class="modal-b"><button class="dropz" id="sbPick"><span style="font-size:30px">📎</span><b>پیوست پاسخ (عکس یا فایل)</b><small>اختیاری · برای انتخاب بزنید</small></button>
    <div class="fld"><label>یادداشت برای معلم</label><textarea id="sbNote" placeholder="مثلاً: تمرین ۳ را دو روش حل کردم…"></textarea></div></div>
    <div class="modal-f"><button class="btn pri" id="sbOk">تحویل</button><button class="btn sec" id="sbNo">انصراف</button></div></div>`);
  $('#sbNo').onclick = closeOvl; o.onclick = e => { if(e.target===o) closeOvl(); };
  $('#sbPick').onclick = async () => { const [f] = await pickFiles('', false); if(!f) return; file = f; const z = $('#sbPick'); z.classList.add('on'); z.innerHTML = `<span style="font-size:30px">${f.type.startsWith('image/')?'🖼️':'📄'}</span><b>${esc(f.name)}</b><small>${fmtSize(f.size)} · برای تغییر بزنید</small>`; };
  $('#sbOk').onclick = async () => {
    const note = $('#sbNote').value.trim(); closeOvl();
    let rec_ = {note, ts:Date.now()};
    if(file){ const b = file.type.startsWith('image/') ? await compressImage(file) : file; rec_.key = await putBlob(b); rec_.name = file.name; rec_.mime = b.type || file.type; rec_.size = fmtSize(b.size); }
    a.files ||= {}; a.files[meId()] = rec_;
    const r2 = rowOf(m.id) || row; submitAssignAnim(r2, m, $('.abtn[data-act="submit"]', r2) || ab); playSound('ok');
  };
}
function openSubs(m){
  const a = m.assign, c = state.cur, studs = c.members.filter(x => P[x]?.role==='student');
  const o = openOvl(`<div class="modal wide"><div class="modal-h"><div class="sym" style="background:var(--mint);color:var(--mint-ink)">📥</div><div><b>تحویل‌ها · ${esc(a.title)}</b><small>${fa(a.subs.length)} از ${fa(studs.length)} دانش‌آموز تحویل داده‌اند · ${cdText(a.due)} مانده</small></div></div>
    <div class="modal-b" style="max-height:56vh;overflow:auto">${studs.map((s,i) => { const d = a.subs.includes(s), f = (a.files||{})[s], g = (a.grades||{})[s];
      return `<div class="subr" style="animation-delay:${i*.04}s">${avHTML(s,'sm noon')}<div class="sb"><b>${esc(P[s].name)}</b><small>${d ? (f?.note ? '«'+esc(f.note)+'»' : 'تحویل داده شد') + (f?.ts ? ' · ' + listTime(f.ts) : '') : 'هنوز تحویل نداده'}</small></div>
      ${f?.key ? `<button class="mini" data-dl="${s}">📎 ${esc((f.name||'فایل').slice(0,14))}</button>` : ''}
      ${d ? (g ? `<span class="gpill">${fa(g)} از ۲۰</span>` : `<button class="mini pri" data-g="${s}">نمره</button>`) : `<button class="mini" data-nudge="${s}">⏰ یادآوری</button>`}</div>`; }).join('')}</div>
    <div class="modal-f"><button class="btn pri" id="sbClose">بستن</button></div></div>`);
  $('#sbClose').onclick = closeOvl; o.onclick = e => { if(e.target===o) closeOvl(); };
  $$('[data-dl]', o).forEach(b => b.onclick = async () => { const f = a.files[b.dataset.dl], u = await blobURL(f.key); if(!u) return toast('فایل روی این دستگاه نیست','⚠️'); const x = document.createElement('a'); x.href = u; x.download = f.name || 'file'; if(/^image|pdf/.test(f.mime||'')) open(u,'_blank'); else x.click(); });
  $$('[data-nudge]', o).forEach(b => b.onclick = () => { const s = b.dataset.nudge, pc = personalWith(s); pc.msgs.push({id:'m'+nid(), by:meId(), t:`⏰ یادآوری: مهلت تکلیف «${a.title}» ${cdText(a.due)} دیگر تمام می‌شود.`, ts:Date.now()}); b.textContent = '✓ ارسال شد'; b.disabled = true; renderList(); });
  $$('[data-g]', o).forEach(b => b.onclick = () => gradeModal(m, b.dataset.g));
}
function personalWith(pid){
  let c = chats.find(x => x.type==='personal' && !x.bot && !x.saved && x.members.length===2 && x.members.includes(pid) && x.members.includes(meId()));
  if(!c){ c = {id:'c'+nid(), type:'personal', members:[meId(), pid], vis:visFor([meId(), pid]), msgs:[]}; chats.push(c); }
  return c;
}
function visFor(members){ return ['student','teacher'].filter(r => members.includes(ROLE_ID(r))); }
function gradeModal(m, sid){
  const a = m.assign;
  const o = openOvl(`<div class="modal"><div class="modal-h"><div class="sym" style="background:color-mix(in srgb,var(--gold) 30%,transparent)">🏅</div><div><b>نمره به ${esc(P[sid].name)}</b><small>${esc(a.title)} · ${esc(a.subject)}</small></div></div>
    <div class="modal-b"><div class="fld"><label>نمره (از ۲۰): <b id="gV" style="color:var(--green);font-size:18px">۱۸</b></label><input type="range" id="gR" min="0" max="20" step=".5" value="18" style="accent-color:var(--green);padding:0;border:0;background:none"></div>
    <div class="fld"><label>بازخورد</label><textarea id="gN">کار مرتب و دقیقی بود. آفرین 🌟</textarea></div></div>
    <div class="modal-f"><button class="btn pri" id="gOk">ثبت و ارسال کارنامه</button><button class="btn sec" id="gNo">انصراف</button></div></div>`);
  $('#gR').oninput = e => $('#gV').textContent = fa(e.target.value);
  $('#gNo').onclick = closeOvl;
  $('#gOk').onclick = () => {
    const v = +$('#gR').value; a.grades ||= {}; a.grades[sid] = v;
    const pc = personalWith(sid); pc.msgs.push({id:'m'+nid(), by:meId(), grade:{subject:a.subject + ' · ' + a.title, score:v, max:20, note:$('#gN').value.trim()}, ts:Date.now()});
    closeOvl(); toast(`کارنامه برای ${P[sid].name} ارسال شد`,'🏅'); playSound('ok'); renderList(); setTimeout(() => openSubs(m), 460);
  };
}
msgsEl.addEventListener('click', e => {
  const s = e.target.closest('.assign .subs'); if(!s) return;
  const row = s.closest('.row'); if(row?._m?.assign && (state.role==='teacher' || isMe(row._m.by))) openSubs(row._m);
}, true);
