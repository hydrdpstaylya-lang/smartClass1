/* SmartClass Teacher Center — real teacher/admin accounts only */
function tcClasses(){
  return visibleChats().filter(c => c && c.type === 'class' && !c.bot && !c.saved);
}
function tcAssignments(){
  return allAssign().filter(x => x.c && x.m && x.m.assign && !x.c.bot && !x.c.saved);
}
function tcStudents(classes){
  const ids = new Set();
  classes.forEach(c => (c.members || []).forEach(id => { if(P[id]?.role === 'student') ids.add(id); }));
  return [...ids].sort((a,b) => (P[a]?.name || '').localeCompare(P[b]?.name || '', 'fa'));
}
function tcCsv(value){
  return '"' + String(value ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"';
}
function tcDownloadReport(){
  const rows = [['عنوان تکلیف','کلاس','درس','مهلت','تعداد دانش‌آموز','تحویل‌شده','باقی‌مانده']];
  tcAssignments().forEach(({c,m}) => {
    const a=m.assign,total=Math.max(0,Number(a.total)||0),done=(a.subs||[]).length;
    rows.push([a.title,chatName(c),a.subject,new Date(a.due).toLocaleString('fa-IR'),total,done,Math.max(0,total-done)]);
  });
  const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(tcCsv).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='SmartClass-Teacher-Report.csv';document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1200);toast('گزارش تکالیف دریافت شد','📊');
}
function tcOpenClass(classId,action,messageId){
  closeOvl();
  const c=chats.find(x=>x.id===classId);
  if(!c){toast('کلاس پیدا نشد؛ فهرست را تازه کن','⚠️');return;}
  openChat(classId);
  if(!action||action==='chat')return;
  setTimeout(()=>{
    if(!state.cur||state.cur.id!==classId){toast('گفتگوی کلاس باز نشد؛ دوباره امتحان کن','⚠️');return;}
    if(action==='task')assignModal();
    else if(action==='quiz')quizModal();
    else if(action==='file')sendFile();
    else if(action==='attendance')openTeacherAttendance(classId);
    else if(action==='review'){
      const current=chats.find(x=>x.id===classId),msg=current?.msgs.find(x=>x.id===messageId);
      if(msg?.assign)openSubs(msg);else toast('این تکلیف دیگر در کلاس نیست','⚠️');
    }
  },260);
}
function openTeacherAttendance(classId){
  if(!canTeachUI()){toast('این بخش ویژهٔ معلمان است','🔒');return;}
  const c=chats.find(x=>x.id===classId);
  if(!c||c.type!=='class'){toast('کلاس معتبر نیست','⚠️');return;}
  const students=(c.members||[]).filter(id=>P[id]?.role==='student');
  if(!students.length){
    const o=openOvl('<div class="modal tc-att-modal"><div class="modal-h"><div class="sym">📋</div><div><b>حضور و غیاب</b><small>فهرست دانش‌آموزان خالی است</small></div></div><div class="modal-b"><p class="tc-empty">هنوز دانش‌آموزی در این کلاس عضو نشده است.</p></div><div class="modal-f"><button class="btn sec" id="tcAttClose">بستن</button></div></div>');
    $('#tcAttClose',o).onclick=closeOvl;return;
  }
  const rows=students.map(id=>'<label class="tc-att-row"><span class="tc-att-person">'+avHTML(id,'sm noon')+'<span><b>'+esc(P[id].name)+'</b><small>'+esc(P[id].title||'دانش‌آموز')+'</small></span></span><select class="tc-att-select" data-student="'+esc(id)+'" aria-label="وضعیت حضور '+esc(P[id].name)+'"><option value="">انتخاب وضعیت</option><option value="1">حاضر</option><option value="0">غایب</option></select></label>').join('');
  const o=openOvl('<div class="modal wide tc-att-modal"><div class="modal-h"><div class="sym" style="background:var(--soft);color:var(--green)">📋</div><div><b>ثبت حضور و غیاب</b><small>'+esc(chatName(c))+' · '+fa(students.length)+' دانش‌آموز</small></div></div><div class="modal-b"><div class="tc-att-help">وضعیت هر دانش‌آموز را مشخص کن. هیچ موردی به‌صورت خودکار حاضر یا غایب ثبت نمی‌شود.</div><div class="tc-att-list">'+rows+'</div><div class="tc-att-count" id="tcAttCount">۰ از '+fa(students.length)+' نفر تعیین وضعیت شده‌اند</div></div><div class="modal-f"><button class="btn pri" id="tcAttSave" disabled>ثبت در کلاس</button><button class="btn sec" id="tcAttCancel">انصراف</button></div></div>');
  const selects=$$('.tc-att-select',o),save=$('#tcAttSave',o),count=$('#tcAttCount',o);
  const refresh=()=>{const done=selects.filter(x=>x.value!=='').length;count.textContent=fa(done)+' از '+fa(students.length)+' نفر تعیین وضعیت شده‌اند';save.disabled=done!==students.length;};
  selects.forEach(s=>s.addEventListener('change',refresh));
  $('#tcAttCancel',o).onclick=closeOvl;
  save.onclick=()=>{
    const list={};selects.forEach(s=>list[s.dataset.student]=s.value==='1');
    closeOvl();openChat(classId);
    setTimeout(()=>{
      if(!state.cur||state.cur.id!==classId){toast('گفتگوی کلاس برای ثبت حضور باز نماند','⚠️');return;}
      pushOut({att:{list,done:false}});toast('حضور و غیاب در کلاس ثبت شد','📋');updateTaskDot();
    },260);
  };
}
function openTeacherCenter(){
  if(!canTeachUI()){toast('مرکز معلم فقط برای حساب معلم یا مدیر فعال است','🔒');return;}
  const classes=tcClasses(),assignments=tcAssignments(),students=tcStudents(classes);
  const submitted=assignments.reduce((n,x)=>n+(x.m.assign.subs||[]).length,0);
  const total=assignments.reduce((n,x)=>n+Math.max(0,Number(x.m.assign.total)||0),0);
  const pending=Math.max(0,total-submitted);
  const grades=assignments.flatMap(x=>Object.values(x.m.assign.grades||{}).map(Number)).filter(Number.isFinite);
  const average=grades.length?(grades.reduce((a,b)=>a+b,0)/grades.length).toLocaleString('fa-IR',{maximumFractionDigits:1}):'—';
  const latest=assignments.slice().sort((a,b)=>(b.m.assign.created||b.m.ts||0)-(a.m.assign.created||a.m.ts||0)).slice(0,6);
  const classCards=classes.map(c=>{
    const ids=(c.members||[]).filter(id=>P[id]?.role==='student'),tasks=assignments.filter(x=>x.c.id===c.id);
    const done=tasks.reduce((n,x)=>n+(x.m.assign.subs||[]).length,0),cap=tasks.reduce((n,x)=>n+Math.max(0,Number(x.m.assign.total)||0),0);
    const pct=cap?Math.min(100,Math.round(done/cap*100)):0;
    return '<article class="tc-class-card"><div class="tc-class-top"><span class="tc-class-mark">'+esc(c.sym||'🏫')+'</span><span class="tc-class-meta"><b>'+esc(chatName(c))+'</b><small>'+fa(ids.length)+' دانش‌آموز · '+fa(tasks.length)+' تکلیف</small></span><span class="tc-class-live">'+(c.live?'فعال':'کلاس')+'</span></div><div class="tc-progress-head"><span>وضعیت تحویل تکالیف</span><b>'+fa(pct)+'٪</b></div><div class="tc-progress"><i style="width:'+pct+'%"></i></div><div class="tc-class-actions"><button data-tc-action="chat" data-tc-class="'+esc(c.id)+'">گفتگو</button><button data-tc-action="task" data-tc-class="'+esc(c.id)+'">تکلیف جدید</button><button data-tc-action="quiz" data-tc-class="'+esc(c.id)+'">آزمونک</button><button data-tc-action="attendance" data-tc-class="'+esc(c.id)+'">حضور و غیاب</button></div></article>';
  }).join('');
  const assignmentRows=latest.map(({c,m})=>{
    const a=m.assign,n=(a.subs||[]).length,t=Math.max(0,Number(a.total)||0);
    return '<button class="tc-assignment-row" data-tc-action="review" data-tc-class="'+esc(c.id)+'" data-tc-message="'+esc(m.id)+'"><span class="tc-assignment-icon">📝</span><span class="tc-assignment-info"><b>'+esc(a.title)+'</b><small>'+esc(chatName(c))+' · '+esc(a.subject||'بدون درس')+'</small></span><span class="tc-assignment-result"><b>'+fa(n)+' / '+fa(t)+'</b><small>'+(a.due?esc(cdText(a.due)):'بدون مهلت')+'</small></span></button>';
  }).join('');
  const studentRows=students.slice(0,12).map(id=>'<button class="tc-student-row" data-tc-action="student" data-tc-student="'+esc(id)+'">'+avHTML(id,'sm noon')+'<span><b>'+esc(P[id].name)+'</b><small>'+esc(P[id].title||'دانش‌آموز')+'</small></span><span class="tc-student-chat">گفتگو ←</span></button>').join('');
  const p=P[meId()]||{name:'آموزگار'};
  const html='<div class="modal wide tc-modal"><div class="modal-h tc-header"><div class="sym" style="background:var(--soft);color:var(--green)">🎓</div><div><b>مرکز معلم SmartClass</b><small>'+esc(p.name)+' · '+(state.role==='admin'?'مدیر مدرسه':'آموزگار')+'</small></div><button class="ibtn tc-close" id="tcClose" aria-label="بستن">✕</button></div><div class="modal-b tc-body"><section class="tc-hero"><div><span class="tc-kicker">SMARTCLASS · TEACHER STUDIO</span><h2>سلام '+esc(p.name)+'، کلاس‌ها آماده‌اند.</h2><p>مدیریت کلاس، تکلیف، آزمون، حضور و غیاب و پیگیری یادگیری از یک پنل.</p></div><div class="tc-hero-mark">✦</div></section><section class="tc-stats"><div class="tc-stat"><small>کلاس‌های شما</small><b>'+fa(classes.length)+'</b><span>کلاس فعال در دسترس</span></div><div class="tc-stat"><small>دانش‌آموزان</small><b>'+fa(students.length)+'</b><span>عضو کلاس‌های شما</span></div><div class="tc-stat"><small>تحویل‌های باقی‌مانده</small><b>'+fa(pending)+'</b><span>'+fa(submitted)+' تحویل از '+fa(total)+'</span></div><div class="tc-stat"><small>میانگین نمره‌ها</small><b>'+average+'</b><span>'+fa(grades.length)+' نمرهٔ ثبت‌شده</span></div></section><section class="tc-section"><div class="tc-section-head"><div><h3>ابزارهای سریع</h3><p>کارهای پرتکرار معلم با یک کلیک</p></div></div><div class="tc-quick-grid"><button data-tc-action="create-class"><i>🏫</i><b>ساخت کلاس</b><small>ساخت گروه و افزودن اعضا</small></button><button data-tc-action="announcement"><i>📣</i><b>کانال اطلاع‌رسانی</b><small>انتشار خبر برای مدرسه</small></button><button data-tc-action="exam"><i>🧠</i><b>آزمون‌ساز هوشمند</b><small>ساخت و چاپ آزمون و پاسخ‌نامه</small></button><button data-tc-action="tasks"><i>📋</i><b>مدیریت تکالیف</b><small>مهلت‌ها و تحویل‌ها</small></button><button data-tc-action="report"><i>📊</i><b>گزارش تحویل‌ها</b><small>خروجی CSV از اطلاعات واقعی</small></button><button data-tc-action="raiva"><i>✦</i><b>کمک از رایوا</b><small>همیار هوشمند آموزشی</small></button></div></section><section class="tc-section"><div class="tc-section-head"><div><h3>کلاس‌های من</h3><p>مدیریت گفتگو و فعالیت‌های هر کلاس</p></div><button class="tc-link" data-tc-action="create-class">+ کلاس جدید</button></div><div class="tc-class-grid">'+(classCards||'<div class="tc-empty">هنوز کلاسی برای این حساب ثبت نشده است. از «ساخت کلاس» شروع کن.</div>')+'</div></section><section class="tc-section"><div class="tc-section-head"><div><h3>آخرین تکالیف</h3><p>برای بررسی پاسخ‌ها روی هر تکلیف بزن</p></div><button class="tc-link" data-tc-action="tasks">همهٔ تکالیف</button></div><div class="tc-assignment-list">'+(assignmentRows||'<div class="tc-empty">هنوز تکلیفی ثبت نشده است.</div>')+'</div></section><section class="tc-section"><div class="tc-section-head"><div><h3>دانش‌آموزان</h3><p>دسترسی سریع به گفتگوی خصوصی دانش‌آموزان</p></div><span class="tc-count">'+fa(students.length)+' نفر</span></div><input class="tc-search" id="tcStudentSearch" type="search" placeholder="جستجوی نام دانش‌آموز…"><div class="tc-student-list" id="tcStudentList">'+(studentRows||'<div class="tc-empty">دانش‌آموزی در کلاس‌های این حساب دیده نشد.</div>')+'</div></section><div class="tc-footer-note">اطلاعات این پنل از کلاس‌ها و تکالیف متصل به حساب مدرسه خوانده می‌شود؛ آمار آزمایشی به آن اضافه نشده است.</div></div></div>';
  const o=openOvl(html);
  $('#tcClose',o).onclick=closeOvl;o.onclick=e=>{if(e.target===o)closeOvl();};
  $$('[data-tc-action]',o).forEach(btn=>btn.addEventListener('click',()=>{
    const action=btn.dataset.tcAction,classId=btn.dataset.tcClass,messageId=btn.dataset.tcMessage,studentId=btn.dataset.tcStudent;
    if(action==='create-class'){closeOvl();setTimeout(()=>newChatModal('g'),220);}
    else if(action==='announcement'){closeOvl();setTimeout(()=>newChatModal('ch'),220);}
    else if(action==='exam'){closeOvl();location.href='/teacher-exams/';}
    else if(action==='tasks'){closeOvl();openTasks();}
    else if(action==='report')tcDownloadReport();
    else if(action==='raiva'){closeOvl();openChat('c3');}
    else if(action==='student'){const chat=personalWith(studentId);closeOvl();renderList();setTimeout(()=>openChat(chat.id),220);}
    else if(classId)tcOpenClass(classId,action,messageId);
  }));
  const search=$('#tcStudentSearch',o);
  if(search)search.addEventListener('input',()=>{
    const q=search.value.trim().toLocaleLowerCase('fa');
    $$('.tc-student-row',o).forEach(row=>{row.hidden=!row.textContent.toLocaleLowerCase('fa').includes(q);});
  });
}
