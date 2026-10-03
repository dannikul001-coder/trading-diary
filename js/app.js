let activeView='dashboard',tradeFilter='all',tradeSearch='',tradeSort='date-desc',tradeDateFilter='',tradePage=1,tradePageSize=50,planPeriodFilter='all';
const viewNames={dashboard:'Обзор',trades:'Сделки',calendar:'Календарь',statistics:'Аналитика',charts:'Графики',playbook:'Playbook',psychology:'Психология',goal:'Главная цель',plan:'План',notes:'Заметки',journal:'Журнал',goals:'Цели',import:'Import Center',settings:'Настройки',training:'Обучение'};
let calendarCursor=new Date();
document.addEventListener('DOMContentLoaded',()=>{bindNavigation();bindGlobal();renderAll();updateClock();setInterval(updateClock,1000);if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('sw.js').catch(()=>{});});
document.addEventListener('state:changed',()=>renderAll());
function bindNavigation(){
  document.getElementById('menuBtn')?.addEventListener('click',()=>document.getElementById('sidebar')?.classList.toggle('open'));
  document.getElementById('drawerClose')?.addEventListener('click',()=>document.getElementById('sidebar')?.classList.remove('open'));
}
function showView(v){if(typeof isTabHidden==='function'&&isTabHidden(v)){toast('Эта вкладка скрыта администратором.');return;}activeView=v;document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));document.getElementById('view-'+v)?.classList.add('active');document.querySelectorAll('.nav-item,.nav-chip').forEach(x=>x.classList.toggle('active',x.dataset.view===v));const section=document.getElementById('currentSection');if(section)section.textContent=viewNames[v]||v;document.getElementById('sidebar')?.classList.remove('open');if(v==='charts'){renderMainChart(document.querySelector('#mainChartType .active')?.dataset.type||'balance');renderSecondaryCharts();}if(v==='settings')renderSettings();if(v==='calendar')renderCalendar();if(v==='playbook')renderPlaybook();if(v==='psychology')renderPsychologyFull();if(v==='import'){renderImportView();renderImportHistory()}if(v==='training'&&typeof loadTrainingView==='function')loadTrainingView();if(v==='admin'&&typeof loadAdminUsers==='function')loadAdminUsers();}
function hexToRgb(hex){const m=String(hex||'').trim().replace('#','').match(/^[0-9a-f]{6}$/i);if(!m)return null;return{r:parseInt(m[0].slice(0,2),16),g:parseInt(m[0].slice(2,4),16),b:parseInt(m[0].slice(4,6),16)}}
function colorLuma(hex){const c=hexToRgb(hex);if(!c)return .2;const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b)}
function readableText(hex){return colorLuma(hex)>.46?'#11161b':'#f3f7f8'}
function readableMuted(hex){return colorLuma(hex)>.46?'#53606a':'#9eabb3'}
function rgbaFromHex(hex,alpha){const c=hexToRgb(hex)||{r:8,g:19,b:27};return `rgba(${c.r},${c.g},${c.b},${alpha})`}
function normalizeHex(value,fallback){let v=String(value||'').trim();if(!v.startsWith('#'))v='#'+v;if(/^#[0-9a-f]{6}$/i.test(v))return v.toLowerCase();return fallback}
function syncSiteColorInputs(){}
function applyAppearance(){
  const a=state.settings.appearance||{};
  const preset=a.preset||'midnight';
  const b=document.body;
  const names=['theme-midnight','theme-carbon','theme-forest','theme-ocean','theme-plum','theme-copper','theme-paper','theme-ivory','theme-mist','theme-sand','theme-sage','theme-lavender','theme-navycoral','theme-indigolime','theme-slateorange','theme-tealrose','theme-auberginecyan','theme-inkgold'];
  names.forEach(c=>b.classList.remove(c));
  ['accent-indigo','accent-forest','accent-burgundy','accent-copper','accent-arctic'].forEach(c=>b.classList.remove(c));
  b.classList.add('theme-'+preset);
  if(a.accent && a.accent!=='teal') b.classList.add('accent-'+a.accent);
  b.dataset.theme=preset;
  document.getElementById('themeBtn').textContent=['paper','ivory','mist','sand','sage','lavender'].includes(preset)?'☾':'☀';
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.setAttribute('content',getComputedStyle(b).getPropertyValue('--site-primary').trim()||'#111827');
  syncAppearanceControls();
}
function updateSiteColor(){}

function bindGlobal(){
  document.getElementById('modalClose').onclick=closeModal;
  document.getElementById('modalBackdrop').addEventListener('click',e=>{if(e.target.id==='modalBackdrop')closeModal()});
  document.getElementById('themeBtn').onclick=()=>{const themes=['midnight','carbon','forest','ocean','plum','copper','paper','ivory','mist','sand','sage','lavender','navycoral','indigolime','slateorange','tealrose','auberginecyan','inkgold'];const p=state.settings.appearance?.preset||'midnight';const i=Math.max(0,themes.indexOf(p));applyAppearancePreset(themes[(i+1)%themes.length])};
  applyAppearance();
  document.getElementById('tradeSearch').addEventListener('input',e=>{tradeSearch=e.target.value.toLowerCase();tradePage=1;renderTrades()});
  document.getElementById('tradeSort').addEventListener('change',e=>{tradeSort=e.target.value;tradePage=1;renderTrades()});
  document.querySelectorAll('#tradeFilters button').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('#tradeFilters button').forEach(x=>x.classList.remove('active'));b.classList.add('active');tradeFilter=b.dataset.filter;tradeDateFilter='';tradePage=1;renderTrades()}));
  document.querySelectorAll('#dashboardChartRange button').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('#dashboardChartRange button').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderBalanceChart(b.dataset.range==='all'?'all':Number(b.dataset.range))}));
  document.querySelectorAll('#mainChartType button').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('#mainChartType button').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderMainChart(b.dataset.type)}));
  document.querySelectorAll('#planPeriodTabs button').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('#planPeriodTabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active');planPeriodFilter=b.dataset.planPeriod;renderPlans()}));
  document.getElementById('saveGeneral').onclick=saveGeneralSettings;
  document.querySelectorAll('[data-appearance-preset]').forEach(b=>b.addEventListener('click',()=>applyAppearancePreset(b.dataset.appearancePreset)));
  document.getElementById('auditTrades')?.addEventListener('click',auditTradesIntegrity);
  document.getElementById('checkCloudConnection')?.addEventListener('click',checkCloudConnection);
document.getElementById('deleteAllTrades')?.addEventListener('click',deleteAllTrades);
  document.getElementById('resetWorkspace')?.addEventListener('click',resetWorkspace);
  document.getElementById('trainingSearch')?.addEventListener('input',filterTrainingLessons);
  document.getElementById('exportJson').onclick=exportJson;
  document.getElementById('importJsonBtn').onclick=()=>document.getElementById('jsonFile').click();
  document.getElementById('exportCsv').onclick=exportCsv;
  document.getElementById('jsonFile').onchange=importJsonFile;
  // Settings controls are delegated so they keep working after renderSettings() replaces their DOM.

  const gs=document.getElementById('globalSearch');
  gs?.addEventListener('keydown',e=>{if(e.key==='Enter'){const q=gs.value.trim().toLowerCase();if(!q)return;showView('trades');tradeDateFilter='';document.getElementById('tradeSearch').value=q;tradeSearch=q;tradePage=1;renderTrades()}});
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();gs?.focus()}});
  document.addEventListener('click',handleDelegated);
  document.addEventListener('submit',handleDelegatedSubmit);
  initImportCenter?.();
}
function handleDelegatedSubmit(e){
  const form=e.target;
  if(!form || form.id!=='journalForm') return;
  e.preventDefault();
  const f=Object.fromEntries(new FormData(form));
  const key=localDateKey();
  state.journal[key]={...(state.journal[key]||{}),text:f.text||'',worked:f.worked||'',failed:f.failed||'',lesson:f.lesson||''};
  saveState();
  toast('Запись журнала сохранена');
  renderJournalView();
}
function handleDelegated(e){
  const t=e.target.closest('button,[data-view],[data-view-target],[data-action],[data-settings-tab],[data-appearance-preset],[data-edit-trade],[data-delete-trade],[data-toggle-plan],[data-delete-plan],[data-delete-note],[data-delete-goal],[data-delete-instrument],[data-delete-strategy],[data-delete-deposit],[data-edit-deposit],[data-delete-withdrawal],[data-edit-withdrawal],[data-photo-trade],[data-training-category],[data-training-open]');
  if(!t)return;
  if(t.id==='calendarPrev'){calendarCursor.setMonth(calendarCursor.getMonth()-1);renderCalendar();return;}
  if(t.id==='calendarNext'){calendarCursor.setMonth(calendarCursor.getMonth()+1);renderCalendar();return;}
  if(t.dataset.calendarDate){showView('trades');const q=document.getElementById('tradeSearch');if(q)q.value='';tradeSearch='';tradeFilter='all';tradeDateFilter=t.dataset.calendarDate;tradePage=1;renderTrades();return;}
  if(t.dataset.clearTradeDate){tradeDateFilter='';tradePage=1;renderTrades();return;} if(t.dataset.tradePage){tradePage=Math.max(1,Number(t.dataset.tradePage)||1);renderTrades();return;} if(t.dataset.trainingCategory){document.querySelectorAll('[data-training-category]').forEach(x=>x.classList.toggle('active',x===t));filterTrainingLessons();return;}
  if(t.dataset.trainingOpen){if(typeof openTrainingLesson==='function'){openTrainingLesson(t.dataset.trainingOpen)}else{showTrainingExample(t.dataset.trainingOpen)}return;}
  if(t.dataset.trainingLocked){toast('Раздел «Обучение» временно закрыт: технические работы.');return;}
  if(t.dataset.view){showView(t.dataset.view);return;}
  if(t.dataset.viewTarget){showView(t.dataset.viewTarget);return;}
  if(t.dataset.action){actions(t.dataset.action);return;}
  if(t.dataset.settingsTab){document.querySelectorAll('[data-settings-tab]').forEach(x=>x.classList.remove('active'));document.querySelectorAll('[data-settings-panel]').forEach(x=>x.classList.remove('active'));t.classList.add('active');document.querySelector(`[data-settings-panel="${t.dataset.settingsTab}"]`)?.classList.add('active');return;}
  if(t.dataset.appearancePreset){applyAppearancePreset(t.dataset.appearancePreset);return;}
  if(t.dataset.editTrade){openTradeModal(t.dataset.editTrade);return;}
  if(t.dataset.deleteTrade){deleteTrade(t.dataset.deleteTrade);return;}
  if(t.dataset.togglePlan){togglePlan(t.dataset.togglePlan);return;}
  if(t.dataset.deletePlan){deletePlan(t.dataset.deletePlan);return;}
  if(t.dataset.deleteNote){deleteNote(t.dataset.deleteNote);return;}
  if(t.dataset.deleteGoal){deleteGoal(t.dataset.deleteGoal);return;}
  if(t.dataset.deleteInstrument){state.instruments=state.instruments.filter(i=>i.id!==t.dataset.deleteInstrument);saveState();return;}
  if(t.dataset.deleteStrategy){const i=Number(t.dataset.deleteStrategy);state.strategies.splice(i,1);saveState();return;}
  if(t.dataset.editDeposit){editDeposit(t.dataset.editDeposit);return;}
  if(t.dataset.deleteDeposit){deleteBalanceOperation(t.dataset.deleteDeposit);return;}
  if(t.dataset.editWithdrawal){editBalanceOperation(t.dataset.editWithdrawal,'withdrawal');return;}
  if(t.dataset.deleteWithdrawal){deleteBalanceOperation(t.dataset.deleteWithdrawal);return;}
  if(t.dataset.photoTrade){const tr=state.trades.find(x=>x.id===t.dataset.photoTrade);if(tr?.photoData)openTradePhoto(tr.photoData);return;}
}
function openMainGoalModal(){
  const g=state.mainGoal||{};
  openSimpleModal('Главная цель','Эти показатели формируют общий прогресс.',f=>{
    state.mainGoal={title:f.title,description:f.description,targetBalance:Number(f.targetBalance)||0,targetWinRate:Number(f.targetWinRate)||0,targetTrades:Number(f.targetTrades)||0,targetPnl:Number(f.targetPnl)||0};
    saveState();renderAll();toast('Главная цель сохранена');
  },[
    {name:'title',label:'Название цели',type:'text',value:g.title,required:true},
    {name:'targetBalance',label:'Целевой баланс',type:'number',value:g.targetBalance,required:true},
    {name:'targetWinRate',label:'Целевой win rate, %',type:'number',value:g.targetWinRate,required:true},
    {name:'targetTrades',label:'Целевое количество сделок',type:'number',value:g.targetTrades,required:true},
    {name:'targetPnl',label:'Целевой P&L',type:'number',value:g.targetPnl,required:true},
    {name:'description',label:'Описание',type:'textarea',value:g.description}
  ]);
}
function actions(a){
  if(a==='open-trade')return openTradeModal();
  if(a==='edit-main-goal')return openMainGoalModal();
  if(a==='add-plan')return openSimpleModal('Новая задача','Добавьте конкретную задачу и выберите период.',f=>{state.plans.push({id:uid(),date:localDateKey(),task:f.task,period:planPeriodKey(f.period),done:false});saveState();toast('Задача добавлена')},[
    {name:'task',label:'Задача',type:'text',placeholder:'Например: ждать только A+ сетап',required:true},
    {name:'period',label:'Период',type:'select',options:['Сегодня','Завтра','Неделя','Месяц']}
  ]);
  if(a==='add-note')return openSimpleModal('Новая заметка','Сохраните наблюдение после сессии.',f=>{state.notes.unshift({id:uid(),date:localDateKey(),text:f.text,tags:String(f.tags||'').split(',').map(x=>x.trim()).filter(Boolean)});saveState();toast('Заметка сохранена')},[{name:'text',label:'Текст',type:'textarea',required:true},{name:'tags',label:'Теги',type:'text',placeholder:'ошибка, дисциплина'}]);
  if(a==='add-goal')return openSimpleModal('Новая цель','Выберите метрику, период и конкретное значение.',f=>{state.goals.push({id:uid(),period:f.period,metric:f.metric,title:f.title,target:Number(f.target)||0,current:0});saveState();toast('Цель добавлена')},[
    {name:'title',label:'Название',type:'text',required:true,placeholder:'Например: 20 сделок по плану'},
    {name:'metric',label:'Метрика',type:'select',options:['Сделки','P&L','Win rate','Баланс']},
    {name:'period',label:'Период',type:'select',options:['Сегодня','Неделя','Месяц','Квартал','Год']},
    {name:'target',label:'Целевое значение',type:'number',required:true}
  ]);
  if(a==='add-instrument')return openSimpleModal('Новый инструмент','Он появится в выборе сделки.',f=>{state.instruments.push({id:uid(),category:f.category,name:f.name,custom:true});saveState();toast('Инструмент добавлен')},[{name:'name',label:'Название',type:'text',required:true},{name:'category',label:'Категория',type:'select',options:['Forex','Crypto','Commodities','Indices','Stocks','OTC','Custom']}]);
  if(a==='add-strategy')return openSimpleModal('Новая стратегия','Добавьте название и правило, которое можно проверить по журналу.',f=>{state.strategies.push({name:f.name,description:f.description||''});saveState();toast('Стратегия добавлена')},[{name:'name',label:'Название',type:'text',required:true},{name:'description',label:'Правило / описание',type:'textarea',placeholder:'Когда входить, когда пропускать, какой риск'}]);
  if(a==='add-deposit')return openBalanceOperationModal('deposit');
  if(a==='add-withdrawal')return openBalanceOperationModal('withdrawal');
}

