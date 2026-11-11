/* =========================================================
   Data
   ========================================================= */
const P = {
  t_sadeghi:{name:'خانم صادقی', short:'خانم صادقی', role:'teacher', title:'آموزگار پایهٔ سوم', g:6, img:SITE+'/images/teacher.webp', color:'#16866f', online:true},
  t_rahimi:{name:'آقای رحیمی', role:'teacher', title:'دبیر ریاضی', g:2, color:'#2c7aa6', online:false},
  s_ilya:{name:'ایلیا حیدری', role:'student', title:'کاوشگر پایهٔ سوم', g:1, color:'#c47a1c', online:true},
  s_sara:{name:'سارا محمدی', role:'student', title:'دانش‌آموز', g:4, color:'#d0566a', online:true},
  s_amir:{name:'امیر کاظمی', role:'student', title:'دانش‌آموز', g:2, color:'#2c7aa6', online:false},
  s_nika:{name:'نیکا رضایی', role:'student', title:'دانش‌آموز', g:3, color:'#6b5bd0', online:true},
  s_hasti:{name:'هستی نوری', role:'student', title:'دانش‌آموز', g:5, color:'#b07f12', online:false},
  raiva:{name:'رایوا', role:'bot', title:'همیار هوشمند', ai:true, color:'#16866f'},
};
const STUDENTS = ['s_ilya','s_sara','s_amir','s_nika','s_hasti'];
const state = { role:'student', folder:'all', cur:null, replyTo:null, focus:false, focusMissed:0, theme:'light' };
const meId = () => NET.me || (state.role==='student' ? 's_ilya' : 't_sadeghi');
const isMe = by => by==='@me' || by===meId();
const pname = id => id==='@me' ? (P[meId()].name) : (P[id]?.name || '');

