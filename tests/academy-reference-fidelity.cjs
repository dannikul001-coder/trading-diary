const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.TD_NODE_MODULES||'C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1110-973-0_26.1110.973.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules','playwright'));
const base=process.argv[2]||'http://127.0.0.1:8767/academy-preview.html';
const output=process.env.TD_REFERENCE_FIDELITY_OUTPUT;
// Prices, reactions and zones in the user's approved 48-candle reference.
const closes=[104.2,103.1,101.4,99.3,100.6,100.1,102.4,104.8,106.2,107.8,109.1,108.7,107.3,106.5,104.2,102.8,100.6,99.2,100.4,102.2,101.7,103.8,106.6,108.2,109.4,108.5,106.7,105.8,103.7,101.2,99.1,100.7,101.6,103.9,103.3,105.1,106.4,105.7,104.3,102.8,100.6,99.4,100.8,102.6,102.1,104.4,106.2,107.1];
const themes=[...new Set([...fs.readFileSync(path.join(__dirname,'../index.html'),'utf8').matchAll(/data-appearance-preset="([a-z]+)"/g)].map(m=>m[1]))];
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.TD_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const errors=[],database=[],report=[];
  for(const width of [1540,390,320]){
   const page=await browser.newPage({viewport:{width,height:1240},reducedMotion:'reduce'});
   page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/supabase\.(?:co|in)\//.test(r.url()))database.push(r.url());});
   await page.goto(new URL('?lesson=2.1&tab=examples&theme=midnight',base).href);
   const root=page.locator('[data-studio-root]'),svg=page.locator('.as-terminal-svg');
   await root.locator('[data-as-tab="examples"][aria-selected="true"]').waitFor();
   assert.equal(await page.locator('.as-terminal-candle').count(),48);
   assert.equal(await page.locator('.as-terminal-mark').count(),6);
   assert.match(await page.locator('.as-terminal-readout').innerText(),/Закрытие\s+107,1/);
   assert.deepEqual(await page.evaluate(()=>TD_STUDIO_PRICE.visible('2.1',{step:3}).bars.map(b=>b.c)),closes);
   assert.deepEqual(await page.evaluate(()=>TD_STUDIO_PRICE.terminalConfig('2.1',{step:3}).markers.map(m=>m.index)),[3,17,30,10,24,41]);
   const geometry=()=>page.locator('[data-tc-candles]').evaluate(el=>[...el.querySelectorAll('line,rect')].map(n=>[...n.attributes].filter(a=>a.name!=='class').map(a=>[a.name,a.value])));
   const reference=await geometry();
   // The actual SVG scale and candle bodies must agree with the reference prices.
   const differences=await svg.evaluate((el,prices)=>{
    const ticks=[...el.querySelectorAll('[data-tc-grid] text')].filter(n=>!n.textContent.includes('Свеча')&&!n.textContent.includes('№'));
    const first=ticks[0],last=ticks.at(-1),low=Number(first.textContent.replace(',','.')),high=Number(last.textContent.replace(',','.'));
    const y=value=>Number(first.getAttribute('y'))-4+(value-low)/(high-low)*(Number(last.getAttribute('y'))-Number(first.getAttribute('y')));
    return [...el.querySelectorAll('.as-terminal-candle rect')].map((rect,i)=>{
     const open=i?prices[i-1]:104.9,close=prices[i];
     return Math.max(Math.abs(Number(rect.getAttribute('y'))-Math.min(y(open),y(close))),Math.abs(Number(rect.getAttribute('height'))-Math.max(2,Math.abs(y(open)-y(close)))));
    });
   },closes);
   assert(differences.every(n=>n<0.01),'SVG bodies must use the approved prices');
   for(const theme of themes){
    await page.getByLabel('Оформление обучения',{exact:true}).selectOption(theme);
    assert.deepEqual(await geometry(),reference,'theme changed chart geometry: '+theme);
    assert.equal(await root.evaluate(el=>el.scrollWidth>el.clientWidth+1),false,'overflow '+width+' '+theme);
    assert.equal(await page.locator('.as-terminal-area-support').count(),1);assert.equal(await page.locator('.as-terminal-area-resistance').count(),1);
   }
   await page.getByLabel('Оформление обучения',{exact:true}).selectOption('midnight');
   if(output){fs.mkdirSync(output,{recursive:true});await page.screenshot({path:path.join(output,'reference-'+width+'.png')});}
   await page.locator('[data-tc-in]').click();assert.notDeepEqual(await geometry(),reference);await page.locator('[data-tc-all]').click();assert.deepEqual(await geometry(),reference);
   await page.locator('[data-tc-probe]').fill('43');assert.match(await page.locator('.as-terminal-readout').innerText(),/Закрытие\s+100,8/);
   await page.getByRole('button',{name:'Предыдущая свеча',exact:true}).click();assert.match(await page.locator('.as-terminal-readout').innerText(),/Закрытие\s+99,4/);
   await svg.press('End');assert.match(await page.locator('[data-tc-index]').innerText(),/48/);
   await page.locator('[data-tc-annotations]').click();assert.equal(await page.locator('.as-terminal-area').count(),0);await page.locator('[data-tc-annotations]').click();
   await page.locator('[data-as-example="contrast"]').click();assert.match(await page.locator('.as-terminal-readout').innerText(),/Закрытие\s+96,5/);await page.locator('[data-tc-probe]').fill('43');assert.match(await page.locator('.as-terminal-readout').innerText(),/Закрытие\s+97,6/);
   await page.locator('[data-as-example="base"]').click();
   await page.locator('[data-as-tab="theory"]').click();await page.locator('[data-as-replay]').click();
   let context;
   for(const step of [0,1,2]){
    await page.locator(`[data-as-step="${step}"]`).click();assert.equal(await page.locator('.as-terminal-candle').count(),42);
    const current=await geometry();if(context)assert.deepEqual(current,context,'theory moved the reference history');else context=current;
    assert.equal(await page.locator('.as-terminal-mark-active').count(),step===2?1:2);
   }
   // Reopening must retain the selected tab, not relabel an example as theory.
   await page.locator('[data-as-tab="examples"]').click();
   await page.waitForFunction(()=>courseV1Progress()[TRADING_COURSE_V1.lessons.find(l=>l.key==='2.1').id]?.studio_tab==='examples');
   await page.locator('.modal-close').click();await page.evaluate(()=>openTrainingLesson(TRADING_COURSE_V1.lessons.find(l=>l.key==='2.1').id));
   assert.equal(await page.locator('[data-as-tab="examples"]').getAttribute('aria-selected'),'true');assert.equal(await page.locator('.as-terminal-candle').count(),48);
   await page.locator('[data-as-tab="practice"]').click();assert.equal(await page.locator('.as-terminal-candle').count(),42);
   await page.locator('input[name="as-practice"]').first().check();await page.locator('[data-as-reveal]').click();assert.equal(await page.locator('.as-terminal-candle').count(),48);
   await page.waitForFunction(()=>courseV1Progress()[TRADING_COURSE_V1.lessons.find(l=>l.key==='2.1').id]?.studio_tab==='practice');
   await page.locator('.modal-close').click();await page.evaluate(()=>openTrainingLesson(TRADING_COURSE_V1.lessons.find(l=>l.key==='2.1').id));
   assert.equal(await page.locator('[data-as-tab="practice"]').getAttribute('aria-selected'),'true');assert.equal(await page.locator('.as-terminal-candle').count(),42,'resume must hide the previously revealed future');
   assert.equal(await page.locator('input[name="as-practice"]:checked').count(),0);assert.equal(await page.locator('[data-as-complete]').isEnabled(),false);
   // Malformed/legacy progress may not select an arbitrary panel.
   await page.locator('.modal-close').click();await page.evaluate(()=>{const l=TRADING_COURSE_V1.lessons.find(l=>l.key==='2.1');saveCourseV1Progress(l.id,{studio_tab:'invalid'});return openTrainingLesson(l.id);});
   assert.equal(await page.locator('[data-as-tab="theory"]').getAttribute('aria-selected'),'true');
   report.push({width,themes:themes.length,candles:48,markers:6,theoryContext:42,resume:true,hiddenPractice:true});await page.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(database,[]);if(output)fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({report,errors,database},null,2));
  console.log(JSON.stringify(report));console.log('PASS: reference prices/geometry, 18 themes, steps, controls, tab resume and hidden practice');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
