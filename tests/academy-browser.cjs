// Browser verification with explicit device metrics (headless Chrome otherwise
// clamps window sizes below 500px). Uses the installed browser and native CDP.
const {spawn}=require('node:child_process');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const {pathToFileURL}=require('node:url');
const browser=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
if(!browser)throw new Error('An installed Chrome or Edge is required.');
const width=Number(process.argv[2]||390),manual=process.argv.includes('--screenshot'),integration=process.argv.includes('--integration');
const theme=process.argv.find(a=>a.startsWith('--theme='))?.slice(8)||'midnight';
const sampleLesson=process.argv.find(a=>a.startsWith('--lesson='))?.slice(9)||'1.1';
if(!/^\d+\.\d+$/.test(sampleLesson))throw new Error('Invalid lesson key');
if(!/^[a-z]+$/.test(theme))throw new Error('Invalid theme');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'td-model-cdp-'));
const child=spawn(browser,['--headless=new','--disable-gpu','--no-first-run','--allow-file-access-from-files','--remote-debugging-port=0','--user-data-dir='+temp,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let socket;
(async()=>{
  const endpoint=await new Promise((resolve,reject)=>{let buffer='';const timer=setTimeout(()=>reject(new Error('Browser did not start')),15000);child.stderr.on('data',chunk=>{buffer+=chunk;const match=buffer.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timer);resolve(match[1]);}});child.on('error',reject);});
  socket=new WebSocket(endpoint);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  let seq=0;const pending=new Map();socket.onmessage=event=>{const result=JSON.parse(event.data);if(!result.id)return;const callback=pending.get(result.id);if(callback){pending.delete(result.id);result.error?callback.reject(new Error(JSON.stringify(result.error))):callback.resolve(result.result);}};
  const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
  const target=await send('Target.createTarget',{url:'about:blank'}),{sessionId}=await send('Target.attachToTarget',{targetId:target.targetId,flatten:true});
  const cdp=(method,params)=>send(method,params,sessionId);
  await cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<700});
  await cdp('Page.enable');
  await cdp('Page.addScriptToEvaluateOnNewDocument',{source:`addEventListener('DOMContentLoaded',()=>{document.body.classList.add('theme-${theme}');});`});
  const url=pathToFileURL(path.join(__dirname,integration?'course-shell-preview.html':'academy-models.html')).href+(manual?'?lesson='+encodeURIComponent(sampleLesson):'?audit=1');await cdp('Page.navigate',{url});
  const evaluate=async expression=>(await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value;
  let result;
  if(manual&&process.argv.includes('--chart'))await evaluate('new Promise(resolve=>{const timer=setInterval(()=>{const el=document.querySelector(".ml-visual");if(el){clearInterval(timer);el.scrollIntoView({block:"start"});resolve(true);}},50);})');
  if(manual&&process.argv.includes('--lab'))await evaluate('new Promise((resolve,reject)=>{let tries=0;const timer=setInterval(()=>{const el=document.querySelector(".ml-lab");if(el){clearInterval(timer);el.scrollIntoView({block:"start"});resolve(true);}else if(++tries>100){clearInterval(timer);reject(new Error("Lesson lab not found"));}},50);})');
  for(let i=0;i<150;i++){result=await evaluate('({ready:document.body?.dataset.auditReady,error:document.body?.dataset.auditError,audit:document.body?.dataset.audit,model:!!document.querySelector("[data-model-root]")})');if(manual?result.model:result.ready)break;await new Promise(resolve=>setTimeout(resolve,100));}
  if(integration){
    const check=await evaluate(`(async()=>{
      const check=(condition,message)=>{if(!condition)throw new Error(message);};
      if(window.AcademyStudio){
        check(document.querySelectorAll('[data-as-journey]').length===8,'Eight skill stages');
        const lesson=TRADING_COURSE_V1.lessons.find(l=>l.key==='1.1');await openTrainingLesson(lesson.id);
        const find=s=>document.querySelector('#modalContent '+s);check(!!find('[data-studio-root]'),'Studio mount');
        find('[data-as-notes]').value='Сохранённый конспект';find('[data-as-save]').click();await new Promise(r=>setTimeout(r,0));find('[data-as-step="2"]').click();await new Promise(r=>setTimeout(r,0));await openTrainingLesson(lesson.id);
        check(find('[data-as-notes]').value==='Сохранённый конспект','Studio notes persistence');check(activeLearningModel.state.step===2,'Studio resume');
        window.currentUser={id:'second-synthetic-account'};check(!courseV1Progress()[lesson.id],'Studio account isolation');
        return {integration:true,studio:true,notes:true,resume:true,accountIsolation:true};
      }
      const expected=window.TRADING_COURSE_V1.lessons.length;document.querySelector('[data-ar-mode="reference"]').click();check(!!document.querySelector('.ar-diagram'),'Reference diagram');check(document.querySelectorAll('[data-ar-term]').length===expected,'Reference topics');document.querySelectorAll('[data-ar-term]')[3].click();check(document.querySelector('.ar-definition h3').textContent.includes('Четыре'),'Reference selection');document.querySelector('[data-ar-mode="practice"]').click();check(document.querySelectorAll('[data-ar-practice]').length===expected,'Practice routes');document.querySelector('[data-ar-mode="course"]').click();check(document.querySelectorAll('.ar-chapter').length===16,'Course chapters');
      const id=window.TRADING_COURSE_V1.lessons[0].id;
      document.querySelector('[data-ar-mode="practice"]').click();document.querySelector('[data-ar-practice]').click();await new Promise(r=>setTimeout(r,0));check(!!document.querySelector('#modalContent [data-ml-answer]'),'Direct practice route failed');document.querySelector('[data-ar-mode="course"]').click();
      localStorage.removeItem(courseV1ProgressKey());await openTrainingLesson(id);
      const find=s=>document.querySelector('#modalContent '+s);
      for(let i=0;i<3;i++)find('[data-ml-next]').click();
      find('[data-ml-notes]').value='Сохранённый конспект';find('[data-ml-save]').click();await new Promise(r=>setTimeout(r,0));
      await openTrainingLesson(id);check(find('[data-ml-notes]').value==='Сохранённый конспект','Notes did not persist');check(window.activeLearningModel.state.step===3,'Resume step');
      find('[data-ml-next]').click();find('input[name="ml-practice"]').checked=true;find('[data-ml-answer]').click();
      const m=window.TRADING_COURSE_V1.lessons[0].content.interactiveLesson;m.quiz.forEach((q,i)=>{find('input[name="ml-q-'+i+'"][value="'+q.choices.findIndex(c=>c.correct)+'"]').checked=true;});find('[data-ml-quiz]').dispatchEvent(new Event('submit',{cancelable:true}));find('[data-ml-complete]').click();await new Promise(r=>setTimeout(r,0));
      check(courseV1Progress()[id].status==='completed','Completion persistence');find('[data-ml-save]').click();await new Promise(r=>setTimeout(r,0));check(courseV1Progress()[id].status==='completed','Notes must not downgrade completion');
      window.currentUser={id:'second-synthetic-account'};check(!courseV1Progress()[id],'Account progress leaked');window.currentUser={id:'academy-preview'};check(courseV1Progress()[id].status==='completed','Original account lost progress');
      return {integration:true,notes:true,resume:true,completed:true,accountIsolation:true};
    })()`);
    if(!check?.integration)throw new Error('Integration failed: '+JSON.stringify(check));console.log(JSON.stringify(check));
  }else if(manual){await new Promise(resolve=>setTimeout(resolve,800));const {data}=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});const output=path.join(os.tmpdir(),'trading-academy-'+width+'-'+theme+'.png');fs.writeFileSync(output,Buffer.from(data,'base64'));console.log(output);}else{if(result.ready!=='true')throw new Error(result.error||'Audit did not finish');const audit=JSON.parse(result.audit);if(audit.passed!==audit.expected||audit.expected<73||audit.mobileWidth!==width)throw new Error(JSON.stringify(audit));console.log(JSON.stringify({...audit,theme}));}
  await send('Browser.close');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{socket?.close();child.kill();await new Promise(resolve=>setTimeout(resolve,300));const resolved=path.resolve(temp),root=path.resolve(os.tmpdir())+path.sep;if(resolved.startsWith(root)&&path.basename(resolved).startsWith('td-model-cdp-')){try{fs.rmSync(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:100});}catch{}}});
