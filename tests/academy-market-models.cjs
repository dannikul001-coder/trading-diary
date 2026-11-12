const {test}=require('node:test');
const assert=require('node:assert/strict');

global.window={};
for(const file of ['course-v1','course-models','course-guides','course-extension','course-editorial','course-editorial-a','course-editorial-b','course-editorial-c'])require('../learning/'+file);
require('../js/learning-indicators');
require('../js/academy-studio-price');
const oldPrice=window.TD_STUDIO_PRICE;
for(const file of ['foundations','structure','levels','order-block','liquidity','advanced'])require('../js/academy-market-'+file);
require('../js/academy-market-indicators');
require('../js/academy-studio-indicators');

const scenes=window.TD_MARKET_SCENES;
const expected=['0.1','0.2','0.3','1.1','1.2','1.3','2.1','2.2','2.3','3.1','3.2','3.3','4.1','5.1','6.1','6.2','6.3','8.1','8.2','12.1','12.2','12.3','12.4','12.5','12.6','12.7','13.9'];
const finite=Number.isFinite;
const near=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-9,label+': '+a+' ≠ '+b);
const finalOptions=definition=>({step:definition.stages.length-1});
const ohlc=bar=>[bar.o,bar.h,bar.l,bar.c];
const aggregate=(bars,n)=>Array.from({length:Math.floor(bars.length/n)},(_,i)=>{const group=bars.slice(i*n,(i+1)*n);return{o:group[0].o,h:Math.max(...group.map(b=>b.h)),l:Math.min(...group.map(b=>b.l)),c:group.at(-1).c};});
const trueRanges=bars=>bars.map((b,i)=>i?Math.max(b.h-b.l,Math.abs(b.h-bars[i-1].c),Math.abs(b.l-bars[i-1].c)):b.h-b.l);

function variants(definition){
 const result=[];
 for(let step=0;step<definition.stages.length;step++)for(const alternate of[false,true])result.push({step,alternate});
 for(const revealed of[false,true])for(const alternate of[false,true])result.push({practice:true,revealed,alternate});
 for(const example of definition.examples||[])result.push({step:example.step,alternate:!!example.alternate,...(Number.isInteger(example.stop)?{exampleStop:example.stop}:{})});
 return result;
}

test('all 27 price topics have an authored market history and a separate exercise',()=>{
 assert.deepEqual(Object.keys(scenes).sort(),expected.slice().sort());
 const contexts=new Map();
 for(const key of expected){
  const definition=scenes[key],first=definition.build({step:0}),complete=definition.build(finalOptions(definition)),practice=definition.build({practice:true});
  assert.ok(first.bars.length>=60,key+' initial market context');
  // The anatomy lesson deliberately advances one forming interval, without
  // inventing later intervals:64 immutable past candles +1 focal candle.
  assert.ok(complete.bars.length>=(key==='1.1'?65:70),key+' complete context');
  assert.ok(practice.bars.length>=60,key+' exercise context');
  assert.ok(new Set(first.bars.map(b=>JSON.stringify(ohlc(b)))).size>=40,key+' individual OHLC intervals, not repeated tiny geometry');
  assert.notDeepEqual(practice.bars,complete.bars.slice(0,practice.bars.length),key+' fresh practice source');
  assert.notDeepEqual(first.bars,oldPrice.scene(key).bars,key+' old tiny illustration replaced');
  const signature=JSON.stringify(definition.bars);
  if(contexts.has(signature))assert.deepEqual([contexts.get(signature),key].sort(),['0.2','3.3'],'only the two explicitly related aggregation lessons share their minute source');
  else contexts.set(signature,key);
  assert.equal(definition.stages.length,definition.counts.length,key+' stage counts');
  for(const stage of definition.stages)for(const field of['title','body','task'])assert.ok(typeof stage[field]==='string'&&stage[field].length>10,key+' authored '+field);
 }
});

