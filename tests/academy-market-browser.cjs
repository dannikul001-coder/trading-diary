'use strict';
// Exercise the real academy renderer, rather than mounting isolated fixtures.
// Browser storage is an ephemeral Playwright profile; database requests fail.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.TD_NODE_MODULES||'C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1110-973-0_26.1110.973.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules','playwright'));
const url=process.argv[2]||'http://127.0.0.1:8767/academy-preview.html';
const widths=(process.env.TD_MARKET_WIDTHS||'1440,390,320').split(',').map(Number);
const layoutOnly=process.env.TD_MARKET_LAYOUT_ONLY==='1';
const report={url,widths,layoutOnly,lessons:[],testedLessons:[],stages:0,cases:0,controls:0,practice:0,tabs:0,layouts:0,issues:[],pageErrors:[],databaseRequests:[],screenshots:[]};
const reportPath=process.env.TD_MARKET_REPORT||path.join(os.tmpdir(),'td-academy-market-browser.json');
const issue=(key,width,where,message,extra={})=>{const entry={key,width,where,message,...extra};report.issues.push(entry);if(process.env.TD_MARKET_LIVE==='1')console.log('DIAGNOSTIC '+JSON.stringify(entry));};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const settle=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));

async function instrument(page){
 await page.evaluate(()=>{
  const native=window.TDTerminalChart.mount;
  window.__marketQAMounts=[];
  window.TDTerminalChart.mount=function(host,options){
   const dispose=native.call(this,host,options);
   host.__marketQAConfig=options;
   const terminal=host.querySelector('.as-terminal');
   if(terminal)terminal.__marketQAConfig=options;
   window.__marketQAMounts.push({key:document.querySelector('[data-studio-root]')?.dataset.lessonKey,role:options.chartRole,authored:options.authored,bars:options.bars?.length||0});
   return dispose;
  };
 });
}

async function snapshot(page){
 return page.evaluate(()=>{
  const root=document.querySelector('[data-studio-root]');
  const box=n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};};
  const visible=n=>n.getBoundingClientRect().width>0&&n.getBoundingClientRect().height>0&&!n.closest('[hidden]');
  const charts=[...root.querySelectorAll('.as-terminal')].filter(visible).map(n=>{
   const c=n.__marketQAConfig||n.parentNode.__marketQAConfig,svg=n.querySelector('svg'),r=svg?.getBoundingClientRect();
   const texts=svg?[...svg.querySelectorAll('.as-market-callout,.as-terminal-zone-chip,[data-tc-zones]>.as-terminal-area-label,.as-terminal-direct')].filter(n=>visible(n)&&(!n.closest('.as-market-callout')||n.matches('.as-market-callout'))):[];
   const labels=[...new Set(texts)].map(t=>({text:t.textContent,box:box(t),className:t.getAttribute('class')}));
   const outside=labels.filter(t=>t.box.x<r.x-1||t.box.y<r.y-1||t.box.x+t.box.w>r.right+1||t.box.y+t.box.h>r.bottom+1);
   const overlaps=[];
   for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){
    const a=labels[i],b=labels[j],w=Math.min(a.box.x+a.box.w,b.box.x+b.box.w)-Math.max(a.box.x,b.box.x),h=Math.min(a.box.y+a.box.h,b.box.y+b.box.h)-Math.max(a.box.y,b.box.y);
    if(w>2&&h>2)overlaps.push({labels:[a.text,b.text],boxes:[a.box,b.box]});
   }
   const visibleFrom=[...n.querySelectorAll('[data-tc-candles]>g')].findIndex(visible);
   return{role:n.dataset.chartRole,authored:n.dataset.authored,primary:!!n.closest('[data-market-primary],[data-as-indicator-price]'),bars:c?.bars||[],id:c?.id,knownPrefixLength:c?.knownPrefixLength,forming:c?.forming,chartRole:c?.chartRole,optionsAuthored:c?.authored,caption:c?.caption,narration:c?.narration,focus:c?.focus,zones:c?.zones||[],levels:c?.levels||[],markers:c?.markers||[],callouts:c?.callouts||[],segments:c?.segments||[],zoneNodes:n.querySelectorAll('.as-terminal-zone,.as-terminal-area').length,markerNodes:n.querySelectorAll('.as-terminal-mark,.as-terminal-arrow,.as-market-marker,[data-tc-marker]').length,calloutNodes:n.querySelectorAll('.as-market-callout').length,labelNodes:labels.length,outside,overlaps,visibleFrom,visibleCandles:[...n.querySelectorAll('.as-terminal-candle')].filter(visible).length,readout:n.querySelector('.as-terminal-readout')?.textContent,svgWidth:r?.width,viewBoxWidth:svg?.viewBox.baseVal.width,invalidSVG:svg?/(?:NaN|Infinity|undefined)/.test(svg.innerHTML):false};
  });
  return{charts,body:root.querySelector('[data-as-body]')?.textContent,title:root.querySelector('[data-as-title]')?.textContent,text:root.querySelector('[data-as-scene]')?.textContent,rootOverflow:root.scrollWidth>root.clientWidth+1,sceneOverflow:root.querySelector('[data-as-scene]')?.scrollWidth>root.querySelector('[data-as-scene]')?.clientWidth+1,documentOverflow:document.documentElement.scrollWidth>innerWidth+1,tab:root.dataset.lessonTab};
 });
}

