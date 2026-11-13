const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const context={window:{TD_STUDIO_LESSONS:{existing:{preserved:true}}},Intl};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/academy-studio-decisions.js'),'utf8'),context);
const {TD_STUDIO_LESSONS:lessons,TD_STUDIO_DECISION_MATH:m}=context.window;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
near(m.breakeven(.8),5/9);near(m.expectancy(.6,.8),.08);near(m.recovery(.2),.25);
assert.equal(m.recovery(1),null);assert.equal(m.recovery(-.1),null);assert.equal(m.breakeven(0),null);
assert.equal(m.expectancy(1.1,.8),null);assert.equal(m.size(12,0,1),null);near(m.size(12,6,1),2);
assert.equal(m.expectancy(.6,Infinity),null);assert.equal(m.size(Infinity,6,1),null);
assert.equal(m.capacity(30,18,12),true);assert.equal(m.capacity(30,18,15),false);assert.equal(m.capacity(30,NaN,1),false);
near(m.flow(100,100,20,0),-20);near(m.flow(100,90,0,10),0);
assert.equal(m.signal(0,30,120,30),true);assert.equal(m.signal(0,31,120,30),false);assert.equal(m.signal(0,120,120,200),false);assert.equal(m.signal(20,0,120,30),false);
near(m.ladder([1,2,4],.8)[2],.2);near(m.ladder([1,2,6],.8)[2],1.8);
assert.ok(lessons.existing.preserved);
const keys=['5.2','5.3','7.1','7.2','7.3','9.1','9.2','9.3','9.4','10.1','10.2','10.3','10.4','13.7','14.1','14.2','14.3','14.4','14.5','14.6','15.1','15.2','15.3','15.4','15.5','15.6'];
for(const key of keys){const l=lessons[key];assert.ok(l,key);assert.ok(l.stages.length>=4&&l.stages.length<=6);for(const s of l.stages)for(const f of ['title','body','task'])assert.ok(s[f]);for(const q of [l.practice,...l.quiz])assert.equal(q.choices.filter(c=>c.correct).length,1);const host={innerHTML:'',querySelectorAll(){return[]},querySelector(){return null}};l.render(host,{step:1});assert.ok(host.innerHTML.includes('as-decision-root'));assert.ok(!host.innerHTML.includes('undefined'));}
// Interaction verifies recomputation from input, rather than changing only a label.
const listeners={};const input={type:'number',tagName:'INPUT',dataset:{field:'risk'},value:'15',min:'0',max:'100',addEventListener(type,fn){listeners[type]=fn}};
const host={innerHTML:'',querySelectorAll(){return[input]},querySelector(){return null}};
lessons['5.2'].render(host,{step:3});assert.ok(host.innerHTML.includes('В пределах'));listeners.change();assert.ok(host.innerHTML.includes('33'));assert.ok(host.innerHTML.includes('Допуска нет'));
input.value='';listeners.change();assert.ok(host.innerHTML.includes('нет расчёта'));assert.ok(host.innerHTML.includes('Допуска нет'));
lessons['5.2'].render(host,{step:2});assert.ok(host.innerHTML.includes('нет расчёта'),'stage change must preserve invalid input');
input.dataset.field='payout';input.min='1';input.value='';lessons['14.1'].render(host,{step:3});listeners.change();assert.ok(host.innerHTML.includes('нет расчёта%'),'invalid payout must not produce a zero percent threshold');
input.dataset.field='mistakes';input.min='0';input.value='2';lessons['15.3'].render(host,{step:3});listeners.change();assert.ok(host.innerHTML.includes('два неверных ввода'));assert.ok(host.innerHTML.includes('Пауза.'));
// Journal does not reveal before a reason exists, and keeps the frozen record on stage changes.
let saveHandler;const note={value:'',type:'textarea',tagName:'TEXTAREA',dataset:{field:'note'},addEventListener(){},focus(){this.focused=true}};
const save={addEventListener(type,fn){saveHandler=fn}};
const journal={innerHTML:'',querySelectorAll(){return[note]},querySelector(selector){return selector==='[data-save]'?save:note}};
lessons['15.1'].render(journal,{step:3});saveHandler();assert.ok(note.focused);assert.ok(journal.innerHTML.includes('Скрыто до фиксации'));
note.value='<test> подтверждения нет';saveHandler();assert.ok(journal.innerHTML.includes('Цена 103; входа не было'));assert.ok(journal.innerHTML.includes('&lt;test&gt;'));assert.ok(journal.innerHTML.includes('readonly'));
lessons['15.1'].render(journal,{step:3});assert.ok(journal.innerHTML.includes('readonly'));assert.ok(journal.innerHTML.includes('&lt;test&gt;'));
for(const key of keys){const host={innerHTML:'',querySelectorAll(){return[]},querySelector(){return null}};lessons[key].render(host,{practice:true,revealed:false});const hidden=host.innerHTML;assert.ok(hidden.includes('после фиксации ответа'));assert.ok(!hidden.includes(lessons[key].practice.reveal),'answer leaked '+key);lessons[key].render(host,{practice:true,revealed:true});assert.ok(host.innerHTML.includes(lessons[key].practice.reveal.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')),'answer missing '+key);}
vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/academy-reading-decisions.js'),'utf8'),context);
for(const key of keys){
  const model=lessons[key];
  const {comparison}=context.window.TD_READING_LESSONS[key];
  const host={innerHTML:'',querySelectorAll(){return[]},querySelector(){return null}};
  model.render(host,{step:3,exampleRows:comparison.rows,onExampleChange(){assert.fail(key+' used base example feedback for a comparison');}});
  assert.ok(host.innerHTML.includes(comparison.title),key);
  assert.ok(host.innerHTML.includes(comparison.task),key);
  model.render(host,{practice:true,revealed:false,exampleRows:comparison.rows});
  assert.ok(!host.innerHTML.includes(comparison.body),key);
  assert.ok(!host.innerHTML.includes(model.practice.choices.find(choice=>choice.correct).text),key);
}
const progressive={innerHTML:'',querySelectorAll(){return[]},querySelector(){return null}};lessons['10.2'].render(progressive,{step:0});assert.ok(!progressive.innerHTML.includes('−30 тыс.'));lessons['10.2'].render(progressive,{step:3});assert.ok(progressive.innerHTML.includes('−30 тыс.'));
for(const key of keys){const t=lessons[key].teaching;for(const field of ['goal','plain','read','example','takeaway'])assert.ok(t[field].length>25,key+' '+field);assert.ok(t.terms.every(x=>x.term&&x.meaning));assert.ok(/\d/.test(t.example)||key==='10.4','concrete example '+key);}
console.log('26 decision studios: math, source validity, risk invalidation, render and contract passed');
