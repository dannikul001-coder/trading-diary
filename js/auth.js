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
    const email=currentUser.email||'Профиль';
    name.textContent=email;
    avatar.textContent=(email[0]||'U').toUpperCase();
  }else{
    name.textContent='Войти';
    avatar.textContent='TD';
  }
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
    document.getElementById('logoutBtn').onclick=async()=>{
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
    };
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
  if(b)b.addEventListener('click',openAuthModal);
});
