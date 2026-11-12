'use strict';
// Geometry and interaction audit of the real academy. An ephemeral browser
// profile and blocked database requests isolate every synthetic interaction.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.TD_NODE_MODULES||'C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1110-973-0_26.1110.973.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules','playwright'));
const url=process.argv[2]||'http://127.0.0.1:8767/academy-preview.html';
const widths=(process.env.TD_ANNOTATION_WIDTHS||'1440,390,320').split(',').map(Number);
const output=process.env.TD_ANNOTATION_OUTPUT||'C:/Users/danni/Documents/Codex/2026-11-04/referenced-chatgpt-conversation-this-is-an/outputs/academy-unobscured-annotations';
const reportFile=path.join(output,process.env.TD_ANNOTATION_REPORT||'visibility.json');
const report={url,widths,testedLessons:[],snapshots:0,charts:0,labels:0,zoneChecks:0,pointChecks:0,buttonTargets:0,persistentSelections:0,annotationToggles:0,issues:[],runtimeErrors:[],databaseRequests:[],screenshots:[]};
const save=()=>{fs.mkdirSync(output,{recursive:true});fs.writeFileSync(reportFile,JSON.stringify(report,null,2));};

async function install(page){
 await page.evaluate(()=>{
  const original=TDTerminalChart.mount;
  TDTerminalChart.mount=function(host,options){const result=original.call(this,host,options);const chart=host.querySelector('.as-terminal');if(chart)chart.__visibilityOptions=options;return result;};
  const render=TDChartAnnotations.render;
  TDChartAnnotations.render=function(svg,options,layout){const result=render.call(this,svg,options,layout);svg.__visibilityOptions=options;svg.__visibilityLayout=layout;return result;};
  const frame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const rect=n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
  const visible=n=>!!n&&n.getBoundingClientRect().width>0&&n.getBoundingClientRect().height>0&&!n.closest('[hidden]')&&getComputedStyle(n).visibility!=='hidden';
  const intersects=(a,b)=>Math.min(a.right,b.right)-Math.max(a.x,b.x)>.5&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>.5;
  function plotRect(svg){
   const clip=svg.querySelector('[data-tc-clip]'),m=svg.getScreenCTM();if(!clip||!m)return null;
   const x=Number(clip.getAttribute('x')),y=Number(clip.getAttribute('y')),w=Number(clip.getAttribute('width')),h=Number(clip.getAttribute('height'));
   const a=new DOMPoint(x,y).matrixTransform(m),b=new DOMPoint(x+w,y+h).matrixTransform(m);
   return{x:a.x,y:a.y,width:b.x-a.x,height:b.y-a.y,right:b.x,bottom:b.y};
  }
  function snapshot(where,result){
   result.snapshots++;
   const root=document.querySelector('[data-studio-root]');
   const add=(message,extra={})=>result.issues.push({where,message,...extra});
   if(!root){add('Lesson root is missing');return;}
   if(root.scrollWidth>root.clientWidth+1||document.documentElement.scrollWidth>innerWidth+1)add('Horizontal overflow');
   const scene=root.querySelector('[data-as-scene]');
   if(/\b(?:NaN|Infinity|undefined)\b/.test(scene.textContent))add('Invalid visible numerical placeholder');
   for(const chart of root.querySelectorAll('.as-terminal[data-authored="true"]')){
    if(!visible(chart))continue;
    result.charts++;
    const svg=chart.querySelector('.as-terminal-svg'),o=svg?.__visibilityOptions||chart.__visibilityOptions,l=svg?.__visibilityLayout;
    if(!svg||!o||!l){add('Actual renderer was not instrumented');continue;}
    const id=o.id||'main',plot=plotRect(svg),svgBox=rect(svg),rail=chart.querySelector('[data-tc-annotation-rail]'),annotations=l.annotations!==false;
    if(!plot||plot.width<=0||plot.height<=0){add('Actual plot clip bounds are invalid',{id});continue;}
    if(/(?:NaN|Infinity|undefined)/.test(svg.innerHTML))add('Invalid SVG numerical attribute',{id});
    if(o.chartRole==='context'&&o.bars.length<60)add('Context history has fewer than 60 candles',{id,bars:o.bars.length});
    const labels=[...chart.querySelectorAll('.as-market-callout')].filter(visible),svgLabels=[...svg.querySelectorAll('.as-market-callout,.as-terminal-zone-chip,.as-terminal-direct')].filter(visible);
    if(svgLabels.length)add('Opaque semantic annotation labels remain inside SVG',{id,count:svgLabels.length,text:svgLabels.map(n=>n.textContent)});
    const valid=i=>Number.isInteger(i)&&i>=l.start&&i<=l.end;
    const zones=(o.zones||[]).filter(z=>(z.to??l.end)>=l.start&&(z.from??0)<=l.end&&Number.isFinite(z.low)&&Number.isFinite(z.high)&&Math.min(l.bottom,l.y(z.low))>=Math.max(l.top,l.y(z.high)));
    const markers=(o.markers||[]).filter(m=>valid(m.index)&&Number.isFinite(m.price));
    const needsRail=annotations&&(zones.length||markers.length||(o.levels||[]).length||(o.callouts||[]).some(c=>valid(c.index))||(o.segments||[]).length);
    if(needsRail&&!visible(rail))add('Visible annotations have no HTML rail below the chart',{id});
    if(annotations&&rail&&visible(rail)){
     const rb=rect(rail),cb=rect(chart);
     if(rail.closest('svg'))add('Annotation rail is nested in SVG',{id});
     if(rb.y<svgBox.bottom-.5)add('Annotation rail overlaps SVG instead of sitting below it',{id,rail:rb,svg:svgBox});
     if(rb.x<cb.x-1||rb.right>cb.right+1||rail.scrollWidth>rail.clientWidth+1)add('Annotation rail overflows chart horizontally',{id});
    }
    const obstacles=[...svg.querySelectorAll('.as-terminal-zone,.as-terminal-mark,.as-market-point,.as-market-arrow,.as-terminal-candle')].filter(visible).map(n=>({name:n.getAttribute('class'),box:rect(n)}));
    for(const label of labels){
     result.labels++;
     const box=rect(label),target=label.getAttribute('data-annotation-target');
     if(!rail?.contains(label))add('Annotation text is outside the dedicated HTML rail',{id,text:label.textContent});
     if(label.closest('svg'))add('Label is still rendered inside SVG',{id,text:label.textContent});
     if(intersects(box,plot))add('Label obscures actual plot clip',{id,target,text:label.textContent,label:box,plot});
     const collision=obstacles.find(obstacle=>intersects(box,obstacle.box));if(collision)add('Label obscures a candle, zone, or point',{id,target,text:label.textContent,obstacle:collision.name});
     if(!/^(?:zone|marker|level|segment|callout):\d+$/.test(target||''))add('Label button has no stable annotation target',{id,target,text:label.textContent});
     if(label.tagName!=='BUTTON')add('Annotation label is not a keyboard accessible button',{id,target});
     if(box.y<svgBox.bottom-.5)add('Label is not below the complete SVG',{id,target});
    }
    if(annotations){
     const actualZones=svg.querySelectorAll('.as-terminal-area .as-terminal-zone').length;
     if(actualZones!==zones.length)add('Configured visible zones were removed or duplicated',{id,expected:zones.length,actual:actualZones});
     result.zoneChecks++;
     const actualMarkers=svg.querySelectorAll('.as-terminal-mark').length;
     if(actualMarkers!==markers.length)add('Configured visible point markers were removed or duplicated',{id,expected:markers.length,actual:actualMarkers});
     result.pointChecks++;
    }
   }
  }
  function currentButton(chart,target){return[...chart.querySelectorAll('[data-annotation-target]')].find(n=>n.tagName==='BUTTON'&&n.getAttribute('data-annotation-target')===target);}
  function selected(chart,target){const button=currentButton(chart,target),svg=chart.querySelector('svg'),active=[...svg.querySelectorAll('.is-annotation-active')];return{pressed:button?.getAttribute('aria-pressed')==='true',active:active.length,targetMatches:active.some(n=>n.getAttribute('data-annotation-target')===target||n.closest('[data-annotation-target]')?.getAttribute('data-annotation-target')===target||n.getAttribute('data-annotation-id')===target)};}
  async function interactions(result){
   const charts=[...document.querySelectorAll('[data-as-scene] .as-terminal[data-authored="true"]')].filter(visible);
   for(const chart of charts){
    const id=chart.__visibilityOptions?.id,add=(message,extra={})=>result.issues.push({where:'interaction',message,id,...extra});
    const targets=[...chart.querySelectorAll('[data-tc-annotation-rail] button[data-annotation-target]')].filter(visible).map(n=>n.getAttribute('data-annotation-target'));
    for(const target of targets){
     const button=currentButton(chart,target);if(!button)continue;button.click();await frame();const state=selected(chart,target);
     if(!state.pressed||!state.active)add('Click did not activate both annotation button and SVG target',{target,...state});
     if(state.active&&!state.targetMatches)add('Active SVG target does not match the chosen label',{target,...state});
     result.buttonTargets++;
    }
    const retained=targets.find(target=>/^zone:|^level:/.test(target))||targets[0];
    if(retained){
     currentButton(chart,retained)?.click();if(!selected(chart,retained).pressed)currentButton(chart,retained)?.click();await frame();
     const svg=chart.querySelector('svg'),r=svg.getBoundingClientRect();svg.dispatchEvent(new PointerEvent('pointermove',{clientX:r.x+r.width*.55,clientY:r.y+r.height*.5,bubbles:true}));await frame();
     if(!selected(chart,retained).pressed||!selected(chart,retained).active)add('Pointer redraw lost selected annotation',{target:retained});
     const zoom=chart.querySelector('[data-tc-in]');if(zoom&&!zoom.disabled){zoom.click();await frame();}
     chart.querySelector('[data-tc-all]')?.click();await frame();
     if(!selected(chart,retained).pressed||!selected(chart,retained).active)add('Zoom redraw lost selected annotation',{target:retained});
     result.persistentSelections++;
    }
    const toggle=chart.querySelector('[data-tc-annotations]');if(toggle&&!toggle.disabled){
     toggle.click();await frame();
     if(toggle.getAttribute('aria-pressed')!=='false')add('Annotation switch did not turn off');
     if(visible(chart.querySelector('[data-tc-annotation-rail]')))add('Annotation switch left the HTML rail visible');
     if(chart.querySelectorAll('svg .as-terminal-zone').length)add('Annotation switch left SVG zones visible');
     toggle.click();await frame();
     if(toggle.getAttribute('aria-pressed')!=='true')add('Annotation switch did not turn on');
     if(targets.length&&!visible(chart.querySelector('[data-tc-annotation-rail]')))add('Annotation switch did not restore the HTML rail');
     result.annotationToggles++;
    }
   }
   snapshot('after annotation interactions',result);
  }
  window.runAnnotationVisibilityLesson=async(key,interact=true)=>{
   const result={snapshots:0,charts:0,labels:0,zoneChecks:0,pointChecks:0,buttonTargets:0,persistentSelections:0,annotationToggles:0,issues:[]};
   localStorage.removeItem(courseV1ProgressKey());await openTrainingLesson(TRADING_COURSE_V1.lessons.find(l=>l.key===key).id);await frame();
   const q=s=>document.querySelector('[data-studio-root] '+s);q('[data-as-tab="theory"]').click();q('[data-as-replay]').click();await frame();
   const stages=[...document.querySelectorAll('[data-as-step]')].map(n=>Number(n.dataset.asStep));
   for(const step of stages){q('[data-as-step="'+step+'"]').click();await frame();snapshot('theory '+step,result);}
   if(interact)await interactions(result);
   q('[data-as-tab="examples"]').click();await frame();const examples=[...document.querySelectorAll('[data-as-example]')].map(n=>n.dataset.asExample);
   for(const example of examples){q('[data-as-example="'+example+'"]').click();await frame();snapshot('case '+example,result);}
   q('[data-as-tab="practice"]').click();await frame();snapshot('practice hidden',result);
   const choice=TD_STUDIO_LESSONS[key].practice.choices.findIndex(c=>c.correct);q('input[name="as-practice"][value="'+choice+'"]').checked=true;q('[data-as-reveal]').click();await frame();snapshot('practice revealed',result);
   const alternate=q('[data-as-alternate]');if(visible(alternate)){alternate.click();await frame();snapshot('practice contrast',result);}
   closeModal();return result;
  };
 });
}

