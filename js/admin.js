let adminState={isAdmin:false,users:[],categories:[],lessons:[],category:'all',search:'',selectedUser:null,trainingProgress:[],navVisibility:{}};
let trainingState={categories:[],lessons:[],category:'all',search:'',status:'all',mode:'all',progress:[]};
function trainingDone(id){return trainingState.progress.some(p=>p.lesson_id===id&&p.status==='completed')}
function trainingProgressRow(id){return trainingState.progress.find(p=>p.lesson_id===id)||null}
function parseTrainingQuiz(raw){if(Array.isArray(raw))return raw; if(!raw)return []; try{const x=JSON.parse(raw); return Array.isArray(x)?x:[]}catch{return []}}
const LEARNING_TRACKS=[
 {id:'foundation',title:'База',short:'Фундамент',icon:'01',cats:['basics','candles','technical','tools','indicators']},
 {id:'systems',title:'Система',short:'Стратегии и паттерны',icon:'02',cats:['strategies','patterns']},
 {id:'practice',title:'Практика',short:'Навык трейдера',icon:'03',cats:['psychology','money-management','timing','practice','trade-review']},
 {id:'market',title:'Рынок',short:'Аналитика и опыт',icon:'04',cats:['market-analysis','sessions','advanced']}
];
function learningCategoryBySlug(slug){return trainingState.categories.find(c=>c.slug===slug)||null}
function learningTrackForCategory(cat){return LEARNING_TRACKS.find(t=>t.cats.includes(cat?.slug))||null}
function learningTrackCategories(track){return (track?.cats||[]).map(learningCategoryBySlug).filter(Boolean)}
function youtubeEmbedUrl(url){const m=String(url||'').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/); return m?`https://www.youtube.com/embed/${m[1]}?rel=0&modestbranding=1`:''}

document.addEventListener('DOMContentLoaded',()=>{bindAdminUI();refreshAdminAccess();bindTrainingUI();});
document.addEventListener('auth:ready',refreshAdminAccess);
document.addEventListener('cloud:data-ready',()=>{if(adminState.isAdmin){loadAdminUsers();loadAdminLearning();}loadTrainingView();});
function startQuoteRotation(){const q=DEFAULT_DATA.quotes||[];if(!q.length)return;let idx=Math.floor(Math.random()*q.length);renderQuote(idx);window.setInterval(()=>{let n=Math.floor(Math.random()*q.length);if(q.length>1&&n===idx)n=(n+1)%q.length;idx=n;renderQuote(idx)},60000)}
document.addEventListener('DOMContentLoaded',()=>{window.setTimeout(startQuoteRotation,300)});