test('every stage, declared example and practice annotation identifies available prices',()=>{
 let views=0;
 for(const key of expected){
  const definition=scenes[key],snapshot=JSON.stringify([definition.bars,definition.practiceBars,definition.continuations,definition.practiceContinuations]);
  for(const options of variants(definition)){
   const config=definition.build(options),label=key+' '+JSON.stringify(options),last=config.bars.length-1;views++;
   for(const bar of config.bars){assert.ok(ohlc(bar).every(finite),label+' finite OHLC');assert.ok(bar.h>=Math.max(bar.o,bar.c)&&bar.l<=Math.min(bar.o,bar.c),label+' OHLC bounds');}
   for(const kind of['markers','callouts'])for(const point of config[kind]||[]){
    assert.ok(Number.isInteger(point.index)&&point.index>=0&&point.index<=last,label+' available '+kind);
    assert.ok(finite(point.price),label+' finite '+kind);
    const bar=config.bars[point.index];assert.ok(point.price>=bar.l-1e-9&&point.price<=bar.h+1e-9,label+' '+kind+' price lies in its actual interval');
    assert.ok(point.availableAt===undefined||point.availableAt<=last,label+' confirmation already known');
   }
   for(const region of config.zones||[]){assert.ok([region.low,region.high].every(finite)&&region.low<=region.high,label+' bounded zone prices');assert.ok(Number.isInteger(region.from)&&Number.isInteger(region.to)&&region.from>=0&&region.from<=region.to&&region.to<=last,label+' bounded zone lifespan');assert.ok(region.availableAt===undefined||region.availableAt<=last,label+' zone birth is available');}
   for(const level of config.levels||[]){assert.ok(finite(level.price),label+' known reference price');assert.ok(level.from>=0&&level.to<=last&&level.from<=level.to,label+' reference span');assert.ok(level.availableAt===undefined||level.availableAt<=last,label+' reference known');}
   for(const segment of config.segments||[]){assert.ok(Number.isInteger(segment.fromIndex)&&Number.isInteger(segment.toIndex)&&segment.fromIndex>=0&&segment.fromIndex<=last&&segment.toIndex>=0&&segment.toIndex<=last,label+' segment anchors');assert.ok([segment.fromPrice,segment.toPrice].every(finite),label+' segment prices');assert.ok(segment.availableAt===undefined||segment.availableAt<=last,label+' segment availability');}
   for(const index of config.highlight||[])assert.ok(Number.isInteger(index)&&index>=0&&index<=last,label+' available highlight');
   if(config.focus!==undefined)assert.ok(Number.isInteger(config.focus)&&config.focus>=0&&config.focus<=last,label+' available focus');
   if(config.detail?.bar)assert.deepEqual(config.detail.bar,config.bars[config.detail.index],label+' detail uses selected actual interval');
   assert.ok(config.narration?.title&&config.narration?.body&&config.narration?.task,label+' scene-specific explanation');
   assert.doesNotMatch(JSON.stringify([config.narration,config.detail]),/NaN|undefined|Infinity/,label+' legible explanation');
  }
  assert.equal(JSON.stringify([definition.bars,definition.practiceBars,definition.continuations,definition.practiceContinuations]),snapshot,key+' building scenes does not mutate original history');
 }
 assert.ok(views>=470,'all model variants audited');
});

test('alternate outcomes preserve every already known interval and hidden exercise state',()=>{
 for(const key of expected){
  const definition=scenes[key],normal=definition.build(finalOptions(definition)),alternate=definition.build({...finalOptions(definition),alternate:true});
  assert.deepEqual(normal.bars.slice(0,definition.cut),alternate.bars.slice(0,definition.cut),key+' common theory prefix');
  if(definition.alternate!==false)assert.notDeepEqual(normal.bars.slice(definition.cut),alternate.bars.slice(definition.cut),key+' outcomes actually differ');
  for(let step=0;step<definition.stages.length;step++){
   const visible=definition.build({step});
   if(key==='1.1'){assert.deepEqual(visible.bars.slice(0,64),normal.bars.slice(0,64),key+' only the focal forming interval changes');continue;}
   assert.deepEqual(visible.bars,normal.bars.slice(0,visible.bars.length),key+' each stage is a causal prefix');
  }
  const hidden=definition.build({practice:true}),otherHidden=definition.build({practice:true,alternate:true});
  assert.deepEqual(hidden,otherHidden,key+' hidden branch cannot leak into geometry, labels or detail');
  for(const branch of[false,true]){
   const revealed=definition.build({practice:true,revealed:true,alternate:branch});
   assert.deepEqual(revealed.bars.slice(0,definition.practiceCut),hidden.bars,key+' exercise reveal preserves old OHLC');
  }
 }
});

