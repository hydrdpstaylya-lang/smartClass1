import {useEffect,useMemo,useRef,useState} from 'react'
import {ArrowUp,BookOpen,Bot,ChevronLeft,Copy,MessageSquarePlus,Moon,Search,Send,Sparkles,Sun,Trash2,Wifi,WifiOff,X} from 'lucide-react'
import {questions,lessons,subjects,normalise,fa,type Question} from '../data/curriculum'
import {askAI,useAIStatus,type AIMessage} from '../components/api'
import {useAccount} from '../state/account'

type RaivaMessage={id:string;role:'user'|'assistant';content:string;sources:string[];at:number}
type RaivaThread={id:string;title:string;updated:number;messages:RaivaMessage[]}
type Workspace={threads:RaivaThread[];activeId:string}
type Filter='all'|'math'|'science'|'farsi'|'social'|'writing'|'quran'|'hedie'
const STORAGE_KEY='smartclass.raiva.workspace.v1'
const newId=()=>Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9)
const makeThread=():RaivaThread=>({id:newId(),title:'گفت‌وگوی تازه',updated:Date.now(),messages:[]})
function loadWorkspace():Workspace{
 try{
  const raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null') as Partial<Workspace>|null
  const threads=Array.isArray(raw?.threads)?raw!.threads.filter((t):t is RaivaThread=>!!t&&typeof t.id==='string'&&typeof t.title==='string'&&Array.isArray(t.messages)).slice(0,30):[]
  if(threads.length){const activeId=threads.some(t=>t.id===raw?.activeId)?String(raw!.activeId):threads[0].id;return{threads,activeId}}
 }catch{}
 const first=makeThread()
 return{threads:[first],activeId:first.id}
}
function lessonFor(q:Question){return lessons.find(l=>l.id===q.skill)}
function rankedQuestions(query:string,filter:Filter='all'){
 const words=normalise(query).split(/\s+/).filter(w=>w.length>1)
 if(!words.length)return questions.slice(0,30).filter(q=>filter==='all'||lessonFor(q)?.subject===filter)
 return questions.map(q=>{
  const lesson=lessonFor(q)
  if(filter!=='all'&&lesson?.subject!==filter)return{q,score:0}
  const prompt=normalise(q.prompt),hay=normalise([q.prompt,q.hint,q.explanation,lesson?.title||'',lesson?.chapter||''].join(' '))
  const score=words.reduce((n,w)=>n+(hay.includes(w)?(prompt.includes(w)?3:1):0),0)
  return{q,score}
 }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,40).map(x=>x.q)
}
function localReply(found:Question[]){
 const q=found[0]
 if(q){
  const lesson=lessonFor(q)
  const options=q.options.map((option,i)=>['الف','ب','پ','ت'][i]+' ) '+option).join('\n')
  return 'از بانک سؤال‌های SmartClass یک تمرین مرتبط پیدا کردم:\n\n«'+q.prompt+'»\n\n'+options+'\n\nراهنمایی: '+q.hint+'\n\nبرای یادگیری بهتر، اول خودت راه‌حل را توضیح بده؛ بعد می‌توانی پاسخ و توضیح ثبت‌شده را در بخش بانک سؤال ببینی.'+(lesson?'\n\nدرس مرتبط: '+lesson.title:'')
 }
 return 'در حالت بانک محلی، می‌توانم از سؤال‌ها و درس‌های ذخیره‌شدهٔ SmartClass کمک بگیرم. نام درس یا موضوعی مثل «ضرب»، «نور و سایه»، «گیاهان» یا «کسر» را بنویس. برای پاسخ آزادتر، اتصال هوش مصنوعی سرور باید فعال باشد.'
}
function subjectName(key:string){return subjects[key as keyof typeof subjects]?.title||'درس‌های دیگر'}
const quickPrompts=['ضرب را با یک مثال یادم بده.','چرا سایه تغییر می‌کند؟','یک سؤال از بانک علوم پیدا کن.','برای امتحان ریاضی تمرین می‌خواهم.']