async function proof(page){
 for(const [width,theme]of [[1540,'midnight'],[390,'midnight'],[390,'paper']]){
  await page.setViewportSize({width,height:1800});
  await page.evaluate(async theme=>{const picker=document.querySelector('#academyPreviewTheme');picker.value=theme;picker.dispatchEvent(new Event('change',{bubbles:true}));localStorage.removeItem(courseV1ProgressKey());await openTrainingLesson(TRADING_COURSE_V1.lessons.find(l=>l.key==='12.3').id);document.querySelector('[data-as-step="4"]').click();},theme);
  const terminal=page.locator('[data-market-primary] .as-terminal');await terminal.scrollIntoViewIfNeeded();
  const screenshot=path.join(output,'order-block-'+width+'-'+theme+'.png');await terminal.screenshot({path:screenshot});report.screenshots.push(screenshot);await page.evaluate(()=>closeModal());
 }
}

(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.TD_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:{width:widths[0],height:1100},reducedMotion:'reduce'});page.on('pageerror',error=>report.runtimeErrors.push(error.message));
  await page.route(/https?:\/\/[^/]*supabase\.(?:co|in)\//,route=>{report.databaseRequests.push(route.request().url());return route.abort();});
  await page.goto(url);await page.waitForFunction(()=>window.TDChartAnnotations&&window.TDTerminalChart&&window.TD_STUDIO_LESSONS);await install(page);
  const authored=await page.evaluate(()=>Object.entries(TD_STUDIO_LESSONS).filter(([,l])=>l.marketAuthored===true).map(([key])=>key));
  report.testedLessons=process.env.TD_ANNOTATION_KEYS?.split(',').filter(Boolean)||authored;if(!process.env.TD_ANNOTATION_KEYS)assert.equal(authored.length,55,'All 55 market lessons must be authored');
  for(const width of widths){await page.setViewportSize({width,height:1100});for(let i=0;i<report.testedLessons.length;i++){
   const key=report.testedLessons[i];
   try{
    const r=await page.evaluate(({key,interact})=>runAnnotationVisibilityLesson(key,interact),{key,interact:process.env.TD_ANNOTATION_STATIC!=='1'});
    for(const counter of ['snapshots','charts','labels','zoneChecks','pointChecks','buttonTargets','persistentSelections','annotationToggles'])report[counter]+=r[counter];
    for(const item of r.issues){const entry={key,width,...item};report.issues.push(entry);if(process.env.TD_ANNOTATION_LIVE==='1')console.log('DIAGNOSTIC '+JSON.stringify(entry));}
   }catch(error){report.issues.push({key,width,where:'runtime',message:error.message});await page.evaluate(()=>closeModal()).catch(()=>{});}
   if((i+1)%10===0||i===report.testedLessons.length-1){save();console.log(JSON.stringify({width,checked:i+1,total:report.testedLessons.length,issues:report.issues.length}));}
  }}
  if(process.env.TD_ANNOTATION_PROOFS==='1')await proof(page);
  assert.deepEqual(report.runtimeErrors,[],'Browser runtime errors');assert.deepEqual(report.databaseRequests,[],'The academy must not query a database');assert.equal(report.issues.length,0,'Annotation audit found '+report.issues.length+' issues; '+JSON.stringify(report.issues.slice(0,5)));
  console.log('PASS: '+report.testedLessons.length+' lessons at '+widths.join('/')+'px; '+report.snapshots+' snapshots, '+report.charts+' actual charts, '+report.labels+' labels outside plots, '+report.buttonTargets+' target interactions, '+report.persistentSelections+' persistent selections.');
 }finally{save();console.log('Annotation report: '+reportFile);await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
