/* =========================================================
   FULL VERSION — storage, sync, settings, real media
   ========================================================= */
const ROLE_ID = r => r==='student' ? 's_ilya' : 't_sadeghi';
const SET = Object.assign({sim:true, sound:true, desk:false, enter:true, fs:15, reduce:false}, JSON.parse(localStorage.getItem('sc_set') || '{}'));
const saveSet = () => { localStorage.setItem('sc_set', JSON.stringify(SET)); applySet(); };
function applySet(){
  document.documentElement.style.setProperty('--fs', SET.fs + 'px');
  document.documentElement.classList.toggle('reduce', !!SET.reduce);
}
applySet();
const TAB = Math.random().toString(36).slice(2);
const bc = 'BroadcastChannel' in window ? new BroadcastChannel('smartclass-goftogu') : null;
