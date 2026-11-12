const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.TD_NODE_MODULES||'C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1110-973-0_26.1110.973.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules','playwright'));
const base=process.argv[2]||'http://127.0.0.1:8767/academy-preview.html',output=process.env.TD_EXAMPLES_OUTPUT;
const widths=(process.env.TD_EXAMPLES_WIDTHS||'320,390,1440').split(',').map(Number);
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.TD_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:{width:390,height:1100},reducedMotion:'reduce'}),errors=[],database=[],reports=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/supabase\.(?:co|in)\//.test(r.url()))database.push(r.url());});
  await page.goto(base);await page.waitForFunction(()=>window.AcademyStudio);
  await page.evaluate(()=>{const original=TDTerminalChart.mount;window.auditCharts=new Map();TDTerminalChart.mount=(host,options)=>{auditCharts.set(host,options);const dispose=original(host,options);return()=>{auditCharts.delete(host);dispose();};};});
  for(const width of widths){
   await page.setViewportSize({width,height:1100});
   const report=await page.evaluate(async width=>{
    currentUser={id:'examples-audit-'+width};const rows=[],check=(v,m)=>{if(!v)throw new Error(m);},fmt=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(v);
    for(const lesson of TRADING_COURSE_V1.lessons){
     try{
      await openTrainingLesson(lesson.id);const root=document.querySelector('[data-studio-root]'),q=s=>root.querySelector(s),entry=TD_STUDIO_LESSONS[lesson.key],last=entry.stages.length-1;
      q('[data-as-notes]').value='Не потерять конспект '+lesson.key;q('[data-as-step="1"]').click();q('[data-as-tab="examples"]').click();check(activeLearningModel.state.step===last,'first example must show full model');
      q('[data-as-tab="theory"]').click();check(activeLearningModel.state.step===1,'theory cursor lost');q('[data-as-tab="examples"]').click();q('[data-as-step="1"]').click();q('[data-as-next]').click();check(activeLearningModel.state.step===2&&activeLearningModel.state.tab==='examples','example next jumped to practice');q('[data-as-prev]').click();check(activeLearningModel.state.step===1,'example previous failed');
      q('[data-as-tab="theory"]').click();check(activeLearningModel.state.step===1,'example changed theory cursor');q('[data-as-tab="examples"]').click();check(activeLearningModel.state.step===1,'example cursor lost');q('[data-as-step="'+last+'"]').click();
      let charts=0;
      for(const [host,config] of auditCharts){
       if(!root.contains(host))continue;charts++;const terminal=host.querySelector('.as-terminal'),selected=config.bars.length-1,read=terminal.querySelector('.as-terminal-readout').textContent;
       check(terminal.querySelector('[data-tc-probe]').value===String(selected+1),'initial candle not the current close');
       if(config.mode==='indicator'){
        for(const line of config.series){const value=line.values[selected];if(Number.isFinite(value))check(read.includes(fmt(value)),'indicator readout differs from calculated values');}
        check(terminal.querySelectorAll('.as-terminal-candle').length===0,'price candles in oscillator scale');
        if(config.bounded){const ticks=[...terminal.querySelectorAll('[data-tc-grid] text')].map(n=>n.textContent);check(ticks.includes('0')&&ticks.includes('100'),'bounded axis is not 0–100');}
       }else check(read.includes(fmt(config.bars[selected].c)),'OHLC readout differs from current close');
       for(const node of terminal.querySelectorAll('svg line,svg rect,svg circle,svg path'))for(const attr of ['x','y','height','width','cx','cy','x1','y1','x2','y2','d']){const value=node.getAttribute(attr);if(value!==null)check(!/NaN|Infinity|undefined/.test(value),'invalid SVG geometry');}
      }
      for(const [host,config] of auditCharts){
       if(!root.contains(host))continue;const terminal=host.querySelector('.as-terminal');
       if(config.bars.length>1){terminal.querySelector('[data-tc-probe]').value='2';terminal.querySelector('[data-tc-probe]').dispatchEvent(new Event('input',{bubbles:true}));check(terminal.querySelector('[data-tc-index]').textContent==='№ 2','range failed');terminal.querySelector('[data-tc-next]').click();check(terminal.querySelector('[data-tc-index]').textContent==='№ 3','next candle failed');if(config.linked)for(const [peer,other] of auditCharts)if(root.contains(peer)&&other.linked)check(peer.querySelector('[data-tc-probe]').value==='3','price and indicator selection are not linked');}
      }
      if(entry.kind==='indicator'){
       check(q('[data-as-worked-example]').textContent===TD_STUDIO_INDICATORS.workedExample(lesson.key,{step:last}),'worked example uses unrelated data');
       const parameter=q('.as-indicator-parameter');if(parameter){const value=parameter.options[1].value;parameter.value=value;parameter.dispatchEvent(new Event('change',{bubbles:true}));check(q('[data-as-worked-example]').textContent===TD_STUDIO_INDICATORS.workedExample(lesson.key,{step:last},value),'worked example did not follow parameters');q('[data-as-tab="notes"]').click();q('[data-as-tab="examples"]').click();check(q('.as-indicator-parameter').value===value,'parameter reset between tabs');q('[data-as-replay]').click();check(q('.as-indicator-parameter').value==='default','replay did not reset parameters');q('[data-as-step="'+last+'"]').click();}
      }
      check(!q('[data-as-scene] svg:not(.as-terminal-svg)'),'non-interactive chart remains');
      for(const item of entry.examples){
       q('[data-as-example="'+item.id+'"]').click();check(activeLearningModel.state.step===item.step,'case did not select its scene');check(q('[data-as-body]').textContent===item.body,'case explanation does not match selection');check(q('[data-as-example="'+item.id+'"]').getAttribute('aria-pressed')==='true','selected case not indicated');
       if(item.stop)for(const [host,config] of auditCharts)if(root.contains(host))check(config.bars.length<=item.stop,'checkpoint exposed future candles');
       if(item.rows)check(q('.as-decision-visual').textContent.includes(item.rows[1][1]),'case schema does not match its facts');
       for(const svg of root.querySelectorAll('[data-as-scene] svg')){const labels=[...svg.querySelectorAll('.as-terminal-zone-label-bg,[data-tc-zones]>.as-terminal-area-label')].map(n=>n.getBoundingClientRect()),marks=[...svg.querySelectorAll('.as-terminal-mark')].map(n=>n.getBoundingClientRect());for(const label of labels)for(const mark of marks)check(!(label.left<mark.right&&label.right>mark.left&&label.top<mark.bottom&&label.bottom>mark.top),'zone/level label covers a numbered marker');}
       check(root.scrollWidth<=root.clientWidth+1,'case horizontal overflow');
      }
      q('[data-as-example="base"]').click();
      q('[data-as-tab="practice"]').click();const prefix=q('[data-as-scene]').innerHTML.replace(/terminal-clip-\d+/g,'clip');check(q('[data-as-scene]').dataset.mode==='hidden','practice not hidden');
      q('input[name="as-practice"]').checked=true;q('[data-as-reveal]').click();q('[data-as-retry]').click();check(q('[data-as-scene]').dataset.mode==='hidden','reset reveals future');check(q('[data-as-scene]').innerHTML.replace(/terminal-clip-\d+/g,'clip')===prefix,'reset changed hidden data, axes or controls');
      q('[data-as-tab="notes"]').click();check(q('[data-as-notes]').value==='Не потерять конспект '+lesson.key,'unsaved note lost');check(q('[data-as-complete]').disabled,'partial inspection completed lesson');
      check(root.scrollWidth<=root.clientWidth+1,'horizontal overflow');rows.push({key:lesson.key,charts,kind:entry.kind});closeModal();check(auditCharts.size===0,'chart listeners not disposed');
     }catch(error){throw new Error(lesson.key+' at '+width+': '+error.message);}
    }
    return{width,lessons:rows.length,charts:rows.reduce((s,r)=>s+r.charts,0),rows};
   },width);
   reports.push(report);console.log(JSON.stringify({width,lessons:report.lessons,charts:report.charts}));
  }
  // Real keyboard, pointer, zoom, persistence and reset paths.
  await page.setViewportSize({width:390,height:1100});await page.evaluate(()=>openTrainingLesson(TRADING_COURSE_V1.lessons.find(l=>l.key==='11.1').id));
  await page.locator('[data-as-tab="theory"]').click();await page.locator('[data-as-tab="theory"]').press('ArrowRight');assert.equal(await page.locator('[data-as-tab="examples"]').getAttribute('aria-selected'),'true');await page.locator('[data-as-step="4"]').click();
  const terminals=page.locator('[data-as-scene] .as-terminal'),price=terminals.first(),oscillator=terminals.nth(1);
  await oscillator.locator('[data-tc-probe]').fill('35');assert.deepEqual(await terminals.locator('[data-tc-probe]').evaluateAll(nodes=>nodes.map(n=>n.value)),['35','35']);
  await oscillator.locator('svg').press('ArrowRight');assert.deepEqual(await terminals.locator('[data-tc-probe]').evaluateAll(nodes=>nodes.map(n=>n.value)),['36','36']);
  await oscillator.locator('svg').press('Home');assert.match(await oscillator.locator('.as-terminal-readout').innerText(),/нет значения/);await oscillator.locator('svg').press('End');
  await oscillator.locator('[data-tc-in]').click();await oscillator.locator('[data-tc-all]').click();await oscillator.locator('[data-tc-annotations]').click();await page.locator('[data-as-replay]').click();assert.equal(await page.locator('[data-tc-annotations]').nth(1).getAttribute('aria-pressed'),'true');
  await page.locator('[data-as-tab="theory"]').click();await page.locator('[data-as-step="1"]').click();await page.locator('[data-as-tab="examples"]').click();await page.locator('[data-as-step="2"]').click();
  await page.waitForFunction(()=>courseV1Progress()[TRADING_COURSE_V1.lessons.find(l=>l.key==='11.1').id]?.studio_example_step===2);
  await page.locator('.modal-close').click();await page.evaluate(()=>openTrainingLesson(TRADING_COURSE_V1.lessons.find(l=>l.key==='11.1').id));assert.equal(await page.evaluate(()=>activeLearningModel.state.step),2);await page.locator('[data-as-tab="theory"]').click();assert.equal(await page.evaluate(()=>activeLearningModel.state.step),1);await page.locator('.modal-close').click();
  await page.evaluate(()=>openTrainingLesson(TRADING_COURSE_V1.lessons.find(l=>l.key==='5.1').id));await page.locator('[data-as-tab="theory"]').click();await page.locator('[data-as-step="1"]').click();assert.match(await page.locator('[data-tc-zones]').textContent(),/118/);await page.locator('.modal-close').click();
  await page.evaluate(()=>openTrainingLesson(TRADING_COURSE_V1.lessons.find(l=>l.key==='15.1').id));await page.locator('[data-as-tab="examples"]').click();await page.locator('[data-field="note"]').fill('Синтетическая причина');await page.locator('[data-save]').click();assert.equal(await page.locator('[data-field="note"]').getAttribute('readonly'),'');await page.locator('[data-as-replay]').click();assert.equal(await page.locator('[data-field="note"]').inputValue(),'');assert.equal(await page.locator('[data-save]').isEnabled(),true);
  await page.goto(new URL('?lesson=2.1&case=checkpoint',base).href);await page.locator('[data-as-example="checkpoint"][aria-pressed="true"]').waitFor();assert.equal(await page.locator('[data-as-tab="examples"]').getAttribute('aria-selected'),'true');assert.equal(await page.locator('.as-terminal-candle').count(),42);
  await page.locator('.modal-close').click();await page.evaluate(()=>openTrainingLesson(TRADING_COURSE_V1.lessons.find(l=>l.key==='2.1').id));assert.equal(await page.locator('[data-as-example="checkpoint"]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('.as-terminal-candle').count(),42);
  await page.goto(new URL('?lesson=14.5&material=practice&case=contrast',base).href);await page.locator('[data-as-source-practice]:visible').waitFor();assert.equal(await page.locator('[data-as-example-picker]').isVisible(),false);
  assert.deepEqual(errors,[]);assert.deepEqual(database,[]);
  if(output){fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'examples-functional.json'),JSON.stringify({reports,errors,database},null,2));}
  console.log('PASS: all lessons and all chart panels, independent tab cursors, worked values, linked selection, parameters, replay, practice, notes and saved resume');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