function filterTrainingLessons(){
  const q=String(document.getElementById('trainingSearch')?.value||'').trim().toLowerCase();
  const active=document.querySelector('[data-training-category].active')?.dataset.trainingCategory||'all';
  document.querySelectorAll('.training-lesson').forEach(card=>{
    const category=card.dataset.category||'';const title=(card.dataset.title||card.textContent||'').toLowerCase();
    card.style.display=(active==='all'||category===active)&&(!q||title.includes(q))?'':'none';
  });
}
function showTrainingExample(){
  const el=document.getElementById('trainingLessonGrid');
  if(!el)return;
  el.scrollIntoView({behavior:'smooth',block:'start'});
  toast('Пример урока — пока это каркас. Реальные материалы подключим после твоей структуры.');
}

function renderAll(){applyAppearance();renderMainGoal();renderKpis();renderTrades();renderPeriodStats();renderPsychology();renderJournal();renderJournalView();renderBreakdown();renderPlans();renderNotes();renderGoals();renderResultBars();renderDetailStats();renderAnalyticsInsights();renderSettings();renderDashboardPlan();renderJournalExtras();renderBalanceChart(document.querySelector('#dashboardChartRange .active')?.dataset.range==='all'?'all':Number(document.querySelector('#dashboardChartRange .active')?.dataset.range||30));if(activeView==='charts'){renderMainChart(document.querySelector('#mainChartType .active')?.dataset.type||'balance');renderSecondaryCharts();}if(activeView==='calendar')renderCalendar();if(activeView==='playbook')renderPlaybook();if(activeView==='psychology')renderPsychologyFull();if(activeView==='import'){renderImportView();renderImportHistory()}if(activeView==='training'&&typeof loadTrainingView==='function')loadTrainingView();const quotes=DEFAULT_DATA.quotes||[];if(quotes.length&&typeof renderQuote==='function'){let qi=Math.floor(Math.random()*quotes.length);const prev=Number(sessionStorage.getItem('tradingDiary_quoteIndex'));if(quotes.length>1&&Number.isFinite(prev)&&qi===prev)qi=(qi+1)%quotes.length;sessionStorage.setItem('tradingDiary_quoteIndex',String(qi));renderQuote(qi)}}
function renderKpis(){const all=stats(state.trades),balance=currentBalance();document.getElementById('dashboardKpis').innerHTML=[['Баланс',formatMoneyPlain(balance),`Старт ${formatMoneyPlain(state.settings.startingBalance)}`,''],['P&L',formatMoney(all.pnl),`${all.profit?`Прибыль ${formatMoneyPlain(all.profit)}`:'Нет прибыли'}`,all.pnl>0?'positive':all.pnl<0?'negative':'neutral'],['Win rate',`${all.winRate.toFixed(1)}%`,`${all.wins} win • ${all.losses} loss • ${all.draws} draw`,all.winRate>=50?'positive':''],['Сделки',all.trades,`Средний P&L ${formatMoneyPlain(all.avg)}`, '']].map(x=>`<div class="card kpi"><div class="label">${x[0]}</div><div class="value ${x[3]}">${x[1]}</div><div class="sub">${x[2]}</div></div>`).join('')}
function renderMainGoal(){
  const g=state.mainGoal||{},s=stats(state.trades),balance=currentBalance();
  const items=[
    {key:'balance',name:'Баланс',current:balance,target:Number(g.targetBalance||0),type:'money',icon:'◈'},
    {key:'win',name:'Win rate',current:s.winRate,target:Number(g.targetWinRate||0),type:'percent',icon:'◎'},
    {key:'trades',name:'Сделки',current:s.trades,target:Number(g.targetTrades||0),type:'count',icon:'◇'},
    {key:'pnl',name:'P&L',current:s.pnl,target:Number(g.targetPnl||0),type:'money',icon:'↗'}
  ];
  const ratio=(current,target)=>target>0?Math.min(1,Math.max(0,current/target)):0;
  const progress=Math.round(items.reduce((sum,x)=>sum+ratio(x.current,x.target),0)/items.length*100);
  const valueText=(current,type)=>type==='percent'?`${Number(current||0).toFixed(1)}%`:type==='count'?String(Math.round(Number(current||0))):formatMoneyPlain(current);
  const remainingText=(current,target,type)=>{
    const left=Math.max(0,Number(target||0)-Number(current||0));
    return type==='percent'?`${left.toFixed(1)} п.п.`:type==='count'?`${Math.round(left)} сделок`:formatMoneyPlain(left);
  };
  const metricCards=items.map(x=>{
    const pct=Math.round(ratio(x.current,x.target)*100);
    const done=pct>=100;
    return `<div class="goal-cockpit-metric ${done?'is-done':''}">
      <div class="goal-cockpit-metric-top"><span class="goal-cockpit-icon">${x.icon}</span><span>${x.name}</span><b>${pct}%</b></div>
      <strong>${valueText(x.current,x.type)}</strong>
      <div class="goal-cockpit-meta"><span>Цель ${valueText(x.target,x.type)}</span><span>${done?'Цель достигнута':'Осталось '+remainingText(x.current,x.target,x.type)}</span></div>
      <div class="goal-cockpit-track"><i style="width:${pct}%"></i></div>
    </div>`;
  }).join('');
  const dashboard=document.getElementById('dashboardGoalCard');
  if(dashboard) dashboard.innerHTML=`
    <div class="goal-cockpit-head">
      <div class="goal-cockpit-title"><span class="goal-label">MAIN GOAL / ЦЕЛЬ</span><h3>${escapeHtml(g.title||'Главная цель')}</h3><p>${escapeHtml(g.description||'Одна цель, которая собирает ключевые показатели торгового дневника.')}</p></div>
      <div class="goal-cockpit-score"><div class="goal-score-ring" style="--goal-progress:${progress}%"><strong>${progress}%</strong><span>готово</span></div></div>
    </div>
    <div class="goal-cockpit-status"><span><i></i>${progress>=100?'Цель достигнута':'Прогресс рассчитывается автоматически'}</span><button class="ghost-btn" data-view-target="goal">Открыть цель →</button></div>
    <div class="goal-cockpit-metrics">${metricCards}</div>`;

  const view=document.getElementById('mainGoalView');
  if(view) view.innerHTML=`
    <div class="goal-page-head">
      <div><span class="goal-label">MAIN GOAL</span><h3>${escapeHtml(g.title||'Главная цель')}</h3><p>${escapeHtml(g.description||'Одна масштабная цель, к которой постепенно движется весь дневник.')}</p></div>
      <div class="goal-page-progress"><strong>${progress}%</strong><span>общий прогресс</span></div>
    </div>
    <div class="goal-page-progress-bar"><i style="width:${progress}%"></i></div>
    <div class="goal-page-grid">${metricCards}</div>
    <div class="goal-page-summary"><div><span>Торговых сделок</span><b>${s.trades}</b></div><div><span>Текущий P&L</span><b class="${s.pnl>0?'positive':s.pnl<0?'negative':'neutral'}">${formatMoney(s.pnl)}</b></div><div><span>Текущий баланс</span><b>${formatMoneyPlain(balance)}</b></div><div><span>Win rate</span><b>${s.winRate.toFixed(1)}%</b></div></div>`;
  const metrics=document.getElementById('mainGoalMetrics');
  if(metrics) metrics.innerHTML='';
  const milestones=document.getElementById('goalMilestones');
  if(milestones) milestones.innerHTML=`<div class="goal-milestone-board"><div><span>Следующий ориентир</span><strong>${items.find(x=>ratio(x.current,x.target)<1)?.name||'Все показатели'}</strong></div><div><span>Общий прогресс</span><strong>${progress}%</strong></div><button class="ghost-btn" data-action="edit-main-goal">Настроить цель →</button></div>`;
}
function renderPeriodStats(){
  const box=document.getElementById('periodStats');
  if(!box)return;
  const data=[['Сегодня','today','24 часа'],['Неделя','week','7 дней'],['Месяц','month','Текущий месяц']];
  box.innerHTML=data.map(([label,key,sub])=>{
    const s=getPeriodStats(key);
    const rate=Math.min(100,Math.max(0,s.winRate));
    const pnlClass=s.pnl>0?'positive':s.pnl<0?'negative':'neutral';
    return `<article class="period-card">
      <div class="period-card-head"><div><span>${sub}</span><h4>${label}</h4></div><strong class="${pnlClass}">${formatMoney(s.pnl)}</strong></div>
      <div class="period-card-main"><div><b>${s.trades}</b><span>сделок</span></div><div class="period-rate-big"><b>${s.winRate.toFixed(1)}%</b><span>win rate</span></div></div>
      <div class="period-card-bar"><i style="width:${rate}%"></i></div>
      <div class="period-card-results"><span class="positive"><b>${s.wins}</b> WIN</span><span class="negative"><b>${s.losses}</b> LOSS</span><span class="neutral"><b>${s.draws}</b> DRAW</span></div>
      <div class="period-card-foot"><span>Прибыль <b class="positive">${formatMoneyPlain(s.profit)}</b></span><span>Убыток <b class="negative">−${formatMoneyPlain(s.loss)}</b></span></div>
    </article>`;
  }).join('');
}
function renderTrades(){
  const body=document.getElementById('tradesBody'),empty=document.getElementById('tradesEmpty');
  if(!body)return;
  let arr=state.trades.filter(t=>inRange(t,tradeFilter));
  if(tradeDateFilter)arr=arr.filter(t=>String(t.date||'')===tradeDateFilter);
  arr=arr.filter(t=>{const s=[t.instrument,t.strategy,t.note,t.category,t.platform].join(' ').toLowerCase();return !tradeSearch||s.includes(tradeSearch)});
  arr.sort((a,b)=>tradeSort==='date-desc'?tradeDate(b)-tradeDate(a):tradeSort==='date-asc'?tradeDate(a)-tradeDate(b):tradeSort==='pnl-desc'?b.pnl-a.pnl:a.pnl-b.pnl);
  const total=arr.length;
  const pages=Math.max(1,Math.ceil(total/tradePageSize));
  if(tradePage>pages)tradePage=pages;
  const from=(tradePage-1)*tradePageSize;
  const visible=arr.slice(from,from+tradePageSize);
  const summary=document.getElementById('tradeDateSummary');
  if(summary){
    if(tradeDateFilter){
      const s=stats(arr);
      summary.innerHTML=`<span>Фильтр по дню: <b>${formatDate(tradeDateFilter)}</b></span><span>${s.trades} сделок · ${s.winRate.toFixed(1)}% win rate · <b class="${s.pnl>0?'positive':s.pnl<0?'negative':''}">${formatMoney(s.pnl)}</b></span><button type="button" class="mini-btn" data-clear-trade-date>Сбросить</button>`;
      summary.classList.add('show');
    }else{
      summary.classList.remove('show');summary.innerHTML='';
    }
  }
  body.innerHTML=visible.map(t=>`<tr><td>${formatDate(t.date)}<div class="trade-sub">${t.time||'—'}</div></td><td><div class="trade-instrument">${escapeHtml(t.instrument)}</div><div class="trade-sub">${escapeHtml(t.category||'Custom')}</div></td><td><span class="type-pill ${t.type==='CALL'?'call':'put'}">${t.type}</span></td><td>${formatMoneyPlain(t.stake)}</td><td>${Number(t.payout||0).toFixed(2)}%</td><td><span class="status-pill ${t.result==='win'?'call':t.result==='loss'?'put':'draw'}">● ${t.result==='win'?'В плюсе':t.result==='loss'?'В минусе':'В нуле'}</span></td><td class="${t.pnl>0?'positive':t.pnl<0?'negative':'neutral'}">${formatMoney(t.pnl)}</td><td>${escapeHtml(t.strategy||'—')}</td><td>${t.photoData?`<button type="button" class="trade-photo-link" data-photo-trade="${t.id}" title="Открыть фото">▣</button>`:'—'}</td><td><div class="row-actions"><button class="mini-btn" data-edit-trade="${t.id}">Изм.</button><button class="mini-btn" data-delete-trade="${t.id}">×</button></div></td></tr>`).join('');
  empty.classList.toggle('show',state.trades.length===0);
  const pager=document.getElementById('tradePagination');
  if(pager){
    if(total>0){
      const startRow=from+1,endRow=Math.min(from+tradePageSize,total);
      const prevDisabled=tradePage<=1?'disabled':'';
      const nextDisabled=tradePage>=pages?'disabled':'';
      let buttons=`<button type="button" class="pager-btn" data-trade-page="${tradePage-1}" ${prevDisabled} aria-label="Предыдущая страница">‹ Предыдущая</button>`;
      const windowStart=Math.max(1,tradePage-2),windowEnd=Math.min(pages,tradePage+2);
      if(windowStart>1)buttons+=`<button type="button" class="pager-number" data-trade-page="1">1</button>${windowStart>2?'<span class="pager-ellipsis">…</span>':''}`;
      for(let p=windowStart;p<=windowEnd;p++)buttons+=`<button type="button" class="pager-number ${p===tradePage?'active':''}" data-trade-page="${p}" aria-current="${p===tradePage?'page':'false'}">${p}</button>`;
      if(windowEnd<pages)buttons+=`${windowEnd<pages-1?'<span class="pager-ellipsis">…</span>':''}<button type="button" class="pager-number" data-trade-page="${pages}">${pages}</button>`;
      buttons+=`<button type="button" class="pager-btn" data-trade-page="${tradePage+1}" ${nextDisabled} aria-label="Следующая страница">Следующая ›</button>`;
      pager.innerHTML=`<span class="pager-summary">Показываются <b>${startRow}–${endRow}</b> из <b>${total}</b> · страница <b>${tradePage}</b> из <b>${pages}</b></span><div class="trade-pages">${buttons}</div>`;
      pager.classList.add('show');
    }else{
      pager.classList.remove('show');pager.innerHTML='';
    }
  }
}
function renderPsychology(){const s=state.trades;const discipline=s.length?Math.min(100,Math.round(s.filter(t=>t.state==='calm'||t.state==='focused').length/s.length*100)):0;const calm=s.length?Math.round(s.filter(t=>t.state==='calm').length/s.length*100):0;const fatigue=s.length?Math.round(s.filter(t=>t.state==='tired'||t.state==='fear').length/s.length*100):0;const revenge=s.length?Math.round(s.filter(t=>t.state==='revenge'||t.state==='greed').length/s.length*100):0;document.getElementById('psychology').innerHTML=[['Дисциплина',discipline],['Спокойствие',calm],['Страх / усталость',fatigue],['Азарт / реванш',revenge]].map(([n,v])=>`<div class="psych-row"><div class="psych-top"><span>${n}</span><b>${v}%</b></div><div class="bar"><i style="width:${v}%"></i></div></div>`).join('')+`<div class="psych-caption">Показатели появляются из поля «Состояние» в сделках. Ничего не выдумывается: при отсутствии данных значения остаются нулевыми.</div>`}
function renderJournal(){const key=localDateKey();const j=state.journal[key]||{};const preview=document.getElementById('journalPreview');if(preview)preview.innerHTML=`<div class="journal-preview-main"><span class="journal-preview-label">СЕГОДНЯ · ${formatDate(key)}</span><h4>${j.text?escapeHtml(j.text.slice(0,180)):'Запись за сегодня ещё не заполнена'}</h4><div class="journal-preview-grid"><span><b>${j.worked?'✓':'—'}</b> Что сработало</span><span><b>${j.failed?'✓':'—'}</b> Что не сработало</span><span><b>${j.lesson?'✓':'—'}</b> Урок</span></div></div>`;}
function renderDashboardPlan(){
  const box=document.getElementById('dashboardPlanPreview');
  if(!box)return;
  const today=localDateKey();
  const plans=state.plans.filter(p=>p.date===today);
  const done=plans.filter(p=>p.done).length;
  const rows=plans.slice(0,4).map(p=>`<div class="dashboard-plan-row ${p.done?'done':''}"><button type="button" class="dashboard-plan-check ${p.done?'done':''}" data-toggle-plan="${p.id}" aria-label="${p.done?'Снять отметку':'Отметить выполненным'}" title="${p.done?'Снять отметку':'Отметить выполненным'}">${p.done?'✓':''}</button><span>${escapeHtml(p.task)}</span></div>`).join('');
  box.innerHTML=`<div class="dashboard-plan-head"><span>ПЛАН СЕССИИ</span><b>${done}/${plans.length}</b></div>${rows||'<div class="dashboard-plan-empty">На сегодня задач нет.</div>'}`;
}