export default function Raiva(){
 const account=useAccount(),status=useAIStatus()
 const [workspace,setWorkspace]=useState<Workspace>(loadWorkspace)
 const [prompt,setPrompt]=useState('')
 const [bankSearch,setBankSearch]=useState('')
 const [filter,setFilter]=useState<Filter>('all')
 const [view,setView]=useState<'chat'|'bank'>('chat')
 const [dark,setDark]=useState(false)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [copied,setCopied]=useState('')
 const endRef=useRef<HTMLDivElement>(null)
 const inputRef=useRef<HTMLTextAreaElement>(null)
 const abortRef=useRef<AbortController|null>(null)
 const active=workspace.threads.find(t=>t.id===workspace.activeId)||workspace.threads[0]
 const messages=active?.messages||[]
 const bankResults=useMemo(()=>rankedQuestions(bankSearch,filter),[bankSearch,filter])
 const subjectsList=Object.keys(subjects) as Exclude<Filter,'all'>[]

 useEffect(()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(workspace))}catch{}},[workspace])
 useEffect(()=>{endRef.current?.scrollIntoView({block:'end',behavior:'smooth'})},[messages,busy,view])
 useEffect(()=>()=>abortRef.current?.abort(),[])

 const patchThread=(threadId:string,fn:(thread:RaivaThread)=>RaivaThread)=>{
  setWorkspace(current=>({...current,threads:current.threads.map(t=>t.id===threadId?fn(t):t)}))
 }
 const createThread=()=>{
  const thread=makeThread()
  setWorkspace(current=>({threads:[thread,...current.threads].slice(0,30),activeId:thread.id}))
  setView('chat');setPrompt('');setError('');inputRef.current?.focus()
 }
 const removeThread=(id:string)=>{
  const next=workspace.threads.filter(t=>t.id!==id)
  if(!next.length){const thread=makeThread();setWorkspace({threads:[thread],activeId:thread.id});return}
  setWorkspace({threads:next,activeId:workspace.activeId===id?next[0].id:workspace.activeId})
 }
 const askFromBank=(q:Question)=>{
  setView('chat')
  setPrompt('این سؤال را مرحله‌به‌مرحله و با راهنمایی ساده برایم توضیح بده: '+q.prompt)
  inputRef.current?.focus()
 }
 const send=async(value=prompt)=>{
  const content=value.trim()
  if(!content||busy)return
  const thread=active||makeThread(),threadId=thread.id
  const userMessage:RaivaMessage={id:newId(),role:'user',content,sources:[],at:Date.now()}
  const nextMessages=[...thread.messages,userMessage]
  setWorkspace(current=>{
   const exists=current.threads.some(t=>t.id===threadId)
   const updated=current.threads.map(t=>t.id===threadId?{...t,title:t.messages.length?t.title:content.slice(0,34),updated:Date.now(),messages:nextMessages}:t)
   return{threads:exists?updated:[{...thread,title:content.slice(0,34),updated:Date.now(),messages:nextMessages},...updated],activeId:threadId}
  })
  setPrompt('');setError('');setBusy(true)
  const matches=rankedQuestions(content,'all').slice(0,5)
  const sources=matches.map(q=>{const lesson=lessonFor(q);return lesson?lesson.title+' · بانک سؤال '+q.id:'بانک سؤال '+q.id})
  const context=matches.length?'\n\nنمونه‌های مرتبط از بانک سؤال داخلی (فقط مرجع آموزشی):\n'+matches.map((q,i)=>{
   const lesson=lessonFor(q)
   return String(i+1)+') درس: '+(lesson?.title||'عمومی')+'\nسؤال: '+q.prompt+'\nگزینه‌ها: '+q.options.join(' | ')+'\nراهنمایی: '+q.hint+'\nتوضیح آموزشی: '+q.explanation
  }).join('\n\n'):''
  abortRef.current=new AbortController()
  try{
   let answer=''
   if(status.ready){
    const history:AIMessage[]=nextMessages.slice(-10).map(m=>({role:m.role,content:m.content}))
    if(history.length)history[history.length-1]={role:'user',content:content+context+'\n\nبا فارسی ساده راهنمایی کن. از پاسخ‌گویی مستقیم و طولانی پرهیز کن و در پایان یک پرسش کوتاه برای فکر کردن بپرس.'}
    answer=await askAI(history,'tutor',undefined,abortRef.current.signal)
   }else answer=localReply(matches)
   const assistant:RaivaMessage={id:newId(),role:'assistant',content:answer,sources,at:Date.now()}
   patchThread(threadId,t=>({...t,updated:Date.now(),messages:[...t.messages,assistant]}))
  }catch(e){
   if((e as Error).name==='AbortError')setError('دریافت پاسخ متوقف شد.')
   else{
    const fallback=localReply(matches)
    const note='\n\nاتصال هوش مصنوعی در این لحظه پاسخ نداد؛ این راهنمای محلی از بانک سؤال و درس‌های SmartClass آمده است.'
    const assistant:RaivaMessage={id:newId(),role:'assistant',content:fallback+note,sources,at:Date.now()}
    patchThread(threadId,t=>({...t,updated:Date.now(),messages:[...t.messages,assistant]}))
    setError((e as Error).message)
   }
  }finally{setBusy(false);abortRef.current=null}
 }
 const copy=async(message:RaivaMessage)=>{
  try{await navigator.clipboard.writeText(message.content);setCopied(message.id);window.setTimeout(()=>setCopied(''),1800)}
  catch{setError('کپی خودکار در این مرورگر در دسترس نیست.')}
 }
 const label=status.ready?'هوش مصنوعی متصل':'بانک سؤال و راهنمای محلی'
 return <div className={dark?'raiva-page is-dark':'raiva-page'}>
  <header className="raiva-heading">
   <div className="raiva-brand-lockup"><span className="raiva-brand-mark"><Bot size={25}/></span><div><span className="raiva-kicker">SMARTCLASS · INTELLIGENT LEARNING</span><h1>رایوا <em>همیار هوشمند یادگیری</em></h1><p>پرسش کن، از بانک سؤال پیدا کن و با کمک راهنما یاد بگیر.</p></div></div>
   <div className="raiva-heading-actions"><span className={status.ready?'raiva-connection':'raiva-connection local'}><i/>{label}</span><button className="raiva-icon-button" onClick={()=>setDark(v=>!v)} aria-label={dark?'روشن کردن تم':'تیره کردن تم'}>{dark?<Sun size={18}/>:<Moon size={18}/>}</button></div>
  </header>
  <div className="raiva-layout">
   <aside className="raiva-sidebar">
    <button className="raiva-new-chat" onClick={createThread}><MessageSquarePlus size={17}/>گفت‌وگوی تازه</button>
    <div className="raiva-side-section"><div className="raiva-side-title"><span>گفت‌وگوهای اخیر</span><span>{fa(workspace.threads.length)}</span></div>
     <div className="raiva-history">{workspace.threads.map(t=><div className={t.id===active?.id?'raiva-history-item active':'raiva-history-item'} key={t.id}><button onClick={()=>{setWorkspace(v=>({...v,activeId:t.id}));setView('chat');setError('')}}><span className="raiva-history-dot"/><span>{t.title}</span></button><button className="raiva-delete" aria-label="حذف گفت‌وگو" onClick={()=>removeThread(t.id)}><Trash2 size={14}/></button></div>)}</div>
    </div>
    <div className="raiva-side-section raiva-bank-summary"><div className="raiva-side-title">بانک دانش رایوا</div><div className="raiva-bank-count"><BookOpen size={21}/><b>{fa(questions.length)}</b><span>تمرین و سؤال ثبت‌شده</span></div><button className={view==='bank'?'raiva-side-action active':'raiva-side-action'} onClick={()=>setView('bank')}><Search size={16}/>جست‌وجو در بانک سؤال <ChevronLeft size={15}/></button><button className={view==='chat'?'raiva-side-action active':'raiva-side-action'} onClick={()=>setView('chat')}><Sparkles size={16}/>گفت‌وگو با رایوا <ChevronLeft size={15}/></button></div>
    <div className="raiva-sidebar-foot"><span className="raiva-avatar">{(account.user?.name||'ر').slice(0,1)}</span><div><b>{account.user?.name||'کاربر SmartClass'}</b><small>{account.user?.role==='admin'?'مدیر':account.user?.role==='teacher'?'معلم':'همیار یادگیری'}</small></div></div>
   </aside>
   <main className="raiva-main">
    <div className="raiva-main-top"><div><span className="raiva-main-label">{view==='chat'?'CONVERSATION':'QUESTION BANK'}</span><h2>{view==='chat'?'گفت‌وگو با رایوا':'بانک سؤال‌های آموزشی'}</h2></div>{view==='chat'?<button className="raiva-quiet-button" onClick={createThread}><MessageSquarePlus size={16}/>گفت‌وگوی تازه</button>:<span className="raiva-result-count">{fa(bankResults.length)} نتیجه</span>}</div>
    {view==='chat'?<>
     <section className="raiva-messages" aria-live="polite">
      {!messages.length&&<div className="raiva-welcome"><span className="raiva-welcome-orb"><Sparkles size={32}/></span><span className="raiva-kicker">YOUR LEARNING COMPANION</span><h3>سلام! من رایوا هستم.</h3><p>می‌توانم از بانک سؤال‌های SmartClass تمرین مرتبط پیدا کنم و درس را با مثال ساده توضیح بدهم.</p><div className="raiva-prompts">{quickPrompts.map(q=><button key={q} onClick={()=>setPrompt(q)}>{q}<ArrowUp size={14}/></button>)}</div></div>}
      {messages.map(m=><article className={m.role==='user'?'raiva-message user':'raiva-message assistant'} key={m.id}><span className="raiva-message-icon">{m.role==='assistant'?<Bot size={18}/>:<span>{(account.user?.name||'شما').slice(0,1)}</span>}</span><div className="raiva-message-body"><div className="raiva-message-meta"><b>{m.role==='assistant'?'رایوا':account.user?.name||'شما'}</b><time>{new Date(m.at).toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'})}</time></div><p dir="auto">{m.content}</p>{m.sources.length>0&&<div className="raiva-sources"><span>منابع مرتبط از بانک:</span>{m.sources.map((s,i)=><span className="raiva-source" key={i}>{s}</span>)}</div>}{m.role==='assistant'&&<div className="raiva-message-actions"><button onClick={()=>void copy(m)}><Copy size={14}/>{copied===m.id?'کپی شد':'کپی پاسخ'}</button></div>}</div></article>)}
      {busy&&<div className="raiva-thinking"><span/><span/><span/>رایوا در حال بررسی سؤال و بانک دانش است…</div>}
      <div ref={endRef}/>
     </section>
     <form className="raiva-composer" onSubmit={e=>{e.preventDefault();void send()}}><textarea ref={inputRef} value={prompt} onChange={e=>setPrompt(e.target.value)} maxLength={3000} placeholder="سؤال درسی‌ات را اینجا بنویس…" aria-label="پیام به رایوا" onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send()}}}/><div className="raiva-composer-bottom"><span>پاسخ‌ها از بانک سؤال و سرویس هوش مصنوعی پیکربندی‌شده کمک می‌گیرند.</span><div>{busy?<button type="button" className="raiva-send" onClick={()=>abortRef.current?.abort()}><X size={17}/>توقف</button>:<button type="submit" className="raiva-send" disabled={!prompt.trim()}><Send size={17}/>ارسال</button>}</div></div></form>
     {error&&<p className="raiva-error" role="status">{error}</p>}
    </>:<section className="raiva-bank-view">
     <div className="raiva-bank-tools"><label><Search size={18}/><input value={bankSearch} onChange={e=>setBankSearch(e.target.value)} placeholder="جست‌وجوی صورت سؤال، درس یا موضوع…"/></label><select value={filter} onChange={e=>setFilter(e.target.value as Filter)}><option value="all">همهٔ درس‌ها</option>{subjectsList.map(s=><option key={s} value={s}>{subjectName(s)}</option>)}</select></div>
     <div className="raiva-question-list">{bankResults.length?bankResults.map((q,i)=>{const lesson=lessonFor(q);return <article className="raiva-question-card" key={q.id}><div className="raiva-question-top"><span>سؤال {fa(i+1)}</span><span>{lesson?.title||'بانک عمومی'}</span></div><h3>{q.prompt}</h3><ol>{q.options.map((option,j)=><li key={j}><b>{['الف','ب','پ','ت'][j]||fa(j+1)}</b>{option}</li>)}</ol><details><summary>پاسخ و توضیح آموزشی</summary><p>گزینهٔ درست: {q.options[q.answer]}</p><p>{q.explanation}</p><p className="raiva-hint">راهنمایی: {q.hint}</p></details><button className="raiva-ask-question" onClick={()=>askFromBank(q)}><Sparkles size={15}/>این سؤال را با رایوا تمرین کن</button></article>}):<div className="raiva-bank-empty"><Search size={26}/><b>سؤالی پیدا نشد.</b><span>واژهٔ کوتاه‌تری بنویس یا درس دیگری انتخاب کن.</span></div>}</div>
    </section>}
    <footer className="raiva-footer"><span><Wifi size={14}/>ذخیرهٔ گفتگو روی همین دستگاه</span><span><WifiOff size={14}/>در حالت آفلاین، جست‌وجوی بانک سؤال فعال است.</span></footer>
   </main>
  </div>
 </div>
}