async function refreshAdminAccess(){
 const client=window.supabaseClient,user=window.currentUser;
 if(!client||!user){setAdminVisibility(false);return;}
 const {data,error}=await client.from('user_roles').select('role').eq('user_id',user.id).maybeSingle();
 adminState.isAdmin=!error&&data?.role==='admin'; setAdminVisibility(adminState.isAdmin);
 await loadNavigationVisibility();
 if(adminState.isAdmin){loadAdminUsers();loadAdminLearning();}
 loadTrainingView();
}
async function loadNavigationVisibility(){
 if(!window.supabaseClient||!window.currentUser)return;
 const {data,error}=await window.supabaseClient.from('app_navigation_visibility').select('*').order('sort_order');
 if(error||!data)return;
 adminState.navVisibility=Object.fromEntries(data.map(x=>[x.view_key,x.visible]));
 // Settings affect regular users only. Admins always see every application tab.
 if(!adminState.isAdmin){
  document.querySelectorAll('[data-view]').forEach(el=>{const key=el.dataset.view;if(key&&Object.prototype.hasOwnProperty.call(adminState.navVisibility,key))el.hidden=adminState.navVisibility[key]===false;});
  document.querySelectorAll('.view').forEach(el=>{const key=el.id.replace(/^view-/,'');if(Object.prototype.hasOwnProperty.call(adminState.navVisibility,key))el.hidden=adminState.navVisibility[key]===false;});
  if(typeof activeView!=='undefined'&&adminState.navVisibility[activeView]===false&&typeof showView==='function')showView('dashboard');
 }else{
  document.querySelectorAll('[data-view]').forEach(el=>{if(!el.classList.contains('admin-only'))el.hidden=false;});
  document.querySelectorAll('.view').forEach(el=>{if(el.id!=='view-admin')el.hidden=false;});
 }
 if(adminState.isAdmin)renderNavigationVisibilityControls();
}
async function setNavigationVisibility(key,visible){
 if(!adminState.isAdmin)return;
 const {error}=await window.supabaseClient.from('app_navigation_visibility').update({visible}).eq('view_key',key);
 if(error){toast(error.message,true);return;}
 adminState.navVisibility[key]=visible;await loadNavigationVisibility();toast(visible?'Раздел показан':'Раздел скрыт');
}
function renderNavigationVisibilityControls(){
 const host=document.getElementById('adminNavigationVisibility');if(!host)return;
 const names={dashboard:'Обзор',trades:'Сделки',calendar:'Календарь',statistics:'Аналитика',charts:'Графики',plan:'План',playbook:'Playbook',goal:'Главная цель',goals:'Цели',journal:'Журнал',notes:'Заметки',psychology:'Психология',import:'Импорт',settings:'Настройки',training:'Обучение'};
 host.innerHTML=Object.keys(names).map(k=>`<label class="admin-visibility-row"><span><b>${names[k]}</b><small>Показывать раздел пользователям</small></span><input type="checkbox" data-nav-visibility="${k}" ${adminState.navVisibility[k]!==false?'checked':''}></label>`).join('');
 host.querySelectorAll('[data-nav-visibility]').forEach(x=>x.addEventListener('change',()=>setNavigationVisibility(x.dataset.navVisibility,x.checked)));
}
function setAdminVisibility(ok){
 document.querySelectorAll('.admin-only').forEach(x=>x.hidden=!ok);
 const view=document.getElementById('view-admin');if(view)view.hidden=!ok;
 if(!ok&&typeof activeView!=='undefined'&&activeView==='admin'&&typeof showView==='function')showView('dashboard');
}
function bindAdminUI(){
 document.addEventListener('click',e=>{
  const tab=e.target.closest('[data-admin-tab]');if(tab){document.querySelectorAll('[data-admin-tab]').forEach(x=>x.classList.toggle('active',x===tab));document.querySelectorAll('[data-admin-panel]').forEach(x=>x.classList.toggle('active',x.dataset.adminPanel===tab.dataset.adminTab));if(tab.dataset.adminTab==='learning')loadAdminLearning();if(tab.dataset.adminTab==='users')loadAdminUsers();return;}
  const act=e.target.closest('[data-admin-action]');if(act){handleAdminAction(act.dataset.adminAction,act.dataset.userId||'');return;}
  const cat=e.target.closest('[data-admin-category]');if(cat){adminState.category=cat.dataset.adminCategory;renderAdminLearning();return;}
  const edit=e.target.closest('[data-admin-edit]');if(edit){adminLessonModal(edit.dataset.adminEdit);return;}
  const pub=e.target.closest('[data-admin-publish]');if(pub){toggleLessonPublish(pub.dataset.adminPublish);return;}
  const del=e.target.closest('[data-admin-delete]');if(del){deleteAdminLesson(del.dataset.adminDelete);return;}
  const preview=e.target.closest('[data-admin-preview]');if(preview){previewLesson(preview.dataset.adminPreview);return;}
  const dup=e.target.closest('[data-admin-duplicate]');if(dup){duplicateLesson(dup.dataset.adminDuplicate);return;}
  const tcat=e.target.closest('[data-training-category]');if(tcat){trainingState.category=tcat.dataset.trainingCategory;renderTrainingView();return;}
  const ttrack=e.target.closest('[data-training-track]');if(ttrack){trainingState.category=ttrack.dataset.trainingTrack==='all'?'all':`track:${ttrack.dataset.trainingTrack}`;renderTrainingView();return;}
  const tstatus=e.target.closest('[data-training-status]');if(tstatus){trainingState.status=tstatus.dataset.trainingStatus;renderTrainingView();return;}
  const tmode=e.target.closest('[data-training-mode]');if(tmode){trainingState.mode=tmode.dataset.trainingMode;renderTrainingView();return;}
  const topen=e.target.closest('[data-training-open]');if(topen){openTrainingLesson(topen.dataset.trainingOpen);return;}
 });
 document.getElementById('adminRefreshUsers')?.addEventListener('click',loadAdminUsers);
 document.getElementById('adminRefreshLearning')?.addEventListener('click',loadAdminLearning);
 document.getElementById('adminAddLesson')?.addEventListener('click',()=>adminLessonModal());
 document.getElementById('adminAddCategory')?.addEventListener('click',adminCategoryModal);
 document.getElementById('adminUserSearch')?.addEventListener('input',e=>{adminState.search=e.target.value.toLowerCase();renderAdminUsers();});
}
async function handleAdminAction(action,userId){
 if(action==='retry-users')return loadAdminUsers();
 if(action==='refresh-all'){await loadAdminUsers();await loadAdminLearning();return;}
 if(action==='focus-users'){document.querySelector('[data-admin-tab=\"users\"]')?.click();return;}
 if(action==='focus-learning'){document.querySelector('[data-admin-tab=\"learning\"]')?.click();return;}
 if(action==='open-user')return openAdminUser(userId);
 if(action==='role-toggle')return toggleAdminRole(userId);
 if(action==='admin-deposit')return adminBalanceModal(userId,'deposit');
 if(action==='admin-withdrawal')return adminBalanceModal(userId,'withdrawal');
}
async function loadAdminUsers(){
 if(!adminState.isAdmin||!window.supabaseClient)return;
 const body=document.getElementById('adminUsersBody');if(body)body.innerHTML='<tr><td colspan="10">Загрузка…</td></tr>';
 const {data,error}=await window.supabaseClient.rpc('admin_list_users');
 if(error){if(body)body.innerHTML=`<tr><td colspan="11"><div class="admin-error"><b>Не удалось загрузить пользователей</b><span>${escapeHtml(error.message||'Ошибка')}</span><button class="secondary-btn" data-admin-action="retry-users">Повторить</button></div></td></tr>`;return;}
 adminState.users=data||[];renderAdminUsers();renderAdminOverview();
}
function formatAdminMoney(v,currency){const code=currency||'USD';const item=(DEFAULT_DATA.currencies||[]).find(x=>x[0]===code);const symbol=item?item[1]:code;return `${symbol}${new Intl.NumberFormat('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(v)||0)}`;}
function renderAdminUsers(){
 const body=document.getElementById('adminUsersBody');if(!body)return;
 const q=adminState.search;const rows=adminState.users.filter(u=>!q||String(u.email||'').toLowerCase().includes(q)||String(u.display_name||'').toLowerCase().includes(q));
 body.innerHTML=rows.map(u=>`<tr><td><div class="admin-user-cell"><div class="admin-avatar">${u.avatar_url?`<img src="${escapeAttr(u.avatar_url)}" alt="">`:escapeHtml((u.display_name||u.email||'U').charAt(0).toUpperCase())}</div><div><b>${escapeHtml(u.display_name||'Без никнейма')}</b><small>${escapeHtml(u.email||'')}</small></div></div></td><td><span class="currency-chip">${escapeHtml(u.currency||'—')}</span></td><td class="admin-balance">${formatAdminMoney(Number(u.current_balance||0),u.currency)}</td><td class="positive">+${formatAdminMoney(Number(u.deposits||0),u.currency)}</td><td class="negative">−${formatAdminMoney(Number(u.withdrawals||0),u.currency)}</td><td>${Number(u.trades_count||0).toLocaleString('ru-RU')}</td><td class="${Number(u.pnl)>0?'positive':Number(u.pnl)<0?'negative':''}">${formatAdminMoney(Number(u.pnl||0),u.currency)}</td><td>${Number(u.win_rate||0).toFixed(1)}%</td><td>${formatAdminDate(u.last_sign_in_at)}</td><td><span class="admin-role ${u.role==='admin'?'is-admin':''}">${u.role==='admin'?'ADMIN':'USER'}</span></td><td><div class="admin-row-actions"><button class="mini-btn" data-admin-action="open-user" data-user-id="${u.id}">Открыть</button>${u.id!==window.currentUser?.id?`<button class="mini-btn" data-admin-action="role-toggle" data-user-id="${u.id}">${u.role==='admin'?'Снять admin':'Сделать admin'}</button>`:''}</div></td></tr>`).join('')||'<tr><td colspan="11">Ничего не найдено.</td></tr>';
}
function renderAdminOverview(){
 const box=document.getElementById('adminOverview');if(!box)return;const u=adminState.users;
 const trades=u.reduce((s,x)=>s+Number(x.trades_count||0),0),active=u.filter(x=>x.last_sign_in_at).length;
 const groups={};u.forEach(x=>{const c=x.currency||'USD';groups[c]=(groups[c]||0)+Number(x.current_balance||0)});
 const balances=Object.entries(groups).map(([c,v])=>formatAdminMoney(v,c)).join(' · ')||'—';
 box.innerHTML=`<div class="admin-stat"><span>Пользователи</span><b>${u.length}</b><small>${active} с историей входов</small></div><div class="admin-stat"><span>Все сделки</span><b>${trades.toLocaleString('ru-RU')}</b><small>по всем аккаунтам</small></div><div class="admin-stat"><span>Валюты</span><b>${Object.keys(groups).length}</b><small>${Object.keys(groups).join(' · ')||'—'}</small></div><div class="admin-stat"><span>Баланс по валютам</span><b>${balances}</b><small>без смешивания разных валют</small></div>`;
}
async function openAdminUser(id){
 const {data,error}=await window.supabaseClient.rpc('admin_user_detail',{target_user:id});if(error){toast(error.message,true);return;}adminState.selectedUser=data;renderAdminUserModal(data);
}
function renderAdminUserModal(d){
 const u=d.user,s=d.summary||{};openModal();document.getElementById('modalContent').innerHTML=`<div class="admin-detail"><div class="admin-detail-head"><div><span class="eyebrow">USER CONTROL</span><h2>${escapeHtml(u.display_name||'Без никнейма')}</h2><p>${escapeHtml(u.email||'')}</p><span class="currency-badge">Валюта счёта: ${escapeHtml(u.currency||'—')}</span></div><span class="admin-role ${u.role==='admin'?'is-admin':''}">${u.role}</span><span class="currency-chip">${escapeHtml(s.currency||u.currency||'USD')}</span></div><div class="admin-detail-kpis"><div><span>Баланс</span><b>${formatAdminMoney(Number(s.current_balance||0),s.currency||u.currency)}</b></div><div><span>Сделки</span><b>${Number(s.trades||0).toLocaleString('ru-RU')}</b></div><div><span>P&amp;L</span><b>${formatAdminMoney(Number(s.pnl||0),s.currency||u.currency)}</b></div><div><span>Win Rate</span><b>${Number(s.win_rate||0).toFixed(1)}%</b></div><div><span>Пополнения</span><b>${formatAdminMoney(Number(s.deposits||0),s.currency||u.currency)}</b></div><div><span>Выводы</span><b>${formatAdminMoney(Number(s.withdrawals||0),s.currency||u.currency)}</b></div></div><div class="admin-detail-actions"><button class="secondary-btn" data-admin-action="admin-deposit" data-user-id="${u.id}">＋ Пополнить</button><button class="secondary-btn" data-admin-action="admin-withdrawal" data-user-id="${u.id}">− Вывести</button></div><div class="admin-detail-section"><h3>Последние сделки</h3><div class="admin-mini-list">${(d.trades||[]).map(t=>`<div><span>${escapeHtml(t.date||'')} ${escapeHtml(String(t.time||'').slice(0,5))}</span><b>${escapeHtml(t.instrument||'')}</b><strong class="${Number(t.pnl)>=0?'positive':'negative'}">${formatAdminMoney(Number(t.pnl||0),s.currency||u.currency)}</strong></div>`).join('')||'<small>Нет сделок</small>'}</div></div><div class="admin-detail-section"><h3>Последние операции</h3><div class="admin-mini-list">${(d.operations||[]).map(o=>`<div><span>${escapeHtml(o.date||'')}</span><b>${o.type==='withdrawal'?'Вывод':'Пополнение'}</b><strong>${o.type==='withdrawal'?'−':'+'}${formatAdminMoney(Number(o.amount||0),o.currency||s.currency||u.currency)}</strong></div>`).join('')||'<small>Нет операций</small>'}</div></div></div>`;
}
async function toggleAdminRole(id){const u=adminState.users.find(x=>x.id===id);if(!u)return;if(!confirm(`${u.role==='admin'?'Снять права администратора у':'Назначить администратором'} ${u.email}?`))return;const {error}=await window.supabaseClient.rpc('admin_set_user_role',{target_user:id,new_role:u.role==='admin'?'user':'admin'});if(error){toast(error.message,true);return;}toast('Роль обновлена');loadAdminUsers();}
function adminBalanceModal(userId,type){
 openSimpleModal(type==='deposit'?'Админ: пополнение':'Админ: вывод','Операция будет записана в баланс выбранного участника.',async f=>{const {error}=await window.supabaseClient.rpc('admin_add_balance_operation',{target_user:userId,op_type:type,op_amount:Number(f.amount),op_note:f.note||'',op_date:f.date||new Date().toISOString().slice(0,10),op_time:f.time||new Date().toTimeString().slice(0,5)});if(error){toast(error.message,true);return;}toast('Операция записана');openAdminUser(userId);loadAdminUsers();},[{name:'amount',label:'Сумма',type:'number',step:'0.01',required:true},{name:'date',label:'Дата',type:'date',value:new Date().toISOString().slice(0,10)},{name:'time',label:'Время',type:'time',value:new Date().toTimeString().slice(0,5)},{name:'note',label:'Комментарий',type:'text',value:''}]);
}
async function loadAdminLearning(){
 if(!adminState.isAdmin||!window.supabaseClient)return;const [c,l]=await Promise.all([window.supabaseClient.from('learning_categories').select('*').order('sort_order'),window.supabaseClient.from('learning_lessons').select('*').order('sort_order')]);if(c.error||l.error){toast((c.error||l.error)?.message||'Ошибка обучения',true);return;}adminState.categories=c.data||[];adminState.lessons=l.data||[];renderAdminLearning();renderNavigationVisibilityControls();loadTrainingView();
}
function renderAdminLearning(){
 const cats=document.getElementById('adminCategoryList'),lessons=document.getElementById('adminLessons');if(!cats||!lessons)return;
 cats.innerHTML=`<button class="admin-category ${adminState.category==='all'?'active':''}" data-admin-category="all">Все уроки <b>${adminState.lessons.length}</b></button>`+adminState.categories.map(c=>`<button class="admin-category ${adminState.category===c.id?'active':''}" data-admin-category="${c.id}">${escapeHtml(c.title)} <b>${adminState.lessons.filter(l=>l.category_id===c.id).length}</b></button>`).join('');
 const list=adminState.category==='all'?adminState.lessons:adminState.lessons.filter(l=>l.category_id===adminState.category);
 lessons.innerHTML=list.map(l=>`<article class="admin-lesson-row"><div><span class="admin-status ${l.status}">${l.status==='published'?'ОПУБЛИКОВАН':'ЧЕРНОВИК'}</span><h4>${escapeHtml(l.title)}</h4><p>${escapeHtml(l.excerpt||'Без описания')}</p><small>${escapeHtml(l.lesson_type||'article')} · ${escapeHtml(adminState.categories.find(c=>c.id===l.category_id)?.title||'Без категории')}</small></div><div class="admin-row-actions"><button class="secondary-btn" data-admin-preview="${l.id}">Просмотр</button><button class="secondary-btn" data-admin-edit="${l.id}">Изменить</button><button class="ghost-btn" data-admin-duplicate="${l.id}">Копия</button><button class="ghost-btn" data-admin-publish="${l.id}">${l.status==='published'?'Снять':'Опубликовать'}</button><button class="danger-btn" data-admin-delete="${l.id}">Удалить</button></div></article>`).join('')||'<div class="empty-inline">Уроков пока нет.</div>';
}
function adminCategoryModal(id){const c=adminState.categories.find(x=>x.id===id)||{};openSimpleModal(id?'Изменить категорию':'Новая категория','Категории формируют левую навигацию обучения.',async f=>{const row={title:f.title,slug:(f.slug||f.title).toLowerCase().trim().replace(/[^a-z0-9а-яё]+/gi,'-'),description:f.description||'',sort_order:Number(f.sort_order)||0,published:f.published!=='false'};const r=id?await window.supabaseClient.from('learning_categories').update(row).eq('id',id):await window.supabaseClient.from('learning_categories').insert(row);if(r.error){toast(r.error.message,true);return;}toast('Категория сохранена');loadAdminLearning();},[{name:'title',label:'Название',type:'text',value:c.title||'',required:true},{name:'slug',label:'Slug',type:'text',value:c.slug||''},{name:'description',label:'Описание',type:'textarea',value:c.description||''},{name:'sort_order',label:'Порядок',type:'number',value:c.sort_order||0}]);}
async function uploadLearningAsset(file,folder){
 if(!file)return null;
 if(!window.supabaseClient)throw new Error('Нет подключения к хранилищу Supabase.');
 const allowed=folder==='audio'?['audio/mpeg','audio/mp3','audio/mp4','audio/x-m4a','audio/wav','audio/x-wav','audio/ogg','audio/aac','audio/webm','application/octet-stream']:folder==='images'?['image/jpeg','image/png','image/webp','image/gif','image/avif','application/octet-stream']:['application/pdf','application/epub+zip','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/octet-stream'];
 if(file.size>(folder==='images'?15:100)*1024*1024)throw new Error(folder==='images'?'Изображение слишком большое. Максимум — 15 МБ на файл.':'Файл слишком большой. Максимальный размер — 100 МБ.');
 if(file.type&&!allowed.includes(file.type)&&!(/\.(mp3|m4a|wav|ogg|aac|webm)$/i.test(file.name)&&folder==='audio')&&!(/\.(jpg|jpeg|png|webp|gif|avif)$/i.test(file.name)&&folder==='images')&&!(/\.(pdf|epub|doc|docx)$/i.test(file.name)&&folder==='books'))throw new Error(folder==='audio'?'Поддерживаются MP3, M4A, WAV, OGG, AAC и WebM.':folder==='images'?'Поддерживаются JPG, PNG, WEBP, GIF и AVIF.':'Поддерживаются PDF, EPUB, DOC и DOCX.');
 const safeName=String(file.name||'file').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(-100)||'file';
 const path=`${folder}/${window.currentUser?.id||'admin'}/${Date.now()}-${Math.random().toString(36).slice(2,9)}-${safeName}`;
 const {error}=await window.supabaseClient.storage.from('learning-assets').upload(path,file,{upsert:false,contentType:file.type||undefined});
 if(error)throw new Error(`Не удалось загрузить файл: ${error.message}. Проверь, что применена миграция learning_assets_storage.sql.`);
 const {data}=window.supabaseClient.storage.from('learning-assets').getPublicUrl(path);
 return data?.publicUrl||null;
}
function adminLessonModal(id){
 const l=adminState.lessons.find(x=>x.id===id)||{},old=l.content||{};
 openSimpleModal(id?'Изменить урок':'Новый урок','Можно добавить видео, аудио, пост и книгу. Файлы загружаются в Supabase Storage при сохранении.',async f=>{
  const cat=adminState.categories.find(c=>c.title===f.category_id);
  let audioUrl=old.audioUrl||'',bookUrl=old.bookUrl||'',imageUrls=Array.isArray(old.imageUrls)?[...old.imageUrls]:(old.imageUrl?[old.imageUrl]:[]);
  if(f.audioFile){audioUrl=await uploadLearningAsset(f.audioFile,'audio')||audioUrl;}
  else if(f.audioUrl!==undefined)audioUrl=f.audioUrl||'';
  if(f.bookFile){bookUrl=await uploadLearningAsset(f.bookFile,'books')||bookUrl;}
  else if(f.bookUrl!==undefined)bookUrl=f.bookUrl||'';
  if(Array.isArray(f.postImages)&&f.postImages.length){for(const file of f.postImages){const url=await uploadLearningAsset(file,'images');if(url)imageUrls.push(url);}}
  if(f.removePostImages==='true')imageUrls=[];
  let quiz=[];try{quiz=JSON.parse(f.quiz||'[]');if(!Array.isArray(quiz))quiz=[];}catch{throw new Error('Тест должен быть корректным JSON-массивом.');}
  const row={title:f.title,slug:(f.slug||f.title).toLowerCase().trim().replace(/[^a-z0-9а-яё]+/gi,'-'),excerpt:f.excerpt||'',lesson_type:f.lesson_type||'article',category_id:cat?.id||null,duration_minutes:f.duration?Number(f.duration):null,status:f.status||'draft',content:{...old,videoUrl:f.videoUrl||'',audioUrl,audioTitle:f.audioTitle||'',bookUrl,bookTitle:f.bookTitle||'',bookDescription:f.bookDescription||'',article:f.article||'',examples:f.examples||'',imageUrl:f.imageUrl||imageUrls[0]||'',imageUrls,practice:f.practice||'',facts:(f.facts||'').split('\n').map(x=>x.trim()).filter(Boolean),quiz,keyTakeaway:f.keyTakeaway||''},created_by:window.currentUser?.id||null};
  const r=id?await window.supabaseClient.from('learning_lessons').update(row).eq('id',id):await window.supabaseClient.from('learning_lessons').insert(row);
  if(r.error)throw new Error(r.error.message);
  toast(id?'Урок обновлён':'Урок создан');await loadAdminLearning();
 },[
  {name:'title',label:'Название',type:'text',value:l.title||'',required:true},{name:'slug',label:'Slug',type:'text',value:l.slug||''},{name:'category_id',label:'Категория',type:'select',options:adminState.categories.map(c=>c.title),value:adminState.categories.find(c=>c.id===l.category_id)?.title||adminState.categories[0]?.title||''},{name:'lesson_type',label:'Тип материала',type:'select',options:['video','audio','book','post','article','practice','interactive'],value:l.lesson_type||'article'},{name:'duration',label:'Минуты',type:'number',value:l.duration_minutes||''},{name:'status',label:'Статус',type:'select',options:['draft','published'],value:l.status||'draft'},{name:'excerpt',label:'Краткое описание',type:'textarea',value:l.excerpt||''},
  {name:'videoUrl',label:'YouTube / видео URL',type:'text',value:old.videoUrl||'',placeholder:'https://youtu.be/…'},{name:'audioTitle',label:'Название аудио',type:'text',value:old.audioTitle||'',placeholder:'Например, голосовое объяснение'},{name:'audioFile',label:'Загрузить аудио',type:'file',accept:'audio/*,.mp3,.m4a,.wav,.ogg,.aac,.webm',hint:old.audioUrl?'Текущее аудио сохранится, если новый файл не выбрать.':'MP3, M4A, WAV, OGG, AAC или WebM; до 100 МБ.'},{name:'audioUrl',label:'Или ссылка на аудио',type:'text',value:old.audioUrl||'',placeholder:'https://…'},
  {name:'bookTitle',label:'Название книги / файла',type:'text',value:old.bookTitle||'',placeholder:'Например, Зональный трейдинг'},{name:'bookFile',label:'Загрузить книгу или документ',type:'file',accept:'.pdf,.epub,.doc,.docx,application/pdf',hint:old.bookUrl?'Текущий файл сохранится, если новый файл не выбрать.':'PDF, EPUB, DOC или DOCX; до 100 МБ.'},{name:'bookUrl',label:'Или ссылка на файл',type:'text',value:old.bookUrl||'',placeholder:'https://…'},{name:'bookDescription',label:'Описание файла',type:'textarea',value:old.bookDescription||''},
  {name:'postImages',label:'Фотографии для поста — загрузить с компьютера',type:'file',multiple:true,accept:'image/png,image/jpeg,image/webp,image/gif,image/avif,.jpg,.jpeg,.png,.webp,.gif,.avif',hint:`Нажми «Выбрать файлы» и выбери изображения с компьютера; можно выбрать сразу несколько (JPG, PNG, WEBP, GIF, AVIF; до 15 МБ каждое). Уже добавлено: ${(Array.isArray(old.imageUrls)?old.imageUrls.length:(old.imageUrl?1:0))}. Новые изображения добавятся к существующим.`},{name:'imageUrl',label:'Или URL обложки / изображения',type:'text',value:old.imageUrl||'',placeholder:'https://…'},{name:'removePostImages',label:'Удалить все загруженные изображения? Введи true, чтобы очистить галерею',type:'text',value:'false'},{name:'article',label:'Содержимое поста / теория (текст)',type:'textarea',value:old.article||'',placeholder:'Текст поста: каждый абзац с новой строки. Загруженные фотографии будут показаны прямо в теле поста.'},{name:'examples',label:'Примеры',type:'textarea',value:old.examples||''},{name:'practice',label:'Практика / задание',type:'textarea',value:old.practice||''},{name:'facts',label:'Факты — по одному в строке',type:'textarea',value:Array.isArray(old.facts)?old.facts.join('\n'):''},{name:'quiz',label:'Тест JSON',type:'textarea',value:JSON.stringify(old.quiz||[],null,2)},{name:'keyTakeaway',label:'Главный вывод',type:'textarea',value:old.keyTakeaway||''}
 ]);
}
async function toggleLessonPublish(id){const l=adminState.lessons.find(x=>x.id===id);if(!l)return;const {error}=await window.supabaseClient.from('learning_lessons').update({status:l.status==='published'?'draft':'published'}).eq('id',id);if(error)toast(error.message,true);else loadAdminLearning();}
async function duplicateLesson(id){const l=adminState.lessons.find(x=>x.id===id);if(!l)return;const row={...l};delete row.id;row.title=`${l.title} — копия`;row.slug=`${l.slug}-copy-${Date.now()}`;row.status='draft';row.created_by=window.currentUser?.id||null;const {error}=await window.supabaseClient.from('learning_lessons').insert(row);if(error)toast(error.message,true);else{toast('Копия создана');loadAdminLearning();}}
async function deleteAdminLesson(id){if(!confirm('Удалить урок?'))return;const {error}=await window.supabaseClient.from('learning_lessons').delete().eq('id',id);if(error)toast(error.message,true);else loadAdminLearning();}
function previewLesson(id){openTrainingLesson(id);}

