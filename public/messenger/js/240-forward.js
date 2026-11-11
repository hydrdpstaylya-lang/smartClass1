/* ---------- Forward ---------- */
function forwardPick(m){
  const list = visibleChats().filter(c => canPost(c) && !c.bot);
  const o = openOvl(`<div class="modal"><div class="modal-h"><div class="sym" style="background:var(--mint);color:var(--mint-ink)">↪</div><div><b>هدایت پیام</b><small>${esc(preview(m).slice(0,50))}</small></div></div>
    <div class="modal-b" style="max-height:52vh;overflow:auto">${list.map((c,i) => `<div class="subr pk" data-id="${c.id}" style="animation-delay:${i*.03}s">${chatAv(c,'sm')}<div class="sb"><b>${esc(chatName(c))}</b><small>${c.type==='class'?'کلاس / گروه':c.type==='channel'?'کانال':'خصوصی'}</small></div></div>`).join('')}</div>
    <div class="modal-f"><button class="btn sec" id="fwNo" style="flex:1">انصراف</button></div></div>`);
  $('#fwNo').onclick = closeOvl; o.onclick = e => { if(e.target===o) closeOvl(); };
  $$('.pk', o).forEach(r => r.onclick = () => {
    const c = chats.find(x => x.id===r.dataset.id), src = state.cur;
    const copy = JSON.parse(JSON.stringify(m)); Object.assign(copy, {id:'m'+nid(), by: c.saved ? '@me' : meId(), fwd: isMe(m.by) ? null : (pname(m.by) || chatName(src)), ts:Date.now(), react:null, my:null, reply:null, read:0, pending:false});
    if(m.img) copy.img = m.img;
    closeOvl(); if(c===state.cur) pushMsg(c, copy); else { c.msgs.push(copy); flipRender(c.id); }
    toast(`به «${chatName(c)}» هدایت شد`,'↪');
  });
}
