import {useEffect,useState} from 'react'
import {ClipboardList,RefreshCw,Sparkles,Save,Trash2,Eye,Plus,Printer,CheckCircle2,AlertCircle} from 'lucide-react'
import {PageTitle} from '../components/UI'
import {useAccount} from '../state/account'

type Kind='choice'|'short'|'mixed'
type Difficulty='easy'|'medium'|'hard'
type Spec={title:string;topic:string;subject:string;grade:number;count:number;kind:Kind;difficulty:Difficulty;reference:string}
type ChoiceQuestion={type:'choice';prompt:string;options:string[];correctIndex:number;explanation:string}
type ShortQuestion={type:'short';prompt:string;answer:string;explanation:string}
type Exam=Spec&{questions:(ChoiceQuestion|ShortQuestion)[]}
type SavedExam={id:string;title:string;subject:string;grade:number;count:number;revision:number;created:number;updated:number}

const subjects=['ریاضی','علوم','فارسی','مطالعات اجتماعی','هدیه‌های آسمانی','قرآن','نگارش','پیام‌های آسمانی','زبان انگلیسی']
const choiceLetters=['الف','ب','پ','ت']
const initialSpec:Spec={title:'آزمون کلاسی',topic:'درس امروز',subject:'ریاضی',grade:3,count:5,kind:'mixed',difficulty:'medium',reference:''}

