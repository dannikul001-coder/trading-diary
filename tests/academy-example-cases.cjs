const assert=require('node:assert/strict');global.window={};
for(const file of ['course-v1','course-models','course-guides','course-extension','course-editorial','course-editorial-a','course-editorial-b','course-editorial-c'])require('../learning/'+file+'.js');
for(const file of ['learning-indicators','academy-studio-price','academy-studio-indicators','academy-studio-decisions','academy-example-cases'])require('../js/'+file+'.js');
const entries=window.TD_STUDIO_LESSONS,price=window.TD_STUDIO_PRICE,indicators=window.TD_STUDIO_INDICATORS;
let count=0;
for(const [key,entry] of Object.entries(entries)){
 assert(entry.examples.length>=2&&entry.examples.length<=3,key);assert.equal(new Set(entry.examples.map(c=>c.id)).size,entry.examples.length);
 for(const item of entry.examples){
  count++;assert(item.title&&item.body.length>30&&item.task,key+' case text');assert(item.step>=0&&item.step<entry.stages.length,key+' case step');
  assert(window.AcademyExampleCases.series(key,item).every(v=>v===null||Number.isFinite(v)),key+' finite preview');
  if(item.stop){const prefix=price.scene(key)?price.visible(key,{step:item.step,exampleStop:item.stop}).bars:indicators.inspect(key,{step:item.step,exampleStop:item.stop}).bars;assert.equal(prefix.length,item.stop);const full=price.scene(key)?price.visible(key,{step:item.step}).bars:indicators.inspect(key,{step:item.step}).bars;assert.deepEqual(JSON.parse(JSON.stringify(prefix)),JSON.parse(JSON.stringify(full.slice(0,item.stop)))),key+' checkpoint cannot leak the continuation';}
  if(item.id==='mistake'){assert(item.rows.some(row=>row[0]==='Ошибочное утверждение'));assert(item.rows.some(row=>row[0]==='Корректный вывод'));}
 }
}
assert.equal(Object.keys(entries).length,81);assert.equal(count,240);
for(const key of ['2.1','2.2']){const [base,contrast,checkpoint]=entries[key].examples,a=price.visible(key,{step:base.step}),b=price.visible(key,{step:contrast.step,alternate:true}),p=price.visible(key,{step:checkpoint.step,exampleStop:checkpoint.stop});assert.deepEqual(a.bars.slice(0,p.bars.length),p.bars);assert.deepEqual(b.bars.slice(0,p.bars.length),p.bars);}
assert.equal(price.visible('2.1',{step:3}).bars[42].c,100.8);assert.equal(price.visible('2.1',{step:3,alternate:true}).bars[42].c,97.6);
assert.equal(price.visible('2.2',{step:3}).bars[5].l,103.5);assert.equal(price.visible('2.2',{step:3,alternate:true}).bars[5].c,101);
console.log('PASS: 240 topic-specific example cases in 81 lessons, valid/false/open conditions and causal checkpoints');