async function loadTrainingView(){if(!window.supabaseClient||!window.currentUser)return;const [c,l,p]=await Promise.all([window.supabaseClient.from('learning_categories').select('*').eq('published',true).order('sort_order'),window.supabaseClient.from('learning_lessons').select('*').eq('status','published').order('sort_order'),window.supabaseClient.from('learning_progress').select('*').eq('user_id',window.currentUser.id)]);if(c.error||l.error)return;trainingState.categories=c.data||[];trainingState.lessons=l.data||[];trainingState.progress=p.data||[];renderTrainingView();}
function renderTrainingView(){
 const tabs=document.getElementById('trainingCategoryTabs'),statusTabs=document.getElementById('trainingStatusTabs'),modeTabs=document.getElementById('trainingModeTabs'),grid=document.getElementById('trainingLessonGrid');if(!grid)return;
 const doneFor=l=>trainingState.progress.some(p=>p.lesson_id===l.id&&p.status==='completed');
 const progressFor=l=>trainingState.progress.find(p=>p.lesson_id===l.id)||null;
 const statusFor=l=>{const p=progressFor(l);return p?.status==='completed'?'completed':p?'started':'not_started'};
 const activeTrackId=String(trainingState.category||'').startsWith('track:')?trainingState.category.split(':')[1]:null;
 const activeTrack=LEARNING_TRACKS.find(t=>t.id===activeTrackId)||null;
 const activeCat=trainingState.categories.find(c=>c.id===trainingState.category)||null;
 const road=document.getElementById('trainingRoadmap');
 if(road){
   road.innerHTML=`<button type="button" class="track-nav-item ${trainingState.category==='all'?'active':''}" data-training-track="all"><span class="track-nav-index">ALL</span><span><b>Вся программа</b><small>${trainingState.lessons.length} материалов</small></span></button>`+
   LEARNING_TRACKS.map(t=>{const cats=learningTrackCategories(t),count=trainingState.lessons.filter(l=>cats.some(c=>c.id===l.category_id)).length,done=trainingState.lessons.filter(l=>cats.some(c=>c.id===l.category_id)&&doneFor(l)).length;const active=activeTrackId===t.id||activeCat&&t.cats.includes(activeCat.slug);return `<div class="track-group ${active?'open':''}"><button type="button" class="track-nav-item ${active?'active':''}" data-training-track="${t.id}"><span class="track-nav-index">${t.icon}</span><span><b>${escapeHtml(t.title)}</b><small>${escapeHtml(t.short)} · ${done}/${count}</small></span><em>⌄</em></button><div class="track-modules">${cats.map(c=>{const n=trainingState.lessons.filter(l=>l.category_id===c.id).length;return `<button type="button" class="track-module ${trainingState.category===c.id?'active':''}" data-training-category="${c.id}"><span>${escapeHtml(c.title)}</span><b>${n}</b></button>`}).join('')}</div></div>`}).join('');
 }
 const statuses=[['all','Все'],['not_started','Не начато'],['started','В процессе'],['completed','Завершено']];
 if(statusTabs)statusTabs.innerHTML=statuses.map(([key,label])=>{const count=key==='all'?trainingState.lessons.length:trainingState.lessons.filter(l=>statusFor(l)===key).length;return `<button type="button" class="${trainingState.status===key?'active':''}" data-training-status="${key}">${label}<b>${count}</b></button>`}).join('');
 const modes=[['all','Все'],['course','Уроки'],['practice','Практика'],['patterns','Паттерны'],['test','С тестом']];
 if(modeTabs)modeTabs.innerHTML=modes.map(([key,label])=>`<button type="button" class="${trainingState.mode===key?'active':''}" data-training-mode="${key}">${label}</button>`).join('');
 const q=String(trainingState.search||'').trim();
 let list;
 if(trainingState.category==='all') list=trainingState.lessons;
 else if(activeTrack) {const cats=learningTrackCategories(activeTrack);list=trainingState.lessons.filter(l=>cats.some(c=>c.id===l.category_id));}
 else list=trainingState.lessons.filter(l=>l.category_id===trainingState.category);
 if(trainingState.mode!=='all')list=list.filter(l=>{const t=String(l.lesson_type||'').toLowerCase(), c=trainingState.categories.find(x=>x.id===l.category_id)?.slug||'';if(trainingState.mode==='course')return ['video','audio','book','article','post'].includes(t);if(trainingState.mode==='practice')return t==='practice'||c==='practice'||c==='sessions';if(trainingState.mode==='patterns')return c==='patterns';if(trainingState.mode==='test')return Array.isArray(l.content?.quiz)&&l.content.quiz.length>0;return true;});
 if(q)list=list.filter(l=>(`${l.title||''} ${l.excerpt||''} ${l.lesson_type||''} ${l.content?.article||''} ${(l.content?.facts||[]).join(' ')}`).toLowerCase().includes(q));
 if(trainingState.status!=='all')list=list.filter(l=>statusFor(l)===trainingState.status);
 list=[...list].sort((a,b)=>(Number(a.sort_order)||0)-(Number(b.sort_order)||0));
 const feature=document.getElementById('trainingFeature');const featured=list.find(l=>statusFor(l)==='started')||list.find(l=>!doneFor(l))||list[0];
 if(feature)feature.innerHTML=featured?`<div class="feature-copy"><span class="eyebrow">${statusFor(featured)==='started'?'ПРОДОЛЖИТЬ':'СЛЕДУЮЩИЙ МАТЕРИАЛ'}</span><h3>${escapeHtml(featured.title)}</h3><p>${escapeHtml(featured.excerpt||'')}</p><div class="feature-meta"><span>${escapeHtml((featured.lesson_type||'lesson').toUpperCase())}</span><span>${featured.duration_minutes?featured.duration_minutes+' мин':'Материал'}</span><span>${Array.isArray(featured.content?.quiz)?featured.content.quiz.length+' вопросов':''}</span></div></div><button class="primary-btn feature-open" data-training-open="${featured.id}">${statusFor(featured)==='started'?'Продолжить урок →':'Открыть урок →'}</button>`:`<div><span class="eyebrow">БАЗА ЗНАНИЙ</span><h3>Материалы появятся здесь</h3><p>Администратор ещё не опубликовал уроки.</p></div>`;
 grid.innerHTML=list.map((l,i)=>{const done=doneFor(l),p=progressFor(l),pct=Math.max(0,Math.min(100,Number(p?.progress||0))),state=statusFor(l),facts=Array.isArray(l.content?.facts)?l.content.facts.length:0,quiz=Array.isArray(l.content?.quiz)?l.content.quiz.length:0,cat=trainingState.categories.find(c=>c.id===l.category_id);return `<article class="training-lesson card training-db-card training-status-${state} training-card-v27" data-training-open="${l.id}"><div class="training-card-top"><span>${String(i+1).padStart(2,'0')}</span><em>${escapeHtml(cat?.title||'УРОК')}</em><b>${done?'✓':state==='started'?'◐':''}</b></div><div class="training-lesson-body"><span class="training-type">${done?'ПРОЙДЕНО':state==='started'?'В ПРОЦЕССЕ':'УРОК'}</span><h4>${escapeHtml(l.title)}</h4><p>${escapeHtml(l.excerpt||'')}</p><div class="lesson-card-meta"><span>${l.duration_minutes?l.duration_minutes+' мин':'Материал'}</span>${facts?`<span>${facts} факт${facts===1?'':'а'}</span>`:''}${quiz?`<span>${quiz} вопрос${quiz===1?'':'а'}</span>`:''}</div>${state==='started'?`<div class="training-card-progress"><i style="width:${pct}%"></i></div>`:''}<div class="card-open-line"><span>${done?'Завершён':state==='started'?`${pct}% · Продолжить`:'Изучить материал'}</span><strong>→</strong></div></div></article>`}).join('')||'<div class="empty-inline">По этому запросу материалов нет.</div>';
 const rc=document.getElementById('trainingResultCount');if(rc)rc.textContent=`${list.length} ${list.length===1?'материал':list.length<5?'материала':'материалов'}`;
 const sectionLabel=document.getElementById('trainingSectionLabel');if(sectionLabel){const label=activeCat?.title||activeTrack?.title||'Вся программа';sectionLabel.textContent=`${label.toUpperCase()} · ${trainingState.status==='all'?'ВСЕ':trainingState.status==='started'?'В ПРОЦЕССЕ':trainingState.status==='completed'?'ЗАВЕРШЕНО':'НЕ НАЧАТЫ'}`;}
 const total=trainingState.lessons.length,completed=trainingState.lessons.filter(doneFor).length,percent=total?Math.round(completed/total*100):0;const pl=document.getElementById('trainingProgressLabel'),pb=document.getElementById('trainingProgressBar'),pt=document.getElementById('trainingProgressText');if(pl)pl.textContent=percent+'%';if(pb)pb.style.width=percent+'%';if(pt)pt.textContent=`Завершено ${completed} из ${total} материалов.`;
 const next=trainingState.lessons.find(l=>statusFor(l)==='started')||trainingState.lessons.find(l=>!doneFor(l));const nextBox=document.getElementById('trainingNextLesson');if(nextBox)nextBox.innerHTML=next?`<b>${escapeHtml(next.title)}</b><span>${escapeHtml(next.excerpt||'Следующий материал')}</span><button class="secondary-btn" data-training-open="${next.id}">${statusFor(next)==='started'?'Продолжить →':'Начать →'}</button>`:`<b>Маршрут завершён</b><span>Все опубликованные материалы отмечены как пройденные.</span>`;
}
async function openTrainingLesson(id){
 const l=trainingState.lessons.find(x=>x.id===id)||adminState.lessons.find(x=>x.id===id);if(!l)return;
 const c=l.content||{};const existing=trainingProgressRow(l.id);
 if(window.currentUser&&window.supabaseClient&&!existing){await window.supabaseClient.from('learning_progress').upsert({user_id:window.currentUser.id,lesson_id:l.id,status:'started',progress:10,started_at:new Date().toISOString(),updated_at:new Date().toISOString()});await loadTrainingView();}
 const row=trainingProgressRow(l.id)||{};const quiz=parseTrainingQuiz(c.quiz);const embed=youtubeEmbedUrl(c.videoUrl);openModal();
 const facts=Array.isArray(c.facts)?c.facts:[];
 const lessonType=String(l.lesson_type||'article').toLowerCase();
 const postImages=Array.isArray(c.imageUrls)?c.imageUrls:(c.imageUrl?[c.imageUrl]:[]);
 const videoBlock=c.videoUrl?(embed?`<div class="lesson-video-frame lesson-video-frame-v27"><iframe src="${embed}" title="Видео урока" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`:`<div class="lesson-video-link"><a href="${escapeAttr(c.videoUrl)}" target="_blank" rel="noopener">▶ Открыть видео</a></div>`):`<div class="lesson-video-placeholder lesson-video-placeholder-v27"><span>VIDEO / SOURCE</span><b>Видео будет добавлено позже</b><small>Ссылка появится после загрузки видео.</small></div>`;
 const audioBlock=c.audioUrl&&/^https?:\/\//i.test(c.audioUrl)?`<section class="lesson-attachment-card lesson-audio-card lesson-primary-audio"><div class="lesson-attachment-icon">♫</div><div class="lesson-attachment-copy"><small>АУДИОМАТЕРИАЛ</small><h3>${escapeHtml(c.audioTitle||'Аудиосообщение')}</h3><audio controls preload="metadata" src="${escapeAttr(c.audioUrl)}">Твой браузер не поддерживает аудиоплеер.</audio></div></section>`:`<div class="lesson-media-empty">Аудиофайл ещё не добавлен.</div>`;
 const bookBlock=c.bookUrl&&/^https?:\/\//i.test(c.bookUrl)?`<section class="lesson-attachment-card lesson-book-card lesson-primary-book"><div class="lesson-attachment-icon">PDF</div><div class="lesson-attachment-copy"><small>КНИГА / ДОКУМЕНТ</small><h3>${escapeHtml(c.bookTitle||'Учебный файл')}</h3>${c.bookDescription?`<p>${escapeHtml(c.bookDescription).replace(/\n/g,'<br>')}</p>`:''}<div class="lesson-attachment-actions"><a class="primary-btn" href="${escapeAttr(c.bookUrl)}" target="_blank" rel="noopener noreferrer">Открыть файл ↗</a><a class="secondary-btn" href="${escapeAttr(c.bookUrl)}" target="_blank" rel="noopener noreferrer" download>Скачать</a></div></div></section>`:`<div class="lesson-media-empty">Файл ещё не прикреплён.</div>`;
 const galleryBlock=postImages.length?`<section class="lesson-post-gallery" aria-label="Изображения к материалу">${postImages.map((url,i)=>`<figure><img src="${escapeAttr(url)}" alt="${escapeAttr(l.title)} — изображение ${i+1}" loading="lazy"></figure>`).join('')}</section>`:'';
 let primaryMaterial='';
 if(lessonType==='video') primaryMaterial=videoBlock;
 else if(lessonType==='audio') primaryMaterial=audioBlock;
 else if(['book','file','document'].includes(lessonType)) primaryMaterial=bookBlock;
 else if(['post','article'].includes(lessonType)) primaryMaterial=`<section class="lesson-post-intro"><span class="lesson-content-kicker">СТАТЬЯ / ПОСТ</span><h3>${escapeHtml(l.title)}</h3>${c.article?`<div class="lesson-rich-text lesson-post-body">${escapeHtml(c.article).replace(/\n/g,'<br>')}</div>`:'<p>Текст материала пока не добавлен.</p>'}${galleryBlock}${c.examples?`<div class="lesson-post-examples"><h4>Примеры</h4>${escapeHtml(c.examples).replace(/\n/g,'<br>')}</div>`:''}</section>`;
 else primaryMaterial=videoBlock;
 const supplementaryMedia=lessonType==='video'?`${c.audioUrl?audioBlock:''}${c.bookUrl?bookBlock:''}`:lessonType==='audio'?`${c.bookUrl?bookBlock:''}`:'';
 const typeLabel=q=>q.type==='multi_select'?'НЕСКОЛЬКО ОТВЕТОВ':q.type==='true_false'?'ВЕРНО / НЕВЕРНО':'ОДИН ОТВЕТ';
 const shuffle=arr=>{const x=[...arr];for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]];}return x;};
 // Every opening gets a fresh option order. A/B/C/D are display positions, not answer identities.
 const shuffleFresh=arr=>{let x=shuffle(arr),guard=0;while(arr.length>1&&x.every((v,i)=>String(v.value)===String(arr[i]?.value))&&guard<8){x=shuffle(arr);guard++;}return x;};
 const shuffledQuiz=quiz.map(q=>({...q,options:shuffleFresh(q.options||[])}));
 const renderQuestion=(q,i)=>`<div class="quiz-card-v27" data-q="${i}"><div class="quiz-card-head"><span>ВОПРОС ${String(i+1).padStart(2,'0')}</span><b>${escapeHtml(typeLabel(q))}</b></div><h4>${escapeHtml(q.question||'')}</h4><div class="quiz-options-v27">${(q.options||[]).map((o,j)=>`<label class="quiz-option-v27" data-value="${escapeAttr(o.value)}"><input type="${q.type==='multi_select'?'checkbox':'radio'}" name="quiz-${i}" value="${escapeAttr(o.value)}"><span class="quiz-option-letter">${String.fromCharCode(65+j)}</span><span class="quiz-option-copy"><strong>${escapeHtml(o.label)}</strong><small class="quiz-feedback" data-feedback-for="${escapeAttr(o.value)}"></small></span></label>`).join('')}</div><button type="button" class="quiz-hint-btn" data-quiz-hint="${i}">Показать подсказку</button><div class="quiz-hint-panel" id="quizHint-${i}">${escapeHtml(q.hint||'')}</div></div>`;
 document.getElementById('modalContent').innerHTML=`<div class="training-lesson-modal training-lesson-modal-v27"><div class="lesson-hero-v27"><div><span class="eyebrow">${escapeHtml((l.lesson_type||'lesson').toUpperCase())}</span><h2>${escapeHtml(l.title)}</h2><p>${escapeHtml(l.excerpt||'')}</p><div class="lesson-hero-meta"><span>${l.duration_minutes?l.duration_minutes+' мин':'Материал'}</span><span>${facts.length} факта</span><span>${quiz.length} вопросов</span></div></div><div class="lesson-progress-circle"><strong>${Number(row.progress||0)}%</strong><small>прогресс</small>${Number(row.quiz_score||0)>=70?'<em class="lesson-test-passed">✓ Тест пройден</em>':''}</div></div>${primaryMaterial}${supplementaryMedia}<div class="lesson-mini-nav"><span class="active">01 Материал</span><span>02 Практика</span>${quiz.length?'<span>03 Тест</span>':''}<span>04 Конспект</span></div>${['post','article'].includes(lessonType)?'':`<section class="lesson-section lesson-theory-v27"><div class="lesson-section-head"><span>01</span><div><small>${lessonType==='video'?'РАЗБОР ВИДЕО':lessonType==='audio'?'КОНСПЕКТ АУДИО':'ОПИСАНИЕ МАТЕРИАЛА'}</small><h3>${lessonType==='video'?'Разбор и теория':lessonType==='audio'?'Главные мысли':'О материале'}</h3></div></div><div class="lesson-rich-text">${escapeHtml(c.article||'Материал будет добавлен.').replace(/\n/g,'<br>')}</div></section>`}${facts.length?`<section class="lesson-section lesson-facts-v27"><div class="lesson-section-head"><span>+</span><div><small>ИНТЕРЕСНЫЕ ФАКТЫ</small><h3>Что стоит запомнить</h3></div></div><div class="lesson-facts-grid">${facts.map((f,i)=>`<article class="lesson-fact"><b>ФАКТ ${String(i+1).padStart(2,'0')}</b><p>${escapeHtml(f)}</p></article>`).join('')}</div></section>`:''}<section class="lesson-section lesson-practice-v27"><div class="lesson-section-head"><span>02</span><div><small>ПРАКТИКА</small><h3>Примени сразу</h3></div></div><div class="lesson-practice-card">${escapeHtml(c.practice||'Практическое задание будет добавлено.').replace(/\n/g,'<br>')}</div></section>${quiz.length?`<section class="lesson-section lesson-quiz-v27"><div class="quiz-intro-v27"><div><span class="eyebrow">03 · MINI ASSESSMENT</span><h3>Проверь понимание</h3><p>Варианты A/B/C/D перемешиваются при каждом новом запуске. Ошибка завершает текущую попытку — её можно сразу начать заново.</p></div><div class="quiz-score-badge" id="quizScoreBadge">0 / ${quiz.length}</div></div><div class="quiz-progress-v27"><i id="quizProgressFill" style="width:${100/quiz.length}%"></i></div><div id="lessonQuizForm">${shuffledQuiz.map(renderQuestion).join('')}</div><div class="quiz-actions-v27"><button class="secondary-btn" id="quizPrevBtn" type="button" disabled>← Назад</button><button class="primary-btn" id="checkQuizBtn" type="button">Проверить ответ</button><button class="primary-btn" id="quizNextBtn" type="button" hidden>Следующий →</button></div><div id="quizResult" class="quiz-result-v27"></div></section>`:''}<section class="lesson-section lesson-notes-v27"><div class="lesson-section-head"><span>04</span><div><small>КОНСПЕКТ</small><h3>КОНСПЕКТ</h3></div></div><textarea id="lessonNotes" class="lesson-notes" placeholder="Что ты забираешь из урока? Короткие тезисы, правило или наблюдение…">${escapeHtml(row.notes||'')}</textarea></section><section class="lesson-takeaway lesson-takeaway-v27"><small>ГЛАВНЫЙ ВЫВОД</small><p>${escapeHtml(c.keyTakeaway||'')}</p></section><div class="modal-actions"><button class="secondary-btn" id="saveLessonNotesBtn">Сохранить конспект</button><button class="primary-btn" id="completeLessonBtn">${row.status==='completed'?'Пройдено ✓':'Завершить урок'}</button></div></div>`;
 let quizIndex=0, checked=new Array(quiz.length).fill(false), scores=new Array(quiz.length).fill(false), selectedAnswers=new Array(quiz.length).fill(null), quizFailed=false;
 const cards=[...document.querySelectorAll('.quiz-card-v27')];
 const showQuizCard=()=>{cards.forEach((el,i)=>el.classList.toggle('quiz-current',i===quizIndex));const prev=document.getElementById('quizPrevBtn'),next=document.getElementById('quizNextBtn'),check=document.getElementById('checkQuizBtn'),fill=document.getElementById('quizProgressFill');if(prev)prev.disabled=quizIndex===0||quizFailed;if(next){next.hidden=!checked[quizIndex]||quizIndex===quiz.length-1||quizFailed;next.textContent='Следующий →';}if(check)check.hidden=checked[quizIndex]||quizFailed;if(fill)fill.style.width=`${((quizIndex+1)/quiz.length)*100}%`;};
 showQuizCard();
 document.querySelectorAll('[data-quiz-hint]').forEach(btn=>btn.addEventListener('click',()=>{document.getElementById('quizHint-'+btn.dataset.quizHint)?.classList.toggle('open');}));
 const revealFeedback=(q,i,ok)=>{const card=cards[i];(q.options||[]).forEach(o=>{const el=card.querySelector(`.quiz-option-v27[data-value="${CSS.escape(String(o.value))}"]`);if(!el)return;const selected=!!el.querySelector('input')?.checked;const correct=(q.correctValues||[]).map(String).includes(String(o.value));el.classList.toggle('is-correct',correct);el.classList.toggle('is-wrong',selected&&!correct);const fb=el.querySelector('.quiz-feedback');if(fb)fb.textContent=selected?(o.feedback||''):'';el.querySelector('input')?.setAttribute('disabled','disabled');});card.classList.add(ok?'answer-correct':'answer-wrong');};
 const reshuffleDisplayedOptions=()=>{cards.forEach(card=>{const host=card.querySelector('.quiz-options-v27');if(!host)return;const items=[...host.querySelectorAll('.quiz-option-v27')];for(let i=items.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[items[i],items[j]]=[items[j],items[i]];}items.forEach((item,i)=>{const letter=item.querySelector('.quiz-option-letter');if(letter)letter.textContent=String.fromCharCode(65+i);host.appendChild(item);});});};
 const resetQuiz=()=>{quizIndex=0;checked=new Array(quiz.length).fill(false);scores=new Array(quiz.length).fill(false);selectedAnswers=new Array(quiz.length).fill(null);quizFailed=false;reshuffleDisplayedOptions();const result=document.getElementById('quizResult');if(result)result.innerHTML='';cards.forEach(card=>{card.classList.remove('answer-correct','answer-wrong');card.querySelectorAll('input').forEach(i=>{i.disabled=false;i.checked=false});card.querySelectorAll('.quiz-option-v27').forEach(x=>x.classList.remove('is-correct','is-wrong'));card.querySelectorAll('.quiz-feedback').forEach(x=>x.textContent='');});const btn=document.getElementById('quizNextBtn');if(btn)btn.textContent='Следующий →';const check=document.getElementById('checkQuizBtn');if(check)check.textContent='Проверить ответ';showQuizCard();};
 document.getElementById('checkQuizBtn')?.addEventListener('click',async()=>{const q=shuffledQuiz[quizIndex];const selected=[...document.querySelectorAll(`input[name="quiz-${quizIndex}"]:checked`)].map(x=>String(x.value));if(!selected.length){toast('Выбери вариант ответа',true);return;}const key=(q.correctValues||[]).map(String).sort();const got=[...selected].sort();const ok=key.length===got.length&&key.every((v,j)=>v===got[j]);scores[quizIndex]=ok;selectedAnswers[quizIndex]=selected;checked[quizIndex]=true;revealFeedback(q,quizIndex,ok);const done=scores.filter(Boolean).length;const badge=document.getElementById('quizScoreBadge');if(badge)badge.textContent=`${done} / ${quiz.length}`;const result=document.getElementById('quizResult');if(!ok){quizFailed=true;if(result)result.innerHTML='<strong class="quiz-wrong-message">Неправильное решение задачи</strong><span>Эта попытка завершена. Разбери ошибку и нажми «Начать заново», чтобы пройти тест ещё раз.</span>';const next=document.getElementById('quizNextBtn');if(next){next.hidden=false;next.textContent='Начать заново';}const checkBtn=document.getElementById('checkQuizBtn');if(checkBtn)checkBtn.hidden=true;showQuizCard();return;}if(result)result.innerHTML='<strong>Ответ верный</strong><span>Отлично. Переходи к следующему вопросу.</span>';showQuizCard();if(done===quiz.length){const score=100;const answers=shuffledQuiz.map((item,i)=>({questionId:item.id||`q${i+1}`,selected:selectedAnswers[i]||[],correct:!!scores[i]}));if(window.supabaseClient&&window.currentUser){const attempt={user_id:window.currentUser.id,lesson_id:l.id,score,passed:true,answers};const ar=await window.supabaseClient.from('learning_quiz_attempts').insert(attempt);if(ar.error){console.error('Quiz attempt save:',ar.error);toast('Тест пройден, но результат не удалось сохранить: '+ar.error.message,true);return;}const nextProgress=Math.max(Number(row.progress||10),70);const pr=await window.supabaseClient.from('learning_progress').upsert({user_id:window.currentUser.id,lesson_id:l.id,status:row.status==='completed'?'completed':'started',progress:nextProgress,quiz_score:score,updated_at:new Date().toISOString()});if(pr.error){console.error('Quiz progress save:',pr.error);toast('Результат теста сохранён, но прогресс урока не обновился: '+pr.error.message,true);}else{const fresh=await window.supabaseClient.from('learning_progress').select('*').eq('user_id',window.currentUser.id).eq('lesson_id',l.id).maybeSingle();if(!fresh.error&&fresh.data){const idx=trainingState.progress.findIndex(x=>x.lesson_id===l.id);if(idx>=0)trainingState.progress[idx]=fresh.data;else trainingState.progress.push(fresh.data);}}}if(result)result.innerHTML='<strong class="quiz-success-message">Тест пройден — достижение открыто 🏅</strong><span>Результат сохранён в профиле. Ты можешь повторить тест в любое время.</span>';loadTrainingView();}});
 document.getElementById('quizPrevBtn')?.addEventListener('click',()=>{if(quizIndex>0&&!quizFailed){quizIndex--;showQuizCard();}});
 document.getElementById('quizNextBtn')?.addEventListener('click',()=>{if(quizFailed){resetQuiz();return;}if(quizIndex<quiz.length-1){quizIndex++;showQuizCard();document.getElementById('quizResult').innerHTML='';}});
 document.getElementById('saveLessonNotesBtn')?.addEventListener('click',async()=>{const notes=document.getElementById('lessonNotes')?.value||'';const {error}=await window.supabaseClient.from('learning_progress').upsert({user_id:window.currentUser.id,lesson_id:l.id,status:row.status==='completed'?'completed':'started',progress:Math.max(Number(row.progress||10),30),notes,updated_at:new Date().toISOString()});if(error){toast(error.message,true);return;}toast('Конспект сохранён');loadTrainingView();});
 document.getElementById('completeLessonBtn')?.addEventListener('click',async()=>{const notes=document.getElementById('lessonNotes')?.value||'';let payload={user_id:window.currentUser.id,lesson_id:l.id,status:'completed',progress:100,notes,completed_at:new Date().toISOString(),updated_at:new Date().toISOString()};let {error}=await window.supabaseClient.from('learning_progress').upsert(payload);if(error&&/completed_at/i.test(error.message||'')){delete payload.completed_at;({error}=await window.supabaseClient.from('learning_progress').upsert(payload));}if(error){toast(error.message,true);return;}toast('Урок завершён');closeModal();loadTrainingView();});
}