async function request<T>(url:string,options:RequestInit={}):Promise<T>{
 const response=await fetch(url,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}})
 const data=await response.json().catch(()=>({}))
 if(!response.ok)throw new Error(data.error||'درخواست انجام نشد.')
 return data as T
}
export default function TeacherExams(){
 const account=useAccount()
 const [spec,setSpec]=useState<Spec>(initialSpec)
 const [exam,setExam]=useState<Exam|null>(null)
 const [saved,setSaved]=useState<SavedExam[]>([])
 const [selectedId,setSelectedId]=useState<string|null>(null)
 const [revision,setRevision]=useState(0)
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')
 const [provider,setProvider]=useState('')
 async function loadList(){
  setLoading(true)
  try{const data=await request<{exams:SavedExam[]}>('/api/teacher-exams');setSaved(data.exams||[])}
  catch(e){setError((e as Error).message)}
  finally{setLoading(false)}
 }
 useEffect(()=>{if(account.user&&['teacher','admin'].includes(account.user.role))void loadList();else setLoading(false)},[account.user?.role])
 const setField=<K extends keyof Spec>(key:K,value:Spec[K])=>setSpec(current=>({...current,[key]:value}))
 const generate=async()=>{
  setBusy(true);setError('');setMessage('');setExam(null);setProvider('')
  try{
   const data=await request<{exam:Exam;model:string;provider:string}>('/api/teacher-exams/generate',{method:'POST',body:JSON.stringify(spec)})
   setExam(data.exam);setSelectedId(null);setRevision(0);setProvider(data.provider||data.model||'')
   setMessage('آزمون ساخته شد. سؤال‌ها و پاسخ‌نامه را بررسی کن؛ سپس آن را ذخیره کن.')
  }catch(e){setError((e as Error).message)}
  finally{setBusy(false)}
 }
 const save=async()=>{
  if(!exam)return
  setBusy(true);setError('');setMessage('')
  try{
   const path=selectedId?'/api/teacher-exams/'+selectedId:'/api/teacher-exams'
   const body=selectedId?{exam,revision}:{exam}
   const data=await request<{id:string;revision:number}>(path,{method:selectedId?'PUT':'POST',body:JSON.stringify(body)})
   setSelectedId(data.id);setRevision(data.revision)
   setMessage('آزمون در حساب شما ذخیره شد.')
   await loadList()
  }catch(e){setError((e as Error).message)}
  finally{setBusy(false)}
 }
 const openSaved=async(id:string)=>{
  setBusy(true);setError('');setMessage('')
  try{
   const data=await request<{exam:Exam;revision:number}>('/api/teacher-exams/'+id)
   setExam(data.exam);setSpec({title:data.exam.title,topic:data.exam.topic,subject:data.exam.subject,grade:data.exam.grade,count:data.exam.count,kind:data.exam.kind,difficulty:data.exam.difficulty,reference:data.exam.reference||''})
   setSelectedId(id);setRevision(data.revision);setMessage('آزمون ذخیره‌شده باز شد.')
  }catch(e){setError((e as Error).message)}
  finally{setBusy(false)}
 }
 const removeSaved=async(id:string)=>{
  if(!window.confirm('این آزمون از فهرست حساب شما حذف شود؟'))return
  setBusy(true);setError('');setMessage('')
  try{
   await request('/api/teacher-exams/'+id,{method:'DELETE'})
   setSaved(current=>current.filter(x=>x.id!==id))
   if(selectedId===id){setSelectedId(null);setRevision(0);setExam(null)}
   setMessage('آزمون حذف شد.')
  }catch(e){setError((e as Error).message)}
  finally{setBusy(false)}
 }
 if(!account.user||!['teacher','admin'].includes(account.user.role))return <div className="empty-state"><ClipboardList size={30}/><h2>دسترسی آموزگار لازم است.</h2><p>آزمون‌ساز فقط برای حساب معلم و مدیر مدرسه فعال است.</p></div>
 return <>
  <PageTitle eyebrow="TEACHER EXAM BUILDER" title="ساخت آزمون" text="برای درس و پایهٔ موردنظر آزمون بساز، پاسخ‌ها را بررسی کن و نسخهٔ نهایی را در حساب خودت نگه دار." action={<button className="secondary" onClick={()=>void loadList()} disabled={loading}><RefreshCw size={16}/>به‌روزرسانی آزمون‌ها</button>}/>
  <div className="exam-layout">
   <section className="panel exam-builder-panel">
    <div className="section-title"><div><h2><Sparkles size={18}/>طراحی آزمون تازه</h2><p>تنظیمات آزمون را وارد کن تا سؤال‌ها ساخته شوند.</p></div><span className="tag">ویژهٔ معلم و مدیر</span></div>
    <div className="exam-form-grid">
     <label className="field">عنوان آزمون<input value={spec.title} maxLength={120} onChange={e=>setField('title',e.target.value)}/></label>
     <label className="field">موضوع یا فصل<input value={spec.topic} maxLength={300} onChange={e=>setField('topic',e.target.value)} placeholder="مثلاً فصل اندازه‌گیری"/></label>
     <label className="field">درس<select value={spec.subject} onChange={e=>setField('subject',e.target.value)}>{subjects.map(s=><option key={s}>{s}</option>)}</select></label>
     <label className="field">پایه<select value={spec.grade} onChange={e=>setField('grade',Number(e.target.value))}>{Array.from({length:9},(_,i)=><option value={i+1} key={i}>{['اول','دوم','سوم','چهارم','پنجم','ششم','هفتم','هشتم','نهم'][i]} دبستان</option>)}</select></label>
     <label className="field">تعداد سؤال<select value={spec.count} onChange={e=>setField('count',Number(e.target.value))}>{[2,3,4,5,6,7,8,9,10].map(n=><option key={n} value={n}>{n} سؤال</option>)}</select></label>
     <label className="field">نوع سؤال<select value={spec.kind} onChange={e=>setField('kind',e.target.value as Kind)}><option value="mixed">ترکیبی</option><option value="choice">چهارگزینه‌ای</option><option value="short">پاسخ کوتاه</option></select></label>
     <label className="field">سطح دشواری<select value={spec.difficulty} onChange={e=>setField('difficulty',e.target.value as Difficulty)}><option value="easy">آسان</option><option value="medium">متوسط</option><option value="hard">دشوار</option></select></label>
     <label className="field exam-reference-field">متن درس یا منبع (اختیاری)<textarea value={spec.reference} maxLength={6000} rows={4} placeholder="برای ساخت سؤال دقیق‌تر، بخش موردنظر کتاب یا جزوه را اینجا وارد کن." onChange={e=>setField('reference',e.target.value)}/></label>
    </div>
    <div className="button-row exam-main-actions"><button className="primary" disabled={busy||!spec.title.trim()||!spec.topic.trim()} onClick={()=>void generate()}><Sparkles size={17}/>{busy?'در حال آماده‌سازی…':'ساخت سؤال‌ها'}</button><button className="secondary" disabled={busy} onClick={()=>{setSpec(initialSpec);setExam(null);setSelectedId(null);setRevision(0);setMessage('فرم برای آزمون تازه آماده شد.');setError('')}}><Plus size={16}/>آزمون تازه</button></div>
    <p className="microcopy">سؤال‌های تولیدشده را پیش از استفاده بررسی کن. متن منبع فقط برای ساخت آزمون به سرویس هوش مصنوعی پیکربندی‌شده ارسال می‌شود.</p>
   </section>
   <aside className="panel exam-saved-panel">
    <div className="section-title"><div><h2>آزمون‌های ذخیره‌شده</h2><p>آزمون‌های ساخته‌شده با همین حساب</p></div><span className="tag">{saved.length} مورد</span></div>
    {loading?<div className="loading"><span/>در حال دریافت…</div>:saved.length===0?<p className="empty-state">هنوز آزمونی ذخیره نکرده‌ای.</p>:<div className="exam-saved-list">{saved.map(item=><article className={selectedId===item.id?'exam-saved-item active':'exam-saved-item'} key={item.id}><button className="exam-saved-open" onClick={()=>void openSaved(item.id)} disabled={busy}><span><b>{item.title}</b><small>{item.subject} · پایهٔ {item.grade} · {item.count} سؤال</small></span><Eye size={17}/></button><button className="icon-button exam-delete" onClick={()=>void removeSaved(item.id)} disabled={busy} aria-label="حذف آزمون"><Trash2 size={16}/></button></article>)}</div>}
   </aside>
  </div>
  {error&&<p className="notice" role="alert"><AlertCircle size={17}/>{error}</p>}
  {message&&<p className="notice" role="status"><CheckCircle2 size={17}/>{message}{provider?' · '+provider:''}</p>}
  {exam&&<section className="panel exam-preview">
   <div className="section-title"><div><span className="eyebrow">EXAM PREVIEW</span><h2>{exam.title}</h2><p>{exam.subject} · پایهٔ {exam.grade} · {exam.questions.length} سؤال · {exam.difficulty==='easy'?'آسان':exam.difficulty==='hard'?'دشوار':'متوسط'}</p></div><span className="tag">{selectedId?'آزمون ذخیره‌شده':'پیش‌نمایش'}</span></div>
   <div className="exam-question-list">{exam.questions.map((question,index)=><article className="exam-question" key={index}>
    <div className="exam-question-title"><b>{index+1}. {question.prompt}</b><span>{question.type==='choice'?'چهارگزینه‌ای':'پاسخ کوتاه'}</span></div>
    {question.type==='choice'?<div className="exam-options">{question.options.map((option,i)=><div className={i===question.correctIndex?'correct':''} key={i}><b>{choiceLetters[i]}.</b>{option}{i===question.correctIndex&&<CheckCircle2 size={15}/>}</div>)}</div>:<p className="exam-short-answer">پاسخ نمونه: {question.answer}</p>}
    <details className="exam-answer-details"><summary>نمایش پاسخ و توضیح آموزگار</summary><p>{question.type==='choice'?'گزینهٔ درست: '+choiceLetters[question.correctIndex]+'. '+question.options[question.correctIndex]:'پاسخ: '+question.answer}</p>{question.explanation&&<p>{question.explanation}</p>}</details>
   </article>)}</div>
   <div className="button-row exam-main-actions"><button className="primary" disabled={busy} onClick={()=>void save()}><Save size={17}/>{busy?'در حال ذخیره…':selectedId?'ذخیرهٔ تغییرات':'ذخیره در حساب من'}</button><button className="secondary" disabled={busy} onClick={()=>window.print()}><Printer size={16}/>چاپ آزمون</button></div>
   <p className="microcopy">پاسخ‌نامه فقط برای بررسی آموزگار نمایش داده می‌شود. پیش از چاپ برای دانش‌آموز، پاسخ‌ها را مخفی یا حذف کن.</p>
  </section>}
 </>
}
