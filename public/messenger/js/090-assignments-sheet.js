/* =========================================================
   Assignments sheet
   ========================================================= */
function cdText(due){
  let r = due - Date.now(); if(r <= 0) return 'مهلت تمام شد';
  const d = Math.floor(r/DAY), h = Math.floor(r%DAY/HOUR), m = Math.floor(r%HOUR/6e4), s = Math.floor(r%6e4/1000);
  if(d) return `${fa(d)} روز و ${fa(h)} ساعت`;
  if(h) return `${fa(h)} ساعت و ${fa(m)} دقیقه`;
  return `${fa(m)}:${fa(String(s).padStart(2,'0'))}`;
}
function allAssign(){
  const out = [];
  visibleChats().forEach(c => c.msgs.forEach(m => { if(m.assign) out.push({c, m}); }));
  return out.sort((a,b) => a.m.assign.due - b.m.assign.due);
}
function updateTaskDot(){
  const pend = state.role==='student' ? allAssign().filter(x => !x.m.assign.subs.includes(meId())).length : 0;
  $('#railTasks').style.display = pend ? 'grid' : 'none'; $('#railTasks').textContent = fa(pend);
}
function openTasks(){
  const list = allAssign(), me = meId(), teacher = state.role==='teacher';
  const done = list.filter(x => x.m.assign.subs.includes(me)).length;
  const subsAll = list.reduce((s,x) => s + x.m.assign.subs.length, 0), totalAll = list.reduce((s,x) => s + x.m.assign.total, 0);
  const near = list.find(x => x.m.assign.due > Date.now());
  const sums = teacher
    ? [[fa(list.length),'تکلیف فعال'],[fa(subsAll)+'/'+fa(totalAll),'تحویل‌ها'],[near?cdText(near.m.assign.due).split(' و ')[0]:'—','نزدیک‌ترین مهلت']]
    : [[fa(list.length - done),'در انتظار'],[fa(done),'تحویل‌شده'],[near?cdText(near.m.assign.due).split(' و ')[0]:'—','نزدیک‌ترین مهلت']];
  $('#tasksBody').innerHTML = `<div class="asum">${sums.map((s,i) => `<div style="animation-delay:${.08+i*.06}s"><b>${s[0]}</b><small>${s[1]}</small></div>`).join('')}</div>`
    + (list.length ? list.map((x,i) => {
      const a = x.m.assign, S = SUBJ[a.subject] || SUBJ['ریاضی'], ok = a.subs.includes(me);
      const st = teacher ? `<small style="color:var(--green);font-weight:700">${fa(a.subs.length)} از ${fa(a.total)} تحویل</small>`
        : (ok ? `<small style="color:var(--green);font-weight:700">✓ تحویل داده شد</small>` : `<small style="color:var(--orange);font-weight:700">⏳ ${cdText(a.due)}</small>`);
      return `<div class="acard" data-c="${x.c.id}" data-m="${x.m.id}" style="animation-delay:${.2+i*.07}s"><div class="sym" style="background:${S.c};color:${S.ink}">${S.sym}</div><div class="ab"><b>${esc(a.title)}</b><small>${esc(chatName(x.c))} · ${a.subject}</small><br>${st}</div><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--muted)"><path d="m15 18-6-6 6-6"/></svg></div>`;
    }).join('') : `<div style="text-align:center;color:var(--muted);padding:40px">تکلیفی ثبت نشده است 🌱</div>`);
  $('#tasks').classList.add('show');
}
function closeTasks(){
  if(!$('#tasks').classList.contains('show')) return;
  $('#tasks').classList.remove('show');
  const rb = $('#railNav .rbtn[data-r="tasks"]');
  if(rb.classList.contains('active')){ const t = $(`#railNav .rbtn[data-r="${state.folder==='class'?'classes':'chats'}"]`); $$('#railNav .rbtn').forEach(x => x.classList.toggle('active', x===t)); moveRail(t); }
}
$('#tasksClose').onclick = closeTasks;
$('#tasksBody').addEventListener('click', e => { const a = e.target.closest('.acard'); if(!a) return; closeTasks(); openChat(a.dataset.c, a.dataset.m); });
