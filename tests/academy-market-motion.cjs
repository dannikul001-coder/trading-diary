'use strict';
// Exercise the complete local lesson UI in an isolated browser profile.
// No signed-in browser state is reused, and database requests are blocked.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.TD_NODE_MODULES||'C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1110-973-0_26.1110.973.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules','playwright'));
const url=process.argv[2]||'http://127.0.0.1:8767/academy-preview.html';
const output=process.env.TD_MOTION_OUTPUT||path.resolve(__dirname,'../../../outputs/academy-authored-scenes');
const gallery=path.join(output,'gallery'),equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const galleryOnly=process.env.TD_MOTION_GALLERY_ONLY==='1';
const report={url,viewport:{width:1440,height:1200},lessons:[],transitions:[],theory:[],shrinkChecks:[],reducedMotion:[],screenshots:[],issues:[],pageErrors:[],databaseRequests:[]};
const issue=(key,where,message,details={})=>report.issues.push({key,where,message,...details});
const settle=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));

async function install(page){
 await page.evaluate(()=>{
  const original=TDTerminalChart.mount,nativeRAF=window.requestAnimationFrame;
  TDTerminalChart.mount=function(host,options){const cleanup=original.call(this,host,options);const terminal=host.querySelector('.as-terminal');if(terminal)terminal.__motionConfig=options;return cleanup;};
  window.__motionShape=()=>JSON.stringify([...document.querySelectorAll('[data-as-scene] .as-terminal-svg')].map(svg=>[...svg.querySelectorAll('.as-terminal-candle line,.as-terminal-candle rect,.as-terminal-series')].map(node=>[node.tagName,...['x','y','width','height','x1','y1','x2','y2','d','cx','cy'].map(attribute=>node.getAttribute(attribute))])));
  window.__motionPaneShapes=()=>Object.fromEntries([...document.querySelectorAll('[data-as-scene] .as-terminal')].filter(node=>!node.closest('[hidden]')).map(node=>[node.__motionConfig?.id,JSON.stringify([...node.querySelectorAll('.as-terminal-candle line,.as-terminal-candle rect,.as-terminal-series')].map(n=>[n.tagName,...['x','y','width','height','x1','y1','x2','y2','d','cx','cy'].map(a=>n.getAttribute(a))]))]));
  window.__motionFrames=[];window.__motionPaneFrames=[];window.__motionCapturing=false;
  window.requestAnimationFrame=callback=>nativeRAF(time=>{callback(time);if(window.__motionCapturing){window.__motionFrames.push(window.__motionShape());if(window.__motionKey==='13.8')window.__motionPaneFrames.push(window.__motionPaneShapes());}});
  window.__motionSnapshot=()=>{
   const terminals=[...document.querySelectorAll('[data-as-scene] .as-terminal')].filter(node=>!node.closest('[hidden]')&&node.getBoundingClientRect().width>0);
   return{shape:window.__motionShape(),paneShapes:window.__motionPaneShapes(),terminals:terminals.map(node=>({id:node.__motionConfig?.id,role:node.dataset.chartRole,bars:node.__motionConfig?.bars||[],knownPrefixLength:node.__motionConfig?.knownPrefixLength,forming:!!node.__motionConfig?.forming,candleNodes:node.querySelectorAll('.as-terminal-candle').length,totalCandleNodes:node.querySelector('[data-tc-candles]')?.children.length||0,probeMax:Number(node.querySelector('[data-tc-probe]')?.max),caption:node.__motionConfig?.caption}))};
  };
 });
}

async function snapshot(page){return page.evaluate(()=>window.__motionSnapshot());}
const primary=state=>state.terminals.find(t=>t.role==='context')||state.terminals[0];

