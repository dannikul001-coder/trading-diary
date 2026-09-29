const STORAGE_KEY='tradingDiary_v3';

function saveLocalOnly(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function clone(v){return JSON.parse(JSON.stringify(v))}
function loadState(){const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return clone(DEFAULT_DATA);try{const s=JSON.parse(raw);return {...clone(DEFAULT_DATA),...s,settings:{...clone(DEFAULT_DATA).settings,...(s.settings||{}),appearance:{...clone(DEFAULT_DATA).settings.appearance,...((s.settings||{}).appearance||{})}},profile:{...clone(DEFAULT_DATA).profile,...(s.profile||{})},mainGoal:{...clone(DEFAULT_DATA).mainGoal,...(s.mainGoal||{})},trades:Array.isArray(s.trades)?s.trades:[],notes:Array.isArray(s.notes)?s.notes:[],plans:Array.isArray(s.plans)?s.plans:[],goals:Array.isArray(s.goals)?s.goals:[],journal:s.journal||{},deposits:Array.isArray(s.deposits)?s.deposits:[],importHistory:Array.isArray(s.importHistory)?s.importHistory:[]}}catch{return clone(DEFAULT_DATA)}}
let state=loadState();
ensureTradeSyncKeys(state.trades);
function saveState(){
  saveLocalOnly();
  // Only mark cloud data dirty for the currently authenticated user.
  // Guest/local edits must never be pushed into whichever account is
  // signed in later.
  if(window.currentUser?.id){
    localStorage.setItem('tradingDiary_cloudTradesDirty','1');
    localStorage.setItem('tradingDiary_cloudWorkspaceDirty','1');
  }
  document.dispatchEvent(new CustomEvent('state:changed'));
  cloudSaveState();
}
function uid(){return 'id_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8)}
function exportJson(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});downloadBlob(blob,`trading-diary-${new Date().toISOString().slice(0,10)}.json`)}
function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
function csvEscape(v){return `"${String(v??'').replaceAll('"','""')}"`}
function exportCsv(){const headers=['id','date','time','instrument','category','type','expiration','stake','payout','result','pnl','strategy','platform','state','note'];const rows=state.trades.map(t=>headers.map(h=>csvEscape(t[h])).join(','));downloadBlob(new Blob([[headers.join(','),...rows].join('\n')],{type:'text/csv;charset=utf-8'}),`trading-diary-${new Date().toISOString().slice(0,10)}.csv`)}
function parseCsv(text){const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean);if(!lines.length)return[];const parseLine=line=>{let out=[],cur='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'&&line[i+1]==='"'){cur+='"';i++;continue}if(c==='"'){q=!q;continue}if(c===','&&!q){out.push(cur);cur='';continue}cur+=c}out.push(cur);return out};const headers=parseLine(lines[0]).map(x=>x.trim().toLowerCase());const aliases={date:['date','дата'],time:['time','время'],instrument:['instrument','asset','symbol','инструмент'],type:['type','direction','тип'],expiration:['expiration','expiry','экспирация'],stake:['stake','amount','investment','ставка','сумма'],payout:['payout','profit percent','payout %','выплата'],result:['result','outcome','результат'],strategy:['strategy','стратегия'],platform:['platform','account','платформа'],state:['state','psychology','состояние'],note:['note','notes','комментарий','заметка']};const idx={};Object.entries(aliases).forEach(([key,list])=>idx[key]=headers.findIndex(h=>list.includes(h)));return lines.slice(1).map(line=>{const vals=parseLine(line);const t={id:uid()};Object.entries(idx).forEach(([k,i])=>{if(i>=0)t[k]=vals[i]||''});t.stake=Number(String(t.stake||0).replace(',','.'))||0;t.payout=Number(String(t.payout||0).replace(',','.'))||0;t.result=String(t.result||'draw').toLowerCase();if(['win','profit','won','плюс','выигрыш'].some(x=>t.result.includes(x)))t.result='win';else if(['loss','lost','minus','минус','убыток'].some(x=>t.result.includes(x)))t.result='loss';else t.result='draw';t.pnl=calculatePnl(t);t.category=t.category||findInstrument(t.instrument)?.category||'Custom';t.type=(String(t.type||'CALL').toUpperCase().includes('PUT')?'PUT':'CALL');return t}).filter(t=>t.instrument)}
function calculatePnl(t){const stake=Number(t.stake)||0,payout=Number(t.payout)||0;if(t.result==='win')return round(stake*payout/100);if(t.result==='loss')return round(-stake);return 0}
function round(n){return Math.round((Number(n)||0)*100)/100}
function findInstrument(name){return state.instruments.find(i=>i.name.toLowerCase()===String(name||'').toLowerCase())}

