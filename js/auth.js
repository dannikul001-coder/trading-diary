let supabaseClient = null;
let currentUser = null;

function authReady(){
  return window.SUPABASE_CONFIG?.url && window.SUPABASE_CONFIG?.anonKey && window.supabase?.createClient;
}

function initAuth(){
  if(!authReady()) return;
  supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
  supabaseClient.auth.getUser().then(({data})=>{ currentUser=data.user||null; updateProfileUI(); });
  supabaseClient.auth.onAuthStateChange((_event, session)=>{ currentUser=session?.user||null; updateProfileUI(); });
}

function updateProfileUI(){
  const b=document.getElementById('profileBtn');
  if(!b)return;
  const name=b.querySelector('.profile-name');
  const avatar=b.querySelector('.avatar');
  if(currentUser){
    const email=currentUser.email||'Профиль';
    name.textContent=email;
    avatar.textContent=(email[0]||'U').toUpperCase();
  }else{ name.textContent='Войти'; avatar.textContent='TD'; }
}

function openAuthModal(){
  const configured=authReady();
  document.getElementById('modalContent').innerHTML=`
    <h2>${currentUser?'Личный кабинет':'Аккаунт'}</h2>
    <div class="sub">${configured?'Вход синхронизирует дневник с облачной базой.':'Для включения облачной регистрации добавьте URL и anon key Supabase в js/supabase-config.js.'}</div>
    ${currentUser ? `<div class="account-box"><b>${escapeHtml(currentUser.email||'')}</b><small>Авторизованный пользователь</small></div><div class="modal-actions"><button class="secondary-btn" id="closeAuth">Закрыть</button><button class="primary-btn" id="logoutBtn">Выйти</button></div>` : `
      <form id="authForm"><div class="modal-form"><label>Email<input name="email" type="email" required autocomplete="email"></label><label>Пароль<input name="password" type="password" minlength="8" required autocomplete="current-password"></label></div><div class="modal-actions"><button type="button" class="secondary-btn" id="registerBtn">Создать аккаунт</button><button class="primary-btn">Войти</button></div></form>`}`;
  openModal();
  if(currentUser){document.getElementById('logoutBtn').onclick=async()=>{await supabaseClient.auth.signOut();closeModal();toast('Вы вышли из аккаунта')};document.getElementById('closeAuth').onclick=closeModal;return;}
  if(!configured){document.getElementById('authForm').onsubmit=e=>{e.preventDefault();toast('Сначала настройте Supabase в js/supabase-config.js',true)};document.getElementById('registerBtn').onclick=()=>toast('Сначала настройте Supabase в js/supabase-config.js',true);return;}
  document.getElementById('authForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const {error}=await supabaseClient.auth.signInWithPassword({email:f.get('email'),password:f.get('password')});if(error)toast(error.message,true);else{closeModal();toast('Вход выполнен')}};
  document.getElementById('registerBtn').onclick=async()=>{const f=new FormData(document.getElementById('authForm'));const email=f.get('email'),password=f.get('password');if(!email||String(password).length<8)return toast('Введите email и пароль минимум из 8 символов',true);const {error}=await supabaseClient.auth.signUp({email,password});if(error)toast(error.message,true);else toast('Аккаунт создан. Проверьте email для подтверждения.')};
}

document.addEventListener('DOMContentLoaded',()=>{initAuth();const b=document.getElementById('profileBtn');if(b)b.addEventListener('click',openAuthModal);});