test('checkpoint prefixes clamp both annotations and narration to the latest available teaching stage',()=>{
 for(const key of expected){
  const definition=scenes[key];if(typeof definition.visible!=='function')continue;
  const requested=definition.stages.length-1;
  for(let stop=definition.counts[0];stop<=definition.counts.at(-1);stop++)for(const alternate of[false,true]){
   const options={step:requested,exampleStop:stop,alternate},config=definition.build(options),state=definition.visible(options),available=definition.counts.reduce((found,count,index)=>count<=config.bars.length?index:found,0);
   assert.equal(state.step,available,key+' stop '+stop+' available stage');
   assert.equal(config.bars.length,stop,key+' exact checkpoint prefix');
   for(const field of['markers','callouts'])for(const point of config[field]||[])assert.ok(point.index<stop&&point.index>=0,key+' checkpoint '+field+' uses known intervals');
   if(stop<=definition.cut)assert.equal(config.narration.title,definition.stages[available].title,key+' checkpoint narrative follows available evidence');
  }
  const bounded=definition.build({step:requested,exampleStop:0});assert.equal(bounded.bars.length,definition.counts[0],key+' a checkpoint preserves the minimum authored context');
 }
 const source=scenes['12.3'].build({step:3,exampleStop:63});assert.equal(source.bars.length,63);assert.equal(source.zones.length,0);assert.match(source.narration.title,/ещё не готовая/);
 const triple=scenes['12.4'].build({step:2,exampleStop:62});assert.equal(triple.bars.length,62);assert.equal(triple.zones.length,0);assert.match(triple.narration.title,/Двух свечей недостаточно/);
 const levels=scenes['2.1'].build({step:5,exampleStop:60});assert.equal(levels.bars.length,60);assert.equal(levels.zones.length,0);
});

test('the anatomy model changes one forming candle inside64 immutable past intervals',()=>{
 const definition=scenes['1.1'],views=definition.stages.map((_,step)=>definition.build({step}));
 assert.deepEqual(views.map(v=>ohlc(v.bars[64])),[[100,100,100,100],[100,110,100,110],[100,110,95,95],[100,110,95,106]]);
 for(let step=0;step<views.length;step++){
  const view=views[step];assert.equal(view.bars.length,65);assert.deepEqual(view.bars.slice(0,64),views[0].bars.slice(0,64));assert.equal(view.forming,step<3);assert.equal(view.detail.forming,step<3);assert.equal(view.detail.index,64);
 }
 const final=views.at(-1).bars[64];near(Math.abs(final.c-final.o),6,'body');near(final.h-Math.max(final.o,final.c),4,'upper wick');near(Math.min(final.o,final.c)-final.l,5,'lower wick');
});

test('timeframe lessons aggregate their exact visible minutes into completed groups',()=>{
 for(const key of['0.2','3.3'])for(const options of variants(scenes[key])){
  const config=scenes[key].build(options),detail=config.detail;assert.equal(detail.kind,'aggregation');assert.equal(detail.group,3);assert.deepEqual(detail.bars,aggregate(config.bars,3),key+' exact OHLC aggregation');assert.equal(detail.bars.length,Math.floor(config.bars.length/3));
  assert.deepEqual(detail.sourceBars,config.bars.slice(detail.from,detail.to+1),key+' highlighted source minutes');assert.deepEqual(detail.bars[detail.focusGroup],aggregate(detail.sourceBars,3)[0],key+' focused large interval comes from highlighted minutes');
 }
});