// --- Supabase cloud sync ---
let cloudSyncBusy=false;
let cloudSyncTimer=null;
let cloudSyncQueue=Promise.resolve();
let cloudSyncBackoffUntil=0;
let cloudSyncLastError='';
const CLOUD_SYNC_DEBOUNCE_MS=350;
const CLOUD_SYNC_BACKOFF_MS=8000;
let cloudLoadBusy=false;
let cloudTradeExternalSupported=true;
let cloudBalanceSupported=true;
let cloudTradeOptionalColumns={
  external_trade_id:true,
  close_trade_date:true,
  close_trade_time:true,
  open_price:true,
  close_price:true,
  source_currency:true,
  photo_data:true
};
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const cloudKnown={trades:new Set(),notes:new Set(),plans:new Set(),goals:new Set(),instruments:new Set(),strategies:new Set(),journals:new Set(),deposits:new Set()};
const cloudLoaded={notes:false,plans:false,goals:false,journal:false,mainGoal:false,settings:false,instruments:false,strategies:false};
function isCloudUser(){return !!(window.currentUser&&window.supabaseClient&&window.cloudDataReady)}
function cloud(){return window.supabaseClient}
function notifyState(){saveLocalOnly();document.dispatchEvent(new CustomEvent('state:changed'))}

function stableTradeBaseKey(t){
  const external=String(t?.externalId||'').trim();
  if(external)return `ext:${external}`;
  return `sig:${String(t?.date||'')}|${String(t?.time||'')}|${String(t?.instrument||'').trim().toLowerCase()}|${String(t?.type||'CALL')}|${String(t?.expiration||'')}|${Number(t?.stake||0).toFixed(8)}|${Number(t?.payout||0).toFixed(8)}|${String(t?.result||'draw')}|${String(t?.closeDate||'')}|${String(t?.closeTime||'')}|${Number(t?.openPrice??0).toFixed(10)}|${Number(t?.closePrice??0).toFixed(10)}`;
}
function ensureTradeSyncKeys(trades){
  const used=new Set();
  for(const t of trades||[]){
    let key=String(t?.syncKey||'').trim() || stableTradeBaseKey(t);
    if(used.has(key)){let n=2;while(used.has(`${key}#${n}`))n++;key=`${key}#${n}`}
    t.syncKey=key;used.add(key);
  }
}
function tradeToCloudRow(t,userId){
  if(!t.syncKey)t.syncKey=stableTradeBaseKey(t);
  const row={...(UUID_RE.test(String(t.id||''))?{id:t.id}:{}),user_id:userId,sync_key:t.syncKey,trade_date:t.date,trade_time:t.time||null,instrument:t.instrument,instrument_category:t.category||'Custom',direction:t.type||'CALL',expiration:t.expiration||null,stake:Number(t.stake)||0,payout:Number(t.payout)||0,result:t.result||'draw',strategy:t.strategy||null,account:t.platform||'Manual',note:t.note||null};
  if(cloudTradeOptionalColumns.external_trade_id&&cloudTradeExternalSupported&&t.externalId)row.external_trade_id=t.externalId;
  if(cloudTradeOptionalColumns.close_trade_date)row.close_trade_date=t.closeDate||null;
  if(cloudTradeOptionalColumns.close_trade_time)row.close_trade_time=t.closeTime||null;
  if(cloudTradeOptionalColumns.open_price)row.open_price=t.openPrice==null?null:Number(t.openPrice);
  if(cloudTradeOptionalColumns.close_price)row.close_price=t.closePrice==null?null:Number(t.closePrice);
  if(cloudTradeOptionalColumns.source_currency)row.source_currency=t.currency||null;
  if(cloudTradeOptionalColumns.photo_data)row.photo_data=t.photoData||null;
  return row;
}

