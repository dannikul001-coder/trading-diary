'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

const sandbox={window:{},Intl};vm.createContext(sandbox);
for(const file of ['academy-market-structure','academy-market-foundations','academy-market-levels','academy-market-order-block','academy-market-liquidity','academy-market-advanced','academy-chart-reference-meta']){
 const filename=path.join(__dirname,'../js',file+'.js');vm.runInContext(fs.readFileSync(filename,'utf8'),sandbox,{filename});
}
const scenes=sandbox.window.TD_MARKET_SCENES,decorate=sandbox.window.TDChartReference.decorate;
const data=x=>JSON.parse(JSON.stringify(x));
const geometry=['price','index','low','high','from','to','fromIndex','fromPrice','toIndex','toPrice','kind','label','shape'];
const relativeTags=new Set(['HH','HL','LH','LL']);
function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;}
function eachConfiguration(fn){let count=0;for(const[key,definition]of Object.entries(scenes))for(const practice of[false,true])for(let step=0;step<definition.stages.length;step++)for(const revealed of[false,true])for(const alternate of[false,true]){const options={step,practice,revealed,alternate};fn(key,definition.build(options),options);count++;}return count;}
function scene(key,options={}){return decorate(scenes[key].build(options),key,options);}

test('reference metadata is a pure presentation adapter across all 1136 price configurations',()=>{
 assert.equal(Object.keys(scenes).length,27);
 const count=eachConfiguration((key,raw,context)=>{
  const before=JSON.stringify(raw);freeze(raw);const result=decorate(raw,key,context);
  assert.equal(JSON.stringify(raw),before,key+' modified a frozen source');
  assert.strictEqual(result.bars,raw.bars,key+' changed or regenerated candles');
  assert.strictEqual(result.detail,raw.detail,key+' changed the mathematical detail');
  assert.strictEqual(result.narration,raw.narration,key+' changed the lesson explanation');
  assert.equal(result.knownPrefixLength,raw.knownPrefixLength,key+' changed known history');
  for(const field of['zones','levels','markers','callouts','segments']){
   assert.equal(result[field]?.length,raw[field]?.length,key+' created or removed '+field);
   for(let i=0;i<(raw[field]||[]).length;i++)for(const attribute of geometry){
    if(Object.hasOwn(raw[field][i],attribute))assert.deepEqual(result[field][i][attribute],raw[field][i][attribute],key+' changed '+field+' '+attribute);
   }
  }
  assert.equal(result.instrument,'Учебная модель');
  assert.equal(result.timeIsSynthetic,true);
  assert.ok(Number.isFinite(result.timeframeMinutes)&&result.timeframeMinutes>0,key+' missing actual authored interval');
 });
 assert.equal(count,1136);
});

test('Order Block reaction is distinct from the preceding return',()=>{
 for(const practice of[false,true]){
  const result=scene('12.3',{step:5,practice,revealed:true});
  const reaction=result.markers.find(m=>m.label==='Реакция после возвращения');
  assert.ok(reaction,'authored reaction marker exists');
  assert.equal(reaction.shortLabel,'Реакция');assert.equal(reaction.semantic,'reaction');
  const returning=result.markers.find(m=>m.label==='Более поздний подход');
  assert.equal(returning.shortLabel,'Возврат');assert.equal(returning.semantic,'return');
  const newReaction=result.callouts.find(c=>/^Новая реакция:/.test(c.label));
  assert.equal(newReaction.shortLabel,'Реакция');assert.equal(newReaction.semantic,'reaction');
 }
});

test('sample lessons retain honest OB, FVG, liquidity-reference and invalidation roles',()=>{
 const ob=scene('12.3',{step:4});assert.equal(ob.zones[0].role,'ob');assert.equal(ob.zones[0].shortLabel,'OB');assert.equal(ob.zones[0].project,true);
 assert.equal(ob.levels.find(l=>/^Нарушение/.test(l.label)).role,'invalid');
 assert.equal(ob.levels.find(l=>/^Прежний верх/.test(l.label)).role,'neutral');
 const fvg=scene('12.4',{step:3});assert.equal(fvg.zones[0].role,'fvg');assert.equal(fvg.zones[0].shortLabel,'FVG');assert.equal(fvg.zones[0].project,true);
 assert.deepEqual(Array.from(fvg.levels,l=>l.shortLabel),['H1','L3']);
 for(const key of['12.1','12.2']){
  const model=scene(key,{step:3}),level=model.levels[0];assert.equal(level.role,'liquidity');assert.equal(level.ordersObserved,false);assert.equal(level.semantic,'price-reference');
  assert.match(level.semanticNote,/не наблюдаются/);assert.ok(!/стоп|ордер/i.test(level.shortLabel));
 }
 const plan=scene('5.1',{step:3});assert.equal(plan.levels.find(l=>/^Ориентир/.test(l.label)).role,'target');assert.equal(plan.levels.find(l=>/^Плановый вход/.test(l.label)).role,'neutral');
});

