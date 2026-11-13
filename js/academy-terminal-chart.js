(function(){
 'use strict';
 const NS='http://www.w3.org/2000/svg',memo=new WeakMap();let seq=0;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(v);
 const plotLabel=(text,width)=>{const s=String(text),n=Math.max(8,Math.floor((width-10)/7));return esc(s.length>n?s.slice(0,n-1)+'…':s);};
 const levelLabel=l=>{const label=String(l.label||'Уровень'),value=fmt(l.price);return label.endsWith(value)||label.endsWith(String(l.price))?label:label+' · '+value;};
 const zoneLabel=z=>{const range=fmt(z.low)+'–'+fmt(z.high),label=String(z.label||'Выделенная область');return label.includes(range)?label:label+': '+range;};
 const sameBar=(a,b)=>['o','h','l','c'].every(k=>a[k]===b[k]);
 function separateLabels(svg){
  const overlaps=(a,b)=>a.x<b.x+b.width+3&&a.x+a.width+3>b.x&&a.y<b.y+b.height+3&&a.y+a.height+3>b.y;
  const occupied=Array.from(svg.querySelectorAll('.as-terminal-mark')).map(n=>n.getBBox());
  const labels=Array.from(svg.querySelectorAll('[data-tc-area-labels]>.as-terminal-zone-chip,[data-tc-zones]>.as-terminal-area-label'));
  const height=svg.viewBox.baseVal.height;
  for(const label of labels){
   const box=label.getBBox(),offset=[0,-22,22,-44,44,-66,66,-88,88,-110,110,-132,132].find(dy=>box.y+dy>=8&&box.y+dy+box.height<=height-36&&!occupied.some(other=>overlaps({...box,x:box.x,y:box.y+dy,width:box.width,height:box.height},other)))??0;
   if(offset){const leader=document.createElementNS(NS,'line');leader.setAttribute('class','as-terminal-label-leader');for(const [name,value] of Object.entries({x1:box.x+3,x2:box.x+3,y1:box.y+box.height/2,y2:box.y+box.height/2+offset}))leader.setAttribute(name,value);label.parentNode.insertBefore(leader,label);label.setAttribute('transform','translate(0 '+offset+')');}
   occupied.push({x:box.x,y:box.y+offset,width:box.width,height:box.height});
  }
 }
 function initialView(old,bars,mode,focus,defaultLimit=24){
  const continuous=!!old&&old.mode===mode&&old.bars.slice(0,Math.min(old.bars.length,bars.length)).every((b,i)=>sameBar(b,bars[i]));
  const selected=Math.max(0,Math.min(bars.length-1,Number.isInteger(focus)?focus:continuous&&old.probed!==false&&Number.isInteger(old.selected)?old.selected:bars.length-1));
  const initial=Number.isFinite(defaultLimit)?Math.max(1,Math.min(bars.length,Math.floor(defaultLimit))):Math.min(24,bars.length);
  return {selected,limit:Math.min(bars.length,Math.max(continuous&&old.zoomed!==false?old.limit||initial:initial,bars.length-selected)),annotations:continuous?old.annotations!==false:true,continuous};
 }
 function zonesFor(options){return [...(Array.isArray(options.zones)?options.zones:[]),...(options.zone?[options.zone]:[])].filter(z=>z&&Number.isFinite(z.low)&&Number.isFinite(z.high)&&z.low<=z.high).map(z=>({...z,kind:['support','resistance'].includes(z.kind||z.semantic||z.type)?z.kind||z.semantic||z.type:'neutral'}));}
 function domain(bars,extra=[]){if(!bars.length&&!extra.length)return {min:0,max:100,step:25};const lo=Math.min(...bars.map(b=>b.l),...extra),hi=Math.max(...bars.map(b=>b.h),...extra),pad=Math.max((hi-lo)*.18,.5),raw=(hi-lo+2*pad)/4,pow=10**Math.floor(Math.log10(raw)),step=[1,2,5,10].find(n=>n*pow>=raw)*pow;return {min:Math.floor((lo-pad)/step)*step,max:Math.ceil((hi+pad)/step)*step,step};}
 function referenceDomain(bars,extra=[]){
  const values=[...bars.flatMap(b=>[b.l,b.h]),...extra].filter(Number.isFinite);if(!values.length)return{min:0,max:100,step:20};
  const lo=Math.min(...values),hi=Math.max(...values),span=hi-lo,pad=span?span*.06:Math.max(Math.abs(lo)*.002,1e-8),raw=(span+pad*2)/5,pow=10**Math.floor(Math.log10(raw)),step=[1,2,2.5,5,10].find(n=>n*pow>=raw)*pow;
  return{min:lo-pad,max:hi+pad,step};
 }
 function mount(host,rawOptions={}){
  const lessonKey=rawOptions.lessonKey||host.closest?.('[data-studio-root]')?.dataset.lessonKey;
  const options=rawOptions.authored&&window.TDChartReference?window.TDChartReference.decorate(rawOptions,lessonKey,{practice:['hidden','revealed'].includes(host.closest?.('[data-as-scene]')?.dataset.mode)}):rawOptions;
  const data=options.bars||[];if(!data.length||data.some(b=>!['o','h','l','c'].every(k=>Number.isFinite(b[k]))||b.h<Math.max(b.o,b.c)||b.l>Math.min(b.o,b.c)))throw new Error('Invalid terminal OHLC');
  const reference=!!options.authored&&options.chartRole!=='detail',ranges=data.map(b=>b.h-b.l).filter(n=>n>0).sort((a,b)=>a-b),typical=ranges[Math.floor(ranges.length/2)]||Math.abs(data[0].c)*.001||1;
  const precision=Number.isInteger(options.pricePrecision)?options.pricePrecision:Math.min(8,Math.max(2,Math.ceil(-Math.log10(typical))+1));
  const fmt=value=>new Intl.NumberFormat('ru-RU',{minimumFractionDigits:precision>=4?precision:0,maximumFractionDigits:precision}).format(value);

  const stable=host.closest?.('[data-as-scene]')||host,mode=stable.dataset?.mode||'theory',memory=memo.get(stable)||new Map(),memoryKey=options.id||'main',old=memory.get(memoryKey),id='terminal-clip-'+(++seq),view=initialView(old,data,mode,options.focus,host.clientWidth<480?(reference&&!(options.mobileLimit>50)?Math.min(options.mobileLimit||40,32):(options.mobileLimit??options.defaultLimit)):(reference?Math.min(options.defaultLimit||60,60):options.defaultLimit)),zones=zonesFor(options),indicator=options.mode==='indicator';let disposed=false,raf=0,limit=view.limit,selected=view.selected,annotations=view.annotations,width=0;
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  // A viewport moves within the supplied prefix. No interaction can extend that prefix.
  if(view.continuous && old.zoomed && Number.isInteger(old.start))limit=Math.min(data.length,old.limit);
  let start=clamp(view.continuous && old.zoomed && Number.isInteger(old.start)?old.start:data.length-limit,0,data.length-limit);
  function keepVisible(index){start=clamp(start,Math.max(0,index-limit+1),Math.min(index,data.length-limit));}
  keepVisible(selected);
  const reset=old?.mode!==mode||data.length<(old?.bars.length||0),canMove=old&&!reset&&(view.continuous||options.forming||old.forming||Number.isInteger(options.knownPrefixLength)&&old.bars.slice(0,Math.min(options.knownPrefixLength,old.bars.length,data.length)).every((b,i)=>sameBar(b,data[i])))&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
  let displayed=canMove?data.map((b,i)=>old.bars[i]||{o:b.o,h:b.o,l:b.o,c:b.o}):data;
  const targetSeries=options.series||[],seriesStart=targetSeries.map((series,j)=>({...series,values:series.values.map((v,i)=>{const prior=old?.series?.[j]?.values;return canMove&&Number.isFinite(v)&&prior?(Number.isFinite(prior[i])?prior[i]:i>=old.bars.length?prior.filter(Number.isFinite).at(-1)??v:v):v;})}));let displayedSeries=seriesStart;
  const saved={mode,forming:!!options.forming,series:targetSeries.map(s=>({...s,values:[...s.values]})),bars:data.map(b=>({...b})),selected,limit,annotations,zoomed:view.continuous&&old.zoomed===true,probed:view.continuous&&old.probed===true};memory.set(memoryKey,saved);memo.set(stable,memory);
  host.innerHTML=`<section class="as-terminal" aria-label="${esc(options.caption||'Учебный свечной график')}"><header class="as-terminal-head"><div><b>${esc(options.caption||'Учебный рынок')}</b><span>${indicator?'Индикатор':'Свечи'} · ${esc(options.intervalLabel||'один интервал на свечу')}</span></div><div class="as-terminal-zoom" aria-label="Масштаб графика"><button type="button" data-tc-out aria-label="Показать больше свечей">−</button><button type="button" data-tc-in aria-label="Увеличить свечи">+</button><button type="button" data-tc-all>Весь участок</button></div></header><div class="as-terminal-readout" aria-live="polite"></div><svg class="as-terminal-svg" role="img"><defs><clipPath id="${id}"><rect data-tc-clip/></clipPath></defs><g data-tc-grid></g><g data-tc-zones></g><g clip-path="url(#${id})" data-tc-candles></g><g data-tc-labels></g><g data-tc-focus></g></svg><div class="as-terminal-markers"></div><footer class="as-terminal-foot"><span><i class="as-terminal-dot as-terminal-up"></i>Закрытие выше начала</span><span><i class="as-terminal-dot as-terminal-down"></i>Закрытие ниже начала</span><span>Время → · Цена справа</span></footer><label class="as-terminal-probe">Выбрать свечу <output data-tc-index></output><input type="range" min="1" max="${data.length}" value="${selected+1}" step="1" aria-label="Выбрать свечу для чтения цен" data-tc-probe></label></section>`;
  const q=s=>host.querySelector(s),svg=q('svg'),nodes=indicator?[]:data.map(()=>{const g=document.createElementNS(NS,'g');g.innerHTML='<line/><rect/>';q('[data-tc-candles]').append(g);return g;});
  q('.as-terminal').dataset.chartRole=options.chartRole||'context';q('.as-terminal').dataset.authored=String(!!options.authored);
  q('.as-terminal').dataset.reference=String(reference);
  if(reference){
   const header=q('.as-terminal-head'),toolbar=q('.as-terminal-zoom'),instrument=document.createElement('span'),timeframe=document.createElement('span'),caption=document.createElement('b');
   header.classList.add('as-terminal-market-head');instrument.className='as-terminal-instrument';instrument.textContent=options.instrument||'Учебная модель';timeframe.className='as-terminal-timeframe';timeframe.textContent=options.timeframeLabel||(options.timeframeMinutes?'M'+options.timeframeMinutes:'Интервалы');caption.className='as-terminal-caption';caption.textContent=options.caption||'Учебный график';
   header.replaceChildren(instrument,timeframe,caption,toolbar);q('.as-terminal').dataset.timeframeMinutes=String(options.timeframeMinutes||'');
  }

  q('.as-terminal-zoom').insertAdjacentHTML('beforeend','<button type="button" data-tc-annotations aria-pressed="'+annotations+'">Разметка</button>');
  q('.as-terminal-probe').insertAdjacentHTML('beforebegin','<div class="as-terminal-navigation" role="group" aria-label="Перемещение по свечам"><button type="button" data-tc-prev aria-label="Предыдущая свеча">← Свеча</button><button type="button" data-tc-next aria-label="Следующая свеча">Свеча →</button></div>');
  svg.setAttribute('tabindex','0');svg.setAttribute('aria-keyshortcuts','ArrowLeft ArrowRight Home End');
  const areaLabels=document.createElementNS(NS,'g');areaLabels.setAttribute('data-tc-area-labels','');svg.append(areaLabels);
  if(data.length<=6)for(const s of ['[data-tc-in]','[data-tc-out]','[data-tc-all]'])q(s).hidden=true;
  if(data.length===1){q('.as-terminal-probe').hidden=true;q('.as-terminal-navigation').hidden=true;}
  if(data.length===1&&options.directOHLC)q('.as-terminal-readout').hidden=true;
  if(indicator)q('.as-terminal-foot').innerHTML='<span>Значения индикатора на закрытых свечах</span><span>Свеча → · шкала справа</span>';
  if(options.forming)q('.as-terminal-foot').innerHTML='<span><i class="as-terminal-dot as-terminal-up"></i>Зелёная: цена выше начала</span><span><i class="as-terminal-dot as-terminal-down"></i>Красная: цена ниже начала</span><span>Цена справа · время →</span>';
  if(reference){const note=document.createElement('span');note.textContent=(options.timeAxisLabel||'Учебное время')+' · '+(options.timeframeLabel||'Интервалы');q('.as-terminal-foot').lastElementChild.replaceWith(note);}
  let measureIndex=null;
  const valueAt=index=>indicator?targetSeries[0]?.values[index]:data[index].c;
  const measure=document.createElement('button');
  measure.type='button';measure.dataset.tcMeasure='';measure.textContent='Сравнить свечи';measure.setAttribute('aria-pressed','false');
  const difference=document.createElement('output');difference.className='as-chart-difference';difference.setAttribute('aria-live','off');
  if(data.length>1){
   q('.as-terminal-navigation').append(measure,difference);
   measure.onclick=()=>{
    measureIndex=measureIndex===null?selected:null;
    measure.setAttribute('aria-pressed',String(measureIndex!==null));
    measure.textContent=measureIndex===null?'Сравнить свечи':'Завершить сравнение';
    draw();
   };
  }
  function updateDifference(){
   difference.hidden=measureIndex===null;
   if(measureIndex===null)return;
   const from=valueAt(measureIndex),to=valueAt(selected),delta=to-from;
   const field=indicator?(targetSeries[0]?.label||'Значение'):(options.forming?'Цена':'Цена закрытия');
   difference.textContent=selected===measureIndex?'Начало на свече '+(measureIndex+1)+'. Выбери другую свечу.':
    Number.isFinite(from)&&Number.isFinite(to)?field+' · № '+(measureIndex+1)+' → № '+(selected+1)+' · '+fmt(from)+' → '+fmt(to)+' · разница '+(delta>0?'+':'')+fmt(delta):
    'Для выбранной пары ещё нет двух рассчитанных значений.';
  }
  let scale=null;
  function draw(){if(disposed||!host.isConnected)return;const actual=svg.getBoundingClientRect().width;if(actual<1)return;width=actual;
   const mobile=width<480,desk=!!host.closest('.as-reading-desk');
   const normalHeight=reference?(indicator?(mobile?280:320):(mobile?440:600)):(mobile?(options.mobileHeight||300):(options.height||360));
   const height=desk?Math.min(normalHeight,indicator?200:clamp(Math.round(width*.56),208,352)):normalHeight;
   const end=start+limit-1,visible=displayed.slice(start,end+1);
   const extras=[...displayedSeries.flatMap(series=>series.values.slice(start,end+1).filter(Number.isFinite)),...zones.flatMap(z=>[z.low,z.high]),...(options.levels||[]).map(l=>l.price).filter(Number.isFinite)];
   const d=options.bounded?{min:0,max:100,step:25}:(reference?referenceDomain:domain)(indicator?[]:visible,extras),left=reference?16:12,right=width-(reference?(mobile?66:92):66),top=reference?28:(options.markers?.length?48:22),bottom=height-38,plot=right-left;
   const hasInline=zones.some(z=>z.role&&z.role!=='neutral')||!!options.levels?.length,futureWidth=reference?(hasInline?Math.max(mobile?66:150,plot*.28):Math.max(24,plot*(mobile?.12:.08))):0,dataRight=right-futureWidth,annotationLeft=reference?dataRight+8:right,slots=Math.max(6,visible.length+(reference?.35:1.5)),dx=(dataRight-left)/slots;
   saved.selected=selected;saved.start=start;saved.limit=limit;
   updateDifference();svg.dataset.first=String(start+1);svg.dataset.last=String(end+1);saved.annotations=annotations;
   q('[data-tc-annotations]').setAttribute('aria-pressed',String(annotations));q('[data-tc-annotations]').disabled=!zones.length&&!options.levels?.length&&!options.markers?.length;q('[data-tc-candles]').style.display=indicator?'none':'';
   q('[data-tc-prev]').disabled=selected===0;q('[data-tc-next]').disabled=selected===data.length-1;
   q('.as-terminal-readout').hidden=data.length===1&&annotations&&!!options.directOHLC;q('.as-terminal-markers').hidden=false;
   const x=i=>visible.length===1?left+(dataRight-left)*.45:left+(i-start+.5)*dx,y=v=>top+(d.max-v)/(d.max-d.min)*(bottom-top);scale={start,dx,left,right,dataRight,x,y};svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.style.height=height+'px';svg.setAttribute('aria-label',`${options.caption||'Учебный график'}. Видно ${visible.length} свечей. Выбрана свеча ${selected+1}: начало ${fmt(data[selected].o)}, максимум ${fmt(data[selected].h)}, минимум ${fmt(data[selected].l)}, ${options.forming&&selected===data.length-1?'сейчас':'закрытие'} ${fmt(data[selected].c)}.`);
   const ticks=[];for(let v=reference?Math.ceil(d.min/d.step)*d.step:d.min;v<=d.max+d.step*.01;v+=d.step){const yy=y(v);ticks.push(`<line x1="${left}" x2="${right}" y1="${yy}" y2="${yy}"/><text x="${right+8}" y="${yy+4}">${fmt(v)}</text>`);}
   const hasTime=reference&&Number.isFinite(options.timeframeMinutes)&&Number.isFinite(Date.parse(options.startTime)),timeEnd=reference?end+Math.max(0,(right-dataRight)/dx):end;
   const time=reference?Array.from({length:mobile?3:6},(_,i)=>Math.round(start+(timeEnd-start)*i/((mobile?3:6)-1))):[start,Math.floor((start+end)/2),end];
   const uniqueTime=[...new Set(time)],timeLabel=i=>hasTime?new Date(Date.parse(options.startTime)+i*options.timeframeMinutes*60000).toISOString().slice(11,16):(width<340?'№':'Свеча ')+(i+1);
   q('[data-tc-grid]').innerHTML=ticks.join('')+uniqueTime.map((i,j)=>`<line class="as-ref-time-grid" x1="${x(i)}" x2="${x(i)}" y1="${top}" y2="${bottom}"/><text class="as-terminal-time-tick" data-time-index="${i}" x="${Math.min(right,Math.max(left,x(i)))}" y="${height-10}" text-anchor="${j===0?'start':j===uniqueTime.length-1?'end':'middle'}">${timeLabel(i)}</text>`).join('');
   q('[data-tc-clip]').setAttribute('x',left);q('[data-tc-clip]').setAttribute('y',top);q('[data-tc-clip]').setAttribute('width',dataRight-left);q('[data-tc-clip]').setAttribute('height',bottom-top);
   let lastLabel=-Infinity;
   const z=(annotations?zones:[]).map(area=>{const zy=Math.max(top,y(area.high)),zb=Math.min(bottom,y(area.low));if(zb<zy)return '';const label=area.label||(area.kind==='support'?'Поддержка':area.kind==='resistance'?'Сопротивление':'Область');let ty=Math.max(16,zy-16);if(Math.abs(ty-lastLabel)<22)ty=Math.max(16,ty-24);lastLabel=ty;return `<g class="as-terminal-area as-terminal-area-${area.kind}"><rect class="as-terminal-zone" x="${left}" y="${zy}" width="${plot}" height="${Math.max(2,zb-zy)}"/><line class="as-terminal-bound" x1="${left}" x2="${right}" y1="${zy}" y2="${zy}"/><line class="as-terminal-bound" x1="${left}" x2="${right}" y1="${zb}" y2="${zb}"/><text class="as-terminal-area-label" x="${left+6}" y="${ty}"><title>${esc(label)}</title>${plotLabel(label,plot)}</text></g>`;}).join('');
   q('[data-tc-zones]').innerHTML=z+(annotations?options.levels||[]:[]).filter(l=>Number.isFinite(l.price)&&l.price>=d.min&&l.price<=d.max).map(l=>`<line class="as-terminal-bound" x1="${left}" x2="${right}" y1="${y(l.price)}" y2="${y(l.price)}"/><text class="as-terminal-area-label" x="${left+5}" y="${Math.max(top+13,y(l.price)-5)}"><title>${esc(levelLabel(l))}</title>${plotLabel(levelLabel(l),plot)}</text>`).join('');
   areaLabels.replaceChildren();
   for(const text of q('[data-tc-zones]').querySelectorAll('.as-terminal-area > .as-terminal-area-label')){
    const kind=text.parentNode.classList.contains('as-terminal-area-support')?'support':text.parentNode.classList.contains('as-terminal-area-resistance')?'resistance':'neutral',chip=document.createElementNS(NS,'g'),background=document.createElementNS(NS,'rect');
    chip.setAttribute('class','as-terminal-zone-chip as-terminal-zone-chip-'+kind);chip.append(background,text);areaLabels.append(chip);
    const box=text.getBBox();background.setAttribute('class','as-terminal-zone-label-bg');for(const [key,value] of Object.entries({x:box.x-5,y:box.y-3,width:box.width+10,height:box.height+6,rx:4}))background.setAttribute(key,value);
   }
   nodes.forEach((g,i)=>{g.style.display=i<start||i>end?'none':'';if(i<start||i>end)return;const b=displayed[i],up=b.c>=b.o,line=g.children[0],rect=g.children[1],cw=Math.min(44,dx*(reference?.74:.65));g.setAttribute('class',`as-terminal-candle ${b.c===b.o?'as-terminal-flat':up?'as-terminal-up':'as-terminal-down'}${i===selected?' as-terminal-selected':''}`);for(const [k,v]of Object.entries({x1:x(i),x2:x(i),y1:y(b.h),y2:y(b.l)}))line.setAttribute(k,v);for(const[k,v]of Object.entries({x:x(i)-cw/2,y:Math.min(y(b.o),y(b.c)),width:cw,height:Math.max(2,Math.abs(y(b.o)-y(b.c))),rx:1}))rect.setAttribute(k,v);});
   const b=displayed[selected],selectedForming=options.forming&&selected===data.length-1,value=indicator?displayedSeries[0]?.values[selected]:b.c,sx=x(selected),sy=Number.isFinite(value)?y(value):top;q('[data-tc-focus]').innerHTML=selected>=start?`<line class="as-terminal-cross" x1="${sx}" x2="${sx}" y1="${top}" y2="${bottom}"/><line class="as-terminal-price-line" x1="${Math.min(sx,right)}" x2="${right}" y1="${sy}" y2="${sy}"/><rect class="as-terminal-price-tag" x="${right+1}" y="${sy-11}" width="64" height="22" rx="3"/><text class="as-terminal-tag-text" x="${right+33}" y="${sy+4}" text-anchor="middle">${fmt(value)}</text>`:'';if(indicator&&!Number.isFinite(value))q('[data-tc-focus]').innerHTML=`<line class="as-terminal-cross" x1="${sx}" x2="${sx}" y1="${top}" y2="${bottom}"/>`;
   const marks=(annotations?options.markers||[]:[]).filter(m=>m.index>=start&&m.index<=end&&Number.isFinite(m.price));let overlay=displayedSeries.map((series,j)=>{let started=false;const points=series.values.slice(start,end+1).map((v,i)=>{if(!Number.isFinite(v)){started=false;return '';}const point=(started?'L':'M')+x(start+i)+','+y(v);started=true;return point;}).join(' ');if(series.kind==='points')return series.values.slice(start,end+1).map((v,i)=>Number.isFinite(v)?`<circle class="as-terminal-series as-terminal-series-${j%3} as-terminal-series-point" cx="${x(start+i)}" cy="${y(v)}" r="3"/>`:'').join('');if(series.kind==='bars')return series.values.slice(start,end+1).map((v,i)=>Number.isFinite(v)?`<rect class="as-terminal-series as-terminal-series-${j%3} as-terminal-series-bar${series.colorBy?((series.colorBy==='delta'?v-(series.values[start+i-1]??v):v)>=0?' as-market-hist-up':' as-market-hist-down'):''}" x="${x(start+i)-Math.min(8,dx*.5)/2}" y="${Math.min(y(v),y(0))}" width="${Math.min(8,dx*.5)}" height="${Math.max(1,Math.abs(y(v)-y(0)))}"/>`:'').join('');return `<path class="as-terminal-series as-terminal-series-${j%3}" data-series-label="${esc(series.label||'')}" d="${points}" fill="none"/>`;}).join('');q('[data-tc-labels]').innerHTML=overlay+marks.map((m,i)=>`<circle class="as-terminal-mark${options.highlight?.includes(m.index)?' as-terminal-mark-active':''}" cx="${x(m.index)}" cy="${y(m.price)}" r="8"/><text class="as-terminal-mark-text" x="${x(m.index)}" y="${y(m.price)+4}" text-anchor="middle">${i+1}</text>`).join('');q('.as-terminal-markers').innerHTML=(!options.authored?((annotations?zones:[]).map(area=>`<span class="as-terminal-zone-note">${esc(zoneLabel(area))}</span>`).join('')+marks.map((m,i)=>`<span><b>${i+1}</b> ${esc(m.label)} · ${fmt(m.price)}</span>`).join('')+(annotations?options.levels||[]:[]).filter(l=>Number.isFinite(l.price)).map(l=>`<span>${esc(levelLabel(l))}</span>`).join('')):'')+displayedSeries.map((s,j)=>`<span><i class="as-terminal-line-key as-terminal-series-${j%3}"></i>${esc(s.label)}: ${Number.isFinite(s.values[selected])?fmt(s.values[selected]):'нет полного окна'}</span>`).join('');
   q('.as-terminal-readout').innerHTML=`<span>Свеча ${selected+1}</span><span>Начало <b>${fmt(b.o)}</b></span><span>Максимум <b>${fmt(b.h)}</b></span><span>Минимум <b>${fmt(b.l)}</b></span><span>${selectedForming?'Сейчас':'Закрытие'} <b>${fmt(b.c)}</b></span>`;if(indicator){q('.as-terminal-readout').innerHTML=`<span>Свеча ${selected+1}</span>`+displayedSeries.map(s=>`<span>${esc(s.label)} <b>${Number.isFinite(s.values[selected])?fmt(s.values[selected]):'нет значения'}</b></span>`).join('');svg.setAttribute('aria-label',(options.caption||'Индикатор')+'. '+q('.as-terminal-readout').textContent);}
   viewportStatus.textContent=(start+1)+'–'+(end+1)+' из '+data.length;q('[data-tc-index]').textContent='№ '+(selected+1);q('[data-tc-in]').disabled=limit<=Math.min(6,data.length);q('[data-tc-out]').disabled=limit>=data.length;q('[data-tc-probe]').value=String(selected+1);
   if(data.length===1&&marks.length&&!options.authored){
    q('.as-terminal-markers').hidden=true;
    q('[data-tc-labels]').innerHTML=marks.map(m=>{const text=String(m.label),kind=/Открытие/.test(text)?'Начало':/Максимум/.test(text)?'Максимум':/Минимум/.test(text)?'Минимум':options.forming?'Сейчас':'Закрытие',isClose=kind==='Закрытие'||kind==='Сейчас',price=kind==='Начало'?displayed[0].o:kind==='Максимум'?displayed[0].h:kind==='Минимум'?displayed[0].l:displayed[0].c,tx=isClose?x(0)+30:left+2,ty=y(price)+(isClose?-10:kind==='Максимум'?-14:kind==='Минимум'?19:4);return `<circle class="as-terminal-point" cx="${x(0)}" cy="${y(price)}" r="3"/><text class="as-terminal-direct" x="${tx}" y="${ty}">${kind} ${fmt(price)}</text>`;}).join('');
   }
   if(options.authored&&window.TDChartAnnotations)window.TDChartAnnotations.render(svg,{...options,zones},{left,right,top,bottom,x,y,start,end,dx,annotations,dataRight,annotationLeft,reference,width,formatPrice:fmt,precision,currentValue:value});else separateLabels(svg);
  }
  const viewportStatus=document.createElement('span');
  viewportStatus.className='as-chart-window';
  q('.as-terminal-navigation').insertBefore(viewportStatus,q('[data-tc-next]'));
  svg.style.touchAction='pan-y';
  svg.setAttribute('aria-keyshortcuts','ArrowLeft ArrowRight Home End PageUp PageDown + -');
  if(data.length>6){
   const help=document.createElement('span');
   help.className='as-chart-gestures';
   help.textContent='Точка под курсором показывает цену. Приблизь и тяни график вбок, чтобы листать историю.';
   q('.as-terminal-foot').append(help);
  }
  function notify(linkViewport){
   if(options.linked)stable.dispatchEvent(new CustomEvent('academy-candle-select',{detail:{index:selected,source:host,range:linkViewport?{start,limit}:null}}));
  }
  function select(index){
   saved.probed=true;
   selected=clamp(index,0,data.length-1);keepVisible(selected);draw();notify(false);
  }
  function zoom(to,anchor){
   const next=clamp(to,Math.min(6,data.length),data.length);
   if(next===limit)return;
   const fraction=(anchor-start)/Math.max(1,limit-1);
   start=clamp(Math.round(anchor-fraction*(next-1)),0,data.length-next);
   limit=next;selected=clamp(selected,start,start+limit-1);saved.zoomed=true;draw();notify(true);
  }
  function pan(to){
   const next=clamp(to,0,data.length-limit);if(next===start)return;
   start=next;selected=clamp(selected,start,start+limit-1);saved.zoomed=true;draw();notify(true);
  }
  function linkedSelect(event){
   const other=event.detail;if(!options.linked||other.source===host||!Number.isInteger(other.index))return;
   if(other.range){limit=clamp(other.range.limit,1,data.length);start=clamp(other.range.start,0,data.length-limit);saved.zoomed=true;}
   selected=clamp(other.index,0,data.length-1);saved.probed=true;keepVisible(selected);draw();
  }
  stable.addEventListener('academy-candle-select',linkedSelect);
  q('[data-tc-in]').onclick=()=>zoom(Math.floor(limit*.65),selected);
  q('[data-tc-out]').onclick=()=>zoom(Math.ceil(limit*1.5),selected);
  q('[data-tc-all]').onclick=()=>{zoom(data.length,selected);saved.zoomed=false;};
  q('[data-tc-probe]').oninput=e=>select(Number(e.target.value)-1);
  q('[data-tc-prev]').onclick=()=>select(selected-1);q('[data-tc-next]').onclick=()=>select(selected+1);
  q('[data-tc-annotations]').onclick=()=>{annotations=!annotations;draw();};
  function keyboard(event){
   const stride=Math.max(1,Math.floor(limit*.6));
   switch(event.key){
    case 'PageUp':pan(start-stride);break;
    case 'PageDown':pan(start+stride);break;
    case '+':case '=':zoom(Math.floor(limit*.65),selected);break;
    case '-':zoom(Math.ceil(limit*1.5),selected);break;
    case 'ArrowLeft':select(selected-1);break;
    case 'ArrowRight':select(selected+1);break;
    case 'Home':select(0);break;
    case 'End':select(data.length-1);break;
    default:return;
   }
   event.preventDefault();
  }
  function indexAt(event){
   if(!scale)return null;
   const px=event.clientX-svg.getBoundingClientRect().left;
   if(px<scale.left||px>scale.dataRight)return null;
   return clamp(scale.start+Math.floor((px-scale.left)/scale.dx),scale.start,scale.start+limit-1);
  }
  let drag=null;
  function pointerDown(event){
   if(!event.isPrimary||event.button!==0||event.target.closest('[role="button"]'))return;
   const index=indexAt(event);if(index===null)return;
   drag={id:event.pointerId,x:event.clientX,start,dx:scale.dx,moved:false};
   svg.setPointerCapture(event.pointerId);select(index);
  }
  function pointerMove(event){
   if(!drag&&event.target.closest('[role="button"]'))return;
   if(drag&&drag.id===event.pointerId){
    const shift=event.clientX-drag.x;
    if(Math.abs(shift)>4){drag.moved=true;svg.classList.add('is-dragging');}
    if(drag.moved)pan(drag.start-Math.round(shift/drag.dx));
   }else if(event.pointerType==='mouse'&&!event.buttons){
    const index=indexAt(event);if(index!==null&&index!==selected)select(index);
   }
  }
  function pointerEnd(){drag=null;svg.classList.remove('is-dragging');}
  function wheel(event){
   if(!event.shiftKey)return;
   const anchor=indexAt(event);if(anchor===null||!event.deltaY)return;
   event.preventDefault();zoom(event.deltaY<0?Math.floor(limit*.8):Math.ceil(limit*1.25),anchor);
  }
  svg.addEventListener('keydown',keyboard);svg.addEventListener('pointerdown',pointerDown);
  svg.addEventListener('pointermove',pointerMove);svg.addEventListener('lostpointercapture',pointerEnd);
  svg.addEventListener('wheel',wheel,{passive:false});
  const observer=new ResizeObserver(draw);observer.observe(host);draw();
  if(canMove){const from=displayed.map(b=>({...b})),begin=performance.now();function tick(now){if(disposed)return;const t=Math.min(1,(now-begin)/480),ease=1-(1-t)**3;displayedSeries=targetSeries.map((series,j)=>({...series,values:series.values.map((v,i)=>Number.isFinite(v)&&Number.isFinite(seriesStart[j].values[i])?seriesStart[j].values[i]+(v-seriesStart[j].values[i])*ease:v)}));displayed=data.map((b,i)=>Object.fromEntries(['o','h','l','c'].map(k=>[k,from[i][k]+(b[k]-from[i][k])*ease])));draw();if(t<1)raf=requestAnimationFrame(tick);}raf=requestAnimationFrame(tick);}
  return()=>{disposed=true;cancelAnimationFrame(raf);observer.disconnect();stable.removeEventListener('academy-candle-select',linkedSelect);svg.removeEventListener('keydown',keyboard);svg.removeEventListener('pointermove',pointerMove);svg.removeEventListener('pointerdown',pointerDown);svg.removeEventListener('wheel',wheel);svg.removeEventListener('lostpointercapture',pointerEnd);};
 }
 window.TDTerminalChart={mount,domain,initialView,zonesFor,reset:host=>memo.delete(host.closest?.('[data-as-scene]')||host)};
})();
