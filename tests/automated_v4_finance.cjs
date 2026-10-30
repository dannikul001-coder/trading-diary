const fs=require('fs'),vm=require('vm'),assert=require('assert');
let src=fs.readFileSync(require('path').join(__dirname,'..','js','automated-diary.js'),'utf8');
src=src.replace(/\}\)\(\);\s*$/, 'window.__tests={state,micro,money,decimal,timeline,reserved,balance,equity,profit,earnings,financialWarnings,closedTrades,zonedIso,dayData,calendarView,analyticsView,dashboard,tradesView,bonusesView,scheduleView,plansView,goalsView,notesView,adminView,settingsView,financeView};})();');
const fakeRoot={querySelector:()=>null,querySelectorAll:()=>[],addEventListener:()=>{}};
const d={querySelector:(sel)=>sel==='#automatedDiary'?fakeRoot:null,querySelectorAll:()=>[],addEventListener:()=>{},};
const ctx={document:d,window:{},crypto:require('crypto').webcrypto,localStorage:{},sessionStorage:{},console,setTimeout:()=>null,clearTimeout(){},setInterval(){},Date,Intl,Number,BigInt,Array,Object,String,Map,RegExp,Math,Error,Promise,JSON};
vm.runInNewContext(src,ctx,{filename:'automated-diary.js'});
const a=ctx.window.__tests;
const id=n=>`${n}`;
a.state.profile={initial_balance:'1000.000000',currency:'USDT',timezone:'UTC'};
a.state.trades=[
 {id:'a',opened_at:'2026-10-01T12:00:00Z',closed_at:'2026-10-01T12:00:02Z',status:'closed',stake:'100.000001',payout:'140.000002',note:''},
 {id:'b',opened_at:'2026-10-01T12:00:00Z',status:'open',stake:'200.000000',payout:null,note:''},
 {id:'c',opened_at:'2026-10-01T12:00:00Z',status:'closed',closed_at:'2026-10-01T12:00:01Z',stake:'0.000001',payout:'0.000002',note:''},
];
a.state.ledger=[{id:'d',kind:'deposit',amount:'100.000000',operated_at:'2026-10-01T11:59:58Z',note:''},{id:'e',kind:'withdrawal',amount:'50.000000',operated_at:'2026-10-01T12:00:03Z',note:''}];
a.state.bonuses=[{id:'f',status:'received',amount:'1.2345',received_at:'2026-10-01T12:00:04Z',title:'bonus'}];
a.state.signals=[];a.state.calendarCursor='2026-10';
assert.equal(a.decimal(a.micro('0.000001')),'0.000001');
assert.equal(a.decimal(a.profit(a.state.trades[0])),'40.000001');
assert.equal(a.decimal(a.earnings()),'40.000002');
assert.equal(a.decimal(a.reserved()),'200.000000');
assert.equal(a.decimal(a.balance()),'891.234502');
assert.equal(a.decimal(a.equity()),'1091.234502');
assert.equal(a.decimal(a.timeline(Date.parse('2026-10-01T12:00:00Z')).cash),'799.999998');
assert.equal(a.zonedIso('2026-10-01T12:00:02','UTC'),'2026-10-01T12:00:02.000Z');
assert(a.calendarView().includes('Календарь операций'));
assert(a.analyticsView().includes('Аналитика дохода'));
assert.equal(a.financialWarnings().length,0);
a.state.notes=[{id:'x',title:'Заметка',body:'Текст',note_date:'2026-10-01'}];
a.state.plans=[{id:'p',title:'План',done:true,plan_date:'2026-10-01'}];
a.state.goals=[{id:'g',title:'Цель',target:'50.000000',current_value:'25.000000',due_date:'2026-12-31'}];
a.state.adminRows=[{user_id:'u',display_name:'Test',email:'test@example.com',currency:'USDT',earned:'40.000001',available:'891.234502',trades_total:3,trades_closed:2,plans_done:1,plans_total:1,goals_complete:0,goals_total:1,learning_completed:4,learning_total:10}];a.state.isAdmin=true;
a.state.signals=[{id:'s',title:'Сигнал',signal_type:'trade',starts_at:'2026-10-01T12:00:00Z',remind_minutes:5,enabled:true}];a.state.scheduleDay='2026-10-01';
for(const [n,fn] of Object.entries({dashboard:a.dashboard,trades:a.tradesView,bonuses:a.bonusesView,schedule:a.scheduleView,plans:a.plansView,goals:a.goalsView,notes:a.notesView,admin:a.adminView,settings:a.settingsView,finance:a.financeView})){
 const html=fn(); assert(html.length>100,`empty ${n}`);
}
assert(a.dashboard().includes('ПОСЛЕДНИЕ 7 × 24 ЧАСА'));
assert(a.tradesView().includes('data-edit-trade'));
assert(a.bonusesView().includes('data-edit-bonus'));
assert(a.scheduleView().includes('data-edit-signal'));
assert(a.adminView().includes('learning')===false);

console.log('PASS: exact decimals, concurrent stakes, chronology, per-trade profit, date conversion, new calendar and analytics');
