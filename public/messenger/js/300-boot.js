/* =========================================================
   Boot
   ========================================================= */
(async () => {
  const prof = JSON.parse(localStorage.getItem('sc_profile') || 'null');
  state.role = sessionStorage.getItem('sc_role') || prof?.role || 'student';
  renderRole(); skeleton(); renderStories();
  const t0 = Date.now();
  // 1) real school server?  2) not signed in?  3) otherwise the offline demo below
  const net = await SRV.detect();
  if(net === 'auth'){ NET.status = 'auth'; await sleep(Math.max(0, 1200 - (Date.now() - t0))); SRV.gate(); return; }
  if(net && net.data){
    SRV.start(net.data);
    await sleep(Math.max(0, 1500 - (Date.now() - t0)));
    $('#splash').classList.add('out'); setTimeout(() => $('#splash')?.remove(), 1000);
    $('#shell').classList.add('on');
    renderRole(); renderStories();
    moveRail($('#railNav .active') || $('#railNav button')); renderList(true); moveFold(); updateTaskDot();
    const hi = 'sc_srv_hello_' + NET.me;
    if(!localStorage.getItem(hi)){ localStorage.setItem(hi, '1'); setTimeout(() => toast(`خوش آمدی ${esc(P[NET.me].name)}؛ گفتگوهای کلاس اینجا همگام می‌شوند`, '✨'), 900); }
    return;
  }
  NET.status = 'local';
  let remote = null; try{ remote = await DB.get('state'); }catch(e){}
  if(remote){
    const d = JSON.parse(remote.json);
    chats.length = 0; d.chats.forEach(c => chats.push(c));
    Object.keys(P).forEach(k => delete P[k]); Object.assign(P, d.P);
    STORIES.length = 0; (d.STORIES||[]).forEach(s => STORIES.push(s));
    (d.deleted||[]).forEach(x => DELETED.add(x));
    STUDENTS.length = 0; Object.keys(P).filter(k => P[k].role==='student').forEach(k => STUDENTS.push(k));
    savedAt = remote.at;
    await resolveMedia(chats);
  }
  await sleep(Math.max(0, 1900 - (Date.now() - t0)));
  $('#splash').classList.add('out');
  if(!prof || !remote){ await sleep(500); $('#splash')?.remove(); await onboarding(); }
  else setTimeout(() => $('#splash')?.remove(), 1000);
  if(remote) loadUnread();
  $('#shell').classList.add('on');
  loaded = true; lastJSON = ''; await save(true);
  syncStories(); renderRole(); renderStories();
  moveRail($('#railNav .active') || $('#railNav button')); renderList(true); moveFold(); updateTaskDot();
  if(!prof) setTimeout(() => toast(`خوش آمدی ${P[meId()].name}؛ برای ساختن کلاس یا گفتگو دکمهٔ ✎ را بزن`,'✨'), 900);
})();
