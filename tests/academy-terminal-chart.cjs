const {test}=require('node:test'),assert=require('node:assert/strict');global.window={};require('../js/academy-terminal-chart.js');
test('Terminal axes enclose only supplied data and use a readable price interval',()=>{const bars=[{o:100,h:106,l:98,c:102},{o:102,h:108,l:101,c:107}],d=window.TDTerminalChart.domain(bars);assert(d.min<98);assert(d.max>108);assert(d.step>0);assert.equal(d.min/d.step,Math.round(d.min/d.step));assert.equal(d.max/d.step,Math.round(d.max/d.step));const short=window.TDTerminalChart.domain(bars.slice(0,1));const changedFuture=[bars[0],{o:102,h:1000,l:1,c:900}];assert.deepEqual(short,window.TDTerminalChart.domain(changedFuture.slice(0,1)));});
test('Flat and fractional prices retain a finite nonzero scale',()=>{for(const price of [100,.001,0,-5]){const d=window.TDTerminalChart.domain([{o:price,h:price,l:price,c:price}]);assert(Number.isFinite(d.min)&&Number.isFinite(d.max));assert(d.max>d.min);assert(d.min<price&&d.max>price);}});
test('Overlay scale includes known values without taking missing warmup as a price',()=>{const bars=[{o:100,h:103,l:99,c:102}],d=window.TDTerminalChart.domain(bars,[95,108]);assert(d.min<95);assert(d.max>108);});
const fixture=Array.from({length:40},(_,i)=>({o:100+i*.1,h:102+i*.1,l:99+i*.1,c:101+i*.1}));
test('view continuity preserves selection and scale only for known shared history',()=>{
 const api=window.TDTerminalChart,old={bars:fixture.slice(0,32),mode:'theory',selected:12,limit:24,annotations:false};
 assert.deepEqual(api.initialView(old,fixture,'theory'),{selected:12,limit:28,annotations:false,continuous:true});
 assert.equal(api.initialView(old,fixture,'practice').selected,39);assert.equal(api.initialView(old,fixture,'practice').annotations,true);
 const changed=fixture.map(b=>({...b}));changed[0].c=100;assert.equal(api.initialView(old,changed,'theory').continuous,false);
 const shrunk=api.initialView({...old,selected:30},fixture.slice(0,10),'theory');assert.equal(shrunk.selected,9);assert.equal(shrunk.limit,10);
 assert.equal(api.initialView(old,fixture,'theory',3).selected,3);
 assert.equal(api.initialView(null,fixture,'theory',undefined,100).limit,40);assert.equal(api.initialView(null,fixture,'theory',undefined,-3).limit,1);
 assert.equal(api.initialView({...old,zoomed:false},fixture,'theory',undefined,40).limit,40);assert.equal(api.initialView({...old,zoomed:true},fixture,'theory',undefined,40).limit,28);
 assert.equal(api.initialView({...old,probed:false},fixture,'theory').selected,39);assert.equal(api.initialView({...old,probed:true},fixture,'theory').selected,12);
});
test('multiple semantic areas retain legacy compatibility and reject invalid bounds',()=>{
 const areas=window.TDTerminalChart.zonesFor({zones:[{low:99,high:100,kind:'support'},{low:108,high:110,semantic:'resistance'},{low:5,high:1}],zone:{low:102,high:103,label:'Legacy'}});
 assert.equal(areas.length,3);assert.deepEqual(areas.map(z=>z.kind),['support','resistance','neutral']);assert.equal(areas[2].label,'Legacy');
});
test('browser: annotation toggle, keyboard, pointer, range and safe remount work at 320px',async t=>{
 const fs=require('node:fs'),path=require('node:path');let chromium;
 try{({chromium}=require(path.join(process.env.TD_NODE_MODULES||'C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1110-973-0_26.1110.973.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules','playwright')));}catch{return t.skip('Playwright not installed');}
 const executablePath=process.env.TD_BROWSER||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);if(!executablePath)return t.skip('No local browser');
 const browser=await chromium.launch({headless:true,executablePath});try{
  const page=await browser.newPage({viewport:{width:320,height:900},reducedMotion:'reduce'});
  await page.setContent('<div class="academy-studio" style="width:304px;--as-bg:#fff;--as-panel:#fff;--as-ink:#182b36;--as-line:#ddd;--as-muted:#65737f;--as-accent:#4565b3;--as-up:#169968;--as-down:#cc4858"><div data-as-scene data-mode="theory" id="chart"></div></div>');
  await page.addStyleTag({path:path.resolve(__dirname,'../academy-studio.css')});await page.addStyleTag({path:path.resolve(__dirname,'../academy-reference-chart.css')});await page.addScriptTag({path:path.resolve(__dirname,'../js/academy-terminal-chart.js')});
  await page.evaluate(bars=>{window.fixture=bars;window.mountChart=()=>{window.cleanup?.();window.cleanup=TDTerminalChart.mount(document.getElementById('chart'),{bars:fixture,zones:[{low:99,high:101,kind:'support',label:'Поддержка'},{low:105,high:107,kind:'resistance',label:'Сопротивление'}],levels:[{price:103,label:'Проверка'}],markers:[{index:30,price:104,label:'Касание'}],series:[{label:'Средняя',values:fixture.map(b=>b.c-.4)}]});};mountChart();},fixture.slice(0,32));
  assert.equal(await page.locator('.as-terminal-area').count(),2);assert.equal(await page.locator('.as-terminal-area-label').count(),3);
  await page.locator('[data-tc-all]').click();await page.locator('[data-tc-probe]').fill('5');await page.locator('svg').focus();await page.keyboard.press('ArrowRight');assert.match(await page.locator('[data-tc-index]').textContent(),/6/);
  await page.locator('[data-tc-annotations]').click();assert.equal(await page.locator('.as-terminal-area').count(),0);assert.equal(await page.locator('.as-terminal-mark').count(),0);assert.equal(await page.locator('.as-terminal-candle').count(),32);assert.equal(await page.locator('.as-terminal-series').count(),1);
  await page.evaluate(()=>{fixture=fixture.concat([{o:104,h:106,l:103,c:105}]);mountChart();});assert.match(await page.locator('[data-tc-index]').textContent(),/6/);assert.equal(await page.locator('[data-tc-annotations]').getAttribute('aria-pressed'),'false');
  await page.locator('svg').focus();await page.keyboard.press('Home');assert.match(await page.locator('[data-tc-index]').textContent(),/1/);await page.keyboard.press('End');assert.match(await page.locator('[data-tc-index]').textContent(),/33/);
  const box=await page.locator('svg').boundingBox();await page.mouse.move(box.x+30,box.y+130);assert.doesNotMatch(await page.locator('[data-tc-index]').textContent(),/33/);
  await page.locator('svg').press('End');
  await page.locator('[data-tc-in]').click();
  await page.locator('[data-tc-measure]').click();await page.locator('svg').press('ArrowLeft');
  assert.match(await page.locator('.as-chart-difference').textContent(),/№ 33 → № 32.*разница/);
  await page.locator('[data-tc-measure]').click();assert.equal(await page.locator('.as-chart-difference').isVisible(),false);
  const plot=page.locator('svg'),rightEdge=Number(await plot.getAttribute('data-last')),windowSize=await plot.evaluate(n=>Number(n.dataset.last)-Number(n.dataset.first));
  const view=await plot.boundingBox();
  await page.mouse.move(view.x+35,view.y+80);await page.mouse.down();
  await page.mouse.move(view.x+125,view.y+80,{steps:5});await page.mouse.up();
  assert(Number(await plot.getAttribute('data-last'))<rightEdge,'drag must reveal earlier candles');
  assert.equal(await plot.evaluate(n=>Number(n.dataset.last)-Number(n.dataset.first)),windowSize,'drag preserves zoom');
  await plot.press('PageUp');assert.equal(await plot.getAttribute('data-first'),'1');
  await plot.press('End');assert.equal(await plot.getAttribute('data-last'),'33');
  await page.evaluate(()=>{fixture=fixture.slice(0,8);document.getElementById('chart').dataset.mode='practice';mountChart();});assert.equal(await page.locator('.as-terminal-candle').count(),8);assert.match(await page.locator('[data-tc-index]').textContent(),/8/);assert.equal(await page.locator('[data-tc-annotations]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>320),false);assert.doesNotMatch(await page.locator('#chart').textContent(),/NaN|undefined|Infinity/);
 }finally{await browser.close();}
});
