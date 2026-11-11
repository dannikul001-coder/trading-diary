const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const context=vm.createContext({window:{},structuredClone});
const files=[...read('index.html').matchAll(/<script\s+src="(learning\/course-[^"]+\.js)"/g)].map(m=>m[1]);
for(const file of files)vm.runInContext(read(file),context,{filename:file});
if(!files.includes('learning/course-book-review-b.js'))vm.runInContext(read('learning/course-book-review-b.js'),context);
const course=context.window.TRADING_COURSE_V1,report=JSON.parse(read('learning/book-review.json'));
const all=Array.from(course.lessons).flatMap(l=>(l.content.interactiveLesson.sourceExercises||[]).map(x=>({key:l.key,...x}))),cases=all.filter(x=>x.id?.startsWith('book-b-'));
test('clean course-module load includes eight distinct, actionable early-book cases',()=>{
 assert.equal(course.lessons.length,81);assert.equal(cases.length,8);
 assert.deepEqual(cases.map(x=>x.key).sort(),['7.1','7.2','7.3','15.1','15.2','15.3','15.5','15.6'].sort());
 for(const c of cases){assert.equal(c.choices.filter(x=>x.correct).length,1);assert.ok(c.question&&c.choices.every(x=>x.text&&x.feedback));assert.equal(all.filter(x=>x.title===c.title).length,1,c.title);assert.equal(all.filter(x=>x.question===c.question).length,1,c.question);const record=report.adaptationB.cases.find(x=>x.id===c.id);assert.ok(record);assert.equal(record.lesson,c.key);assert.equal(JSON.stringify(record.physicalPages),JSON.stringify(c.source.physicalPages));assert.equal(c.source.review,'b');}
 const expected={'book-b-01':/Описание рисунка/,'book-b-02':/касание незавершённой/,'book-b-03':/Подходящих событий/,'book-b-04':/по подсказке/,'book-b-05':/после исходной отмены/,'book-b-06':/Была ли команда исполнена/,'book-b-07':/Close 102/,'book-b-08':/не задаёт готовую торговую систему/};
 for(const c of cases)assert.match(c.choices.find(x=>x.correct).text,expected[c.id]);
});
test('aggregate coverage is sourced from three complete reviews of the same PDF without page gaps',()=>{
 const a=JSON.parse(read('learning/book-review-a.json')),c=JSON.parse(read('learning/book-review-c.json'));
 assert.equal(report.complete,true);assert.equal(a.complete,true);assert.equal(c.complete,true);
 assert.equal(report.source.sha256,a.sourceSha256);assert.equal(report.source.sha256,c.sourceSha256);assert.equal(report.source.sha256,report.aggregate.sourceSha256);
 const actual=[...report.ownReadPageRanges,...a.readPageRanges,...c.readPageRanges],counts=Array(241).fill(0);
 for(const [lo,hi] of actual)for(let p=lo;p<=hi;p++)counts[p]++;
 assert.equal(counts.slice(1).length,240);assert.ok(counts.slice(1).every(n=>n===1));assert.deepEqual(report.readPageRanges,[[1,240]]);assert.equal(report.aggregate.physicalPagesReviewed,240);assert.deepEqual(report.aggregate.missingPhysicalPages,[]);
 for(let i=0;i<3;i++)assert.deepEqual(report.aggregate.parts[i].physicalPages,actual[i]);
 assert.ok(report.aggregate.visualEvidence.some(x=>x.pages.includes(217)));assert.equal(report.pending.length,0);assert.equal(report.adaptationB.rawTextPublished,false);
 assert.match(report.completeScope,/не утверждение/);assert.match(report.aggregate.limitations.join(' '),/не предлагает готовой торговой системы/);
});
test('book B is idempotent and publishes no private paths or extracted pages',()=>{
 vm.runInContext(read('learning/course-book-review-b.js'),context);
 assert.equal(course.lessons.flatMap(l=>l.content.interactiveLesson.sourceExercises||[]).filter(x=>x.id?.startsWith('book-b-')).length,8);
 assert.doesNotMatch(read('learning/course-book-review-b.js'),/C:\\|Данино|book-pages\.json|plugin:\/\//);
});