function contextOf(s){return s.charts.find(c=>c.primary&&c.role==='context')||s.charts.find(c=>c.role==='context');}
function validate(s,key,width,where){
 report.layouts++;
 const contexts=s.charts.filter(c=>c.role==='context');
 if(!contexts.length)issue(key,width,where,'No authored context terminal rendered',{roles:s.charts.map(c=>[c.id,c.role,c.bars.length])});
 for(const c of s.charts){
  if(!['context','detail'].includes(c.role))issue(key,width,where,'Terminal has no explicit context/detail role',{id:c.id,role:c.role});
  if(c.authored!=='true'||c.optionsAuthored!==true)issue(key,width,where,'Terminal did not use the authored renderer',{id:c.id,authored:c.authored,option:c.optionsAuthored});
  if(c.role==='context'&&c.bars.length<60)issue(key,width,where,'Context contains fewer than 60 candles',{id:c.id,count:c.bars.length});
  if(c.invalidSVG)issue(key,width,where,'Invalid numerical SVG attribute',{id:c.id});
  if(Math.abs(c.svgWidth-c.viewBoxWidth)>2)issue(key,width,where,'SVG scales a fixed desktop viewport instead of laying out to available width',{id:c.id,css:c.svgWidth,viewBox:c.viewBoxWidth});
  if(c.outside.length)issue(key,width,where,'Annotation text falls outside SVG',{id:c.id,labels:c.outside});
  if(c.overlaps.length)issue(key,width,where,'Annotation text overlaps',{id:c.id,labels:c.overlaps});
  if(c.zones.length&&c.zoneNodes===0)issue(key,width,where,'Configured zones are absent from actual SVG',{id:c.id});
  if(c.markers.some(m=>m.index>=c.visibleFrom)&&c.markerNodes===0)issue(key,width,where,'Configured visible pins are absent from actual SVG',{id:c.id});
  if(c.callouts.some(m=>m.index>=c.visibleFrom)&&c.calloutNodes===0)issue(key,width,where,'Configured visible direct callouts are absent from actual SVG',{id:c.id});
  for(const b of c.bars)if(![b.o,b.h,b.l,b.c].every(Number.isFinite)||b.h<Math.max(b.o,b.c)||b.l>Math.min(b.o,b.c)){issue(key,width,where,'Invalid OHLC in actual renderer',{id:c.id,bar:b});break;}
 }
 if(s.rootOverflow||s.sceneOverflow||s.documentOverflow)issue(key,width,where,'Horizontal layout overflow',{root:s.rootOverflow,scene:s.sceneOverflow,document:s.documentOverflow});
 if(/\b(?:NaN|Infinity|undefined)\b/.test(s.text||''))issue(key,width,where,'Visible numerical placeholder');
 const primary=contextOf(s),body=primary?.narration?.body;
 if(body&&s.tab!=='practice'&&s.body?.replace(/\s+/g,' ').trim()!==body.replace(/\s+/g,' ').trim())issue(key,width,where,'Reader text does not match actual scene narration',{reader:s.body,scene:body});
}

