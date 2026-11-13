/* ---------- Real voice recording ---------- */
let micStream = null;
async function startRec(e){
  if(inp.value.trim() || state.editing || !state.cur) return;
  startRecSim(e);
  if(!rec) return;
  const r = rec; r.levels = [];
  if(!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder){ r.noMic = true; return; }
  try{
    micStream ||= await navigator.mediaDevices.getUserMedia({audio:true});
    if(rec!==r) return;
    const mr = new MediaRecorder(micStream), chunks = [];
    mr.ondataavailable = ev => ev.data.size && chunks.push(ev.data);
    r.mr = mr; r.chunks = chunks; r.mt0 = performance.now(); mr.start(100);
    AC ||= new (window.AudioContext || window.webkitAudioContext)();
    const src = AC.createMediaStreamSource(micStream), an = AC.createAnalyser(); an.fftSize = 256; src.connect(an);
    const buf = new Uint8Array(an.fftSize);
    r.lv = setInterval(() => { an.getByteTimeDomainData(buf); let s = 0; for(const v of buf) s += Math.abs(v-128); r.levels.push(s/buf.length); }, 80);
  }catch(err){ r.noMic = true; }
}
function endRec(send_){
  if(!rec) return; const r = rec; rec = null;
  cancelAnimationFrame(r.raf); clearInterval(r.lv);
  sendb.classList.remove('rec'); $('#recov').classList.remove('show'); $('#pl1').style.transform = $('#pl2').style.transform = ''; sendb.style.translate = '';
  const dur = (performance.now() - (r.mt0 || r.t0)) / 1000;
  if(r.noMic){ if(send_) toast('دسترسی به میکروفون ممکن نشد؛ اجازهٔ مرورگر را بررسی کنید','🎙️'); return; }
  if(!r.mr){ if(send_) toast('برای ضبط صدا دکمه را نگه دارید','🎙️'); return; }
  const ok = send_ && !r.cancel && dur >= .6;
  r.mr.onstop = async () => {
    if(!ok) return;
    const blob = new Blob(r.chunks, {type: r.mr.mimeType || 'audio/webm'}), key = await putBlob(blob);
    const L = r.levels.length ? r.levels : [4], max = Math.max(...L, 1), bars = Array.from({length:34}, (_,i) => { const a = L[Math.floor(i*L.length/34)] || 0; return Math.round(5 + (a/max)*23); });
    pushOut({voice:{dur:Math.max(1, Math.round(dur)), key, bars}}); playSound('out');
  };
  r.mr.stop();
}
let voiceAudio = null;
async function playVoice(row, m, btn){
  if(!m.voice.key) return playVoiceSim(row, m, btn);
  const bars = $$('.wave i', row), vd = $('.vd', row), sp = $('.vt .sp', row);
  if(voiceAudio && voiceAudio._btn===btn){ if(voiceAudio.paused){ voiceAudio.play(); btn.innerHTML = IC.pause; } else { voiceAudio.pause(); btn.innerHTML = IC.play; } return; }
  if(voiceAudio){ voiceAudio.pause(); voiceAudio._btn.innerHTML = IC.play; }
  const u = await blobURL(m.voice.key); if(!u) return toast('این پیام صوتی روی این دستگاه موجود نیست','⚠️');
  const a = new Audio(u); a._btn = btn; voiceAudio = a;
  a.playbackRate = sp.textContent==='۲×' ? 2 : sp.textContent==='۱٫۵×' ? 1.5 : 1;
  sp.onclick = () => setTimeout(() => { a.playbackRate = sp.textContent==='۲×' ? 2 : sp.textContent==='۱٫۵×' ? 1.5 : 1; }, 0);
  btn.innerHTML = IC.pause;
  const tick = () => {
    if(voiceAudio!==a) return;
    const d = isFinite(a.duration) ? a.duration : m.voice.dur, k = Math.min(1, a.currentTime / d);
    bars.forEach((x,i) => { x.classList.toggle('on', i < bars.length*k); x.classList.toggle('cur', Math.floor(bars.length*k)===i); });
    vd.textContent = fa('0:' + String(Math.max(0, Math.round(d - a.currentTime))).padStart(2,'0'));
    if(!a.paused) requestAnimationFrame(tick);
  };
  a.onplay = tick;
  a.onended = () => { btn.innerHTML = IC.play; bars.forEach(x => x.classList.remove('on','cur')); vd.textContent = fa('0:' + String(m.voice.dur).padStart(2,'0')); voiceAudio = null; };
  a.play().catch(() => toast('پخش صدا ممکن نشد','⚠️'));
}