function missingCloudColumn(error){
  if(!error)return '';
  const message=String(error.message||'');
  const match=message.match(/Could not find the ['\"]([^'\"]+)['\"] column of the ['\"]trades['\"] table/i);
  return match?match[1]:'';
}

function disableMissingTradeColumn(column){
  if(!column)return false;
  if(Object.prototype.hasOwnProperty.call(cloudTradeOptionalColumns,column)){
    cloudTradeOptionalColumns[column]=false;
    if(column==='external_trade_id')cloudTradeExternalSupported=false;
    return true;
  }
  return false;
}
function cloudRowToTrade(r){const t={id:r.id,syncKey:r.sync_key||'',externalId:r.external_trade_id||'',date:r.trade_date,time:r.trade_time?String(r.trade_time).slice(0,5):'',instrument:r.instrument,type:r.direction,expiration:r.expiration||'',stake:Number(r.stake)||0,payout:Number(r.payout)||0,result:r.result||'draw',strategy:r.strategy||'Без стратегии',platform:r.account||'Manual',state:'calm',note:r.note||'',category:r.instrument_category||'Custom',closeDate:r.close_trade_date||'',closeTime:r.close_trade_time?String(r.close_trade_time).slice(0,8):'',openPrice:r.open_price==null?null:Number(r.open_price),closePrice:r.close_price==null?null:Number(r.close_price),currency:r.source_currency||'',photoData:r.photo_data||''};t.pnl=calculatePnl(t);return t}
function noteToCloudRow(n,userId){return{...(UUID_RE.test(String(n?.id||''))?{id:n.id}:{}),user_id:userId,note_date:n?.date||null,title:n?.title||'Наблюдение',content:n?.content??n?.text??'',tags:Array.isArray(n?.tags)?n.tags:[]}}
function planToCloudRow(p,userId){return{...(UUID_RE.test(String(p?.id||''))?{id:p.id}:{}),user_id:userId,plan_date:p?.date||null,task:p?.task||'',done:!!p?.done}}
function goalToCloudRow(g,userId){return{...(UUID_RE.test(String(g?.id||''))?{id:g.id}:{}),user_id:userId,period:g?.period||'',title:g?.title||'',target:Number(g?.target)||0,current_value:Number(g?.currentValue)||0}}
function instrumentToCloudRow(i,userId){return{...(UUID_RE.test(String(i?.id||''))?{id:i.id}:{}),user_id:userId,name:i?.name||'',symbol:i?.symbol||'',category:i?.category||'Custom'}}
function strategyToCloudRow(s,userId){return{...(UUID_RE.test(String(s?.id||''))?{id:s.id}:{}),user_id:userId,name:s?.name||'',description:s?.description||''}}
function cloudRowToNote(r){return{id:r.id,date:r.note_date||'',title:r.title||'Наблюдение',text:r.content||'',content:r.content||'',tags:Array.isArray(r.tags)?r.tags:(r.tags?String(r.tags).split(',').map(x=>x.trim()).filter(Boolean):[])}}
function cloudRowToPlan(r){return{id:r.id,date:r.plan_date||'',task:r.task||'',done:!!r.done}}
function cloudRowToGoal(r){return{id:r.id,period:r.period||'',title:r.title||'',target:Number(r.target)||0,currentValue:Number(r.current_value)||0}}
function cloudRowToInstrument(r){return{id:r.id,name:r.name||'',symbol:r.symbol||'',category:r.category||'Custom',custom:true}}
function cloudRowToStrategy(r){return{id:r.id,name:r.name||'',description:r.description||'',custom:true}}
function depositToCloudRow(d,userId){return{...(UUID_RE.test(String(d?.id||''))?{id:d.id}:{}),user_id:userId,operation_date:d?.date||null,operation_time:d?.time||'00:00',amount:Number(d?.amount)||0,note:d?.note||''}}
function cloudRowToDeposit(r){return{id:r.id,date:r.operation_date||'',time:r.operation_time?String(r.operation_time).slice(0,5):'00:00',amount:Number(r.amount)||0,note:r.note||''}}
function cloudRowToProfile(r){return{displayName:r?.display_name||'',avatarUrl:r?.avatar_url||''}}

async function cloudSelectAll(table, userId, columns='*', orderBy='created_at', ascending=true){
  if(!cloud()||!userId)return [];
  const pageSize=1000;
  const all=[];
  for(let from=0;;from+=pageSize){
    let q=cloud().from(table).select(columns).eq('user_id',userId);
    if(orderBy)q=q.order(orderBy,{ascending});
    const {data,error}=await q.range(from,from+pageSize-1);
    if(error)throw error;
    const rows=data||[];
    all.push(...rows);
    if(rows.length<pageSize)break;
  }
  return all;
}

async function loadCloudTrades(userId,options={}){
  if(!cloud()||!userId)return false;
  try{
    const rows=await cloudSelectAll('trades',userId,'*','trade_date',false);
    cloudKnown.trades=new Set(rows.map(r=>r.id));
    const dirty=localStorage.getItem('tradingDiary_cloudTradesDirty')==='1';

    // Never let a stale/truncated local cache overwrite a larger cloud journal.
    // This is especially important for the old 1000-row PostgREST limit.
    if(dirty && !options.skipMigration && state.trades.length>rows.length){
      const ok=await syncTradesToCloud(userId);
      if(ok){
        const refreshed=await cloudSelectAll('trades',userId,'*','trade_date',false);
        cloudKnown.trades=new Set(refreshed.map(r=>r.id));
        state.trades=refreshed.map(cloudRowToTrade);
        notifyState();
        return true;
      }
      return false;
    }

    // If cloud has more rows than the local cache, cloud is authoritative.
    // This prevents accidental deletion of older trades on login.
    if(rows.length>state.trades.length || !dirty || !state.trades.length){
      state.trades=rows.map(cloudRowToTrade);
      notifyState();
      localStorage.removeItem('tradingDiary_cloudTradesDirty');
      return true;
    }

    const ok=await syncTradesToCloud(userId);
    if(ok){
      const refreshed=await cloudSelectAll('trades',userId,'*','trade_date',false);
      state.trades=refreshed.map(cloudRowToTrade);
      notifyState();
    }
    return ok;
  }catch(error){
    console.error('Supabase trades load:',error);
    toast?.('Не удалось загрузить все сделки из облака',true);
    return false;
  }
}

async function syncTradesToCloud(userId){
  if(!cloud()||!userId||cloudSyncBusy)return false;
  cloudSyncBusy=true;
  let allOk=true;
  try{
    ensureTradeSyncKeys(state.trades);
    const batchSize=250;
    const coreKeys=['user_id','sync_key','trade_date','trade_time','instrument','instrument_category','direction','expiration','stake','payout','result','strategy','account','note'];
    const coreRow=row=>{const x={};for(const k of coreKeys)if(Object.prototype.hasOwnProperty.call(row,k))x[k]=row[k];return x};

    async function pushBatch(batchRows){
      let result=await cloud().from('trades').upsert(batchRows,{onConflict:'user_id,sync_key'}).select('id,sync_key');
      if(!result.error)return result;

      const missingColumn=missingCloudColumn(result.error);
      if(disableMissingTradeColumn(missingColumn)){
        const retry=batchRows.map(row=>{const x={...row};delete x[missingColumn];return x});
        result=await cloud().from('trades').upsert(retry,{onConflict:'user_id,sync_key'}).select('id,sync_key');
        if(!result.error)return result;
      }

      // If one row or one optional field is bad, do not block the other trades.
      // Retry rows individually and finally with the required core columns only.
      const returned=[];
      for(const row of batchRows){
        let one=await cloud().from('trades').upsert([row],{onConflict:'user_id,sync_key'}).select('id,sync_key');
        if(one.error){
          const missing=missingCloudColumn(one.error);
          if(disableMissingTradeColumn(missing)){
            const retry={...row};delete retry[missing];
            one=await cloud().from('trades').upsert([retry],{onConflict:'user_id,sync_key'}).select('id,sync_key');
          }
        }
        if(one.error){
          const core=coreRow(row);
          one=await cloud().from('trades').upsert([core],{onConflict:'user_id,sync_key'}).select('id,sync_key');
        }
        if(one.error){
          allOk=false;
          reportCloudSyncError('trades',one.error);
          console.error('Trading Diary V20: trade row sync failed',{
            syncKey:row.sync_key,
            code:one.error.code||'',
            message:one.error.message||'',
            details:one.error.details||'',
            hint:one.error.hint||''
          });
          continue;
        }
        returned.push(...(one.data||[]));
      }
      return {data:returned,error:null};
    }

    for(let i=0;i<state.trades.length;i+=batchSize){
      const batchTrades=state.trades.slice(i,i+batchSize);
      const batch=batchTrades.map(t=>tradeToCloudRow(t,userId));
      const result=await pushBatch(batch);
      const byKey=new Map((result.data||[]).map(r=>[String(r.sync_key),r.id]));
      for(const t of batchTrades){const id=byKey.get(String(t.syncKey));if(id)t.id=id;}
    }

    saveLocalOnly();
    if(allOk)localStorage.removeItem('tradingDiary_cloudTradesDirty');
    return allOk;
  }catch(error){
    reportCloudSyncError('trades',error);
    return false;
  }finally{cloudSyncBusy=false}
}
async function syncNotesRow(item,userId,remoteIds=new Set()){
  const row=noteToCloudRow(item,userId);
  const originalId=String(item?.id||'');
  const safeId=UUID_RE.test(originalId) && remoteIds.has(originalId)
    ? originalId
    : '';

  if(safeId) row.id=safeId;
  else delete row.id;

  const result=safeId
    ?await cloud().from('notes').update(row).eq('id',safeId).eq('user_id',userId).select().single()
    :await cloud().from('notes').insert(row).select().single();

  if(result.error){
    console.error('Supabase notes sync error details:',{
      message:result.error.message||'',
      details:result.error.details||'',
      hint:result.error.hint||'',
      code:result.error.code||'',
      row
    });
    throw result.error;
  }

  if(result.data?.id){
    item.id=result.data.id;
    remoteIds.delete(result.data.id);
    cloudKnown.notes.add(result.data.id);
  }
}

async function syncRows(table,rows,toRow,knownKey,userId=window.currentUser?.id){
  if(!cloud()||!userId)return;

  const remoteRows=await cloudSelectAll(table,userId,'id','created_at',true);
  const remoteIds=new Set(remoteRows.map(r=>r.id));

  for(const item of rows){
    const originalId=String(item?.id||'');
    const safeId=UUID_RE.test(originalId) && remoteIds.has(originalId)
      ? originalId
      : '';

    // Never send a local UUID that belongs to another account. With RLS,
    // an upsert of another user's row is correctly rejected. If the UUID is
    // not one of this user's remote rows, create a fresh row instead.
    const row=toRow(item,userId);
    if(safeId) row.id=safeId;
    else delete row.id;

    const result=safeId
      ?await cloud().from(table).update(row).eq('id',safeId).eq('user_id',userId).select().single()
      :await cloud().from(table).insert(row).select().single();

    if(result.error){
      console.error(`Supabase ${table} sync error details:`, {
        message:result.error.message||'',
        details:result.error.details||'',
        hint:result.error.hint||'',
        code:result.error.code||'',
        row
      });
      throw result.error;
    }

    if(result.data?.id){
      item.id=result.data.id;
      remoteIds.delete(result.data.id);
      cloudKnown[knownKey].add(result.data.id);
    }
  }

  // IMPORTANT: synchronization never deletes remote rows merely because a device
  // does not currently have them. Explicit delete actions call Supabase DELETE directly.
}

async function loadCloudWorkspace(userId){
  if(!cloud()||!userId||cloudLoadBusy)return;
  cloudLoadBusy=true;
  try{
  const workspaceDirty=localStorage.getItem('tradingDiary_cloudWorkspaceDirty')==='1';
  if(workspaceDirty){
    const ok=await syncWorkspace(userId,true);
    if(!ok){
      toast?.('Облачные изменения пока не синхронизированы — локальные данные сохранены',true);
      return false;
    }
  }
  const [cloudNotes,cloudPlans,cloudGoals,settings,mainGoal,cloudInstruments,cloudStrategies,cloudJournals,profileRow,cloudDeposits]=await Promise.all([
    cloudSelectAll('notes',userId,'*','created_at',false),
    cloudSelectAll('plans',userId,'*','plan_date',false),
    cloudSelectAll('goals',userId,'*','created_at',false),
    cloud().from('settings').select('*').eq('user_id',userId).maybeSingle(),
    cloud().from('main_goals').select('*').eq('user_id',userId).maybeSingle(),
    cloudSelectAll('instruments',userId,'*','created_at',true),
    cloudSelectAll('strategies',userId,'*','created_at',true),
    cloudSelectAll('journals',userId,'*','journal_date',false),
    cloud().from('profiles').select('id,display_name,avatar_url').eq('id',userId).maybeSingle(),
    cloudBalanceSupported?cloudSelectAll('balance_operations',userId,'*','operation_date',true).catch(error=>{
      if(['42P01','PGRST205'].includes(error?.code)){cloudBalanceSupported=false;return [];}
      throw error;
    }):Promise.resolve([])
  ]);
  const cloudJournalsRows=cloudJournals||[], cloudDepositRows=cloudDeposits||[];
  cloudKnown.notes=new Set(cloudNotes.map(x=>x.id));cloudKnown.plans=new Set(cloudPlans.map(x=>x.id));cloudKnown.goals=new Set(cloudGoals.map(x=>x.id));cloudKnown.instruments=new Set(cloudInstruments.map(x=>x.id));cloudKnown.strategies=new Set(cloudStrategies.map(x=>x.id));cloudKnown.journals=new Set(cloudJournalsRows.map(x=>x.id));
  if(cloudNotes.length||!state.notes.length)state.notes=cloudNotes.map(cloudRowToNote);
    if(cloudPlans.length||!state.plans.length)state.plans=cloudPlans.map(cloudRowToPlan);
    if(cloudGoals.length||!state.goals.length)state.goals=cloudGoals.map(cloudRowToGoal);
  if(settings.data)state.settings={...state.settings,currency:settings.data.currency||state.settings.currency,timezone:settings.data.timezone||state.settings.timezone,dateFormat:settings.data.date_format||state.settings.dateFormat,startingBalance:Number(settings.data.starting_balance)||0,appearance:{...state.settings.appearance,...(settings.data.appearance||{})}};
  if(mainGoal.data)state.mainGoal={title:mainGoal.data.title||'',description:mainGoal.data.description||'',targetBalance:Number(mainGoal.data.target_balance)||0,targetPnl:Number(mainGoal.data.target_pnl)||0,targetWinRate:Number(mainGoal.data.target_win_rate)||0,targetTrades:Number(mainGoal.data.target_trades)||0};
  const builtInInstruments=DEFAULT_DATA.instruments.filter(i=>!i.custom);state.instruments=[...builtInInstruments,...cloudInstruments.map(cloudRowToInstrument)];
  const builtInStrategies=DEFAULT_DATA.strategies.filter(s=>typeof s==='string');state.strategies=[...builtInStrategies,...cloudStrategies.map(cloudRowToStrategy)];
  const j={};cloudJournalsRows.forEach(r=>{j[r.journal_date]={id:r.id,text:r.text||'',worked:r.worked||'',failed:r.failed||'',lesson:r.lesson||''}});state.journal=j;
  state.deposits=cloudDepositRows.map(cloudRowToDeposit);
  if(profileRow?.data)state.profile=cloudRowToProfile(profileRow.data);
  notifyState();
  if(typeof updateProfileUI==='function')updateProfileUI();
  cloudLoaded.notes=cloudLoaded.plans=cloudLoaded.goals=cloudLoaded.settings=cloudLoaded.mainGoal=cloudLoaded.instruments=cloudLoaded.strategies=cloudLoaded.journal=true;
  localStorage.removeItem('tradingDiary_cloudWorkspaceDirty');
  return true;
}catch(error){console.error('Supabase workspace load:',error);toast?.('Не удалось загрузить сохранения',true)}finally{cloudLoadBusy=false}}

async function syncWorkspace(userId=window.currentUser?.id,force=false){
  if(!cloud()||!userId)return false;
  if(!force&&!isCloudUser())return false;
  if(cloudSyncBusy)return false;
  cloudSyncBusy=true;
  try{
    await syncRows('notes',state.notes,noteToCloudRow,'notes',userId);
    await syncRows('plans',state.plans,planToCloudRow,'plans',userId);
    await syncRows('goals',state.goals,goalToCloudRow,'goals',userId);
    if(cloudBalanceSupported)await syncRows('balance_operations',state.deposits||[],depositToCloudRow,'deposits',userId);

    const settingsRow={
      user_id:userId,
      currency:state.settings.currency,
      timezone:state.settings.timezone,
      date_format:state.settings.dateFormat,
      theme:document.body.classList.contains('light')?'light':'dark',
      appearance:state.settings.appearance||{},
      starting_balance:Number(state.settings.startingBalance)||0
    };
    const sr=await cloud().from('settings').upsert(settingsRow,{onConflict:'user_id'});
    if(sr.error)throw sr.error;

    const profile=state.profile||{};
    const pr=await cloud().from('profiles').upsert({id:userId,display_name:profile.displayName||null,avatar_url:profile.avatarUrl||null},{onConflict:'id'});
    if(pr.error)throw pr.error;

    const g=state.mainGoal||{};
    const mr=await cloud().from('main_goals').upsert({
      user_id:userId,
      title:g.title||'Главная цель',
      description:g.description||'',
      target_balance:Number(g.targetBalance)||0,
      target_pnl:Number(g.targetPnl)||0,
      target_win_rate:Number(g.targetWinRate)||0,
      target_trades:Number(g.targetTrades)||0
    },{onConflict:'user_id'});
    if(mr.error)throw mr.error;

    const customInstruments=state.instruments.filter(i=>i.custom);
    await syncRows('instruments',customInstruments,instrumentToCloudRow,'instruments',userId);

    const builtInNames=new Set(['Без стратегии','Trend','Breakout','Support / Resistance','Price Action','News','Scalping']);
    const customStrategies=state.strategies
      .map(s=>typeof s==='string'?{name:s,description:''}:s)
      .filter(s=>s?.name)
      .filter(s=>!builtInNames.has(s.name));
    await syncRows('strategies',customStrategies,strategyToCloudRow,'strategies',userId);

    // Journal entries are keyed by date, so keep one cloud row per local date.
    const remoteJournalRows=await cloudSelectAll('journals',userId,'id','created_at',true);
    const remoteJournalIds=new Set(remoteJournalRows.map(r=>r.id));
    for(const [date,j] of Object.entries(state.journal||{})){
      if(!j||!date)continue;
      const row={
        ...(UUID_RE.test(String(j.id||''))?{id:j.id}:{}),
        user_id:userId,
        journal_date:date,
        text:j.text||'',
        worked:j.worked||'',
        failed:j.failed||'',
        lesson:j.lesson||''
      };
      const journalSafeId=UUID_RE.test(String(j?.id||'')) && remoteJournalIds.has(String(j.id));
      if(!journalSafeId) delete row.id;
      const rr=journalSafeId
        ?await cloud().from('journals').update(row).eq('id',row.id).eq('user_id',userId).select().single()
        :await cloud().from('journals').insert(row).select().single();
      if(rr.error)throw rr.error;
      if(rr.data?.id){
        j.id=rr.data.id;
        cloudKnown.journals.add(rr.data.id);
        remoteJournalIds.delete(rr.data.id);
      }
    }
    saveLocalOnly();
    localStorage.removeItem('tradingDiary_cloudWorkspaceDirty');
    return true;
  }catch(error){
    console.error('Supabase workspace sync:',error);
    toast?.('Изменения сохранены локально, но не полностью синхронизированы',true);
    return false;
  }finally{cloudSyncBusy=false}
}

function cloudErrorText(error){
  if(!error)return '';
  return [error.code,error.message,error.details,error.hint].filter(Boolean).join(' | ');
}

function reportCloudSyncError(kind,error){
  const message=cloudErrorText(error)||'Неизвестная ошибка';
  // Do not flood the console/toasts when a temporary Supabase error is retried.
  if(message!==cloudSyncLastError){
    console.error(`Supabase ${kind} sync:`,{code:error?.code||'',message:error?.message||'',details:error?.details||'',hint:error?.hint||''});
    cloudSyncLastError=message;
  }
  cloudSyncBackoffUntil=Date.now()+CLOUD_SYNC_BACKOFF_MS;
  toast?.('Изменения сохранены локально. Облачная синхронизация повторится автоматически.',true);
}

async function runCloudSync(userId){
  if(!isCloudUser()||!userId)return;
  if(Date.now()<cloudSyncBackoffUntil)return;

  // Keep one ordered queue, but sync only the parts that are actually dirty.
  cloudSyncQueue=cloudSyncQueue.catch(()=>{}).then(async()=>{
    if(!isCloudUser()||window.currentUser?.id!==userId)return;
    if(Date.now()<cloudSyncBackoffUntil)return;

    const tradesDirty=localStorage.getItem('tradingDiary_cloudTradesDirty')==='1';
    const workspaceDirty=localStorage.getItem('tradingDiary_cloudWorkspaceDirty')==='1';
    if(!tradesDirty&&!workspaceDirty)return;

    let ok=true;
    if(tradesDirty){
      ok=await syncTradesToCloud(userId);
    }
    // Do not continue into workspace sync after a trade sync failure. This avoids
    // two error loops for one broken cloud session and keeps the retry predictable.
    if(ok&&workspaceDirty){
      ok=await syncWorkspace(userId);
    }
    if(ok)cloudSyncLastError='';
  });
  return cloudSyncQueue;
}

async function cloudSaveState(){
  if(!isCloudUser())return;
  clearTimeout(cloudSyncTimer);
  cloudSyncTimer=setTimeout(()=>{
    const uid=window.currentUser?.id;
    if(!uid)return;
    runCloudSync(uid).catch(error=>{
      reportCloudSyncError('queued',error);
    });
  },CLOUD_SYNC_DEBOUNCE_MS);
}

window.loadCloudWorkspace=loadCloudWorkspace;
window.loadCloudTrades=loadCloudTrades;