function renderJournalExtras(){
  const label=document.getElementById('journalDateLabel');if(label)label.textContent=formatDate(localDateKey());
  const key=localDateKey(),j=state.journal[key]||{},dayTrades=state.trades.filter(t=>String(t.date||'').slice(0,10)===key),s=stats(dayTrades);
  const summary=document.getElementById('journalSummary');
  if(summary)summary.innerHTML=`<div class="side-kicker">СВЯЗЬ С ТОРГОВЫМ ДНЁМ</div><h3>${j.text?'Запись есть':'Запись ещё не заполнена'}</h3><div class="journal-linked-stats"><div><span>Сделки</span><b>${s.trades}</b></div><div><span>Win rate</span><b>${s.winRate.toFixed(1)}%</b></div><div><span>P&amp;L</span><b class="${s.pnl>0?'positive':s.pnl<0?'negative':''}">${formatMoney(s.pnl)}</b></div><div><span>Баланс</span><b>${formatMoneyPlain(currentBalance())}</b></div></div><p>${j.lesson?escapeHtml(j.lesson):'После сессии зафиксируйте один конкретный урок.'}</p><div class="journal-checks"><span class="${j.worked?'ok':''}">01 · Сработало</span><span class="${j.failed?'ok':''}">02 · Ошибки</span><span class="${j.lesson?'ok':''}">03 · Урок</span></div>`;
  const archive=document.getElementById('journalArchive');if(archive){const dates=Object.keys(state.journal).sort().reverse().slice(0,6);archive.innerHTML=`<div class="side-kicker">ПОСЛЕДНИЕ ДНИ</div>${dates.map(d=>{const ds=stats(state.trades.filter(t=>String(t.date||'').slice(0,10)===d));return `<div class="journal-archive-row"><span>${formatDate(d)}</span><b>${ds.trades} сдел. · ${formatMoney(ds.pnl)}</b></div>`}).join('')||'<p class="muted">История появится после первой записи.</p>'}`}
}
function renderJournalView(){const el=document.getElementById('journalForm');if(!el)return;const key=localDateKey(),j=state.journal[key]||{};el.elements.text.value=j.text||'';el.elements.worked.value=j.worked||'';el.elements.failed.value=j.failed||'';el.elements.lesson.value=j.lesson||'';const day=state.trades.filter(t=>String(t.date||'').slice(0,10)===key),s=stats(day),plans=state.plans.filter(p=>p.date===key),done=plans.filter(p=>p.done).length;const auto=document.getElementById('journalAutoSummary');if(auto)auto.innerHTML=`<div class="journal-auto-head"><div><span class="side-kicker">АВТОМАТИЧЕСКИЙ ИТОГ ДНЯ</span><h3>${day.length?'Данные подтянуты из сделок':'Данных о сделках пока нет'}</h3></div><span class="journal-auto-badge">${formatDate(key)}</span></div><div class="journal-auto-grid"><div><span>Сделки</span><b>${s.trades}</b></div><div><span>Win rate</span><b>${s.winRate.toFixed(1)}%</b></div><div><span>P&amp;L</span><b class="${s.pnl>0?'positive':s.pnl<0?'negative':'neutral'}">${formatMoney(s.pnl)}</b></div><div><span>Win / Loss</span><b>${s.wins} / ${s.losses}</b></div><div><span>План</span><b>${done}/${plans.length}</b></div><div><span>Баланс</span><b>${formatMoneyPlain(currentBalance())}</b></div></div><p class="journal-auto-note">Эти значения рассчитываются автоматически и не требуют ручного ввода.</p>`}
function renderBreakdown(){const body=document.getElementById('breakdownBody'),empty=document.getElementById('breakdownEmpty');if(!body||!empty)return;const rows=[...groupByDay().reverse().slice(0,14)];body.innerHTML=rows.map(r=>`<tr><td>${formatDate(r.date)}</td><td>${r.trades}</td><td>${r.wins}</td><td>${r.losses}</td><td>${r.draws}</td><td>${r.winRate.toFixed(1)}%</td><td class="positive">${formatMoneyPlain(r.profit)}</td><td class="negative">${formatMoneyPlain(-r.loss)}</td><td class="${r.pnl>0?'positive':r.pnl<0?'negative':''}">${formatMoney(r.pnl)}</td></tr>`).join('');document.getElementById('breakdownEmpty').style.display=rows.length?'none':'block'}
function planPeriodLabel(p){return ({today:'Сегодня',tomorrow:'Завтра',week:'Неделя',month:'Месяц','Сегодня':'Сегодня','Завтра':'Завтра','Неделя':'Неделя','Месяц':'Месяц'}[p]||'Сегодня')}
function planPeriodKey(p){return ({'Сегодня':'today','Завтра':'tomorrow','Неделя':'week','Месяц':'month'}[p]||p||'today')}
function planMatches(p){if(planPeriodFilter==='all')return true;if(planPeriodFilter==='today')return p.date===localDateKey();if(planPeriodFilter==='tomorrow'){const d=new Date();d.setDate(d.getDate()+1);return p.date===localDateKey(d)}if(planPeriodFilter==='week'){return inRange({date:p.date,time:'00:00'},'week')}if(planPeriodFilter==='month')return p.date.slice(0,7)===localDateKey().slice(0,7);return true}
function renderPlans(){const box=document.getElementById('planList');if(!box)return;const plans=state.plans.filter(planMatches);const today=state.plans.filter(p=>p.date===localDateKey());const done=today.filter(p=>p.done).length;const badge=document.getElementById('planSummaryBadge');if(badge)badge.textContent=`${done}/${today.length} выполнено`;box.innerHTML=plans.map(p=>`<div class="plan-row ${p.done?'done':''}"><button class="check ${p.done?'done':''}" data-toggle-plan="${p.id}">${p.done?'✓':''}</button><div class="plan-main"><div class="plan-text">${escapeHtml(p.task)}</div><div class="plan-meta"><span>${planPeriodLabel(p.period)}</span><span>${formatDate(p.date)}</span></div></div><button class="mini-btn" data-delete-plan="${p.id}">×</button></div>`).join('');document.getElementById('planEmpty').style.display=plans.length?'none':'block';const focus=document.getElementById('planFocus');if(focus)focus.innerHTML=`<div class="side-kicker">ФОКУС</div><h3>${today.length?`${done} из ${today.length} задач выполнено`:'Сегодня план свободен'}</h3><p>${today.length?'Сначала выполните обязательные задачи, затем переходите к дополнительным.':'Добавьте 1–3 конкретных действия перед началом торговой сессии.'}</p><div class="focus-progress"><i style="width:${today.length?done/today.length*100:0}%"></i></div>`}