async function interact(page,key,width){
 const terminal=page.locator('.as-terminal[data-chart-role="context"][data-authored="true"]').first();
 const read=()=>terminal.locator('.as-terminal-readout').textContent();
 const initial=await read(),probe=terminal.locator('[data-tc-probe]'),max=Number(await probe.getAttribute('max'));
 await probe.evaluate(n=>{n.value='10';n.dispatchEvent(new Event('input',{bubbles:true}));});
 if(!/Свеча 10\b/.test(await read()))issue(key,width,'controls','Range selection did not select candle 10');
 await terminal.locator('[data-tc-next]').click();if(!/Свеча 11\b/.test(await read()))issue(key,width,'controls','Next candle control did not move to 11');
 await terminal.locator('[data-tc-prev]').click();if(!/Свеча 10\b/.test(await read()))issue(key,width,'controls','Previous candle control did not move to 10');
 await terminal.locator('svg').press('End');if(!new RegExp('Свеча '+max+'\\b').test(await read()))issue(key,width,'controls','End key did not select last candle');
 await terminal.locator('svg').press('Home');if(!/Свеча 1\b/.test(await read()))issue(key,width,'controls','Home key did not select first candle');
 const before=await terminal.locator('.as-terminal-candle').evaluateAll(ns=>ns.filter(n=>n.getBoundingClientRect().width>0).length);
 const zoom=terminal.locator('[data-tc-in]');
 if(await zoom.isEnabled()){
  await zoom.click();const after=await terminal.locator('.as-terminal-candle').evaluateAll(ns=>ns.filter(n=>n.getBoundingClientRect().width>0).length);
  if(after>=before&&before>6)issue(key,width,'controls','Zoom did not reduce visible candle count',{before,after});
 }
 await terminal.locator('[data-tc-all]').click();
 const allPins=await terminal.evaluate(n=>({expected:n.__marketQAConfig.markers?.length||0,actual:n.querySelectorAll('.as-terminal-mark,.as-terminal-arrow,.as-market-marker,[data-tc-marker]').length}));
 if(allPins.expected&&allPins.actual===0)issue(key,width,'controls','Full-history view does not display configured pins');
 const annotation=terminal.locator('[data-tc-annotations]');
 if(await annotation.isEnabled()){
  await annotation.click();if(await annotation.getAttribute('aria-pressed')!=='false')issue(key,width,'controls','Annotation toggle did not turn off');
  await annotation.click();if(await annotation.getAttribute('aria-pressed')!=='true')issue(key,width,'controls','Annotation toggle did not turn on');
 }
 const svg=terminal.locator('svg'),bounds=await svg.boundingBox();
 await svg.click({position:{x:Math.max(15,bounds.width*.4),y:bounds.height*.55}});
 if(await read()===initial&&max>60)issue(key,width,'controls','Pointer selection appears inert');
 report.controls++;
}

