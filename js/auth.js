let supabaseClient = null;
let currentUser = null;

let cloudHydrationUserId = null;
let cloudHydrationPromise = null;

function clearCloudLocalState(){
  state={...clone(DEFAULT_DATA),trades:[],notes:[],plans:[],goals:[],journal:{},instruments:clone(DEFAULT_DATA.instruments),strategies:clone(DEFAULT_DATA.strategies)};
  saveLocalOnly();
  localStorage.removeItem('tradingDiary_cloudTradesDirty');
  localStorage.removeItem('tradingDiary_cloudWorkspaceDirty');
}

function authReady(){
  return window.SUPABASE_CONFIG?.url && window.SUPABASE_CONFIG?.anonKey && window.supabase?.createClient;
}

async function hydrateCloudUser(user){
  if(!user)return;

  const userId=user.id;

  if(cloudHydrationUserId===userId && cloudHydrationPromise){
    return cloudHydrationPromise;
  }

  cloudHydrationUserId=userId;
  window.cloudDataReady=false;

  cloudHydrationPromise=(async()=>{
    try{
      if(typeof loadCloudTrades==='function'){
        await loadCloudTrades(userId);
      }

      if(typeof loadCloudWorkspace==='function'){
        await loadCloudWorkspace(userId);
      }
      await loadProfileCloud(userId);

      window.cloudDataReady=true;
      document.dispatchEvent(new CustomEvent('cloud:data-ready'));
    }catch(error){
      window.cloudDataReady=false;
      console.error('Supabase cloud hydration:',error);
      toast?.('Не удалось полностью загрузить облачные данные',true);
    }
  })();

  try{
    await cloudHydrationPromise;
  }finally{
    cloudHydrationPromise=null;
  }
}


function getEmailConfirmationRedirect(){
  return `${window.location.origin}${window.location.pathname}`;
}

function cleanAuthCallbackUrl(){
  try{
    const url=new URL(window.location.href);
    url.hash='';
    url.searchParams.delete('code');
    url.searchParams.delete('type');
    url.searchParams.delete('error');
    url.searchParams.delete('error_code');
    url.searchParams.delete('error_description');
    window.history.replaceState({},document.title,url.pathname+url.search+url.hash);
  }catch(e){}
}

function showEmailConfirmationSuccess(email=''){
  const safeEmail=escapeHtml(email||'ваша почта');
  document.getElementById('modalContent').innerHTML=`
    <div class="auth-result success">
      <div class="auth-result-icon">✓</div>
      <h2>Email подтверждён</h2>
      <p>Адрес <b>${safeEmail}</b> успешно подтверждён.</p>
      <p class="sub">Ваш аккаунт активирован. Теперь можно пользоваться Trading Diary.</p>
      <div class="modal-actions">
        <button class="primary-btn" id="confirmationContinue">Продолжить</button>
      </div>
    </div>`;
  openModal();
  const btn=document.getElementById('confirmationContinue');
  if(btn)btn.onclick=()=>closeModal();
}

function showEmailConfirmationError(message){
  document.getElementById('modalContent').innerHTML=`
    <div class="auth-result error">
      <div class="auth-result-icon">!</div>
      <h2>Не удалось подтвердить email</h2>
      <p>${escapeHtml(message||'Ссылка подтверждения недействительна или устарела.')}</p>
      <p class="sub">Попробуйте открыть самое последнее письмо от Trading Diary или запросить новое письмо подтверждения.</p>
      <div class="modal-actions">
        <button class="primary-btn" id="confirmationErrorClose">Понятно</button>
      </div>
    </div>`;
  openModal();
  const btn=document.getElementById('confirmationErrorClose');
  if(btn)btn.onclick=()=>closeModal();
}

