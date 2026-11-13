'use strict';
// Real browser verification of the reference article, historical candle area,
// reserved annotation gutter and actual source-data controls. Isolated storage.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.TD_NODE_MODULES||'C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1110-973-0_26.1110.973.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules','playwright'));
const url=process.argv[2]||'http://127.0.0.1:8767/academy-preview.html';
const output=process.env.TD_REFERENCE_OUTPUT||path.resolve(__dirname,'../../../outputs/academy-reference-rebuild');
const focusKeys=(process.env.TD_REFERENCE_KEYS||'1.2,2.1,12.1,12.2,12.3,12.4,11.4,13.8').split(',');
const widths=(process.env.TD_REFERENCE_WIDTHS||'1540,390,320').split(',').map(Number),themes=(process.env.TD_REFERENCE_THEMES||'midnight,paper').split(',');
const report={url,focusKeys,widths,themes,timeZone:'UTC',layouts:[],controls:[],branches:[],practice:[],fractional:[],screenshots:[],issues:[],pageErrors:[],databaseRequests:[]};
const issue=(key,width,theme,where,message,detail={})=>{const item={key,width,theme,where,message,...detail};report.issues.push(item);console.log(JSON.stringify({issue:item}));};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b),settle=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));

async function instrument(page){
 await page.evaluate(()=>{
  const mount=TDTerminalChart.mount,render=TDChartAnnotations.render;
  TDTerminalChart.mount=function(host,options){const cleanup=mount.call(this,host,options),terminal=host.querySelector('.as-terminal');if(terminal)terminal.__referenceConfig=options;return cleanup;};
  TDChartAnnotations.render=function(svg,options,layout){const result=render.call(this,svg,options,layout);svg.__referenceOptions=options;svg.__referenceLayout={...layout};return result;};
  window.__referenceInspect=()=>{
   const root=document.querySelector('[data-studio-root]')||document.body,visible=node=>!!node&&node.getBoundingClientRect().width>0&&!node.closest('[hidden]');
   const box=node=>{const r=node.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
   const story=root.querySelector('[data-market-reference="true"] .as-story')||root.matches('[data-market-reference="true"]')&&root.querySelector('.as-story')||document.querySelector('[data-market-reference="true"] .as-story');
   const terminals=[...root.querySelectorAll('.as-terminal')].filter(visible).map(node=>{
    const svg=node.querySelector('svg'),config=svg.__referenceOptions||node.__referenceConfig||{},layout=svg.__referenceLayout||{},r=svg.getBoundingClientRect(),scaleX=r.width/(svg.viewBox.baseVal.width||r.width),scaleY=r.height/(svg.viewBox.baseVal.height||r.height);
    const b=node=>{const q=node.getBoundingClientRect();return{x:(q.x-r.x)/scaleX,y:(q.y-r.y)/scaleY,w:q.width/scaleX,h:q.height/scaleY,right:(q.right-r.x)/scaleX,bottom:(q.bottom-r.y)/scaleY};};
    const describe=node=>{const rect=node.matches('rect')?node:node.querySelector('rect'),text=node.matches('text')?node:node.querySelector('text');return{text:(text?.textContent||node.textContent).trim(),box:b(rect||text||node),textBox:text?b(text):null,className:node.getAttribute('class'),price:node.getAttribute('data-price'),fill:getComputedStyle(rect||node).fill};};
    const candles=[...svg.querySelectorAll('.as-terminal-candle')].filter(n=>n.style.display!=='none').map(n=>({box:b(n),rect:b(n.querySelector('rect'))}));
    const chips=[...svg.querySelectorAll('.as-ref-chip')].filter(visible).map(describe),tags=[...svg.querySelectorAll('.as-ref-price-tag')].filter(visible).map(describe),markers=[...svg.querySelectorAll('.as-terminal-mark,.as-market-point')].filter(visible).map(n=>({box:b(n)}));
    const zones=[...svg.querySelectorAll('.as-terminal-area,.as-ref-zone')].filter(visible).map(n=>({box:b(n),rect:n.querySelector('rect')?b(n.querySelector('rect')):null,role:n.getAttribute('data-role')||n.dataset.annotationRole||n.getAttribute('class')}));
    const clip=svg.querySelector('[data-tc-clip]'),grid=[...svg.querySelectorAll('.as-terminal-time-tick')].map(n=>({text:n.textContent.trim(),x:Number(n.getAttribute('x')),y:Number(n.getAttribute('y')),index:Number(n.getAttribute('data-time-index'))})),selected=Number(node.querySelector('[data-tc-probe]')?.value)-1;
    return{reference:node.dataset.reference,authored:node.dataset.authored,role:node.dataset.chartRole,id:config.id,mode:config.mode,caption:config.caption,intervalLabel:config.intervalLabel,timeframeMinutes:config.timeframeMinutes,startTime:config.startTime,symbol:config.symbol,market:config.market,bars:config.bars||[],series:config.series||[],zonesConfig:config.zones||[],levelsConfig:config.levels||[],selected,readout:node.querySelector('.as-terminal-readout')?.textContent,readoutNumbers:[...node.querySelectorAll('.as-terminal-readout b')].map(n=>n.textContent),knownPrefixLength:config.knownPrefixLength,probeMax:Number(node.querySelector('[data-tc-probe]')?.max),layout:{left:layout.left,right:layout.right,top:layout.top,bottom:layout.bottom,dataRight:layout.dataRight,annotationLeft:layout.annotationLeft,start:layout.start,end:layout.end,dx:layout.dx,firstX:layout.x?.(layout.start),lastX:layout.x?.(layout.end)},svg:{w:r.width,h:r.height,viewW:svg.viewBox.baseVal.width,viewH:svg.viewBox.baseVal.height},clip:clip?{x:Number(clip.getAttribute('x')),width:Number(clip.getAttribute('width'))}:null,candles,chips,tags,markers,zones,grid,invalid:/NaN|Infinity|undefined/.test(svg.innerHTML),header:node.querySelector('.as-terminal-head')?.textContent};
   });
   return{terminals,story:story?{box:box(story),visual:story.querySelector('.as-visual')?box(story.querySelector('.as-visual')):null,reader:box(story.querySelector(root.dataset.lessonTab==='practice'?'.as-practice':'.as-reader')),areas:getComputedStyle(story).gridTemplateAreas,sticky:getComputedStyle(story.querySelector(root.dataset.lessonTab==='practice'?'.as-practice':'.as-reader')).position,display:getComputedStyle(story).display,columns:getComputedStyle(story).gridTemplateColumns}:null,overflow:document.documentElement.scrollWidth>innerWidth+1||root.scrollWidth>root.clientWidth+1,tab:root.dataset.lessonTab};
  };
 });
}

const inspect=page=>page.evaluate(()=>window.__referenceInspect());
const primary=state=>state.terminals.find(t=>t.role==='context')||state.terminals[0];
const overlap=(a,b)=>Math.min(a.right,b.right)-Math.max(a.x,b.x)>.75&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>.75;
const parse=value=>Number(String(value).replace(/[\s\u00a0\u202f]/g,'').replace('−','-').replace(',','.'));

function validate(state,key,width,theme,where,{article=true}={}){
 const records=[];
 if(state.overflow)issue(key,width,theme,where,'Horizontal page/article overflow');
 if(article){
  const story=state.story;
  if(!story?.reader||!story?.visual)issue(key,width,theme,where,'Missing paired explanation or visual');
  else if(width>740){
   if(story.reader.x<story.visual.right-1||story.reader.y>=story.visual.bottom||story.reader.w<250)issue(key,width,theme,where,'Text and chart do not share a readable row',story);
  }else if(story.areas!=='"reader" "visual"'||story.sticky!=='sticky'||story.reader.h>236)issue(key,width,theme,where,'Mobile reading pane is detached from the chart',story);
 }

 const contexts=state.terminals.filter(t=>t.role==='context');if(!contexts.length)issue(key,width,theme,where,'No authored context chart');
 for(const chart of contexts){
  const l=chart.layout,detail={id:chart.id};
  if(chart.reference!=='true')issue(key,width,theme,where,'Authored context has no reference=true surface',detail);
  if(Math.abs(chart.svg.w-chart.svg.viewW)>2)issue(key,width,theme,where,'Chart stretches a fixed desktop viewBox instead of laying out to its real width',{...detail,svg:chart.svg});
  if(article&&state.story?.visual&&chart.svg.w<state.story.visual.w-50)issue(key,width,theme,where,'The actual chart remains narrower than its full-width article visual',{...detail,svg:chart.svg,visual:state.story.visual});
  if(chart.invalid)issue(key,width,theme,where,'Invalid numerical SVG attribute',detail);
  if(chart.bars.length<60)issue(key,width,theme,where,'Fewer than60 source candles',detail);
  if(![l.left,l.right,l.dataRight,l.annotationLeft,l.start,l.end].every(Number.isFinite)){issue(key,width,theme,where,'Historical/gutter layout metadata missing',{...detail,layout:l});continue;}
  if(!(l.left<l.dataRight&&l.dataRight<=l.annotationLeft&&l.annotationLeft<l.right))issue(key,width,theme,where,'Historical and annotation regions are not separated',{...detail,layout:l});
  const ratio=(l.right-l.annotationLeft)/(l.right-l.left);if(ratio<.02||ratio>.6)issue(key,width,theme,where,'Adaptive annotation gutter has no usable clear space',{...detail,ratio});
  if(!chart.clip||chart.clip.x+chart.clip.width>l.dataRight+1)issue(key,width,theme,where,'Historical candle clip extends into the annotation gutter',{...detail,clip:chart.clip,layout:l});
  if(chart.candles.some(c=>c.rect.right>l.dataRight+1))issue(key,width,theme,where,'A historical candle body enters the reserved annotation gutter',detail);
  if(chart.probeMax!==chart.bars.length||l.end>chart.bars.length-1)issue(key,width,theme,where,'A fabricated future candle is selectable',{...detail,end:l.end,max:chart.probeMax,bars:chart.bars.length});
  for(const chip of chart.chips){
   if(chip.box.x<l.dataRight-1||chip.box.right>l.right+1||chip.box.y<0||chip.box.bottom>chart.svg.viewH+1)issue(key,width,theme,where,'Short semantic label lies outside the annotation gutter',{...detail,chip,layout:l});
   if(chip.text.length>75||chip.text.split(/\s+/).length>9)issue(key,width,theme,where,'A reference chip contains a paragraph instead of a short semantic label',{...detail,chip});
   if(chip.textBox&&(chip.textBox.x<chip.box.x-1||chip.textBox.right>chip.box.right+1||chip.textBox.y<chip.box.y-1||chip.textBox.bottom>chip.box.bottom+1))issue(key,width,theme,where,'A short reference label overflows its chip background',{...detail,chip});
   if(chart.markers.some(m=>overlap(chip.box,m.box))||chart.candles.some(c=>overlap(chip.box,c.rect)))issue(key,width,theme,where,'A short label covers a marker or candle body',{...detail,chip});
  }
  for(let i=0;i<chart.chips.length;i++)for(let j=i+1;j<chart.chips.length;j++)if(overlap(chart.chips[i].box,chart.chips[j].box))issue(key,width,theme,where,'Reference chip labels overlap',{...detail,a:chart.chips[i],b:chart.chips[j]});
  for(const tag of chart.tags){if(tag.box.x<l.right-.5)issue(key,width,theme,where,'Semantic price tag is inside the plot instead of its right axis',{...detail,tag,layout:l});if(!tag.text||['none','transparent','rgba(0, 0, 0, 0)'].includes(tag.fill))issue(key,width,theme,where,'Semantic price tag is empty or has no visible semantic color',{...detail,tag});}
  const semantic=chart.zonesConfig.some(z=>z.role===undefined?['support','resistance'].includes(z.kind):/^(ob|fvg|liquidity|support|resistance)$/.test(z.role));
  if(semantic&&!chart.zones.some(z=>z.rect&&z.rect.right>=l.annotationLeft+.5))issue(key,width,theme,where,'A semantic price area is not projected into the annotation gutter',{...detail,zones:chart.zones});
  if((semantic||chart.levelsConfig.length)&&!chart.chips.length)issue(key,width,theme,where,'Semantic regions or levels have no short reference label',detail);
  if(semantic&&!chart.tags.length)issue(key,width,theme,where,'Semantic regions have no colored right-axis price tag',detail);
  const minuteFromLabel=String(chart.intervalLabel||'').match(/(\d+)\s*мин/),minutes=chart.timeframeMinutes||(minuteFromLabel?Number(minuteFromLabel[1]):null),bottom=chart.grid;
  if(minutes&&chart.startTime&&bottom.length<2)issue(key,width,theme,where,'Known source timestamps are absent from the time axis',detail);
  if(chart.timeframeMinutes&&minuteFromLabel&&Number(minuteFromLabel[1])!==chart.timeframeMinutes)issue(key,width,theme,where,'Timeframe metadata contradicts its actual source interval',detail);
  if(minutes&&chart.startTime){const start=Date.parse(chart.startTime);for(const tick of bottom){if(!/^\d\d:\d\d$/.test(tick.text))issue(key,width,theme,where,'Known timestamps are replaced by candle numbers',{...detail,tick});else if(Number.isFinite(start)&&Number.isFinite(tick.index)){const index=tick.index,date=new Date(start+index*minutes*60000),expected=date.toISOString().slice(11,16);if(tick.text!==expected)issue(key,width,theme,where,'Timestamp does not match its source candle interval',{...detail,tick,index,expected});}}}
  if(!chart.symbol&&!chart.market&&/AUD\/?CAD/i.test(chart.header||''))issue(key,width,theme,where,'An instrument name was invented for synthetic source data',detail);
  const expected=chart.mode==='indicator'?chart.series.map(s=>s.values[chart.selected]):chart.bars[chart.selected]?['o','h','l','c'].map(field=>chart.bars[chart.selected][field]):[];
  if(chart.readoutNumbers.length<expected.length)issue(key,width,theme,where,'Selected source values are missing from the readout',{...detail,expected:expected.length,shown:chart.readoutNumbers});
  for(let i=0;i<Math.min(expected.length,chart.readoutNumbers.length);i++)if(Number.isFinite(expected[i])&&(!Number.isFinite(parse(chart.readoutNumbers[i]))||Math.abs(parse(chart.readoutNumbers[i])-expected[i])>.005001))issue(key,width,theme,where,'Readout no longer reports the selected actual source value',{...detail,expected:expected[i],actual:chart.readoutNumbers[i],index:i});
  records.push({id:chart.id,count:chart.bars.length,chips:chart.chips.length,tags:chart.tags.length,timeTicks:bottom.map(t=>t.text),layout:l});
 }
 report.layouts.push({key,width,theme,where,charts:records});
}

async function open(page,key){await page.evaluate(key=>openTrainingLesson(TRADING_COURSE_V1.lessons.find(l=>l.key===key).id),key);await page.locator('[data-as-tab="theory"]').click();await page.locator('[data-as-replay]').click();await page.locator('[data-as-step]').last().click();await settle(page);}
async function capture(page,key,width,theme){await page.setViewportSize({width,height:5000});await settle(page);const model=page.locator('[data-as-model]'),height=await model.evaluate(n=>n.scrollHeight);if(height>4300){await page.setViewportSize({width,height:Math.ceil(height+900)});await settle(page);}await model.scrollIntoViewIfNeeded();const file=path.join(output,'screenshots',key+'-'+width+'-'+theme+'.png');await model.screenshot({path:file,animations:'disabled'});report.screenshots.push({key,width,theme,file});await page.setViewportSize({width,height:1100});await settle(page);}

async function controls(page,key,width,theme){
 const terminal=page.locator('.as-terminal[data-chart-role="context"]').first(),before=primary(await inspect(page)),probe=terminal.locator('[data-tc-probe]');
 await probe.evaluate(n=>{n.value='10';n.dispatchEvent(new Event('input',{bubbles:true}));});await settle(page);const chosen=primary(await inspect(page));if(chosen.selected!==9)issue(key,width,theme,'controls','Candle probe did not select actual candle10');
 await terminal.locator('[data-tc-next]').click();if(primary(await inspect(page)).selected!==10)issue(key,width,theme,'controls','Next candle failed');await terminal.locator('[data-tc-prev]').click();
 const zoom=terminal.locator('[data-tc-in]');if(await zoom.isEnabled()){await zoom.click();await settle(page);if(primary(await inspect(page)).candles.length>=chosen.candles.length)issue(key,width,theme,'controls','Zoom-in did not change visible historical candle count');}
 await terminal.locator('[data-tc-all]').click();await terminal.locator('svg').press('End');await settle(page);const end=primary(await inspect(page));if(end.selected!==end.bars.length-1)issue(key,width,theme,'controls','End key did not select the last actual candle');
 const toggle=terminal.locator('[data-tc-annotations]');if(await toggle.isEnabled()){await toggle.click();await settle(page);const off=primary(await inspect(page));if(off.chips.length)issue(key,width,theme,'controls','Annotation toggle leaves reference chips visible');await toggle.click();}
 const after=primary(await inspect(page));if(!equal(before.bars,after.bars))issue(key,width,theme,'controls','Navigation rewrites source OHLC');report.controls.push({key,width,theme,count:before.bars.length});
}

async function branchesAndPractice(page,key,width,theme){
 await page.locator('[data-as-tab="examples"]').click();await page.locator('[data-as-example="base"]').click();await settle(page);const base=await inspect(page);validate(base,key,width,theme,'example base');
 await page.locator('[data-as-example="contrast"]').click();await settle(page);const contrast=await inspect(page);validate(contrast,key,width,theme,'example contrast');const a=primary(base),b=primary(contrast),known=Math.min(a.knownPrefixLength||0,a.bars.length,b.bars.length);if(!equal(a.bars.slice(0,known),b.bars.slice(0,known)))issue(key,width,theme,'examples','Alternative outcome rewrites known source candles');report.branches.push({key,width,theme,base:a.bars.length,contrast:b.bars.length,known});
 await page.locator('[data-as-tab="practice"]').click();await settle(page);const hidden=await inspect(page);validate(hidden,key,width,theme,'practice hidden');const h=primary(hidden);if(h.probeMax!==h.bars.length)issue(key,width,theme,'practice','Hidden future remains selectable');
 await page.locator('[data-as-reveal]').click();if(!/Выбери ответ/.test(await page.locator('[data-as-practice-result]').textContent()))issue(key,width,theme,'practice','Reveal requires no independent answer');
 const right=await page.evaluate(key=>TD_STUDIO_LESSONS[key].practice.choices.findIndex(c=>c.correct),key);await page.locator('input[name="as-practice"][value="'+right+'"]').check();await page.locator('[data-as-reveal]').click();await settle(page);const revealed=await inspect(page);validate(revealed,key,width,theme,'practice revealed');const r=primary(revealed);if(!equal(h.bars,r.bars.slice(0,h.bars.length)))issue(key,width,theme,'practice','Revealing future changes the hidden prefix');
 await page.locator('[data-as-retry]').click();await settle(page);if(!equal(primary(await inspect(page)).bars,h.bars))issue(key,width,theme,'practice','Retry does not restore exactly the independent hidden source');report.practice.push({key,width,theme,hidden:h.bars.length,revealed:r.bars.length});
}

async function fractional(page,width,theme){
 await page.evaluate(()=>{
  document.querySelector('#referenceFractional')?.remove();const container=document.createElement('div');container.id='referenceFractional';container.className='academy-studio as-reference-course';container.style.cssText='width:100%;max-width:100%;padding:0';container.innerHTML='<div data-studio-root><div class="as-scene" data-as-scene></div></div>';document.body.prepend(container);const host=container.querySelector('[data-as-scene]');
  const bars=Array.from({length:64},(_,i)=>{const o=1.081+Math.sin(i*.42)*.0006,c=1.081+Math.sin((i+1)*.42)*.0006;return{o,h:Math.max(o,c)+.0002,l:Math.min(o,c)-.00017,c};});
  window.__fractionalCleanup=TDTerminalChart.mount(host,{id:'fractional',authored:true,chartRole:'context',reference:true,bars,caption:'Дробные цены · синтетическая история',timeframeMinutes:5,startTime:'2026-01-12T09:00:00Z',intervalLabel:'5 минут · синтетические OHLC',knownPrefixLength:64,defaultLimit:64,mobileLimit:40,zones:[{from:20,to:63,low:1.08125,high:1.08155,kind:'support',role:'ob',label:'Order Block'}],levels:[{from:20,to:63,price:1.0807,role:'invalidation',label:'Отмена'}],markers:[{index:52,price:bars[52].c,label:'Исходное Close'}]});
 });await settle(page);const state=await inspect(page);validate(state,'fractional',width,theme,'fractional',{article:false});const chart=primary(state),expected=['o','h','l','c'].map(k=>chart.bars[chart.selected][k]);if(chart.readoutNumbers.length<4||expected.some((v,i)=>!Number.isFinite(parse(chart.readoutNumbers[i]))||Math.abs(v-parse(chart.readoutNumbers[i]))>.000011))issue('fractional',width,theme,'fractional','Decimal formatting erases the actual source price differences',{expected,shown:chart.readoutNumbers});
 report.fractional.push({width,theme,shown:chart.readoutNumbers,tags:chart.tags.map(t=>t.text),ticks:chart.grid.map(t=>t.text)});const file=path.join(output,'screenshots','fractional-'+width+'-'+theme+'.png');await page.locator('#referenceFractional').screenshot({path:file,animations:'disabled'});report.screenshots.push({key:'fractional',width,theme,file});await page.evaluate(()=>{window.__fractionalCleanup?.();document.querySelector('#referenceFractional')?.remove();});
}

(async()=>{
 fs.mkdirSync(path.join(output,'screenshots'),{recursive:true});const browser=await chromium.launch({headless:true,executablePath:process.env.TD_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:{width:widths[0],height:1100},reducedMotion:'reduce',timezoneId:'UTC'});page.setDefaultTimeout(12000);page.on('pageerror',e=>report.pageErrors.push(e.message));await page.route(/https?:\/\/[^/]*supabase\.(?:co|in)\//,route=>{report.databaseRequests.push(route.request().url());return route.abort();});
  await page.goto(url);await page.waitForFunction(()=>window.TDTerminalChart&&window.TDChartAnnotations&&window.TD_STUDIO_LESSONS);await instrument(page);
  for(const theme of themes)for(const width of widths){await page.setViewportSize({width,height:1100});await page.evaluate(theme=>{document.querySelector('#academyPreviewTheme').value=theme;document.querySelector('#academyPreviewTheme').dispatchEvent(new Event('change',{bubbles:true}));},theme);
   for(const key of focusKeys){try{await open(page,key);validate(await inspect(page),key,width,theme,'final theory');await capture(page,key,width,theme);await controls(page,key,width,theme);await branchesAndPractice(page,key,width,theme);}catch(error){issue(key,width,theme,'runtime',error.stack||error.message);}await page.evaluate(()=>window.closeModal?.());}
   try{await fractional(page,width,theme);}catch(error){issue('fractional',width,theme,'runtime',error.stack||error.message);await page.evaluate(()=>{window.__fractionalCleanup?.();document.querySelector('#referenceFractional')?.remove();});}
   console.log(JSON.stringify({theme,width,focused:focusKeys.length,issues:report.issues.length}));
  }
  if(process.env.TD_REFERENCE_SKIP_ALL!=='1'){
   await page.evaluate(()=>{document.querySelector('#academyPreviewTheme').value='midnight';document.querySelector('#academyPreviewTheme').dispatchEvent(new Event('change',{bubbles:true}));});const keys=await page.evaluate(()=>Object.entries(TD_STUDIO_LESSONS).filter(([,e])=>e.marketAuthored===true).map(([key])=>key));assert.equal(keys.length,55);
   for(const width of widths){await page.setViewportSize({width,height:1100});for(const key of keys){try{await open(page,key);validate(await inspect(page),key,width,'midnight','all55 quick');}catch(error){issue(key,width,'midnight','quick runtime',error.stack||error.message);}await page.evaluate(()=>window.closeModal?.());}console.log(JSON.stringify({quickWidth:width,lessons:keys.length,issues:report.issues.length}));}
  }
  assert.deepEqual(report.pageErrors,[],'Browser errors');assert.deepEqual(report.databaseRequests,[],'No production database requests');assert.equal(report.issues.length,0,'Reference chart audit found '+report.issues.length+' issues');console.log(JSON.stringify({ok:true,layouts:report.layouts.length,controls:report.controls.length,branches:report.branches.length,practices:report.practice.length,fractional:report.fractional.length,screenshots:report.screenshots.length}));
 }finally{fs.writeFileSync(path.join(output,'reference.json'),JSON.stringify(report,null,2));console.log('Reference report: '+path.join(output,'reference.json'));await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