async function loadProfileAchievements(){
 const host=document.getElementById('profileAchievements');if(!host)return;
 host.innerHTML='<div class="achievement-loading">Загрузка достижений…</div>';
 if(!window.supabaseClient||!window.currentUser){host.innerHTML='';return;}
 try{
  const [{data:lessons,error:lerr},{data:attempts,error:aerr}]=await Promise.all([
   window.supabaseClient.from('learning_lessons').select('id,title,sort_order').eq('status','published').order('sort_order'),
   window.supabaseClient.from('learning_quiz_attempts').select('lesson_id,score,passed,created_at').eq('user_id',window.currentUser.id).eq('passed',true)
  ]);
  if(lerr||aerr)throw(lerr||aerr);
  const unlocked=new Map();(attempts||[]).forEach(x=>{if(!unlocked.has(x.lesson_id)||Number(x.score)>Number(unlocked.get(x.lesson_id).score))unlocked.set(x.lesson_id,x);});
  const rows=(lessons||[]).map((lesson,i)=>({lesson,unlocked:unlocked.has(lesson.id),attempt:unlocked.get(lesson.id),n:i+1}));
  const open=rows.filter(x=>x.unlocked).length;
  host.innerHTML=`<div class="achievement-head"><div><span class="eyebrow">ACHIEVEMENTS</span><h3>Медали обучения</h3><p>За каждый тест, пройденный без ошибок, открывается медаль соответствующего урока.</p></div><strong>${open} / ${rows.length}</strong></div><div class="achievement-grid">${rows.map(x=>`<article class="achievement-card ${x.unlocked?'is-unlocked':'is-locked'}"><div class="achievement-medal">${x.unlocked?'🏅':'🔒'}</div><div class="achievement-copy"><b>${escapeHtml(x.lesson.title||'Урок')}</b><small>${x.unlocked?'Открыто · '+Math.round(Number(x.attempt?.score||100))+'%':'Не открыто · пройди тест без ошибок'}</small></div></article>`).join('')}</div>`;
 }catch(e){console.error('Achievements:',e);host.innerHTML='<div class="achievement-error">Не удалось загрузить достижения. Проверь, что выполнена миграция V34.</div>';}
}
window.loadProfileAchievements=loadProfileAchievements;

function bindTrainingUI(){
  const search=document.getElementById('trainingSearch');
  search?.addEventListener('input',()=>{trainingState.search=search.value.toLowerCase().trim();renderTrainingView()});
}
function formatAdminUserMoney(v,c){return formatCurrencyValue(v,c||'USD',false)}
function formatAdminDate(v){return v?new Intl.DateTimeFormat('ru-RU',{dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'—';}
function nextQuote(){const q=(DEFAULT_DATA.quotes||[]);if(!q.length)return;let idx=Number(sessionStorage.getItem('tradingDiary_quoteIndex')||0);idx=(idx+1)%q.length;sessionStorage.setItem('tradingDiary_quoteIndex',String(idx));renderQuote(idx);}
function renderQuote(idx){const q=(DEFAULT_DATA.quotes||[])[idx%(DEFAULT_DATA.quotes||[]).length];const box=document.getElementById('dashboardQuote');if(box)box.textContent=q;}