function inspectEmailConfirmationCallback(){
  const url=new URL(window.location.href);
  const params=url.searchParams;
  const hash=new URLSearchParams((window.location.hash||'').replace(/^#/,''));
  const error=params.get('error_description')||hash.get('error_description');
  const type=params.get('type')||hash.get('type');
  const code=params.get('code');
  const hasAuthCallback=Boolean(error||code||type==='signup'||hash.get('access_token'));

  if(!hasAuthCallback)return false;

  if(error){
    showEmailConfirmationError(error.replace(/\+/g,' '));
    cleanAuthCallbackUrl();
    return true;
  }

  window.emailConfirmationCallbackPending=true;
  return true;
}

function handleAuthUser(user,event){
  currentUser=user||null;
  window.currentUser=currentUser;
  updateProfileUI();
  document.dispatchEvent(new CustomEvent('auth:ready'));

  if(currentUser && event==='SIGNED_IN' && window.emailConfirmationCallbackPending){
    window.emailConfirmationCallbackPending=false;
    setTimeout(()=>{
      showEmailConfirmationSuccess(currentUser.email||'');
      cleanAuthCallbackUrl();
    },80);
  }

  if(!currentUser){
    clearCloudLocalState();
    cloudHydrationUserId=null;
    cloudHydrationPromise=null;
    window.cloudDataReady=false;
    document.dispatchEvent(new CustomEvent('state:changed'));
    return;
  }

  const previousUserId=localStorage.getItem('tradingDiary_lastCloudUserId');
  // A cloud session owns its own local working set. Never let guest data or
  // another account's cached rows become the starting state for this user.
  if(previousUserId!==currentUser.id){
    clearCloudLocalState();
  }
  localStorage.setItem('tradingDiary_lastCloudUserId',currentUser.id);

  // Only hydrate on a real session initialization/sign-in.
  // TOKEN_REFRESHED must never reload the journal, otherwise a user
  // can delete a trade and a token refresh can put the old row back.
  if(event==='INITIAL_SESSION' || event==='SIGNED_IN'){
    setTimeout(()=>hydrateCloudUser(currentUser),0);
  }
}

function initAuth(){
  if(!authReady()) return;

  supabaseClient = window.supabase.createClient(
    SUPABASE_CONFIG.url,
    SUPABASE_CONFIG.anonKey
  );

  window.supabaseClient = supabaseClient;
  window.currentUser = null;
  window.cloudDataReady = false;

  supabaseClient.auth.onAuthStateChange((event,session)=>{
    handleAuthUser(session?.user||null,event);
  });

  // Also cover an already established session.
  supabaseClient.auth.getUser().then(({data})=>{
    const user=data?.user||null;
    if(!user){
      handleAuthUser(null,'GET_USER');
      return;
    }

    const previousUserId=localStorage.getItem('tradingDiary_lastCloudUserId');
    if(previousUserId!==user.id){
      clearCloudLocalState();
      localStorage.setItem('tradingDiary_lastCloudUserId',user.id);
    }
    currentUser=user;
    window.currentUser=user;
    updateProfileUI();
    document.dispatchEvent(new CustomEvent('auth:ready'));

    if(cloudHydrationUserId!==user.id){
      setTimeout(()=>hydrateCloudUser(user),0);
    }
  });
}

window.getCurrentUser=()=>currentUser;

function updateProfileUI(){
  const b=document.getElementById('profileBtn');
  if(!b)return;
  const name=b.querySelector('.profile-name');
  const avatar=b.querySelector('.avatar');
  if(currentUser){
    const profile=state.profile||{};
    const email=currentUser.email||'Профиль';
    name.textContent=profile.displayName||email;
    if(profile.avatarUrl){
      avatar.textContent='';
      avatar.style.backgroundImage=`url("${profile.avatarUrl.replace(/"/g,'')}")`;
      avatar.style.backgroundSize='cover';
      avatar.style.backgroundPosition='center';
    }else{
      avatar.style.backgroundImage='';
      avatar.textContent=(profile.displayName||email||'U').trim().charAt(0).toUpperCase();
    }
  }else{
    name.textContent='Войти';
    avatar.style.backgroundImage='';
    avatar.textContent='TD';
  }
}

async function loadProfileCloud(userId){
  if(!supabaseClient||!userId)return;
  try{
    const {data,error}=await supabaseClient.from('profiles').select('id,display_name,avatar_url').eq('id',userId).maybeSingle();
    if(error)throw error;
    state.profile={displayName:data?.display_name||'',avatarUrl:data?.avatar_url||''};
    saveLocalOnly();
    updateProfileUI();
  }catch(error){console.error('Profile load:',error)}
}

function resizeAvatar(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(reader.error||new Error('Не удалось прочитать изображение'));
    reader.onload=()=>{
      const img=new Image();
      img.onerror=()=>reject(new Error('Файл не является изображением'));
      img.onload=()=>{
        const max=320,scale=Math.min(1,max/Math.max(img.width,img.height));
        const c=document.createElement('canvas');
        c.width=Math.max(1,Math.round(img.width*scale));
        c.height=Math.max(1,Math.round(img.height*scale));
        const ctx=c.getContext('2d');
        ctx.drawImage(img,0,0,c.width,c.height);
        resolve(c.toDataURL('image/jpeg',.82));
      };
      img.src=reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function openProfileModal(){
  if(!currentUser){openAuthModal();return;}
  const profile=state.profile||{};
  const displayName=profile.displayName||'';
  const avatarHtml=profile.avatarUrl?`<img src="${escapeAttr(profile.avatarUrl)}" alt="">`:`<span>${escapeHtml((displayName||currentUser.email||'U').charAt(0).toUpperCase())}</span>`;
  document.getElementById('modalContent').innerHTML=`
    <div class="profile-editor">
      <div class="profile-editor-head"><div><div class="eyebrow">ACCOUNT / PROFILE</div><h2>Оформление профиля</h2><p class="sub">Никнейм и аватарка сохраняются в облачном профиле и доступны на других устройствах.</p></div></div>
      <div class="profile-avatar-editor"><div class="profile-avatar-preview" id="profileAvatarPreview">${avatarHtml}</div><div class="profile-avatar-actions"><input id="profileAvatarInput" type="file" accept="image/*" hidden><button type="button" class="secondary-btn" id="profileAvatarChoose">Изменить аватарку</button><button type="button" class="ghost-btn" id="profileAvatarRemove">Удалить фото</button><small>Изображение автоматически сжимается.</small></div></div>
      <label class="profile-field"><span>Никнейм</span><input id="profileDisplayName" maxlength="32" value="${escapeAttr(displayName)}" placeholder="Например, Danni"></label>
      <div class="profile-account-line"><span>Email</span><b>${escapeHtml(currentUser.email||'')}</b></div>
      <div class="modal-actions"><button type="button" class="secondary-btn" id="profileClose">Закрыть</button><button type="button" class="primary-btn" id="profileSave">Сохранить профиль</button></div>
      <div class="profile-account-actions"><button type="button" class="danger-btn" id="profileLogout">Выйти из аккаунта</button></div>
    </div>`;
  openModal();
  let avatarData=profile.avatarUrl||'';
  const input=document.getElementById('profileAvatarInput'),preview=document.getElementById('profileAvatarPreview');
  document.getElementById('profileAvatarChoose').onclick=()=>input.click();
  input.onchange=async()=>{
    const file=input.files?.[0];
    if(!file)return;
    try{avatarData=await resizeAvatar(file);preview.innerHTML=`<img src="${escapeAttr(avatarData)}" alt="">`}
    catch(e){toast(e.message||'Не удалось обработать фото',true)}
  };
  document.getElementById('profileAvatarRemove').onclick=()=>{
    avatarData='';
    preview.innerHTML=`<span>${escapeHtml((document.getElementById('profileDisplayName').value||currentUser.email||'U').charAt(0).toUpperCase())}</span>`;
  };
  document.getElementById('profileClose').onclick=closeModal;
  document.getElementById('profileSave').onclick=async()=>{
    const btn=document.getElementById('profileSave');
    btn.disabled=true;
    const next={displayName:String(document.getElementById('profileDisplayName').value||'').trim().slice(0,32),avatarUrl:avatarData};
    if(supabaseClient&&currentUser){
      const {error}=await supabaseClient.from('profiles').upsert({id:currentUser.id,display_name:next.displayName||null,avatar_url:next.avatarUrl||null},{onConflict:'id'});
      if(error){btn.disabled=false;toast(error.message||'Не удалось сохранить профиль',true);return;}
    }
    state.profile=next;
    saveLocalOnly();
    updateProfileUI();
    closeModal();
    toast('Профиль сохранён');
  };
  document.getElementById('profileLogout').onclick=()=>openLogoutConfirm();
}

function openLogoutConfirm(){
  const modal=document.getElementById('modal');
  const content=document.getElementById('modalContent');
  if(!modal||!content)return;
  modal.classList.add('simple-modal');
  content.innerHTML=`<h2>Выйти из аккаунта?</h2><div class="sub">Локальные данные на устройстве останутся. Синхронизация прекратится до следующего входа.</div><div class="modal-actions"><button type="button" class="secondary-btn" id="logoutCancel">Отмена</button><button type="button" class="danger-btn" id="logoutConfirm">Выйти</button></div>`;
  openModal();
  document.getElementById('logoutCancel').onclick=closeModal;
  document.getElementById('logoutConfirm').onclick=async()=>{closeModal();await performLogout();};
}

async function performLogout(){
  const {error}=await supabaseClient.auth.signOut({scope:'local'});
  if(error){toast(error.message||'Не удалось выйти',true);return;}
  currentUser=null;
  window.currentUser=null;
  window.cloudDataReady=false;
  clearCloudLocalState();
  updateProfileUI();
  closeModal();
  toast('Вы вышли из аккаунта');
  document.dispatchEvent(new CustomEvent('state:changed'));
}

function openAuthModal(){
  const configured=authReady();

  document.getElementById('modalContent').innerHTML=`
    <h2>${currentUser?'Личный кабинет':'Аккаунт'}</h2>
    <div class="sub">${configured?'Вход синхронизирует дневник с облачной базой.':'Для включения облачной регистрации добавьте URL и anon key Supabase в js/supabase-config.js.'}</div>
    ${currentUser ? `<div class="account-box"><b>${escapeHtml(currentUser.email||'')}</b><small>Авторизованный пользователь</small></div><div class="modal-actions"><button class="secondary-btn" id="closeAuth">Закрыть</button><button class="primary-btn" id="logoutBtn">Выйти</button></div>` : `
      <form id="authForm"><div class="modal-form"><label>Email<input name="email" type="email" required autocomplete="email"></label><label>Пароль<input name="password" type="password" minlength="8" required autocomplete="current-password"></label></div><div class="modal-actions"><button type="button" class="secondary-btn" id="registerBtn">Создать аккаунт</button><button class="primary-btn">Войти</button></div></form>`}`;

  openModal();

  if(currentUser){
    document.getElementById('logoutBtn').onclick=()=>openLogoutConfirm();
    document.getElementById('closeAuth').onclick=closeModal;
    return;
  }

  if(!configured){
    document.getElementById('authForm').onsubmit=e=>{
      e.preventDefault();
      toast('Сначала настройте Supabase в js/supabase-config.js',true);
    };
    document.getElementById('registerBtn').onclick=()=>{
      toast('Сначала настройте Supabase в js/supabase-config.js',true);
    };
    return;
  }

  document.getElementById('authForm').onsubmit=async e=>{
    e.preventDefault();
    const f=new FormData(e.target);

    const {error}=await supabaseClient.auth.signInWithPassword({
      email:f.get('email'),
      password:f.get('password')
    });

    if(error)toast(error.message,true);
    else{
      closeModal();
      toast('Вход выполнен');
    }
  };

  document.getElementById('registerBtn').onclick=async()=>{
    const f=new FormData(document.getElementById('authForm'));
    const email=f.get('email');
    const password=f.get('password');

    if(!email||String(password).length<8){
      return toast(
        'Введите email и пароль минимум из 8 символов',
        true
      );
    }

    const {error}=await supabaseClient.auth.signUp({
      email,
      password,
      options:{
        emailRedirectTo:getEmailConfirmationRedirect()
      }
    });

    if(error)toast(error.message,true);
    else toast('Аккаунт создан. Проверьте email для подтверждения.');
  };
}

document.addEventListener('DOMContentLoaded',()=>{
  inspectEmailConfirmationCallback();
  initAuth();

  const b=document.getElementById('profileBtn');
  if(b)b.addEventListener('click',openProfileModal);
});
