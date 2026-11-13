import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import StartupLoader from './components/StartupLoader'
import './style.css'
import './animations'
import './lab/lab.css'
import {initializeAccount} from './state/account'
const root=createRoot(document.getElementById('root')!);
root.render(<StartupLoader />);
initializeAccount().finally(()=>root.render(<StrictMode><App/></StrictMode>))
if(import.meta.env.PROD && 'serviceWorker' in navigator) window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{})})
