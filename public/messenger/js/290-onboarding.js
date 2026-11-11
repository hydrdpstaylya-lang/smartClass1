/* ---------- Onboarding ---------- */
function startEmpty(){
  const keepP = ['s_ilya','t_sadeghi','raiva'];
  Object.keys(P).forEach(id => { if(!keepP.includes(id)) delete P[id]; });
  STUDENTS.length = 0; STUDENTS.push('s_ilya');
  const keepC = ['c3','c9']; for(let i = chats.length-1; i >= 0; i--) if(!keepC.includes(chats[i].id)) chats.splice(i,1);
  chats.find(c => c.id==='c9').msgs = [];
  chats.push({id:'c'+nid(), type:'personal', members:['t_sadeghi','s_ilya'], vis:['student','teacher'], msgs:[{id:'m'+nid(), sys:'گفتگوی معلم و دانش‌آموز آماده است', ts:Date.now()}]});
  STORIES.length = 0;
}
function onboarding(){
  return new Promise(done => {
    const el = document.createElement('div'); el.id = 'onb';
    el.innerHTML = `<div class="onb-bg"><i></i><i></i><i></i></div><div class="onb-card">
      <div class="onb-step on" data-s="0"><div class="onb-logo">✦</div><small class="ltr">SMARTCLASS · MESSENGER</small><h1>به گفتگوی کلاس خوش آمدی.</h1><p>پیام‌رسان مدرسه برای معلم‌ها و دانش‌آموزان؛ تکلیف، آزمونک، کارنامه، کلاس آنلاین و همیار هوشمند در یک جا.</p>
        <div class="onb-roles"><button data-r="student"><span>🎒</span><b>دانش‌آموزم</b><small>کاوشگر یادگیری</small></button><button data-r="teacher"><span>🎓</span><b>معلمم</b><small>راهنمای کلاس</small></button></div></div>
      <div class="onb-step" data-s="1"><button class="onb-av" id="obAv"><span class="ph">📷</span></button><h2 id="obH">خودت را معرفی کن</h2>
        <div class="fld"><input id="obName" placeholder="نام و نام خانوادگی" autocomplete="off"></div><div class="fld"><input id="obTitle" placeholder="پایهٔ تحصیلی یا درس"></div>
        <button class="btn pri" id="obNext">ادامه</button></div>
      <div class="onb-step" data-s="2"><h2>از کجا شروع کنیم؟</h2>
        <div class="onb-opts"><button data-d="1"><span>🗺️</span><b>با کلاس نمونه</b><small>کلاس، تکلیف، آزمونک و کارنامهٔ نمونه برای آشنایی</small></button><button data-d="0"><span>🌱</span><b>شروع از صفر</b><small>خودت کلاس‌ها و اعضا را می‌سازی</small></button></div></div>
      <div class="onb-dots"><i class="on"></i><i></i><i></i></div></div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    let role = 'student', img = null;
    const go = n => { $$('.onb-step', el).forEach(s => s.classList.toggle('on', +s.dataset.s===n)); $$('.onb-dots i', el).forEach((d,i) => d.classList.toggle('on', i<=n)); if(n===1) setTimeout(() => $('#obName').focus(), 400); };
    $$('.onb-roles button', el).forEach(b => b.onclick = () => { role = b.dataset.r; $('#obH').textContent = role==='teacher' ? 'معلم عزیز، خوش آمدید' : 'سلام کاوشگر'; $('#obTitle').placeholder = role==='teacher' ? 'مثلاً: آموزگار پایهٔ سوم' : 'مثلاً: پایهٔ سوم'; const r = b.getBoundingClientRect(); confetti(r.left + r.width/2, r.top + r.height/2, 40, .5); go(1); });
    $('#obAv').onclick = async () => { const [f] = await pickFiles('image/*'); if(!f) return; img = await toDataURL(await compressImage(f, 320)); $('#obAv').innerHTML = `<img src="${img}" alt="">`; };
    $('#obName').onkeydown = e => { if(e.key==='Enter') $('#obNext').click(); };
    $('#obNext').onclick = () => { if(!$('#obName').value.trim()){ $('#obName').animate([{transform:'translateX(-7px)'},{transform:'translateX(7px)'},{transform:'none'}],{duration:300}); return; } go(2); };
    $$('.onb-opts button', el).forEach(b => b.onclick = () => {
      const sample = b.dataset.d==='1';
      if(!sample) startEmpty();
      const id = ROLE_ID(role), p = P[id];
      p.name = $('#obName').value.trim(); p._ren = 1; p.title = $('#obTitle').value.trim() || (role==='teacher' ? 'معلم' : 'دانش‌آموز'); if(img) p.img = img; else if(!sample || role==='student') delete p.img;
      if(!sample){ const o = P[ROLE_ID(role==='teacher'?'student':'teacher')]; o.name = role==='teacher' ? 'دانش‌آموز آزمایشی' : 'معلم آزمایشی'; o.title = 'حساب دوم برای امتحان'; o._ren = 1; delete o.img; SET.sim = false; saveSet(); }
      state.role = role; sessionStorage.setItem('sc_role', role);
      localStorage.setItem('sc_profile', JSON.stringify({onb:1, role, sample, at:Date.now()}));
      el.classList.add('out'); const r = b.getBoundingClientRect(); confetti(r.left + r.width/2, r.top, 120);
      setTimeout(() => { el.remove(); done(); }, 650);
    });
  });
}
