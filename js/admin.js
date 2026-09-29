let adminState={isAdmin:false,users:[],categories:[],lessons:[],category:'all'};

document.addEventListener('DOMContentLoaded',()=>{bindAdminUI(); refreshAdminAccess();});
document.addEventListener('auth:ready',refreshAdminAccess);

async function refreshAdminAccess(){
  const client=window.supabaseClient;
  const user=window.currentUser;
  if(!client||!user){setAdminVisibility(false);return;}
  const {data,error}=await client.from('user_roles').select('role').eq('user_id',user.id).maybeSingle();
  adminState.isAdmin=!error && data?.role==='admin';
  setAdminVisibility(adminState.isAdmin);
  if(adminState.isAdmin) loadAdminUsers();
}
function setAdminVisibility(ok){
  document.querySelectorAll('.admin-only').forEach(x=>x.hidden=!ok);
  const view=document.getElementById('view-admin'); if(view)view.hidden=!ok;
  const training=document.querySelector('[data-view="training"]'); const tv=document.getElementById('view-training');
  if(training) training.hidden=!ok; if(tv) tv.hidden=!ok;
  if(!ok && typeof activeView!=='undefined' && activeView==='admin' && typeof showView==='function')showView('dashboard');
}
function bindAdminUI(){
  document.addEventListener('click',e=>{
    const t=e.target.closest('[data-admin-tab]');
    if(t){document.querySelectorAll('[data-admin-tab]').forEach(x=>x.classList.toggle('active',x===t));document.querySelectorAll('[data-admin-panel]').forEach(x=>x.classList.toggle('active',x.dataset.adminPanel===t.dataset.adminTab));if(t.dataset.adminTab==='learning')loadAdminLearning();}
  });
  document.getElementById('adminRefreshUsers')?.addEventListener('click',loadAdminUsers);
  document.getElementById('adminRefreshLearning')?.addEventListener('click',loadAdminLearning);
  document.getElementById('adminAddLesson')?.addEventListener('click',()=>adminLessonModal());
}
async function loadAdminUsers(){
  if(!adminState.isAdmin||!window.supabaseClient)return;
  const body=document.getElementById('adminUsersBody'); if(body)body.innerHTML='<tr><td colspan="8">Загрузка…</td></tr>';
  const {data,error}=await window.supabaseClient.rpc('admin_list_users');
  if(error){if(body)body.innerHTML=`<tr><td colspan="8">${escapeHtml(error.message||'Ошибка')}</td></tr>`;return;}
  adminState.users=data||[]; renderAdminUsers();
}
function renderAdminUsers(){
  const body=document.getElementById('adminUsersBody'),empty=document.getElementById('adminUsersEmpty'); if(!body)return;
  empty?.classList.toggle('show',!adminState.users.length); body.innerHTML=adminState.users.map(u=>`<tr><td><div class="admin-user-cell"><div class="admin-avatar">${u.avatar_url?`<img src="${escapeAttr(u.avatar_url)}" alt="">`:escapeHtml((u.display_name||u.email||'U').charAt(0).toUpperCase())}</div><div><b>${escapeHtml(u.display_name||'Без никнейма')}</b><small>${escapeHtml(u.email||'')}</small></div></div></td><td>${formatAdminDate(u.created_at)}</td><td>${formatAdminDate(u.last_sign_in_at)}</td><td>${Number(u.trades_count||0).toLocaleString('ru-RU')}</td><td class="${Number(u.pnl)>0?'positive':Number(u.pnl)<0?'negative':''}">${formatMoneyPlain(Number(u.pnl||0))}</td><td>${Number(u.win_rate||0).toFixed(1)}%</td><td>${Number(u.lessons_completed||0)}</td><td><span class="admin-role ${u.role==='admin'?'is-admin':''}">${u.role==='admin'?'ADMIN':'USER'}</span></td></tr>`).join('');
}
async function loadAdminLearning(){
  if(!adminState.isAdmin||!window.supabaseClient)return;
  const [c,l]=await Promise.all([
    window.supabaseClient.from('learning_categories').select('*').order('sort_order'),
    window.supabaseClient.from('learning_lessons').select('*').order('sort_order')
  ]);
  if(c.error||l.error){toast((c.error||l.error)?.message||'Ошибка обучения',true);return;}
  adminState.categories=c.data||[];adminState.lessons=l.data||[];renderAdminLearning();
}
function renderAdminLearning(){
  const cats=document.getElementById('adminCategoryList'), lessons=document.getElementById('adminLessons'); if(!cats||!lessons)return;
  cats.innerHTML=`<button class="admin-category ${adminState.category==='all'?'active':''}" data-admin-category="all">Все уроки <b>${adminState.lessons.length}</b></button>`+adminState.categories.map(c=>`<button class="admin-category ${adminState.category===c.id?'active':''}" data-admin-category="${c.id}">${escapeHtml(c.title)} <b>${adminState.lessons.filter(l=>l.category_id===c.id).length}</b></button>`).join('');
  cats.querySelectorAll('[data-admin-category]').forEach(b=>b.onclick=()=>{adminState.category=b.dataset.adminCategory;renderAdminLearning();});
  const list=adminState.category==='all'?adminState.lessons:adminState.lessons.filter(l=>l.category_id===adminState.category);
  lessons.innerHTML=list.map(l=>`<article class="admin-lesson-row"><div><span class="admin-status ${l.status}">${l.status==='published'?'ОПУБЛИКОВАН':'ЧЕРНОВИК'}</span><h4>${escapeHtml(l.title)}</h4><p>${escapeHtml(l.excerpt||'Без описания')}</p><small>${escapeHtml(l.lesson_type||'article')} · ${escapeHtml(adminState.categories.find(c=>c.id===l.category_id)?.title||'Без категории')}</small></div><div class="admin-row-actions"><button class="secondary-btn" data-admin-edit="${l.id}">Изменить</button><button class="ghost-btn" data-admin-publish="${l.id}">${l.status==='published'?'Снять':'Опубликовать'}</button><button class="danger-btn" data-admin-delete="${l.id}">Удалить</button></div></article>`).join('')||'<div class="empty-inline">Уроков пока нет.</div>';
  lessons.querySelectorAll('[data-admin-edit]').forEach(b=>b.onclick=()=>adminLessonModal(b.dataset.adminEdit));
  lessons.querySelectorAll('[data-admin-publish]').forEach(b=>b.onclick=()=>toggleLessonPublish(b.dataset.adminPublish));
  lessons.querySelectorAll('[data-admin-delete]').forEach(b=>b.onclick=()=>deleteAdminLesson(b.dataset.adminDelete));
}
function adminLessonModal(id){
  const l=adminState.lessons.find(x=>x.id===id)||{};
  openSimpleModal(id?'Изменить урок':'Новый урок','Контент можно расширить позже: видео YouTube, статья, изображение, практика и тест.',async f=>{
    const slug=(f.slug||f.title||'lesson').toLowerCase().trim().replace(/[^a-z0-9а-яё]+/gi,'-').replace(/^-+|-+$/g,'');
    const row={title:f.title,slug:slug||`lesson-${Date.now()}`,excerpt:f.excerpt||'',lesson_type:f.lesson_type||'article',category_id:adminState.categories.find(c=>c.title===f.category_id)?.id || (adminState.categories.some(c=>c.id===f.category_id)?f.category_id:null),duration_minutes:f.duration?Number(f.duration):null,status:f.status||'draft',content:{videoUrl:f.videoUrl||'',article:f.article||'',imageUrl:f.imageUrl||'',practice:f.practice||'',quiz:f.quiz||''},created_by:window.currentUser?.id||null};
    let res=id?await window.supabaseClient.from('learning_lessons').update(row).eq('id',id):await window.supabaseClient.from('learning_lessons').insert(row);
    if(res.error){toast(res.error.message,true);return;} toast(id?'Урок обновлён':'Урок создан'); await loadAdminLearning();
  },[
    {name:'title',label:'Название',type:'text',value:l.title||'',required:true},
    {name:'slug',label:'Slug',type:'text',value:l.slug||'',placeholder:'market-structure'},
    {name:'category_id',label:'Категория',type:'select',options:adminState.categories.map(c=>c.title),value:adminState.categories.find(c=>c.id===l.category_id)?.title||adminState.categories[0]?.title||''},
    {name:'lesson_type',label:'Тип',type:'select',options:['video','article','post','practice','interactive'],value:l.lesson_type||'article'},
    {name:'duration',label:'Минуты',type:'number',value:l.duration_minutes||''},
    {name:'status',label:'Статус',type:'select',options:['draft','published'],value:l.status||'draft'},
    {name:'excerpt',label:'Краткое описание',type:'textarea',value:l.excerpt||''},
    {name:'videoUrl',label:'YouTube / видео URL',type:'text',value:l.content?.videoUrl||''},
    {name:'imageUrl',label:'URL изображения',type:'text',value:l.content?.imageUrl||''},
    {name:'article',label:'Текст / теория',type:'textarea',value:l.content?.article||''},
    {name:'practice',label:'Практика / задание',type:'textarea',value:l.content?.practice||''},
    {name:'quiz',label:'Тест / вопросы',type:'textarea',value:l.content?.quiz||''}
  ]);
  // openSimpleModal returns the selected option text; normalize category after form serialization via wrapper below
}
async function toggleLessonPublish(id){const l=adminState.lessons.find(x=>x.id===id);if(!l)return;const {error}=await window.supabaseClient.from('learning_lessons').update({status:l.status==='published'?'draft':'published'}).eq('id',id);if(error)toast(error.message,true);else loadAdminLearning();}
async function deleteAdminLesson(id){if(!confirm('Удалить урок?'))return;const {error}=await window.supabaseClient.from('learning_lessons').delete().eq('id',id);if(error)toast(error.message,true);else loadAdminLearning();}
function formatAdminDate(v){return v?new Intl.DateTimeFormat('ru-RU',{dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'—';}