async function runLesson(page,key,width){
 await page.evaluate(async key=>{localStorage.removeItem(courseV1ProgressKey());await openTrainingLesson(TRADING_COURSE_V1.lessons.find(l=>l.key===key).id);},key);
 await page.locator('[data-as-tab="theory"]').click();await page.locator('[data-as-replay]').click();await settle(page);
 const steps=await page.locator('[data-as-step]').count();
 let previous,initialBars;
 for(let step=0;step<steps;step++){
  if(step){await page.locator('[data-as-step="'+step+'"]').click();await settle(page);}
  const s=await snapshot(page);validate(s,key,width,'theory '+step);report.stages++;
  const primary=contextOf(s);
  if(step===0)initialBars=primary?.bars;
  if(previous&&primary){const count=Math.min(previous.bars.length,primary.bars.length);for(let i=0;i<count;i++)if(!(key==='1.1'&&i===64)&&!equal(previous.bars[i],primary.bars[i])){issue(key,width,'theory '+step,'A previously visible source candle changed',{index:i,prior:previous.bars[i],next:primary.bars[i]});break;}}
  previous=primary;
 }
 if(!layoutOnly)await interact(page,key,width);await page.locator('[data-as-replay]').click();await settle(page);
 const replay=await snapshot(page);if(!equal(contextOf(replay)?.bars,initialBars))issue(key,width,'replay','Reset did not restore the first authored stage');
 await page.locator('[data-as-tab="examples"]').click();await settle(page);
 const caseDefinitions=await page.evaluate(key=>TD_STUDIO_LESSONS[key].examples,key);
 const cases=await page.locator('[data-as-example]').evaluateAll(ns=>ns.map(n=>n.dataset.asExample));
 if(cases.length<3)issue(key,width,'examples','Fewer than 3 authored situations',{cases});
 const results={};
 for(const id of cases){
  await page.locator('[data-as-example="'+id+'"]').click();await settle(page);
  const s=await snapshot(page);validate(s,key,width,'case '+id);results[id]=contextOf(s);report.cases++;
 }
 if(results.base&&results.contrast){
  if(equal(results.base.bars,results.contrast.bars))issue(key,width,'examples','Base and contrast contexts are identical');
  const cut=Math.min(results.base.knownPrefixLength??Infinity,results.base.bars.length,results.contrast.bars.length),formingIndex=key==='1.1'?64:-1;
  for(let i=0;i<cut;i++)if(i!==formingIndex&&!equal(results.base.bars[i],results.contrast.bars[i])){issue(key,width,'examples','Alternative outcome rewrites known source prefix',{cut,index:i});break;}
 }
 const checkpoint=caseDefinitions.find(c=>c.id==='checkpoint');
 if(results.checkpoint&&Number.isInteger(checkpoint?.stop)&&results.checkpoint.bars.length>checkpoint.stop)issue(key,width,'examples','Checkpoint reveals continuation',{known:checkpoint.stop,actual:results.checkpoint.bars.length});
 await page.locator('[data-as-tab="practice"]').click();await settle(page);
 const hidden=await snapshot(page);validate(hidden,key,width,'practice hidden');
 if(results.checkpoint&&equal(contextOf(hidden)?.bars,results.checkpoint.bars))issue(key,width,'practice','Practice reuses the worked example source bars');
 await page.locator('[data-as-reveal]').click();if(!/Выбери ответ/.test(await page.locator('[data-as-practice-result]').textContent()))issue(key,width,'practice','Future can reveal without an answer');
 const answers=await page.evaluate(key=>{const choices=TD_STUDIO_LESSONS[key].practice.choices;return{right:choices.findIndex(c=>c.correct),wrong:choices.findIndex(c=>!c.correct)};},key);
 await page.locator('input[name="as-practice"][value="'+answers.wrong+'"]').check();await page.locator('[data-as-reveal]').click();await settle(page);
 if(!/^Пока неверно\./.test(await page.locator('[data-as-practice-result]').textContent()))issue(key,width,'practice','Wrong answer has no feedback');
 await page.locator('[data-as-retry]').click();await settle(page);
 const reset=await snapshot(page);if(!equal(contextOf(hidden)?.bars,contextOf(reset)?.bars))issue(key,width,'practice reset','Retry did not restore exactly the hidden practice prefix');
 if(await page.locator('input[name="as-practice"]:checked').count())issue(key,width,'practice reset','Retry kept an old answer checked');
 await page.locator('input[name="as-practice"][value="'+answers.right+'"]').check();await page.locator('[data-as-reveal]').click();await settle(page);
 const revealed=await snapshot(page);validate(revealed,key,width,'practice revealed');
 if(!/^Верно\./.test(await page.locator('[data-as-practice-result]').textContent()))issue(key,width,'practice','Correct answer has no success feedback');
 const before=contextOf(hidden)?.bars,after=contextOf(revealed)?.bars;
 if(!before||!after||after.length<=before.length||!equal(before,after.slice(0,before.length)))issue(key,width,'practice','Reveal changes source prefix or does not append continuation');
 const alt=page.locator('[data-as-alternate]');if(await alt.isVisible()){await alt.click();await settle(page);const s=await snapshot(page);validate(s,key,width,'practice contrast');if(!equal(before,contextOf(s)?.bars.slice(0,before.length)))issue(key,width,'practice contrast','Alternative practice outcome rewrites hidden history');}
 report.practice++;
 if(layoutOnly){await page.locator('.modal-close').click();return;}
 await page.locator('[data-as-tab="notes"]').click();
 const notes=page.locator('[data-as-notes]');await notes.fill('Проверка учебного конспекта '+key+' · '+width);await page.locator('[data-as-save]').click();await page.waitForFunction(()=>document.querySelector('[data-as-save-status]')?.textContent.includes('Конспект сохранён'));
 for(const tab of ['theory','examples','practice','notes']){await page.locator('[data-as-tab="'+tab+'"]').click();if(await page.locator('[data-as-tab="'+tab+'"]').getAttribute('aria-selected')!=='true')issue(key,width,'tabs','Tab selection failed',{tab});report.tabs++;}
 if(await notes.inputValue()!=='Проверка учебного конспекта '+key+' · '+width)issue(key,width,'notes','Tab switch lost notes');
 await page.locator('.modal-close').click();
}