test('ATR lesson uses true ranges including gaps and its declared simple3-period mean',()=>{
 const definition=scenes['4.1'];
 for(const options of variants(definition)){
  const config=definition.build(options),ranges=trueRanges(config.bars),expected=ranges.map((_,i)=>i<2?null:(ranges[i-2]+ranges[i-1]+ranges[i])/3);assert.equal(config.detail.kind,'atr');assert.deepEqual(config.detail.values,expected,'all available ATR points match independent arithmetic');
 }
 const theory=definition.build({step:2});assert.deepEqual(trueRanges(theory.bars).slice(60,63),[2,3,8]);near(theory.detail.values[62],13/3,'theory ATR63');
 const practice=definition.build({practice:true});assert.deepEqual(trueRanges(practice.bars).slice(60,63),[2,4,9]);near(practice.detail.values[62],5,'practice ATR63');
 const base=definition.build({step:3}),contrast=definition.build({step:3,alternate:true});near(trueRanges(base.bars)[63],3,'base new TR');near(trueRanges(contrast.bars)[63],9,'contrast new TR');near(base.detail.values[63],14/3,'base shifted ATR');near(contrast.detail.values[63],20/3,'contrast shifted ATR');
});

test('approved support/resistance example keeps its original42 OHLC intervals inside the larger history',()=>{
 const definition=scenes['2.1'],full=definition.build(finalOptions(definition)),original=oldPrice.scene('2.1').bars;
 assert.equal(original.length,42);assert.deepEqual(full.bars.slice(24,66).map(b=>b.c),original.map(b=>b.c));
 for(let i=0;i<42;i++)for(const field of['o','h','l','c'])near(full.bars[i+24][field],original[i][field],'approved original candle '+(i+1)+' '+field);
 for(const alternate of[false,true]){const zones=definition.build({...finalOptions(definition),alternate}).zones;assert.ok(zones.some(z=>z.low===98&&z.high===100));assert.ok(zones.some(z=>z.low===108&&z.high===110));}
});

test('Order Block is born after the confirmed break and preserves the full source-candle range',()=>{
 const definition=scenes['12.3'],full=definition.build(finalOptions(definition)),source=full.bars[60],oldHigh=full.bars[51].h;
 assert.ok(source.c<source.o);assert.ok([61,62,63].every(i=>full.bars[i].c>full.bars[i].o));assert.ok(full.bars[62].c<=oldHigh&&full.bars[63].c>oldHigh,'first completed break of the selected historical high');
 for(const step of[0,1,2])assert.equal(definition.build({step}).zones.filter(z=>/Order Block/.test(z.label)).length,0,'source is not boxed before its role is confirmed and explained');
 for(const step of[3,4,5])for(const alternate of[false,true]){
  const config=definition.build({step,alternate}),zone=config.zones.find(z=>/Order Block/.test(z.label));assert.ok(config.bars.length>=64,'confirmation already visible');assert.ok(zone);assert.equal(zone.from,60);near(zone.low,source.l,'source lower wick');near(zone.high,source.h,'source upper wick');assert.notEqual(zone.low,Math.min(source.o,source.c));assert.notEqual(zone.high,Math.max(source.o,source.c));
 }
 const retest=full.bars[75];assert.ok(retest.l<=source.h&&retest.h>=source.l);assert.ok(retest.c>=source.l&&retest.c<=source.h);
 const cancelled=definition.build({...finalOptions(definition),alternate:true});assert.ok(cancelled.bars[76].c<source.l);assert.deepEqual(cancelled.zones.map(z=>[z.low,z.high]),full.zones.map(z=>[z.low,z.high]),'invalidation does not stretch the old region');
 assert.equal(definition.build({practice:true}).zones.length,0,'independent identification exercise does not box its answer before submission');
 const revealed=definition.build({practice:true,revealed:true}),practiceSource=revealed.bars[60],practiceZone=revealed.zones.find(z=>/Order Block/.test(z.label));near(practiceZone.low,practiceSource.l,'independent source Low');near(practiceZone.high,practiceSource.h,'independent source High');
});

