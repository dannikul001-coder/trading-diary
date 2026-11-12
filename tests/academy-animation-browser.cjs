const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.TD_NODE_MODULES||'C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1110-973-0_26.1110.973.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules','playwright'));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.TD_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1200},reducedMotion:'no-preference'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.argv[2]||'http://127.0.0.1:8767/academy-preview.html');await page.waitForFunction(()=>window.AcademyExampleCases);
  const lessons=await page.evaluate(()=>TRADING_COURSE_V1.lessons.filter(l=>TD_STUDIO_PRICE.scene(l.key)||TD_STUDIO_INDICATORS.keys.includes(l.key)).map(l=>({id:l.id,key:l.key})));
  await page.evaluate(()=>{
   window.motionShape=()=>[...document.querySelectorAll('[data-as-scene] .as-terminal-svg')].map(svg=>[...svg.querySelectorAll('.as-terminal-candle line,.as-terminal-candle rect,.as-terminal-series')].map(n=>[n.tagName,...['x','y','width','height','x1','y1','x2','y2','d','cx','cy'].map(a=>n.getAttribute(a))]));
   const original=requestAnimationFrame;window.motionFrames=[];window.captureMotion=false;
   window.requestAnimationFrame=cb=>original(time=>{cb(time);if(captureMotion)motionFrames.push(JSON.stringify(motionShape()));});
  });
  const report=[];
  for(const lesson of lessons){
   await page.evaluate(id=>openTrainingLesson(id),lesson.id);await page.locator('[data-as-tab="examples"]').click();
   await page.evaluate(()=>{const root=document.querySelector('[data-studio-root]'),buttons=root.querySelectorAll('[data-as-example]');buttons[1].click();});
   await page.waitForTimeout(550);
   const before=await page.evaluate(()=>JSON.stringify(motionShape()));
   await page.evaluate(()=>{motionFrames=[];captureMotion=true;document.querySelector('[data-as-example="base"]').click();});
   await page.waitForTimeout(550);
   const result=await page.evaluate(()=>{captureMotion=false;return{frames:motionFrames.length,shapes:[...new Set(motionFrames)],after:JSON.stringify(motionShape()),panels:document.querySelectorAll('[data-as-scene] .as-terminal').length};});
   if(lesson.key==='12.5')assert.equal(result.after,before,'OHLC evidence must stay the same when only the inference changes');
   else{assert.notEqual(result.after,before,lesson.key+' scene did not change');assert(result.shapes.some(s=>s!==before&&s!==result.after),lesson.key+' has no interpolated frame');assert(result.shapes.length>=3,lesson.key+' transition jumps directly to the final geometry');}
   report.push({key:lesson.key,panels:result.panels,frames:result.frames,distinctFrames:result.shapes.length,sameEvidence:lesson.key==='12.5'});
   await page.locator('.modal-close').click();if(report.length%10===0)console.log('Motion checked in '+report.length+' lessons');
  }
  await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>openTrainingLesson(TRADING_COURSE_V1.lessons.find(l=>l.key==='11.1').id));await page.locator('[data-as-tab="examples"]').click();
  await page.evaluate(()=>{motionFrames=[];captureMotion=true;document.querySelector('[data-as-example="contrast"]').click();});await page.waitForTimeout(50);
  assert.equal(await page.evaluate(()=>motionFrames.length),0,'reduced motion preference must disable interpolation');assert.deepEqual(errors,[]);
  const summary={lessons:report.length,panels:report.reduce((sum,r)=>sum+r.panels,0),reducedMotion:true,errors,report};if(process.env.TD_EXAMPLES_OUTPUT)fs.writeFileSync(path.join(process.env.TD_EXAMPLES_OUTPUT,'animation.json'),JSON.stringify(summary,null,2));
  console.log(JSON.stringify({lessons:summary.lessons,panels:summary.panels,reducedMotion:true,errors}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