async function captureGallery(page,item){
 // A modal clips content outside its scrollport. Keep the requested1440px
 // width, while making the viewport tall enough for a complete model export.
 await page.setViewportSize({width:1440,height:5000});await settle(page);
 const model=page.locator('[data-as-model]').first(),height=await model.evaluate(node=>node.scrollHeight);
 if(height>4300){await page.setViewportSize({width:1440,height:Math.ceil(height+1000)});await settle(page);}
 await model.scrollIntoViewIfNeeded();const file=path.join(gallery,item.key+'.png');await model.screenshot({path:file,animations:'disabled'});report.screenshots.push({key:item.key,file});
 await page.setViewportSize(report.viewport);await settle(page);
}

async function transition(page,key,selector,where){
 const before=await snapshot(page);
 const immediate=await page.evaluate(selector=>{window.__motionFrames=[];window.__motionPaneFrames=[];window.__motionCapturing=true;const target=document.querySelector(selector);if(!target)throw new Error('Missing transition control '+selector);target.click();return window.__motionSnapshot();},selector);
 await page.waitForTimeout(550);
 const end=await page.evaluate(()=>{window.__motionCapturing=false;return{...window.__motionSnapshot(),frames:window.__motionFrames,paneFrames:window.__motionPaneFrames};});
 const source=primary(before),target=primary(end),instant=primary(immediate),frames=[...new Set(end.frames)],intermediate=frames.filter(shape=>shape!==before.shape&&shape!==end.shape);
 const both=source&&target,sameCount=both&&source.bars.length===target.bars.length,different=both&&!equal(source.bars,target.bars),shorter=both&&target.bars.length<source.bars.length;
 const sharedPrefix=both&&equal(source.bars.slice(0,Math.min(source.bars.length,target.bars.length)),target.bars.slice(0,Math.min(source.bars.length,target.bars.length)));
 const record={key,where,from:source?.bars.length,to:target?.bars.length,sameCount,differentOHLC:different,prefixOnly:!!sharedPrefix,frames:end.frames.length,distinctFrames:frames.length,intermediateFrames:intermediate.length,panes:end.terminals.length};
 report.transitions.push(record);
 if(sameCount&&different){
  if(before.shape===end.shape)issue(key,where,'Different OHLC produced identical visible chart geometry',record);
  if(intermediate.length===0||frames.length<3)issue(key,where,'Equal-length OHLC change has no smooth intermediate geometry',record);
  if(key==='13.8'){
   record.paneMotion=end.terminals.map(pane=>{const previous=before.terminals.find(t=>t.id===pane.id),states=[...new Set(end.paneFrames.map(frame=>frame[pane.id]))],middle=states.filter(shape=>shape!==before.paneShapes[pane.id]&&shape!==end.paneShapes[pane.id]);if(previous&&previous.bars.length===pane.bars.length&&!equal(previous.bars,pane.bars)&&!middle.length)issue(key,where,'A source/Heikin Ashi pane jumps without intermediate geometry',{id:pane.id});return{id:pane.id,intermediate:middle.length,distinct:states.length};});
  }
 }
 if(shorter){
  report.shrinkChecks.push({key,where,from:source.bars.length,to:target.bars.length,immediate:instant?.bars.length,immediateNodes:instant?.candleNodes,immediateProbe:instant?.probeMax});
  if(!instant||instant.bars.length!==target.bars.length||instant.probeMax!==target.bars.length)issue(key,where,'Shrinking a prefix leaves future intervals selectable before the next frame');
  if(instant&&instant.totalCandleNodes!==0&&instant.totalCandleNodes!==target.bars.length)issue(key,where,'Shrinking a prefix keeps candle nodes from the removed future');
  if(!equal(immediate.terminals.map(t=>t.bars),end.terminals.map(t=>t.bars)))issue(key,where,'Future OHLC survived in an immediate shrink frame');
  if(intermediate.length)issue(key,where,'Removing future intervals must occur immediately without interpolation',record);
 }
 return{before,immediate,end,record};
}

