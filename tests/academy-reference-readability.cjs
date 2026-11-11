const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const {chromium}=require(path.join(process.env.TD_NODE_MODULES||'C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1110-973-0_26.1110.973.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules','playwright'));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.TD_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--allow-file-access-from-files']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:900},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.argv[2]||pathToFileURL(path.join(__dirname,'../academy-preview.html')).href);
  const report=await page.evaluate(async()=>{
   const rgb=s=>{const parts=s.match(/[\d.]+/g).map(Number);return [...parts.slice(0,3),parts[3]??1];};
   const mix=(a,b)=>a.slice(0,3).map((v,i)=>v*a[3]+b[i]*(1-a[3]));
   const lum=color=>color.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
   function background(node){const chain=[];for(let n=node;n;n=n.parentElement)chain.push(n);return chain.reverse().reduce((color,n)=>mix(rgb(getComputedStyle(n).backgroundColor),color),[255,255,255]);}
   const failures=[];let checked=0;
   for(const lesson of TRADING_COURSE_V1.lessons){
    await openTrainingLesson(lesson.id);const root=document.querySelector('[data-studio-root]'),entry=TD_STUDIO_LESSONS[lesson.key];
    root.querySelector(`[data-as-step="${entry.stages.length-1}"]`).click();
    for(const node of root.querySelectorAll('td,th,input:not([type=radio]):not([type=checkbox]):not([type=range]),textarea,select')){
     if(!node.getClientRects().length||!node.textContent.trim()&&!('value' in node))continue;
     const text=rgb(getComputedStyle(node).color),bg=background(node),a=lum(mix(text,bg)),b=lum(bg),contrast=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);checked++;
     if(contrast<4.5)failures.push({key:lesson.key,text:node.textContent.trim().slice(0,50),foreground:getComputedStyle(node).color,contrast});
    }
    closeModal();
   }
   return{checked,failures};
  });
  assert.ok(report.checked>60,'actual financial cells were not checked');assert.deepEqual(report.failures,[]);
  for(const width of [320,390,1440]){
   await page.setViewportSize({width,height:900});await page.evaluate(()=>openTrainingLesson(TRADING_COURSE_V1.lessons.find(l=>l.key==='2.1').id));
   for(let step=0;step<4;step++){
    await page.locator(`[data-as-step="${step}"]`).click();
    const overlaps=await page.locator('[data-as-scene]').evaluate(n=>{
     const box=e=>e.getBoundingClientRect(),chips=Array.from(n.querySelectorAll('.as-terminal-zone-label-bg'),box),marks=Array.from(n.querySelectorAll('.as-terminal-mark'),box);
     return chips.flatMap((a,i)=>marks.filter(b=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1).map(()=>i));
    });assert.deepEqual(overlaps,[],`zone label overlaps marker at ${width}, step ${step}`);
   }
   await page.locator('[data-tc-annotations]').scrollIntoViewIfNeeded();
   const geometry=await page.evaluate(()=>{
    const modal=document.querySelector('.modal'),content=document.getElementById('modalContent').getBoundingClientRect(),button=document.querySelector('[data-tc-annotations]').getBoundingClientRect(),close=document.querySelector('.modal-close').getBoundingClientRect(),header=getComputedStyle(modal,'::before');
    const headerHeight=parseFloat(header.height)+(header.boxSizing==='border-box'?0:parseFloat(header.paddingTop)+parseFloat(header.paddingBottom)+parseFloat(header.borderBottomWidth));
    return{headerBottom:modal.getBoundingClientRect().top+headerHeight,contentTop:content.top,buttonTop:button.top,closeBottom:close.bottom};
   });
   assert.ok(geometry.headerBottom<=geometry.contentTop+1,JSON.stringify({width,...geometry}));
   assert.ok(geometry.closeBottom<=geometry.buttonTop,JSON.stringify({width,...geometry}));
   await page.locator('.modal-close').click();
  }
  assert.deepEqual(errors,[]);console.log(JSON.stringify({contrast:report.checked,minimumRatio:4.5,all81:true,zoneMarkerOverlaps:0,header:'does not cover controls at 320/390/1440',errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
