/* Automated Signals Diary — isolated UI workspace. Existing main diary is untouched.
 * Visual release: no database migrations, no invented market data, no trades auto-executed.
 */
(() => {
  'use strict';
  const $ = (s, base = document) => base.querySelector(s);
  const $$ = (s, base = document) => [...base.querySelectorAll(s)];
  const root = $('#automatedDiary');
  if (!root) return;
  const THEME_KEY = 'tradingDiary_automatedTheme';
  const THEMES = ['obsidian', 'ivory', 'neon'];
  const state = {
    mode: '', profile: null, trades: [], bonuses: [], signals: [], ledger: [], revisions: [], tradeRevisions: [], bonusRevisions: [], profileRevisions: [], emailQueue: [], notes: [], plans: [], goals: [], adminRows: [], isAdmin: false,
    tab: 'dashboard', theme: 'obsidian', range: 'all', loading: false,
    tradeSearch: '', tradeFilter: 'all', bonusFilter: 'all', openForm: null,
    calendarCursor: new Date().toISOString().slice(0,7), calendarDay: null, scheduleDay: null
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const icon = name => `<svg class="ad-icon" aria-hidden="true"><use href="#ad-i-${name}"/></svg>`;
  // Monetary amounts are summed in integer micro-units, never IEEE-754 floats.
  const SCALE = 1000000n;
  function micro(value) {
    const raw = String(value ?? '0').trim();
    const m = raw.match(/^(-?)(\d+)(?:\.(\d{1,6}))?$/);
    if (!m) throw new Error(`Некорректная денежная сумма: ${raw}`);
    return (m[1] === '-' ? -1n : 1n) * (BigInt(m[2]) * SCALE + BigInt((m[3] || '').padEnd(6,'0')));
  }
  const num = value => Number(value || 0);
  const sumMicro = (values) => values.reduce((a,v) => a + micro(v), 0n);
  const money = (value, places = 6) => {
    const normalized = typeof value === 'number' && !/^[-]?\d+(?:\.\d{1,6})?$/.test(String(value)) ? value.toFixed(6) : value;
    const m = typeof value === 'bigint' ? value : micro(normalized);
    const abs = m < 0n ? -m : m;
    const whole = (abs / SCALE).toLocaleString('ru-RU');
    const tail = (abs % SCALE).toString().padStart(6, '0').slice(0,places).replace(/0+$/, '');
    return `${m < 0n ? '−' : ''}${whole}${tail ? ',' + tail : ''}`;
  };
  const decimal = m => `${m < 0n ? '-' : ''}${(m<0n?-m:m)/SCALE}.${((m<0n?-m:m)%SCALE).toString().padStart(6,'0')}`;
  const currency = () => esc(state.profile?.currency || 'USDT');
  const fmt = (value, places = 6) => `${money(value, places)} <span class="ad-unit">${currency()}</span>`;
  const signed = value => `${(typeof value === 'bigint' ? value > 0n : num(value) > 0) ? '+' : ''}${money(value)}`;
  const colorClass = value => (typeof value==='bigint' ? value>0n : num(value)>0) ? 'ad-positive' : (typeof value==='bigint' ? value<0n : num(value)<0) ? 'ad-negative' : 'ad-neutral';
  const titleByTab = {dashboard:'Обзор', trades:'Сделки', bonuses:'Бонусные мешочки', schedule:'Расписание', calendar:'Календарь', analytics:'Аналитика', plans:'План', goals:'Цели', notes:'Заметки', finance:'Финансы', admin:'Участники', settings:'Настройки'};
  const timeOpts = {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'};
  const humanDate = value => {
    if (!value) return '—';
    try { return new Date(value).toLocaleString('ru-RU', {timeZone: state.profile?.timezone || 'UTC', ...timeOpts}); }
    catch { return '—'; }
  };
  const shortDate = value => {
    if (!value) return '—';
    try { return new Date(value).toLocaleDateString('ru-RU', {timeZone: state.profile?.timezone || 'UTC', day:'numeric', month:'short'}); }
    catch { return '—'; }
  };
  const clockTime = value => new Date(value).toLocaleTimeString('ru-RU',{timeZone:state.profile.timezone,hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  function zoneParts(iso,zone) {
    const parts=new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso));
    return Object.fromEntries(parts.map(p=>[p.type,p.value]));
  }
  function zonedIso(value, zone) {
    const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) throw new Error('Укажите дату, часы, минуты и секунды.');
    const [,y,mo,d,h,mi,sec='00']=match;
    const target=Date.UTC(+y,+mo-1,+d,+h,+mi,+sec);
    const check=new Date(target);
    if(check.getUTCFullYear()!==+y||check.getUTCMonth()!==+mo-1||check.getUTCDate()!==+d||+h>23||+mi>59||+sec>59) throw new Error('Недопустимая дата или время.');
    let guess=target;
    for(let i=0;i<5;i++){
      const p=zoneParts(guess,zone);
      guess+=target-Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);
    }
    const actual=zoneParts(guess,zone);
    if([actual.year,actual.month,actual.day,actual.hour,actual.minute,actual.second].join('|')!==[y,mo,d,h,mi,sec].join('|')) throw new Error('Такого местного времени нет из-за перехода часового пояса. Выберите другое.');
    // During the autumn DST overlap, choose the earlier instant consistently.
    const earlier=guess-3600000, before=zoneParts(earlier,zone);
    if([before.year,before.month,before.day,before.hour,before.minute,before.second].join('|')===[y,mo,d,h,mi,sec].join('|')) guess=earlier;
    return new Date(guess).toISOString();
  }
  function nowInZoneInput(zone) {
    const p=zoneParts(new Date().toISOString(),zone);
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
  }
  const exactValue = raw => {
    const normalized=String(raw||'').trim();
    if(!/^\d+(?:\.\d{1,6})?$/.test(normalized)||micro(normalized)<=0n)throw new Error('Введите положительную сумму (до 6 знаков после запятой).');
    return decimal(micro(normalized));
  };
  function exactNonnegative(value) {
    const raw=String(value??'').trim();
    if(!/^\d+(?:\.\d{1,6})?$/.test(raw))throw new Error('Нужна неотрицательная сумма до 6 знаков.');
    return decimal(micro(raw));
  }
  function newRequestId() {
    if(crypto.randomUUID)return crypto.randomUUID();
    const bytes=crypto.getRandomValues(new Uint8Array(16));
    bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
    const h=[...bytes].map(x=>x.toString(16).padStart(2,'0'));
    return `${h.slice(0,4).join('')}-${h.slice(4,6).join('')}-${h.slice(6,8).join('')}-${h.slice(8,10).join('')}-${h.slice(10).join('')}`;
  }
  async function financeRpc(name,params) {
    const {data,error}=await getClient().rpc(name,params);
    if(error){
      if(error.code==='PGRST202'||error.code==='42883')throw new Error('Не найдена необходимая RPC-функция: примените миграции V2 и V4 на тестовой базе.');
      throw error;
    }
    return data;
  }
  let toastTimer;
  function announce(message, bad = false) {
    const el = $('#adToast');
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('bad', bad);
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 4500);
  }
  function setTheme(value) {
    const theme = THEMES.includes(value) ? value : 'obsidian';
    state.theme = theme;
    root.dataset.adTheme = theme;
    try {localStorage.setItem(THEME_KEY, theme);} catch {}
    $$('[data-ad-set-theme]', root).forEach(el => {
      const selected = el.dataset.adSetTheme === theme;
      el.classList.toggle('selected', selected);
      el.setAttribute('aria-pressed', String(selected));
    });
  }
  function showChooser() { $('#diaryChooser').hidden = false; $('.app-shell')?.setAttribute('aria-hidden', 'true'); }
  window.showDiaryChooser = showChooser;
  function setMode(mode) {
    if (!['main', 'automated'].includes(mode)) return;
    state.mode = mode;
    localStorage.setItem('tradingDiary_selectedStructure', mode);
    $('#diaryChooser').hidden = true;
    const shell = $('.app-shell');
    if (mode === 'main') {
      root.hidden = true;
      if (shell) { shell.style.display = ''; shell.removeAttribute('aria-hidden'); }
      return;
    }
    if (shell) { shell.style.display = 'none'; shell.setAttribute('aria-hidden', 'true'); }
    root.hidden = false;
    bootNewDiary();
  }
  function getClient() { return window.supabaseClient || null; }
  async function requireUser() {
    const c = getClient();
    if (!c) { announce('Не удалось инициализировать авторизацию. Обновите страницу.', true); return null; }
    const {data:{session}, error} = await c.auth.getSession();
    if (error) throw error;
    if (!session) {announce('Войдите в существующий аккаунт через профиль.', true); $('#profileBtn')?.click(); return null;}
    return session.user;
  }
  async function query(table, userId, orderColumn = 'created_at') {
    const rows=[];
    for(let page=0;page<100;page++){
      const {data,error}=await getClient().from(table).select('*').eq('user_id',userId).order(orderColumn,{ascending:false}).order('id',{ascending:false}).range(page*500,(page+1)*500-1);
      if(error)throw error;
      rows.push(...(data||[]));
      if(!data||data.length<500)return rows;
    }
    throw new Error('Слишком много записей для безопасной загрузки.');
  }
  function loadingMarkup() {
    return `<div class="ad-loading" role="status"><span class="ad-spinner"></span><span>Загружаем данные дневника…</span></div>`;
  }
  async function load() {
    let user;
    try {user = await requireUser();} catch(e) {announce(e.message || 'Ошибка авторизации.', true); return;}
    if (!user) return;
    state.loading = true;
    if ($('#adWorkspace') && !$('#adWorkspace').hidden) $('#adContent').innerHTML = loadingMarkup();
    try {
      const c = getClient();
      const profile = await c.from('automated_diary_profiles').select('*').eq('user_id', user.id).maybeSingle();
      if (profile.error) throw profile.error;
      if (!profile.data) {
        state.profile = null;
        $('#adWizard').hidden = false;
        $('#adWorkspace').hidden = true;
        return;
      }
      state.profile = profile.data;
      if(!state.calendarDay && state.tab!=='calendar')state.calendarCursor=zonedDay(new Date()).slice(0,7);
      [state.trades,state.bonuses,state.signals,state.ledger,state.notes,state.plans,state.goals,state.tradeRevisions,state.bonusRevisions,state.profileRevisions,state.emailQueue] = await Promise.all([
        'automated_diary_trades','automated_diary_bonuses','automated_diary_signals','automated_diary_ledger',
        'automated_diary_notes','automated_diary_plans','automated_diary_goals',
        'automated_diary_trade_revisions','automated_diary_bonus_revisions','automated_diary_profile_revisions','automated_diary_email_queue'
      ].map(table=>query(table,user.id,table.endsWith('_revisions')?'changed_at':table.endsWith('_queue')?'updated_at':'created_at')));
      const isAdmin=await c.rpc('ad_is_admin_v4');
      if(isAdmin.error)throw isAdmin.error;
      state.isAdmin=!!isAdmin.data;
      $$('[data-tab="admin"]',root).forEach(el=>{el.hidden=!state.isAdmin;});
      if(state.tab==='admin'&&!state.isAdmin)state.tab='dashboard';
      // Optional until the additive V2 migration is installed.
      try {state.revisions=await query('automated_diary_ledger_revisions',user.id,'changed_at');}
      catch(e){
        if(e.code==='42P01'||e.code==='PGRST205')state.revisions=[];
        else throw e;
      }
      $('#adWizard').hidden = true;
      $('#adWorkspace').hidden = false;
      render();
    } catch(e) {
      $('#adContent').innerHTML = `<div class="ad-empty ad-empty-error">${icon('info')}<h3>Не удалось загрузить данные</h3><p>Проверьте подключение и наличие SQL-миграции. Данные не изменены.</p><button class="ad-secondary" id="adRetry">Повторить</button></div>`;
      $('#adRetry')?.addEventListener('click', load);
      announce(e.message || 'Ошибка загрузки.', true);
    } finally {state.loading = false;}
  }
  async function bootNewDiary() {
    try {
      const user = await requireUser();
      if (user) await load();
      else {
        $('#adWizard').hidden = true; $('#adWorkspace').hidden = false;
        $('#adContent').innerHTML = `<div class="ad-empty ad-login-gate"><span class="ad-empty-icon">TD.</span><h3>Один аккаунт — два дневника</h3><p>Войдите в тот же аккаунт, что и в основном дневнике. Истории сделок не смешиваются.</p><button class="ad-primary" id="adLogin">Открыть профиль ${icon('arrow')}</button></div>`;
        $('#adLogin').onclick = () => $('#profileBtn')?.click();
      }
    } catch(e) { announce(e.message || 'Не удалось открыть дневник.', true); }
  }
  // Real chronological cash ledger. Every stake is a separate outgoing event;
  // every closed trade returns its FULL payout, never only profit.
  const stamp = x => new Date(x).getTime();
  const validStamp = x => x && Number.isFinite(stamp(x));
  function allMovements() {
    const result=[];
    for(const l of state.ledger){
      const date=l.operated_at||l.created_at;
      if(validStamp(date))result.push({date,rank:l.kind==='deposit'?0:3,id:l.id,delta:(l.kind==='deposit'?1n:-1n)*micro(l.amount),type:l.kind==='deposit'?'Пополнение':'Вывод',detail:l.note||'Финансовая операция',ledger:true,legacyTime:l.operated_at_inferred===true||!l.operated_at});
    }
    for(const t of state.trades){
      if(validStamp(t.opened_at))result.push({date:t.opened_at,rank:2,id:t.id,delta:-micro(t.stake),type:'Открытие сделки',detail:t.note||'Ставка в резерве',trade:t});
      if(t.status==='closed'&&validStamp(t.closed_at))result.push({date:t.closed_at,rank:1,id:t.id,delta:micro(t.payout),type:'Закрытие сделки',detail:t.note||'Возврат ставки и доход',trade:t});
    }
    for(const b of state.bonuses){
      if(b.status==='received'){
        const date=b.received_at||b.created_at;
        if(validStamp(date))result.push({date,rank:0,id:b.id,delta:micro(b.amount),type:'Бонус',detail:b.title||'Бонусный мешочек'});
      }
    }
    return result.sort((a,b)=>stamp(a.date)-stamp(b.date)||a.rank-b.rank||String(a.id).localeCompare(String(b.id)));
  }
  function timeline(until=Date.now()) {
    let cash=micro(state.profile?.initial_balance||0);
    const out=[];
    for(const e of allMovements()){
      if(stamp(e.date)>until)break;
      cash+=e.delta;
      out.push({...e,cashAfter:cash});
    }
    return {cash,events:out};
  }
  const past = d => validStamp(d)&&stamp(d)<=Date.now();
  const deposited = () => sumMicro(state.ledger.filter(x=>x.kind==='deposit'&&past(x.operated_at||x.created_at)).map(x=>x.amount));
  const withdrawn = () => sumMicro(state.ledger.filter(x=>x.kind==='withdrawal'&&past(x.operated_at||x.created_at)).map(x=>x.amount));
  const bonusTotal = () => sumMicro(state.bonuses.filter(x=>x.status==='received'&&past(x.received_at||x.created_at)).map(x=>x.amount));
  const openAt = now => state.trades.filter(t=>stamp(t.opened_at)<=now&&(t.status==='open'||stamp(t.closed_at)>now));
  const reserved = () => sumMicro(openAt(Date.now()).map(t=>t.stake));
  const closedTrades = () => state.trades.filter(x=>x.status==='closed'&&past(x.closed_at));
  const profit = t => micro(t.payout)-micro(t.stake);
  const earnings = () => closedTrades().reduce((sum,t)=>sum+profit(t),0n);
  const balance = () => timeline().cash;
  const equity = () => balance()+reserved();
  const rangeStart = () => state.range==='all'?0:Date.now()-Number(state.range)*86400000;
  function periodTrades(){return closedTrades().filter(t=>stamp(t.closed_at)>=rangeStart());}
  function periodStats(){
    const closed=periodTrades();
    return {closed,earnings:closed.reduce((v,t)=>v+profit(t),0n),payout:sumMicro(closed.map(t=>t.payout)),stakes:sumMicro(closed.map(t=>t.stake))};
  }
  function maxConcurrent(){
    let n=0,best=0;
    for(const e of allMovements().filter(e=>e.trade&&stamp(e.date)<=Date.now()).sort((a,b)=>stamp(a.date)-stamp(b.date)||a.rank-b.rank||String(a.id).localeCompare(String(b.id)))){n+=(e.rank===2?1:-1);best=Math.max(best,n);}
    return best;
  }
  function earningsStreak(){
    let count=0;
    for(const t of [...closedTrades()].sort((a,b)=>stamp(b.closed_at)-stamp(a.closed_at))) {
      if(profit(t)<=0n)break;
      count++;
    }
    return count;
  }
  function financialWarnings(){
    const marks=[];
    let cash=micro(state.profile?.initial_balance||0);
    for(const e of allMovements()){
      if(stamp(e.date)>Date.now())continue;
      cash+=e.delta;
      if(cash<0n)marks.push(`${humanDate(e.date)} — ${money(cash)} ${currency()}`);
    }
    const bad=closedTrades().filter(t=>profit(t)<=0n);
    if(bad.length)marks.push(`${bad.length} завершённых сделок не соответствуют правилу положительного дохода`);
    const retro=state.ledger.filter(l=>l.operated_at_inferred===true||!l.operated_at);
    if(retro.length)marks.push(`${retro.length} финансовых записей без времени операции (используется время создания)`);
    return marks;
  }
  function events(){
    return [...closedTrades().map(t=>({date:t.closed_at,amount:Number(profit(t))/1e6,label:'Доход со сделки'})),
    ...state.ledger.filter(x=>past(x.operated_at||x.created_at)).map(t=>({date:t.operated_at||t.created_at,amount:num(t.amount)*(t.kind==='withdrawal'?-1:1),label:t.kind==='deposit'?'Пополнение':'Вывод'})),
    ...state.bonuses.filter(t=>t.status==='received'&&past(t.received_at||t.created_at)).map(t=>({date:t.received_at||t.created_at,amount:num(t.amount),label:'Бонус'}))]
      .filter(t=>validStamp(t.date)).sort((a,b)=>stamp(a.date)-stamp(b.date));
  }
  function buildEquityChart() {
    const all = events(), start = rangeStart();
    const initial = num(state.profile.initial_balance);
    let baseline = initial;
    const previous = all.filter(e => new Date(e.date).getTime() < start);
    previous.forEach(e => baseline += e.amount);
    const selected = all.filter(e => new Date(e.date).getTime() >= start);
    if (!selected.length) return empty('Нет операций за период', 'Когда появятся закрытые сделки, бонусы или финансовые операции, здесь будет история капитала.', 'chart');
    let v = baseline;
    const values = [baseline, ...selected.map(e => (v += e.amount))];
    let min = Math.min(...values), max = Math.max(...values);
    if (Math.abs(max-min)<0.000001) {min -= Math.max(1, Math.abs(min)*.05); max += Math.max(1, Math.abs(max)*.05);}
    const W=800,H=240,pl=10,pr=12,pt=16,pb=28;
    const xy = values.map((value,i) => ({x:pl+i*(W-pl-pr)/Math.max(1,values.length-1), y:pt+(max-value)/(max-min)*(H-pt-pb),value}));
    const path = xy.map((p,i) => `${i?'L':'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
    const bottom = H-pb;
    const fill = `${path} L${xy[xy.length-1].x.toFixed(2)},${bottom} L${xy[0].x.toFixed(2)},${bottom} Z`;
    const lines = Array.from({length:4},(_,i) => {const y=pt+i*(H-pt-pb)/3; const value=max-i*(max-min)/3;return `<line x1="${pl}" y1="${y}" x2="${W-pr}" y2="${y}" class="ad-chart-grid-line"/><text x="${W-pr}" y="${y-5}" text-anchor="end" class="ad-chart-grid-text">${esc(money(value,2))}</text>`;}).join('');
    const up = values.at(-1) >= values[0];
    return `<div class="ad-chart-wrap"><svg viewBox="0 0 ${W} ${H}" class="ad-equity-chart ${up?'up':'down'}" role="img" aria-label="Динамика капитала от ${money(values[0])} до ${money(values.at(-1))} ${currency()}"><defs><linearGradient id="adChartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--ad-accent)" stop-opacity=".28"/><stop offset="1" stop-color="var(--ad-accent)" stop-opacity="0"/></linearGradient></defs>${lines}<path d="${fill}" fill="url(#adChartFill)"/><path d="${path}" class="ad-chart-line"/><circle cx="${xy.at(-1).x}" cy="${xy.at(-1).y}" r="4.5" class="ad-chart-point"/></svg><div class="ad-chart-bottom"><span>${shortDate(selected[0].date)}</span><span>${shortDate(selected.at(-1).date)}</span></div></div>`;
  }
  function empty(title, message, symbol='overview') {
    return `<div class="ad-empty"><span class="ad-empty-symbol">${icon(symbol)}</span><h3>${esc(title)}</h3><p>${esc(message)}</p></div>`;
  }
  function pageHeading(kicker, title, description, action = '') {
    return `<header class="ad-page-heading"><div><div class="ad-kicker">${kicker}</div><h1>${title}</h1><p>${description}</p></div>${action ? `<div class="ad-heading-action">${action}</div>`:''}</header>`;
  }
  function metric(label, value, detail, type = '', special = '') {
    return `<article class="ad-metric ${special}"><div class="ad-metric-label">${label}</div><strong class="ad-metric-value ${type}">${value}</strong><div class="ad-metric-detail">${detail}</div></article>`;
  }
  function section(title, subtitle, extra = '') {
    return `<div class="ad-section-top"><div><h2>${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</div>${extra}</div>`;
  }
  function periodToggle() {
    return `<div class="ad-period-toggle" role="group" aria-label="Период статистики">${[['7','7 дней'],['30','30 дней'],['90','90 дней'],['all','Всё время']].map(([key,name]) => `<button type="button" class="${state.range===key?'active':''}" data-ad-range="${key}" aria-pressed="${state.range===key}">${name}</button>`).join('')}</div>`;
  }
  function tradeTable(rows, compact = false) {
    return `<div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>Открытие · до секунды</th><th>Закрытие · до секунды</th><th>Ставка</th><th>Возврат</th><th>Заработано</th><th>Статус</th><th><span class="ad-sr-only">Действия</span></th></tr></thead><tbody>${rows.map(t=>{
      const closed=t.status==='closed',value=closed?profit(t):0n;
      return `<tr><td><span class="ad-table-date">${humanDate(t.opened_at)}</span>${!compact&&t.note?`<small class="ad-table-note" title="${esc(t.note)}">${esc(t.note)}</small>`:''}<small class="ad-row-ref">№ ${esc(t.id.slice(0,8))}</small></td><td class="ad-table-date">${closed?humanDate(t.closed_at):'—'}</td><td class="ad-numeric">${money(t.stake)}</td><td class="ad-numeric">${closed?money(t.payout):'—'}</td><td class="ad-numeric ${closed?colorClass(value):'ad-neutral'}">${closed?signed(value):'—'}</td><td><span class="ad-status ${closed?'ad-status-closed':'ad-status-open'}"><span class="ad-status-dot"></span>${closed?'Завершена':'В резерве'}</span></td><td><div class="ad-row-actions"><button type="button" class="ad-mini" data-ad-edit-trade="${esc(t.id)}">Править</button>${!closed?`<button class="ad-mini" data-close-trade="${esc(t.id)}">Закрыть</button>`:''}</div></td></tr>`;
    }).join('')||`<tr><td colspan="7" class="ad-table-empty">Сделок пока нет</td></tr>`}</tbody></table></div>`;
  }
  function hourInZone(date) {
    try {return Number(new Intl.DateTimeFormat('en-GB',{timeZone:state.profile.timezone,hour:'2-digit',hourCycle:'h23'}).format(new Date(date)));}
    catch {return 0;}
  }
  function weekdayInZone(date) {
    try {
      const n=new Intl.DateTimeFormat('en-US',{timeZone:state.profile.timezone,weekday:'short'}).format(new Date(date));
      return ({Mon:0,Tue:1,Wed:2,Thu:3,Fri:4,Sat:5,Sun:6})[n] ?? 0;
    } catch {return 0;}
  }
  function breakdownChart(labels, values) {
    const abs=v=>v<0n?-v:v;
    const max=values.reduce((a,v)=>abs(v)>a?abs(v):a,0n);
    if(max===0n)return empty('Пока нет завершённых сделок','Распределение появится после закрытия сделок.','trades');
    return `<div class="ad-breakdown" role="img" aria-label="Распределение полученного дохода"><div class="ad-breakdown-bars">${labels.map((label,i)=>{
      const v=values[i], percent=max?Math.max(4,Number(abs(v))*100/Number(max)):0;
      return `<div class="ad-breakdown-col" title="${esc(label)}: ${esc(money(v))} ${currency()}"><strong class="${colorClass(v)}">${money(v,2)}</strong><div class="ad-breakdown-track"><span class="${v<0n?'negative':''}" style="height:${percent}%"></span></div><small>${esc(label)}</small></div>`;
    }).join('')}</div></div>`;
  }
  function periodBreakdowns(){
    const closed=periodTrades();
    const buckets=[
      {title:'00:00–05:59',trades:[]},
      {title:'06:00–11:59',trades:[]},
      {title:'12:00–17:59',trades:[]},
      {title:'18:00–23:59',trades:[]}
    ];
    const weekdays=['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'].map(title=>({title,trades:[]}));
    for(const trade of closed){
      // Group by the *closing* time in this diary's selected IANA time zone.
      buckets[Math.floor(hourInZone(trade.closed_at)/6)].trades.push(trade);
      weekdays[weekdayInZone(trade.closed_at)].trades.push(trade);
    }
    function dataTable(groups){
      if(!closed.length)return empty('Нет закрытых сделок за период','Выберите другой период или закройте первую сделку.','trades');
      return `<div class="ad-table-wrap"><table class="ad-table ad-analysis-table"><thead><tr><th>Период</th><th>Сделок закрыто</th><th>Заработано</th></tr></thead><tbody>${groups.map(g=>{const value=g.trades.reduce((sum,t)=>sum+profit(t),0n);return `<tr><td><strong>${esc(g.title)}</strong></td><td class="ad-numeric">${g.trades.length}</td><td class="ad-numeric ${colorClass(value)}">${signed(value)} ${currency()}</td></tr>`;}).join('')}</tbody></table></div>`;
    }
    const explanation=`Каждая завершённая сделка учитывается ровно один раз — по дате и времени <strong>закрытия</strong> (${esc(state.profile.timezone)}). Доход = полный возврат − ставка. Пополнения, выводы и бонусы не входят в эти суммы.`;
    return `<section class="ad-card ad-analysis-explainer">${section('Как считаются показатели','Единая формула для всех периодов')}<p>${explanation}</p></section><div class="ad-layout-2 ad-layout-breakdown">
      <section class="ad-card">${section('Когда закрывались сделки','За выбранный период: количество и сумма дохода по времени закрытия')}${dataTable(buckets)}</section>
      <section class="ad-card">${section('В какие дни закрывались сделки','Суммы по понедельникам, вторникам и т. д. за весь выбранный период, не за одну неделю')}${dataTable(weekdays)}</section>
    </div>`;
  }
  function zonedDay(date) {
    try {
      const parts=new Intl.DateTimeFormat('en-CA',{timeZone:state.profile.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(date));
      const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
      return `${p.year}-${p.month}-${p.day}`;
    }catch{return '';}
  }
  function calendarWidget() {
    const [year,month]=state.calendarCursor.split('-').map(Number);
    const first=new Date(Date.UTC(year,month-1,1)),maxDay=new Date(Date.UTC(year,month,0)).getUTCDate();
    const offset=(first.getUTCDay()+6)%7;
    const monthName=first.toLocaleDateString('ru-RU',{month:'long',year:'numeric',timeZone:'UTC'});
    const counts={};
    for(const s of state.signals){const day=zonedDay(s.starts_at);counts[day]=(counts[day]||0)+1;}
    const days=[...Array(offset).fill('<span class="ad-cal-blank"></span>'),...Array.from({length:maxDay},(_,i)=>{
      const day=`${year}-${String(month).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`;
      const selected=state.calendarDay===day,today=zonedDay(new Date())===day;
      return `<button type="button" data-cal-day="${day}" class="${selected?'selected ':''}${today?'today ':''}${counts[day]?'has-events':''}" aria-pressed="${selected}" title="${counts[day]||0} событий">${i+1}${counts[day]?'<i></i>':''}</button>`;
    })];
    return `<div class="ad-calendar"><div class="ad-calendar-head"><strong>${esc(monthName)}</strong><div><button data-cal-month="-1" aria-label="Предыдущий месяц">‹</button><button data-cal-month="1" aria-label="Следующий месяц">›</button></div></div><div class="ad-calendar-grid">${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(x=>`<b>${x}</b>`).join('')}${days.join('')}</div><div class="ad-calendar-foot"><span class="ad-cal-mark"></span> Отмечены дни с событиями ${state.calendarDay?'<button type="button" data-cal-reset>Показать все</button>':''}</div></div>`;
  }
  function dashboardWorkspaceSummary(){
    const today=zonedDay(new Date());
    const tasks=[...state.plans].filter(x=>x.plan_date<=today).sort((a,b)=>Number(a.done)-Number(b.done)||b.plan_date.localeCompare(a.plan_date)).slice(0,5);
    const goals=[...state.goals].sort((a,b)=>Number(micro(b.current_value)>=micro(b.target))-Number(micro(a.current_value)>=micro(a.target))).slice(0,4);
    const notes=[...state.notes].sort((a,b)=>b.note_date.localeCompare(a.note_date)).slice(0,3);
    const daySignals=[...state.signals].filter(x=>zonedDay(x.starts_at)===today).sort((a,b)=>stamp(a.starts_at)-stamp(b.starts_at));
    const doneCount=state.plans.filter(x=>x.done).length;
    const readyCount=state.goals.filter(x=>micro(x.current_value)>=micro(x.target)).length;
    return `<section class="ad-card ad-overview-section">${section('Моё рабочее пространство','Все сведения — только из записей второго дневника. Быстрый переход к полному разделу.')}
    <div class="ad-overview-mini-grid">
      <article class="ad-overview-panel"><header><div><span class="ad-kicker">ПЛАН</span><h3>Задачи</h3></div><button type="button" class="ad-text-btn" data-go="plans">Открыть план →</button></header><p class="ad-overview-counter">${doneCount} из ${state.plans.length} выполнено</p>${tasks.length?`<ul class="ad-overview-items">${tasks.map(t=>`<li><span class="ad-overview-check ${t.done?'done':''}">${t.done?'✓':'○'}</span><span>${esc(t.title)} <small>${esc(t.plan_date)}</small></span></li>`).join('')}</ul>`:empty('Пока нет задач','Добавьте задачи в разделе «План».','overview')}</article>
      <article class="ad-overview-panel"><header><div><span class="ad-kicker">ЦЕЛИ</span><h3>Мой прогресс</h3></div><button type="button" class="ad-text-btn" data-go="goals">Все цели →</button></header><p class="ad-overview-counter">${readyCount} из ${state.goals.length} достигнуто (вручную)</p>${goals.length?`<ul class="ad-overview-items">${goals.map(g=>{const current=micro(g.current_value),target=micro(g.target),percent=target>0n?Math.max(0,Math.min(100,Number(current*100n/target))):0;return `<li><span class="ad-overview-goal"><strong>${esc(g.title)}</strong><small>${money(current)} / ${money(target)} (${percent}%)</small><span class="ad-goal-track"><i style="width:${percent}%"></i></span></span></li>`;}).join('')}</ul>`:empty('Целей пока нет','Добавьте первую личную цель.','overview')}</article>
      <article class="ad-overview-panel"><header><div><span class="ad-kicker">ЗАМЕТКИ</span><h3>Последние записи</h3></div><button type="button" class="ad-text-btn" data-go="notes">Все заметки →</button></header>${notes.length?`<ul class="ad-overview-items">${notes.map(n=>`<li class="ad-overview-note"><strong>${esc(n.title||'Без названия')}</strong><small>${esc(n.note_date)}</small><p>${esc(String(n.body||'').slice(0,175))}${String(n.body||'').length>175?'…':''}</p></li>`).join('')}</ul>`:empty('Нет заметок','Запишите наблюдения в разделе «Заметки».','overview')}</article>
      <article class="ad-overview-panel"><header><div><span class="ad-kicker">СЕГОДНЯ</span><h3>Расписание</h3></div><button type="button" class="ad-text-btn" data-go="schedule">Открыть день →</button></header><p class="ad-overview-counter">${daySignals.length} сигналов · ${daySignals.filter(s=>s.enabled).length} активных</p>${daySignals.length?`<ul class="ad-overview-items">${daySignals.slice(0,8).map(s=>`<li><time>${clockTime(s.starts_at)}</time><span>${esc(s.title)}<small>${s.enabled?'Активен':'Отключён'}</small></span></li>`).join('')}</ul>`:empty('Сегодня нет сигналов','Запланируйте сигналы на нужный день.','schedule')}</article>
    </div></section>`;
  }
  function dashboard() {
    const stats=periodStats(), overall=closedTrades();
    const active=state.trades.filter(t=>t.status==='open'&&past(t.opened_at));
    const avgStake=state.trades.length?sumMicro(state.trades.map(t=>t.stake))/BigInt(state.trades.length):0n;
    const avgIncome=overall.length?earnings()/BigInt(overall.length):0n;
    const totalPayout=sumMicro(overall.map(t=>t.payout));
    const totalStake=sumMicro(overall.map(t=>t.stake));
    const today=zonedDay(new Date());
    const todaySignals=state.signals.filter(s=>zonedDay(s.starts_at)===today);
    const scheduled=[...state.signals].filter(s=>s.enabled&&stamp(s.starts_at)>=Date.now()).sort((a,b)=>stamp(a.starts_at)-stamp(b.starts_at)).slice(0,8);
    const recent=[...state.trades].sort((a,b)=>stamp(b.opened_at)-stamp(a.opened_at)).slice(0,6);
    const issues=financialWarnings();
    const todayEarned=overall.filter(t=>zonedDay(t.closed_at)===today).reduce((a,t)=>a+profit(t),0n);
    const weekStart=Date.now()-7*86400000;
    const sevenEarned=overall.filter(t=>stamp(t.closed_at)>=weekStart).reduce((a,t)=>a+profit(t),0n);
    const thisMonth=zonedDay(new Date()).slice(0,7);
    const monthEarned=overall.filter(t=>zonedDay(t.closed_at).startsWith(thisMonth)).reduce((a,t)=>a+profit(t),0n);
    return `${pageHeading('ТОЛЬКО ПРИБЫЛЬНЫЕ СИГНАЛЫ / ДНЕВНИК 02','Контроль капитала<span class="ad-heading-period">.</span>','Достоверные показатели, хронология до секунды и независимый резерв открытых ставок.',`<button type="button" class="ad-primary" data-go="trades" data-open="trade">${icon('plus')} Открыть сделку</button>`)}
      <div class="ad-workspace-note">${icon('info')} <span>Каждая открытая ставка вычитается из доступных средств и остаётся в резерве. <strong>Доход появляется только после закрытия</strong> сделки.</span></div>
      ${issues.length?`<div class="ad-data-warning" role="alert"><strong>Требуется сверка истории</strong><ul>${issues.slice(0,4).map(t=>`<li>${esc(t)}</li>`).join('')}</ul><button data-go="settings" class="ad-secondary">Проверить данные</button></div>`:''}
      <div class="ad-kpi-grid ad-kpi-primary">
        ${metric('ДОСТУПНО СЕЙЧАС',fmt(balance()),`Баланс с учётом точного времени операций`,'','ad-metric-accent')}
        ${metric('ОТКРЫТЫЕ СТАВКИ',fmt(reserved()),`${active.length} отдельных сделок в резерве`)}
        ${metric('ОБЩИЙ КАПИТАЛ',fmt(equity()),'Доступный баланс + резерв')}
        ${metric('ЗАРАБОТАНО НА СДЕЛКАХ',fmt(earnings()),`Чистый доход ${overall.length} завершённых сделок`,'ad-positive')}
      </div>
      <div class="ad-kpi-grid ad-kpi-secondary">
        ${metric('СДЕЛОК ЗАКРЫТО',money(overall.length),'Подтверждённый результат')}
        ${metric('СЕЙЧАС ОТКРЫТО',money(active.length),`Максимум одновременно: ${maxConcurrent()}`)}
        ${metric('ВСЕГО ПОСТАВЛЕНО',fmt(totalStake),'По завершённым сделкам')}
        ${metric('ВСЕГО ВОЗВРАЩЕНО',fmt(totalPayout),'Ставки и доход вместе')}
        ${metric('СРЕДНИЙ ДОХОД / СДЕЛКА',fmt(avgIncome),'По завершённым сделкам')}
        ${metric('СРЕДНЯЯ СТАВКА',fmt(avgStake),'По открытым и завершённым сделкам')}
        ${metric('ПОЛУЧЕНО БОНУСОВ',fmt(bonusTotal(),4),'Отдельно от дохода сделок')}
        ${metric('СИГНАЛОВ СЕГОДНЯ',money(todaySignals.length),`Активны: ${todaySignals.filter(x=>x.enabled).length}`)}
      </div>
      <section class="ad-card ad-today-summary">${section('Подтверждённый доход по периодам','Только закрытые сделки, без переводов и бонусов')}<div class="ad-kpi-grid ad-kpi-secondary">
      ${metric('СЕГОДНЯ',fmt(todayEarned),'По дате закрытия в вашем часовом поясе')}
      ${metric('ПОСЛЕДНИЕ 7 × 24 ЧАСА',fmt(sevenEarned),'Скользящий период')}
      ${metric('ТЕКУЩИЙ МЕСЯЦ',fmt(monthEarned),'Календарный месяц')}
      ${metric('СДЕЛОК СЕГОДНЯ',overall.filter(t=>zonedDay(t.closed_at)===today).length,'Завершённых')}</div></section>
      <div class="ad-layout-2 ad-layout-chart">
        <section class="ad-card ad-chart-card">${section('Динамика общего капитала','Начальный баланс + доход от завершённых сделок + переводы + бонусы',periodToggle())}${buildEquityChart()}</section>
        <section class="ad-card ad-performance-card">${section('Итоги периода','Только фактически завершённые сделки')}
          <div class="ad-profit-summary"><span>ПОЛУЧЕННЫЙ ДОХОД</span><strong class="ad-positive">${signed(stats.earnings)} <small>${currency()}</small></strong></div>
          <div class="ad-profit-rows"><div><span>Завершено сделок</span><b>${stats.closed.length}</b></div><div><span>Сумма ставок</span><b>${money(stats.stakes)} ${currency()}</b></div><div><span>Сумма возвратов</span><b>${money(stats.payout)} ${currency()}</b></div><div><span>Доход на сделку</span><b>${money(stats.closed.length?stats.earnings/BigInt(stats.closed.length):0n)} ${currency()}</b></div></div>
          <div class="ad-performance-bottom">Показатели отражают записанные операции, а не обещание будущей доходности.</div></section>
      </div>
      ${dashboardWorkspaceSummary()}
      <div class="ad-layout-2 ad-layout-lower"><section class="ad-card">${section('Последние сделки','Отдельные события с точностью до секунды',`<button type="button" class="ad-text-btn" data-go="trades">Все сделки ${icon('arrow')}</button>`)}${recent.length?tradeTable(recent,true):empty('Сделок пока нет','Добавьте первую сделку, чтобы видеть историю.','trades')}</section>
      <section class="ad-card">${section('Ближайшие сигналы','Детальный план на день',`<button type="button" class="ad-text-btn" data-go="schedule">Расписание ${icon('arrow')}</button>`)}${scheduled.length?`<div class="ad-timeline">${scheduled.map(s=>`<div class="ad-timeline-item"><span class="ad-timeline-line"></span><span class="ad-timeline-day">${shortDate(s.starts_at)}</span><div><strong>${esc(s.title)}</strong><small>${clockTime(s.starts_at)} · ${esc(signalName(s.signal_type))}</small></div><span class="ad-status ad-status-open">План</span></div>`).join('')}</div>`:empty('Нет ближайших сигналов','Добавьте события с точным временем.','schedule')}</section></div>`;
  }
  function tradesView() {
    const open = state.trades.filter(t => t.status==='open').length;
    return `${pageHeading('ЖУРНАЛ / TRADES','История сделок<span class="ad-heading-period">.</span>','Все открытые и завершённые сделки этого дневника.',`<button class="ad-primary" id="adAddTrade">${icon('plus')} Новая сделка</button>`)}
      <div class="ad-stat-strip"><div><small>ВСЕГО СДЕЛОК</small><strong>${state.trades.length}</strong></div><div><small>ОТКРЫТО</small><strong>${open}</strong></div><div><small>ЗАКРЫТО</small><strong>${closedTrades().length}</strong></div><div><small>В РЕЗЕРВЕ</small><strong>${fmt(reserved())}</strong></div></div>
      <div id="adTradeForm"></div><section class="ad-card">${section('Журнал операций','Суммы отображаются с точностью до 6 знаков.')}
      <div class="ad-toolbar"><label class="ad-search"><span class="ad-sr-only">Поиск по заметкам</span><input id="adTradeSearch" type="search" placeholder="Поиск по заметкам…" value="${esc(state.tradeSearch)}"></label><div class="ad-filter-buttons" role="group" aria-label="Фильтр сделок">${[['all','Все'],['open','Открытые'],['closed','Закрытые']].map(([id,l])=>`<button type="button" data-trade-filter="${id}" class="${state.tradeFilter===id?'active':''}" aria-pressed="${state.tradeFilter===id}">${l}</button>`).join('')}</div><button id="adExportTrades" class="ad-secondary">Экспорт CSV</button></div>
      <div id="adTradesResults">${tradeTable(filteredTrades())}</div><div class="ad-table-footer" id="adTradesCount">Показано: ${filteredTrades().length} из ${state.trades.length}. Каждая сделка имеет отдельный идентификатор.</div></section>`;
  }
  function filteredTrades() {
    const q=state.tradeSearch.toLocaleLowerCase('ru').trim();
    return state.trades.filter(t => (state.tradeFilter==='all'||t.status===state.tradeFilter)&&(!q||String(t.note||'').toLocaleLowerCase('ru').includes(q))).sort((a,b)=>new Date(b.opened_at)-new Date(a.opened_at));
  }
  function bonusesView() {
    const received=state.bonuses.filter(b=>b.status==='received').length;
    return `${pageHeading('БОНУСЫ / REWARDS','Бонусные мешочки<span class="ad-heading-period">.</span>','Учитывайте дополнительные поступления отдельно от торговой прибыли.',`<button class="ad-primary" id="adAddBonus">${icon('plus')} Добавить бонус</button>`)}
      <div class="ad-stat-strip"><div><small>ПОЛУЧЕНО БОНУСОВ</small><strong>${fmt(bonusTotal(),4)}</strong></div><div><small>ЗАЧИСЛЕНО</small><strong>${received}</strong></div><div><small>ОЖИДАЕТ</small><strong>${state.bonuses.filter(b=>b.status==='pending').length}</strong></div><div><small>ВСЕГО ЗАПИСЕЙ</small><strong>${state.bonuses.length}</strong></div></div>
      <div id="adBonusForm"></div><section class="ad-card">${section('История бонусов','Бонусы не смешиваются с доходом по сделкам.')}
      <div class="ad-toolbar"><div class="ad-filter-buttons" role="group" aria-label="Статус бонусов">${[['all','Все'],['received','Полученные'],['pending','Ожидающие'],['cancelled','Отменённые']].map(([id,l])=>`<button type="button" data-bonus-filter="${id}" class="${state.bonusFilter===id?'active':''}" aria-pressed="${state.bonusFilter===id}">${l}</button>`).join('')}</div></div><div id="adBonusResults">${bonusResults()}</div></section>`;
  }
  function bonusResults() {
    const rows = state.bonuses.filter(b=>state.bonusFilter==='all'||b.status===state.bonusFilter).sort((a,b)=>new Date(b.received_at||b.created_at)-new Date(a.received_at||a.created_at));
    if(!rows.length)return empty('Бонусов не найдено','Добавьте бонус или измените выбранный фильтр.','bonuses');
    return `<div class="ad-bonus-list">${rows.map(b=>`<div class="ad-bonus-item"><span class="ad-bonus-symbol">${icon('bonuses')}</span><div class="ad-bonus-name"><strong>${esc(b.title||'Бонусный мешочек')}</strong><small>${humanDate(b.received_at||b.created_at)}</small></div><strong class="ad-bonus-value">${fmt(b.amount,4)}</strong><span class="ad-status ${b.status==='received'?'ad-status-closed':b.status==='pending'?'ad-status-open':'ad-status-muted'}">${({received:'Получен',pending:'Ожидается',cancelled:'Отменён'})[b.status]||esc(b.status)}</span><button type="button" class="ad-mini" data-edit-bonus="${esc(b.id)}">Править</button></div>`).join('')}</div>`;
  }
  const signalName = x => ({trade:'Сделка',bonus:'Бонус',other:'Другое'})[x] || String(x);
  function scheduleView() {
    const day=state.scheduleDay||zonedDay(new Date());
    const listing=[...state.signals].filter(s=>zonedDay(s.starts_at)===day).sort((a,b)=>stamp(a.starts_at)-stamp(b.starts_at)||String(a.id).localeCompare(String(b.id)));
    const active=listing.filter(x=>x.enabled);
    const next=listing.find(x=>x.enabled&&stamp(x.starts_at)>=Date.now());
    const dow=new Date(`${day}T12:00:00Z`).toLocaleDateString('ru-RU',{timeZone:'UTC',weekday:'long',day:'numeric',month:'long',year:'numeric'});
    const hourGroup=[...Array(24)].map((_,h)=>{
      const slice=listing.filter(s=>hourInZone(s.starts_at)===h);
      if(!slice.length)return '';
      return `<div class="ad-day-hour"><span class="ad-day-hour-label">${String(h).padStart(2,'0')}:00</span><div class="ad-day-hour-events">${slice.map((s,i)=>`<article class="ad-day-event ${s.enabled?'':'muted'}"><span class="ad-day-sequence">${String(listing.indexOf(s)+1).padStart(2,'0')}</span><div class="ad-day-event-main"><strong>${esc(s.title)}</strong><small>${esc(s.instrument||signalName(s.signal_type))}${s.direction?' · '+esc(s.direction==='up'?'Вверх':s.direction==='down'?'Вниз':s.direction):''} · напоминание за ${num(s.remind_minutes)} мин.</small>${s.description?`<small>${esc(s.description)}</small>`:''}</div><time datetime="${esc(s.starts_at)}">${clockTime(s.starts_at)}</time><span class="ad-status ${s.enabled?'ad-status-open':'ad-status-muted'}">${s.enabled?'Запланирован':'Отключён'}</span><button type="button" class="ad-mini" data-edit-signal="${esc(s.id)}">Править</button><button type="button" class="ad-mini" data-remove-signal="${esc(s.id)}">Удалить</button></article>`).join('')}</div></div>`;
    }).join('');
    return `${pageHeading('СИГНАЛЫ / ДЕНЬ','Расписание по часам<span class="ad-heading-period">.</span>','Восемь или больше сигналов в день — каждый со своим временем до секунды.',`<button class="ad-primary" id="adAddSignal">${icon('plus')} Добавить сигнал</button>`)}
      <section class="ad-card ad-day-navigation"><div><span class="ad-kicker">ВЫБРАННАЯ ДАТА</span><h2>${esc(dow)}</h2><small>Часовой пояс: ${esc(state.profile.timezone)}</small></div><div class="ad-day-navigation-buttons"><button class="ad-secondary" data-day-shift="-1" aria-label="Предыдущий день">‹</button><input type="date" id="adDaySelect" aria-label="Выбрать дату расписания" value="${esc(day)}"><button class="ad-secondary" data-day-shift="1" aria-label="Следующий день">›</button><button class="ad-secondary" id="adDayToday">Сегодня</button></div></section>
      <div class="ad-stat-strip ad-day-stats"><div><small>СИГНАЛОВ ЗА ДЕНЬ</small><strong>${listing.length}</strong></div><div><small>ВКЛЮЧЕНЫ</small><strong>${active.length}</strong></div><div><small>ОТКЛЮЧЕНЫ</small><strong>${listing.length-active.length}</strong></div><div><small>СЛЕДУЮЩИЙ</small><strong>${next?clockTime(next.starts_at):'—'}</strong></div></div>
      <div class="ad-week-nav">${Array.from({length:7},(_,i)=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+i-3);const k=d.toISOString().slice(0,10);return `<button data-ad-week="${k}" class="${k===day?'selected':''}"><small>${d.toLocaleDateString('ru-RU',{weekday:'short',timeZone:'UTC'})}</small><strong>${d.getUTCDate()}</strong><small>${state.signals.filter(s=>zonedDay(s.starts_at)===k).length} сигн.</small></button>`;}).join('')}</div><div class="ad-day-actions"><button type="button" class="ad-secondary" id="adCopyDay">Копировать сигналы на другой день</button></div><div id="adSignalForm"></div>
      <section class="ad-card ad-day-agenda">${section('Сигналы на выбранный день','Хронологический порядок, часы · минуты · секунды')}${listing.length?`<div class="ad-day-hour-list">${hourGroup}</div>`:empty('В этот день сигналов нет','Создайте сигнал или выберите соседнюю дату.','schedule')}</section>
      <section class="ad-card ad-notice-card">${section('Напоминания браузера и почта','Почта подключается через отдельную серверную функцию')}<p>Уведомления работают только при открытой вкладке и выданном разрешении. Само разрешение не означает доставку. Почта: <strong>${state.profile.email_notifications_enabled?'согласие включено':'отключена'}</strong> (проверьте состояние сервера).</p><button class="ad-secondary" data-go="settings">Настройки почты</button><button class="ad-secondary" id="adNotify">Разрешить уведомления</button></section>`;
  }
  function financeRows(){return [...timeline().events].reverse();}
  function financeView(){
    const rows=financeRows(),issues=financialWarnings();
    return `${pageHeading('КАПИТАЛ / ХРОНОЛОГИЯ','Точное движение денег<span class="ad-heading-period">.</span>','Каждая операция имеет фактическую дату и время. Баланс после события вычисляется последовательно.',`<button type="button" class="ad-secondary" id="adExportFinance">Экспорт CSV</button>`)}
      <div class="ad-kpi-grid ad-kpi-primary ad-kpi-finance">
        ${metric('ДОСТУПНЫЕ СРЕДСТВА',fmt(balance()),`В резерве: ${money(reserved())} ${currency()}`,'','ad-metric-accent')}
        ${metric('ОБЩИЙ КАПИТАЛ',fmt(equity()),'Доступно + открытые ставки')}
        ${metric('ПОПОЛНЕНИЯ',fmt(deposited()),'По указанному времени операций')}
        ${metric('ВЫВОДЫ',fmt(withdrawn()),'По указанному времени операций')}
      </div>
      ${issues.length?`<div class="ad-data-warning"><strong>Внимание: обнаружены расхождения</strong><ul>${issues.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}
      <div id="adLedgerEdit"></div><div class="ad-layout-2 ad-layout-finance"><section class="ad-card">${section('Добавить финансовую операцию','Внесите реальное время с точностью до секунды')}
        <form id="adLedgerForm" class="ad-form ad-finance-form"><label>Тип операции<select name="kind"><option value="deposit">Пополнение</option><option value="withdrawal">Вывод</option></select></label>
        <label>Сумма<input name="amount" type="number" step="0.000001" min="0.000001" required placeholder="0.000000"></label>
        <label>Дата и время операции (${esc(state.profile.timezone)})<input name="operated_at" type="datetime-local" step="1" required value="${nowInZoneInput(state.profile.timezone)}"></label>
        <label class="ad-full">Комментарий<input name="note" maxlength="200" placeholder="Необязательно"></label>
        <p class="ad-form-hint">Не меняйте дату на сегодняшнюю, если пополнение или вывод произошли раньше. Время влияет на доступный баланс каждой сделки.</p>
        <button class="ad-primary" type="submit">Зафиксировать операцию ${icon('arrow')}</button></form></section>
      <section class="ad-card ad-finance-help">${section('Из чего состоит капитал','Раздельный учёт по реальным записям')}
        <div class="ad-finance-breakdown"><div><span>Начальный баланс</span><strong>${fmt(state.profile.initial_balance)}</strong></div><div><span>Пополнения − выводы</span><strong>${fmt(deposited()-withdrawn())}</strong></div><div><span>Доход завершённых сделок</span><strong class="ad-positive">${fmt(earnings())}</strong></div><div><span>Полученные бонусы</span><strong>${fmt(bonusTotal(),4)}</strong></div><div class="ad-finance-total"><span>Общий капитал</span><strong>${fmt(equity())}</strong></div></div></section></div>
      <section class="ad-card">${section('Хронология до секунды','Открытие каждой ставки и полный возврат показаны отдельно, справа — баланс после события')}
        ${rows.length?`<div class="ad-ledger-head"><span>Событие и точное время</span><span>Изменение</span><span>Доступно после</span></div><div class="ad-finance-list">${rows.map(e=>`<div class="ad-finance-item ad-ledger-row"><div class="ad-finance-item-icon">${icon(e.trade?'trades':e.type==='Бонус'?'bonuses':'finance')}</div><div class="ad-finance-item-label"><strong>${esc(e.type)}</strong><small>${esc(e.detail)} · ${humanDate(e.date)}${e.legacyTime?' · ⚠ время создания':''}</small>${e.ledger?`<button class="ad-mini ad-ledger-edit-btn" type="button" data-edit-ledger="${esc(e.id)}">Исправить запись</button>`:''}</div><strong class="${colorClass(e.delta)}">${signed(e.delta)} <span class="ad-unit">${currency()}</span></strong><strong class="ad-ledger-after">${money(e.cashAfter)} <span class="ad-unit">${currency()}</span></strong></div>`).join('')}</div>`:empty('История пока пуста','Добавьте сделку или финансовую операцию.','finance')}</section>
      ${state.revisions.length?`<section class="ad-card ad-revisions">${section('Журнал исправлений','Старые значения сохраняются при коррекции времени и сумм')}
      ${state.revisions.slice(0,100).map(r=>`<div class="ad-revision"><strong>${humanDate(r.changed_at)}</strong><span>До: ${esc(r.old_kind)} ${money(r.old_amount)} ${currency()} · ${humanDate(r.old_operated_at)}</span><span>После: ${esc(r.new_kind)} ${money(r.new_amount)} ${currency()} · ${humanDate(r.new_operated_at)}</span></div>`).join('')}</section>`:''}`;
  }
  function zoneInput(date,zone){
    const p=zoneParts(date,zone);
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
  }
  function showCashCorrection(id){
    const item=state.ledger.find(l=>l.id===id);
    const host=$('#adLedgerEdit');
    if(!host||!item)return;
    host.innerHTML=formPanel('Исправление операции','Запись обновляется с проверкой всей истории. Предыдущее значение сохраняется в журнале исправлений.',
      `<form id="adEditCashForm" class="ad-form ad-inline-form"><label>Тип<select name="kind"><option value="deposit" ${item.kind==='deposit'?'selected':''}>Пополнение</option><option value="withdrawal" ${item.kind==='withdrawal'?'selected':''}>Вывод</option></select></label><label>Сумма<input name="amount" type="number" required min="0.000001" step="0.000001" value="${esc(item.amount)}"></label><label>Фактическая дата и время (${esc(state.profile.timezone)})<input name="operated_at" type="datetime-local" step="1" required value="${zoneInput(item.operated_at||item.created_at,state.profile.timezone)}"></label><label>Комментарий<input name="note" maxlength="200" value="${esc(item.note||'')}"></label><button class="ad-primary" type="submit">Проверить и сохранить исправление</button></form>`);
    host.scrollIntoView({behavior:'smooth',block:'start'});
    $('#adLedgerEdit [data-cancel-form]')?.addEventListener('click',()=>host.replaceChildren());
    $('#adEditCashForm').onsubmit=async e=>{
      e.preventDefault();const form=e.currentTarget,f=new FormData(form);setBusy(form,true);
      try{
        await financeRpc('ad_correct_cash_v2',{p_operation_id:id,p_kind:f.get('kind'),p_amount:exactValue(f.get('amount')),p_operated_at:zonedIso(f.get('operated_at'),state.profile.timezone),p_note:f.get('note')||''});
        await load();announce('Дата или сумма исправлена. История проверена, прежние значения сохранены.');
      }catch(err){announce(err.message||'Исправление отклонено.',true);}finally{setBusy(form,false);}
    };
  }
  function settingsView() {
    return `${pageHeading('ПРОСТРАНСТВО / PERSONALIZE','Настройки дневника<span class="ad-heading-period">.</span>','Персонализируйте внешний вид и параметры автоматических сигналов.')}
      <section class="ad-card ad-settings-card">${section('Тема оформления','Меняется только внешний вид второго дневника')}<div class="ad-theme-gallery">${[['obsidian','Obsidian','Графит, изумруд, глубокий контраст'],['ivory','Ivory','Светлая палитра, спокойная аналитика'],['neon','Neon','Ночной синий, бирюза и фиолетовый']].map(([id,name,desc])=>`<button type="button" class="ad-theme-preview ${state.theme===id?'selected':''}" data-ad-set-theme="${id}" aria-pressed="${state.theme===id}"><span class="ad-theme-art ad-theme-art-${id}"><span class="ad-art-sidebar"></span><span class="ad-art-card"></span><span class="ad-art-card-small"></span><span class="ad-art-chart"></span></span><strong>${name}${state.theme===id?` ${icon('check')}`:''}</strong><small>${desc}</small></button>`).join('')}</div></section>
      <section class="ad-card ad-settings-card">${section('Торговые параметры','Настройки относятся только к дневнику сигналов')}<form id="adSettingsForm" class="ad-form"><label>Начальный баланс<input name="initial_balance" type="number" step="0.000001" min="0" required value="${esc(state.profile.initial_balance)}"></label><label>Валюта<select name="currency">${['USDT','USD','EUR','BTC'].map(x=>`<option ${state.profile.currency===x?'selected':''}>${x}</option>`).join('')}</select></label><label>Часовой пояс<select name="timezone">${['Europe/Moscow','Europe/Stockholm','UTC','Europe/London','America/New_York','Asia/Dubai'].map(x=>`<option ${state.profile.timezone===x?'selected':''}>${x}</option>`).join('')}</select></label><label>Длительность сделки, сек.<input name="duration_seconds" type="number" min="1" step="1" required value="${esc(state.profile.duration_seconds ?? 60)}"></label><label>Ставка от баланса, %<input name="stake_percent" type="number" min="0.000001" step="0.000001" required value="${esc(state.profile.stake_percent ?? 2)}"></label><label>Ожидаемая прибыль от ставки, %<input name="profit_percent" type="number" min="0" step="0.000001" required value="${esc(state.profile.profit_percent ?? 40)}"></label><button class="ad-primary" type="submit">Сохранить настройки ${icon('check')}</button></form><div class="ad-inline-alert">${icon('info')} Изменение начального баланса пересчитывает всю историю. Валюту нельзя менять после появления финансовых записей без специальной конвертации.</div></section>
      <section class="ad-card ad-settings-card">${section('Почтовые напоминания','Опциональная серверная доставка')}<p class="ad-muted-copy">Почтовый адрес берётся из подтверждённого аккаунта. Для настоящих писем нужны Edge Function, Resend и Cron. Согласие можно отключить.</p><form id="adEmailForm" class="ad-form"><label class="ad-check"><input type="checkbox" name="enabled" ${state.profile.email_notifications_enabled?'checked':''}> Получать письма по расписанию сигналов</label><button class="ad-secondary" type="submit">Сохранить согласие</button></form><p class="ad-muted-copy">Принятие письма почтовым сервисом не гарантирует доставку во входящие.</p>${state.emailQueue.length?`<div class="ad-work-list">${[...state.emailQueue].sort((a,b)=>stamp(b.starts_at)-stamp(a.starts_at)).slice(0,8).map(q=>`<div class="ad-work-item"><span>${humanDate(q.starts_at)}</span><strong>${esc(({pending:'Ожидает',processing:'Обрабатывается',accepted:'Принято почтовым сервисом',failed:'Ошибка отправки'})[q.status]||q.status)}</strong><small>Попыток: ${Number(q.attempts||0)}</small></div>`).join('')}</div>`:'<p class="ad-muted-copy">Пока нет зарегистрированных попыток отправки писем.</p>'}</section>
      <section class="ad-card ad-settings-card">${section('Резервная копия второго дневника','Экспорт принадлежащих вам данных без доступа к чужим аккаунтам')}<p class="ad-muted-copy">Сохраните JSON-копию перед сложными изменениями. Это не резервная копия базы Supabase и не включает данные основного дневника.</p><button type="button" id="adExportBackup" class="ad-secondary">Скачать JSON-копию</button></section>
      <section class="ad-card ad-settings-card">${section('Целостность данных','Проверка только читает записи — ничего не удаляет')}<div class="ad-settings-audit"><div><strong>Аудит сделок и исправлений</strong><p>Проверяем отрицательные ставки и некорректные выплаты в уже загруженных записях. Сохранено исправлений: ${state.tradeRevisions.length} сделок, ${state.bonusRevisions.length} бонусов, ${state.profileRevisions.length} настроек. Это не полный аудит Supabase.</p></div><button class="ad-secondary" id="adAudit">Проверить записи</button></div><div class="ad-audit-result" id="adAuditResult" role="status"></div></section>`;
  }
  function dayData(day){
    const trades=closedTrades().filter(t=>zonedDay(t.closed_at)===day);
    const opened=state.trades.filter(t=>zonedDay(t.opened_at)===day);
    const bonuses=state.bonuses.filter(b=>b.status==='received'&&zonedDay(b.received_at||b.created_at)===day);
    const signals=state.signals.filter(s=>zonedDay(s.starts_at)===day);
    return {trades,opened,bonuses,signals,income:trades.reduce((a,t)=>a+profit(t),0n)};
  }
  function calendarView(){
    const [y,m]=state.calendarCursor.split('-').map(Number);
    const first=new Date(Date.UTC(y,m-1,1)),last=new Date(Date.UTC(y,m,0)).getUTCDate();
    const offset=(first.getUTCDay()+6)%7;
    const currentDay=zonedDay(new Date());
    const monthDays=Array.from({length:last},(_,i)=>`${y}-${String(m).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`);
    const monthly=monthDays.map(day=>({day,...dayData(day)}));
    const cells=[...Array(offset).fill('<span class="ad-calendar-day-spacer" aria-hidden="true"></span>'),...monthly.map(d=>{
      const profitDay=d.income>0n;
      const caption=profitDay?`Доход +${money(d.income)} ${currency()}, ${d.trades.length} сделок`:`${d.trades.length} сделок, ${d.signals.length} сигналов`;
      return `<button type="button" class="ad-calendar-day-tile ${profitDay?'has-profit':''} ${d.day===currentDay?'is-today':''} ${state.calendarDay===d.day?'selected':''}" data-cal-day="${d.day}" aria-label="${esc(d.day+': '+caption)}" aria-pressed="${state.calendarDay===d.day}"><strong>${Number(d.day.slice(-2))}</strong><small>${d.trades.length} закр. · ${d.signals.length} сигн.</small><em>${profitDay?'+'+money(d.income,2):'—'}</em></button>`;
    })].join('');
    const selected=state.calendarDay&&state.calendarDay.startsWith(state.calendarCursor)?state.calendarDay:(currentDay.startsWith(state.calendarCursor)?currentDay:monthDays[0]);
    const details=dayData(selected),positiveDays=monthly.filter(x=>x.income>0n).length;
    const monthIncome=monthly.reduce((a,x)=>a+x.income,0n);
    const closedCount=monthly.reduce((a,x)=>a+x.trades.length,0);
    return `${pageHeading('КАЛЕНДАРЬ / 02','Календарь операций<span class="ad-heading-period">.</span>','Зелёным отмечены дни, в которые закрытые сделки принесли доход.')} 
    <section class="ad-card">${section('Выбор месяца','Доход относится к дню закрытия сделки, в вашем часовом поясе')}<div class="ad-month-bar"><button type="button" class="ad-secondary" data-cal-month="-1">‹</button><strong>${first.toLocaleDateString('ru-RU',{month:'long',year:'numeric',timeZone:'UTC'})}</strong><button type="button" class="ad-secondary" data-cal-month="1">›</button></div>
    <div class="ad-month-weekdays" aria-hidden="true">${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(x=>`<span>${x}</span>`).join('')}</div><div class="ad-month-grid">${cells}</div>
    <div class="ad-calendar-legend"><span><i class="ad-legend-profit"></i> День с заработанным доходом</span><span><i class="ad-legend-today"></i> Сегодня</span></div>
    <div class="ad-stat-strip ad-month-summary"><div><small>ПРИБЫЛЬНЫХ ДНЕЙ</small><strong>${positiveDays}</strong></div><div><small>ЗАКРЫТО СДЕЛОК</small><strong>${closedCount}</strong></div><div><small>ДОХОД ЗА МЕСЯЦ</small><strong class="ad-positive">${fmt(monthIncome)}</strong></div></div></section>
    <section class="ad-card">${section('Итоги '+selected,'Операции только за выбранную дату')}<div class="ad-stat-strip"><div><small>ЗАКРЫТО</small><strong>${details.trades.length}</strong></div><div><small>ДОХОД ОТ СДЕЛОК</small><strong class="ad-positive">${fmt(details.income)}</strong></div><div><small>ПОЛУЧЕНО БОНУСОВ</small><strong>${details.bonuses.length}</strong></div><div><small>СИГНАЛЫ</small><strong>${details.signals.length}</strong></div></div><div class="ad-panel-actions"><button type="button" class="ad-secondary" data-go="trades">Все сделки</button><button type="button" class="ad-secondary" data-calendar-schedule="${selected}">Сигналы дня</button></div>${details.trades.length?tradeTable(details.trades):empty('Нет завершённых сделок','Выберите другой день.','trades')}</section>`;
  }
  function analyticsView(){
    const closed=periodTrades(),days=new Map();
    for(const t of closed){const day=zonedDay(t.closed_at);days.set(day,(days.get(day)||0n)+profit(t));}
    const sorted=[...days].sort((a,b)=>a[0].localeCompare(b[0]));
    const max=sorted.reduce((m,x)=>x[1]>m?x[1]:m,0n);
    const avg=closed.length?closed.reduce((n,t)=>n+profit(t),0n)/BigInt(closed.length):0n;
    const bonuses=state.bonuses.filter(b=>b.status==='received'&&past(b.received_at||b.created_at)&&stamp(b.received_at||b.created_at)>=rangeStart());
    const bonusIncome=sumMicro(bonuses.map(b=>b.amount));
    return `${pageHeading('АНАЛИТИКА / 02','Аналитика дохода<span class="ad-heading-period">.</span>','Без показателей убытков: только реальные подтверждённые результаты.')}
      <section class="ad-card">${section('Выберите период','Закрытые сделки',periodToggle())}<div class="ad-kpi-grid ad-kpi-secondary">
      ${metric('ДОХОД ОТ СДЕЛОК',fmt(closed.reduce((v,t)=>v+profit(t),0n)),'Не включает пополнения и бонусы')}
      ${metric('ЗАКРЫТО СДЕЛОК',closed.length,'По дате закрытия')}
      ${metric('СРЕДНИЙ ДОХОД',fmt(avg),'На завершённую сделку')}
      ${metric('БОНУСНЫЙ ДОХОД',fmt(bonusIncome,4),'Учитывается отдельно')}
      </div></section><section class="ad-card">${section('Доход по дням','Каждый столбец — сумма подтверждённых доходов за календарный день')}
      ${sorted.length?`<div class="ad-daily-bars">${sorted.slice(-45).map(([day,n])=>`<div class="ad-daily-bar" title="${day}: ${money(n)}"><span style="height:${max?Math.max(3,Number(n*100n/max)):0}%"></span><small>${day.slice(5)}</small></div>`).join('')}</div>`:empty('Нет результатов за период','Завершённые сделки появятся здесь.','trades')}</section>
      ${periodBreakdowns()}<section class="ad-card">${section('Движение капитала','Учтены переводы и бонусы наряду с полученным доходом')}${buildEquityChart()}</section>`;
  }
  function plansView(){const day=state.scheduleDay||zonedDay(new Date()),rows=[...state.plans].sort((a,b)=>b.plan_date.localeCompare(a.plan_date));
    return `${pageHeading('ПЛАН / 02','План действий<span class="ad-heading-period">.</span>','Задачи и контроль выполнения независимо от основного дневника.')}
    <section class="ad-card"><div id="adWorkForm"></div><button class="ad-primary" data-add-work="plans">${icon('plus')} Новая задача</button></section><section class="ad-card">${section('Задачи','Отмечайте выполнение, исправляйте или удаляйте')}
    ${rows.length?`<div class="ad-work-list">${rows.map(x=>`<div class="ad-work-item"><label><input type="checkbox" data-ad-toggle-plan="${esc(x.id)}" ${x.done?'checked':''}><span>${esc(x.title)}</span></label><small>${esc(x.plan_date)}</small><button class="ad-mini" data-edit-work="plans" data-work-id="${esc(x.id)}">Править</button><button class="ad-mini" data-delete-work="plans" data-work-id="${esc(x.id)}">Удалить</button></div>`).join('')}</div>`:empty('Нет задач','Добавьте первую задачу.','schedule')}</section>`;}
  function goalsView(){return `${pageHeading('ЦЕЛИ / 02','Цели и прогресс<span class="ad-heading-period">.</span>','Ручные цели с числовым прогрессом, без искусственных прогнозов.')}
     <section class="ad-card"><div id="adWorkForm"></div><button class="ad-primary" data-add-work="goals">${icon('plus')} Добавить цель</button></section><div class="ad-goals-grid">${state.goals.map(x=>{const current=micro(x.current_value),target=micro(x.target),pct=target>0n?Number(current*100n/target):0;return `<article class="ad-card"><h3>${esc(x.title)}</h3><div class="ad-goal-value">${money(current)} / ${money(target)}</div><div class="ad-goal-track"><span style="width:${Math.max(0,Math.min(100,pct))}%"></span></div><small>${pct}%${x.due_date?' · до '+esc(x.due_date):''}</small><div class="ad-panel-actions"><button class="ad-mini" data-edit-work="goals" data-work-id="${esc(x.id)}">Править</button><button class="ad-mini" data-delete-work="goals" data-work-id="${esc(x.id)}">Удалить</button></div></article>`;}).join('')||empty('Нет целей','Добавьте личную цель.','overview')}</div>`;}
  function notesView(){return `${pageHeading('ЗАМЕТКИ / 02','Заметки трейдера<span class="ad-heading-period">.</span>','Мысли, наблюдения и контекст сигналов. Данные хранятся отдельно.')}
    <section class="ad-card"><div id="adWorkForm"></div><button class="ad-primary" data-add-work="notes">${icon('plus')} Новая заметка</button></section><div class="ad-goals-grid">${[...state.notes].sort((a,b)=>b.note_date.localeCompare(a.note_date)).map(x=>`<article class="ad-card"><small>${esc(x.note_date)}</small><h3>${esc(x.title||'Без названия')}</h3><p class="ad-note-body">${esc(x.body)}</p><div class="ad-panel-actions"><button class="ad-mini" data-edit-work="notes" data-work-id="${esc(x.id)}">Править</button><button class="ad-mini" data-delete-work="notes" data-work-id="${esc(x.id)}">Удалить</button></div></article>`).join('')||empty('Нет заметок','Создайте первую заметку.','overview')}</div>`;}
  function adminView(){
    if(!state.isAdmin)return empty('Нет доступа','Права администратора не подтверждены.','info');
    return `${pageHeading('АДМИНИСТРИРОВАНИЕ / 02','Прогресс участников<span class="ad-heading-period">.</span>','Только для администратора. Учтены пользователи без второго дневника. Финансовые сводки не заменяют проверку полной хронологии.')}
    <section class="ad-card">${section('Участники и результаты','Доступ проверяется на сервере; участники не видят данные друг друга.',`<button class="ad-secondary" id="adRefreshAdmin">Обновить</button>`)}
    <div id="adAdminResults">${adminResults()}</div></section>`;
  }
  function adminResults(){return state.adminRows.length?`<div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>Участник</th><th>Дневник 02</th><th>Сделки</th><th>Доход</th><th>Баланс</th><th>План</th><th>Цели</th><th>Обучение (из опубликованных)</th></tr></thead><tbody>${state.adminRows.map(u=>`<tr><td><strong>${esc(u.display_name||'Участник')}</strong><small class="ad-row-ref">${esc(u.email||'')}</small></td><td>${u.diary_started?esc(u.currency):'Не создан'}</td><td>${esc(u.trades_closed)} / ${esc(u.trades_total)}</td><td>${money(u.earned)} ${esc(u.currency)}</td><td>${money(u.available)} ${esc(u.currency)}</td><td>${esc(u.plans_done)} / ${esc(u.plans_total)}</td><td>${esc(u.goals_complete)} / ${esc(u.goals_total)}</td><td>${esc(u.learning_completed)} / ${esc(u.learning_total)}${Number(u.learning_total)>0?` (${Math.min(100,Math.round(100*Number(u.learning_completed)/Number(u.learning_total)))}%)`:""}</td></tr>`).join('')}</tbody></table></div>`:empty('Нажмите «Обновить»','Информация загружается только по запросу администратора.','overview');}
  async function loadAdminReport(){if(!state.isAdmin)return;
    const {data,error}=await getClient().rpc('ad_admin_overview_v4');
    if(error){announce(error.message||'Не удалось получить данные участников.',true);return;}
    state.adminRows=data||[];
    if(state.tab==='admin')$('#adAdminResults').innerHTML=adminResults();
  }
  function showWorkForm(kind,id=null){
    const table={'notes':'automated_diary_notes','plans':'automated_diary_plans','goals':'automated_diary_goals'}[kind];
    if(!table)return;
    const existing=id?state[kind].find(x=>x.id===id):null, today=zonedDay(new Date());
    const extra=kind==='notes'?`<label>Дата<input type="date" name="note_date" value="${esc(existing?.note_date||today)}" required></label><label>Текст<textarea name="body" rows="5" maxlength="12000">${esc(existing?.body||'')}</textarea></label>`:
      kind==='plans'?`<label>Дата задачи<input type="date" name="plan_date" value="${esc(existing?.plan_date||today)}" required></label><label class="ad-check"><input name="done" type="checkbox" ${existing?.done?'checked':''}> Выполнено</label>`:
      `<label>Цель / количество<input name="target" type="number" step="0.000001" min="0.000001" required value="${esc(existing?.target||'')}"></label><label>Текущий прогресс<input name="current_value" type="number" step="0.000001" min="0" required value="${esc(existing?.current_value||'0')}"></label><label>Дедлайн<input type="date" name="due_date" value="${esc(existing?.due_date||'')}"></label>`;
    $('#adWorkForm').innerHTML=formPanel(existing?'Редактирование':'Новая запись','Запись сохранится только в дневнике 02.',
      `<form id="adEditWorkForm" class="ad-form ad-inline-form"><label>Название<input name="title" maxlength="150" required value="${esc(existing?.title||'')}"></label>${extra}<button class="ad-primary" type="submit">Сохранить</button></form>`);
    $('#adEditWorkForm').onsubmit=async e=>{
      e.preventDefault();const form=e.currentTarget, f=new FormData(form);setBusy(form,true);
      try{
        const user=await requireUser();if(!user)return;
        const row={title:String(f.get('title')||'').trim()};
        if(!row.title)throw new Error('Введите название.');
        if(kind==='notes')Object.assign(row,{note_date:f.get('note_date'),body:f.get('body')||''});
        if(kind==='plans')Object.assign(row,{plan_date:f.get('plan_date'),done:!!f.get('done')});
        if(kind==='goals')Object.assign(row,{target:exactValue(f.get('target')),current_value:exactNonnegative(f.get('current_value')),due_date:f.get('due_date')||null});
        const call=existing?getClient().from(table).update({...row,updated_at:new Date().toISOString()}).eq('user_id',user.id).eq('id',existing.id).select('id').single():getClient().from(table).insert({...row,user_id:user.id}).select('id').single();
        const {error}=await call;if(error)throw error;await load();announce('Запись сохранена.');
      }catch(err){announce(err.message||'Ошибка сохранения.',true);}finally{setBusy(form,false);}
    };
  }
  async function deleteWork(kind,id){const table={'notes':'automated_diary_notes','plans':'automated_diary_plans','goals':'automated_diary_goals'}[kind];
    if(!table||!confirm('Удалить запись? Действие нельзя отменить.'))return;
    try{const user=await requireUser();if(!user)return;const {error}=await getClient().from(table).delete().eq('user_id',user.id).eq('id',id);if(error)throw error;await load();announce('Запись удалена.');}
    catch(err){announce(err.message||'Ошибка удаления.',true);}
  }
  function render() {
    if (!$('#adWorkspace') || $('#adWorkspace').hidden || !state.profile) return;
    $('#adPageTitle').textContent=titleByTab[state.tab] || 'Обзор';
    $$('.ad-tab',root).forEach(button => {
      const active = button.dataset.tab === state.tab;
      button.classList.toggle('active',active);
      if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
    });
    const views={dashboard,trades:tradesView,bonuses:bonusesView,schedule:scheduleView,calendar:calendarView,analytics:analyticsView,plans:plansView,goals:goalsView,notes:notesView,finance:financeView,admin:adminView,settings:settingsView};
    $('#adContent').innerHTML = (views[state.tab] || dashboard)();
    bindTabActions();
  }
  function openTab(tab, form = null) {
    if (!(tab in titleByTab)||(tab==='admin'&&!state.isAdmin)) return;
    state.tab = tab;
    state.openForm = form;
    render();
    if(tab==='admin')loadAdminReport();
    if(form === 'trade') $('#adAddTrade')?.click();
    root.scrollIntoView({behavior:'instant',block:'start'});
  }
  function refreshFilteredTrades() {
    $('#adTradesResults').innerHTML=tradeTable(filteredTrades());
    $('#adTradesCount').textContent=`Показано: ${filteredTrades().length} из ${state.trades.length}`;
    bindCloseButtons();
    $$('[data-ad-edit-trade]',root).forEach(b=>b.onclick=()=>showTradeForm(b.dataset.adEditTrade));
  }
  function refreshFilteredBonuses() {$('#adBonusResults').innerHTML=bonusResults();$$('[data-edit-bonus]',root).forEach(b=>b.onclick=()=>showBonusForm(b.dataset.editBonus));}
  function setBusy(form, value) {
    if(!form)return;
    $$('button[type="submit"], button:not([type])',form).forEach(b=>b.disabled=value);
  }
  function formPanel(name, subtitle, fields) {
    return `<section class="ad-card ad-entry-panel"><div class="ad-section-top"><div><span class="ad-kicker">НОВАЯ ЗАПИСЬ</span><h2>${name}</h2><p>${subtitle}</p></div><button type="button" class="ad-panel-close" data-cancel-form aria-label="Закрыть форму">×</button></div>${fields}</section>`;
  }
  function showTradeForm(editId=null) {
    const existing=editId?state.trades.find(x=>x.id===editId):null;
    if(editId&&!existing)return announce('Сделка не найдена.',true);
    const zone=state.profile.timezone;
    const suggested=(balance()*micro(state.profile.stake_percent??'2'))/(100n*SCALE);
    const value=existing?String(existing.stake):decimal(suggested>0n?suggested:1n);
    $('#adTradeForm').innerHTML=formPanel(existing?'Редактирование сделки':'Новая сделка',
       existing?'Изменения будут проверены по всей истории баланса и записаны в аудит.':'Создаётся независимая запись с точной секундой.',
       `<form id="adNewTradeForm" class="ad-form ad-inline-form"><label>Ставка<input name="stake" type="number" min="0.000001" step="0.000001" required value="${esc(value)}"></label>
        <label>Открыта (${esc(zone)})<input name="opened_at" type="datetime-local" step="1" required value="${existing?zoneInput(existing.opened_at,zone):nowInZoneInput(zone)}"></label>
        <label>Длительность, секунд<input name="duration_seconds" type="number" min="1" step="1" required value="${esc(existing?.duration_seconds||state.profile.duration_seconds||60)}"></label>
        <label>Описание<input name="note" maxlength="300" value="${esc(existing?.note||'')}" placeholder="Номер сигнала, комментарий"></label>
        ${existing?.status==='closed'?`<label>Полный возврат<input name="payout" type="number" min="0.000001" step="0.000001" required value="${esc(existing.payout)}"></label><label>Закрыта (${esc(zone)})<input name="closed_at" type="datetime-local" step="1" required value="${zoneInput(existing.closed_at,zone)}"></label>`:''}
        <p class="ad-form-hint">Финансовые исправления проверяются сервером. Если старые операции делают баланс отрицательным, сохранение отменится.</p>
        <button class="ad-primary" type="submit">${existing?'Сохранить исправления':'Открыть сделку'} ${icon('arrow')}</button></form>`);
    $('#adTradeForm').scrollIntoView({behavior:'smooth',block:'nearest'});
    const form=$('#adNewTradeForm');let req=newRequestId();
    form.addEventListener('input',()=>{req=newRequestId();});
    form.onsubmit=async event=>{
      event.preventDefault();const f=new FormData(form);setBusy(form,true);
      try{
        const stake=exactValue(f.get('stake')), opened=zonedIso(f.get('opened_at'),zone),duration=Number(f.get('duration_seconds'));
        if(!Number.isInteger(duration)||duration<1)throw new Error('Укажите длительность в целых секундах.');
        if(stamp(opened)>Date.now()+10000)throw new Error('Открытие в будущем недопустимо.');
        if(existing){
          const closed=existing.status==='closed'?zonedIso(f.get('closed_at'),zone):null;
          const payout=existing.status==='closed'?exactValue(f.get('payout')):null;
          await financeRpc('ad_edit_trade_v4',{p_id:existing.id,p_stake:stake,p_opened_at:opened,p_duration_seconds:duration,p_note:f.get('note')||'',p_closed_at:closed,p_payout:payout});
        }else await financeRpc('ad_open_trade_v2',{p_stake:stake,p_opened_at:opened,p_duration_seconds:duration,p_note:f.get('note')||'',p_request_id:req});
        await load();announce(existing?'Сделка исправлена; изменения сохранены в журнале.':'Сделка открыта; ставка зарезервирована.');
      }catch(error){announce(error.message||'Не удалось сохранить сделку.',true);}finally{setBusy(form,false);}
    };
  }
  function bindCloseButtons(){
    $$('[data-close-trade]',root).forEach(button=>button.onclick=()=>{
      const trade=state.trades.find(t=>t.id===button.dataset.closeTrade);
      if(!trade||trade.status!=='open')return;
      $('#adTradeCloseDialog')?.remove();
      const dlg=document.createElement('dialog');dlg.id='adTradeCloseDialog';dlg.className='ad-dialog';
      const stakeMicro=micro(trade.stake),profitMicro=stakeMicro*micro(state.profile.profit_percent??'40')/(100n*SCALE);
      const guess=decimal(stakeMicro+(profitMicro>0n?profitMicro:1n));
      dlg.innerHTML=`<form method="dialog" class="ad-close-form"><span class="ad-kicker">СДЕЛКА № ${esc(trade.id.slice(0,8))}</span><h2>Закрытие сделки</h2><p>Открыта: <strong>${humanDate(trade.opened_at)}</strong>. Ставка: <strong>${money(trade.stake)} ${currency()}</strong>. Запишите полный возврат <strong>ставка + прибыль</strong> и фактическое время закрытия.</p><label>Полный возврат<input name="payout" type="number" min="0.000001" step="0.000001" required value="${guess}"></label><label>Закрыта: дата · время до секунды<input name="closed_at" type="datetime-local" step="1" required value="${nowInZoneInput(state.profile.timezone)}"></label><div class="ad-dialog-actions"><button value="cancel" class="ad-secondary" formnovalidate>Отмена</button><button value="confirm" class="ad-primary">Закрыть именно эту сделку</button></div></form>`;
      root.appendChild(dlg);dlg.showModal();
      dlg.addEventListener('close',async()=>{
        const choice=dlg.returnValue, f=new FormData($('form',dlg));dlg.remove();
        if(choice!=='confirm')return;
        try{
          const payout=exactValue(f.get('payout'));
          if(micro(payout)<=micro(trade.stake))throw new Error('В этом дневнике все закрытые сделки прибыльные: полный возврат должен превышать ставку.');
          const closed=zonedIso(f.get('closed_at'),state.profile.timezone);
          if(stamp(closed)<stamp(trade.opened_at))throw new Error('Закрытие раньше открытия недопустимо.');
          await financeRpc('ad_close_trade_v2',{p_trade_id:trade.id,p_payout:payout,p_closed_at:closed});
          await load();announce('Закрыта только выбранная сделка. Возврат учтён один раз.');
        }catch(err){announce(err.message||'Ошибка закрытия сделки.',true);}
      },{once:true});
    });
  }
  function showBonusForm(editId=null) {
    const item=editId?state.bonuses.find(b=>b.id===editId):null;
    if(editId&&!item)return announce('Бонус не найден.',true);
    $('#adBonusForm').innerHTML=formPanel(item?'Исправить бонус':'Добавить бонус',
      'Все зачисления пересчитываются по фактической дате. История исправлений сохраняется.',
      `<form id="adNewBonusForm" class="ad-form ad-inline-form"><label>Название<input name="title" value="${esc(item?.title||'Бонусный мешочек')}" maxlength="120" required></label>
      <label>Сумма (4 знака)<input name="amount" type="number" min="0" step="0.0001" required value="${esc(item?.amount||'')}"></label>
      <label>Статус<select name="status">${[['received','Получен'],['pending','Ожидается'],['cancelled','Отменён']].map(([v,t])=>`<option value="${v}" ${item?.status===v?'selected':''}>${t}</option>`).join('')}</select></label>
      <label>Фактическая дата получения (${esc(state.profile.timezone)})<input name="received_at" type="datetime-local" step="1" value="${item?.received_at?zoneInput(item.received_at,state.profile.timezone):nowInZoneInput(state.profile.timezone)}"></label>
      <button class="ad-primary" type="submit">${item?'Сохранить исправление':'Добавить мешочек'}</button></form>`);
    const form=$('#adNewBonusForm');let req=newRequestId();form.addEventListener('input',()=>{req=newRequestId();});
    form.onsubmit=async e=>{e.preventDefault();const f=new FormData(form);setBusy(form,true);
      try{
        const amount=String(f.get('amount')||'').trim();
        if(!/^\d+(?:\.\d{1,4})?$/.test(amount))throw new Error('Сумма бонуса: не более 4 знаков после запятой.');
        const when=f.get('received_at')?zonedIso(f.get('received_at'),state.profile.timezone):null;
        await financeRpc('ad_save_bonus_v4',{p_id:item?.id||null,p_title:f.get('title'),p_amount:amount,p_status:f.get('status'),p_received_at:when,p_request_id:item?null:req});
        await load();announce(item?'Бонус изменён и пересчитан.':'Бонус сохранён.');
      }catch(err){announce(err.message||'Ошибка бонуса.',true);}finally{setBusy(form,false);}
    };
  }
  function showSignalForm(editId=null) {
    const item=editId?state.signals.find(s=>s.id===editId):null;
    if(editId&&!item)return announce('Сигнал не найден.',true);
    const scheduleDate=state.scheduleDay||zonedDay(new Date());
    const initial=state.scheduleDay&&state.scheduleDay!==zonedDay(new Date())?scheduleDate+'T12:00:00':nowInZoneInput(state.profile.timezone);
    $('#adSignalForm').innerHTML=formPanel(item?'Редактирование сигнала':'Новый сигнал',
      'Один сигнал = отдельное событие. Почтовые уведомления требуют серверного подключения.',
      `<form id="adNewSignalForm" class="ad-form ad-inline-form"><label>Название<input name="title" required maxlength="120" value="${esc(item?.title||'')}" placeholder="Сигнал №1"></label>
      <label>Тип события<select name="signal_type">${[['trade','Сделка'],['bonus','Бонус'],['other','Другое']].map(([v,t])=>`<option value="${v}" ${item?.signal_type===v?'selected':''}>${t}</option>`).join('')}</select></label>
      <label>Инструмент<input name="instrument" maxlength="80" placeholder="EUR/USD OTC" value="${esc(item?.instrument||'')}"></label>
      <label>Направление<select name="direction">${[['','Не указано'],['up','Вверх'],['down','Вниз'],['other','Иное']].map(([v,t])=>`<option value="${v}" ${item?.direction===v?'selected':''}>${t}</option>`).join('')}</select></label>
      <label>Дата и время (${esc(state.profile.timezone)})<input name="starts_at" type="datetime-local" step="1" required value="${item?zoneInput(item.starts_at,state.profile.timezone):initial}"></label>
      <label>Напомнить за, минут<input name="remind_minutes" type="number" min="0" max="10080" step="1" value="${esc(item?.remind_minutes??5)}" required></label>
      <label>Описание<textarea name="description" rows="2" maxlength="1000">${esc(item?.description||'')}</textarea></label>
      <label class="ad-check"><input name="enabled" type="checkbox" ${!item||item.enabled?'checked':''}> Сигнал активен</label>
      <button class="ad-primary" type="submit">${item?'Сохранить сигнал':'Добавить сигнал'}</button></form>`);
    const form=$('#adNewSignalForm');form.onsubmit=async e=>{
      e.preventDefault();const f=new FormData(form);setBusy(form,true);
      try{
        const user=await requireUser();if(!user)return;
        const row={title:String(f.get('title')).trim(),signal_type:f.get('signal_type'),starts_at:zonedIso(f.get('starts_at'),state.profile.timezone),
          instrument:f.get('instrument')||'',direction:f.get('direction')||'',description:f.get('description')||'',
          remind_minutes:Number(f.get('remind_minutes')),enabled:!!f.get('enabled')};
        if(!row.title||!Number.isInteger(row.remind_minutes)||row.remind_minutes<0||row.remind_minutes>10080)throw new Error('Проверьте название и время напоминания.');
        const call=item?getClient().from('automated_diary_signals').update(row).eq('user_id',user.id).eq('id',item.id).select('id').single():getClient().from('automated_diary_signals').insert({...row,user_id:user.id}).select('id').single();
        const {error}=await call;if(error)throw error;await load();announce(item?'Сигнал изменён.':'Сигнал добавлен.');
      }catch(err){announce(err.message||'Ошибка сохранения сигнала.',true);}finally{setBusy(form,false);}
    };
  }
  function toCsv(rows, filename) {
    const cells=rows.map(row=>row.map(x=>`"${String(x??'').replace(/"/g,'""')}"`).join(';'));
    const blob=new Blob(['\ufeff',cells.join('\r\n')],{type:'text/csv;charset=utf-8'});
    const link=document.createElement('a'),url=URL.createObjectURL(blob);link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function bindTabActions() {
    $$('[data-ad-range]',root).forEach(b=>b.onclick=()=>{state.range=b.dataset.adRange;render();});
    $$('[data-go]',root).forEach(b=>b.onclick=()=>openTab(b.dataset.go,b.dataset.open||null));
    $('#adAddTrade')?.addEventListener('click',()=>showTradeForm());
    $('#adTradeSearch')?.addEventListener('input',e=>{state.tradeSearch=e.target.value;refreshFilteredTrades();});
    $$('[data-trade-filter]',root).forEach(b=>b.onclick=()=>{state.tradeFilter=b.dataset.tradeFilter;render();});
    $('#adExportTrades')?.addEventListener('click',()=>{
      toCsv([['id','opened_at_utc','closed_at_utc','stake','total_return','earned','status','duration_seconds','note'],...filteredTrades().map(t=>[t.id,t.opened_at,t.closed_at,t.stake,t.payout,t.status==='closed'?decimal(profit(t)):'',t.status,t.duration_seconds,t.note])],'automated-diary-trades.csv');announce('CSV подготовлен.');
    });
    $('#adAddBonus')?.addEventListener('click',()=>showBonusForm());
    $$('[data-bonus-filter]',root).forEach(b=>b.onclick=()=>{state.bonusFilter=b.dataset.bonusFilter;render();});
    $('#adAddSignal')?.addEventListener('click',()=>showSignalForm());
    $('#adDaySelect')?.addEventListener('change',e=>{if(/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)){state.scheduleDay=e.target.value;render();}});
    $('#adDayToday')?.addEventListener('click',()=>{state.scheduleDay=zonedDay(new Date());render();});
    $$('[data-day-shift]',root).forEach(b=>b.addEventListener('click',()=>{
      const d=new Date(`${state.scheduleDay||zonedDay(new Date())}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate()+Number(b.dataset.dayShift));
      state.scheduleDay=d.toISOString().slice(0,10);render();
    }));
    $$('[data-cal-month]',root).forEach(b=>b.onclick=()=>{const [y,m]=state.calendarCursor.split('-').map(Number);const d=new Date(Date.UTC(y,m-1+Number(b.dataset.calMonth),1));state.calendarCursor=d.toISOString().slice(0,7);state.calendarDay=null;render();});
    $$('[data-cal-day]',root).forEach(b=>b.onclick=()=>{state.calendarDay=state.calendarDay===b.dataset.calDay?null:b.dataset.calDay;render();});
    $('[data-cal-reset]',root)?.addEventListener('click',()=>{state.calendarDay=null;render();});

    $$('[data-ad-edit-trade]',root).forEach(b=>b.onclick=()=>{if(state.tab!=='trades')openTab('trades');showTradeForm(b.dataset.adEditTrade);});
    $$('[data-edit-bonus]',root).forEach(b=>b.onclick=()=>showBonusForm(b.dataset.editBonus));
    $$('[data-edit-signal]',root).forEach(b=>b.onclick=()=>showSignalForm(b.dataset.editSignal));
    $$('[data-remove-signal]',root).forEach(b=>b.onclick=async()=>{
      if(!confirm('Удалить этот сигнал и отменить будущие напоминания?'))return;
      try{const user=await requireUser();if(!user)return;
        const {error}=await getClient().from('automated_diary_signals').delete().eq('id',b.dataset.removeSignal).eq('user_id',user.id);
        if(error)throw error;await load();announce('Сигнал удалён.');
      }catch(e){announce(e.message||'Не удалось удалить сигнал.',true);}
    });
    $$('[data-ad-week]',root).forEach(b=>b.onclick=()=>{state.scheduleDay=b.dataset.adWeek;render();});
    $('[data-calendar-schedule]',root)?.addEventListener('click',e=>{state.scheduleDay=e.currentTarget.dataset.calendarSchedule;openTab('schedule');});
    $('#adCopyDay')?.addEventListener('click',async()=>{
      const day=state.scheduleDay||zonedDay(new Date()),target=prompt('На какую дату скопировать расписание? (ГГГГ-ММ-ДД)',day);
      if(!target)return;if(!/^\d{4}-\d{2}-\d{2}$/.test(target)||target===day){announce('Укажите другую корректную дату.',true);return;}
      const src=state.signals.filter(s=>zonedDay(s.starts_at)===day);
      if(!src.length){announce('В выбранный день нет сигналов.',true);return;}
      if(!confirm(`Скопировать ${src.length} сигналов на ${target}?`))return;
      try{const user=await requireUser();if(!user)return;
        const rows=src.map(x=>({user_id:user.id,title:x.title,signal_type:x.signal_type,instrument:x.instrument||'',direction:x.direction||'',description:x.description||'',remind_minutes:x.remind_minutes,enabled:x.enabled,
          starts_at:zonedIso(`${target}T${zoneInput(x.starts_at,state.profile.timezone).slice(11)}`,state.profile.timezone)}));
        const {error}=await getClient().from('automated_diary_signals').insert(rows);if(error)throw error;
        state.scheduleDay=target;await load();announce('Дневное расписание скопировано.');
      }catch(err){announce(err.message||'Ошибка копирования.',true);}
    });
    $$('[data-add-work]',root).forEach(b=>b.onclick=()=>showWorkForm(b.dataset.addWork));
    $$('[data-edit-work]',root).forEach(b=>b.onclick=()=>showWorkForm(b.dataset.editWork,b.dataset.workId));
    $$('[data-delete-work]',root).forEach(b=>b.onclick=()=>deleteWork(b.dataset.deleteWork,b.dataset.workId));
    $$('[data-ad-toggle-plan]',root).forEach(b=>b.onchange=async()=>{
      try{const user=await requireUser();if(!user)return;
        const {error}=await getClient().from('automated_diary_plans').update({done:b.checked,updated_at:new Date().toISOString()}).eq('id',b.dataset.adTogglePlan).eq('user_id',user.id);
        if(error)throw error;await load();}catch(e){announce(e.message||'Ошибка.',true);}
    });
    $('#adRefreshAdmin')?.addEventListener('click',loadAdminReport);
    bindCloseButtons();
    $('#adNotify')?.addEventListener('click',async()=>{
      if(!('Notification' in window)){announce('Браузер не поддерживает уведомления.',true);return;}
      const permission=await Notification.requestPermission();
      announce(permission==='granted'?'Разрешено. Для напоминаний держите вкладку открытой.':'Разрешение не предоставлено.',permission!=='granted');
    });
    $('#adExportFinance')?.addEventListener('click',()=>{
      toCsv([['datetime_utc','type','change','available_after','currency','detail','legacy_time'],...financeRows().map(x=>[x.date,x.type,decimal(x.delta),decimal(x.cashAfter),state.profile.currency,x.detail,x.legacyTime?'created_at':''])],'automated-diary-finance.csv');announce('CSV подготовлен.');
    });
    $('#adEmailForm')?.addEventListener('submit',async e=>{
      e.preventDefault();const form=e.currentTarget;setBusy(form,true);
      try{await financeRpc('ad_set_email_v4',{p_enabled:!!new FormData(form).get('enabled')});await load();announce('Согласие на почтовые напоминания обновлено.');}
      catch(err){announce(err.message||'Не удалось изменить настройки писем.',true);}finally{setBusy(form,false);}
    });
    $('#adSettingsForm')?.addEventListener('submit',async e=>{
      e.preventDefault();const form=e.currentTarget,f=new FormData(form),patch={initial_balance:Number(f.get('initial_balance')).toFixed(6),currency:f.get('currency'),timezone:f.get('timezone'),duration_seconds:Number(f.get('duration_seconds')),stake_percent:Number(f.get('stake_percent')),profit_percent:Number(f.get('profit_percent'))};
      setBusy(form,true);try{
        await financeRpc('ad_update_profile_v2',{p_initial_balance:exactNonnegative(f.get('initial_balance')),p_currency:patch.currency,p_timezone:patch.timezone,p_duration_seconds:patch.duration_seconds,p_stake_percent:patch.stake_percent,p_profit_percent:patch.profit_percent});
        await load();announce('Настройки сохранены, хронология проверена.');
      }catch(err){announce(err.message||'Ошибка сохранения.',true);}finally{setBusy(form,false);}
    });
    $$('[data-edit-ledger]',root).forEach(b=>b.addEventListener('click',()=>showCashCorrection(b.dataset.editLedger)));
    $('#adLedgerForm')?.addEventListener('input',e=>{delete e.currentTarget.dataset.requestId;});
    $('#adLedgerForm')?.addEventListener('submit',async e=>{
      e.preventDefault();const form=e.currentTarget,f=new FormData(form);setBusy(form,true);
      try{const user=await requireUser();if(!user)return;
        const amount=exactValue(f.get('amount'));
        const operated=zonedIso(f.get('operated_at'),state.profile.timezone);
        await financeRpc('ad_record_cash_v2',{p_kind:f.get('kind'),p_amount:amount,p_operated_at:operated,p_note:f.get('note')||'',p_request_id:form.dataset.requestId||(form.dataset.requestId=newRequestId())});
        await load();announce('Финансовая операция записана с точным временем.');
      }catch(err){announce(err.message||'Ошибка сохранения.',true);}finally{setBusy(form,false);}
    });
    $('#adExportBackup')?.addEventListener('click',()=>{
      const data={export_version:4,created_at:new Date().toISOString(),profile:state.profile,trades:state.trades,
        bonuses:state.bonuses,signals:state.signals,ledger:state.ledger,plans:state.plans,goals:state.goals,notes:state.notes,
        revisions:{trades:state.tradeRevisions,bonuses:state.bonusRevisions,ledger:state.revisions,profiles:state.profileRevisions}};
      const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'});
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='trading-diary-02-backup.json';
      document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
      announce('JSON-копия второго дневника подготовлена.');
    });
    $('#adAudit')?.addEventListener('click',()=>{
      const issues=financialWarnings();
      $('#adAuditResult').textContent=issues.length?`Требует проверки: ${issues.join(' · ')}. Данные не изменены.`:`Локальная временная шкала проверена: ${state.trades.length} сделок, ${state.ledger.length} денежных операций. Облачная транзакционная проверка требует применённой SQL-миграции и живого теста.`;
    });
  }
  $('#adWizardForm')?.addEventListener('submit',async e=>{
    e.preventDefault();const form=e.currentTarget,f=new FormData(form);setBusy(form,true);
    try{const user=await requireUser();if(!user)return;
      const profile={user_id:user.id,initial_balance:Number(f.get('initial_balance')).toFixed(6),currency:f.get('currency'),timezone:f.get('timezone'),duration_seconds:Number(f.get('duration_seconds')),stake_percent:Number(f.get('stake_percent')),profit_percent:Number(f.get('profit_percent')),signals_enabled:f.get('signals_enabled')==='on'};
      const {error}=await getClient().from('automated_diary_profiles').insert(profile);if(error)throw error;await load();announce('Дневник настроен.');
    }catch(err){announce(err.message||'Ошибка создания. Проверьте SQL-миграцию.',true);}finally{setBusy(form,false);}
  });
  $$('.ad-tab',root).forEach(button=>button.addEventListener('click',()=>openTab(button.dataset.tab)));
  root.addEventListener('click',e=>{
    // This application is independent: do not let document-level handlers in the main
    // diary interpret identical-looking controls as main-diary actions.
    e.stopPropagation();
    const close=e.target.closest('[data-cancel-form]');
    if(close && root.contains(close)){close.closest('.ad-entry-panel')?.remove();return;}
    const chip=e.target.closest('[data-ad-set-theme]');
    if(chip && root.contains(chip)){setTheme(chip.dataset.adSetTheme);if(state.tab==='settings'&&state.profile)render();}
  });
  $('#adSwitchDiary')?.addEventListener('click',showChooser);
  $('#chooseMainDiary')?.addEventListener('click',()=>setMode('main'));
  $('#chooseAutomatedDiary')?.addEventListener('click',()=>setMode('automated'));
  document.addEventListener('auth:ready',()=>{if(state.mode==='automated'&&window.currentUser)load();});
  document.addEventListener('DOMContentLoaded',()=>{
    try {setTheme(localStorage.getItem(THEME_KEY) || 'obsidian');} catch {setTheme('obsidian');}
    const remembered=localStorage.getItem('tradingDiary_selectedStructure');
    if(remembered==='main'||remembered==='automated')setMode(remembered);else showChooser();
  });
  /* Browser-tab reminders only; no claim of background notification delivery. */
  setInterval(()=>{
    if(state.mode!=='automated'||!state.profile||!('Notification' in window)||Notification.permission!=='granted'||state.profile.signals_enabled===false)return;
    const now=Date.now();
    for(const s of state.signals){
      const when=new Date(s.starts_at).getTime(),start=when-num(s.remind_minutes)*60000;
      if(s.enabled&&now>=start&&now<=when+30000&&!sessionStorage.getItem('adnotified_'+s.id)){
        try{new Notification(s.title,{body:`Сигнал запланирован на ${new Date(when).toLocaleTimeString('ru-RU',{timeZone:state.profile.timezone})}`});sessionStorage.setItem('adnotified_'+s.id,'1');}
        catch(e){console.warn('Уведомление не доставлено:',e);}
      }
    }
  },15000);
})();