function renderNotes(){const box=document.getElementById('notesGrid');if(!box)return;box.innerHTML=state.notes.map(n=>`<article class="card note-card"><div class="note-top"><span class="note-date">${formatDate(n.date)}</span><span class="note-type">NOTE</span></div><h3>Наблюдение</h3><p>${escapeHtml(n.text??n.content??'')}</p><div class="tags">${(n.tags||[]).map(t=>`<span class="tag">#${escapeHtml(t)}</span>`).join('')||'<span class="tag muted-tag">без тегов</span>'}</div><div class="note-footer"><span>Торговый дневник</span><button class="mini-btn" data-delete-note="${n.id}">Удалить</button></div></article>`).join('');document.getElementById('notesEmpty').style.display=state.notes.length?'none':'block'}

function goalPeriodStats(g){const map={'Сегодня':'today','Неделя':'week','Месяц':'month','Квартал':'month','Год':'all'};return stats(state.trades.filter(t=>inRange(t,map[g.period]||'all')))}
function renderGoals(){const box=document.getElementById('goalsGrid');if(!box)return;box.innerHTML=state.goals.map(g=>{const s=goalPeriodStats(g);let current=Number(g.current)||0;if(g.metric==='Сделки')current=s.trades;else if(g.metric==='P&L')current=s.pnl;else if(g.metric==='Win rate')current=s.winRate;else if(g.metric==='Баланс')current=currentBalance();const p=g.target?Math.min(100,Math.max(0,current/g.target*100)):0;const unit=g.metric==='Win rate'?'%':g.metric==='Сделки'?'шт.':formatMoneyPlain(1).replace(/[0-9.,]/g,'');return `<article class="card goal-card"><div class="goal-card-top"><span class="note-date">${escapeHtml(g.period||'Период')}</span><span class="goal-metric-tag">${escapeHtml(g.metric||'Метрика')}</span></div><h3>${escapeHtml(g.title)}</h3><div class="goal-numbers"><strong>${g.metric==='Win rate'?current.toFixed(1):current.toFixed(2)}</strong><span>из ${g.target}${unit}</span></div><div class="goal-progress"><i style="width:${p}%"></i></div><div class="goal-meta"><span>${p.toFixed(0)}% выполнено</span><span>осталось ${Math.max(0,Number(g.target)-current).toFixed(g.metric==='Win rate'?1:2)}</span></div><div class="goal-card-footer"><span>${s.trades} сделок в периоде</span><button class="mini-btn" data-delete-goal="${g.id}">Удалить</button></div></article>`}).join('');document.getElementById('goalsEmpty').style.display=state.goals.length?'none':'block'}

function renderDetailStats(){const el=document.getElementById('detailStats');if(!el)return;const s=stats(state.trades);const vals=[['Сделки',s.trades,'Всего записей'],['Win rate',`${s.winRate.toFixed(1)}%`,`${s.wins} побед`],['P&L',formatMoney(s.pnl),`Среднее ${formatMoney(s.avg)}`],['Прибыль',formatMoney(s.profit),`Сумма выигрышных`],['Убыток',formatMoney(-s.loss),`Сумма проигрышных`],['Средний payout',`${s.avgPayout.toFixed(1)}%`,'По win-сделкам'],['Макс. серия Win',s.maxWin,'Подряд'],['Макс. серия Loss',s.maxLoss,'Подряд']];el.innerHTML=vals.map(v=>`<div class="card stat-card"><span>${v[0]}</span><strong class="${v[0]==='P&L'?(s.pnl>0?'positive':s.pnl<0?'negative':''):''}">${v[1]}</strong><small>${v[2]}</small></div>`).join('')}
function renderAnalyticsInsights(){const i=document.getElementById('analyticsInsights'),st=document.getElementById('analyticsStreaks');if(!i||!st)return;const s=stats(state.trades);const best=groupByDay().sort((a,b)=>b.pnl-a.pnl)[0];const worst=groupByDay().sort((a,b)=>a.pnl-b.pnl)[0];i.innerHTML=`<div class="side-kicker">РАЗБОР</div><h3>${s.trades?'Что видно из журнала':'Аналитика появится после первых сделок'}</h3><div class="insight-list"><div><span>Лучший день</span><b>${best?`${formatDate(best.date)} · ${formatMoney(best.pnl)}`:'—'}</b></div><div><span>Худший день</span><b>${worst?`${formatDate(worst.date)} · ${formatMoney(worst.pnl)}`:'—'}</b></div><div><span>Средний payout</span><b>${s.avgPayout.toFixed(1)}%</b></div></div>`;st.innerHTML=`<div class="side-kicker">СЕРИИ</div><h3>Дисциплина результата</h3><div class="streak-grid"><div><strong>${s.maxWin}</strong><span>макс. Win подряд</span></div><div><strong>${s.maxLoss}</strong><span>макс. Loss подряд</span></div><div><strong>${s.wins}</strong><span>всего Win</span></div><div><strong>${s.losses}</strong><span>всего Loss</span></div></div>`}
function renderResultBars(){const box=document.getElementById('resultBars');if(!box)return;const s=stats(state.trades),max=Math.max(s.wins,s.losses,s.draws,1);box.innerHTML=[['win','Win',s.wins],['loss','Loss',s.losses],['draw','Draw',s.draws]].map(([c,n,v])=>`<div class="result-row ${c}"><div class="line"><span>${n}</span><b>${v}</b></div><div class="track"><i style="width:${v/max*100}%"></i></div></div>`).join('')}
async function compressTradePhoto(file){
  if(!file||!String(file.type||'').startsWith('image/')) return '';
  const max=1500;
  try{
    const src=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});
    const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src});
    const scale=Math.min(1,max/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height));
    const w=Math.max(1,Math.round((img.naturalWidth||img.width)*scale)),h=Math.max(1,Math.round((img.naturalHeight||img.height)*scale));
    const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);
    return c.toDataURL('image/jpeg',.78);
  }catch{return ''}
}
function openTradePhoto(data){
  if(!data)return;
  const box=document.getElementById('modalContent');
  if(!box)return;
  box.innerHTML=`<div class="photo-viewer">
    <div class="photo-viewer-head">
      <div><div class="eyebrow">TRADE MATERIAL</div><h2>Фото сделки</h2><div class="sub">Разметка поверх фото для быстрого мини-анализа. Она не изменяет и не сохраняет оригинал.</div></div>
    </div>
    <div class="photo-tools" role="toolbar" aria-label="Инструменты разметки">
      <button type="button" class="photo-tool active" data-photo-tool="brush">Кисть</button>
      <button type="button" class="photo-tool" data-photo-tool="line">Линия</button>
      <button type="button" class="photo-tool" data-photo-tool="arrow">Стрелка</button>
      <button type="button" class="photo-tool" data-photo-tool="eraser">Ластик</button>
      <button type="button" class="photo-tool" id="photoUndo">↶ Отменить</button>
      <button type="button" class="photo-tool danger" id="photoClear">Очистить</button>
      <label class="photo-size">Толщина <input id="photoBrushSize" type="range" min="1" max="12" step="1" value="3"></label>
    </div>
    <div class="photo-viewer-stage" id="photoViewerStage">
      <div class="photo-canvas-wrap" id="photoCanvasWrap">
        <img src="${escapeAttr(data)}" alt="Фото сделки" id="tradePhotoViewerImg">
        <canvas id="tradePhotoDraw" aria-label="Временная разметка фото"></canvas>
      </div>
      <div class="photo-viewer-empty" id="photoViewerEmpty">Не удалось загрузить изображение.</div>
    </div>
    <div class="photo-viewer-hint">Кисть — свободная разметка · Линия — уровень/тренд · Стрелка — точка входа или выхода. После закрытия всё нарисованное стирается.</div>
  </div>`;
  document.getElementById('modal')?.classList.add('photo-viewer-modal');
  openModal();

  const img=document.getElementById('tradePhotoViewerImg'),empty=document.getElementById('photoViewerEmpty'),canvas=document.getElementById('tradePhotoDraw'),wrap=document.getElementById('photoCanvasWrap');
  const ctx=canvas?.getContext('2d');
  if(!img||!canvas||!wrap||!ctx)return;
  let tool='brush',drawing=false,startX=0,startY=0,snapshot=null;
  const history=[];

  const setCanvasSize=()=>{
    const rect=img.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    const dpr=window.devicePixelRatio||1;
    canvas.width=Math.max(1,Math.round(rect.width*dpr));canvas.height=Math.max(1,Math.round(rect.height*dpr));
    canvas.style.width=rect.width+'px';canvas.style.height=rect.height+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.lineCap='round';ctx.lineJoin='round';
  };
  const point=e=>{const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}};
  const capture=()=>{try{history.push(ctx.getImageData(0,0,canvas.width,canvas.height));if(history.length>20)history.shift()}catch{}};
  const restore=imgData=>{if(!imgData)return;const dpr=window.devicePixelRatio||1;ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.putImageData(imgData,0,0);ctx.restore();ctx.setTransform(dpr,0,0,dpr,0,0)};
  const drawArrow=(x1,y1,x2,y2)=>{const a=Math.atan2(y2-y1,x2-x1),head=12;ctx.beginPath();ctx.moveTo(x2,y2);ctx.lineTo(x2-head*Math.cos(a-Math.PI/6),y2-head*Math.sin(a-Math.PI/6));ctx.moveTo(x2,y2);ctx.lineTo(x2-head*Math.cos(a+Math.PI/6),y2-head*Math.sin(a+Math.PI/6));ctx.stroke()};
  const setTool=t=>{tool=t;document.querySelectorAll('[data-photo-tool]').forEach(b=>b.classList.toggle('active',b.dataset.photoTool===t))};
  document.querySelectorAll('[data-photo-tool]').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.photoTool)));
  document.getElementById('photoBrushSize')?.addEventListener('input',e=>{ctx.lineWidth=Number(e.target.value)||3});
  document.getElementById('photoUndo')?.addEventListener('click',()=>{const prev=history.pop();if(prev)restore(prev);});
  document.getElementById('photoClear')?.addEventListener('click',()=>{capture();ctx.clearRect(0,0,canvas.clientWidth,canvas.clientHeight)});

  canvas.addEventListener('pointerdown',e=>{
    e.preventDefault();canvas.setPointerCapture?.(e.pointerId);const p=point(e);drawing=true;startX=p.x;startY=p.y;
    capture();snapshot=ctx.getImageData(0,0,canvas.width,canvas.height);ctx.lineWidth=Number(document.getElementById('photoBrushSize')?.value)||3;ctx.strokeStyle='#ffcf33';ctx.globalCompositeOperation=tool==='eraser'?'destination-out':'source-over';
    if(tool==='brush'||tool==='eraser'){ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+.1,p.y+.1);ctx.stroke()}
  });
  canvas.addEventListener('pointermove',e=>{
    if(!drawing)return;e.preventDefault();const p=point(e);
    if(tool==='brush'||tool==='eraser'){ctx.beginPath();ctx.moveTo(startX,startY);ctx.lineTo(p.x,p.y);ctx.stroke();startX=p.x;startY=p.y;return}
    restore(snapshot);ctx.globalCompositeOperation='source-over';ctx.beginPath();ctx.moveTo(startX,startY);ctx.lineTo(p.x,p.y);ctx.stroke();if(tool==='arrow')drawArrow(startX,startY,p.x,p.y);
  });
  const finish=e=>{if(!drawing)return;drawing=false;canvas.releasePointerCapture?.(e.pointerId);ctx.globalCompositeOperation='source-over';snapshot=null};
  canvas.addEventListener('pointerup',finish);canvas.addEventListener('pointercancel',finish);

  const cleanup=()=>{window.removeEventListener('resize',resize);document.getElementById('modalClose')?.removeEventListener('click',cleanup);document.getElementById('modalBackdrop')?.removeEventListener('click',backdropCleanup)};
  const resize=()=>{setCanvasSize()};
  const backdropCleanup=e=>{if(e.target.id==='modalBackdrop')cleanup()};
  window.addEventListener('resize',resize);
  document.getElementById('modalClose')?.addEventListener('click',cleanup);
  document.getElementById('modalBackdrop')?.addEventListener('click',backdropCleanup);
  img.addEventListener('error',()=>{img.style.display='none';if(empty)empty.style.display='grid';canvas.style.display='none';wrap.style.display='none';cleanup()});
  img.addEventListener('load',()=>{setCanvasSize();ctx.lineWidth=3;ctx.strokeStyle='#ffcf33';ctx.globalCompositeOperation='source-over'});
  if(img.complete)img.dispatchEvent(new Event('load'));
}

