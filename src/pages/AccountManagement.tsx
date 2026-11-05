import {useEffect,useState} from 'react'
import {RefreshCw,ShieldCheck,Users,Save,UserCheck,UserX} from 'lucide-react'
import {useAccount} from '../state/account'
import {PageTitle} from '../components/UI'

type Role='student'|'teacher'|'admin'
type SchoolUser={id:number;username:string;name:string;role:Role;active:boolean}
type Draft={role:Role;active:boolean}

async function request<T>(url:string,options:RequestInit={}):Promise<T>{
 const response=await fetch(url,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}})
 const data=await response.json().catch(()=>({}))
 if(!response.ok)throw new Error(data.error||'درخواست انجام نشد.')
 return data as T
}
export default function AccountManagement(){
 const account=useAccount()
 const [users,setUsers]=useState<SchoolUser[]>([])
 const [drafts,setDrafts]=useState<Record<number,Draft>>({})
 const [loading,setLoading]=useState(true)
 const [savingId,setSavingId]=useState<number|null>(null)
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')
 async function loadUsers(){
  setLoading(true);setError('')
  try{
   const data=await request<{users:SchoolUser[]}>('/api/school/users')
   setUsers(data.users||[])
   setDrafts(Object.fromEntries((data.users||[]).map(u=>[u.id,{role:u.role,active:u.active}])))
  }catch(e){setError((e as Error).message)}
  finally{setLoading(false)}
 }
 useEffect(()=>{if(account.user?.role==='admin')void loadUsers();else setLoading(false)},[account.user?.role])
 const changeDraft=(id:number,patch:Partial<Draft>)=>setDrafts(current=>({...current,[id]:{...current[id],...patch}}))
 const saveUser=async(user:SchoolUser)=>{
  const draft=drafts[user.id]
  if(!draft||user.id===account.user?.id)return
  setSavingId(user.id);setError('');setMessage('')
  try{
   await request('/api/school/users/'+user.id,{method:'PATCH',body:JSON.stringify(draft)})
   setUsers(current=>current.map(u=>u.id===user.id?{...u,...draft}:u))
   setMessage('تغییرات حساب '+user.username+' ذخیره شد.')
  }catch(e){setError((e as Error).message)}
  finally{setSavingId(null)}
 }
 if(account.user?.role!=='admin')return <div className="empty-state"><ShieldCheck size={30}/><h2>دسترسی مدیر لازم است.</h2><p>این بخش فقط برای حساب مدیر مدرسه فعال است.</p></div>
 return <>
  <PageTitle eyebrow="SCHOOL ACCOUNT CONTROL" title="مدیریت حساب کاربری" text="حساب‌های مدرسه را ببین، نقش هر کاربر را مشخص کن و دسترسی فعال یا غیرفعال را مدیریت کن." action={<button className="secondary" onClick={()=>void loadUsers()} disabled={loading}><RefreshCw size={16}/>به‌روزرسانی فهرست</button>}/>
  <div className="admin-summary">
   <div><Users size={21}/><span><b>{users.length}</b><small>حساب ثبت‌شده</small></span></div>
   <div><UserCheck size={21}/><span><b>{users.filter(u=>u.active).length}</b><small>حساب فعال</small></span></div>
   <div><ShieldCheck size={21}/><span><b>{users.filter(u=>u.role==='teacher'||u.role==='admin').length}</b><small>مدیر و معلم</small></span></div>
  </div>
  {error&&<p className="notice" role="alert">{error}</p>}
  {message&&<p className="notice" role="status">{message}</p>}
  <section className="panel">
   <div className="section-title"><div><h2>فهرست کاربران</h2><p>برای هر حساب، نقش یا وضعیت را تغییر بده و ذخیره کن.</p></div><span className="tag">مدیریت امن</span></div>
   {loading?<div className="loading"><span/>در حال دریافت حساب‌ها…</div>:users.length===0?<p className="empty-state">هنوز حسابی ثبت نشده است.</p>:
    <div className="admin-user-list">{users.map(user=>{
     const draft=drafts[user.id]||{role:user.role,active:user.active}
     const own=user.id===account.user?.id
     const changed=draft.role!==user.role||draft.active!==user.active
     return <article className="admin-user-row" key={user.id}>
      <div className="admin-user-identity"><span className="avatar">{(user.name||user.username).slice(0,1)}</span><div><b>{user.name||'بدون نام نمایشی'}</b><small dir="ltr">@{user.username}{own?' · حساب شما':''}</small></div></div>
      <label className="field admin-role-field">نقش حساب<select value={draft.role} disabled={own} onChange={e=>changeDraft(user.id,{role:e.target.value as Role})}><option value="student">دانش‌آموز</option><option value="teacher">معلم</option><option value="admin">مدیر</option></select></label>
      <label className="admin-active-toggle"><input type="checkbox" checked={draft.active} disabled={own} onChange={e=>changeDraft(user.id,{active:e.target.checked})}/><span>{draft.active?'حساب فعال':'حساب غیرفعال'}</span>{draft.active?<UserCheck size={16}/>:<UserX size={16}/>}</label>
      <button className="secondary admin-save" disabled={own||!changed||savingId===user.id} onClick={()=>void saveUser(user)}><Save size={15}/>{savingId===user.id?'در حال ذخیره…':'ذخیره تغییرات'}</button>
     </article>
    })}</div>
   }
   <p className="microcopy">برای امنیت، امکان تغییر نقش یا غیرفعال‌کردن حساب مدیرِ واردشده در همین ردیف بسته است. تغییر نقش و وضعیت در سرور بررسی می‌شود.</p>
  </section>
 </>
}
