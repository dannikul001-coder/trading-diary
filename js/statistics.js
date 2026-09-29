function localDateKey(dateLike=new Date()){const d=new Date(dateLike);return new Intl.DateTimeFormat('en-CA',{timeZone:state.settings.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}
function localParts(dateLike=new Date()){const d=new Date(dateLike);const f=new Intl.DateTimeFormat('en-US',{timeZone:state.settings.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});const p=Object.fromEntries(f.formatToParts(d).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return p}
function tradeDate(t){return new Date(`${t.date||localDateKey()}T${t.time||'00:00'}:00`)}
function inRange(t,range){
  const key=String(t?.date||'').slice(0,10);
  const today=localDateKey(new Date());
  if(!key)return false;
  if(range==='today')return key===today;
  const dateFromKey=k=>{const [y,m,d]=String(k).split('-').map(Number);return new Date(y,m-1,d)};
  const todayD=dateFromKey(today);
  const td=dateFromKey(key);
  if(range==='week'){const day=(todayD.getDay()+6)%7;const start=new Date(todayD);start.setDate(todayD.getDate()-day);return td>=start&&td<=todayD}
  if(range==='month')return key.slice(0,7)===today.slice(0,7);
  if(typeof range==='number'){const start=new Date(todayD);start.setDate(start.getDate()-Math.max(0,range-1));return td>=start&&td<=todayD}
  return true;
}
function stats(trades){const a=trades||[];const wins=a.filter(t=>t.result==='win'),losses=a.filter(t=>t.result==='loss'),draws=a.filter(t=>t.result==='draw');const pnl=round(a.reduce((s,t)=>s+(Number(t.pnl)||0),0));const profit=round(wins.reduce((s,t)=>s+Math.max(0,Number(t.pnl)||0),0));const loss=round(losses.reduce((s,t)=>s+Math.abs(Math.min(0,Number(t.pnl)||0)),0));const winRate=a.length?wins.length/a.length*100:0;const avg=a.length?pnl/a.length:0;const avgPayout=wins.length?wins.reduce((s,t)=>s+Number(t.payout||0),0)/wins.length:0;let maxWin=0,maxLoss=0,w=0,l=0;[...a].sort((x,y)=>tradeDate(x)-tradeDate(y)).forEach(t=>{if(t.result==='win'){w++;l=0}else if(t.result==='loss'){l++;w=0}else{w=0;l=0}maxWin=Math.max(maxWin,w);maxLoss=Math.max(maxLoss,l)});return{trades:a.length,wins:wins.length,losses:losses.length,draws:draws.length,pnl,profit,loss,winRate,avg,avgPayout,maxWin,maxLoss}}
function getPeriodStats(range){return stats(state.trades.filter(t=>inRange(t,range)))}
function formatMoney(v,compact=false){const cur=state.settings.currency;const symbol=(DEFAULT_DATA.currencies.find(c=>c[0]===cur)||[cur,cur])[1];const n=Number(v)||0;return `${n>=0?'+':''}${symbol}${new Intl.NumberFormat('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n)}`}
function formatMoneyPlain(v){const cur=state.settings.currency;const symbol=(DEFAULT_DATA.currencies.find(c=>c[0]===cur)||[cur,cur])[1];return `${symbol}${new Intl.NumberFormat('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(v)||0)}`}
function totalDeposits(){return round((state.deposits||[]).filter(d=>d.operationType!=='withdrawal').reduce((s,d)=>s+Math.max(0,Number(d.amount)||0),0))}
function totalWithdrawals(){return round((state.deposits||[]).filter(d=>d.operationType==='withdrawal').reduce((s,d)=>s+Math.max(0,Number(d.amount)||0),0))}
function currentBalance(){return round(Number(state.settings.startingBalance||0)+totalDeposits()-totalWithdrawals()+state.trades.reduce((s,t)=>s+Number(t.pnl||0),0))}
function sortedTrades(){return [...state.trades].sort((a,b)=>tradeDate(a)-tradeDate(b))}
function sortedBalanceEvents(){const trades=state.trades.map(t=>({kind:'trade',date:t.date||localDateKey(tradeDate(t)),time:t.time||'00:00',trade:t,amount:Number(t.pnl)||0}));const deposits=(state.deposits||[]).map(d=>{const out=d.operationType==='withdrawal';return{kind:out?'withdrawal':'deposit',date:d.date||localDateKey(),time:d.time||'00:00',deposit:d,amount:(out?-1:1)*Math.max(0,Number(d.amount)||0)}});return [...trades,...deposits].sort((a,b)=>String(a.date+' '+a.time).localeCompare(String(b.date+' '+b.time)))}
function balanceSeries(){let bal=Number(state.settings.startingBalance||0);return sortedBalanceEvents().map(e=>{bal=round(bal+e.amount);return{date:new Date(`${e.date}T${e.time||'00:00'}:00`),value:bal,pnl:e.kind==='trade'?e.amount:0,deposit:e.kind==='deposit'?e.amount:0,withdrawal:e.kind==='withdrawal'?Math.abs(e.amount):0,trade:e.trade||null,operation:e}})}
function groupByDay(){const map={};sortedTrades().forEach(t=>{const k=t.date||localDateKey(tradeDate(t));if(!map[k])map[k]=[];map[k].push(t)});return Object.entries(map).map(([date,trades])=>({date,trades,...stats(trades)})).sort((a,b)=>a.date.localeCompare(b.date))}
function groupByMonth(){const map={};sortedTrades().forEach(t=>{const k=(t.date||'').slice(0,7);if(!map[k])map[k]=[];map[k].push(t)});return Object.entries(map).map(([date,trades])=>({date,trades,...stats(trades)})).sort((a,b)=>a.date.localeCompare(b.date))}
function groupByWeek(){const map={};sortedTrades().forEach(t=>{const d=new Date((t.date||'')+'T00:00:00');const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);const k=d.toISOString().slice(0,10);if(!map[k])map[k]=[];map[k].push(t)});return Object.entries(map).map(([date,trades])=>({date,trades,...stats(trades)})).sort((a,b)=>a.date.localeCompare(b.date))}
