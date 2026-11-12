'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.TD_NODE_MODULES||'C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1110-973-0_26.1110.973.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules','playwright'));
const base=process.argv[2]||'http://127.0.0.1:8767/academy-preview.html',output=process.env.TD_REFERENCE_FIDELITY_OUTPUT;
// Keep the approved 48 closes as a regression fixture. The current lesson has
// preceding context and a longer continuation; the fixture is a subsequence.
const approved=[104.2,103.1,101.4,99.3,100.6,100.1,102.4,104.8,106.2,107.8,109.1,108.7,107.3,106.5,104.2,102.8,100.6,99.2,100.4,102.2,101.7,103.8,106.6,108.2,109.4,108.5,106.7,105.8,103.7,101.2,99.1,100.7,101.6,103.9,103.3,105.1,106.4,105.7,104.3,102.8,100.6,99.4,100.8,102.6,102.1,104.4,106.2,107.1];
const availableThemes=[...new Set([...fs.readFileSync(path.join(__dirname,'../index.html'),'utf8').matchAll(/data-appearance-preset="([a-z]+)"/g)].map(m=>m[1]))];
const themes=process.env.TD_REFERENCE_FIDELITY_THEMES?process.env.TD_REFERENCE_FIDELITY_THEMES.split(','):availableThemes;
const widths=(process.env.TD_REFERENCE_FIDELITY_WIDTHS||'1540,390,320').split(',').map(Number);
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.TD_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const errors=[],database=[],report=[];
  for(const width of widths){
   const page=await browser.newPage({viewport:{width,height:1240},reducedMotion:'reduce'});
   page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/supabase\.(?:co|in)\//.test(r.url()))database.push(r.url());});
   await page.goto(new URL('?lesson=2.1&tab=examples&theme=midnight',base).href);
   const root=page.locator('[data-studio-root]'),terminal=root.locator('.as-terminal').first(),svg=terminal.locator('.as-terminal-svg');
   await root.locator('[data-as-tab="examples"][aria-selected="true"]').waitFor();
   const model=await page.evaluate(()=>{const d=TD_MARKET_SCENES['2.1'],step=d.stages.length-1;return{bars:d.build({step}).bars,markers:d.build({step}).markers,cut:d.cut,counts:d.counts,stages:d.stages.length,practiceBars:d.build({practice:true}).bars,practiceFull:d.build({practice:true,revealed:true}).bars,other:d.build({step,alternate:true}).bars};});
   const offset=model.bars.findIndex((_,i)=>approved.every((value,j)=>model.bars[i+j]?.c===value));
   assert(offset>=0,'approved closes are missing from the expanded story');assert(model.cut>=60,'lesson lost its market context');
   await terminal.locator('[data-tc-all]').click();await svg.press('End');
   assert.equal(await terminal.locator('.as-terminal-candle').count(),model.bars.length);assert.equal(await terminal.locator('.as-terminal-mark').count(),model.markers.length);
   const geometry=()=>terminal.locator('[data-tc-candles]').evaluate(el=>[...el.querySelectorAll('line,rect')].map(n=>[...n.attributes].filter(a=>a.name!=='class').map(a=>[a.name,a.value])));
   const reference=await geometry();
   const differences=await svg.evaluate((el,bars)=>{
    const ticks=[...el.querySelectorAll('[data-tc-grid] text')].filter(n=>!n.classList.contains('as-terminal-time-tick'));
    const number=n=>Number(n.textContent.replace(/[\s\u00a0\u202f]/g,'').replace(',','.')),first=ticks[0],last=ticks.at(-1),low=number(first),high=number(last);
    const y=value=>Number(first.getAttribute('y'))-4+(value-low)/(high-low)*(Number(last.getAttribute('y'))-Number(first.getAttribute('y')));
    return [...el.querySelectorAll('.as-terminal-candle rect')].map((rect,i)=>Math.max(Math.abs(Number(rect.getAttribute('y'))-Math.min(y(bars[i].o),y(bars[i].c))),Math.abs(Number(rect.getAttribute('height'))-Math.max(2,Math.abs(y(bars[i].o)-y(bars[i].c))))));
   },model.bars);
   assert(differences.every(n=>n<.01),'SVG candle bodies differ from actual authored OHLC');
   for(const theme of themes){
    assert(availableThemes.includes(theme));await page.getByLabel('Оформление обучения',{exact:true}).selectOption(theme);
    assert.deepEqual(await geometry(),reference,'theme changed chart geometry: '+theme);assert.equal(await root.evaluate(el=>el.scrollWidth>el.clientWidth+1),false,'overflow '+width+' '+theme);
    assert.equal(await terminal.locator('.as-terminal-area-support').count(),1);assert.equal(await terminal.locator('.as-terminal-area-resistance').count(),1);
   }
   if(output){fs.mkdirSync(output,{recursive:true});await page.screenshot({path:path.join(output,'reference-'+width+'.png')});}
   await terminal.locator('[data-tc-in]').click();assert.notDeepEqual(await geometry(),reference);await terminal.locator('[data-tc-all]').click();assert.deepEqual(await geometry(),reference);
   await terminal.locator('[data-tc-probe]').fill(String(offset+43));assert.match(await terminal.locator('.as-terminal-readout').innerText(),/Закрытие\s+100,8/);
   await terminal.getByRole('button',{name:'Предыдущая свеча',exact:true}).click();assert.match(await terminal.locator('.as-terminal-readout').innerText(),/Закрытие\s+99,4/);
   await svg.press('End');assert.match(await terminal.locator('[data-tc-index]').innerText(),new RegExp(String(model.bars.length)));
   await terminal.locator('[data-tc-annotations]').click();assert.equal(await terminal.locator('.as-terminal-area').count(),0);await terminal.locator('[data-tc-annotations]').click();
   await root.locator('[data-as-example="contrast"]').click();await terminal.locator('[data-tc-probe]').fill(String(model.cut+1));assert.match(await terminal.locator('.as-terminal-readout').innerText(),/Закрытие\s+97,6/);
   await root.locator('[data-as-tab="theory"]').click();await root.locator('[data-as-replay]').click();
   for(let step=0;step<model.stages;step++){await root.locator('[data-as-step="'+step+'"]').click();assert.equal(await terminal.locator('[data-tc-probe]').getAttribute('max'),String(model.counts[step]));}
   await root.locator('[data-as-tab="examples"]').click();await page.waitForFunction(()=>courseV1Progress()[TRADING_COURSE_V1.lessons.find(l=>l.key==='2.1').id]?.studio_tab==='examples');
   await page.locator('.modal-close').click();await page.evaluate(()=>openTrainingLesson(TRADING_COURSE_V1.lessons.find(l=>l.key==='2.1').id));assert.equal(await root.locator('[data-as-tab="examples"]').getAttribute('aria-selected'),'true');
   await root.locator('[data-as-tab="practice"]').click();assert.equal(await terminal.locator('[data-tc-probe]').getAttribute('max'),String(model.practiceBars.length));
   await root.locator('input[name="as-practice"]').first().check();await root.locator('[data-as-reveal]').click();assert.equal(await terminal.locator('[data-tc-probe]').getAttribute('max'),String(model.practiceFull.length));
   await page.waitForFunction(()=>courseV1Progress()[TRADING_COURSE_V1.lessons.find(l=>l.key==='2.1').id]?.studio_tab==='practice');await page.locator('.modal-close').click();await page.evaluate(()=>openTrainingLesson(TRADING_COURSE_V1.lessons.find(l=>l.key==='2.1').id));
   assert.equal(await root.locator('[data-as-tab="practice"]').getAttribute('aria-selected'),'true');assert.equal(await terminal.locator('[data-tc-probe]').getAttribute('max'),String(model.practiceBars.length),'resume exposed previously revealed future');assert.equal(await root.locator('input[name="as-practice"]:checked').count(),0);assert.equal(await root.locator('[data-as-complete]').isEnabled(),false);
   await page.locator('.modal-close').click();await page.evaluate(()=>{const l=TRADING_COURSE_V1.lessons.find(l=>l.key==='2.1');saveCourseV1Progress(l.id,{studio_tab:'invalid'});return openTrainingLesson(l.id);});assert.equal(await root.locator('[data-as-tab="theory"]').getAttribute('aria-selected'),'true');
   report.push({width,themes:themes.length,candles:model.bars.length,approvedOffset:offset,approvedCloses:approved.length,theoryContext:model.cut,resume:true,hiddenPractice:true});await page.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(database,[]);if(output)fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({report,errors,database},null,2));
  console.log(JSON.stringify(report));console.log('PASS: approved prices within rich registry, actual OHLC geometry, themes, stages, controls, resume and hidden practice');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
