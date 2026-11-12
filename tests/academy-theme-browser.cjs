const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const {chromium}=require(path.join(process.env.TD_NODE_MODULES||'C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1110-973-0_26.1110.973.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules','playwright'));
const repo=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(repo,'index.html'),'utf8');
const themes=[...new Set([...html.matchAll(/data-appearance-preset="([a-z]+)"/g)].map(m=>m[1]))];
const app=fs.readFileSync(path.join(repo,'js/app.js'),'utf8'),literal=app.match(/function applyAppearancePreset\(name\)\{\s*const presets=(\{[\s\S]*?\n  \});/)[1],presets=vm.runInNewContext('('+literal+')');
assert.deepEqual(themes.slice().sort(),Object.keys(presets).sort());
const requested=(process.env.TD_THEME_NAMES||'').split(',').filter(Boolean),selected=requested.length?requested:themes;
const widths=process.env.TD_THEME_WIDTHS?process.env.TD_THEME_WIDTHS.split(',').map(Number):[320,1440];
const mode=process.env.TD_THEME_MODE||'saved';
function inspectStyles(selector){
 const root=document.querySelector(selector),canvas=document.createElement('canvas');canvas.width=canvas.height=1;
 const context=canvas.getContext('2d',{willReadFrequently:true}),colors=new Map(),backgrounds=new WeakMap(),failures=[];let texts=0,minimum=100;
 const color=value=>{if(colors.has(value))return colors.get(value);context.clearRect(0,0,1,1);context.fillStyle=value;context.fillRect(0,0,1,1);const p=context.getImageData(0,0,1,1).data,result=[p[0],p[1],p[2],p[3]/255];colors.set(value,result);return result;};
 const blend=(front,back)=>[...front.slice(0,3).map((v,i)=>v*front[3]+back[i]*(1-front[3])),1];
 const lum=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
 function bg(node){if(!node)return[255,255,255,1];if(backgrounds.has(node))return backgrounds.get(node);const value=blend(color(getComputedStyle(node).backgroundColor),bg(node.parentElement));backgrounds.set(node,value);return value;}
 function check(node,text){
  if(!node.checkVisibility()||!node.getClientRects().length||node.closest('[aria-hidden=true],:disabled'))return;
  const style=getComputedStyle(node),svg=node.namespaceURI==='http://www.w3.org/2000/svg';
  const fore=svg?style.fill:style.color;if(fore==='none'||fore==='transparent')return;
  let back=bg(node);
  if(svg){const chip=node.closest('.as-terminal-zone-chip,.as-ref-chip,.as-ref-price-tag'),previous=node.previousElementSibling;
   const mark=chip?.querySelector('.as-terminal-zone-label-bg,.as-ref-chip-bg')||(node.matches('.as-terminal-mark-text,.as-terminal-tag-text')&&previous?.matches('.as-terminal-mark,.as-terminal-price-tag')?previous:null);
   if(mark)back=blend(color(getComputedStyle(mark).fill),back);
  }
  const a=lum(blend(color(fore),back)),b=lum(back),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05),size=parseFloat(style.fontSize),weight=parseInt(style.fontWeight)||400;
  const threshold=size>=24||size>=18.66&&weight>=700?3:4.5;texts++;minimum=Math.min(minimum,ratio);
  if(ratio+.02<threshold)failures.push({text:text.slice(0,65),tag:node.tagName,class:typeof node.className==='string'?node.className:node.className.baseVal,foreground:fore,background:back.slice(0,3),contrast:+ratio.toFixed(2),required:threshold});
 }
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);for(let node;node=walker.nextNode();)if(node.textContent.trim())check(node.parentElement,node.textContent.trim());
 for(const input of root.querySelectorAll('input:not([type=radio]):not([type=checkbox]):not([type=range]),select,textarea'))if(input.value)check(input,input.value);
 return{texts,minimum:+minimum.toFixed(2),failures};
}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.TD_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--allow-file-access-from-files']});
 const all=[],errors=[],database=[];
 try{
  const page=await browser.newPage({viewport:{width:390,height:1000},reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/supabase\.(co|in)/.test(r.url()))database.push(r.url());});
  await page.goto(process.argv[2]||pathToFileURL(path.join(repo,'academy-preview.html')).href);await page.locator('[data-as-journey]').first().waitFor();
  for(const width of widths)for(const theme of selected){
   assert(themes.includes(theme));await page.setViewportSize({width,height:1000});
   await page.evaluate(({theme,accent,mode,width})=>{document.body.className='theme-'+theme+(mode==='saved'&&accent!=='teal'?' accent-'+accent:'');document.body.dataset.theme=theme;window.currentUser={id:'theme-audit-'+mode+'-'+theme+'-'+width};renderCourseV1View();},{theme,accent:presets[theme].accent,mode,width});
   const expected=await page.evaluate(()=>{const style=getComputedStyle(document.body);return{bg:style.getPropertyValue('--site-primary').trim(),panel:style.getPropertyValue('--site-secondary').trim()};});
   const route=await page.evaluate(inspectStyles,'.as-reference-route'),lessons=await page.evaluate(keys=>TRADING_COURSE_V1.lessons.filter(l=>!keys.length||keys.includes(l.key)).map(l=>({id:l.id,key:l.key})),(process.env.TD_THEME_LESSONS||'').split(',').filter(Boolean)),failures=[];let texts=route.texts;
   if(route.failures.length)failures.push({key:'route',stage:'catalog',issues:route.failures.slice(0,12)});
   for(const lesson of lessons){
    await page.evaluate(id=>openTrainingLesson(id),lesson.id);
    assert.equal(await page.locator('[data-studio-root]').evaluate(n=>getComputedStyle(n).getPropertyValue('--as-bg').trim()),expected.bg,'lesson does not follow '+theme);
    for(const phase of ['theory','examples','practice','notes']){
     await page.evaluate(phase=>{const root=document.querySelector('[data-studio-root]');if(phase==='theory'){const steps=root.querySelectorAll('[data-as-step]');steps[steps.length-1].click();}else root.querySelector('[data-as-tab="'+phase+'"]').click();if(phase==='examples')for(const details of root.querySelectorAll('[data-as-reference] details'))details.open=true;},phase);
     const audit=await page.evaluate(inspectStyles,'[data-studio-root]');texts+=audit.texts;
     if(audit.failures.length)failures.push({key:lesson.key,stage:phase,issues:audit.failures.slice(0,12)});
     const overflow=await page.locator('[data-studio-root]').evaluate(n=>n.scrollWidth>n.clientWidth+1?Array.from(n.querySelectorAll('*')).filter(e=>{const r=e.getBoundingClientRect(),p=n.getBoundingClientRect();return r.width&&r.right>p.right+2}).slice(0,5).map(e=>({tag:e.tagName,class:typeof e.className==='string'?e.className:e.className.baseVal,text:e.textContent.slice(0,60)})):null);if(overflow)failures.push({key:lesson.key,stage:phase,error:'horizontal overflow',elements:overflow});
    }
    await page.evaluate(()=>closeModal());
   }
   const report={theme,mode,width,lessons:lessons.length,texts,failures};all.push(report);console.log(JSON.stringify({...report,failures:failures.slice(0,5)}));
  }
  if(process.env.TD_THEME_REPORT)fs.writeFileSync(process.env.TD_THEME_REPORT,JSON.stringify({runs:all,errors,database},null,2));
  assert.deepEqual(errors,[]);assert.deepEqual(database,[]);const failures=all.flatMap(r=>r.failures.map(f=>({theme:r.theme,width:r.width,...f})));assert.equal(failures.length,0,JSON.stringify(failures.slice(0,5)));
  console.log('PASS: all selected themes, every lesson, four material views, source exercises, text contrast and responsive geometry');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
