/* SmartClass real live classroom — Daily Prebuilt private rooms. */
(()=>{
  let frame=null,overlay=null,currentChat=null,loading=false;
  let scriptPromise=null;
  const $id=id=>document.getElementById(id);
  const notify=(message)=>{if(typeof toast==='function')toast(message,'🎥');else alert(message);};
  async function loadDaily(){
    if(window.Daily?.createFrame||window.DailyIframe?.createFrame)return;
    if(!scriptPromise){
      scriptPromise=new Promise((resolve,reject)=>{
        const script=document.createElement('script');
        script.src='https://unpkg.com/@daily-co/daily-js';
        script.async=true;
        script.onload=()=>window.Daily?.createFrame||window.DailyIframe?.createFrame?resolve():reject(new Error('کتابخانهٔ تماس بارگذاری نشد.'));
        script.onerror=()=>reject(new Error('ارتباط با سرویس تماس برقرار نشد.'));
        document.head.appendChild(script);
      });
    }
    await scriptPromise;
  }
  async function api(action,chat){
    const response=await fetch('/api/chat/call',{
      method:'POST',credentials:'same-origin',cache:'no-store',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action,chat})
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'اتصال تماس انجام نشد.');
    return data;
  }
  function cleanup(){
    try{if(frame){frame.destroy();}}catch{}
    frame=null;
    if(overlay){overlay.remove();overlay=null;}
    currentChat=null;
    loading=false;
    if(typeof refreshLiveClassButton==='function')refreshLiveClassButton();
  }
  async function exitCall(endClass=false){
    const chatId=currentChat;
    const oldFrame=frame;
    if(oldFrame){try{await oldFrame.leave();}catch{}}
    cleanup();
    if(endClass&&chatId){
      try{
        await api('end',chatId);
        if(state.cur?.id===chatId){state.cur.live=false;$id('livebar')?.classList.remove('show');}
        notify('جلسه برای همهٔ اعضای کلاس پایان یافت.');
      }catch(error){notify(error.message||'پایان جلسه ثبت نشد.');}
    }
  }
  function createShell(isOwner,chatName){
    const shell=document.createElement('div');
    shell.className='sc-call-overlay';
    shell.innerHTML='<section class="sc-call-window" role="dialog" aria-modal="true" aria-label="کلاس آنلاین"><header class="sc-call-head"><div><b>کلاس آنلاین SmartClass</b><small class="sc-call-state">در حال اتصال امن به اتاق خصوصی…</small></div><div class="sc-call-actions">'+(isOwner?'<button type="button" class="sc-call-end">پایان کلاس برای همه</button>':'')+'<button type="button" class="sc-call-leave">خروج از جلسه</button></div></header><div class="sc-call-frame"></div><footer class="sc-call-foot">ورود فقط با حساب عضو کلاس · ضبط جلسه خاموش است · قبل از فعال‌کردن دوربین و میکروفون، مجوز مرورگر را بررسی کن.</footer></section>';
    document.body.appendChild(shell);
    shell.querySelector('.sc-call-leave').addEventListener('click',()=>exitCall(false));
    shell.querySelector('.sc-call-end')?.addEventListener('click',()=>exitCall(true));
    shell.addEventListener('keydown',e=>{if(e.key==='Escape')exitCall(false);});
    overlay=shell;
    return shell;
  }
  async function join(action){
    if(loading)return;
    const chat=state?.cur;
    if(!NET?.on){notify('ابتدا با حساب واقعی مدرسه وارد شو؛ تماس نمایشی غیرفعال است.');return;}
    if(!chat||chat.type!=='class'){notify('برای تماس، یک کلاس را باز کن.');return;}
    if(action==='start'&&!canTeachUI()){notify('فقط معلم یا مدیر همان کلاس می‌تواند جلسه را شروع کند.');return;}
    loading=true;
    try{
      const access=await api(action,chat.id);
      await loadDaily();
      currentChat=chat.id;
      const owner=!!access.is_owner;
      const shell=createShell(owner,chat.name||'کلاس');
      const parent=shell.querySelector('.sc-call-frame');
      const factory=window.Daily?.createFrame||window.DailyIframe?.createFrame;
      frame=factory(parent,{
        showLeaveButton:true,
        showFullscreenButton:true,
        iframeStyle:{width:'100%',height:'100%',border:'0',borderRadius:'14px'},
        dailyConfig:{micAudioMode:'voice'}
      });
      frame.on('joined-meeting',()=>{
        const status=shell.querySelector('.sc-call-state');
        if(status)status.textContent='اتصال برقرار شد · '+(chat.name||'کلاس');
      });
      frame.on('left-meeting',()=>{if(frame)cleanup();});
      frame.on('error',event=>{
        const status=shell.querySelector('.sc-call-state');
        if(status)status.textContent='خطا در تماس: '+String(event?.errorMsg||'اتصال قطع شد').slice(0,120);
      });
      await frame.join({url:access.url,token:access.token});
      if(state.cur?.id===chat.id){state.cur.live=true;$id('livebar')?.classList.add('show');}
      if(typeof refreshLiveClassButton==='function')refreshLiveClassButton();
    }catch(error){
      cleanup();
      notify(error.message||'تماس زنده در دسترس نیست.');
    }finally{loading=false;}
  }
  function refreshLiveClassButton(){
    const chat=state?.cur;
    let button=$id('scLiveStart');
    const header=document.querySelector('.ch-head');
    if(!header)return;
    if(!button){
      button=document.createElement('button');
      button.id='scLiveStart';button.type='button';button.className='sc-live-start';
      button.title='شروع کلاس آنلاین';
      button.innerHTML='<span aria-hidden="true">🎥</span><span class="sc-live-label">شروع کلاس آنلاین</span>';
      const info=$id('infoBtn');
      if(info?.parentNode)info.parentNode.insertBefore(button,info);
      else header.appendChild(button);
      button.addEventListener('click',()=>join(state.cur?.live?'join':'start'));
    }
    const allowed=!!(NET?.on&&chat&&chat.type==='class'&&canTeachUI());
    button.hidden=!allowed;
    const label=button.querySelector('.sc-live-label');
    if(label)label.textContent=chat?.live?'ورود به کلاس زنده':'شروع کلاس آنلاین';
    button.title=chat?.live?'ورود به کلاس زنده':'شروع کلاس آنلاین';
    const joinButton=$id('joinBtn');
    if(joinButton){
      joinButton.textContent='پیوستن';
      joinButton.onclick=()=>join('join');
    }
  }
  window.refreshLiveClassButton=refreshLiveClassButton;
  // Replace legacy demo-only call hooks. In local preview they now state the limitation rather than faking media.
  window.startLive=()=>join('start');
  window.joinLive=()=>join('join');
  if($id('joinBtn'))$id('joinBtn').onclick=()=>join('join');
  const watch=()=>{
    refreshLiveClassButton();
    const who=$id('chWho'),bar=$id('livebar');
    if(who)new MutationObserver(refreshLiveClassButton).observe(who,{subtree:true,childList:true,characterData:true});
    if(bar)new MutationObserver(refreshLiveClassButton).observe(bar,{attributes:true,attributeFilter:['class']});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watch,{once:true});
  else watch();
})();
