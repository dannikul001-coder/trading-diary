(function(){
  'use strict';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const originalRender=window.CourseAcademy.render;
  let mode='course',selectedId=null,lastOptions={};
  const course=()=>window.TRADING_COURSE_V1;
  function diagram(lesson){
    const m=lesson.content.interactiveLesson,values=m.bars.slice(0,12),min=Math.min(...values.map(b=>b.l))-2,max=Math.max(...values.map(b=>b.h))+2,y=v=>25+(max-v)/(max-min)*145;
    const zone=m.zone?`<rect class="ar-zone" x="24" y="${y(m.zone.high)}" width="472" height="${Math.max(4,y(m.zone.low)-y(m.zone.high))}"/><text x="28" y="${y(m.zone.high)-5}">${esc(m.zone.label)}</text>`:'';
    const bars=values.map((b,i)=>{const x=34+i*39;return `<g class="${b.c>=b.o?'ar-up':'ar-down'}"><line x1="${x}" x2="${x}" y1="${y(b.h)}" y2="${y(b.l)}"/><rect x="${x-6}" y="${y(Math.max(b.o,b.c))}" width="12" height="${Math.max(2,Math.abs(y(b.o)-y(b.c)))}" rx="2"/></g>`;}).join('');
    return `<svg viewBox="0 0 520 200" class="ar-diagram" role="img" aria-label="Учебная схема: ${esc(m.concept)}">${zone}${bars}<text x="24" y="190">Учебная схема · движение цены слева направо</text></svg>`;
  }
  function render(options={}){
    lastOptions=options;originalRender(options);
    const {category='all',search='',progress={}}=options,all=course().lessons;
    const allLabel=document.querySelector('[data-course-module="all"] small');if(allLabel)allLabel.textContent=`${all.length} уроков · ${course().program.length} модулей`;
    const moduleId=category.startsWith('course:')?category.slice(7):'all';
    const lessons=all.filter(l=>(moduleId==='all'||l.moduleId===moduleId)&&`${l.title} ${l.content.interactiveLesson.guide.terms}`.toLowerCase().includes(search.toLowerCase()));
    const grid=document.getElementById('trainingLessonGrid');if(!grid)return;
    const shell=document.querySelector('#view-training .learning-shell');shell?.classList.add('academy-library');
    const toolbar=document.querySelector('#view-training .learning-filterbar');if(toolbar)toolbar.innerHTML=`<nav class="ar-modes" aria-label="Раздел обучения">${[['course','Учебный путь'],['practice','Практика'],['reference','Справочник']].map(([id,label])=>`<button type="button" data-ar-mode="${id}" aria-pressed="${mode===id}" class="${mode===id?'active':''}">${label}</button>`).join('')}</nav><span class="ar-format">Теория + модели · без видео</span>`;
    const label=document.getElementById('trainingResultCount');if(label)label.textContent=`${lessons.length} ${mode==='reference'?'тем':'уроков'}`;
    grid.className='ar-content';
    if(mode==='reference'){
      const active=lessons.find(l=>l.id===selectedId)||lessons[0];
      grid.innerHTML=active?`<section class="ar-reference"><header><span class="eyebrow">СПРАВОЧНИК С УЧЕБНЫМИ СХЕМАМИ</span><h3>Найди понятие и посмотри пример</h3><p>Выбери тему. Краткое объяснение, схема и подробный урок находятся рядом.</p></header><div class="ar-term-chips">${lessons.map(l=>`<button type="button" data-ar-term="${l.id}" aria-pressed="${l.id===active.id}">${esc(l.content.interactiveLesson.concept)}</button>`).join('')}</div><article class="ar-definition"><div><span class="eyebrow">${active.key} / КРАТКО И НАГЛЯДНО</span><h3>${esc(active.content.interactiveLesson.concept)}</h3><p>${esc(active.content.interactiveLesson.guide.plain)}</p><details><summary>Термины простыми словами</summary><p>${esc(active.content.interactiveLesson.guide.terms)}</p></details><button class="primary-btn" data-training-open="${active.id}">Разобрать в интерактивном уроке →</button></div><figure>${diagram(active)}<figcaption>Схема помогает увидеть понятие. Продолжение и практика — внутри урока.</figcaption></figure></article></section>`:'<p class="empty-inline">Тем по запросу нет. Попробуй другое слово.</p>';
    }else{
      grid.innerHTML=course().program.map((module,index)=>{const list=lessons.filter(l=>l.moduleId===module.id);if(!list.length)return '';return `<section class="ar-chapter"><header><span>ГЛАВА ${String(index+1).padStart(2,'0')}</span><h3>${esc(module.title)}</h3><small>${list.filter(l=>progress[l.id]?.status==='completed').length} / ${list.length} пройдено</small></header><div>${list.map(l=>{const done=progress[l.id]?.status==='completed';return `<article class="ar-lesson-row course-program-card is-available"><span class="ar-row-index ${done?'done':''}">${done?'✓':l.key}</span><div><h4>${esc(l.title)}</h4><p>${esc(l.content.interactiveLesson.guide.goal)}</p><small>${mode==='practice'?'Самостоятельный разбор · скрытое продолжение':'Объяснение → схема → действие → практика'}</small></div><button type="button" class="secondary-btn" ${mode==='practice'?`data-ar-practice="${l.id}"`:`data-training-open="${l.id}"`}>${mode==='practice'?'Решить':done?'Повторить':'Открыть'} <span aria-hidden="true">→</span></button></article>`;}).join('')}</div></section>`;}).join('')||'<p class="empty-inline">Уроков по запросу нет.</p>';
    }
    const feature=document.getElementById('trainingFeature');if(feature)feature.hidden=mode!=='course';
  }
  document.addEventListener('click',async event=>{
    const tab=event.target.closest('[data-ar-mode]');if(tab){mode=tab.dataset.arMode;render(lastOptions);return;}
    const term=event.target.closest('[data-ar-term]');if(term){selectedId=term.dataset.arTerm;render(lastOptions);return;}
    const practice=event.target.closest('[data-ar-practice]');if(practice){await window.openTrainingLesson(practice.dataset.arPractice);window.activeLearningModel?.goToPractice?.();}
  });
  window.CourseAcademy.render=render;
  window.CourseLibrary={diagram};
})();
