/* ---------- Chat list context menu ---------- */
function listCtx(it, x, y){
  const c = chats.find(z => z.id===it.dataset.id); if(!c) return;
  const fixed = c.bot || c.saved;
  const items = [
    ['📌', c.pinned ? 'برداشتن سنجاق' : 'سنجاق به بالا', () => { c.pinned = !c.pinned; flipRender(); }],
    ['🔔', c.muted ? 'روشن کردن اعلان' : 'بی‌صدا کردن', () => { c.muted = !c.muted; renderList(); }],
    c.unread ? ['✓', 'علامت خوانده‌شده', () => { c.unread = 0; c.mention = false; renderList(); }] : ['●', 'علامت خوانده‌نشده', () => { c.unread = 1; renderList(); }],
    ['🧹', 'پاک کردن تاریخچه', () => confirmBox('پاک کردن تاریخچه', `همهٔ پیام‌های «${chatName(c)}» پاک شود؟`, () => { c.msgs.forEach(m => DELETED.add(m.id)); c.msgs = []; if(state.cur===c) renderMsgs(c); renderList(); })],
    !fixed && ['🗑️', c.type==='personal' ? 'حذف گفتگو' : 'حذف / ترک', () => confirmBox('حذف گفتگو', `«${chatName(c)}» حذف شود؟ این کار برگشت‌پذیر نیست.`, () => { DELETED.add(c.id); chats.splice(chats.indexOf(c), 1); if(state.cur===c){ state.cur = null; showEmpty(); } renderList(); }), 1],
  ].filter(Boolean);
  closePops(); const ctx = $('#ctx'); $('#dim').classList.add('show');
  ctx.innerHTML = items.map(([ic,l,,dg],i) => `<div class="it ${dg?'dg':''}" data-i="${i}" style="animation-delay:${i*.03}s"><span style="width:20px;text-align:center">${ic}</span>${l}</div>`).join('');
  $$('.it', ctx).forEach(el => el.onclick = e => { e.stopPropagation(); closePops(); items[+el.dataset.i][2](); });
  ctx.style.left = Math.min(x, innerWidth - 240)+'px'; ctx.style.top = Math.min(y, innerHeight - items.length*42 - 20)+'px'; ctx.style.transformOrigin = 'top left';
  ctx.classList.add('show');
}
$('#clist').addEventListener('contextmenu', e => { const it = e.target.closest('.citem'); if(!it) return; e.preventDefault(); listCtx(it, e.clientX, e.clientY); });
let lpT = 0;
$('#clist').addEventListener('pointerdown', e => { const it = e.target.closest('.citem'); if(!it || e.pointerType==='mouse') return; lpT = setTimeout(() => { navigator.vibrate && navigator.vibrate(15); listCtx(it, e.clientX, e.clientY); it._lp = true; }, 550); });
['pointerup','pointermove','pointercancel'].forEach(t => $('#clist').addEventListener(t, e => { if(t!=='pointermove' || Math.abs(e.movementY) > 3) clearTimeout(lpT); }));
$('#clist').addEventListener('click', e => { const it = e.target.closest('.citem'); if(it?._lp){ it._lp = false; e.stopImmediatePropagation(); } }, true);
function confirmBox(title, msg, yes){
  const o = openOvl(`<div class="modal" style="width:min(380px,calc(100vw - 24px))"><div class="modal-h"><div class="sym" style="background:color-mix(in srgb,var(--danger) 16%,transparent)">⚠️</div><div><b>${esc(title)}</b></div></div><div class="modal-b"><p style="color:var(--muted);line-height:1.9">${esc(msg)}</p></div><div class="modal-f"><button class="btn pri" id="cfY" style="background:var(--danger);color:#fff">بله</button><button class="btn sec" id="cfN">انصراف</button></div></div>`);
  $('#cfN').onclick = closeOvl; $('#cfY').onclick = () => { closeOvl(); yes(); }; o.onclick = e => { if(e.target===o) closeOvl(); };
}
