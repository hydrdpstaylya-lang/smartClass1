/* SmartClass Voice Studio — live teaching controls, consent and classroom activities */
(()=>{
 const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
 const live=()=>window.SC_LIVE, say=t=>typeof toast==='function'?toast(t,'🎙️'):alert(t);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const time=t=>{try{return new Date(Number(t)||Date.now()).toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'})}catch{return''}};
 let chat='',cursor=0,events=[],data=null,pollTimer=0,root=null,transcribing=false,recognition=null,inBreakout=false,frameBound=new WeakSet();
 const isTeacher=()=>!!live()?.isTeacher?.();
 async function api(action,payload={}){
   const url='/api/chat/voice?chat='+encodeURIComponent(chat)+(action==='get'?'&since='+cursor:'');
   const r=await fetch(url,{method:action==='get'?'GET':'POST',credentials:'same-origin',cache:'no-store',
     ...(action==='get'?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify({chat,action,...payload})})});
   const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'درخواست استودیو انجام نشد.');return j;
 }
 function addEvents(items){
   const ids=new Set(events.map(e=>String(e.id)));
   for(const e of items||[])if(e?.id!==undefined&&!ids.has(String(e.id))){events.push(e);ids.add(String(e.id));}
   events.sort((a,b)=>Number(a.id)-Number(b.id));if(events.length>400)events=events.slice(-400);
   window.dispatchEvent(new Event('sc-voice-events-updated'));
 }
 async function poll(){
   try{
     data=await api('get');addEvents(data.events||[]);
     cursor=Math.max(cursor,Number(data.next)||cursor);
     if(root)renderTeacher();
     renderStudent();
     if(transcribing&&isTeacher()){
       const consents=data.consents||[],participants=data.participants||[];
       if(participants.some(p=>!consents.some(c=>String(c.user)===String(p.id)&&c.allowed))){
         await stopTranscription();
         say('رضایت یکی از افراد حاضر برداشته شد؛ متن‌برداری متوقف شد.');
       }
     }
     if(inBreakout&&!(data.breakouts||[]).length){
       inBreakout=false;await live()?.returnMainRoom?.();say('اتاق گروهی پایان یافت؛ به کلاس اصلی برگشتی.');
     }
   }catch(e){if(/جلسهٔ زنده|فعال/.test(e.message||''))say(e.message);}
 }
 function startPoll(){clearInterval(pollTimer);poll();pollTimer=setInterval(poll,2800);}
 function stopPoll(){clearInterval(pollTimer);pollTimer=0;}
 function teacher(){return isTeacher();}
 function handQueue(){
   const m=new Map();
   for(const e of events){const id=e.payload?.user;if(!id)continue;
     if(e.type==='hand_raise')m.set(String(id),e);
     if(e.type==='hand_lower'||(e.type==='turn_granted'&&e.payload?.grant))m.delete(String(id));
   }
   return [...m.values()];
 }
 function person(id){return(data?.participants||[]).find(p=>String(p.id)===String(id));}
 function renderTeacher(){
   if(!root)return;
   const participants=data?.participants||[];
   const people=$('#vsParticipants',root),hands=$('#vsHands',root),consents=$('#vsConsents',root);
   if(people)people.innerHTML=participants.map(p=>{
     const mic=Array.isArray(p.canSend)&&p.canSend.some(x=>['audio','microphone'].includes(x));
     return '<div class="vs-person"><i></i><span><b>'+esc(p.name)+'</b><small>'+esc(p.network||'وضعیت نامشخص')+'</small></span><div><button data-vs-turn="'+esc(p.id)+'" data-grant="1" '+(mic?'disabled':'')+'>اجازهٔ صحبت</button><button data-vs-turn="'+esc(p.id)+'" data-grant="0" '+(!mic?'disabled':'')+'>لغو نوبت</button></div></div>';
   }).join('')||'<div class="vs-empty">هنوز کسی وارد کلاس نشده است.</div>';
   if(hands)hands.innerHTML=handQueue().map(e=>'<div class="vs-request"><span>✋ '+esc(e.payload.name||'دانش‌آموز')+'</span><small>'+time(e.created)+'</small><button data-vs-turn="'+esc(e.payload.user)+'" data-grant="1">دادن نوبت</button></div>').join('')||'<div class="vs-empty">درخواست صحبت تازه‌ای نیست.</div>';
   if(consents)consents.innerHTML=participants.map(p=>{
     const c=(data.consents||[]).find(x=>String(x.user)===String(p.id));
     return '<div class="vs-consent"><span>'+esc(p.name)+'</span><b class="'+(c?.allowed?'yes':'no')+'">'+(c?.allowed?'رضایت داده':'منتظر رضایت')+'</b></div>';
   }).join('')||'<div class="vs-empty">شرکت‌کننده‌ای وجود ندارد.</div>';
   const q=events.filter(e=>e.type==='quiz_start').slice(-1)[0],answers=q?events.filter(e=>e.type==='quiz_answer'&&e.payload.quizId===q.payload.quizId):[];
   const quiz=$('#vsAnswers',root);
   if(quiz)quiz.innerHTML=q?'<div class="vs-question"><b>سؤال فعال</b><p>'+esc(q.payload.question)+'</p><small>پاسخ‌ها: '+answers.length+'</small></div>'+answers.map(a=>'<div class="vs-answer"><div><b>'+esc(a.payload.name)+'</b><p>'+esc(a.payload.answer)+'</p></div><button data-vs-grade="'+esc(a.payload.student)+'" data-q="'+esc(q.payload.quizId)+'">ثبت نمره</button></div>').join(''):'<div class="vs-empty">آزمون شفاهی فعالی نیست.</div>';
   const groups=$('#vsGroups',root);
   if(groups)groups.innerHTML=(data.breakouts||[]).map(g=>'<div class="vs-group"><span><b>'+esc(g.label)+'</b><small>'+(g.members||[]).map(id=>esc(person(id)?.name||id)).join('، ')+'</small></span><button data-vs-group="'+esc(g.id)+'">ورود به گروه</button></div>').join('')||'<div class="vs-empty">اتاق گروهی فعالی نیست.</div>';
   const txt=$('#vsTranscript',root);
   if(txt){txt.innerHTML=events.filter(e=>e.type==='transcript_line').slice(-30).map(e=>'<p><small>'+time(e.created)+' · '+esc(e.payload.speaker||'کلاس')+'</small>'+esc(e.payload.text)+'</p>').join('')||'<div class="vs-empty">پس از رضایت همه و شروع متن‌برداری، متن گفتار اینجا نمایش داده می‌شود.</div>';txt.scrollTop=txt.scrollHeight;}
 }
 function renderStudent(){
   const box=$('.sc-call-overlay .vs-student-tools');if(!box||!data)return;
   const consent=$('#vsConsentState',box),toggle=$('#vsConsentToggle',box);
   if(consent)consent.textContent=data.selfConsent?'رضایت متن‌برداری فعال است.':'متن‌برداری برای شما خاموش است.';
   if(toggle)toggle.textContent=data.selfConsent?'لغو رضایت متن‌برداری':'رضایت برای متن‌برداری';
   const mine=handQueue().some(e=>String(e.payload.user)===String(data.me));
   const hand=$('#vsRaiseHand',box);if(hand)hand.textContent=mine?'لغو درخواست صحبت':'✋ درخواست نوبت صحبت';
   const group=(data.breakouts||[])[0],groupBox=$('#vsStudentGroup',box);
   if(groupBox)groupBox.innerHTML=group?'<b>'+esc(group.label)+'</b><button id="vsJoinGroup">ورود به گروه</button>':'<small>هنوز به گروهی اختصاص داده نشده‌ای.</small>';
   $('#vsJoinGroup',box)?.addEventListener('click',async()=>{
     try{const access=await api('breakout-join',{id:group.id});await live()?.switchRoom(access,access.label);inBreakout=true;say('وارد '+access.label+' شدی.');}catch(e){say(e.message);}
   });
   const q=events.filter(e=>e.type==='quiz_start').slice(-1)[0],quiz=$('#vsStudentQuiz',box);
   if(quiz){
     const ended=q&&events.some(e=>e.type==='quiz_end'&&e.payload.quizId===q.payload.quizId);
     const answered=q&&events.some(e=>e.type==='quiz_answer'&&e.payload.quizId===q.payload.quizId&&String(e.payload.student)===String(data.me));
     quiz.innerHTML=!q||ended?'<small>در حال حاضر آزمون شفاهی فعالی نیست.</small>':'<b>🎤 '+esc(q.payload.question)+'</b><form id="vsStudentAnswer"><input name="answer" maxlength="500" placeholder="پاسخت را بنویس…" required '+(answered?'disabled':'')+'><button '+(answered?'disabled':'')+'>'+(answered?'پاسخ ثبت شد':'ارسال پاسخ')+'</button></form>';
     $('#vsStudentAnswer',quiz)?.addEventListener('submit',async e=>{e.preventDefault();const answer=new FormData(e.currentTarget).get('answer');try{await api('quiz_answer',{quizId:q.payload.quizId,answer});say('پاسخت به معلم ارسال شد.');await poll();}catch(err){say(err.message);}});
   }
   const captions=$('#vsStudentCaptions',box);
   if(captions)captions.innerHTML=events.filter(e=>e.type==='transcript_line').slice(-3).map(e=>'<p><b>'+esc(e.payload.speaker||'کلاس')+':</b> '+esc(e.payload.text)+'</p>').join('');
 }
 async function setTurn(user,grant){try{await api('turn',{user,grant});say(grant?'نوبت صحبت داده شد.':'نوبت صحبت لغو شد.');await poll();}catch(e){say(e.message);}}
 function markup(){
  return '<div class="vs-root" role="dialog" aria-modal="true" aria-label="استودیوی صوتی معلم"><header class="vs-header"><div><span class="vs-logo">🎙️</span><span><b>SmartClass Voice Studio</b><small>استودیوی فرماندهی صوتی معلم</small></span></div><div><span class="vs-live">● کلاس زنده</span><button id="vsClose" aria-label="بستن">✕</button></div></header><div class="vs-layout"><main><div class="vs-stage-label">اتاق تدریس زنده <small>اتاق خصوصی کلاس</small></div><div class="vs-stage" id="vsStage"></div><div class="vs-main-foot"><span>تماس زنده · میکروفون، دوربین و اشتراک صفحه از پنجرهٔ تماس</span><button id="vsMainRoom">بازگشت به کلاس اصلی</button></div></main><aside><nav class="vs-tabs"><button class="active" data-tab="sound">مدیریت صدا</button><button data-tab="board">تخته</button><button data-tab="quiz">آزمون</button><button data-tab="groups">گروه‌ها</button><button data-tab="assistant">دستیار AI</button></nav><div class="vs-pages">
  <section class="vs-page active" data-page="sound"><h3>شرکت‌کنندگان</h3><div id="vsParticipants" class="vs-list"></div><h3>درخواست نوبت صحبت</h3><div id="vsHands" class="vs-list"></div><button class="vs-danger" id="vsMuteAll">بی‌صدا کردن میکروفون دانش‌آموزان</button><h3>رضایت متن‌برداری</h3><div id="vsConsents" class="vs-list"></div><button class="vs-primary" id="vsStartTranscript">شروع متن‌برداری زنده</button><button class="vs-secondary" id="vsStopTranscript">توقف متن‌برداری</button><p class="vs-note">ضبط صدا خاموش است. تنها متن گفتار، پس از رضایت همهٔ افراد حاضر، ذخیره می‌شود.</p></section>
  <section class="vs-page" data-page="board"><h3>تختهٔ هوشمند همگام</h3><div class="vs-board-tools"><label>رنگ <input id="vsColor" type="color" value="#176b58"></label><label>ضخامت <input id="vsWidth" type="range" min="1" max="16" value="4"></label><button id="vsClear">پاک‌کردن تخته</button></div><canvas id="vsCanvas" width="1000" height="640"></canvas><div class="vs-note-form"><input id="vsNote" maxlength="150" placeholder="یادداشت روی تخته…"><button id="vsAddNote">افزودن</button></div></section>
  <section class="vs-page" data-page="quiz"><h3>آزمون شفاهی</h3><label class="vs-field">سؤال<input id="vsQuestion" maxlength="500" placeholder="سؤال را وارد کن…"></label><label class="vs-field">گزینه‌ها (اختیاری)<input id="vsOptions" maxlength="300" placeholder="الف، ب، پ، ت"></label><button class="vs-primary" id="vsStartQuiz">نمایش سؤال</button><button class="vs-secondary" id="vsEndQuiz">پایان آزمون</button><div id="vsAnswers" class="vs-list"></div></section>
  <section class="vs-page" data-page="groups"><h3>اتاق‌های گروهی واقعی</h3><label class="vs-field">تعداد گروه‌ها<select id="vsCount"><option>2</option><option selected>3</option><option>4</option><option>5</option><option>6</option><option>7</option><option>8</option></select></label><button class="vs-primary" id="vsCreateGroups">تقسیم دانش‌آموزان و ساخت اتاق</button><button class="vs-danger" id="vsEndGroups">پایان اتاق‌های گروهی</button><div id="vsGroups" class="vs-list"></div><p class="vs-note">هر گروه اتاق خصوصی جداگانه دارد؛ هر دانش‌آموز فقط می‌تواند وارد گروه خودش شود.</p></section>
  <section class="vs-page" data-page="assistant"><h3>دستیار فرمان صوتی</h3><button class="vs-primary" id="vsListen">🎙️ شنیدن فرمان صوتی</button><div id="vsCommand" class="vs-note">فرمان‌ها: قطع میکروفون همه، تشکیل گروه‌ها، پاک‌کردن تخته، ساخت گزارش کلاس.</div><h3>متن جلسه با رضایت شرکت‌کنندگان</h3><div id="vsTranscript" class="vs-transcript"></div><button class="vs-primary" id="vsSummary">ساخت گزارش پایان کلاس</button><div id="vsSummaryResult" class="vs-summary"></div><button class="vs-secondary" id="vsDownload">دریافت گزارش</button></section>
 </div></aside></div></div>';
 }
 function drawBoard(){
   const canvas=$('#vsCanvas',root);if(!canvas)return;
   const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
   const draw=st=>{
     const pts=st?.points||[];if(pts.length<2)return;
     ctx.save();ctx.strokeStyle=/^#[0-9a-f]{6}$/i.test(st.color||'')?st.color:'#176b58';ctx.lineWidth=Math.max(1,Math.min(16,Number(st.width)||4));ctx.lineCap='round';ctx.lineJoin='round';
     ctx.beginPath();ctx.moveTo(pts[0].x*canvas.width,pts[0].y*canvas.height);for(const p of pts.slice(1))ctx.lineTo(p.x*canvas.width,p.y*canvas.height);ctx.stroke();ctx.restore();
   };
   for(const e of events){if(e.type==='board_clear')ctx.clearRect(0,0,canvas.width,canvas.height);if(e.type==='board_stroke')draw(e.payload.stroke);if(e.type==='board_note'){ctx.save();ctx.fillStyle='#176b58';ctx.font='bold 24px sans-serif';ctx.fillText(e.payload.text,e.payload.x*canvas.width,e.payload.y*canvas.height);ctx.restore();}}
 }
 function setupBoard(){
   const canvas=$('#vsCanvas',root);if(!canvas)return;
   let active=false,points=[],color='#176b58',width=4;
   const point=e=>{const r=canvas.getBoundingClientRect();return{x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};};
   canvas.onpointerdown=e=>{active=true;canvas.setPointerCapture(e.pointerId);points=[point(e)];};
   canvas.onpointermove=e=>{if(!active)return;points.push(point(e));if(points.length>120)points=points.filter((_,i)=>i%2===0);drawBoard();const ctx=canvas.getContext('2d');ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x*canvas.width,p.y*canvas.height):ctx.moveTo(p.x*canvas.width,p.y*canvas.height));ctx.stroke();};
   const finish=async()=>{if(!active)return;active=false;if(points.length>1)try{await api('board_stroke',{stroke:{points,color,width}});}catch(e){say(e.message);}points=[];};
   canvas.onpointerup=finish;canvas.onpointercancel=finish;
   $('#vsColor',root).oninput=e=>color=e.target.value;$('#vsWidth',root).oninput=e=>width=Number(e.target.value);
   $('#vsClear',root).onclick=async()=>{if(!confirm('تخته برای همه پاک شود؟'))return;try{await api('board_clear');drawBoard();}catch(e){say(e.message);}};
   $('#vsAddNote',root).onclick=async()=>{const text=$('#vsNote',root).value.trim();if(!text)return;try{await api('board_note',{text,x:.5,y:.5});$('#vsNote',root).value='';await poll();}catch(e){say(e.message);}};
   drawBoard();
 }
 async function stopTranscription(){
   try{await live()?.frame?.stopTranscription?.();}catch{}
   try{await api('transcription-stop');}catch{}
   transcribing=false;
 }
 async function saveTranscript(e){
   const text=String(e?.text||'').trim();if(!text||!transcribing)return;
   const speaker=data?.participants?.find(p=>String(p.sessionId)===String(e.participantId))?.name||'شرکت‌کننده';
   try{await api('transcript-line',{text,speaker,timestamp:Date.parse(e.timestamp)||Date.now()});await poll();}
   catch(err){await stopTranscription();say(err.message);}
 }
 async function summary(){
   const transcript=events.filter(e=>e.type==='transcript_line').map(e=>(e.payload.speaker||'کلاس')+': '+e.payload.text).join('\n');
   const quiz=events.filter(e=>['quiz_start','quiz_answer','quiz_grade'].includes(e.type)).map(e=>e.type+': '+JSON.stringify(e.payload)).join('\n');
   const notes=events.filter(e=>e.type==='board_note').map(e=>e.payload.text).join('، ');
   const source=[transcript&&'متن گفتار:\n'+transcript,quiz&&'آزمون شفاهی:\n'+quiz,notes&&'یادداشت‌های تخته:\n'+notes].filter(Boolean).join('\n\n').slice(0,12000);
   if(!source)return say('برای گزارش، ابتدا متن یا محتوای آموزشی ثبت کن.');
   const box=$('#vsSummaryResult',root);box.textContent='رایوا در حال ساخت گزارش است…';
   try{
     const r=await fetch('/api/ai',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:'از اطلاعات واقعی زیر گزارش کوتاه پایان کلاس به فارسی بساز: موضوعات تدریس‌شده، پرسش‌ها، پاسخ‌ها، بازخوردها و پیگیری لازم. چیزی را حدس نزن؛ موارد ناموجود را ثبت نشده بنویس.\n\n'+source}]})});
     const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'سرویس رایوا پاسخ نداد.');
     const text=String(j.text||'').trim();if(!text)throw new Error('گزارش خالی بود.');
     box.textContent=text;await api('summary_saved',{summary:text});say('گزارش پایان کلاس ذخیره شد.');
   }catch(e){box.textContent=e.message;say(e.message);}
 }
 function downloadReport(){
   const text='گزارش SmartClass Voice Studio\n\nخلاصه:\n'+($('#vsSummaryResult',root)?.textContent||'')+'\n\nمتن جلسه:\n'+events.filter(e=>e.type==='transcript_line').map(e=>time(e.created)+' '+e.payload.speaker+': '+e.payload.text).join('\n');
   const url=URL.createObjectURL(new Blob(['\uFEFF'+text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='SmartClass-VoiceStudio-Report.txt';a.click();URL.revokeObjectURL(url);
 }
 async function command(text){
   const box=$('#vsCommand',root);if(box)box.textContent='فرمان شنیده‌شده: '+text;
   if(/میکروفون همه|صدای همه.*قطع/.test(text)){
     if(!confirm('میکروفون دانش‌آموزان قطع شود؟'))return;
     await api('mute-all');await api('command_executed',{command:'mute-all'});say('میکروفون دانش‌آموزان قطع شد.');
   }else if(/گروه.*تشکیل|تقسیم.*گروه/.test(text)){
     if(!confirm('دانش‌آموزان به سه گروه تقسیم شوند؟'))return;
     await api('breakouts-create',{count:3});await api('command_executed',{command:'create-breakouts'});say('اتاق‌های گروهی ساخته شدند.');
   }else if(/پاک.*تخته|تخته.*پاک/.test(text)){
     if(!confirm('تخته برای همه پاک شود؟'))return;
     await api('board_clear');await api('command_executed',{command:'clear-board'});drawBoard();say('تخته پاک شد.');
   }else if(/خلاصه.*کلاس|گزارش.*کلاس/.test(text)){await api('command_executed',{command:'summary'});await summary();}
   else if(/شروع.*آزمون|سؤال.*بعدی|سوال.*بعدی/.test(text)){ $('[data-tab="quiz"]',root)?.click();$('#vsQuestion',root)?.focus();say('سؤال را وارد و نمایش آن را تأیید کن.');}
   else say('این فرمان شناخته نشد. فرمان‌های موجود را در راهنما ببین.');
 }
 function listen(){
   const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
   if(!SR)return say('تشخیص گفتار فارسی در این مرورگر پشتیبانی نمی‌شود.');
   if(recognition){try{recognition.stop();}catch{}recognition=null;return;}
   recognition=new SR();recognition.lang='fa-IR';recognition.interimResults=false;
   const btn=$('#vsListen',root);btn.textContent='در حال شنیدن…';
   recognition.onresult=e=>command(e.results?.[0]?.[0]?.transcript||'').catch(err=>say(err.message));
   recognition.onerror=e=>say('تشخیص گفتار ناموفق بود: '+String(e.error||'خطا'));
   recognition.onend=()=>{recognition=null;if(btn)btn.textContent='🎙️ شنیدن فرمان صوتی';};
   try{recognition.start();}catch(e){recognition=null;btn.textContent='🎙️ شنیدن فرمان صوتی';say('اجازهٔ میکروفون داده نشد.');}
 }
 function close(){
   if(!root)return;
   live()?.detachHost?.();root.remove();root=null;stopPoll();
   if(recognition){try{recognition.stop();}catch{}recognition=null;}
 }
 function open(){
   if(!teacher())return say('استودیوی صوتی فقط برای معلم و مدیر است.');
   if(root)return;
   const el=document.createElement('div');el.innerHTML=markup();root=el.firstElementChild;document.body.appendChild(root);
   live()?.attachHost?.($('#vsStage',root));
   $('#vsClose',root).onclick=close;
   $('#vsMainRoom',root).onclick=async()=>{try{await live()?.returnMainRoom?.();inBreakout=false;say('به کلاس اصلی برگشتی.');}catch(e){say(e.message);}};
   $$('[data-tab]',root).forEach(b=>b.onclick=()=>{$$('[data-tab]',root).forEach(x=>x.classList.toggle('active',x===b));$$('[data-page]',root).forEach(x=>x.classList.toggle('active',x.dataset.page===b.dataset.tab));});
   root.addEventListener('click',async e=>{
     const turn=e.target.closest('[data-vs-turn]');if(turn){try{await api('turn',{user:turn.dataset.vsTurn,grant:turn.dataset.grant==='1'});await poll();}catch(err){say(err.message);}return;}
     const grade=e.target.closest('[data-vs-grade]');if(grade){const score=prompt('نمره از ۲۰:','۲۰');if(score===null)return;const feedback=prompt('بازخورد (اختیاری):','');try{await api('quiz_grade',{user:grade.dataset.vsGrade,quizId:grade.dataset.q,score:Number(score),feedback:feedback||''});say('نمره ثبت شد.');await poll();}catch(err){say(err.message);}return;}
     const group=e.target.closest('[data-vs-group]');if(group){try{const access=await api('breakout-join',{id:group.dataset.vsGroup});await live()?.switchRoom?.(access,access.label);inBreakout=true;say('به '+access.label+' وارد شدی.');}catch(err){say(err.message);}}
   });
   $('#vsMuteAll',root).onclick=async()=>{if(!confirm('میکروفون همهٔ دانش‌آموزان خاموش شود؟'))return;try{await api('mute-all');await poll();say('میکروفون دانش‌آموزان خاموش شد.');}catch(e){say(e.message);}};
   $('#vsStartTranscript',root).onclick=async()=>{
     try{const result=await api('transcription-start');const frame=live()?.frame;if(!frame?.startTranscription)throw new Error('سرویس تماس از متن‌برداری پشتیبانی نمی‌کند.');
       await frame.startTranscription({participants:result.participants});transcribing=true;
       if(!frameBound.has(frame)){frame.on('transcription-message',saveTranscript);frameBound.add(frame);}
       say('متن‌برداری شروع شد؛ ضبط صدا خاموش است.');
     }catch(e){say(e.message);}
   };
   $('#vsStopTranscript',root).onclick=async()=>{await stopTranscription();say('متن‌برداری متوقف شد.');};
   $('#vsStartQuiz',root).onclick=async()=>{
     const question=$('#vsQuestion',root).value.trim();if(!question)return say('سؤال را وارد کن.');
     const options=$('#vsOptions',root).value.split(/[،,]/).map(x=>x.trim()).filter(Boolean);
     try{await api('quiz_start',{question,options});say('سؤال برای کلاس ارسال شد.');await poll();}catch(e){say(e.message);}
   };
   $('#vsEndQuiz',root).onclick=async()=>{
     const q=events.filter(e=>e.type==='quiz_start').slice(-1)[0];if(!q)return say('آزمون فعالی نیست.');
     try{await api('quiz_end',{quizId:q.payload.quizId});await poll();say('آزمون پایان یافت.');}catch(e){say(e.message);}
   };
   $('#vsCreateGroups',root).onclick=async()=>{try{await api('breakouts-create',{count:Number($('#vsCount',root).value)});await poll();say('اتاق‌های گروهی ساخته شدند.');}catch(e){say(e.message);}};
   $('#vsEndGroups',root).onclick=async()=>{if(!confirm('تمام اتاق‌های گروهی پایان یابند؟'))return;try{await api('breakouts-end');await poll();say('اتاق‌های گروهی پایان یافتند.');}catch(e){say(e.message);}};
   $('#vsListen',root).onclick=listen;$('#vsSummary',root).onclick=summary;$('#vsDownload',root).onclick=downloadReport;
   $('#vsClear',root).onclick=async()=>{if(!confirm('تخته برای همه پاک شود؟'))return;try{await api('board_clear');drawBoard();}catch(e){say(e.message);}};
   $('#vsAddNote',root).onclick=async()=>{const text=$('#vsNote',root).value.trim();if(!text)return;try{await api('board_note',{text,x:.5,y:.5});$('#vsNote',root).value='';await poll();}catch(e){say(e.message);}};
   setupBoard();
   if(live()?.voiceReady?.()){live()?.attachHost?.($('#vsStage',root));startPoll();}
   else showCallSetup();
 }
 async function showCallSetup(){
   const stage=$('#vsStage',root);if(!stage)return;
   stage.innerHTML='<div class="vs-connect-card"><span>🎥</span><h3>اتصال کلاس آنلاین</h3><p>برای فعال‌شدن اتاق خصوصی، سرویس تماس مدرسه باید به کلید محرمانهٔ Vercel متصل باشد. ضبط صدا خاموش می‌ماند.</p><button id="vsConnectCall">تلاش برای اتصال</button><small id="vsConnectStatus">سرویس تماس هنوز بررسی نشده است.</small></div>';
   $('#vsConnectCall',root).onclick=async()=>{
     const button=$('#vsConnectCall',root),status=$('#vsConnectStatus',root);
     button.disabled=true;status.textContent='در حال اتصال به سرویس امن…';
     try{
       await live()?.ensureStart?.();
       if(!live()?.voiceReady?.())throw new Error('اتاق تماس آماده نشد.');
       live()?.attachHost?.(stage);status.textContent='اتصال برقرار شد.';startPoll();
     }catch(e){
       status.textContent=e.message||'سرویس تماس پیکربندی نشده است.';
       button.disabled=false;
     }
   };
 }
 function studentPanel(){
   if(!document.documentElement.classList.contains('srv')||teacher())return;
   const shell=$('.sc-call-overlay .sc-call-window');if(!shell||$('.vs-student-tools',shell))return;
   const node=document.createElement('section');node.className='vs-student-tools';
   node.innerHTML='<div class="vs-student-head"><b>ابزارهای شرکت در کلاس</b><button id="vsRaiseHand">✋ درخواست نوبت صحبت</button></div><div class="vs-student-row"><div><button id="vsConsentToggle">رضایت برای متن‌برداری</button><small id="vsConsentState">متن گفتار فقط با رضایت شما و همهٔ حاضران ذخیره می‌شود؛ صدا ضبط نمی‌شود.</small></div><div id="vsStudentGroup"></div></div><div id="vsStudentQuiz"></div><div id="vsCaptions"></div>';
   const footer=$('.sc-call-foot',shell);shell.insertBefore(node,footer||null);
   $('#vsRaiseHand',node).onclick=async()=>{const mine=handQueue().some(e=>String(e.payload.user)===String(data?.me));try{await api(mine?'hand_lower':'hand_raise');await poll();say(mine?'درخواست لغو شد.':'درخواست صحبت به معلم ارسال شد.');}catch(e){say(e.message);}};
   $('#vsConsentToggle',node).onclick=async()=>{
     const allow=!data?.selfConsent;
     const promptText=allow?'آیا رضایت می‌دهی گفتارت به متن تبدیل و متن آن برای گزارش کلاس ذخیره شود؟ هیچ فایل صوتی ضبط نمی‌شود.':'رضایت متن‌برداری را لغو می‌کنی؟';
     if(!confirm(promptText))return;try{await api('consent',{allowed:allow});await poll();}catch(e){say(e.message);}
   };
   startPoll();
 }
 function watch(){
   new MutationObserver(()=>{if($('.sc-call-overlay'))studentPanel();}).observe(document.body,{childList:true,subtree:true});
 }
 window.openVoiceStudio=async()=>{
   if(!teacher())return say('استودیو فقط برای معلم و مدیر فعال است.');
   try{
     chat=String(state?.cur?.id||'');if(!chat||state.cur?.type!=='class')throw new Error('ابتدا یک کلاس را باز کن.');
     chat=String(live()?.chatId||chat);open();
   }catch(e){say(e.message||'استودیو باز نشد.');}
 };
 window.addEventListener('sc-voice-events-updated',()=>{if(root){renderTeacher();drawBoard();}renderStudent();});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watch,{once:true});else watch();
})();