const chats = [
  {id:'c1', type:'class', name:'کلاس سوم الف', sym:'۳', g:0, members:['t_sadeghi',...STUDENTS], vis:['student','teacher'], pinned:true, live:true, pinnedMsg:'a1', unread:3,
   msgs:[
    {id:'s0', sys:'خانم صادقی گروه «کلاس سوم الف» را ساخت', ts:T(3,'08:00')},
    {by:'t_sadeghi', t:'سلام بچه‌های عزیز 🌱\nامروز درس «الگوها» را با هم شروع کردیم. هر سؤالی داشتید همین‌جا بپرسید.', ts:T(1,'09:10'), react:{'❤️':6,'🌱':3}},
    {by:'s_sara', t:'سلام خانم، درس امروز خیلی جالب بود!', ts:T(1,'09:14')},
    {by:'t_sadeghi', file:{name:'جزوه الگوها - فصل ۲.pdf', size:'۲٫۴ مگابایت'}, ts:T(1,'09:20')},
    {by:'t_sadeghi', img:SITE+'/images/quest-island.webp', t:'نقشهٔ ماجراجویی امروز 🗺️ از جنگل مشاهده تا قلعهٔ دانش!', ts:T(0,'08:02')},
    {id:'a1', by:'t_sadeghi', assign:{title:'تمرین الگوهای عددی', subject:'ریاضی', desc:'صفحهٔ ۴۲ کتاب، تمرین ۱ تا ۵ را حل کنید و عکس آن را بفرستید.', created:NOW-6*HOUR, due:NOW+2*DAY+5*HOUR, subs:['s_sara','s_nika','s_hasti'], total:5}, ts:T(0,'08:10')},
    {id:'m_amir', by:'s_amir', t:'خانم برای تمرین ۳ راهنمایی می‌کنید؟ 🤔', ts:T(0,'08:16')},
    {by:'t_sadeghi', t:'الگو را پیدا کن: هر عدد چند تا از قبلی بیشتر است؟ 😉', reply:'m_amir', ts:T(0,'08:18')},
    {id:'q1', by:'t_sadeghi', quiz:{q:'عدد بعدی الگو چیست؟ ۲، ۴، ۶، ۸، …', opts:['۹','۱۰','۱۲'], correct:1, votes:[1,3,0], voted:{}}, ts:T(0,'08:30')},
    {by:'s_nika', stk:'🤩', ts:T(0,'08:33')},
    {by:'s_hasti', t:'من جواب دادم 🙋‍♀️', ts:T(0,'08:35'), react:{'👏':2}},
  ]},
  {id:'c2', type:'personal', members:['t_sadeghi','s_ilya'], vis:['student','teacher'], unread:1,
   msgs:[
    {by:'t_sadeghi', t:'ایلیا جان، تکلیف هفتهٔ قبل را خیلی خوب انجام دادی 👏', ts:T(1,'16:20')},
    {by:'s_ilya', t:'ممنون خانم صادقی 🙏 خیلی تلاش کردم.', ts:T(1,'16:31'), read:1},
    {by:'t_sadeghi', grade:{subject:'ریاضی · الگوها', score:19.5, max:20, note:'دقیق، مرتب و خلاقانه. همین‌طور ادامه بده! 🌟'}, ts:T(0,'07:45')},
    {by:'t_sadeghi', voice:{dur:9}, ts:T(0,'07:46')},
  ]},
  {id:'c3', type:'personal', bot:true, name:'رایوا | همیار هوشمند', members:['raiva'], vis:['student','teacher'], verified:true,
   msgs:[
    {by:'raiva', t:'سلام! من **رایوا** هستم، همیار هوشمند یادگیری تو ✦\n\nمی‌تونی ازم سؤال درسی بپرسی، یک محاسبه بدی (مثلاً ۱۲ × ۸)، یا بپرسی چه تکلیفی داری.', ts:T(0,'07:00'), ai:1},
   ]},
  {id:'c4', type:'channel', name:'اطلاع‌رسانی مدرسه', sym:'◎', g:6, members:['t_sadeghi'], vis:['student','teacher'], verified:true, muted:true, unread:2, admin:'teacher',
   msgs:[
    {by:'t_sadeghi', t:'📣 جشن علم\nروز پنجشنبه ساعت ۱۰ در سالن اجتماعات مدرسه برگزار می‌شود. بچه‌ها کاردستی‌های علمی‌شان را بیاورند.', ts:T(1,'12:00'), views:248, react:{'🎉':41,'❤️':18}},
    {by:'t_sadeghi', t:'🌧️ به دلیل بارندگی، زنگ ورزش فردا در سالن سرپوشیده برگزار می‌شود.', ts:T(0,'07:30'), views:131, react:{'👍':22}},
   ]},
  {id:'c5', type:'class', name:'ریاضی · آقای رحیمی', sym:'∑', g:1, members:['t_rahimi','s_ilya','s_sara','s_amir'], vis:['student'],
   msgs:[
    {by:'t_rahimi', t:'امتحان کسرها شنبه است 📝 فصل ۳ را مرور کنید.', ts:T(1,'11:00')},
    {by:'s_sara', t:'چشم آقا، ممنون', ts:T(1,'11:05')},
   ]},
  {id:'c6', type:'personal', members:['s_sara','s_ilya'], vis:['student'],
   msgs:[
    {by:'s_sara', t:'ایلیا تکلیف ریاضی را نوشتی؟', ts:T(0,'09:01')},
    {by:'s_ilya', t:'آره، صفحهٔ ۴۲ بود. الگوش هر بار ۲ تا اضافه میشه 😉', ts:T(0,'09:03'), read:1},
    {by:'s_sara', t:'مرسی 😊🌸', ts:T(0,'09:04')},
   ]},
  {id:'c7', type:'class', name:'اتاق معلمان', sym:'☕', g:5, members:['t_sadeghi','t_rahimi'], vis:['teacher'], unread:1,
   msgs:[
    {by:'t_rahimi', t:'جلسهٔ شورای معلمان ساعت ۱۳ برگزار می‌شود.', ts:T(0,'08:40')},
   ]},
  {id:'c8', type:'channel', name:'کتابخانهٔ مدرسه', sym:'📚', g:3, members:['t_sadeghi'], vis:['student','teacher'], admin:'teacher',
   msgs:[
    {by:'t_sadeghi', t:'📚 کتاب هفته: «شازده کوچولو»\nبرای امانت گرفتن به کتابخانه سر بزنید.', ts:T(2,'10:00'), views:96, react:{'📖':12}},
   ]},
  {id:'c9', type:'personal', saved:true, name:'پیام‌های ذخیره‌شده', members:['@me'], vis:['student','teacher'],
   msgs:[
    {by:'@me', t:'یادم باشد: آوردن کاردستی علوم برای جشن علم 🧪', ts:T(1,'20:10'), read:1},
   ]},
];
chats.forEach(c => c.msgs.forEach(m => { m.id = m.id || 'm'+nid(); }));