(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.TD_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:{width:widths[0],height:1000},reducedMotion:'reduce'});
  page.setDefaultTimeout(12000);page.on('pageerror',e=>report.pageErrors.push(e.message));
  await page.route(/https?:\/\/[^/]*supabase\.(?:co|in)\//,route=>{report.databaseRequests.push(route.request().url());return route.abort();});
  await page.goto(url);await page.waitForFunction(()=>window.TD_STUDIO_LESSONS&&window.TDTerminalChart);
  await instrument(page);
  report.lessons=await page.evaluate(()=>Object.entries(TD_STUDIO_LESSONS).filter(([,e])=>e.marketAuthored===true).map(([key])=>key));
  const selected=process.env.TD_MARKET_LESSONS==='price'?await page.evaluate(()=>Object.keys(TD_MARKET_SCENES)):process.env.TD_MARKET_LESSONS?.split(',').filter(Boolean);
  if(!selected)assert.equal(report.lessons.length,55,'All 55 market lessons must use the rich runtime');
  const keys=selected||report.lessons;
  report.testedLessons=keys;
  for(const width of widths){
   await page.setViewportSize({width,height:1000});
   for(let i=0;i<keys.length;i++){
    const key=keys[i],prior=report.issues.length;
    try{await runLesson(page,key,width);}catch(error){issue(key,width,'runtime',error.message);await page.evaluate(()=>window.closeModal?.()).catch(()=>{});}
    if(report.issues.length>prior&&process.env.TD_STUDIO_SCREENSHOTS){const file=path.join(process.env.TD_STUDIO_SCREENSHOTS,`market-${key}-${width}.png`);fs.mkdirSync(path.dirname(file),{recursive:true});await page.screenshot({path:file,fullPage:false});report.screenshots.push(file);}
    if((i+1)%10===0||i===keys.length-1){fs.mkdirSync(path.dirname(reportPath),{recursive:true});fs.writeFileSync(reportPath,JSON.stringify(report,null,2));console.log(JSON.stringify({width,checked:i+1,total:keys.length,issues:report.issues.length}));}
   }
  }
  assert.deepEqual(report.pageErrors,[],'Browser errors');assert.deepEqual(report.databaseRequests,[],'Academy preview must not contact production database');
  assert.equal(report.issues.length,0,'Market browser audit found '+report.issues.length+' issues; first: '+JSON.stringify(report.issues.slice(0,8)));
  console.log('PASS: '+keys.length+' real market lessons at '+widths.join('/')+'px; '+report.stages+' stages, '+report.cases+' authored cases, '+report.practice+' independent practices, '+report.controls+' control groups, '+report.tabs+' tab switches.');
 }finally{fs.mkdirSync(path.dirname(reportPath),{recursive:true});fs.writeFileSync(reportPath,JSON.stringify(report,null,2));console.log('Browser report: '+reportPath);await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
