let importPending=null;

const IMPORT_ALIASES={
  externalId:['сделка','trade id','trade_id','id','deal id','deal_id','external id'],
  type:['направление','direction','type','side'],
  expiration:['экспирация','expiration','expiry'],
  instrument:['актив','asset','instrument','symbol','market'],
  openTime:['время открытия','open time','open_time','opened at','date time','datetime'],
  closeTime:['время закрытия','close time','close_time','closed at'],
  openPrice:['цена открытия','open price','open_price','entry price'],
  closePrice:['цена закрытия','close price','close_price','exit price'],
  stake:['размер сделки','stake','amount','investment','сумма сделки','сумма','amount invested'],
  pnl:['прибыль','profit','p&l','pnl','net profit','result value'],
  currency:['валюта','currency'],
  payout:['payout','payout %','выплата','процент выплаты'],
  result:['результат','result','outcome']
};

function normalizeHeader(v){return String(v??'').trim().toLowerCase().replace(/[\s_\-]+/g,' ')}
function detectImportMapping(headers){
  const normalized=headers.map(normalizeHeader); const mapping={};
  for(const [key,aliases] of Object.entries(IMPORT_ALIASES)){
    const set=new Set(aliases.map(normalizeHeader));
    const i=normalized.findIndex(h=>set.has(h));
    if(i>=0)mapping[key]=i;
  }
  return mapping;
}
function parseImportNumber(v){
  if(v===null||v===undefined||v==='')return null;
  if(typeof v==='number')return Number.isFinite(v)?v:null;
  const s=String(v).trim().replace(/\s/g,'').replace(',', '.').replace(/[^0-9.+-]/g,'');
  const n=Number(s);return Number.isFinite(n)?n:null;
}
function parseImportDateTime(v){
  if(v===null||v===undefined||v==='')return {date:'',time:''};
  if(v instanceof Date&&!isNaN(v))return {date:v.toISOString().slice(0,10),time:v.toTimeString().slice(0,8)};
  const s=String(v).trim();
  const m=s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if(m)return {date:`${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`,time:m[4]?`${String(m[4]).padStart(2,'0')}:${m[5]}:${m[6]||'00'}`:''};
  const d=new Date(s); if(!isNaN(d))return {date:d.toISOString().slice(0,10),time:d.toTimeString().slice(0,8)};
  return {date:'',time:''};
}
function importResultFrom(row,pnl){
  const raw=String(row.result??'').trim().toLowerCase();
  if(raw.includes('win')||raw.includes('profit')||raw.includes('won')||raw.includes('выиг'))return 'win';
  if(raw.includes('loss')||raw.includes('lost')||raw.includes('minus')||raw.includes('убыт'))return 'loss';
  if(pnl>0)return 'win'; if(pnl<0)return 'loss'; return 'draw';
}
function normalizeDirection(v){return String(v??'').trim().toUpperCase().includes('PUT')?'PUT':'CALL'}
function buildImportedTrade(raw,mapping,headers){
  const val=k=>mapping[k]===undefined?'':raw[mapping[k]];
  const open=parseImportDateTime(val('openTime')); const close=parseImportDateTime(val('closeTime'));
  const stake=parseImportNumber(val('stake'))??0;
  const pnl=parseImportNumber(val('pnl'))??0;
  let payout=parseImportNumber(val('payout'));
  const result=importResultFrom(raw,pnl);
  if((payout===null||payout===0)&&result==='win'&&stake>0)payout=Math.round((pnl/stake)*10000)/100;
  if(payout===null)payout=0;
  const instrument=String(val('instrument')||'').trim();
  if(!instrument)return null;
  return {
    id:uid(), externalId:String(val('externalId')||'').trim(), date:open.date||localDateKey(), time:open.time?open.time.slice(0,5):'',
    closeDate:close.date||'', closeTime:close.time?close.time.slice(0,8):'', instrument,
    type:normalizeDirection(val('type')), expiration:String(val('expiration')||'').trim(),
    stake:Math.max(0,stake), payout:Math.min(100,Math.max(0,payout)), result, pnl:round(pnl),
    strategy:'', platform:'Imported', state:'calm', note:'', category:findInstrument(instrument)?.category||'Custom',
    openPrice:parseImportNumber(val('openPrice')), closePrice:parseImportNumber(val('closePrice')),
    currency:String(val('currency')||'').trim()
  };
}
function assignImportSyncKeys(rows){
  const counts=new Map();
  for(const t of rows){
    const base=t.externalId ? `ext:${t.externalId}` : `sig:${t.date}|${t.time}|${String(t.instrument).trim().toLowerCase()}|${t.type}|${t.expiration||''}|${Number(t.stake||0).toFixed(8)}|${Number(t.payout||0).toFixed(8)}|${t.result}|${t.closeDate||''}|${t.closeTime||''}|${Number(t.openPrice??0).toFixed(10)}|${Number(t.closePrice??0).toFixed(10)}`;
    const n=(counts.get(base)||0)+1; counts.set(base,n); t.syncKey=n===1?base:`${base}#${n}`;
  }
  return rows;
}
function readImportFile(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error('read'));
    reader.onload=()=>{
      try{
        if(/\.csv$/i.test(file.name)||/text\/csv/i.test(file.type)){
          const text=String(reader.result||'').replace(/^\uFEFF/,'');
          const lines=text.split(/\r?\n/).filter(x=>x.trim()); if(!lines.length)throw new Error('empty');
          const parseLine=line=>{let out=[],cur='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'&&line[i+1]==='"'){cur+='"';i++;continue}if(c==='"'){q=!q;continue}if(c===','&&!q){out.push(cur);cur='';continue}cur+=c}out.push(cur);return out};
          const headers=parseLine(lines[0]); const mapping=detectImportMapping(headers); const rows=lines.slice(1).map(parseLine).map(r=>buildImportedTrade(r,mapping,headers)).filter(Boolean);
          resolve({file:file.name,rows:assignImportSyncKeys(rows),headers,mapping}); return;
        }
        const wb=XLSX.read(reader.result,{type:'array',cellDates:true});
        const rows=[];
        wb.SheetNames.forEach(sheet=>{
          const data=XLSX.utils.sheet_to_json(wb.Sheets[sheet],{header:1,defval:'',raw:true});
          if(!data.length)return;
          const headers=data[0].map(v=>String(v??'')); const mapping=detectImportMapping(headers);
          for(const raw of data.slice(1)){const t=buildImportedTrade(raw,mapping,headers);if(t)rows.push(t)}
        });
        resolve({file:file.name,rows:assignImportSyncKeys(rows)});
      }catch(err){reject(err)}
    };
    if(/\.csv$/i.test(file.name)||/text\/csv/i.test(file.type))reader.readAsText(file);else reader.readAsArrayBuffer(file);
  });
}
function tradeIdentity(t){
  if(t.externalId)return `id:${t.externalId}`;
  return `sig:${t.date}|${t.time}|${String(t.instrument).toLowerCase()}|${t.type}|${Number(t.stake).toFixed(2)}|${t.closeDate||''}|${t.closeTime||''}`;
}
function valuesDiffer(a,b,key){
  const empty=v=>v===undefined||v===null||String(v).trim()===''; if(empty(a)||empty(b))return false;
  if(['stake','payout','pnl','openPrice','closePrice'].includes(key))return Math.abs((Number(a)||0)-(Number(b)||0))>0.000001;
  return String(a).trim().toLowerCase()!==String(b).trim().toLowerCase();
}
function mergeImportedTrades(files){
  const map=new Map(state.trades.map(t=>[tradeIdentity(t),t]));
  const added=[]; const merged=[]; const conflicts=[]; let rows=0;
  const fillable=['date','time','closeDate','closeTime','instrument','type','expiration','stake','payout','result','pnl','strategy','platform','state','note','category','openPrice','closePrice','currency','externalId'];
  for(const source of files){
    for(const incoming of source.rows){
      rows++;
      const key=tradeIdentity(incoming); const existing=map.get(key);
      if(!existing){map.set(key,incoming);added.push(incoming);continue}
      let changed=false; const conflictFields=[];
      for(const field of fillable){
        const old=existing[field], next=incoming[field];
        const payoutPlaceholder=field==='payout'&&Number(old)===0&&Number(next)>0;
        const oldEmpty=(old===undefined||old===null||String(old).trim()==='')||payoutPlaceholder;
        const nextEmpty=next===undefined||next===null||String(next).trim()==='';
        if(oldEmpty&&!nextEmpty){existing[field]=next;changed=true;continue}
        if(!oldEmpty&&!nextEmpty&&valuesDiffer(old,next,field))conflictFields.push(field);
      }
      if(changed)merged.push({trade:existing,source:source.file});
      if(conflictFields.length)conflicts.push({identity:key,externalId:existing.externalId||incoming.externalId,fields:conflictFields,existing,incoming,source:source.file});
    }
  }
  return {rows,added,merged,conflicts,all:[...map.values()]};
}
function renderImportView(){
  const box=document.getElementById('importStatus'); if(!box)return;
  if(!importPending){box.innerHTML=`<div class="import-empty"><div class="import-icon">⇧</div><h3>Загрузите историю сделок</h3><p>Можно выбрать один или несколько CSV/XLSX файлов. Повторные сделки не создаются: заполненные поля сохраняются, пустые дополняются.</p><label class="upload-zone"><input id="tradeImportFiles" type="file" accept=".xlsx,.xls,.csv" multiple><span>Выбрать файлы</span><small>Поддерживаются Excel и CSV</small></label></div>`;document.getElementById('tradeImportFiles').onchange=handleImportFiles;return;}
  const r=importPending.result;
  const conflictHtml=r.conflicts.length ? '<h4>Конфликты <small>(существующее значение будет сохранено)</small></h4>'+r.conflicts.slice(0,30).map(c=>`<div class="conflict-row"><b>${escapeHtml(c.externalId||c.identity)}</b><span>${c.fields.map(escapeHtml).join(', ')}</span></div>`).join('')+(r.conflicts.length>30?'<p class="muted">Показаны первые 30 конфликтов.</p>':'') : '<div class="success-line">✓ Конфликтов нет. Данные можно объединить безопасно.</div>';
  box.innerHTML=`<div class="import-summary-grid"><div><b>${r.rows}</b><span>строк прочитано</span></div><div><b class="positive">${r.added.length}</b><span>новых сделок</span></div><div><b>${r.merged.length}</b><span>дополнено</span></div><div><b class="negative">${r.conflicts.length}</b><span>конфликтов</span></div></div>
  <div class="import-preview-head"><div><h3>Готово к импорту</h3><p>По умолчанию сохраняем уже заполненные значения и добавляем только отсутствующие.</p></div><div class="button-row"><button class="secondary-btn" id="cancelImport">Отмена</button><button class="primary-btn" id="commitImport">Импортировать</button></div></div>
  <div class="import-files">${importPending.files.map(f=>`<span>${escapeHtml(f.file)} · ${f.rows.length}</span>`).join('')}</div>
  <div class="import-conflicts">${conflictHtml}</div>`;
  document.getElementById('cancelImport').onclick=()=>{importPending=null;renderImportView()};
  document.getElementById('commitImport').onclick=commitImport;
}
async function handleImportFiles(e){
  const files=[...e.target.files]; if(!files.length)return;
  const status=document.getElementById('importStatus'); status.innerHTML='<div class="loading-state">Читаем файлы…</div>';
  try{
    const parsed=[]; for(const file of files)parsed.push(await readImportFile(file));
    const result=mergeImportedTrades(parsed);
    importPending={files:parsed,result}; renderImportView();
  }catch(err){console.error('Import Center:',err);toast('Не удалось прочитать один из файлов',true);importPending=null;renderImportView()}
}
async function commitImport(){
  if(!importPending)return;
  const pending=importPending;
  try{
    if(window.currentUser?.id&&window.supabaseClient&&window.cloudDataReady&&typeof loadCloudTrades==='function'){
      await loadCloudTrades(window.currentUser.id,{skipMigration:true});
    }
    const incoming=[]; for(const file of pending.files)incoming.push(...file.rows);
    const merged=mergeImportedTrades([{file:'import',rows:incoming}]);
    state.trades=merged.all;
    ensureTradeSyncKeys(state.trades);
    const now=new Date().toISOString();
    state.importHistory=Array.isArray(state.importHistory)?state.importHistory:[];
    state.importHistory.unshift({date:now,files:pending.files.map(x=>x.file),rows:pending.result.rows,added:merged.added.length,merged:merged.merged.length,conflicts:merged.conflicts.length});
    state.importHistory=state.importHistory.slice(0,20);
    const missing=[...new Set(merged.added.map(t=>t.instrument))].filter(name=>!findInstrument(name));
    missing.forEach(name=>state.instruments.push({id:uid(),category:'Custom',name,custom:true}));
    saveLocalOnly();
    localStorage.setItem('tradingDiary_cloudTradesDirty','1');
    document.dispatchEvent(new CustomEvent('state:changed'));
    if(window.currentUser?.id&&window.supabaseClient&&window.cloudDataReady&&typeof syncTradesToCloud==='function'){
      const ok=await syncTradesToCloud(window.currentUser.id);
      if(!ok){toast('Импорт сохранён локально, но облачная синхронизация не завершилась',true);return;}
      const rows=await cloudSelectAll('trades',window.currentUser.id,'*','trade_date',false,true);
      state.trades=rows.map(cloudRowToTrade);
      ensureTradeSyncKeys(state.trades);
      saveLocalOnly();
      localStorage.removeItem('tradingDiary_cloudTradesDirty');
    }
    renderAll();
    toast(`Импорт завершён: ${merged.added.length} новых, ${merged.merged.length} дополнено`);
    importPending=null; renderImportView(); renderImportHistory();
  }catch(error){
    console.error('Import commit:',error);
    toast('Импорт сохранён локально, но облачная запись не подтверждена',true);
  }
}
function renderImportHistory(){
  const box=document.getElementById('importHistory'); if(!box)return;
  const h=Array.isArray(state.importHistory)?state.importHistory:[];
  box.innerHTML=h.length?h.map(x=>`<div class="history-row"><div><b>${new Date(x.date).toLocaleString('ru-RU')}</b><span>${x.files.map(escapeHtml).join(', ')}</span></div><div><strong>${x.added}</strong> новых · ${x.merged} дополнено · ${x.conflicts} конфликтов</div></div>`).join(''):'<div class="empty-inline">История импорта пока пуста.</div>';
}
function initImportCenter(){
  document.addEventListener('click',e=>{const v=e.target.closest('[data-view="import"]');if(v){setTimeout(()=>{renderImportView();renderImportHistory()},0)}});
  document.addEventListener('state:changed',()=>{if(document.getElementById('view-import')?.classList.contains('active')){renderImportView();renderImportHistory()}});
}
window.initImportCenter=initImportCenter;
window.renderImportView=renderImportView;