async function lesson(page,item){
 await page.evaluate(({id,key})=>{window.__motionKey=key;return openTrainingLesson(id);},item);await page.locator('[data-as-tab="theory"]').click();await page.locator('[data-as-replay]').click();await settle(page);
 const count=await page.locator('[data-as-step]').count(),initial=primary(await snapshot(page));let previous=initial;
 for(let step=1;step<count;step++){
  if(item.key==='1.1')await transition(page,item.key,'[data-as-step="'+step+'"]','forming '+step);
  else{await page.locator('[data-as-step="'+step+'"]').click();await settle(page);}
  const current=primary(await snapshot(page)),length=Math.min(previous?.bars.length||0,current?.bars.length||0);
  if(!current||current.bars.length<60)issue(item.key,'theory '+step,'No complete authored context');
  if(previous&&current)for(let i=0;i<length;i++)if(!(item.key==='1.1'&&i===64)&&!equal(previous.bars[i],current.bars[i])){issue(item.key,'theory '+step,'A previously visible source candle changed',{index:i,previous:previous.bars[i],current:current.bars[i]});break;}
  report.theory.push({key:item.key,step,count:current?.bars.length,forming:current?.forming});previous=current;
 }
 await page.waitForTimeout(550);
 if(item.key==='1.1'){
  const focal=previous?.bars[64];if(!focal||!equal([focal.o,focal.h,focal.l,focal.c],[100,110,95,106])||previous.forming)issue(item.key,'theory final','The focal candle does not finish with the declared OHLC');
 }
 if(item.key==='13.8'){
  const checked=await page.evaluate(()=>{const configs=[...document.querySelectorAll('[data-as-scene] .as-terminal')].map(n=>n.__motionConfig),source=configs.find(c=>c?.id==='price'),ha=configs.find(c=>c?.id==='panel-0');return{source:!!source,transformed:!!ha,derived:source&&ha&&JSON.stringify(ha.bars)===JSON.stringify(LearningIndicators.heikin(source.bars)),lines:source&&ha&&JSON.stringify(ha.series.map(s=>s.values))===JSON.stringify(LearningIndicators.calculate(source.bars,'dual-supertrend').lines.map(s=>s.values)),different:source&&ha&&source.bars.some((b,i)=>b.c!==ha.bars[i].c)};});
  if(!checked.source||!checked.transformed||!checked.derived||!checked.lines||!checked.different)issue(item.key,'Heikin Ashi evidence','Source and derived candles/filters do not match the declared calculation order',checked);
 }
 await captureGallery(page,item);
 await page.locator('[data-as-tab="examples"]').click();await settle(page);
 await page.locator('[data-as-example="base"]').click();await settle(page);
 const baseToContrast=await transition(page,item.key,'[data-as-example="contrast"]','base → contrast');
 await transition(page,item.key,'[data-as-example="base"]','contrast → base');
 const cutoff=primary(baseToContrast.before)?.knownPrefixLength,sharedKnown=Number.isInteger(cutoff)?Math.min(cutoff,primary(baseToContrast.before).bars.length,primary(baseToContrast.end).bars.length):0;
 if(sharedKnown&&item.key!=='1.1'&&!equal(primary(baseToContrast.before).bars.slice(0,sharedKnown),primary(baseToContrast.end).bars.slice(0,sharedKnown)))issue(item.key,'examples','Alternative rewrites an already known candle');
 // Checkpoints can intentionally be a different displayed prefix (e.g. the
 // timeframe examples). Such changes do not imply a different OHLC scenario.
 const checkpoint=page.locator('[data-as-example="checkpoint"]');if(await checkpoint.count())await transition(page,item.key,'[data-as-example="checkpoint"]','base → checkpoint');
 await page.locator('[data-as-tab="practice"]').click();await settle(page);
 const hidden=primary(await snapshot(page)),max=await page.locator('[data-as-scene] [data-tc-probe]').first().getAttribute('max');
 if(hidden&&Number(max)!==hidden.bars.length)issue(item.key,'hidden practice','Probe exposes a future exercise interval');
 if(hidden&&initial&&equal(hidden.bars,initial.bars))issue(item.key,'hidden practice','Independent practice reuses the original example');
 await page.locator('.modal-close').click();
}

