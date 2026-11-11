/* =========================================================
   Splash
   ========================================================= */
const tips = ['در حال آماده‌سازی کلاس‌ها…','همگام‌سازی تکالیف…','بیدار کردن رایوا ✦'];
tips.forEach((t,i) => setTimeout(() => { const el=$('#spTip'); el.style.opacity=0; setTimeout(()=>{el.textContent=t; el.style.transition='opacity .3s'; el.style.opacity=1;},150); }, 400+i*550));