const STORIES = [
  {who:'مدرسه', av:{sym:'◎', g:6}, slides:[
    {bg:'linear-gradient(160deg,#16866f,#102c29)', em:'🔬', tag:'SCIENCE DAY', h:'جشن علم مدرسه', p:'پنجشنبه، ساعت ۱۰ صبح در سالن اجتماعات. کاردستی علمی‌ات را فراموش نکن!'},
    {bg:'linear-gradient(160deg,#efa457,#b3601a)', em:'🏆', tag:'CHALLENGE', h:'چالش هفته', p:'هر کس بیشترین الگوی عددی را پیدا کند، نشان «کاوشگر طلایی» می‌گیرد.'}]},
  {who:'خانم صادقی', av:{p:'t_sadeghi'}, slides:[
    {bg:'linear-gradient(160deg,#5aa9d6,#1d4f6e)', em:'🌱', tag:'پیام آموزگار', h:'اشتباه کردن هم بخشی از کشف کردن است.', p:'از سؤال پرسیدن نترسید؛ هر سؤال یک قدم به جلوست.'}]},
  {who:'رایوا', av:{ai:1}, slides:[
    {bg:'linear-gradient(160deg,#8b7fd6,#2c2466)', em:'✦', tag:'RAIVA AI', h:'یک سؤال، هزار کشف.', p:'از رایوا بپرس: «فتوسنتز چیه؟» یا «۲۴ ÷ ۶ چند میشه؟»'}]},
  {who:'کتابخانه', av:{sym:'📚', g:3}, slides:[
    {bg:'linear-gradient(160deg,#e2737b,#7a2a35)', em:'📖', tag:'BOOK OF THE WEEK', h:'شازده کوچولو', p:'«آنچه اصل است از چشم پنهان است.»'}]},
];

const EMO = '😀😃😄😁😆😅😂🤣😊😇🙂😉😍🥰😘😋😛🤪🤓😎🥳😏🤔🤗🤭🤫😶😐🙄😮😯😲🥺😢😭😤😡🤯😳😱😴🤤😷🤒👍👎👏🙌🙏💪✌️🤞👌✋🙋🙋‍♀️🙋‍♂️❤️🧡💛💚💙💜🤍💯🔥✨⭐🌟🎉🎊🎁🌱🌸🌹🌈☀️🌙⚡❄️☕🍎🍕🎂⚽🎨🎮🎧📱💻🚀✈️🏠';
const STK = ['🦉','🐱','🐶','🦊','🐼','🐸','🦄','🐧','🐙','🦁','🐢','🦋','🎉','🔥','❤️','🤩','🥳','😎','🏆','🚀'];
const EDU = ['📚','📖','✏️','📝','📐','📏','🧮','🔬','🧪','🧬','🔭','🌍','🗺️','🎓','🏫','🧠','💡','📊','📌','⏰','✅','❌','❓','❗','➕','➖','✖️','➗','🟰','π','∑','√'];
const REACTS = ['❤️','👍','🔥','👏','😂','🤩','😮','🙏'];
