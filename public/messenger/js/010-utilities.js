"use strict";
/* =========================================================
   Utilities
   ========================================================= */
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const fa = s => String(s).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]).replace(/\./g,'٫');
const en = s => String(s).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const rnd = (a,b) => Math.random()*(b-a)+a;
const pick = a => a[Math.floor(Math.random()*a.length)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const DAY = 864e5, HOUR = 36e5;
const NOW = Date.now();
const T = (d, hm) => { const [h,m] = hm.split(':').map(Number); const x = new Date(NOW - d*DAY); x.setHours(h,m,0,0); return Math.min(x.getTime(), NOW - 60000*(d===0?1:0)); };
const tfmt = ts => new Date(ts).toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit',hour12:false});
const dayLabel = ts => { const a = new Date(ts); a.setHours(0,0,0,0); const b = new Date(); b.setHours(0,0,0,0); const d = Math.round((b-a)/DAY); return d===0?'امروز':d===1?'دیروز':a.toLocaleDateString('fa-IR',{weekday:'long', day:'numeric', month:'long'}); };
const listTime = ts => { const d = Math.round((new Date().setHours(0,0,0,0) - new Date(ts).setHours(0,0,0,0))/DAY); return d===0 ? tfmt(ts) : d===1 ? 'دیروز' : new Date(ts).toLocaleDateString('fa-IR',{weekday:'long'}); };
const nid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);

const IC = {
  vf:'<svg class="vf" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1l2.6 2.2 3.4-.4.9 3.3 3 1.7-1.2 3.2 1.2 3.2-3 1.7-.9 3.3-3.4-.4L12 23l-2.6-2.2-3.4.4-.9-3.3-3-1.7L3.3 13 2.1 9.8l3-1.7.9-3.3 3.4.4z"/><path d="m8 12 3 3 5-6" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  ck:'<svg class="ck" viewBox="0 0 19 12"><path class="c1" d="M1 6.5 4.5 10 11 2"/><path class="c2" d="M7.5 9.5 8 10l6.5-8"/></svg>',
  clk:'<svg class="clk" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path class="hand" d="M12 12V7"/></svg>',
  play:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  pause:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
  pin:'<svg class="ci-pin" viewBox="0 0 24 24" fill="currentColor"><path d="M16 3l5 5-3 1-4 4 1 5-2 2-4-5-5 5-1-1 5-5-5-4 2-2 5 1 4-4z"/></svg>',
  mute:'<svg class="ci-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H2v6h4l5 4zM22 9l-6 6M16 9l6 6"/></svg>',
  reply:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M9 17 4 12l5-5"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>',
  eye:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>',
  x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  up:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
  dl:'<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v12M6 11l6 6 6-6M5 21h14"/></svg>',
  doc:'<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/></svg>',
  spark:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2.8a1 1 0 0 1 2 0l1 5.6a2 2 0 0 0 1.6 1.6l5.6 1a1 1 0 0 1 0 2l-5.6 1a2 2 0 0 0-1.6 1.6l-1 5.6a1 1 0 0 1-2 0l-1-5.6a2 2 0 0 0-1.6-1.6l-5.6-1a1 1 0 0 1 0-2l5.6-1A2 2 0 0 0 10 8.4z"/></svg>',
  close:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
};
const GR = ['linear-gradient(135deg,#65c7a8,#16866f)','linear-gradient(135deg,#f7c58a,#efa457)','linear-gradient(135deg,#8fd0f0,#5aa9d6)','linear-gradient(135deg,#b7aef0,#8b7fd6)','linear-gradient(135deg,#f3a3a9,#e2737b)','linear-gradient(135deg,#f2d488,#e6b55b)','linear-gradient(135deg,#2f6d63,#102c29)','linear-gradient(135deg,#9ad9b4,#4fae7e)'];
const SUBJ = {
  'ریاضی':{sym:'∑', c:'rgba(239,170,80,.22)', ink:'#a4600f'},
  'علوم':{sym:'⚗', c:'rgba(90,169,214,.2)', ink:'#2c7aa6'},
  'فارسی':{sym:'آ', c:'rgba(139,127,214,.2)', ink:'#5d50b8'},
  'اجتماعی':{sym:'◎', c:'rgba(101,199,168,.22)', ink:'#16866f'},
};
const SITE = NET.httpOk ? '' : 'https://smart-class1.vercel.app'; // same-origin images when served by the SmartClass site
