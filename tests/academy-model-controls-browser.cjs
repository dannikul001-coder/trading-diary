const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const {chromium}=require(path.join(process.env.TD_NODE_MODULES||'C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1110-973-0_26.1110.973.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules','playwright'));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.TD_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--allow-file-access-from-files']});
 const errors=[],database=[];
 try{
  const p=await browser.newPage({viewport:{width:390,height:1000},reducedMotion:'reduce'});p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/supabase\.(?:co|in)/.test(r.url()))database.push(r.url());});
  await p.goto(process.argv[2]||pathToFileURL(path.join(__dirname,'../academy-preview.html')).href);
  const open=async key=>{await p.evaluate(key=>openTrainingLesson(TRADING_COURSE_V1.lessons.find(l=>l.key===key).id),key);await p.locator('[data-as-tab="examples"]').click();};
  const close=()=>p.locator('.modal-close').click();
  const report={chart:0,parameters:0,numbers:0,checks:0,sourceCases:0,journal:false,themePicker:0};
  const lessons=await p.evaluate(()=>TRADING_COURSE_V1.lessons.map(l=>({key:l.key,kind:TD_STUDIO_LESSONS[l.key].kind})));
  for(const lesson of lessons){
   await open(lesson.key);
   const scene=p.locator('[data-as-scene]');
   if(await scene.locator('.as-terminal').count()){
    const first=scene.locator('.as-terminal').first(),probe=first.locator('[data-tc-probe]'),max=Number(await probe.getAttribute('max'));
    if(max>6){await first.locator('[data-tc-in]').click();await first.locator('[data-tc-all]').click();await probe.fill('2');assert.match(await first.locator('[data-tc-index]').textContent(),/2/);await first.locator('[data-tc-next]').click();assert.match(await first.locator('[data-tc-index]').textContent(),/3/);await first.locator('[data-tc-prev]').click();assert.match(await first.locator('[data-tc-index]').textContent(),/2/);report.chart++;}
    const toggle=first.locator('[data-tc-annotations]');if(await toggle.isEnabled()){const n=await first.locator('.as-terminal-candle').count();await toggle.click();assert.equal(await first.locator('.as-terminal-candle').count(),n);await toggle.click();}
   }
   const parameter=scene.locator('.as-indicator-parameter');
   if(await parameter.count()){
    const before=await scene.locator('.as-indicator-values').allTextContents();const options=await parameter.locator('option').evaluateAll(ns=>ns.map(n=>n.value));await parameter.selectOption(options[1]);const after=await scene.locator('.as-indicator-values').allTextContents();assert.notDeepEqual(after,before,'period did not change actual values in '+lesson.key);report.parameters++;
   }
   const numbers=await scene.locator('.as-decision-controls input[type=number]').evaluateAll(ns=>ns.map(n=>({field:n.dataset.field,min:Number(n.min),max:Number(n.max),value:Number(n.value)})));
   for(const number of numbers){const input=scene.locator('[data-field="'+number.field+'"]'),value=Math.min(number.max,Math.max(number.min,number.value+1));await input.fill(String(value));await input.press('Tab');assert.equal(await scene.locator('[data-field="'+number.field+'"]').inputValue(),String(value));await scene.locator('[data-field="'+number.field+'"]').fill('');await scene.locator('[data-field="'+number.field+'"]').press('Tab');assert.match(await scene.textContent(),/нет расчёта|неполные данные|некоррект/);await scene.locator('[data-field="'+number.field+'"]').fill(String(number.value));await scene.locator('[data-field="'+number.field+'"]').press('Tab');report.numbers++;}
   const checks=await scene.locator('.as-decision-controls input[type=checkbox]').evaluateAll(ns=>ns.map(n=>({field:n.dataset.field,checked:n.checked})));
   for(const check of checks){await scene.locator('[data-field="'+check.field+'"]').setChecked(!check.checked);assert.equal(await scene.locator('[data-field="'+check.field+'"]').isChecked(),!check.checked);await scene.locator('[data-field="'+check.field+'"]').setChecked(check.checked);report.checks++;}
   if(lesson.key==='15.1'){
    await scene.locator('[data-save]').click();assert.match(await scene.textContent(),/Скрыто до фиксации/);
    await scene.locator('[data-field="note"]').fill('До раскрытия подтверждения нет; наблюдаю.');await scene.locator('[data-save]').click();
    assert.equal(await scene.locator('[data-field="note"]').getAttribute('readonly'),'');assert.match(await scene.textContent(),/Цена 103; входа не было/);report.journal=true;
   }
   const source=await p.evaluate(key=>{
    const lesson=TRADING_COURSE_V1.lessons.find(l=>l.key===key),root=document.querySelector('[data-studio-root]');let count=0;
    for(const [i,item] of (lesson.content.interactiveLesson.sourceExercises||[]).entries()){
     const details=root.querySelectorAll('.as-source-case')[i];details.open=true;
     for(const correct of [false,true]){const choice=item.choices.findIndex(c=>!!c.correct===correct);if(choice<0)throw new Error(key+' missing source answer');details.querySelector('input[value="'+choice+'"]').checked=true;details.querySelector('[data-as-check-source]').click();const result=details.querySelector('[role=status]').textContent;if(!result.startsWith(correct?'Верно. ':'Проверь рассуждение. ')||!result.includes(item.choices[choice].feedback||''))throw new Error(key+' source feedback mismatch '+i);}
     count++;
    }return count;
   },lesson.key);report.sourceCases+=source;
   assert.doesNotMatch(await scene.textContent(),/\b(?:NaN|Infinity|undefined)\b/);await close();
  }
  const picker=p.locator('#academyPreviewTheme'),themes=await picker.locator('option').evaluateAll(ns=>ns.map(n=>n.value));assert.equal(themes.length,18);
  for(const theme of themes){await picker.selectOption(theme);assert.equal(await p.locator('body').getAttribute('data-theme'),theme);report.themePicker++;}
  await picker.selectOption('paper');await open('2.1');await p.locator('[data-as-tab="notes"]').click();await p.locator('[data-as-notes]').fill('Несохранённый конспект при смене темы');
  const before=await p.evaluate(()=>({state:activeLearningModel.state,notes:document.querySelector('[data-as-notes]').value}));
  await p.evaluate(()=>{document.body.className='theme-inkgold';document.body.dataset.theme='inkgold';});
  const after=await p.evaluate(()=>({state:activeLearningModel.state,notes:document.querySelector('[data-as-notes]').value}));assert.deepEqual(after,before);await close();
  assert.deepEqual(errors,[]);assert.deepEqual(database,[]);console.log(JSON.stringify({...report,lessons:81,themeChangeKeepsState:true,errors,database}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
