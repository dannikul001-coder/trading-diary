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
    mode: '', profile: null, trades: [], bonuses: [], signals: [], ledger: [],
    tab: 'dashboard', theme: 'obsidian', range: 'all', loading: false,
    tradeSearch: '', tradeFilter: 'all', bonusFilter: 'all', openForm: null,
    calendarCursor: new Date().toISOString().slice(0,7), calendarDay: null
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const icon = name => `<svg class="ad-icon" aria-hidden="true"><use href="#ad-i-${name}"/></svg>`;
  const num = value => Number(value || 0);
  const money = (value, places = 6) => num(value).toLocaleString('ru-RU', {minimumFractionDigits: 0, maximumFractionDigits: places});
  const currency = () => esc(state.profile?.currency || 'USDT');
  const fmt = (value, places = 6) => `${money(value, places)} <span class="ad-unit">${currency()}</span>`;
  const signed = value => `${num(value) > 0 ? '+' : ''}${money(value)}`;
  const colorClass = value => num(value) > 0 ? 'ad-positive' : num(value) < 0 ? 'ad-negative' : 'ad-neutral';
  const titleByTab = {dashboard:'Обзор', trades:'Сделки', bonuses:'Бонусные мешочки', schedule:'Расписание', finance:'Финансы', settings:'Настройки'};
  const humanDate = value => {
    if (!value) return '—';
    try { return new Date(value).toLocaleString('ru-RU', {timeZone: state.profile?.timezone || 'UTC', day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'}); }
    catch { return '—'; }
  };
  const shortDate = value => {
    if (!value) return '—';
    try { return new Date(value).toLocaleDateString('ru-RU', {timeZone: state.profile?.timezone || 'UTC', day:'numeric', month:'short'}); }
    catch { return '—'; }
  };
  function zonedIso(value, zone) {
    const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!m) throw new Error('Укажите корректную дату и время.');
    const target = Date.UTC(+m[1], +m[2]-1, +m[3], +m[4], +m[5]);
    let guess = target;
    for (let i = 0; i < 4; i++) {
      const parts = new Intl.DateTimeFormat('en-GB', {timeZone:zone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'}).formatToParts(new Date(guess));
      const o = Object.fromEntries(parts.map(x => [x.type, x.value]));
      guess += target - Date.UTC(+o.year, +o.month-1, +o.day, +o.hour, +o.minute, +o.second);
    }
    return new Date(guess).toISOString();
  }
  function nowInZoneInput(zone) {
    const p = new Intl.DateTimeFormat('en-CA', {timeZone:zone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23'}).formatToParts(new Date());
    const o = Object.fromEntries(p.map(x => [x.type, x.value]));
    return `${o.year}-${o.month}-${o.day}T${o.hour}:${o.minute}`;
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
  async function query(table, userId) {
    const {data, error} = await getClient().from(table).select('*').eq('user_id', userId).order('created_at', {ascending:false});
    if (error) throw error;
    return data || [];
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
      [state.trades, state.bonuses, state.signals, state.ledger] = await Promise.all([
        'automated_diary_trades', 'automated_diary_bonuses', 'automated_diary_signals', 'automated_diary_ledger'
      ].map(table => query(table, user.id)));
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
  /* Existing account math, preserved. Available cash excludes stakes held open. */
  const deposited = () => state.ledger.filter(x => x.kind === 'deposit').reduce((sum,x) => sum + num(x.amount),0);
  const withdrawn = () => state.ledger.filter(x => x.kind === 'withdrawal').reduce((sum,x) => sum + num(x.amount),0);
  const bonusTotal = () => state.bonuses.filter(x => x.status === 'received').reduce((sum,x) => sum + num(x.amount),0);
  const reserved = () => state.trades.filter(x => x.status === 'open').reduce((sum,x) => sum + num(x.stake),0);
  const closedTrades = () => state.trades.filter(x => x.status === 'closed');
  const pnl = () => closedTrades().reduce((sum,x) => sum + num(x.payout) - num(x.stake),0);
  const balance = () => num(state.profile?.initial_balance) + deposited() - withdrawn() - state.trades.reduce((sum,x) => sum + num(x.stake),0) + closedTrades().reduce((sum,x) => sum + num(x.payout),0) + bonusTotal();
  const equity = () => balance() + reserved();
  const rangeStart = () => state.range === 'all' ? 0 : Date.now() - Number(state.range) * 86400000;
  function periodTrades() {return closedTrades().filter(t => new Date(t.closed_at || t.opened_at).getTime() >= rangeStart());}
  function periodStats() {
    const closed = periodTrades(), wins = closed.filter(t => num(t.payout) > num(t.stake)).length;
    const losses = closed.filter(t => num(t.payout) < num(t.stake)).length;
    const sum = closed.reduce((v,t) => v + num(t.payout) - num(t.stake),0);
    return {closed,wins,losses,draws:closed.length-wins-losses,winrate: closed.length ? wins / closed.length * 100 : 0, pnl:sum};
  }
  function maxDrawdown() {
    let peak = 0, running = 0, max = 0;
    for (const t of [...closedTrades()].sort((a,b) => new Date(a.closed_at) - new Date(b.closed_at))) {
      running += num(t.payout) - num(t.stake);
      peak = Math.max(peak, running);
      max = Math.max(max, peak - running);
    }
    return max;
  }
  function maxStreaks() {
    let w=0,l=0,mw=0,ml=0;
    for (const t of [...closedTrades()].sort((a,b) => new Date(a.closed_at)-new Date(b.closed_at))) {
      const diff = num(t.payout) - num(t.stake);
      w=diff>0?w+1:0; l=diff<0?l+1:0; mw=Math.max(mw,w); ml=Math.max(ml,l);
    }
    return {wins:mw,losses:ml};
  }
  function events() {
    return [
      ...closedTrades().map(t => ({date:t.closed_at || t.opened_at, amount:num(t.payout)-num(t.stake), label:'Сделка'})),
      ...state.ledger.map(t => ({date:t.created_at, amount:num(t.amount)*(t.kind==='withdrawal'?-1:1), label:t.kind==='deposit'?'Пополнение':'Вывод'})),
      ...state.bonuses.filter(t => t.status==='received').map(t => ({date:t.received_at || t.created_at, amount:num(t.amount), label:'Бонус'}))
    ].filter(t => Number.isFinite(new Date(t.date).getTime())).sort((a,b) => new Date(a.date)-new Date(b.date));
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
    return `<div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>Дата / время</th><th>Ставка</th><th>Возврат</th><th>Результат</th><th>Статус</th><th><span class="ad-sr-only">Действия</span></th></tr></thead><tbody>${rows.map(t => {
      const closed = t.status === 'closed', value = num(t.payout) - num(t.stake);
      return `<tr><td><span class="ad-table-date">${humanDate(t.opened_at)}</span>${!compact && t.note ? `<small class="ad-table-note" title="${esc(t.note)}">${esc(t.note)}</small>`:''}</td><td class="ad-numeric">${money(t.stake)}</td><td class="ad-numeric">${closed?money(t.payout):'—'}</td><td class="ad-numeric ${closed?colorClass(value):'ad-neutral'}">${closed?signed(value):'—'}</td><td><span class="ad-status ${closed?'ad-status-closed':'ad-status-open'}"><span class="ad-status-dot"></span>${closed?'Закрыта':'Открыта'}</span></td><td>${!closed?`<button class="ad-mini" data-close-trade="${esc(t.id)}">Закрыть</button>`:''}</td></tr>`;
    }).join('') || `<tr><td colspan="6" class="ad-table-empty">Пока нет сделок для отображения</td></tr>`}</tbody></table></div>`;
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
  function breakdownChart(labels, values, id) {
    const max=Math.max(0,...values.map(x=>Math.abs(x)));
    if(!values.some(x=>x!==0)) return empty('Недостаточно данных','Распределение появится после закрытия сделок.','trades');
    return `<div class="ad-breakdown" role="img" aria-label="Распределение реализованного P&L"><div class="ad-breakdown-bars">${labels.map((label,i)=>{
      const v=values[i], percent=max?Math.max(4,Math.abs(v)/max*100):0;
      return `<div class="ad-breakdown-col" title="${esc(label)}: ${esc(money(v))} ${currency()}"><strong class="${colorClass(v)}">${money(v,2)}</strong><div class="ad-breakdown-track"><span class="${v<0?'negative':''}" style="height:${percent}%"></span></div><small>${esc(label)}</small></div>`;
    }).join('')}</div></div>`;
  }
  function periodBreakdowns() {
    const stats=periodTrades();
    const hours=Array(4).fill(0), weekdays=Array(7).fill(0);
    for(const t of stats){
      const date=t.closed_at||t.opened_at, value=num(t.payout)-num(t.stake);
      hours[Math.min(3,Math.floor(hourInZone(date)/6))]+=value;
      weekdays[weekdayInZone(date)]+=value;
    }
    return `<div class="ad-layout-2 ad-layout-breakdown"><section class="ad-card">${section('Результаты по времени','Реализованный P&L по интервалам суток')}${breakdownChart(['00–06','06–12','12–18','18–24'],hours,'hour')}</section><section class="ad-card">${section('Результаты по дням','Реализованный P&L по дням недели')}${breakdownChart(['Пн','Вт','Ср','Чт','Пт','Сб','Вс'],weekdays,'day')}</section></div>`;
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
  function dashboard() {
    const stats = periodStats(), overall = closedTrades(), streaks = maxStreaks();
    const avgStake = state.trades.length ? state.trades.reduce((sum,t) => sum+num(t.stake),0)/state.trades.length : 0;
    const percent = num(state.profile.initial_balance) > 0 ? pnl()/num(state.profile.initial_balance)*100 : null;
    const scheduled = [...state.signals].filter(s => s.enabled && new Date(s.starts_at).getTime() >= Date.now()).sort((a,b) => new Date(a.starts_at)-new Date(b.starts_at)).slice(0,4);
    const recent = [...state.trades].sort((a,b) => new Date(b.opened_at)-new Date(a.opened_at)).slice(0,6);
    return `${pageHeading('АНАЛИТИКА / ВТОРОЙ ДНЕВНИК', 'Пульс вашей торговли<span class="ad-heading-period">.</span>', 'Ваши сделки, сигналы и движение капитала — в одном месте.', `<button type="button" class="ad-primary" data-go="trades" data-open="trade">${icon('plus')} Новая сделка</button>`)}
      <div class="ad-workspace-note">${icon('info')} <span>Вы находитесь во <strong>втором дневнике</strong>. Все показатели рассчитаны только по его данным.</span></div>
      <div class="ad-kpi-grid ad-kpi-primary">
        ${metric('ДОСТУПНЫЙ БАЛАНС',fmt(balance()),`Зарезервировано: ${money(reserved())} ${currency()}`,'','ad-metric-accent')}
        ${metric('РЕАЛИЗОВАННЫЙ P&L',fmt(pnl()),`По ${overall.length} закрытым сделкам`,colorClass(pnl()))}
        ${metric('ТОРГОВАЯ ДОХОДНОСТЬ',percent===null?'—':`${signed(percent)}%`,'P&L / начальный баланс',colorClass(percent))}
        ${metric('WIN RATE',overall.length?`${money(overall.filter(t=>num(t.payout)>num(t.stake)).length/overall.length*100,1)}%`:'—',`${overall.length} закрытых сделок`)}
      </div>
      <div class="ad-kpi-grid ad-kpi-secondary">
        ${metric('ВСЕГО СДЕЛОК',money(state.trades.length),`${overall.length} закрыто`)}
        ${metric('ОТКРЫТО',money(state.trades.filter(t=>t.status==='open').length),'Ставки в резерве')}
        ${metric('БОНУСНЫЙ ДОХОД',fmt(bonusTotal(),4),'Только полученные бонусы')}
        ${metric('СРЕДНЯЯ СТАВКА',fmt(avgStake),'По всем сделкам')}
        ${metric('МАКС. ПРОСАДКА',fmt(maxDrawdown()),'По торговому P&L')}
        ${metric('ЛУЧШАЯ СЕРИЯ',`${streaks.wins} <span class="ad-unit">W</span> / ${streaks.losses} <span class="ad-unit">L</span>`,'Макс. побед / поражений')}
      </div>
      <div class="ad-layout-2 ad-layout-chart">
        <section class="ad-card ad-chart-card">${section('Динамика капитала','Реализованные сделки, бонусы и денежные операции', periodToggle())}${buildEquityChart()}</section>
        <section class="ad-card ad-performance-card">${section('Срез результатов','Закрытые сделки за выбранный период')}<div class="ad-performance-score"><div><span>ТОРГОВЫЙ P&L</span><strong class="${colorClass(stats.pnl)}">${signed(stats.pnl)} <small>${currency()}</small></strong></div><div><span>WIN RATE</span><strong>${stats.closed.length?money(stats.winrate,1)+'%':'—'}</strong></div></div><div class="ad-results-bar" role="img" aria-label="Победы ${stats.wins}, поражения ${stats.losses}, возвраты ${stats.draws}">${stats.closed.length?`<span class="ad-result-win" style="width:${stats.wins/stats.closed.length*100}%"></span><span class="ad-result-loss" style="width:${stats.losses/stats.closed.length*100}%"></span><span class="ad-result-draw" style="width:${stats.draws/stats.closed.length*100}%"></span>`:''}</div><div class="ad-result-legend"><span><i class="ad-dot ad-dot-win"></i>Победы <b>${stats.wins}</b></span><span><i class="ad-dot ad-dot-loss"></i>Поражения <b>${stats.losses}</b></span><span><i class="ad-dot ad-dot-draw"></i>Возвраты <b>${stats.draws}</b></span></div><div class="ad-performance-bottom">Доходность и процент побед не гарантируют будущих результатов.</div></section>
      </div>
      ${periodBreakdowns()}
      <div class="ad-layout-2 ad-layout-lower"><section class="ad-card">${section('Последние сделки','Актуальная история торгов',`<button type="button" class="ad-text-btn" data-go="trades">Все сделки ${icon('arrow')}</button>`)}${recent.length?tradeTable(recent,true):empty('Сделок пока нет','Добавьте первую сделку, чтобы видеть историю и статистику.','trades')}</section>
      <section class="ad-card">${section('Ближайшие сигналы','Запланированные события',`<button type="button" class="ad-text-btn" data-go="schedule">Расписание ${icon('arrow')}</button>`)}${scheduled.length?`<div class="ad-timeline">${scheduled.map(s=>`<div class="ad-timeline-item"><span class="ad-timeline-line"></span><span class="ad-timeline-day">${shortDate(s.starts_at)}</span><div><strong>${esc(s.title)}</strong><small>${humanDate(s.starts_at)} · ${esc(signalName(s.signal_type))}</small></div><span class="ad-status ad-status-open">План</span></div>`).join('')}</div>`:empty('Нет ближайших сигналов','Создайте событие, чтобы оно появилось здесь.','schedule')}</section></div>`;
  }
  function tradesView() {
    const open = state.trades.filter(t => t.status==='open').length;
    return `${pageHeading('ЖУРНАЛ / TRADES','История сделок<span class="ad-heading-period">.</span>','Все открытые и завершённые сделки этого дневника.',`<button class="ad-primary" id="adAddTrade">${icon('plus')} Новая сделка</button>`)}
      <div class="ad-stat-strip"><div><small>ВСЕГО СДЕЛОК</small><strong>${state.trades.length}</strong></div><div><small>ОТКРЫТО</small><strong>${open}</strong></div><div><small>ЗАКРЫТО</small><strong>${closedTrades().length}</strong></div><div><small>В РЕЗЕРВЕ</small><strong>${fmt(reserved())}</strong></div></div>
      <div id="adTradeForm"></div><section class="ad-card">${section('Журнал операций','Суммы отображаются с точностью до 6 знаков.')}
      <div class="ad-toolbar"><label class="ad-search"><span class="ad-sr-only">Поиск по заметкам</span><input id="adTradeSearch" type="search" placeholder="Поиск по заметкам…" value="${esc(state.tradeSearch)}"></label><div class="ad-filter-buttons" role="group" aria-label="Фильтр сделок">${[['all','Все'],['open','Открытые'],['closed','Закрытые']].map(([id,l])=>`<button type="button" data-trade-filter="${id}" class="${state.tradeFilter===id?'active':''}" aria-pressed="${state.tradeFilter===id}">${l}</button>`).join('')}</div><button id="adExportTrades" class="ad-secondary">Экспорт CSV</button></div>
      <div id="adTradesResults">${tradeTable(filteredTrades())}</div><div class="ad-table-footer" id="adTradesCount">Показано: ${filteredTrades().length} из ${state.trades.length}</div></section>`;
  }
  function filteredTrades() {
    const q=state.tradeSearch.toLocaleLowerCase('ru').trim();
    return state.trades.filter(t => (state.tradeFilter==='all'||t.status===state.tradeFilter)&&(!q||String(t.note||'').toLocaleLowerCase('ru').includes(q))).sort((a,b)=>new Date(b.opened_at)-new Date(a.opened_at));
  }
  function bonusesView() {
    const received=state.bonuses.filter(b=>b.status==='received').length;
    return `${pageHeading('БОНУСЫ / REWARDS','Бонусные мешочки<span class="ad-heading-period">.</span>','Учитывайте дополнительные поступления отдельно от торговой прибыли.',`<button class="ad-primary" id="adAddBonus">${icon('plus')} Добавить бонус</button>`)}
      <div class="ad-stat-strip"><div><small>ПОЛУЧЕНО БОНУСОВ</small><strong>${fmt(bonusTotal(),4)}</strong></div><div><small>ЗАЧИСЛЕНО</small><strong>${received}</strong></div><div><small>ОЖИДАЕТ</small><strong>${state.bonuses.filter(b=>b.status==='pending').length}</strong></div><div><small>ВСЕГО ЗАПИСЕЙ</small><strong>${state.bonuses.length}</strong></div></div>
      <div id="adBonusForm"></div><section class="ad-card">${section('История бонусов','Бонусы не включаются в торговый P&L.')}
      <div class="ad-toolbar"><div class="ad-filter-buttons" role="group" aria-label="Статус бонусов">${[['all','Все'],['received','Полученные'],['pending','Ожидающие'],['cancelled','Отменённые']].map(([id,l])=>`<button type="button" data-bonus-filter="${id}" class="${state.bonusFilter===id?'active':''}" aria-pressed="${state.bonusFilter===id}">${l}</button>`).join('')}</div></div><div id="adBonusResults">${bonusResults()}</div></section>`;
  }
  function bonusResults() {
    const rows = state.bonuses.filter(b=>state.bonusFilter==='all'||b.status===state.bonusFilter).sort((a,b)=>new Date(b.received_at||b.created_at)-new Date(a.received_at||a.created_at));
    if(!rows.length)return empty('Бонусов не найдено','Добавьте бонус или измените выбранный фильтр.','bonuses');
    return `<div class="ad-bonus-list">${rows.map(b=>`<div class="ad-bonus-item"><span class="ad-bonus-symbol">${icon('bonuses')}</span><div class="ad-bonus-name"><strong>${esc(b.title||'Бонусный мешочек')}</strong><small>${humanDate(b.received_at||b.created_at)}</small></div><strong class="ad-bonus-value">${fmt(b.amount,4)}</strong><span class="ad-status ${b.status==='received'?'ad-status-closed':b.status==='pending'?'ad-status-open':'ad-status-muted'}">${({received:'Получен',pending:'Ожидается',cancelled:'Отменён'})[b.status]||esc(b.status)}</span></div>`).join('')}</div>`;
  }
  const signalName = x => ({trade:'Сделка',bonus:'Бонус',other:'Другое'})[x] || String(x);
  function scheduleView() {
    const enabled = state.signals.filter(s=>s.enabled).length;
    const listing = [...state.signals].filter(s=>!state.calendarDay||zonedDay(s.starts_at)===state.calendarDay).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at));
    return `${pageHeading('СИГНАЛЫ / CALENDAR','План сигналов<span class="ad-heading-period">.</span>','Контролируйте расписание и время запланированных событий.',`<button class="ad-primary" id="adAddSignal">${icon('plus')} Новый сигнал</button>`)}
      <div class="ad-stat-strip"><div><small>ВСЕГО СОБЫТИЙ</small><strong>${state.signals.length}</strong></div><div><small>АКТИВНЫХ</small><strong>${enabled}</strong></div><div><small>БЛИЖАЙШИЕ</small><strong>${state.signals.filter(s=>s.enabled&&new Date(s.starts_at).getTime()>Date.now()).length}</strong></div><div><small>ЧАСОВОЙ ПОЯС</small><strong class="ad-timezone">${esc(state.profile.timezone)}</strong></div></div>
      <div id="adSignalForm"></div><div class="ad-layout-2 ad-layout-schedule"><section class="ad-card">${section('Календарь сигналов','Выберите день для фильтрации расписания')}${calendarWidget()}</section>
      <section class="ad-card ad-instruction-card">${section('Уведомления','Доставка зависит от возможностей браузера')}<div class="ad-notification-icon">${icon('schedule')}</div><h3>Будьте в курсе событий</h3><p>В этой версии напоминания показываются <strong>только при открытой вкладке</strong> и разрешённых уведомлениях браузера. Фоновая доставка пока не подключена.</p><button class="ad-secondary" id="adNotify">Разрешить уведомления</button><div class="ad-inline-alert">${icon('info')} Разрешение браузера не означает, что уведомление уже доставлено.</div></section></div>
      <section class="ad-card">${section(state.calendarDay?`События за ${esc(state.calendarDay)}`:'Все события', 'Запланированные и прошедшие сигналы')}
      ${listing.length?`<div class="ad-signal-list">${listing.map(s=>`<div class="ad-signal-item"><div class="ad-signal-date"><strong>${shortDate(s.starts_at)}</strong><span>${new Date(s.starts_at).toLocaleTimeString('ru-RU',{timeZone:state.profile.timezone,hour:'2-digit',minute:'2-digit'})}</span></div><div class="ad-signal-title"><strong>${esc(s.title)}</strong><small>${esc(signalName(s.signal_type))} · Напоминание за ${Math.max(0,num(s.remind_minutes))} мин.</small></div><span class="ad-status ${s.enabled?'ad-status-open':'ad-status-muted'}">${s.enabled?'Включён':'Выключен'}</span></div>`).join('')}</div>`:empty('Событий не найдено',state.calendarDay?'Выберите другой день или сбросьте фильтр.':'Создайте первый сигнал и выберите время.','schedule')}</section>`;
  }
  function financeRows() {
    const items = [
      ...state.ledger.map(x=>({...x,type:x.kind==='deposit'?'Пополнение':'Вывод',amount:num(x.amount)*(x.kind==='withdrawal'?-1:1),date:x.created_at,detail:x.note||'Финансовая операция'})),
      ...closedTrades().map(x=>({type:'Результат сделки',amount:num(x.payout)-num(x.stake),date:x.closed_at||x.opened_at,detail:'Реализованный P&L'})),
      ...state.bonuses.filter(x=>x.status==='received').map(x=>({type:'Бонус',amount:num(x.amount),date:x.received_at||x.created_at,detail:x.title||'Бонусный мешочек'}))
    ];
    return items.sort((a,b)=>new Date(b.date)-new Date(a.date));
  }
  function financeView() {
    const rows=financeRows();
    return `${pageHeading('КАПИТАЛ / CASH FLOW','Движение средств<span class="ad-heading-period">.</span>','Отделяйте пополнения, выводы и бонусы от торгового результата.',`<button type="button" class="ad-secondary" id="adExportFinance">Экспорт CSV</button>`)}
      <div class="ad-kpi-grid ad-kpi-primary ad-kpi-finance">${metric('ДОСТУПНЫЙ БАЛАНС',fmt(balance()),`Резерв: ${money(reserved())} ${currency()}`,'','ad-metric-accent')}${metric('КАПИТАЛ С РЕЗЕРВОМ',fmt(equity()),'Баланс + открытые ставки')}${metric('ПОПОЛНЕНИЯ',fmt(deposited()),'Без торговых поступлений')}${metric('ВЫВОДЫ',fmt(withdrawn()),'Без торговых списаний')}</div>
      <div class="ad-layout-2 ad-layout-finance"><section class="ad-card">${section('Новая операция','Пополнение или вывод средств')}<form id="adLedgerForm" class="ad-form ad-finance-form"><label>Тип операции<select name="kind"><option value="deposit">Пополнение</option><option value="withdrawal">Вывод</option></select></label><label>Сумма<input name="amount" type="number" step="0.000001" min="0.000001" required placeholder="0.000000"></label><label class="ad-full">Комментарий<input name="note" maxlength="200" placeholder="Необязательно"></label><button class="ad-primary" type="submit">Сохранить операцию ${icon('arrow')}</button></form></section>
      <section class="ad-card ad-finance-help">${section('Структура баланса','Без двойного учёта')}<div class="ad-finance-breakdown"><div><span>Начальный баланс</span><strong>${fmt(state.profile.initial_balance)}</strong></div><div><span>Пополнения − выводы</span><strong class="${colorClass(deposited()-withdrawn())}">${fmt(deposited()-withdrawn())}</strong></div><div><span>Торговый P&L</span><strong class="${colorClass(pnl())}">${fmt(pnl())}</strong></div><div><span>Полученные бонусы</span><strong>${fmt(bonusTotal(),4)}</strong></div><div class="ad-finance-total"><span>Капитал с резервом</span><strong>${fmt(equity())}</strong></div></div></section></div>
      <section class="ad-card">${section('Лента финансовых событий','Результаты закрытых сделок, полученные бонусы и пополнения/выводы')}${rows.length?`<div class="ad-finance-list">${rows.map(x=>`<div class="ad-finance-item"><div class="ad-finance-item-icon">${icon(x.type==='Результат сделки'?'trades':x.type==='Бонус'?'bonuses':'finance')}</div><div class="ad-finance-item-label"><strong>${esc(x.type)}</strong><small>${esc(x.detail)} · ${humanDate(x.date)}</small></div><strong class="${colorClass(x.amount)}">${signed(x.amount)} <span class="ad-unit">${currency()}</span></strong></div>`).join('')}</div>`:empty('Операций пока нет','Здесь появится движение средств, когда вы добавите запись.','finance')}</section>`;
  }
  function settingsView() {
    return `${pageHeading('ПРОСТРАНСТВО / PERSONALIZE','Настройки дневника<span class="ad-heading-period">.</span>','Персонализируйте внешний вид и параметры автоматических сигналов.')}
      <section class="ad-card ad-settings-card">${section('Тема оформления','Меняется только внешний вид второго дневника')}<div class="ad-theme-gallery">${[['obsidian','Obsidian','Графит, изумруд, глубокий контраст'],['ivory','Ivory','Светлая палитра, спокойная аналитика'],['neon','Neon','Ночной синий, бирюза и фиолетовый']].map(([id,name,desc])=>`<button type="button" class="ad-theme-preview ${state.theme===id?'selected':''}" data-ad-set-theme="${id}" aria-pressed="${state.theme===id}"><span class="ad-theme-art ad-theme-art-${id}"><span class="ad-art-sidebar"></span><span class="ad-art-card"></span><span class="ad-art-card-small"></span><span class="ad-art-chart"></span></span><strong>${name}${state.theme===id?` ${icon('check')}`:''}</strong><small>${desc}</small></button>`).join('')}</div></section>
      <section class="ad-card ad-settings-card">${section('Торговые параметры','Настройки относятся только к дневнику сигналов')}<form id="adSettingsForm" class="ad-form"><label>Начальный баланс<input name="initial_balance" type="number" step="0.000001" min="0" required value="${esc(state.profile.initial_balance)}"></label><label>Валюта<select name="currency">${['USDT','USD','EUR','BTC'].map(x=>`<option ${state.profile.currency===x?'selected':''}>${x}</option>`).join('')}</select></label><label>Часовой пояс<select name="timezone">${['Europe/Moscow','Europe/Stockholm','UTC','Europe/London','America/New_York','Asia/Dubai'].map(x=>`<option ${state.profile.timezone===x?'selected':''}>${x}</option>`).join('')}</select></label><label>Длительность сделки, сек.<input name="duration_seconds" type="number" min="1" step="1" required value="${esc(state.profile.duration_seconds ?? 60)}"></label><label>Ставка от баланса, %<input name="stake_percent" type="number" min="0.000001" step="0.000001" required value="${esc(state.profile.stake_percent ?? 2)}"></label><label>Ожидаемая прибыль от ставки, %<input name="profit_percent" type="number" min="0" step="0.000001" required value="${esc(state.profile.profit_percent ?? 40)}"></label><button class="ad-primary" type="submit">Сохранить настройки ${icon('check')}</button></form><div class="ad-inline-alert">${icon('info')} Изменение начального баланса повлияет на расчёты. Проверьте сумму перед сохранением.</div></section>
      <section class="ad-card ad-settings-card">${section('Целостность данных','Проверка только читает записи — ничего не удаляет')}<div class="ad-settings-audit"><div><strong>Локальная проверка сделок</strong><p>Проверяем отрицательные ставки и некорректные выплаты в уже загруженных записях. Это не полный аудит Supabase.</p></div><button class="ad-secondary" id="adAudit">Проверить записи</button></div><div class="ad-audit-result" id="adAuditResult" role="status"></div></section>`;
  }
  function render() {
    if (!$('#adWorkspace') || $('#adWorkspace').hidden || !state.profile) return;
    $('#adPageTitle').textContent=titleByTab[state.tab] || 'Обзор';
    $$('.ad-tab',root).forEach(button => {
      const active = button.dataset.tab === state.tab;
      button.classList.toggle('active',active);
      if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
    });
    const views={dashboard,trades:tradesView,bonuses:bonusesView,schedule:scheduleView,finance:financeView,settings:settingsView};
    $('#adContent').innerHTML = (views[state.tab] || dashboard)();
    bindTabActions();
  }
  function openTab(tab, form = null) {
    if (!(tab in titleByTab)) return;
    state.tab = tab;
    state.openForm = form;
    render();
    if(form === 'trade') $('#adAddTrade')?.click();
    root.scrollIntoView({behavior:'instant',block:'start'});
  }
  function refreshFilteredTrades() {
    $('#adTradesResults').innerHTML=tradeTable(filteredTrades());
    $('#adTradesCount').textContent=`Показано: ${filteredTrades().length} из ${state.trades.length}`;
    bindCloseButtons();
  }
  function refreshFilteredBonuses() {$('#adBonusResults').innerHTML=bonusResults();}
  function setBusy(form, value) {
    if(!form)return;
    $$('button[type="submit"], button:not([type])',form).forEach(b=>b.disabled=value);
  }
  function formPanel(name, subtitle, fields) {
    return `<section class="ad-card ad-entry-panel"><div class="ad-section-top"><div><span class="ad-kicker">НОВАЯ ЗАПИСЬ</span><h2>${name}</h2><p>${subtitle}</p></div><button type="button" class="ad-panel-close" data-cancel-form aria-label="Закрыть форму">×</button></div>${fields}</section>`;
  }
  function showTradeForm() {
    const zone = state.profile.timezone;
    const suggested = Math.max(0.000001, balance()*num(state.profile.stake_percent || 2)/100);
    $('#adTradeForm').innerHTML = formPanel('Открытие сделки','Ставка будет зарезервирована до закрытия.',`<form id="adNewTradeForm" class="ad-form ad-inline-form"><label>Ставка<input name="stake" type="number" min="0.000001" step="0.000001" required value="${suggested.toFixed(6)}"></label><label>Время открытия<input name="opened_at" type="datetime-local" required value="${nowInZoneInput(zone)}"></label><label>Длительность, сек.<input name="duration_seconds" type="number" min="1" step="1" required value="${esc(state.profile.duration_seconds||60)}"></label><label>Заметка<input name="note" maxlength="200" placeholder="Контекст сделки"></label><button class="ad-primary" type="submit">Открыть сделку ${icon('arrow')}</button></form>`);
    $('#adTradeForm').scrollIntoView({behavior:'smooth',block:'nearest'});
    $('#adNewTradeForm').onsubmit = async e => {
      e.preventDefault();const form=e.currentTarget, f=new FormData(form), stake=Number(f.get('stake'));
      if(!Number.isFinite(stake)||stake<=0||stake>balance()){announce('Ставка должна быть больше нуля и не превышать доступный баланс.',true);return;}
      setBusy(form,true);
      try {const user=await requireUser();if(!user)return;
        const {error}=await getClient().from('automated_diary_trades').insert({user_id:user.id,stake:stake.toFixed(6),opened_at:zonedIso(f.get('opened_at'),zone),duration_seconds:Number(f.get('duration_seconds')),note:f.get('note')||'',status:'open'});
        if(error)throw error;await load();announce('Сделка открыта.');
      } catch(err){announce(err.message||'Не удалось открыть сделку.',true);}finally{setBusy(form,false);}
    };
  }
  function bindCloseButtons() {
    $$('[data-close-trade]',root).forEach(button=>button.onclick=()=>{
      const trade=state.trades.find(t=>t.id===button.dataset.closeTrade);
      if (!trade || trade.status!=='open')return;
      $('#adTradeCloseDialog')?.remove();
      const dlg=document.createElement('dialog');dlg.id='adTradeCloseDialog';dlg.className='ad-dialog';
      dlg.innerHTML=`<form method="dialog" class="ad-close-form"><span class="ad-kicker">ЗАВЕРШЕНИЕ СДЕЛКИ</span><h2>Закрыть сделку</h2><p>Укажите полный возврат, включая ставку и прибыль. Если сделка убыточна, введите 0.</p><label>Сумма возврата<input name="payout" type="number" min="0" step="0.000001" required value="${(num(trade.stake)*(1+num(state.profile.profit_percent||40)/100)).toFixed(6)}"></label><div class="ad-dialog-actions"><button value="cancel" class="ad-secondary" formnovalidate>Отмена</button><button value="confirm" class="ad-primary">Подтвердить закрытие</button></div></form>`;
      root.appendChild(dlg);dlg.showModal();
      dlg.addEventListener('close',async()=>{
        const result=dlg.returnValue, field=$('[name="payout"]',dlg);
        const val=field?.value; dlg.remove(); if(result!=='confirm')return;
        if(!/^\d+(\.\d{1,6})?$/.test(val)||Number(val)<0){announce('Введите сумму от 0 с точностью до 6 знаков.',true);return;}
        try{const {data,error}=await getClient().from('automated_diary_trades').update({status:'closed',payout:Number(val).toFixed(6),closed_at:new Date().toISOString()}).eq('id',trade.id).eq('status','open').select();
          if(error)throw error; if(!data?.length){announce('Сделка уже закрыта в другом окне.',true);return;}await load();announce('Сделка закрыта.');
        }catch(err){announce(err.message||'Ошибка закрытия сделки.',true);}
      },{once:true});
    });
  }
  function showBonusForm() {
    $('#adBonusForm').innerHTML=formPanel('Новый бонус','Полученные бонусы увеличивают доступный баланс.',`<form id="adNewBonusForm" class="ad-form ad-inline-form"><label>Название<input name="title" value="Бонусный мешочек" maxlength="120" required></label><label>Сумма<input name="amount" type="number" min="0.0001" step="0.0001" required placeholder="0.0000"></label><label>Дата получения<input name="received_at" type="datetime-local" required value="${nowInZoneInput(state.profile.timezone)}"></label><button class="ad-primary" type="submit">Сохранить бонус ${icon('arrow')}</button></form>`);
    $('#adNewBonusForm').onsubmit=async e=>{
      e.preventDefault();const form=e.currentTarget,f=new FormData(form);setBusy(form,true);
      try{const u=await requireUser();if(!u)return;
        const {error}=await getClient().from('automated_diary_bonuses').insert({user_id:u.id,title:f.get('title'),amount:Number(f.get('amount')).toFixed(4),status:'received',received_at:zonedIso(f.get('received_at'),state.profile.timezone)});
        if(error)throw error;await load();announce('Бонус добавлен.');
      }catch(err){announce(err.message||'Не удалось создать бонус.',true);}finally{setBusy(form,false);}
    };
  }
  function showSignalForm() {
    $('#adSignalForm').innerHTML=formPanel('Новый сигнал','Сохраните событие в расписании.',`<form id="adNewSignalForm" class="ad-form ad-inline-form"><label>Название<input name="title" required maxlength="120" placeholder="Сигнал на сделку"></label><label>Тип события<select name="signal_type"><option value="trade">Сделка</option><option value="bonus">Бонус</option><option value="other">Другое</option></select></label><label>Дата и время (${esc(state.profile.timezone)})<input name="starts_at" type="datetime-local" required value="${nowInZoneInput(state.profile.timezone)}"></label><label>Напоминание за, минут<input name="remind_minutes" type="number" min="0" step="1" value="5" required></label><button class="ad-primary" type="submit">Добавить сигнал ${icon('arrow')}</button></form>`);
    $('#adNewSignalForm').onsubmit=async e=>{
      e.preventDefault();const form=e.currentTarget,f=new FormData(form);setBusy(form,true);
      try{const u=await requireUser();if(!u)return;
        const {error}=await getClient().from('automated_diary_signals').insert({user_id:u.id,title:f.get('title'),signal_type:f.get('signal_type'),starts_at:zonedIso(f.get('starts_at'),state.profile.timezone),remind_minutes:Number(f.get('remind_minutes')),enabled:true});
        if(error)throw error;await load();announce('Сигнал добавлен.');
      }catch(err){announce(err.message||'Не удалось создать сигнал.',true);}finally{setBusy(form,false);}
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
    $('#adAddTrade')?.addEventListener('click',showTradeForm);
    $('#adTradeSearch')?.addEventListener('input',e=>{state.tradeSearch=e.target.value;refreshFilteredTrades();});
    $$('[data-trade-filter]',root).forEach(b=>b.onclick=()=>{state.tradeFilter=b.dataset.tradeFilter;render();});
    $('#adExportTrades')?.addEventListener('click',()=>{
      toCsv([['id','opened_at','closed_at','stake','payout','pnl','status','duration_seconds','note'],...filteredTrades().map(t=>[t.id,t.opened_at,t.closed_at,t.stake,t.payout,t.status==='closed'?(num(t.payout)-num(t.stake)).toFixed(6):'',t.status,t.duration_seconds,t.note])],'automated-diary-trades.csv');announce('CSV подготовлен.');
    });
    $('#adAddBonus')?.addEventListener('click',showBonusForm);
    $$('[data-bonus-filter]',root).forEach(b=>b.onclick=()=>{state.bonusFilter=b.dataset.bonusFilter;render();});
    $('#adAddSignal')?.addEventListener('click',showSignalForm);
    $$('[data-cal-month]',root).forEach(b=>b.onclick=()=>{const [y,m]=state.calendarCursor.split('-').map(Number);const d=new Date(Date.UTC(y,m-1+Number(b.dataset.calMonth),1));state.calendarCursor=d.toISOString().slice(0,7);state.calendarDay=null;render();});
    $$('[data-cal-day]',root).forEach(b=>b.onclick=()=>{state.calendarDay=state.calendarDay===b.dataset.calDay?null:b.dataset.calDay;render();});
    $('[data-cal-reset]',root)?.addEventListener('click',()=>{state.calendarDay=null;render();});

    $$('[data-cancel-form]',root).forEach(b=>b.onclick=()=>{b.closest('.ad-entry-panel')?.remove();});
    bindCloseButtons();
    $('#adNotify')?.addEventListener('click',async()=>{
      if(!('Notification' in window)){announce('Браузер не поддерживает уведомления.',true);return;}
      const permission=await Notification.requestPermission();
      announce(permission==='granted'?'Разрешено. Для напоминаний держите вкладку открытой.':'Разрешение не предоставлено.',permission!=='granted');
    });
    $('#adExportFinance')?.addEventListener('click',()=>{
      toCsv([['date','type','amount','currency','detail'],...financeRows().map(x=>[x.date,x.type,x.amount.toFixed(6),state.profile.currency,x.detail])],'automated-diary-finance.csv');announce('CSV подготовлен.');
    });
    $('#adSettingsForm')?.addEventListener('submit',async e=>{
      e.preventDefault();const form=e.currentTarget,f=new FormData(form),patch={initial_balance:Number(f.get('initial_balance')).toFixed(6),currency:f.get('currency'),timezone:f.get('timezone'),duration_seconds:Number(f.get('duration_seconds')),stake_percent:Number(f.get('stake_percent')),profit_percent:Number(f.get('profit_percent'))};
      setBusy(form,true);try{const {error}=await getClient().from('automated_diary_profiles').update(patch).eq('user_id',state.profile.user_id);if(error)throw error;await load();announce('Настройки сохранены.');}catch(err){announce(err.message||'Ошибка сохранения.',true);}finally{setBusy(form,false);}
    });
    $('#adLedgerForm')?.addEventListener('submit',async e=>{
      e.preventDefault();const form=e.currentTarget,f=new FormData(form);setBusy(form,true);
      try{const user=await requireUser();if(!user)return;
        const {error}=await getClient().from('automated_diary_ledger').insert({user_id:user.id,kind:f.get('kind'),amount:Number(f.get('amount')).toFixed(6),note:f.get('note')||''});if(error)throw error;await load();announce('Операция записана.');
      }catch(err){announce(err.message||'Ошибка сохранения.',true);}finally{setBusy(form,false);}
    });
    $('#adAudit')?.addEventListener('click',()=>{
      const suspicious=state.trades.filter(t=>num(t.stake)<=0||(t.status==='closed'&&(t.payout===null||num(t.payout)<0)));
      $('#adAuditResult').textContent=suspicious.length?`Найдены подозрительные сделки: ${suspicious.length}. Данные не изменены.`:`Локальная проверка пройдена. Всего: ${state.trades.length}, открытых: ${state.trades.filter(t=>t.status==='open').length}, закрытых: ${closedTrades().length}. Проверка облачной целостности не выполнялась.`;
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
  /* Tab-open reminders only. Not a background delivery service. */
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
