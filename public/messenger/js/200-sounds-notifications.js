/* ---------- Sounds & notifications ---------- */
let AC = null;
function playSound(kind){
  if(!SET.sound) return;
  try{
    AC ||= new (window.AudioContext || window.webkitAudioContext)();
    const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
    o.type = 'sine'; const f = kind==='out' ? [880, 1320] : kind==='ok' ? [660, 990, 1320] : [740, 520];
    f.forEach((x,i) => o.frequency.setValueAtTime(x, t + i*.07));
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.12, t+.02); g.gain.exponentialRampToValueAtTime(.0001, t + .09*f.length + .1);
    o.connect(g).connect(AC.destination); o.start(t); o.stop(t + .1*f.length + .15);
  }catch(e){}
}
function notify(c, m){
  if(c.muted) return;
  playSound('in');
  if(document.hidden && SET.desk && 'Notification' in window && Notification.permission==='granted'){
    try{ const n = new Notification(chatName(c), {body:(c.type==='class' ? pname(m.by)+': ' : '') + preview(m), tag:c.id}); n.onclick = () => { focus(); openChat(c.id); n.close(); }; }catch(e){}
  }
  notifyBanner(c, m);
}