async function reducedMotion(page,items){
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const key of['1.1','2.1','12.3','12.5','11.1','11.17','13.8','13.10']){
  const item=items.find(item=>item.key===key);if(!item)continue;
  await page.evaluate(id=>openTrainingLesson(id),item.id);await page.locator('[data-as-tab="examples"]').click();await page.locator('[data-as-example="base"]').click();await settle(page);
  const before=await snapshot(page),immediate=await page.evaluate(()=>{window.__motionFrames=[];window.__motionCapturing=true;document.querySelector('[data-as-example="contrast"]').click();return window.__motionSnapshot();});
  await page.waitForTimeout(80);
  const after=await page.evaluate(()=>{window.__motionCapturing=false;return{...window.__motionSnapshot(),frames:window.__motionFrames};});
  const intermediate=after.frames.filter(shape=>shape!==immediate.shape&&shape!==after.shape);report.reducedMotion.push({key,frames:after.frames.length,intermediate:intermediate.length,immediateFinal:immediate.shape===after.shape,changed:before.shape!==after.shape});
  if(intermediate.length||immediate.shape!==after.shape)issue(key,'reduced motion','Reduced-motion preference still interpolates chart geometry');
  await page.locator('.modal-close').click();
 }
}

(async()=>{
 fs.mkdirSync(gallery,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.TD_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:report.viewport,reducedMotion:'no-preference'});page.setDefaultTimeout(14000);page.on('pageerror',error=>report.pageErrors.push(error.message));
  await page.route(/https?:\/\/[^/]*supabase\.(?:co|in)\//,route=>{report.databaseRequests.push(route.request().url());return route.abort();});
  await page.goto(url);await page.waitForFunction(()=>window.TD_STUDIO_LESSONS&&window.TDTerminalChart&&window.AcademyExampleCases);await install(page);
  const all=await page.evaluate(()=>TRADING_COURSE_V1.lessons.filter(item=>TD_STUDIO_LESSONS[item.key]?.marketAuthored===true).map(({id,key,title})=>({id,key,title})));
  const filter=process.env.TD_MOTION_LESSONS?.split(',');report.lessons=filter?all.filter(item=>filter.includes(item.key)):all;
  if(!filter)assert.equal(all.length,55,'All55 authored market lessons must be present');
  for(let i=0;i<report.lessons.length;i++){
   const item=report.lessons[i];try{
    if(galleryOnly){await page.evaluate(id=>openTrainingLesson(id),item.id);await page.locator('[data-as-tab="theory"]').click();await page.locator('[data-as-step]').last().click();await page.waitForTimeout(575);await captureGallery(page,item);await page.locator('.modal-close').click();}
    else await lesson(page,item);
   }catch(error){issue(item.key,'runtime',error.stack||error.message);await page.evaluate(()=>window.closeModal?.()).catch(()=>{});}
   if((i+1)%10===0||i===report.lessons.length-1)console.log(JSON.stringify({motionChecked:i+1,total:report.lessons.length,screenshots:report.screenshots.length,issues:report.issues.length}));
  }
  if(!galleryOnly)await reducedMotion(page,report.lessons);
  assert.deepEqual(report.pageErrors,[],'Browser errors');assert.deepEqual(report.databaseRequests,[],'No production database requests');assert.equal(report.issues.length,0,'Motion audit issues: '+JSON.stringify(report.issues.slice(0,5)));assert.equal(report.screenshots.length,report.lessons.length,'Every final theory model is captured');
  console.log(JSON.stringify({ok:true,lessons:report.lessons.length,transitions:report.transitions.length,theoryStages:report.theory.length,immediateShrinks:report.shrinkChecks.length,reducedMotion:report.reducedMotion.length,screenshots:report.screenshots.length}));
 }finally{
  const reportFile=path.join(output,galleryOnly?'gallery.json':'motion.json');fs.writeFileSync(reportFile,JSON.stringify(report,null,2));console.log('Motion report: '+reportFile);await browser.close();
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