test('HH/HL/LH/LL use only authored, strictly confirmed pivots in available history',()=>{
 let checked=0;
 eachConfiguration((key,raw,context)=>{
  const model=decorate(raw,key,context);
  for(const marker of model.markers||[]){
   if(!relativeTags.has(marker.shortLabel))continue;checked++;
   assert.ok(['1.2','6.1','12.6'].includes(key),key+' invented structural labels in an unrelated lesson');
   assert.equal(marker.confirmed,true);assert.equal(marker.availableAt,marker.index+marker.pivotRule.right);assert.ok(marker.availableAt<model.bars.length);
   const field=marker.pivotSide==='high'?'h':'l',price=model.bars[marker.index][field];assert.equal(marker.price,price);
   for(let offset=-marker.pivotRule.left;offset<=marker.pivotRule.right;offset++){
    if(!offset)continue;const other=model.bars[marker.index+offset]?.[field];assert.ok(Number.isFinite(other));assert.ok(marker.pivotSide==='high'?price>other:price<other,key+' unconfirmed pivot');
   }
   const previous=model.bars[marker.previousPivotIndex][field];
   assert.equal(marker.shortLabel,marker.pivotSide==='high'?(price>previous?'HH':'LH'):(price>previous?'HL':'LL'));
  }
 });
 assert.ok(checked>500,'many causal structural labels were verified');
 const main=scene('1.2',{step:1}),practice=scene('1.2',{step:1,practice:true});
 assert.deepEqual(Array.from(main.markers.filter(m=>relativeTags.has(m.shortLabel)),m=>m.shortLabel),['HH','HH','HL','HL']);
 assert.deepEqual(Array.from(practice.markers.filter(m=>relativeTags.has(m.shortLabel)),m=>m.shortLabel),['LH','LH','LL','LL']);
 assert.equal(practice.markers.find(m=>m.index===63).shortLabel,'Кандидат');
});

test('6.1 stages now include both right neighbours before claiming confirmation',()=>{
 assert.deepEqual(Array.from(scenes['6.1'].counts),[60,65,70,72,80,90]);
 for(const practice of[false,true]){
  const low=scene('6.1',{step:1,practice});
  const lowPoint=low.markers.find(m=>m.index===62);assert.equal(lowPoint.confirmed,true);assert.equal(lowPoint.availableAt,64);assert.ok(low.bars.length>=65);
  const high=scene('6.1',{step:2,practice});
  const highPoint=high.markers.find(m=>m.index===67);assert.equal(highPoint.confirmed,true);assert.equal(highPoint.availableAt,69);assert.ok(high.bars.length>=70);
 }
 const raw=scenes['6.1'].build({step:2}),premature=decorate({...raw,bars:raw.bars.slice(0,68)},'6.1',{}),point=premature.markers.find(m=>m.index===67);
 assert.equal(point.confirmed,false);assert.equal(point.shortLabel,'Кандидат');
});

test('timestamp metadata uses declared intervals, explicit overrides and synthetic identity',()=>{
 for(const[label,expected]of[['15 минут · модель',15],['3 минуты · группы',3],['2 часа · модель',120],['M15',15],['5 mins',5]]){
  const result=decorate({bars:[],intervalLabel:label},'unknown');assert.equal(result.timeframeMinutes,expected);assert.equal(result.startTime,'2026-01-12T09:00:00Z');assert.equal(result.timeIsSynthetic,true);
 }
 assert.equal(scene('1.2').timeframeLabel,'M1');assert.equal(scene('12.3').timeframeLabel,'M5');
 const grouped=decorate({bars:[],timeframeMinutes:3,chartRole:'detail'},'0.2');assert.equal(grouped.timeframeLabel,'M3');
 const explicit=decorate({bars:[],timeframeMinutes:15,startTime:'2026-01-20T10:00:00Z'},'1.2');assert.equal(explicit.timeframeMinutes,15);assert.equal(explicit.startTime,'2026-01-20T10:00:00Z');
 const unknown=decorate({bars:[]},'unknown');assert.equal(unknown.timeframeLabel,'Интервалы');assert.equal(unknown.startTime,undefined);assert.equal(unknown.timeframeMinutes,undefined);
});

test('projection applies to genuine areas rather than candle bodies or calculation windows',()=>{
 for(const key of['2.1','2.2','2.3','12.3','12.4'])assert.ok(scene(key,{step:3}).zones.every(z=>z.project));
 for(const key of['0.2','3.3','4.1','1.1','1.3','12.7','13.9'])for(const zone of scene(key,{step:2}).zones||[]){assert.equal(zone.role,'neutral');assert.equal(zone.project,false);}
 const indicator=decorate({bars:[],mode:'indicator',zones:[{low:0,high:30,kind:'support',label:'Нижняя область'}]},'11.1');assert.equal(indicator.zones[0].role,'neutral');assert.equal(indicator.zones[0].project,false);
 const precise=freeze({bars:[{o:.9123456789,h:.9123556789,l:.9123356789,c:.9123506789}],levels:[{price:.91234712345,label:'Уровень'}],zones:[{low:.91234612345,high:.91234998765,kind:'neutral',label:'Контекст'}]});
 const decorated=decorate(precise,'unknown');assert.strictEqual(decorated.bars,precise.bars);assert.equal(decorated.levels[0].price,precise.levels[0].price);assert.equal(decorated.zones[0].low,precise.zones[0].low);assert.equal(decorated.zones[0].high,precise.zones[0].high);assert.equal(decorated.projectionPath,undefined);assert.deepEqual(data(decorated.bars),data(precise.bars));
});
