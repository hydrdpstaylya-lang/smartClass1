/* ---------- Serialize / merge ---------- */
const SKIP = new Set(['typing','draft','unread','mention']);
function serial(){
  return JSON.stringify({chats, P, STORIES, deleted:[...DELETED]}, function(k, v){
    if(SKIP.has(k)) return undefined;
    if(k==='img' && this.imgKey) return undefined;
    return v;
  });
}
const DELETED = new Set();
let lastJSON = '', saving = false, loaded = false;
function unreadKey(){ return 'sc_unread_' + state.role; }
function saveUnread(){ const o = {}; chats.forEach(c => { if(c.unread || c.mention) o[c.id] = [c.unread||0, c.mention?1:0]; }); localStorage.setItem(unreadKey(), JSON.stringify(o)); }
function loadUnread(){ const o = JSON.parse(localStorage.getItem(unreadKey()) || '{}'); chats.forEach(c => { const u = o[c.id]; c.unread = u ? u[0] : 0; c.mention = u ? !!u[1] : false; }); }
async function resolveMedia(list){
  for(const c of list) for(const m of c.msgs){ if(m.imgKey && !m.img) m.img = await blobURL(m.imgKey); }
}
function applyRemote(data, preferRemote){
  const added = [];
  (data.deleted || []).forEach(id => DELETED.add(id));
  Object.keys(data.P || {}).forEach(id => { if(!P[id]) P[id] = data.P[id]; else if(preferRemote) Object.assign(P[id], data.P[id]); });
  if(data.STORIES && preferRemote){ STORIES.length = 0; data.STORIES.forEach(s => STORIES.push(s)); }
  data.chats.forEach(rc => {
    if(DELETED.has(rc.id)) return;
    let lc = chats.find(c => c.id===rc.id);
    if(!lc){ chats.push(rc); rc.msgs.forEach(m => added.push({c:rc, m})); return; }
    const keep = {typing:lc.typing, draft:lc.draft, unread:lc.unread, mention:lc.mention};
    if(preferRemote){ const msgs = lc.msgs; Object.keys(rc).forEach(k => { if(k!=='msgs') lc[k] = rc[k]; }); lc.msgs = msgs; }
    Object.assign(lc, keep);
    rc.msgs.forEach(rm => {
      if(DELETED.has(rm.id)) return;
      const lm = lc.msgs.find(x => x.id===rm.id);
      if(!lm){ lc.msgs.push(rm); added.push({c:lc, m:rm}); }
      else if(preferRemote){ const img = lm.img; Object.keys(lm).forEach(k => { if(!(k in rm) && k!=='img') delete lm[k]; }); Object.assign(lm, rm); if(rm.imgKey) lm.img = img; }
    });
    lc.msgs = lc.msgs.filter(m => !DELETED.has(m.id)).sort((a,b) => a.ts - b.ts);
  });
  for(let i = chats.length-1; i >= 0; i--) if(DELETED.has(chats[i].id)) chats.splice(i,1);
  return added;
}
async function save(force){
  if(!loaded || saving) return;
  const js = serial(); if(js===lastJSON && !force) return;
  saving = true;
  try{
    const remote = await DB.get('state');
    if(remote && remote.tab!==TAB && remote.at > savedAt) applyRemote(JSON.parse(remote.json), false);
    const out = serial();
    savedAt = Date.now();
    await DB.put('state', {json:out, at:savedAt, tab:TAB});
    lastJSON = out;
    bc && bc.postMessage({t:'sync', tab:TAB});
  }catch(e){ console.warn(e); }
  saving = false; saveUnread();
}
let savedAt = 0;
setInterval(() => save(), 800);
addEventListener('pagehide', () => { saveUnread(); });

async function onRemoteSync(){
  const remote = await DB.get('state'); if(!remote || remote.tab===TAB) return;
  savedAt = remote.at;
  const data = JSON.parse(remote.json);
  const cur = state.cur;
  const added = applyRemote(data, true);
  await resolveMedia(chats);
  lastJSON = serial();
  // Re-render
  if(state.cur && !chats.includes(state.cur)){ showEmpty(); state.cur = null; }
  if(state.cur){
    const c = state.cur;
    $$('.row[data-id]', msgsEl).forEach(r => { const m = c.msgs.find(x => x.id===r.dataset.id); if(!m) r.remove(); else if(r._json !== JSON.stringify(m)){ r._m = m; refreshRow(m); r._json = JSON.stringify(m); } });
    updatePin(c);
  }
  added.forEach(({c, m}) => {
    if(!c.vis.includes(state.role)) return;
    if(m.sys){ if(state.cur===c) appendMsg(m, c); return; }
    if(isMe(m.by) && !c.saved) return;
    if(c.typing===m.by) { c.typing = null; if(state.cur===c){ setSt(c); $('.typing-row', msgsEl)?.remove(); } }
    if(state.cur===c){
      const nb = nearBottom(); const row = appendMsg(m, c); if(row) row._json = JSON.stringify(m);
      if(nb) toBottom(); if(!document.hidden){ m.read = 1; }
      setChips(smartFor(c, m)); playSound('in');
    } else {
      c.unread = (c.unread||0) + 1;
      if((m.t||'').includes('@' + P[meId()].name.replace(/\s/g,'_'))) c.mention = true;
      notify(c, m);
    }
  });
  renderList(); updateTaskDot(); renderStories(); renderRole();
  if($('#info').classList.contains('show')) renderInfo();
}
const typingT = {};
bc && (bc.onmessage = e => {
  const d = e.data; if(!d || d.tab===TAB) return;
  if(d.t==='sync') onRemoteSync();
  if(d.t==='typing'){
    const c = chats.find(x => x.id===d.chat); if(!c || d.who===meId() || !c.vis.includes(state.role)) return;
    if(c.typing!==d.who) setTyping(c, d.who);
    clearTimeout(typingT[c.id]); typingT[c.id] = setTimeout(() => { if(c.typing===d.who) setTyping(c, null); }, 3500);
  }
  if(d.t==='reset') location.reload();
});
let lastTypingSent = 0;
inp.addEventListener('input', () => {
  if(!bc || !state.cur || !inp.value.trim() || state.cur.bot) return;
  if(Date.now() - lastTypingSent > 1500){ lastTypingSent = Date.now(); bc.postMessage({t:'typing', tab:TAB, chat:state.cur.id, who:meId()}); }
});
// Mark incoming as read when chat is visible
setInterval(() => {
  const c = state.cur; if(!c || document.hidden) return;
  c.msgs.forEach(m => { if(!m.read && !isMe(m.by) && !m.sys) m.read = 1; });
}, 1200);