test('FVG compares outer candle edges and appears only after the third close',()=>{
 const definition=scenes['12.4'];
 for(const step of[0,1])assert.equal(definition.build({step}).zones.length,0,'third candle is unavailable, so no region exists');
 for(const options of[{step:2},{step:3},{step:4},{step:5},{step:5,alternate:true},{practice:true,revealed:true}]){
  const config=definition.build(options),first=config.bars[60],middle=config.bars[61],third=config.bars[62],zone=config.zones.find(z=>/FVG/.test(z.label));assert.ok(first.h<third.l);assert.ok(zone);near(zone.low,first.h,'outer first High');near(zone.high,third.l,'outer third Low');assert.equal(zone.from,62,'area starts when the closed triple is known');assert.ok(config.bars.length>=63);assert.ok(middle.l<=zone.low&&middle.h>=zone.high,'middle interval spans the region; the rule compares outer candles');assert.ok(middle.o<zone.low&&middle.c>zone.high,'middle candle body also crosses both chosen edges');
 }
 assert.equal(definition.build({practice:true}).zones.length,0,'practice asks the student to identify outer edges independently');
});

test('order-flow evidence retains the same focal OHLC and shows two compatible intrabar orders',()=>{
 const definition=scenes['12.5'];
 for(const practice of[false,true])for(const alternate of[false,true]){
  const config=definition.build(practice?{practice,revealed:true,alternate}:{...finalOptions(definition),alternate}),detail=config.detail;
  assert.equal(detail.kind,'paths');assert.equal(detail.paths.length,2);assert.deepEqual(detail.bar,config.bars[detail.index]);
  for(const route of detail.paths){assert.equal(route.values[0],detail.bar.o);assert.equal(route.values.at(-1),detail.bar.c);near(Math.max(...route.values),detail.bar.h,'compatible maximum');near(Math.min(...route.values),detail.bar.l,'compatible minimum');}
  assert.notDeepEqual(detail.paths[0].values,detail.paths[1].values,'possible high/low order differs');
 }
 const a=definition.build(finalOptions(definition)),b=definition.build({...finalOptions(definition),alternate:true});assert.deepEqual(ohlc(a.bars[64]),[100,110,95,106]);assert.deepEqual(a.bars[64],b.bars[64]);assert.notDeepEqual(a.bars.slice(definition.cut),b.bars.slice(definition.cut));assert.deepEqual(a.detail.paths,b.detail.paths,'later prices do not reconstruct an earlier intrabar path');
});

test('all28 indicator guides expose real stage-linked features and causal STC scenarios',()=>{
 const guides=window.TD_MARKET_INDICATOR_GUIDES,api=window.TD_STUDIO_INDICATORS,I=window.LearningIndicators;
 assert.equal(Object.keys(guides).length,28);assert.deepEqual(Object.keys(guides).sort(),api.keys.slice().sort());
 for(const key of api.keys){const guide=guides[key];assert.equal(guide.stages.length,5);assert.ok(guide.counts.every(n=>n>=60));for(let step=0;step<5;step++){const data=api.inspect(key,{step}),view=guide.build({step,data});assert.equal(view.panels.length,data.panels.length);for(const [index,layer]of view.panels.entries()){assert.ok(layer.highlight.length<=3);assert.ok(layer.callouts.length<=1);for(const point of layer.markers)assert.ok(data.panels[index].lines.some(line=>finite(line.values[point.index])&&Math.abs(line.values[point.index]-point.price)<1e-9),key+' panel annotation identifies its calculated feature');}}}
 for(const key of['11.17','13.10'])for(const practice of[false,true]){
  const guide=guides[key],bars=practice?guide.practiceBars:guide.theoryBars,prefix=I.calculate(bars.slice(0,80),'stc').lines[0].values,full=I.calculate(bars,'stc').lines[0].values;assert.equal(bars.length,96);assert.deepEqual(prefix,full.slice(0,80));assert.equal(prefix.findIndex(finite),67);
  for(const threshold of[35,65])assert.ok(prefix.some((value,i)=>i&&finite(prefix[i-1])&&(prefix[i-1]<=threshold&&value>threshold||prefix[i-1]>=threshold&&value<threshold)),key+' real threshold event before the exercise cut');
 }
});