function openTradeModal(id){
  const t=id?state.trades.find(x=>x.id===id):null;
  const instOptions=state.instruments.reduce((o,i)=>{(o[i.category]??=[]).push(i);return o},{});
  const instrumentHtml=Object.entries(instOptions).map(([cat,list])=>`<optgroup label="${cat}">${list.map(i=>`<option value="${escapeAttr(i.name)}" ${t?.instrument===i.name?'selected':''}>${escapeHtml(i.name)}</option>`).join('')}</optgroup>`).join('');
  const type=t?.type||'CALL', result=t?.result||'draw';
  document.getElementById('modalContent').innerHTML=`
    <div class="trade-modal-head"><div><div class="eyebrow">TRADE JOURNAL</div><h2>${t?'Редактировать сделку':'Новая сделка'}</h2><div class="sub">Заполните ключевые параметры сделки. P&amp;L рассчитывается автоматически.</div></div><div class="trade-modal-mark">↗</div></div>
    <form id="tradeForm">
      <div class="trade-form-section"><div class="form-section-title"><span>01</span><div><b>Контекст</b><small>Когда и чем торговали</small></div></div><div class="modal-form">
        <label>Дата<input name="date" type="date" value="${t?.date||localDateKey()}" required></label>
        <label>Время<input name="time" type="time" value="${t?.time||localParts().hour+':'+localParts().minute}" required></label>
        <label class="full">Инструмент<select name="instrument" required>${instrumentHtml}</select></label>
      </div></div>
      <div class="trade-form-section"><div class="form-section-title"><span>02</span><div><b>Позиция</b><small>Направление и параметры входа</small></div></div><div class="modal-form">
        <div class="choice-field full"><span class="field-caption">Направление</span><div class="choice-grid direction-grid">
          <label class="trade-choice call-choice"><input type="radio" name="type" value="CALL" ${type==='CALL'?'checked':''}><span class="choice-arrow">↑</span><span><b>Вверх</b><small>CALL</small></span></label>
          <label class="trade-choice put-choice"><input type="radio" name="type" value="PUT" ${type==='PUT'?'checked':''}><span class="choice-arrow">↓</span><span><b>Вниз</b><small>PUT</small></span></label>
        </div></div>
        <label>Ставка (${state.settings.currency})<input name="stake" type="number" min="0" step="0.01" value="${t?.stake??''}" required></label>
        <label>Payout, %<input name="payout" type="number" min="0" max="100" step="0.01" value="${t?.payout??''}" required></label>
        <label>Экспирация<input name="expiration" type="text" placeholder="например 1m / 5m" value="${escapeAttr(t?.expiration||'')}"></label>
      </div></div>
      <div class="trade-form-section"><div class="form-section-title"><span>03</span><div><b>Результат</b><small>Фактический исход и состояние</small></div></div><div class="modal-form">
        <div class="choice-field full"><span class="field-caption">Исход сделки</span><div class="choice-grid result-grid">
          <label class="trade-choice result-win"><input type="radio" name="result" value="win" ${result==='win'?'checked':''}><span class="choice-dot">+</span><span><b>В плюсе</b><small>Win</small></span></label>
          <label class="trade-choice result-loss"><input type="radio" name="result" value="loss" ${result==='loss'?'checked':''}><span class="choice-dot">−</span><span><b>В минусе</b><small>Loss</small></span></label>
          <label class="trade-choice result-draw"><input type="radio" name="result" value="draw" ${result==='draw'?'checked':''}><span class="choice-dot">=</span><span><b>В нуле</b><small>Draw</small></span></label>
        </div></div>
        <label>Стратегия<select name="strategy">${state.strategies.map(s=>{const name=typeof s==='string'?s:(s.name||'');return `<option ${t?.strategy===name?'selected':''}>${escapeHtml(name)}</option>`}).join('')}</select></label>
        <label>Состояние<select name="state"><option value="calm" ${t?.state==='calm'?'selected':''}>Спокойствие</option><option value="focused" ${t?.state==='focused'?'selected':''}>Сфокусирован</option><option value="fear" ${t?.state==='fear'?'selected':''}>Страх</option><option value="tired" ${t?.state==='tired'?'selected':''}>Усталость</option><option value="greed" ${t?.state==='greed'?'selected':''}>Азарт</option><option value="revenge" ${t?.state==='revenge'?'selected':''}>Реванш</option></select></label>
        <label class="full">Заметка<textarea name="note" placeholder="Почему вошёл? Что получилось?">${escapeHtml(t?.note||'')}</textarea></label>
      </div></div>
      <div class="trade-form-section"><div class="form-section-title"><span>04</span><div><b>Материалы сделки</b><small>Прикрепите скриншот графика или результата</small></div></div><div class="trade-photo-box"><label class="photo-upload"><input id="tradePhotoInput" name="photo" type="file" accept="image/*"><span>＋ Прикрепить фото</span><small>Изображение автоматически сжимается перед сохранением</small></label><div id="tradePhotoPreview" class="trade-photo-preview">${t?.photoData?`<img src="${t.photoData}" alt="Фото сделки"><button type="button" class="mini-btn" id="removeTradePhoto">Удалить фото</button>`:'<span>Фото не прикреплено</span>'}</div></div></div>
      <div class="calc-box"><div><span>Текущий расчёт</span><small>Win = ставка × payout / 100 · Loss = −ставка · Draw = 0</small></div><b id="livePnl">${formatMoney(t?.pnl||0)}</b></div>
      <div class="modal-actions"><button type="button" class="secondary-btn" id="cancelModal">Отмена</button><button class="primary-btn">${t?'Сохранить сделку':'Добавить сделку'}</button></div>
    </form>`;
  openModal();
  const form=document.getElementById('tradeForm');
  const update=()=>{const f=new FormData(form);const temp={stake:Number(f.get('stake'))||0,payout:Number(f.get('payout'))||0,result:f.get('result')};const p=calculatePnl(temp);const el=document.getElementById('livePnl');el.textContent=formatMoney(p);el.className=p>0?'positive':p<0?'negative':'neutral'};
  form.addEventListener('input',update);form.addEventListener('change',update);
  let photoData=t?.photoData||'';
  const photoInput=document.getElementById('tradePhotoInput'),photoPreview=document.getElementById('tradePhotoPreview');
  photoInput?.addEventListener('change',async()=>{const file=photoInput.files?.[0];if(!file)return;const data=await compressTradePhoto(file);if(!data){toast('Не удалось обработать изображение',true);return}photoData=data;if(photoPreview)photoPreview.innerHTML=`<img src="${data}" alt="Фото сделки"><button type="button" class="mini-btn" id="removeTradePhoto">Удалить фото</button>`});
  document.getElementById('removeTradePhoto')?.addEventListener('click',()=>{photoData='';if(photoInput)photoInput.value='';if(photoPreview)photoPreview.innerHTML='<span>Фото не прикреплено</span>'});
  form.onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(form));const obj={id:t?.id||uid(),syncKey:t?.syncKey||('local:'+crypto.randomUUID()),date:f.date,time:f.time,instrument:f.instrument,type:f.type,expiration:f.expiration,stake:Number(f.stake)||0,payout:Math.min(100,Math.max(0,Number(f.payout)||0)),result:f.result,pnl:0,strategy:f.strategy,platform:'Manual',state:f.state,note:f.note,category:findInstrument(f.instrument)?.category||'Custom',photoData};obj.pnl=calculatePnl(obj);if(t)state.trades=state.trades.map(x=>x.id===t.id?obj:x);else state.trades.push(obj);saveState();closeModal();toast(t?'Сделка обновлена':'Сделка добавлена')};
  document.getElementById('cancelModal').onclick=closeModal;update();
}
async function checkCloudConnection(){
  const status=document.getElementById('cloudCheckStatus');
  const button=document.getElementById('checkCloudConnection');
  if(status)status.textContent='Проверяем соединение…';
  if(button)button.disabled=true;
  try{
    if(!window.supabaseClient){
      if(status)status.textContent='✕ Supabase client не инициализирован';
      return;
    }
    const {data:{session}={data:null},error:sessionError}=await window.supabaseClient.auth.getSession();
    if(sessionError)throw sessionError;
    if(!session?.user){
      if(status)status.textContent='⚠ Supabase доступен, но пользователь не авторизован';
      return;
    }
    const {count,error}=await window.supabaseClient.from('trades').select('id',{count:'exact',head:true}).eq('user_id',session.user.id).is('deleted_at',null);
    if(error)throw error;
    if(status)status.textContent=`✓ Связь работает · пользователь авторизован · активных сделок в облаке: ${Number(count||0)}`;
  }catch(error){
    console.error('Cloud connection check:',error);
    if(status)status.textContent=`✕ Ошибка связи: ${cloudErrorTextSafe(error)}`;
  }finally{
    if(button)button.disabled=false;
  }
}
function cloudErrorTextSafe(error){return [error?.code,error?.message,error?.details,error?.hint].filter(Boolean).join(' · ')||'неизвестная ошибка';}

