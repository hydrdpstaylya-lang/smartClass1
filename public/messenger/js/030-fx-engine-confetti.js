/* =========================================================
   FX engine (confetti + dust) on one canvas
   ========================================================= */
const fx = $('#fx'), g2 = fx.getContext('2d'); let parts = [], fxOn = false;
function fxSize(){ fx.width = innerWidth*devicePixelRatio; fx.height = innerHeight*devicePixelRatio; g2.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0); }
fxSize(); addEventListener('resize', fxSize);
function fxRun(){ if(!fxOn){ fxOn = true; requestAnimationFrame(fxLoop); } }
function fxLoop(t){
  g2.clearRect(0,0,innerWidth,innerHeight);
  parts = parts.filter(p => p.step(t));
  g2.globalAlpha = 1;
  if(parts.length) requestAnimationFrame(fxLoop); else { fxOn = false; g2.clearRect(0,0,innerWidth,innerHeight); }
}
function confetti(x, y, n=90, spread=1){
  const cols = ['#65c7a8','#16866f','#c7f2df','#efa457','#e6b55b','#5aa9d6','#8b7fd6','#e2737b'];
  const t0 = performance.now();
  for(let i=0;i<n;i++){
    const a = rnd(-Math.PI, 0) * spread + (spread<1 ? -Math.PI/2*(1-spread) : 0), v = rnd(5,13);
    const p = {x, y, vx:Math.cos(a)*v*rnd(.4,1), vy:Math.sin(a)*v - rnd(1,4), r:rnd(0,6.28), vr:rnd(-.3,.3), w:rnd(5,10), h:rnd(3,6), c:pick(cols), life:rnd(1400,2300), shape:Math.random()<.3?'c':'r', t0};
    p.step = t => { const e = t - p.t0; if(e > p.life) return false; p.vy += .28; p.vx *= .985; p.vy *= .985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      g2.globalAlpha = Math.min(1, (p.life - e)/400); g2.save(); g2.translate(p.x,p.y); g2.rotate(p.r); g2.fillStyle = p.c;
      if(p.shape==='c'){ g2.beginPath(); g2.arc(0,0,p.h/1.4,0,7); g2.fill(); } else { g2.scale(1, Math.cos(e*.012+p.r)); g2.fillRect(-p.w/2,-p.h/2,p.w,p.h); }
      g2.restore(); return true; };
    parts.push(p);
  }
  fxRun();
}
function burst(x, y, chars, n=12){
  const t0 = performance.now();
  for(let i=0;i<n;i++){
    const a = Math.PI*2/n*i + rnd(-.3,.3), v = rnd(2.5,5);
    const p = {x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,ch:chars[i%chars.length],s:rnd(14,22),life:rnd(700,1000),t0,r:rnd(-1,1)};
    p.step = t => { const e = t-p.t0; if(e>p.life) return false; p.vx*=.94; p.vy=p.vy*.94+.06; p.x+=p.vx; p.y+=p.vy; const k=e/p.life;
      g2.globalAlpha = 1-k; g2.save(); g2.translate(p.x,p.y); g2.rotate(p.r*k*3); g2.font = `${p.s*(1-k*.3)}px serif`; g2.textAlign='center'; g2.textBaseline='middle'; g2.fillText(p.ch,0,0); g2.restore(); return true; };
    parts.push(p);
  }
  fxRun();
}
function dust(el){
  const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
  const bg = el.classList.contains('stk') ? '#efa457' : cs.backgroundColor, fg = cs.color, t0 = performance.now(), s = 3;
  for(let x=0;x<r.width;x+=s) for(let y=0;y<r.height;y+=s){
    if(Math.random()<.12) continue;
    const p = {x:r.left+x, y:r.top+y, c:Math.random()<.16?fg:bg, vx:rnd(.4,2.4), vy:rnd(-2.4,-.3), d:(r.width-x)/r.width*420+rnd(0,140), life:rnd(600,1100), t0, ph:rnd(0,6)};
    p.step = t => { const e = t-p.t0-p.d; if(e<0){ g2.globalAlpha=1; g2.fillStyle=p.c; g2.fillRect(p.x,p.y,s,s); return true; }
      const k = e/p.life; if(k>=1) return false; g2.globalAlpha = 1-k; g2.fillStyle = p.c;
      g2.fillRect(p.x + p.vx*e*.06 + Math.sin(e*.01+p.ph)*4, p.y + p.vy*e*.05 - k*k*24, s*(1-k*.5), s*(1-k*.5)); return true; };
    parts.push(p);
  }
  fxRun();
}
