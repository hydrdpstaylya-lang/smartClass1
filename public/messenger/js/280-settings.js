/* ---------- Settings ---------- */
function syncStories(){ STORIES.forEach(x => { const id = x.mine || x.av?.p; if(id && P[id] && !P[id].ai && (x.mine || id===meId() || P[id]._ren)) x.who = P[id].name; }); }
function settingsModal(){
  const p = P[meId()];
  const row = (k, t, s) => `<div class="set-row"><div><b>${t}</b><small>${s}</small></div><span class="sw ${SET[k]?'on':''}" data-k="${k}"></span></div>`;
  const o = openOvl(`<div class="modal wide set"><div class="modal-h"><div class="sym" style="background:var(--mint);color:var(--mint-ink)">⚙️</div><div><b>تنظیمات</b><small>SmartClass گفتگو · نسخهٔ کامل</small></div></div>
    <div class="modal-b" style="max-height:66vh;overflow:auto">
      <div class="set-sec"><h4>پروفایل · ${state.role==='teacher'?'معلم':'دانش‌آموز'}</h4>
        <div class="prof"><button class="prof-av" id="sAv">${avHTML(meId(),'lg noon')}<span>📷</span></button><div style="flex:1;display:grid;gap:8px"><div class="fld"><input id="sName" value="${esc(p.name)}" placeholder="نام"></div><div class="fld"><input id="sTitle" value="${esc(p.title||'')}" placeholder="عنوان (مثلاً پایهٔ سوم)"></div></div></div></div>
      <div class="set-sec"><h4>ظاهر</h4>
        <div class="set-row"><div><b>تم تیره</b><small>تغییر با انیمیشن دایره‌ای</small></div><span class="sw ${document.documentElement.dataset.theme==='dark'?'on':''}" id="sTheme"></span></div>
        <div class="set-row"><div><b>اندازهٔ متن پیام‌ها</b><small id="sFsV">${fa(SET.fs)} پیکسل</small></div><input type="range" id="sFs" min="13" max="19" value="${SET.fs}" style="accent-color:var(--green);width:130px"></div>
        ${row('reduce','کاهش انیمیشن‌ها','برای دستگاه‌های ضعیف‌تر')}</div>
      <div class="set-sec"><h4>اعلان‌ها و رفتار</h4>
        ${row('sound','صدای پیام','صدای کوتاه هنگام ارسال و دریافت')}
        ${row('desk','اعلان دسکتاپ','وقتی این برگه باز نیست')}
        ${row('enter','ارسال با Enter','در حالت خاموش، Ctrl+Enter ارسال می‌کند')}
        ${row('sim','پاسخ‌های خودکار نمونه','اعضای نمونه به پیام‌ها جواب می‌دهند')}</div>
      <div class="set-sec"><h4>داده‌ها</h4>
        <p class="hint">همهٔ پیام‌ها، عکس‌ها و فایل‌ها روی همین مرورگر ذخیره می‌شوند. برای گفتگوی همزمان معلم و دانش‌آموز، این فایل را در دو برگه باز کنید و نقش یکی را عوض کنید.</p>
        <div class="set-btns"><button class="btn sec" id="sExp">⬇️ پشتیبان‌گیری</button><button class="btn sec" id="sImp">⬆️ بازیابی</button><button class="btn sec" id="sRole">🔁 تغییر نقش</button><button class="btn sec dg" id="sReset">🗑️ پاک کردن همه</button></div>
        <p class="hint" id="sUse"></p></div>
    </div>
    <div class="modal-f"><button class="btn pri" id="sOk">ذخیره</button></div></div>`);
  navigator.storage?.estimate?.().then(e => { const el = $('#sUse'); if(el) el.textContent = `فضای استفاده‌شده: ${fmtSize(e.usage||0)}`; });
  let newImg = null;
  $$('.sw[data-k]', o).forEach(s => s.onclick = async () => {
    const k = s.dataset.k; SET[k] = !SET[k]; s.classList.toggle('on', SET[k]);
    if(k==='desk' && SET.desk && 'Notification' in window && Notification.permission!=='granted'){ const r = await Notification.requestPermission(); if(r!=='granted'){ SET.desk = false; s.classList.remove('on'); toast('اجازهٔ اعلان داده نشد','🔕'); } }
    saveSet();
  });
  $('#sTheme').onclick = e => { const r = e.target.getBoundingClientRect(); $('#themeBtn').dispatchEvent(new MouseEvent('click', {clientX:r.left+20, clientY:r.top+10, bubbles:true})); [60,400,900].forEach(t => setTimeout(() => e.target.classList.toggle('on', document.documentElement.dataset.theme==='dark'), t)); };
  $('#sFs').oninput = e => { SET.fs = +e.target.value; $('#sFsV').textContent = fa(SET.fs) + ' پیکسل'; saveSet(); };
  $('#sAv').onclick = async () => { const [f] = await pickFiles('image/*'); if(!f) return; const b = await compressImage(f, 320, .85); newImg = await toDataURL(b); $('#sAv .av').innerHTML = `<img src="${newImg}" alt="">`; };
  $('#sOk').onclick = () => {
    const n = $('#sName').value.trim(); if(n && n!==p.name){ p.name = n; p._ren = 1; } p.title = $('#sTitle').value.trim(); if(newImg) p.img = newImg;
    closeOvl(); syncStories(); renderRole(); renderStories(); renderList(); if(state.cur) renderMsgs(state.cur); toast('تنظیمات ذخیره شد','⚙️');
  };
  $('#sExp').onclick = exportData; $('#sImp').onclick = importData;
  $('#sRole').onclick = () => { closeOvl(); setTimeout(() => $('#roleBtn').click(), 300); };
  $('#sReset').onclick = () => confirmBox('پاک کردن همهٔ داده‌ها', 'همهٔ پیام‌ها، کلاس‌ها، عکس‌ها و تنظیمات از این مرورگر پاک می‌شود.', async () => { await DB.clear(); Object.keys(localStorage).filter(k => k.startsWith('sc_')).forEach(k => localStorage.removeItem(k)); sessionStorage.clear(); bc && bc.postMessage({t:'reset', tab:TAB}); location.reload(); });
}
async function exportData(){
  toast('در حال آماده‌سازی پشتیبان…','⏳');
  const keys = await DB.keys('blobs'), blobs = {};
  for(const k of keys){ const b = await DB.get(k, 'blobs'); if(b) blobs[k] = await toDataURL(b); }
  const data = {app:'smartclass-goftogu', v:1, at:Date.now(), state:JSON.parse(serial()), blobs, profile:JSON.parse(localStorage.getItem('sc_profile')||'{}'), set:SET};
  const u = URL.createObjectURL(new Blob([JSON.stringify(data)], {type:'application/json'}));
  const a = document.createElement('a'); a.href = u; a.download = `smartclass-backup-${new Date().toISOString().slice(0,10)}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(u), 4000); toast('فایل پشتیبان ذخیره شد','✅');
}
async function importData(){
  const [f] = await pickFiles('.json,application/json'); if(!f) return;
  try{
    const d = JSON.parse(await f.text()); if(d.app!=='smartclass-goftogu') throw 0;
    await DB.clear();
    for(const [k, v] of Object.entries(d.blobs||{})){ const b = await (await fetch(v)).blob(); await DB.put(k, b, 'blobs'); }
    await DB.put('state', {json:JSON.stringify(d.state), at:Date.now(), tab:'import'});
    localStorage.setItem('sc_profile', JSON.stringify(d.profile||{onb:1})); if(d.set) localStorage.setItem('sc_set', JSON.stringify(d.set));
    bc && bc.postMessage({t:'reset', tab:TAB}); toast('بازیابی انجام شد؛ در حال بارگذاری…','✅'); setTimeout(() => location.reload(), 900);
  }catch(e){ toast('این فایل پشتیبان معتبر نیست','⚠️'); }
}
// Enter-to-send preference
document.addEventListener('keydown', e => {
  if(e.target!==inp || e.key!=='Enter' || e.shiftKey) return;
  if(['#cmdp','#mentp'].some(s => $(s).classList.contains('show'))) return;
  if(!SET.enter){ e.stopPropagation(); if(e.ctrlKey || e.metaKey){ e.preventDefault(); send(); } }
}, true);
// Gear button in rail
(() => {
  const b = document.createElement('button'); b.className = 'rbtn'; b.id = 'setBtn'; b.style.height = '48px';
  b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.3a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.6a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.3a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.3a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.6a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.3a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg><span class="tip">تنظیمات</span>';
  $('#themeBtn').before(b); b.onclick = settingsModal;
})();
QUICK.push({ic:'⚙️', t:'تنظیمات', run:settingsModal}, {ic:'✚', t:'گفتگو یا کلاس جدید', run:() => newChatModal()}, {ic:'⬇️', t:'پشتیبان‌گیری از داده‌ها', run:exportData});
