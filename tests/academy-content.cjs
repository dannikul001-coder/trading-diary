const {test}=require('node:test');const assert=require('node:assert/strict');global.window={};require('../learning/course-v1.js');require('../learning/course-models.js');require('../learning/course-guides.js');require('../learning/course-extension.js');const course=window.TRADING_COURSE_V1;
test('Every program entry has a complete distinct model lesson',()=>{
  const entries=course.program.flatMap(m=>m.lessons);assert.equal(entries.length,72);assert.equal(course.lessons.length,72);assert.equal(new Set(course.lessons.map(l=>l.id)).size,72);assert.equal(new Set(course.lessons.map(l=>l.excerpt)).size,72);
  for(const entry of entries){const lesson=course.lessons.find(l=>l.key===entry.id);assert.ok(lesson,entry.id);const m=lesson.content.interactiveLesson;assert.equal(m.stages.length,4);assert.ok(m.stages.every(s=>s.body.trim()&&s.task.trim()));assert.ok(m.quiz.length>=2);for(const q of [m.practice,...m.quiz])assert.equal(q.choices.filter(c=>c.correct).length,1);}
});
test('Candles, blind futures and aggregation obey price invariants',()=>{
  for(const l of course.lessons){const m=l.content.interactiveLesson;for(const set of [m.bars,m.alternate,m.practiceBars,m.practiceAlternate,m.aggregate])for(const c of set){assert.ok(Object.values(c).every(Number.isFinite),l.key);assert.ok(c.h>=Math.max(c.o,c.c)&&c.l<=Math.min(c.o,c.c)&&c.h>=c.l,l.key);}
    assert.notDeepEqual(m.practiceBars,m.bars,'Practice cannot replay the already revealed theory');assert.deepEqual(m.practiceBars.slice(0,10),m.practiceAlternate.slice(0,10),'Alternate futures must share the same known prefix');assert.deepEqual(m.bars.slice(0,12),m.alternate.slice(0,12),'Theory alternatives cannot rewrite their shared past');
    m.aggregate.forEach((b,i)=>{const g=m.bars.slice(i*3,i*3+3);assert.equal(b.o,g[0].o);assert.equal(b.c,g.at(-1).c);assert.equal(b.h,Math.max(...g.map(x=>x.h)));assert.equal(b.l,Math.min(...g.map(x=>x.l)));});
  }
});
test('Module dependencies point to earlier modules',()=>{course.program.forEach((m,i)=>m.dependsOn.forEach(id=>assert.ok(course.program.findIndex(x=>x.id===id)<i)));});
