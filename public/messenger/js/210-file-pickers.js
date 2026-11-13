/* ---------- File pickers ---------- */
function pickFiles(accept, multiple){
  return new Promise(res => {
    const i = document.createElement('input'); i.type = 'file'; if(accept) i.accept = accept; i.multiple = !!multiple;
    i.style.display = 'none'; document.body.appendChild(i);
    i.onchange = () => { res([...i.files]); i.remove(); };
    addEventListener('focus', () => setTimeout(() => { if(!i.files.length){ res([]); i.remove(); } }, 600), {once:true});
    i.click();
  });
}
function compressImage(file, max=1600, q=.85){
  return new Promise((res) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      let w = im.naturalWidth, h = im.naturalHeight; const k = Math.min(1, max/Math.max(w,h)); w = Math.round(w*k); h = Math.round(h*k);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(im, 0, 0, w, h);
      URL.revokeObjectURL(url);
      cv.toBlob(b => res(b || file), 'image/jpeg', q);
    };
    im.onerror = () => { URL.revokeObjectURL(url); res(file); };
    im.src = url;
  });
}
const fmtSize = b => b < 1024*1024 ? fa(Math.max(1, Math.round(b/1024))) + ' کیلوبایت' : fa((b/1048576).toFixed(1)) + ' مگابایت';
const toDataURL = blob => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); });

async function sendPhoto(){
  if(!state.cur || !canPost(state.cur)) return;
  const files = (await pickFiles('image/*', true)).slice(0, 10); if(!files.length) return;
  const urls = files.map(f => URL.createObjectURL(f));
  const o = openOvl(`<div class="modal"><div class="modal-h"><div class="sym" style="background:var(--mint);color:var(--mint-ink)">🖼️</div><div><b>ارسال ${fa(files.length)} عکس</b><small>به ${esc(chatName(state.cur))}</small></div></div>
    <div class="modal-b"><div class="pv-grid">${urls.map((u,i) => `<div style="animation-delay:${i*.05}s"><img src="${u}" alt=""></div>`).join('')}</div>
    <div class="fld"><label>توضیح (اختیاری)</label><input id="pvCap" placeholder="یک توضیح کوتاه…"></div></div>
    <div class="modal-f"><button class="btn pri" id="pvOk">ارسال</button><button class="btn sec" id="pvNo">انصراف</button></div></div>`);
  setTimeout(() => $('#pvCap')?.focus(), 200);
  $('#pvNo').onclick = closeOvl; o.onclick = e => { if(e.target===o) closeOvl(); };
  $('#pvCap').onkeydown = e => { if(e.key==='Enter') $('#pvOk').click(); };
  $('#pvOk').onclick = async () => {
    const cap = $('#pvCap').value.trim(); closeOvl();
    for(let i=0; i<files.length; i++){
      const b = await compressImage(files[i]); const key = await putBlob(b);
      pushOut({img:URLS[key], imgKey:key, t: i===files.length-1 ? cap : ''});
      await sleep(120);
    }
    urls.forEach(u => URL.revokeObjectURL(u)); playSound('out');
  };
}
async function sendFile(){
  if(!state.cur || !canPost(state.cur)) return;
  const files = (await pickFiles('', true)).slice(0, 10); if(!files.length) return;
  for(const f of files){
    if(f.size > 50*1048576){ toast(`«${f.name}» بزرگ‌تر از ۵۰ مگابایت است`,'⚠️'); continue; }
    if(f.type.startsWith('image/') && files.length===1){ const b = await compressImage(f); const key = await putBlob(b); pushOut({img:URLS[key], imgKey:key}); continue; }
    const key = await putBlob(f);
    pushOut({file:{name:f.name, size:fmtSize(f.size), key, mime:f.type, ok:true}});
    await sleep(100);
  }
  playSound('out');
}
async function downloadFile(row, m, fic){
  if(!m.file.key) return downloadFileSim(row, m, fic);
  const u = await blobURL(m.file.key);
  if(!u) return toast('این فایل روی این دستگاه موجود نیست','⚠️');
  fic.animate([{transform:'scale(.85)'},{transform:'scale(1.08)'},{transform:'none'}],{duration:450, easing:'cubic-bezier(.34,1.56,.64,1)'});
  if(/^(image|application\/pdf|text|audio|video)/.test(m.file.mime||'')) open(u, '_blank');
  else { const a = document.createElement('a'); a.href = u; a.download = m.file.name; document.body.appendChild(a); a.click(); a.remove(); }
}
