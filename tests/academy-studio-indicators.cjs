const {test}=require('node:test');
const assert=require('node:assert/strict');
global.window={};
for(const file of ['course-v1','course-models','course-guides','course-extension','course-editorial','course-editorial-a','course-editorial-b','course-editorial-c'])require('../learning/'+file);
require('../js/learning-indicators');
require('../js/academy-studio-indicators');
const api=window.TD_STUDIO_INDICATORS,records=window.TD_STUDIO_LESSONS,I=window.LearningIndicators;
test('beginner teaching explains meaning before formulas and provides an actual worked reading',()=>{
  for(const key of api.keys){const t=records[key].teaching;for(const f of ['goal','plain','read','example','takeaway'])assert.ok(typeof t[f]==='string'&&t[f].length>10,key+' '+f);assert.ok(t.terms.length>=2);assert.ok(t.terms.every(x=>x.term&&x.meaning));assert.match(t.example,/свече 80/);const h={clientWidth:240,innerHTML:'',querySelector:()=>null};records[key].render(h,{step:2});assert.ok(h.innerHTML.indexOf('as-indicator-meaning')<h.innerHTML.indexOf('<details'));assert.ok(h.innerHTML.includes('as-indicator-reading'));if(key.startsWith('13.'))assert.ok(h.innerHTML.includes('as-indicator-checklist'));}
  const h={clientWidth:240,innerHTML:'',querySelector:()=>null};records['11.1'].render(h,{step:2});assert.match(h.innerHTML,/as-indicator-threshold[^>]*>30</);assert.match(h.innerHTML,/as-indicator-threshold[^>]*>70</);assert.match(h.innerHTML,/viewBox="0 0 232 298"/);
});
test('terminal price overlays use causal price-unit lines and dispose their listeners',()=>{
  const calls=[];let disposed=0;window.TDTerminalChart={mount:(host,options)=>{calls.push(options);return ()=>disposed++;}};
  try{for(const key of ['11.1','11.4','13.2']){const target={},host={clientWidth:800,innerHTML:'',querySelector:s=>s.startsWith('[data-as-indicator-')?target:null};const clean=records[key].render(host,{practice:true});clean();}assert.equal(calls.length,3);assert.equal(disposed,3);assert.ok(calls.every(c=>c.bars.length===80));assert.equal(calls[0].series,undefined);assert.match(calls[1].series[0].label,/SMA/);assert.match(calls[2].series[0].label,/EMA/);}finally{delete window.TDTerminalChart;}
});
test('all 28 indicator lessons have a complete studio contract',()=>{
  assert.equal(api.keys.length,28);
  for(const key of api.keys){const r=records[key];assert.equal(r.kind,'indicator');assert.equal(r.stages.length,5);for(const s of r.stages)for(const f of ['title','body','task'])assert.ok(s[f]);for(const q of [r.practice,...r.quiz]){assert.ok(q.question);assert.equal(q.choices.filter(c=>c.correct).length,1);assert.ok(q.choices.every(c=>c.feedback));}}
});
test('same-price comparisons calculate actual subject values, not substitute prices',()=>{
  const d=api.inspect('11.1',{step:4});assert.deepEqual(d.panels[0].lines[0].values,I.rsi(d.bars.map(b=>b.c),14));
  const m=api.inspect('11.4',{step:4});assert.deepEqual(m.panels[0].lines[0].values,I.sma(m.bars.map(b=>b.c),2));
  const e=api.inspect('11.4',{step:4},'ema');assert.notDeepEqual(e.panels[0].lines[0].values,m.panels[0].lines[0].values);assert.match(e.panels[0].lines[0].label,/EMA/);
  const b=api.inspect('11.7',{step:4});assert.equal(b.panels[0].lines.length,5);const v=b.panels[0].lines.map(l=>l.values.at(-1));assert.ok(v[3]>v[1]&&v[4]<v[2]);
});
test('period controls change their real windows',()=>{
  for(const key of ['11.13','11.16']){const a=api.inspect(key,{step:4}),b=api.inspect(key,{step:4},'short');assert.notDeepEqual(a.panels[0].lines,b.panels[0].lines);assert.match(b.panels[0].lines[0].label,/10/);}
  const d=api.inspect('11.16',{step:4});assert.equal(d.panels[0].lines[0].values.at(-1),Math.max(...d.bars.slice(-22).map(b=>b.h)));
});
test('practice refers to actual visible values rather than unrelated numeric examples',()=>{
  const d=api.inspect('4.2',{practice:true}),mean=d.bars.slice(-3).reduce((s,b)=>s+b.c,0)/3;
  assert.match(records['4.2'].practice.choices.find(c=>c.correct).text,new RegExp(mean.toFixed(2).replace('.','\\.')));
  for(const key of ['11.1','11.2','11.3','11.6','11.16']){const d=api.inspect(key,{practice:true}),v=d.panels[0].lines[0].values.at(-1);assert.ok(records[key].practice.question.includes(v.toFixed(2)),key);}
  assert.match(records['13.10'].practice.question,/STC =/);
  assert.match(records['13.1'].practice.choices.find(c=>c.correct).text,/двумя правыми/);
});
test('combinations retain both components and transformed-input order',()=>{
  for(const [key,types] of [['13.1',['ma','fractals']],['13.2',['keltner','vortex']],['13.5',['supertrend','ma']],['13.10',['donchian','stc']]])assert.deepEqual(api.inspect(key,{step:4}).panels.map(p=>p.type),types);
  const d=api.inspect('13.8',{step:4});assert.deepEqual(d.panels[0].lines,I.calculate(d.bars,'dual-supertrend').lines);assert.equal(d.panels[0].lines.length,3);
});
test('unrevealed alternative cannot alter visible candles or causal values',()=>{
  for(const key of api.keys){const a=api.inspect(key,{practice:true}),b=api.inspect(key,{practice:true,alternate:true}),revealed=api.inspect(key,{practice:true,revealed:true,alternate:true});assert.equal(a.count,80);assert.deepEqual(a,b);assert.deepEqual(a.bars,revealed.bars.slice(0,80));for(let p=0;p<a.panels.length;p++)for(let l=0;l<a.panels[p].lines.length;l++){const end=a.panels[p].type==='fractals'?78:80;assert.deepEqual(a.panels[p].lines[l].values.slice(0,end),revealed.panels[p].lines[l].values.slice(0,end),key);}}
});
test('fractal centers remain unavailable until their two right-hand closes',()=>{
  const d=api.inspect('11.5',{step:4}),a=d.panels[0];assert.ok(a.lines.every(l=>l.values.slice(-2).every(v=>v===null)));
  const peaks=a.lines[0].values.flatMap((v,i)=>Number.isFinite(v)?[i]:[]);assert.ok(peaks.length);const i=peaks.at(-1);assert.equal(I.calculate(d.bars.slice(0,i+2),'fractals').lines[0].values[i],null);assert.equal(I.calculate(d.bars.slice(0,i+3),'fractals').lines[0].values[i],d.bars[i].h);
});
test('stage progression recalculates on its prefix; warmup never invents STC',()=>{
  assert.equal(api.inspect('11.17',{step:0}).panels[0].lines[0].values.filter(Number.isFinite).length,0);
  for(const key of api.keys){const early=api.inspect(key,{step:0}),late=api.inspect(key,{step:4});assert.ok(early.count<late.count);assert.equal(late.count,96);assert.deepEqual(early.bars,late.bars.slice(0,early.count));assert.notDeepEqual(late.bars.slice(0,80),api.inspect(key,{practice:true}).bars);}
});
test('geometric interpolation never carries revealed future into a hidden attempt',()=>{
  assert.equal(api.canAnimate({count:96,revealed:true},{count:80,revealed:false}),false);
  assert.equal(api.canAnimate({count:80,revealed:false},{count:20,revealed:false}),false);
  assert.equal(api.canAnimate({count:36,revealed:false},{count:60,revealed:false}),true);
  for(const key of api.keys){assert.equal(records[key].alternate,true);assert.equal(records[key].alternateAfterReveal,true);}
});
test('renderer adapts axes to narrow host, exposes real controls and cleans up',()=>{
  const control={value:'default',onchange:null},host={clientWidth:304,innerHTML:'',querySelector:()=>control};
  const cleanup=records['11.4'].render(host,{step:4});assert.match(host.innerHTML,/viewBox="0 0 296 298"/);assert.match(host.innerHTML,/SMA\(2\)/);control.value='ema';control.onchange();assert.match(host.innerHTML,/EMA\(2\)/);assert.doesNotMatch(host.innerHTML,/NaN|undefined/);cleanup();assert.equal(host.innerHTML,'');
  for(const key of api.keys){const h={clientWidth:304,innerHTML:'',querySelector:()=>null};for(let step=0;step<5;step++){records[key].render(h,{step});assert.doesNotMatch(h.innerHTML,/NaN|Infinity|undefined/,key+' stage '+step);}records[key].render(h,{practice:true});assert.match(h.innerHTML,/будущее скрыто/);assert.doesNotMatch(h.innerHTML,/NaN|undefined/);}
});
