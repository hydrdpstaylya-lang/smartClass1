/* ---------- Story maker (teacher) ---------- */
function openStoryMaker(){
  const BG = ['linear-gradient(160deg,#16866f,#102c29)','linear-gradient(160deg,#efa457,#b3601a)','linear-gradient(160deg,#5aa9d6,#1d4f6e)','linear-gradient(160deg,#8b7fd6,#2c2466)','linear-gradient(160deg,#e2737b,#7a2a35)'];
  let bg = 0, em = '🌱';
  const o = openOvl(`<div class="modal"><div class="modal-h"><div class="sym" style="background:var(--mint);color:var(--mint-ink)">📸</div><div><b>استوری کلاس</b><small>برای همهٔ دانش‌آموزان نمایش داده می‌شود</small></div></div>
    <div class="modal-b"><div class="st-prev" id="stPrev"><div class="em">🌱</div><h3 id="stH">عنوان استوری</h3><p id="stP"></p></div>
    <div class="fld"><label>عنوان</label><input id="stHi" placeholder="مثلاً: فردا اردوی علمی داریم"></div>
    <div class="fld"><label>متن</label><input id="stPi" placeholder="توضیح کوتاه…"></div>
    <div class="symc">${['🌱','🔬','🏆','📚','🎉','🧠','⏰','🎨'].map(s => `<button data-s="${s}" class="${s===em?'on':''}">${s}</button>`).join('')}</div>
    <div class="swc">${BG.map((x,i) => `<button data-g="${i}" class="${i===bg?'on':''}" style="background:${x}"></button>`).join('')}</div></div>
    <div class="modal-f"><button class="btn pri" id="stOk">انتشار</button><button class="btn sec" id="stNo">انصراف</button></div></div>`);
  const pv = () => { $('#stPrev').style.background = BG[bg]; $('#stPrev .em').textContent = em; $('#stH').textContent = $('#stHi').value || 'عنوان استوری'; $('#stP').textContent = $('#stPi').value; };
  pv(); $('#stHi').oninput = pv; $('#stPi').oninput = pv;
  $$('.symc button', o).forEach(x => x.onclick = () => { em = x.dataset.s; $$('.symc button', o).forEach(y => y.classList.toggle('on', y===x)); pv(); });
  $$('.swc button', o).forEach(x => x.onclick = () => { bg = +x.dataset.g; $$('.swc button', o).forEach(y => y.classList.toggle('on', y===x)); pv(); });
  $('#stNo').onclick = closeOvl;
  $('#stOk').onclick = () => {
    const h = $('#stHi').value.trim(); if(!h) return toast('عنوان را بنویسید','✎');
    const mine = STORIES.find(s => s.mine===meId());
    const slide = {bg:BG[bg], em, tag:'CLASS STORY', h, p:$('#stPi').value.trim()};
    if(mine){ mine.slides.push(slide); mine.seen = false; } else STORIES.unshift({who:P[meId()].name, av:{p:meId()}, mine:meId(), slides:[slide]});
    closeOvl(); renderStories(); toast('استوری منتشر شد','📸'); playSound('ok');
  };
}
