/* =========================================================
   Server adapter — connects the messenger UI to /api/chat/*
   ---------------------------------------------------------
   The UI keeps mutating plain objects (chats / P / messages) exactly like the
   offline demo. This adapter:
     1. pulls changes from GET /api/chat/sync with a revision cursor (short polling),
     2. merges them through applyRemote() and repaints only the rows that changed,
     3. diffs local objects against a "shadow" of the last server state and turns
        every difference into a batched operation for POST /api/chat/push,
     4. stores photos, files and voice notes in private storage via signed URLs.
   When the API is missing (file://, static preview, 404/503) the demo keeps working
   in local mode; when the visitor is not signed in a sign-in gate is shown.
   ========================================================= */
const SRV = (() => {
  const POLL = 2200, POLL_IDLE = 9000, FLUSH = 450, BEAT = 30000;
  const SAVED = 'c9';                       // client id of "saved messages"
  const LOCAL_ONLY = c => !!c.bot;          // Raiva lives in the browser only
  const KNOWN = new Map();                  // server chat id -> public chat row
  const MEMB = new Map();                   // server chat id -> Map(user id -> member row)
  const SH = new Map();                     // message id -> signature of last server state
  const SHC = new Map();                    // client chat id -> signature of chat prefs
  const SENT = new Set();                   // message ids already accepted by the server
  const FAILED = new Set();                 // message ids rejected by the server (never retried)
  const CREATING = new Set(), GONE = new Set(), DONE_DEL = new Set();
  const REVS = new Map();                   // message id -> last applied revision
  const MSGCHAT = new Map();                // message id -> client chat id (to recognise "clear history")
  let cursor = 0, skew = 0, myNum = 0, lastBeat = 0, pollT = 0, flushing = false, syncing = false, resync = false, backoff = 0;
  let queue = [];                           // ephemeral ops (typing, profile)
  const now = () => Date.now() + skew;      // server clock

  /* ---------- transport ---------- */
  async function api(path, body, method){
    const opt = {method: method || (body === undefined ? 'GET' : 'POST'), credentials: 'same-origin', cache: 'no-store', headers: {Accept: 'application/json'}};
    if(body !== undefined){ opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    const r = await fetch(NET.api + path, opt);
    const ct = r.headers.get('content-type') || '';
    const j = ct.includes('json') ? await r.json().catch(() => ({})) : {};
    if(!r.ok){ const e = new Error(j.error || ('HTTP ' + r.status)); e.status = r.status; e.api = ct.includes('json'); throw e; }
    return j;
  }
  const toC = sid => sid === 'sv-' + myNum ? SAVED : sid;
  const toS = id => id === SAVED ? 'sv-' + myNum : id;
  const num = cid => Number(String(cid).slice(1)) || 0;
  const hash = s => { let h = 7; for(const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
  const COLORS = ['#16866f','#2c7aa6','#c47a1c','#8b5cf6','#d9485f','#0f766e','#b45309','#4f46e5'];

  /* ---------- people ---------- */
  function person(u){
    const old = P[u.id] || {};
    const p = Object.assign(old, {
      name: u.name || 'کاربر', short: u.name || 'کاربر', role: u.role, staff: !!u.admin,
      title: u.title || (u.admin ? 'مدیر مدرسه' : u.role === 'teacher' ? 'آموزگار' : 'دانش‌آموز'),
      g: hash(u.id) % 8, color: COLORS[hash(u.id) % COLORS.length], seen: u.seen || 0,
      online: !!u.seen && now() - u.seen < 75000,
    });
    if(u.av) p.img = `${NET.api}/avatar?u=${num(u.id)}&v=${u.av}`; else if(!String(p.img || '').startsWith('data:')) delete p.img;
    P[u.id] = p;
    if(u.role === 'student' && !STUDENTS.includes(u.id)) STUDENTS.push(u.id);
    return p;
  }
  const profSig = p => JSON.stringify([p.name, p.title, String(p.img || '').startsWith('data:') ? p.img.length + ':' + p.img.slice(-24) : '']);
  let profShadow = '';

  /* ---------- server -> client shapes ---------- */
  function readBy(sid, ts, exceptMe = true){
    const mm = MEMB.get(sid); if(!mm) return 0; let n = 0;
    for(const [u, m] of mm) if((!exceptMe || u !== NET.me) && (m.read || 0) >= ts) n++;
    return n;
  }
  function clientMsg(sm, sid){
    const chat = KNOWN.get(sid), m = {id: sm.id, ts: sm.ts};
    for(const k of ['by','t','reply','fwd','imgKey','img','stk','sys','file','voice','grade','edited','react','my','quiz','assign','att']) if(sm[k] !== undefined) m[k] = structuredClone(sm[k]);
    if(m.imgKey) m.img = URLS[m.imgKey] || '';
    if(m.file) m.file.ok = true;
    if(m.assign){ m.assign.files ||= {}; m.assign.grades ||= {}; }
    if(m.quiz) m.quiz.voted ||= {};
    if(chat?.type === 'channel') m.views = Math.max(1, readBy(sid, m.ts, false));
    if(isMe(m.by) && chat?.type !== 'saved') m.read = readBy(sid, m.ts) ? 1 : 0; else m.read = 1;
    return m;
  }
  function msgSig(m){
    const me = meId();
    return JSON.stringify([
      m.t || '', !!m.edited, (m.my || []).slice().sort(),
      m.quiz ? m.quiz.voted?.[me] ?? null : null,
      m.assign ? [m.assign.subs.includes(me), m.assign.grades || {}] : null,
      m.att ? [m.att.list, !!m.att.done] : null,
    ]);
  }
  function clientChat(s){
    const me = MEMB.get(s.id)?.get(NET.me) || {};
    const saved = s.type === 'saved', personal = s.type === 'personal';
    return {
      id: toC(s.id), sid: s.id, type: s.type === 'group' ? 'class' : saved ? 'personal' : s.type, group: s.type === 'group' || undefined,
      saved: saved || undefined, name: saved ? 'پیام‌های ذخیره‌شده' : personal ? '' : s.name,
      sym: s.sym || (s.name || '؟').trim().slice(0, 1), g: s.g || 0,
      members: saved ? ['@me'] : s.members.slice(), vis: ['student','teacher'],
      admin: s.admin ? state.role : (s.type === 'channel' ? 'none' : undefined), verified: s.type === 'channel' || undefined,
      owner: s.owner, pinnedMsg: s.pinnedMsg || null, live: !!s.live, pinned: !!me.pinned, muted: !!me.muted,
    };
  }
  const chatSig = c => JSON.stringify([!!c.pinned, !!c.muted, c.pinnedMsg || null, !!c.live]);

  /* ---------- incoming ---------- */
  function ingest(d, full){
    skew = (d.at || Date.now()) - Date.now();
    if(d.me){ NET.user = d.me; NET.me = d.me.id; myNum = num(d.me.id); person(d.me); }
    (d.directory || []).forEach(person);
    (d.users || []).forEach(person);
    if(d.me) profShadow = profSig(P[NET.me]);
    d.chats.forEach(s => { KNOWN.set(s.id, s); if(!MEMB.has(s.id)) MEMB.set(s.id, new Map()); });
    const memberChats = new Set();
    // members of fresh chats are a full snapshot
    (d.fresh || []).forEach(id => MEMB.set(id, new Map()));
    d.members.forEach(m => { (MEMB.get(m.chat) || MEMB.set(m.chat, new Map()).get(m.chat)).set(m.user, m); memberChats.add(m.chat); });
    // chats I am no longer part of
    if(Array.isArray(d.ids)){
      const keep = new Set(d.ids);
      for(const id of [...KNOWN.keys()]) if(!keep.has(id)){ KNOWN.delete(id); MEMB.delete(id); GONE.add(toC(id)); }
    }
    const byChat = new Map(), changed = new Set(), first = !!full;
    for(const sm of d.messages){
      // the cursor overlaps a few revisions on purpose; skip rows we already applied
      if(!full && (REVS.get(sm.id) || 0) >= sm.rev) continue;
      REVS.set(sm.id, sm.rev);
      if(sm.deleted){ DELETED.add(sm.id); SH.delete(sm.id); changed.add(sm.id); continue; }
      (byChat.get(sm.chat) || byChat.set(sm.chat, []).get(sm.chat)).push(sm);
    }
    const data = {chats: [], P: {}};
    for(const [sid, s] of KNOWN){
      const touched = d.chats.some(x => x.id === sid) || byChat.has(sid) || memberChats.has(sid);
      if(!touched) continue;
      const rc = clientChat(s);
      rc.members.forEach(id => { if(id !== '@me' && !P[id]) person({id, name: 'کاربر', role: 'student'}); });
      const hidden = MEMB.get(sid)?.get(NET.me)?.hidden || 0;
      if(hidden && !byChat.has(sid) && !chats.some(c => c.id === rc.id)) continue;   // a private chat I deleted stays hidden until a new message
      rc.msgs = (byChat.get(sid) || []).filter(sm => !DELETED.has(sm.id)).map(sm => { const m = clientMsg(sm, sid); changed.add(m.id); return m; });
      rc.msgs.sort((a, b) => a.ts - b.ts);
      data.chats.push(rc);
    }
    // keep local ui-only state of chats while applyRemote overwrites server fields
    const added = applyRemote(data, true);
    for(const rc of data.chats){
      const lc = chats.find(c => c.id === rc.id); if(!lc) continue;
      SHC.set(lc.id, chatSig(lc));
      rc.msgs.forEach(m => { SH.set(m.id, msgSig(lc.msgs.find(x => x.id === m.id) || m)); SENT.add(m.id); MSGCHAT.set(m.id, lc.id); });
      // read receipts / channel views move when member pointers move
      if(memberChats.has(rc.sid)) lc.msgs.forEach(m => {
        if(!m.by || m.sys) return;
        if(lc.type === 'channel'){ const v = Math.max(1, readBy(rc.sid, m.ts, false)); if(v !== m.views){ m.views = v; changed.add(m.id); } }
        if(isMe(m.by) && !lc.saved && !m.read && readBy(rc.sid, m.ts)){ m.read = 1; changed.add(m.id); }
      });
      const mm = MEMB.get(rc.sid);
      // unread counts on the very first load come from my read pointer
      if(first){
        const mine = mm?.get(NET.me), lr = mine?.read || 0;
        const un = lc.msgs.filter(m => !m.sys && !isMe(m.by) && m.ts > lr);
        lc.unread = un.length; lc.mention = un.some(m => (m.t || '').includes('@' + P[NET.me].name.replace(/\s/g, '_')));
      }
    }
    // typing indicators expire on the server clock, so check every chat on every sync
    const t = now();
    for(const lc of chats){
      if(lc.bot || lc.saved) continue;
      const mm = MEMB.get(toS(lc.id)); if(!mm) continue;
      const typer = [...mm.values()].find(m => m.user !== NET.me && (m.typing || 0) > t);
      if((typer?.user || null) !== (lc.typing || null)) setTyping(lc, typer ? typer.user : null);
    }
    for(const id of GONE){ const i = chats.findIndex(c => c.id === id); if(i >= 0) chats.splice(i, 1); }
    GONE.clear();
    if(d.next !== undefined) cursor = Math.max(cursor, d.next);
    return {added: first ? [] : added, changed};
  }

  async function resolve(){
    const todo = [];
    for(const c of chats) for(const m of c.msgs) if(m.imgKey && !m.img) todo.push(blobURL(m.imgKey).then(u => { if(u){ m.img = u; const r = rowOf(m.id); if(r) refreshRow(m, c); } }));
    await Promise.allSettled(todo);
  }

  function paint({added, changed}){
    if(state.cur && !chats.includes(state.cur)){ showEmpty(); state.cur = null; }
    const c = state.cur;
    if(c){
      $$('.row[data-id]', msgsEl).forEach(r => {
        const m = c.msgs.find(x => x.id === r.dataset.id);
        if(!m){ r.style.transition = 'opacity .3s, transform .3s'; r.style.opacity = 0; r.style.transform = 'scale(.92)'; setTimeout(() => r.remove(), 300); return; }
        if(changed.has(m.id)){ r._m = m; refreshRow(m, c); refreshMeta(r, m); }
      });
      updatePin(c); $('#livebar').classList.toggle('show', !!c.live);
    }
    added.forEach(({c, m}) => {
      if(m.sys){ if(state.cur === c) appendMsg(m, c, {anim: true}); return; }
      if(isMe(m.by)){ if(state.cur === c){ appendMsg(m, c, {anim: true}); toBottom(); } return; }
      if(c.typing === m.by) setTyping(c, null);
      if(state.cur === c && !document.hidden){
        const nb = nearBottom(); appendMsg(m, c, {anim: true}); if(nb) toBottom(); m.read = 1;
        setChips(smartFor(c, m)); playSound('in');
      } else {
        c.unread = (c.unread || 0) + 1;
        if((m.t || '').includes('@' + P[meId()].name.replace(/\s/g, '_'))) c.mention = true;
        notify(c, m);
      }
    });
    if(added.length || changed.size){ renderList(); updateTaskDot(); if($('#info').classList.contains('show')) renderInfo(); }
  }

  async function sync(){
    if(syncing) return; syncing = true;
    try{
      const beat = Date.now() - lastBeat > BEAT; if(beat) lastBeat = Date.now();
      const full = resync; resync = false;
      const d = await api(`/sync?rev=${full ? 0 : cursor}&full=${full ? 1 : 0}&at=${now()}${beat ? '&beat=1' : ''}`);
      const r = ingest(d, full); await resolve(); paint(r);
      backoff = 0; status('online');
    }catch(e){
      if(e.status === 401){ status('auth'); gate(); return; }
      backoff = Math.min(6, backoff + 1); status('offline');
    }finally{ syncing = false; }
  }
  function schedule(){
    clearTimeout(pollT);
    const base = document.hidden ? POLL_IDLE : POLL;
    pollT = setTimeout(async () => { await flush(); await sync(); schedule(); }, base * (1 + backoff));
  }

  /* ---------- outgoing: diff local objects against the shadow ---------- */
  function wireMsg(m){
    const o = {id: m.id};
    for(const k of ['t','reply','fwd','stk','sys']) if(m[k]) o[k] = m[k];
    if(m.imgKey && String(m.imgKey).startsWith('srv:')) o.imgKey = m.imgKey;
    else if(m.img && /^(\/images\/|https:\/\/smart-class1\.vercel\.app\/images\/)/.test(m.img)) o.img = m.img;
    if(m.file?.key) o.file = {key: m.file.key, name: m.file.name, mime: m.file.mime, size: m.file.size};
    else if(m.file) o.t = (o.t ? o.t + '\n' : '') + '📄 ' + m.file.name;
    if(m.voice?.key) o.voice = {key: m.voice.key, dur: m.voice.dur, bars: m.voice.bars};
    if(m.assign) o.assign = {title: m.assign.title, subject: m.assign.subject, desc: m.assign.desc, due: m.assign.due};
    if(m.quiz) o.quiz = {q: m.quiz.q, opts: m.quiz.opts, correct: m.quiz.correct};
    if(m.att) o.att = {list: m.att.list};
    if(m.grade) o.grade = m.grade;
    if(!o.t && !o.stk && !o.sys && !o.imgKey && !o.img && !o.file && !o.voice && !o.assign && !o.quiz && !o.att && !o.grade) return null;
    return o;
  }
  function diff(){
    const ops = [], meta = [];
    const add = (op, info) => { ops.push(op); meta.push(info || {}); };
    // profile
    const p = P[NET.me];
    if(p && profSig(p) !== profShadow){
      const op = {type: 'profile', name: p.name, title: p.title || ''};
      if(String(p.img || '').startsWith('data:')) op.avatar = p.img;
      add(op, {profile: profSig(p)});
    }
    for(const c of chats){
      if(LOCAL_ONLY(c)) continue;
      const sid = toS(c.id);
      if(!KNOWN.has(sid)){
        if(CREATING.has(sid) || c.saved) continue;
        const others = c.members.filter(x => /^u\d+$/.test(x) && x !== NET.me);
        const type = c.type === 'personal' ? 'personal' : c.type === 'channel' ? 'channel' : (state.role === 'teacher' ? 'class' : 'group');
        const sys = c.msgs.find(m => m.sys);
        CREATING.add(sid);
        add({type: 'chat.create', chat: {id: sid, type, name: c.name, sym: c.sym, g: c.g, members: others}, sys: sys && {id: sys.id, text: sys.sys}}, {create: c, sys});
        continue;
      }
      // prefs & chat-level fields
      const s = KNOWN.get(sid), sig = chatSig(c), old = SHC.get(c.id);
      if(old && sig !== old){
        const [pn, mu, pm, lv] = JSON.parse(old);
        if(!!c.pinned !== pn || !!c.muted !== mu) add({type: 'chat.pref', chat: sid, pinned: !!c.pinned, muted: !!c.muted});
        const upd = {type: 'chat.update', chat: sid}; let u = 0;
        if((c.pinnedMsg || null) !== pm){ upd.pinnedMsg = c.pinnedMsg || null; u = 1; }
        if(!!c.live !== lv){ upd.live = !!c.live; u = 1; }
        if(u) add(upd);
        SHC.set(c.id, sig);
      }
      // new members (teacher adds students to a class)
      if(!c.saved && c.type !== 'personal'){
        const extra = c.members.filter(x => /^u\d+$/.test(x) && !s.members.includes(x));
        if(extra.length){ const sys = c.msgs.find(m => m.sys && !SENT.has(m.id) && !SH.has(m.id)); if(sys) SENT.add(sys.id); s.members.push(...extra); add({type: 'chat.members', chat: sid, members: extra, sys: sys && {id: sys.id, text: sys.sys}}, {sys}); }
      }
      // read pointer
      if(state.cur === c && !document.hidden){
        const last = c.msgs.filter(m => !m.sys && !isMe(m.by) && SENT.has(m.id)).slice(-1)[0];
        const mine = MEMB.get(sid)?.get(NET.me);
        if(last && mine && (mine.read || 0) < last.ts){ mine.read = last.ts; add({type: 'chat.pref', chat: sid, read: last.ts}); }
      }
      // messages
      for(const m of c.msgs){
        if(FAILED.has(m.id)) continue;
        if(!SENT.has(m.id)){
          if(m.sending) continue;
          const w = wireMsg(m); if(!w){ SENT.add(m.id); continue; }
          m.sending = true; add({type: 'msg.send', chat: sid, msg: w}, {send: m, chat: c});
          continue;
        }
        const now_ = msgSig(m), was = SH.get(m.id); if(!was || now_ === was) continue;
        const [t, ed, my, vote, asg, att] = JSON.parse(was);
        if(m.edited && (m.t || '') !== t) add({type: 'msg.op', id: m.id, op: 'edit', t: m.t || ''});
        const myNow = (m.my || []).slice().sort();
        if(JSON.stringify(myNow) !== JSON.stringify(my)) add({type: 'msg.op', id: m.id, op: 'react', emos: myNow});
        const v = m.quiz?.voted?.[NET.me];
        if(m.quiz && v !== undefined && vote === null) add({type: 'msg.op', id: m.id, op: 'vote', i: v});
        if(m.assign){
          if(m.assign.subs.includes(NET.me) && asg && !asg[0]){ const f = m.assign.files?.[NET.me] || {}; add({type: 'msg.op', id: m.id, op: 'submit', file: {note: f.note || '', key: String(f.key || '').startsWith('srv:') ? f.key : undefined, name: f.name, mime: f.mime, size: f.size}}); }
          const g0 = asg ? asg[1] : {}, g1 = m.assign.grades || {};
          for(const [u, g] of Object.entries(g1)) if(g0[u] !== g) add({type: 'msg.op', id: m.id, op: 'grade', user: u, grade: g});
        }
        if(m.att && att && (JSON.stringify(m.att.list) !== JSON.stringify(att[0]) || !!m.att.done !== att[1])) add({type: 'msg.op', id: m.id, op: 'att', list: m.att.list, done: !!m.att.done});
        SH.set(m.id, now_);
      }
    }
    // deletions: messages, cleared histories, deleted / left chats
    const cleared = new Map();
    for(const id of DELETED){
      if(DONE_DEL.has(id)) continue; DONE_DEL.add(id);
      if(/^(pm-|sv-|c[0-9a-z]{6,})/.test(id) && (KNOWN.has(id) || KNOWN.has(toS(id)))){ add({type: 'chat.leave', chat: toS(id)}); continue; }
      if(!SH.has(id)) continue;
      SH.delete(id);
      const c = chats.find(x => x.id === MSGCHAT.get(id));
      if(c && c.msgs.length === 0 && c._had){ cleared.set(c.id, (cleared.get(c.id) || 0) + 1); continue; }
      add({type: 'msg.op', id, op: 'delete'});
    }
    for(const [cid_] of cleared) add({type: 'chat.pref', chat: toS(cid_), hide: true});
    chats.forEach(c => { c._had = c.msgs.length > 0; });
    ops.push(...queue.splice(0)); while(meta.length < ops.length) meta.push({});
    return {ops, meta};
  }
  async function flush(){
    if(flushing || !NET.on) return; flushing = true;
    try{
      const {ops, meta} = diff(); if(!ops.length) return;
      for(let i = 0; i < ops.length; i += 40){
        const part = ops.slice(i, i + 40), info = meta.slice(i, i + 40);
        let res;
        try{ res = await api('/push', {ops: part}); }
        catch(e){ info.forEach(x => { if(x.send) x.send.sending = false; if(x.create) CREATING.delete(toS(x.create.id)); }); if(e.status === 401){ gate(); } throw e; }
        res.results.forEach((r, k) => handle(part[k], info[k], r));
      }
      renderList();
    }catch(e){ status('offline'); }
    finally{ flushing = false; }
  }
  function handle(op, info, r){
    if(op.type === 'chat.create'){
      CREATING.delete(op.chat.id);
      if(!r.ok){ toast(r.error, '⚠️'); const c = info.create; const i = chats.indexOf(c); if(i >= 0 && r.status !== 409) chats.splice(i, 1); if(state.cur === c) showEmpty(); return; }
      if(info.sys) SENT.add(info.sys.id);
      if(r.id !== op.chat.id){ const c = info.create; c.id = toC(r.id); }
      sync();
      return;
    }
    if(op.type === 'chat.members' && info.sys) SENT.add(info.sys.id);
    if(op.type === 'profile' && r.ok){ profShadow = info.profile; if(r.av){ P[NET.me]._av = r.av; } return; }
    if(op.type === 'msg.send'){
      const m = info.send; m.sending = false;
      if(!r.ok){
        if(r.status >= 500){ return; } // transient: try again on the next flush
        FAILED.add(m.id); toast(r.error, '⚠️');
        const c = info.chat; c.msgs = c.msgs.filter(x => x !== m); const row = rowOf(m.id);
        if(row){ row.style.transition = 'opacity .35s, transform .35s'; row.style.opacity = 0; row.style.transform = 'translateX(30px)'; setTimeout(() => row.remove(), 360); }
        return;
      }
      SENT.add(m.id); m.pending = false;
      const sm = r.msg; if(sm){ m.ts = sm.ts; if(m.assign) Object.assign(m.assign, {created: sm.assign?.created ?? m.assign.created, due: sm.assign?.due ?? m.assign.due, total: sm.assign?.total ?? m.assign.total}); }
      SH.set(m.id, msgSig(m)); refreshMeta(rowOf(m.id), m);
      return;
    }
    if(!r.ok && r.status !== 404 && r.status !== 410){ toast(r.error, '⚠️'); resync = true; }
  }

  /* ---------- media in private storage ---------- */
  const SIGNED = {};
  async function upload(blob, name){
    const c = state.cur; if(!c || LOCAL_ONLY(c)) throw new Error('local');
    const sid = toS(c.id);
    if(!KNOWN.has(sid)){ await flush(); await sync(); if(!KNOWN.has(sid)) throw new Error('chat'); }
    const t = await api('/upload', {chat: sid, name: name || blob.name || 'file', mime: blob.type || 'application/octet-stream', size: blob.size});
    const fd = new FormData(); fd.append('cacheControl', '3600'); fd.append('', blob, name || blob.name || 'file');
    const r = await fetch(t.url, {method: 'PUT', body: fd, headers: {'x-upsert': 'false'}});
    if(!r.ok) throw new Error('upload ' + r.status);
    URLS[t.key] = URL.createObjectURL(blob);
    return t.key;
  }
  function install(){
    const localPut = putBlob, localURL = blobURL;
    putBlob = async function(blob){
      if(!state.cur || LOCAL_ONLY(state.cur)) return localPut(blob);
      const tip = toastSticky('در حال بارگذاری فایل…');
      try{ return await upload(blob, blob.name); }
      catch(e){ toast('بارگذاری ناموفق بود؛ اتصال را بررسی کن', '⚠️'); throw e; }
      finally{ tip(); }
    };
    blobURL = async function(key){
      if(!key) return '';
      if(!String(key).startsWith('srv:')) return localURL(key);
      if(URLS[key]) return URLS[key];
      const s = SIGNED[key]; if(s && s.until > Date.now()) return s.url;
      try{ const r = await api('/file?key=' + encodeURIComponent(key)); SIGNED[key] = {url: r.url, until: Date.now() + (r.ttl - 120) * 1000}; return r.url; }
      catch(e){ return ''; }
    };
    // deterministic private chat ids so both sides land in the same conversation
    personalWith = function(pid){
      const sid = 'pm-' + Math.min(myNum, num(pid)) + '-' + Math.max(myNum, num(pid));
      let c = chats.find(x => x.id === sid);
      if(!c){ c = {id: sid, type: 'personal', members: [NET.me, pid], vis: ['student','teacher'], msgs: []}; chats.push(c); }
      return c;
    };
    // Raiva answers with the real AI when the server has a provider, local tutor otherwise
    const localAnswer = raivaAnswer;
    raivaAnswer = async function(c, m){
      const q = (m.t || '').trim(); if(!q) return localAnswer(c, m);
      let text = null;
      try{
        const hist = c.msgs.filter(x => x.t && !x.sys).slice(-8).map(x => ({role: x.by === 'raiva' ? 'assistant' : 'user', content: x.t.slice(0, 1500)}));
        const r = await fetch('/api/ai', {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({messages: hist.length ? hist : [{role: 'user', content: q}]})});
        if(r.ok){ const j = await r.json(); text = j.text || null; }
      }catch(e){}
      if(!text) return localAnswer(c, m);
      const keep = raivaReply; raivaReply = () => text;
      try{ await localAnswer(c, m); } finally{ raivaReply = keep; }
    };
    // typing indicator → chat.pref typing (throttled)
    let lastTyping = 0;
    inp.addEventListener('input', () => {
      const c = state.cur; if(!c || LOCAL_ONLY(c) || c.saved || !inp.value.trim()) return;
      if(Date.now() - lastTyping > 3500){ lastTyping = Date.now(); queue.push({type: 'chat.pref', chat: toS(c.id), typing: true}); }
    });
    // role is decided by the school account, not by a toggle
    $('#roleBtn').addEventListener('click', e => { e.stopImmediatePropagation(); e.preventDefault(); accountCard(); }, true);
    // settings: account-specific section instead of local data tools
    const localSettings = settingsModal;
    settingsModal = function(){
      localSettings();
      const o = $('.modal.set'); if(!o) return;
      $('.sw[data-k="sim"]', o)?.closest('.set-row')?.remove();
      ['#sImp','#sRole','#sReset'].forEach(s => $(s, o)?.remove());
      const hint = $('.set-sec .hint', o); if(hint) hint.textContent = 'پیام‌ها، کلاس‌ها و فایل‌ها روی سرور مدرسه ذخیره می‌شوند و در همهٔ دستگاه‌های شما همگام هستند. پشتیبان فقط یک نسخهٔ خواندنی از همین مرورگر است.';
      const btns = $('.set-btns', o); if(btns) btns.insertAdjacentHTML('beforeend', '<a class="btn sec" href="/account/">👤 حساب کاربری</a><a class="btn sec" href="/">🏠 SmartClass</a>');
      const h4 = $('.set-sec h4', o); if(h4) h4.textContent = 'پروفایل · ' + (P[NET.me].staff ? 'مدیر' : state.role === 'teacher' ? 'آموزگار' : 'دانش‌آموز');
    };
    // new-chat modal: "عضو جدید" becomes "add real accounts to my classes"
    const localNew = newChatModal;
    newChatModal = function(tab){
      localNew(tab);
      const seg = $('#ncSeg'); if(!seg) return;
      const ub = $('button[data-v="u"]', seg); if(ub) ub.textContent = 'افزودن به کلاس';
      const drawU = () => {
        const b = $('#ncBody'); $('#ncOk').style.display = ''; $('#ncOk').textContent = 'افزودن';
        const classes = chats.filter(c => (c.type === 'class' || c.type === 'channel') && KNOWN.get(toS(c.id))?.admin);
        const people = Object.keys(P).filter(id => /^u\d+$/.test(id) && id !== NET.me);
        b.innerHTML = `<div class="fld"><label>کلاس یا کانال</label><div class="symc">${classes.map((c, i) => `<button data-c="${c.id}" class="cls ${i ? '' : 'on'}">${esc(chatName(c))}</button>`).join('') || '<small style="color:var(--muted)">هنوز کلاسی نساخته‌اید؛ از زبانهٔ «کلاس / گروه» شروع کنید.</small>'}</div></div>
          <div class="fld"><input id="ncQ" placeholder="جستجوی نام دانش‌آموز یا آموزگار…"></div>
          <div class="plist" id="ncList">${people.map((id, i) => `<div class="subr pk" data-id="${id}" style="animation-delay:${i * .02}s">${avHTML(id, 'sm noon')}<div class="sb"><b>${esc(P[id].name)}</b><small>${P[id].role === 'teacher' ? 'آموزگار' : 'دانش‌آموز'}${P[id].title ? ' · ' + esc(P[id].title) : ''}</small></div><span class="ck2"></span></div>`).join('') || '<div style="color:var(--muted);text-align:center;padding:20px">حسابی پیدا نشد. حساب‌ها از بخش «مدیریت کاربران» ساخته می‌شوند.</div>'}</div>`;
        $$('.cls', b).forEach(x => x.onclick = () => $$('.cls', b).forEach(y => y.classList.toggle('on', y === x)));
        $('#ncQ', b).oninput = e => $$('#ncList .pk', b).forEach(r => r.style.display = P[r.dataset.id].name.includes(e.target.value.trim()) ? '' : 'none');
        $$('#ncList .pk', b).forEach(r => r.onclick = () => r.classList.toggle('on'));
      };
      if(ub) ub.addEventListener('click', () => setTimeout(drawU, 0));
      if(tab === 'u') drawU();
      const ok = $('#ncOk'), localOk = ok.onclick;
      ok.onclick = () => {
        if($('#ncSeg .on')?.dataset.v !== 'u') return localOk();
        const cb = $('#ncBody .cls.on'), sel = $$('#ncList .pk.on').map(r => r.dataset.id);
        if(!cb || !sel.length) return toast('یک کلاس و دست‌کم یک نفر را انتخاب کنید', '✎');
        const c = chats.find(x => x.id === cb.dataset.c), add = sel.filter(x => !c.members.includes(x));
        c.members.push(...add);
        if(add.length) c.msgs.push({id: 'm' + nid(), sys: `${P[NET.me].name} ${add.length > 1 ? fa(add.length) + ' نفر' : '«' + P[add[0]].name + '»'} را به «${chatName(c)}» اضافه کرد`, ts: Date.now()});
        closeOvl(); toast(`${fa(add.length)} عضو به «${chatName(c)}» اضافه شد`, '👤'); renderList(); flush();
      };
    };
    $('#newBtnTop').onclick = () => newChatModal('p');
    $('#fab').onclick = () => newChatModal(state.role === 'teacher' ? 'g' : 'p');
    // no simulated classmates in a real school
    Object.defineProperty(SET, 'sim', {get: () => false, set(){}, enumerable: false, configurable: true});
    document.addEventListener('visibilitychange', () => { if(!document.hidden){ sync().then(schedule); } });
    addEventListener('online', () => { backoff = 0; sync().then(schedule); });
    setInterval(() => { if(!flushing) flush(); }, FLUSH);
  }

  /* ---------- small UI pieces only used in server mode ---------- */
  function toastSticky(msg){
    const t = document.createElement('div'); t.className = 'toast sticky'; t.innerHTML = `<span class="spin"></span>${esc(msg)}`;
    $('#toasts').appendChild(t);
    return () => { t.classList.add('out'); setTimeout(() => t.remove(), 360); };
  }
  function status(s){
    if(NET.status === s) return; NET.status = s;
    let pill = $('#netPill');
    if(!pill){ pill = document.createElement('div'); pill.id = 'netPill'; pill.setAttribute('role', 'status'); document.body.appendChild(pill); }
    pill.className = 'net-pill ' + s;
    pill.innerHTML = s === 'offline' ? '<i></i>در حال اتصال دوباره…' : s === 'auth' ? '<i></i>نشست شما پایان یافته است' : '<i></i>متصل به سرور مدرسه';
    pill.classList.add('show'); clearTimeout(pill._t);
    if(s === 'online') pill._t = setTimeout(() => pill.classList.remove('show'), 1800);
  }
  function accountCard(){
    const p = P[NET.me]; if(!p) return;
    const o = openOvl(`<div class="modal acct"><div class="acct-hero">${avHTML(NET.me, 'xl noon')}<b>${esc(p.name)}</b><small>${p.staff ? 'مدیر مدرسه' : p.role === 'teacher' ? 'آموزگار' : 'دانش‌آموز'} · ${esc(p.title || '')}</small></div>
      <div class="modal-b"><div class="acct-grid"><div><b>${fa(chats.filter(c => !c.bot && !c.saved && c.type === 'class').length)}</b><small>کلاس و گروه</small></div><div><b>${fa(chats.filter(c => c.type === 'personal' && !c.bot && !c.saved).length)}</b><small>گفتگوی خصوصی</small></div><div><b>${fa(Object.keys(P).filter(k => /^u\d+$/.test(k) && P[k].online).length)}</b><small>آنلاین</small></div></div>
      <p class="hint">نقش شما را حساب مدرسه تعیین می‌کند. برای تغییر نام، عنوان یا عکس از تنظیمات استفاده کنید.</p></div>
      <div class="modal-f"><button class="btn pri" id="acSet">⚙️ تنظیمات پروفایل</button><a class="btn sec" href="/account/">حساب کاربری</a><button class="btn sec dg" id="acOut">خروج</button></div></div>`);
    o.onclick = e => { if(e.target === o) closeOvl(); };
    $('#acSet').onclick = () => { closeOvl(); setTimeout(settingsModal, 300); };
    $('#acOut').onclick = async () => { try{ await fetch('/api/account/logout', {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'}, body: '{}'}); }catch(e){} location.href = '/account/'; };
  }
  function gate(){
    if($('#srvGate')) return;
    clearTimeout(pollT);
    const g = document.createElement('div'); g.id = 'srvGate';
    g.innerHTML = `<div class="onb-bg"><i></i><i></i><i></i></div><div class="gate-card">
      <div class="onb-logo">✦</div><small class="ltr">SMARTCLASS · MESSENGER</small>
      <h1>برای ورود به گفتگوی کلاس، وارد حساب مدرسه شو.</h1>
      <p>پیام‌رسان با همان حسابی کار می‌کند که آموزگار یا مدیر مدرسه برایت ساخته است. کلاس‌ها، تکالیف و پیام‌ها روی همهٔ دستگاه‌هایت همگام می‌مانند.</p>
      <div class="gate-btns"><a class="btn pri" href="/account/">ورود به حساب</a><button class="btn sec" id="gateDemo">دیدن نسخهٔ نمایشی</button></div>
      <div class="gate-orbit" aria-hidden="true"><span>📝</span><span>📊</span><span>🎥</span><span>✦</span></div></div>`;
    document.body.appendChild(g); requestAnimationFrame(() => g.classList.add('show'));
    $('#splash')?.classList.add('out'); setTimeout(() => $('#splash')?.remove(), 800);
    $('#gateDemo').onclick = () => { sessionStorage.setItem('sc_demo', '1'); location.reload(); };
  }

  /* ---------- boot hook ---------- */
  async function detect(){
    if(!NET.httpOk || sessionStorage.getItem('sc_demo') === '1' || /[?&]demo=1/.test(location.search)) return 'local';
    try{
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 9000);
      const r = await fetch(NET.api + '/sync?rev=0&at=' + Date.now(), {credentials: 'same-origin', cache: 'no-store', signal: ctl.signal});
      clearTimeout(t);
      const json = (r.headers.get('content-type') || '').includes('json');
      if(r.status === 401 && json) return 'auth';
      if(!r.ok || !json) return 'local';
      return {data: await r.json()};
    }catch(e){ return 'local'; }
  }
  async function start(first){
    NET.on = true; NET.status = 'online';
    document.documentElement.classList.add('srv');
    // replace demo content with the real school
    chats.splice(0, chats.length, ...chats.filter(c => c.bot));
    const raiva = chats.find(c => c.bot); if(raiva) raiva.msgs = raiva.msgs.slice(0, 1);
    chats.push({id: SAVED, type: 'personal', saved: true, name: 'پیام‌های ذخیره‌شده', members: ['@me'], vis: ['student','teacher'], msgs: []});
    Object.keys(P).forEach(k => { if(!P[k].ai) delete P[k]; });
    STUDENTS.length = 0; STORIES.length = 0;
    state.role = first.me.role;
    const r = ingest(first, true); NET.me = first.me.id;
    chats.forEach(c => { c._had = c.msgs.length > 0; });
    install(); resolve();
    schedule();
    return r;
  }
  return {detect, start, sync, flush, api, gate, get cursor(){ return cursor; }, get known(){ return KNOWN; }};
})();
