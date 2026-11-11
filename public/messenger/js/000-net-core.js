/* =========================================================
   Net core — shared runtime switches (loaded before everything else)
   NET.on === true  → server mode: /api/chat/* is the source of truth (real accounts, real classes)
   NET.on === false → local mode: IndexedDB + BroadcastChannel demo, works from file:// too
   ========================================================= */
const canTeachUI = () => state.role === 'teacher' || state.role === 'admin';
const roleNameUI = (role = state.role) => role === 'admin' ? 'مدیر مدرسه' : role === 'teacher' ? 'معلم' : 'دانش‌آموز';
const canSeeChatUI = chat => !!chat && Array.isArray(chat.vis) &&
  (chat.vis.includes(state.role) || (state.role === 'admin' && chat.vis.includes('teacher')));

const NET = {
  on: false,          // server mode active
  me: null,           // my client id in server mode, e.g. 'u12'
  user: null,         // my public profile from /api/chat/sync
  api: '/api/chat',   // base path of the messenger API
  status: 'boot',     // boot | online | offline | auth | local
  get httpOk(){ return /^https?:$/.test(location.protocol); },
};