async function auditTradesIntegrity(){
  const local=[...(state.trades||[])];
  const issues=[];
  const seenIds=new Set(),seenKeys=new Set();
  const keyFields=['date','time','instrument','category','type','expiration','stake','payout','result','strategy','platform','note','closeDate','closeTime','openPrice','closePrice','currency'];
  for(const t of local){
    if(t.id&&seenIds.has(String(t.id)))issues.push(`Дублирующийся локальный ID: ${t.id}`);
    if(t.id)seenIds.add(String(t.id));
    if(t.syncKey&&seenKeys.has(String(t.syncKey)))issues.push(`Дублирующийся sync_key: ${t.syncKey}`);
    if(t.syncKey)seenKeys.add(String(t.syncKey));
    const expected=calculatePnl(t);
    if(Math.abs(Number(t.pnl||0)-Number(expected||0))>0.001)issues.push(`Неверный P&L: ${t.date||'?'} ${t.time||'?'} ${t.instrument||'?'} — сохранено ${t.pnl}, должно быть ${expected}`);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(t.date||'')))issues.push(`Некорректная дата: ${t.date||'(пусто)'}`);
    if(t.time&&!/^\d{2}:\d{2}/.test(String(t.time)))issues.push(`Некорректное время: ${t.date||'?'} ${t.time}`);
    if(Number(t.payout)<0||Number(t.payout)>100)issues.push(`Некорректный payout: ${t.date||'?'} ${t.instrument||'?'} — ${t.payout}%`);
    if(Number(t.stake)<=0)issues.push(`Некорректная ставка: ${t.date||'?'} ${t.instrument||'?'} — ${t.stake}`);
    if(!['win','loss','draw'].includes(String(t.result||'')))issues.push(`Некорректный result: ${t.date||'?'} ${t.instrument||'?'} — ${t.result}`);
  }
  let cloudRows=null;
  let cloudError='';
  if(window.currentUser?.id&&window.supabaseClient){
    try{cloudRows=await cloudSelectAll('trades',window.currentUser.id,'*','trade_date',false,true);}
    catch(e){cloudError=e?.message||String(e);}
  }
  let cloudOnly=[],localOnly=[],mismatches=[];
  if(cloudRows){
    const byKey=new Map(cloudRows.filter(r=>r.sync_key).map(r=>[String(r.sync_key),r]));
    const localKeys=new Set(local.filter(t=>t.syncKey).map(t=>String(t.syncKey)));
    cloudOnly=cloudRows.filter(r=>r.sync_key&&!localKeys.has(String(r.sync_key)));
    const localByKey=new Map(local.filter(t=>t.syncKey).map(t=>[String(t.syncKey),t]));
    for(const [key,t] of localByKey){
      const r=byKey.get(key);
      if(!r){localOnly.push(t);continue;}
      for(const f of keyFields){
        const a=f==='date'?t.date:f==='time'?t.time:f==='instrument'?t.instrument:f==='category'?t.category:f==='type'?t.type:f==='expiration'?t.expiration:f==='stake'?Number(t.stake):f==='payout'?Number(t.payout):f==='result'?t.result:f==='strategy'?t.strategy:f==='platform'?t.platform:f==='note'?t.note:f==='closeDate'?t.closeDate:f==='closeTime'?t.closeTime:f==='openPrice'?t.openPrice:f==='closePrice'?t.closePrice:f==='currency'?t.currency:'';
        const b=f==='date'?r.trade_date:f==='time'?String(r.trade_time||'').slice(0,5):f==='instrument'?r.instrument:f==='category'?r.instrument_category:f==='type'?r.direction:f==='expiration'?r.expiration:f==='stake'?Number(r.stake):f==='payout'?Number(r.payout):f==='result'?r.result:f==='strategy'?r.strategy:f==='platform'?r.account:f==='note'?r.note:f==='closeDate'?r.close_trade_date:f==='closeTime'?String(r.close_trade_time||'').slice(0,8):f==='openPrice'?(r.open_price==null?null:Number(r.open_price)):f==='closePrice'?(r.close_price==null?null:Number(r.close_price)):f==='currency'?r.source_currency:'';
        if(String(a??'')!==String(b??'')){mismatches.push(`${t.date||'?'} ${t.time||'?'} ${t.instrument||'?'} — ${f}: local="${a??''}" / cloud="${b??''}"`);break;}
      }
    }
  }
  const html=`<h2>Проверка целостности сделок</h2><div class="sub">Проверены локальные данные и, если доступно, активные записи Supabase.</div>
  <div class="audit-grid">
    <div><b>${local.length}</b><span>локальных сделок</span></div>
    <div><b>${cloudRows?cloudRows.length:'—'}</b><span>активных в облаке</span></div>
    <div><b>${localOnly.length}</b><span>только локально</span></div>
    <div><b>${cloudOnly.length}</b><span>только в облаке</span></div>
    <div><b>${mismatches.length}</b><span>расхождений параметров</span></div>
    <div><b>${issues.length}</b><span>локальных ошибок</span></div>
  </div>
  ${cloudError?`<div class="audit-warning">Не удалось проверить Supabase: ${escapeHtml(cloudError)}</div>`:''}
  ${issues.length?`<div class="audit-section"><h3>Ошибки данных</h3><ul>${issues.slice(0,20).map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div>`:'<div class="audit-ok">Локальные проверки параметров не нашли ошибок.</div>'}
  ${localOnly.length?`<div class="audit-section"><h3>Есть локально, но не найдено в облаке</h3><ul>${localOnly.slice(0,10).map(t=>`<li>${escapeHtml(`${t.date||'?'} ${t.time||'?'} ${t.instrument||'?'} ${t.type||''} ${t.stake||''}`)}</li>`).join('')}</ul></div>`:''}
  ${cloudOnly.length?`<div class="audit-section"><h3>Есть в облаке, но не найдено локально</h3><ul>${cloudOnly.slice(0,10).map(t=>`<li>${escapeHtml(`${t.trade_date||'?'} ${String(t.trade_time||'').slice(0,5)} ${t.instrument||'?'} ${t.direction||''} ${t.stake||''}`)}</li>`).join('')}</ul></div>`:''}
  ${mismatches.length?`<div class="audit-section"><h3>Расхождения параметров</h3><ul>${mismatches.slice(0,20).map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div>`:''}
  <div class="modal-actions"><button type="button" class="primary-btn" id="auditClose">Закрыть</button></div>`;
  document.getElementById('modal').classList.add('simple-modal');
  document.getElementById('modalContent').innerHTML=html;
  openModal();
  document.getElementById('auditClose').onclick=closeModal;
  const status=document.getElementById('cloudCheckStatus');
  if(status){
    status.textContent=cloudError?'⚠ Целостность проверена частично: есть ошибка связи с облаком':(issues.length||localOnly.length||cloudOnly.length||mismatches.length?'⚠ Проверка завершена: найдены расхождения':'✓ Целостность локальных и облачных данных подтверждена по доступным проверкам');
  }
}
async function deleteTrade(id){
  if(!confirm('Удалить сделку?'))return;
  const trade=state.trades.find(t=>String(t.id)===String(id));
  if(!trade)return;
  // Queue the tombstone first so an offline delete can never be resurrected
  // by the next login/sync. The cloud layer removes the tombstone only after
  // the update succeeds.
  if(window.queuePendingDelete)window.queuePendingDelete('trades',{id:trade.id,syncKey:trade.syncKey||''});
  if(window.currentUser?.id&&window.supabaseClient&&window.cloudDataReady){
    const q=window.supabaseClient.from('trades').update({deleted_at:new Date().toISOString()}).eq('user_id',window.currentUser.id);
    const {error}=await (trade.syncKey?q.eq('sync_key',trade.syncKey):q.eq('id',id));
    if(error){toast('Не удалось удалить сделку из облака — удаление сохранено для повторной синхронизации',true);}
    else if(window.removePendingDelete)window.removePendingDelete('trades',x=>String(x.id)===String(trade.id)||String(x.syncKey)===String(trade.syncKey||''));
  }
  state.trades=state.trades.filter(t=>String(t.id)!==String(id));
  saveLocalOnly();
  localStorage.setItem('tradingDiary_cloudTradesDirty','1');
  renderAll();
  toast('Сделка удалена');
}
async function deleteAllTrades(){
  if(!state.trades.length){toast('Сделок уже нет');return}
  if(!confirm(`Удалить ВСЕ ${state.trades.length} сделок? Это действие нельзя отменить.`))return;
  if(window.queuePendingDelete){for(const trade of state.trades)window.queuePendingDelete('trades',{id:trade.id,syncKey:trade.syncKey||''});}
  if(window.currentUser?.id&&window.supabaseClient&&window.cloudDataReady){
    const {error}=await window.supabaseClient.from('trades').update({deleted_at:new Date().toISOString()}).eq('user_id',window.currentUser.id);
    if(error){toast('Не удалось удалить сделки из облака — удаления сохранены для повторной синхронизации',true);}
    else if(window.removePendingDelete){for(const trade of state.trades)window.removePendingDelete('trades',x=>String(x.id)===String(trade.id)||String(x.syncKey)===String(trade.syncKey||''));}
  }
  state.trades=[];saveLocalOnly();localStorage.setItem('tradingDiary_cloudTradesDirty','1');renderAll();toast('Все сделки удалены');
}
async function resetWorkspace(){if(!confirm('Стереть все данные рабочего пространства? Будут удалены сделки, заметки, планы, цели, журнал, стратегии, инструменты и пополнения. Настройки и главная цель вернутся к исходным значениям.'))return;if(window.currentUser?.id&&window.supabaseClient&&window.cloudDataReady){const uid=window.currentUser.id;for(const table of ['trades','notes','plans','goals','journals','instruments','strategies','balance_operations','main_goals','settings']){const {error}=await window.supabaseClient.from(table).delete().eq('user_id',uid);if(error&&!(table==='balance_operations'&&['42P01','PGRST205'].includes(error.code))){toast(`Не удалось очистить ${table}`,true);return}}}state=clone(DEFAULT_DATA);state.deposits=[];saveLocalOnly();localStorage.removeItem('tradingDiary_cloudTradesDirty');localStorage.removeItem('tradingDiary_cloudWorkspaceDirty');renderAll();toast('Рабочее пространство очищено')}
function openBalanceOperationModal(type,existing=null){
  const isWithdrawal=type==='withdrawal';
  const title=existing?(isWithdrawal?'Редактировать вывод':'Редактировать пополнение'):(isWithdrawal?'Вывод средств':'Пополнение баланса');
  const sub=isWithdrawal?'Сумма списывается с баланса. Это не торговый P&L.':'Сумма добавляется к балансу. Это не торговый P&L.';
  const submit=f=>{
    state.deposits=state.deposits||[];
    const amount=Math.round(Math.max(0,Number(String(f.amount||'').replace(',','.'))||0)*100)/100;
    if(!amount){toast('Введите сумму больше 0',true);return}
    const currency=f.currency||state.settings.currency;
    const row=existing||{id:uid()};
    row.date=f.date||localDateKey();row.time=f.time||'00:00';row.amount=amount;row.currency=currency;row.baseAmount=round(convertCurrency(amount,currency,state.settings.currency));row.baseCurrency=state.settings.currency;row.note=f.note||'';row.operationType=type;
    if(!existing)state.deposits.push(row);
    state.deposits.sort((x,y)=>(x.date+' '+x.time).localeCompare(y.date+' '+y.time));
    saveState();renderAll();toast(existing?(isWithdrawal?'Вывод изменён':'Пополнение изменено'):(isWithdrawal?'Вывод добавлен':'Пополнение добавлено'));
  };
  openSimpleModal(title,sub,submit,[
    {name:'date',label:'Дата',type:'date',value:existing?.date||localDateKey()},
    {name:'time',label:'Время',type:'time',value:existing?.time||'00:00'},
    {name:'amount',label:'Сумма',type:'number',step:'0.01',min:'0.01',required:true,value:existing?Number(existing.amount||0).toFixed(2):'',placeholder:'100.00'},
    {name:'currency',label:'Валюта операции',type:'select',value:existing?.currency||state.settings.currency,options:DEFAULT_DATA.currencies.map(x=>x[0])},
    {name:'note',label:'Комментарий',type:'text',value:existing?.note||'',placeholder:isWithdrawal?'Вывод на карту / из платформы':'Пополнение с карты / платформы'}
  ]);
}
function editDeposit(id){return editBalanceOperation(id,'deposit')}
function editBalanceOperation(id,type){const d=(state.deposits||[]).find(x=>String(x.id)===String(id));if(!d)return;openBalanceOperationModal(type,d)}
function deleteBalanceOperation(id){const d=(state.deposits||[]).find(x=>String(x.id)===String(id));if(!d)return;const isWithdrawal=d.operationType==='withdrawal';if(!confirm(`${isWithdrawal?'Удалить этот вывод':'Удалить это пополнение'}?`))return;if(window.currentUser?.id&&window.supabaseClient&&window.cloudDataReady&&window.cloudBalanceSupported!==false){window.supabaseClient.from('balance_operations').delete().eq('user_id',window.currentUser.id).eq('id',id).then(({error})=>{if(error){toast('Не удалось удалить операцию из облака',true);return;}finishDeleteBalanceOperation(id,isWithdrawal)});return;}finishDeleteBalanceOperation(id,isWithdrawal)}
function finishDeleteBalanceOperation(id,isWithdrawal){state.deposits=(state.deposits||[]).filter(x=>String(x.id)!==String(id));saveLocalOnly();localStorage.setItem('tradingDiary_cloudWorkspaceDirty','1');renderAll();toast(isWithdrawal?'Вывод удалён':'Пополнение удалено')}
function togglePlan(id){const p=state.plans.find(x=>x.id===id);if(p){p.done=!p.done;saveState()}}
async function deletePlan(id){
  if(!confirm('Удалить задачу плана?'))return;
  if(window.queuePendingDelete)window.queuePendingDelete('plans',{id});
  if(window.currentUser?.id&&window.supabaseClient&&window.cloudDataReady){
    const {error}=await window.supabaseClient.from('plans').update({deleted_at:new Date().toISOString()}).eq('user_id',window.currentUser.id).eq('id',id);
    if(error)toast('Удаление сохранено для повторной синхронизации',true);
    else if(window.removePendingDelete)window.removePendingDelete('plans',x=>String(x.id)===String(id));
  }
  state.plans=state.plans.filter(x=>String(x.id)!==String(id));
  saveLocalOnly();
  localStorage.setItem('tradingDiary_cloudWorkspaceDirty','1');
  renderAll();
  toast('Задача удалена');
}
async function deleteNote(id){
  if(!confirm('Удалить заметку?'))return;
  if(window.queuePendingDelete)window.queuePendingDelete('notes',{id});
  if(window.currentUser?.id&&window.supabaseClient&&window.cloudDataReady){
    const {error}=await window.supabaseClient.from('notes').update({deleted_at:new Date().toISOString()}).eq('user_id',window.currentUser.id).eq('id',id);
    if(error)toast('Удаление сохранено для повторной синхронизации',true);
    else if(window.removePendingDelete)window.removePendingDelete('notes',x=>String(x.id)===String(id));
  }
  state.notes=state.notes.filter(x=>String(x.id)!==String(id));
  saveLocalOnly();
  localStorage.setItem('tradingDiary_cloudWorkspaceDirty','1');
  renderAll();
  toast('Заметка удалена');
}
async function deleteGoal(id){
  if(!confirm('Удалить эту цель?'))return;
  if(window.queuePendingDelete)window.queuePendingDelete('goals',{id});
  if(window.currentUser?.id&&window.supabaseClient&&window.cloudDataReady){
    const {error}=await window.supabaseClient.from('goals').delete().eq('user_id',window.currentUser.id).eq('id',id);
    if(error)toast('Удаление сохранено для повторной синхронизации',true);
    else if(window.removePendingDelete)window.removePendingDelete('goals',x=>String(x.id)===String(id));
  }
  state.goals=state.goals.filter(x=>String(x.id)!==String(id));
  saveLocalOnly();
  localStorage.setItem('tradingDiary_cloudWorkspaceDirty','1');
  renderAll();
  toast('Цель удалена');
}
function openSimpleModal(title,sub,submit,fields){document.getElementById('modal').classList.add('simple-modal');document.getElementById('modalContent').innerHTML=`<h2>${title}</h2><div class="sub">${sub}</div><form id="simpleForm"><div class="modal-form">${fields.map(f=>`<label class="${f.type==='textarea'?'full':''}">${f.label}${f.type==='select'?`<select name="${f.name}">${f.options.map(o=>`<option ${String(f.value??'')===String(o)?'selected':''}>${escapeHtml(o)}</option>`).join('')}</select>`:f.type==='textarea'?`<textarea name="${f.name}" placeholder="${escapeAttr(f.placeholder||'')}">${escapeHtml(f.value||'')}</textarea>`:`<input name="${f.name}" type="${f.type||'text'}" value="${escapeAttr(f.value??'')}" placeholder="${escapeAttr(f.placeholder||'')}" ${f.required?'required':''} ${f.step!=null?`step="${escapeAttr(f.step)}"`:''} ${f.min!=null?`min="${escapeAttr(f.min)}"`:''} ${f.max!=null?`max="${escapeAttr(f.max)}"`:''}>`}</label>`).join('')}</div><div class="modal-actions"><button type="button" class="secondary-btn" id="cancelModal">Отмена</button><button class="primary-btn">Сохранить</button></div></form>`;openModal();document.getElementById('cancelModal').onclick=closeModal;document.getElementById('simpleForm').onsubmit=e=>{e.preventDefault();submit(Object.fromEntries(new FormData(e.target)));closeModal()}}
function openModal(){const el=document.getElementById('modalBackdrop');if(!el)return;el.classList.add('open');el.classList.remove('show')};function closeModal(){const el=document.getElementById('modalBackdrop');if(!el)return;el.classList.remove('open','show');document.getElementById('modal')?.classList.remove('simple-modal','photo-viewer-modal')}
function updateClock(){const p=localParts();document.getElementById('liveDate').textContent=new Intl.DateTimeFormat('ru-RU',{timeZone:state.settings.timezone,day:'2-digit',month:'long',year:'numeric'}).format(new Date());document.getElementById('liveTime').textContent=`${p.hour}:${p.minute}:${p.second}`;document.getElementById('liveZone').textContent=state.settings.timezone}
function formatDate(d){if(!d)return'—';const [y,m,day]=d.split('-');return state.settings.dateFormat==='YYYY-MM-DD'?d:state.settings.dateFormat==='MM/DD/YYYY'?`${m}/${day}/${y}`:`${day}.${m}.${y}`}
function toast(msg,error=false){const el=document.createElement('div');el.className='toast'+(error?' error':'');el.textContent=msg;document.getElementById('toastContainer').appendChild(el);setTimeout(()=>el.remove(),2600)}
function escapeHtml(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}function escapeAttr(s){return escapeHtml(s).replace(/`/g,'&#96;')}
function importJsonFile(e){const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=()=>{try{const x=JSON.parse(r.result);if(!Array.isArray(x.trades))throw new Error();state={...state,...x,settings:{...state.settings,...(x.settings||{})}};saveState();toast('JSON импортирован')}catch{toast('Не удалось импортировать JSON',true)}e.target.value=''};r.readAsText(file)}
function importCsvFile(e){const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=()=>{try{const rows=parseCsv(r.result);if(!rows.length)throw new Error();state.trades.push(...rows);saveState();toast(`Импортировано сделок: ${rows.length}`)}catch{toast('Не удалось распознать CSV',true)}e.target.value=''};r.readAsText(file)}

function applyAppearancePreset(name){
  const presets={
    midnight:{theme:'dark',primary:'#0b1220',secondary:'#151f31',accent:'teal'},
    carbon:{theme:'dark',primary:'#12151b',secondary:'#202630',accent:'arctic'},
    forest:{theme:'dark',primary:'#0d1916',secondary:'#172a22',accent:'forest'},
    ocean:{theme:'dark',primary:'#091b27',secondary:'#123547',accent:'arctic'},
    plum:{theme:'dark',primary:'#1a111d',secondary:'#2b1930',accent:'burgundy'},
    copper:{theme:'dark',primary:'#1b1410',secondary:'#302019',accent:'copper'},
    paper:{theme:'light',primary:'#edf2f4',secondary:'#ffffff',accent:'indigo'},
    ivory:{theme:'light',primary:'#f3eee3',secondary:'#fffaf0',accent:'copper'},
    mist:{theme:'light',primary:'#e8f0f4',secondary:'#f8fbfd',accent:'arctic'},
    sand:{theme:'light',primary:'#f0e8dc',secondary:'#fff9f0',accent:'copper'},
    sage:{theme:'light',primary:'#e8eee8',secondary:'#f7fbf7',accent:'forest'},
    lavender:{theme:'light',primary:'#eeeaf5',secondary:'#faf8fd',accent:'indigo'},
    navycoral:{theme:'dark',primary:'#101a2b',secondary:'#1b2b43',accent:'coral'},
    indigolime:{theme:'dark',primary:'#17152a',secondary:'#252342',accent:'lime'},
    slateorange:{theme:'dark',primary:'#151a20',secondary:'#27313a',accent:'orange'},
    tealrose:{theme:'dark',primary:'#0d2022',secondary:'#163638',accent:'rose'},
    auberginecyan:{theme:'dark',primary:'#1b1022',secondary:'#2d1940',accent:'cyan'},
    inkgold:{theme:'dark',primary:'#111315',secondary:'#25231c',accent:'gold'}
  };
  const preset=presets[name];if(!preset)return;
  state.settings.appearance={...state.settings.appearance,...preset,preset:name};
  saveState();applyAppearance();renderSettings();toast(`Тема «${name}» применена`);
}
function resetAppearanceSettings(){applyAppearancePreset('midnight')}
function saveAppearanceSettings(){applyAppearancePreset(state.settings.appearance?.preset||'midnight')}
function renderCalendar(){
  const box=document.getElementById('calendarGrid'); if(!box)return;
  const y=calendarCursor.getFullYear(),m=calendarCursor.getMonth();
  document.getElementById('calendarMonth').textContent=new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric'}).format(new Date(y,m,1));
  const first=new Date(y,m,1); const start=(first.getDay()+6)%7; const days=new Date(y,m+1,0).getDate();
  const names=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  const byDay={}; state.trades.forEach(t=>{if(!t.date)return;(byDay[t.date]??=[]).push(t)});
  let html=names.map(n=>`<div class="calendar-weekday">${n}</div>`).join('');
  for(let i=0;i<start;i++)html+='<div class="calendar-day muted-day"></div>';
  for(let d=1;d<=days;d++){const key=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;const ts=byDay[key]||[];const pnl=ts.reduce((a,t)=>a+(Number(t.pnl)||0),0);const cls=!ts.length?'empty':pnl>0?'profit':pnl<0?'loss':'flat';html+=`<button class="calendar-day ${cls}" data-calendar-date="${key}"><span>${d}</span>${ts.length?`<small>${pnl>=0?'+':''}${formatMoneyPlain(pnl)}</small><em>${ts.length} сдел.</em>`:''}</button>`}
  box.innerHTML=html;
}
function renderPlaybook(){const box=document.getElementById('playbookGrid');if(!box)return;const all=state.trades;box.innerHTML=state.strategies.map((raw,i)=>{const name=typeof raw==='string'?raw:(raw.name||'');const description=typeof raw==='string'?'':(raw.description||'');const ts=all.filter(t=>(t.strategy||'Без стратегии')===name);const s=stats(ts);const avgStake=ts.length?ts.reduce((a,t)=>a+Number(t.stake||0),0)/ts.length:0;return `<article class="card playbook-card"><div class="playbook-top"><div class="playbook-icon">◈</div><span class="strategy-index">${String(i+1).padStart(2,'0')}</span></div><div class="playbook-title"><div><h3>${escapeHtml(name)}</h3><p>${escapeHtml(description||'Добавьте правило стратегии в настройках, затем проверяйте его на фактических сделках.')}</p></div><span class="strategy-rate">${s.winRate.toFixed(1)}%</span></div><div class="playbook-metrics"><div><span>Сделки</span><b>${s.trades}</b></div><div><span>P&amp;L</span><b class="${s.pnl>0?'positive':s.pnl<0?'negative':''}">${formatMoney(s.pnl)}</b></div><div><span>Средний</span><b>${formatMoney(s.avg)}</b></div><div><span>Средняя ставка</span><b>${formatMoneyPlain(avgStake)}</b></div></div><div class="playbook-progress"><div><span>Win rate</span><b>${s.winRate.toFixed(1)}%</b></div><i><em style="width:${Math.min(100,s.winRate)}%"></em></i></div></article>`}).join('')||'<div class="empty-inline">Добавьте первую стратегию, чтобы построить Playbook.</div>'}

function renderPsychologyFull(){
  const box=document.getElementById('psychologyFull');if(!box)return;
  const trades=[...(state.trades||[])].filter(t=>t&&t.date).sort((a,b)=>tradeDate(a)-tradeDate(b));
  if(!trades.length){box.innerHTML='<div class="empty-inline">Добавьте сделки и укажите состояние, чтобы построить психологический профиль.</div>';return;}
  const labels={calm:'Спокойствие',focused:'Фокус',fear:'Страх',tired:'Усталость',greed:'Азарт',revenge:'Реванш',neutral:'Не указано'};
  const stateMap=new Map();let totalStake=0,totalPnl=0,wins=0;
  let maxLossStreak=0,currentLossStreak=0,maxWinStreak=0,currentWinStreak=0;
  let stakeIncreaseAfterLoss=0,stakeIncreaseAfterWin=0,lossTransitions=0,winTransitions=0;const hourMap=new Map();
  for(let i=0;i<trades.length;i++){
    const t=trades[i],key=t.state||'neutral',stake=Number(t.stake)||0,pnl=Number(t.pnl)||0;totalStake+=stake;totalPnl+=pnl;
    if(t.result==='win'){wins++;currentWinStreak++;currentLossStreak=0;maxWinStreak=Math.max(maxWinStreak,currentWinStreak);}
    else if(t.result==='loss'){currentLossStreak++;currentWinStreak=0;maxLossStreak=Math.max(maxLossStreak,currentLossStreak);}
    else{currentWinStreak=0;currentLossStreak=0;}
    if(i>0){const prev=trades[i-1];if(prev.result==='loss'){lossTransitions++;if(stake>Number(prev.stake||0))stakeIncreaseAfterLoss++;}if(prev.result==='win'){winTransitions++;if(stake>Number(prev.stake||0))stakeIncreaseAfterWin++;}}
    const bucket=stateMap.get(key)||{trades:0,wins:0,pnl:0,stake:0};bucket.trades++;bucket.wins+=t.result==='win'?1:0;bucket.pnl+=pnl;bucket.stake+=stake;stateMap.set(key,bucket);
    const h=String(t.time||'').slice(0,2);if(/^\d{2}$/.test(h))hourMap.set(h,(hourMap.get(h)||0)+1);
  }
  const winRate=trades.length?wins/trades.length*100:0,avgStake=totalStake/trades.length,avgPnl=totalPnl/trades.length;
  const lossReaction=lossTransitions?stakeIncreaseAfterLoss/lossTransitions*100:0,winReaction=winTransitions?stakeIncreaseAfterWin/winTransitions*100:0;
  const topHour=[...hourMap.entries()].sort((a,b)=>b[1]-a[1])[0];
  const stateCards=[...stateMap.entries()].sort((a,b)=>b[1].trades-a[1].trades).map(([key,v])=>{const rate=v.trades?v.wins/v.trades*100:0;return `<article class="card psychology-full-card"><div class="psychology-state"><span>●</span><h3>${escapeHtml(labels[key]||key)}</h3></div><div class="psychology-score">${rate.toFixed(1)}<small>% win rate</small></div><div class="playbook-metrics"><div><span>Сделки</span><b>${v.trades}</b></div><div><span>P&L</span><b class="${v.pnl>0?'positive':v.pnl<0?'negative':''}">${formatMoney(v.pnl)}</b></div><div><span>Средняя ставка</span><b>${formatMoneyPlain(v.trades?v.stake/v.trades:0)}</b></div></div></article>`}).join('');
  box.innerHTML=`<article class="card psychology-full-card"><div class="psychology-state"><span>◈</span><h3>Состояние системы</h3></div><div class="psychology-score">${winRate.toFixed(1)}<small>% общий win rate</small></div><div class="playbook-metrics"><div><span>Сделки</span><b>${trades.length}</b></div><div><span>Средний P&L</span><b class="${avgPnl>0?'positive':avgPnl<0?'negative':''}">${formatMoney(avgPnl)}</b></div><div><span>Средняя ставка</span><b>${formatMoneyPlain(avgStake)}</b></div></div></article><article class="card psychology-full-card"><div class="psychology-state"><span>↗</span><h3>Реакция на результат</h3></div><div class="playbook-metrics"><div><span>После LOSS ставка выше</span><b>${lossReaction.toFixed(1)}%</b></div><div><span>После WIN ставка выше</span><b>${winReaction.toFixed(1)}%</b></div><div><span>Макс. серия LOSS</span><b>${maxLossStreak}</b></div><div><span>Макс. серия WIN</span><b>${maxWinStreak}</b></div></div><p class="psych-caption">Показатель сравнивает каждую сделку со следующей по журналу и не делает выводов о причинах изменения ставки.</p></article><article class="card psychology-full-card"><div class="psychology-state"><span>◌</span><h3>Время и концентрация</h3></div><div class="playbook-metrics"><div><span>Самый частый час</span><b>${topHour?`${topHour[0]}:00`:'—'}</b></div><div><span>Сделок в этот час</span><b>${topHour?topHour[1]:0}</b></div><div><span>Итоговый P&L</span><b class="${totalPnl>0?'positive':totalPnl<0?'negative':''}">${formatMoney(totalPnl)}</b></div></div><p class="psych-caption">Час берётся из сохранённого времени сделки. Часовой пояс не угадывается.</p></article><div class="psychology-state-grid">${stateCards}</div>`;
}

