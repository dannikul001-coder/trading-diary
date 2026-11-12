(function(){
 'use strict';
 // Presentation metadata for authored, synthetic lessons. Nothing here creates
 // candles, levels, areas, orders, future paths, or additional swing points.
 const SYNTHETIC_START='2026-01-12T09:00:00Z';
 const minuteLessons=new Set(['0.1','0.2','0.3','1.1','1.2','1.3','3.1','3.2','3.3','4.1']);
 const fiveMinuteLessons=new Set(['2.1','2.2','2.3','5.1','6.1','6.2','6.3','8.1','8.2','12.1','12.2','12.3','12.4','12.5','12.6','12.7','13.9']);
 const pivotRules={
  '1.2':{left:1,right:1,theory:{high:[20,36,52],low:[27,44,58]},practice:{high:[14,31,48],low:[23,40,55]}},
  '6.1':{left:2,right:2,theory:{high:[24,40,56,67],low:[32,48,62,71]},practice:{high:[24,40,56,67],low:[32,48,62,71]}},
  '12.6':{left:1,right:1,theory:{high:[35,45,55],low:[40,50,60]},practice:{high:[35,45,55],low:[40,50,60]}}
 };
 const finite=Number.isFinite;
 const text=value=>String(value??'').replace(/\s+/g,' ').trim();
 const close=(a,b)=>finite(a)&&finite(b)&&Math.abs(a-b)<=Math.max(1,Math.abs(a),Math.abs(b))*1e-10;
 const shorten=value=>{const s=text(value);if(s.length<=18)return s;const words=s.split(' ');let result='';for(const word of words){if((result+' '+word).trim().length>18)break;result=(result+' '+word).trim();}return result||s.slice(0,17)+'…';};
 function timeframe(options,key,context){
  for(const value of [options.timeframeMinutes,context.timeframeMinutes,options.reference?.timeframeMinutes])if(finite(value)&&value>0)return value;
  const label=text(options.intervalLabel),minutes=label.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*(?:минут[а-яё]*|мин\.?|minutes?|mins?)(?=\s|[·|,;)]|$)/i),notation=label.match(/(?:^|\s)M(\d+)(?:\s|$|\b)/i),hours=label.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*(?:час[а-яё]*|hours?|hrs?)(?=\s|[·|,;)]|$)/i);
  if(minutes)return Number(minutes[1].replace(',','.'));
  if(notation)return Number(notation[1]);
  if(hours)return Number(hours[1].replace(',','.'))*60;
  // Enlarged details inherit the actual lesson interval; a grouped M3 detail
  // already supplies timeframeMinutes=3 and therefore takes precedence above.
  if(minuteLessons.has(key))return 1;
  if(fiveMinuteLessons.has(key))return 5;
  return null;
 }
 function frameLabel(minutes){return minutes>=60&&Number.isInteger(minutes/60)?'H'+minutes/60:'M'+minutes;}
 function neutralZone(label,key,options){
  return options.mode==='indicator'||['0.2','3.3','4.1','1.1','1.3','12.7','13.9'].includes(key)||/окно|контекст|групп|тройк|сравниваем|тело|расч[её]т|свечей|свечи/i.test(label);
 }
 function zoneMeta(zone,key,options){
  const label=text(zone.label);let role='neutral',shortLabel;
  if(key==='12.3'&&/order\s*block|\bOB\b/i.test(label)){role='ob';shortLabel='OB';}
  else if(key==='12.4'&&/\bFVG\b/i.test(label)){role='fvg';shortLabel='FVG';}
  else if(!neutralZone(label,key,options)){
   if(zone.kind==='support'||/поддержк/i.test(label))role='support';
   else if(zone.kind==='resistance'||/сопротивлен/i.test(label))role='resistance';
  }
  if(!shortLabel){
   if(key==='12.1')shortLabel='Прежние H';
   else if(key==='12.2')shortLabel='Прежние L';
   else if(key==='12.7'){const n=label.match(/тело\s*(\d+)/i);shortLabel=n?'Тело '+n[1]:'Тело';}
   else if(key==='1.1')shortLabel='Тело';
   else if(key==='0.2'||key==='3.3')shortLabel='Группа 3 минут';
   else if(key==='4.1')shortLabel='Окно ATR';
   else if(key==='1.3')shortLabel='Пауза';
   else if(key==='13.9')shortLabel='3 свечи';
   else if(role==='support')shortLabel='Поддержка';
   else if(role==='resistance')shortLabel='Сопротивление';
   else if(/контекст/i.test(label))shortLabel='Контекст';
   else if(/окно/i.test(label))shortLabel='Окно';
   else shortLabel=shorten(label)||'Область';
  }
  return{...zone,role,shortLabel,fullLabel:zone.label||'Область',project:['ob','fvg','support','resistance'].includes(role)};
 }
 function levelMeta(item,key){
  const label=text(item.label);let role='neutral',shortLabel;
  const liquidity=key==='12.1'&&/максимум/i.test(label)||key==='12.2'&&/минимум/i.test(label)||key==='12.3'&&/прежний минимум/i.test(label);
  if(/отмен|нарушени|ограничени/i.test(label)){role='invalid';shortLabel=/ограничени/i.test(label)?'Ограничение':'Отмена';}
  else if(key==='5.1'&&/ориентир/i.test(label)){role='target';shortLabel='Цель плана';}
  else if(liquidity){role='liquidity';shortLabel=key==='12.1'?'Ликвидность · прежний H':'Ликвидность · прежний L';}
  else if(key==='12.3'&&/верх/i.test(label))shortLabel='Прежний H';
  else if(key==='12.4'&&/^H1(?:\s|$)/i.test(label))shortLabel='H1';
  else if(key==='12.4'&&/^L3(?:\s|$)/i.test(label))shortLabel='L3';
  else if(key==='1.2'&&/впадин/i.test(label))shortLabel='Опорный L';
  else if(key==='4.1')shortLabel='Пред. C';
  else if(key==='13.9')shortLabel=/максимум/i.test(label)?'H1':'C1';
  else if(key==='12.6')shortLabel=/верх/i.test(label)?'Верх':'Низ';
  else if(/плановый вход/i.test(label))shortLabel='Вход';
  else if(/закрыти/i.test(label))shortLabel='Закрытие';
  else shortLabel=shorten(label)||'Уровень';
  const result={...item,role,shortLabel,fullLabel:item.label||'Уровень'};
  if(role==='liquidity'){
   result.semantic='price-reference';result.ordersObserved=false;
   result.semanticNote='Это прежний ценовой экстремум. Наличие, число и объём чужих заявок здесь не наблюдаются.';
  }
  return result;
 }
 function eventLabel(label,key){
  const s=text(label);
  if(key==='12.3'){
   if(/исходная медвежья|источник/i.test(s))return['Источник','ob-source'];
   if(/закрытие выше прежнего верха/i.test(s))return['Выход','breakout'];
   if(/реакция после|новая реакция/i.test(s))return['Реакция','reaction'];
   if(/более поздний подход|возвращени/i.test(s))return['Возврат','return'];
   if(/закрытие наруш|ниже .*:/i.test(s))return['Отмена','invalid'];
   if(/прежний минимум/i.test(s))return['Прежний L','reference-low'];
   if(/подтвержд[её]нный верх|прежний верх/i.test(s))return['Прежний H','reference-high'];
   if(/ниже прежнего минимума/i.test(s))return['Выход ниже L','excursion'];
  }
  if(key==='12.4'){
   if(/максимум первой|^H1(?:\s|$)/i.test(s))return['H1','first-high'];
   if(/минимум третьей|^L3(?:\s|$)/i.test(s))return['L3','third-low'];
   if(/цена до импульса/i.test(s))return['До импульса','context'];
   if(/возврат/i.test(s))return['Возврат','return'];
   if(/закрытие ниже области/i.test(s))return['Ниже FVG','invalid'];
   if(/закрытие выше области/i.test(s))return['Выше FVG','reaction'];
  }
  if(key==='12.1'){
   const n=s.match(/^вершина\s*(\d+)$/i);if(n)return['H'+n[1],'reference-high'];
   if(/прежний максимум/i.test(s))return['Прежний H','reference-high'];
   if(/закрытие обратно ниже/i.test(s))return['Возврат','return'];
   if(/закрытие оста[её]тся выше/i.test(s))return['Выше H','continuation'];
   if(/выход выше/i.test(s))return['Выход','excursion'];
  }
  if(key==='12.2'){
   const n=s.match(/^старый минимум\s*(\d+)$/i);if(n)return['L'+n[1],'reference-low'];
   if(/исходный минимум/i.test(s))return['Прежний L','reference-low'];
   if(/возврат ещ[её] не показан/i.test(s))return['Пока ниже L','checkpoint'];
   if(/первое закрытие обратно выше/i.test(s))return['Возврат','return'];
   if(/закрытие оста[её]тся ниже/i.test(s))return['Ниже L','continuation'];
   if(/выход ниже/i.test(s))return['Выход','excursion'];
  }
  if(/отмен|нарушил|нарушени/i.test(s))return['Отмена','invalid'];
  if(/правый край.*нет|правый край.*не|край: правого соседа ещ[её] нет/i.test(s))return['Кандидат','unconfirmed'];
  if(/бывший край/i.test(s))return['Бывший край','former-edge'];
  if(/верхняя тень/i.test(s))return['Верх. тень','upper-wick'];
  if(/нижняя тень/i.test(s))return['Нижн. тень','lower-wick'];
  if(/открытие\s*\/\s*сейчас/i.test(s))return['O=тек.','forming-open'];
  if(/открытие\s*\/\s*закрытие/i.test(s))return['O=C','doji'];
  if(/^O\s*=\s*C|дожи/i.test(s))return['O=C','doji'];
  if(/^H1(?:\s|$)/i.test(s))return['H1','first-high'];
  if(/^L3(?:\s|$)/i.test(s))return['L3','third-low'];
  if(/^H(?:\s|$)|максимум|вершина/i.test(s))return['H','high'];
  if(/^L(?:\s|$)|минимум|впадина/i.test(s))return['L','low'];
  if(/^O(?:\s|$)|открыти/i.test(s))return['O','open'];
  if(/возврат|возвращени/i.test(s))return['Возврат','return'];
  if(/новый подход|подход сверху|подход к/i.test(s))return['Подход','approach'];
  if(/выход|закрытие.*выше.*прежн/i.test(s))return['Выход','breakout'];
  if(/^C(?:\s|$)|закрыти|последн.*цен/i.test(s))return['C','close'];
  if(/импульс|растущих закрыти/i.test(s))return['Импульс','impulse'];
  if(/поглощени/i.test(s))return['Поглощение','body-engulfing'];
  if(/тело/i.test(s))return['Тело','body'];
  if(/начало/i.test(s))return['Начало','start'];
  if(/конец/i.test(s))return['Конец','end'];
  if(/дальнейш|новые данные|эта ветк/i.test(s))return['Далее','continuation'];
  return[shorten(s)||'Точка','neutral'];
 }
 function confirmed(bars,index,side,rule){
  if(!Number.isInteger(index)||index<rule.left||index+rule.right>=bars.length)return false;
  const value=bars[index]?.[side==='high'?'h':'l'];if(!finite(value))return false;
  for(let offset=-rule.left;offset<=rule.right;offset++){
   if(offset===0)continue;
   const other=bars[index+offset]?.[side==='high'?'h':'l'];
   if(!finite(other)||!(side==='high'?value>other:value<other))return false;
  }
  return true;
 }
 function markerMeta(marker,key,options,context){
  const [shortLabel,semantic]=eventLabel(marker.label,key),result={...marker,shortLabel,semantic,fullLabel:marker.label||'Точка'},rule=pivotRules[key];
  if(!rule||options.chartRole==='detail'||options.mode==='indicator')return result;
  const bars=options.bars||[],points=context.practice?rule.practice:rule.theory;
  for(const side of ['high','low']){
   const index=marker.index,priceField=side==='high'?'h':'l';
   if(!points[side].includes(index)||!close(marker.price,bars[index]?.[priceField]))continue;
   if(!confirmed(bars,index,side,rule))return{...result,confirmed:false,semantic:'unconfirmed-'+side,shortLabel:'Кандидат'};
   const earlier=points[side].filter(i=>i<index&&confirmed(bars,i,side,rule)).at(-1),previous=earlier===undefined?null:bars[earlier][priceField],price=bars[index][priceField];
   const code=previous===null||close(previous,price)?side==='high'?'H':'L':side==='high'?price>previous?'HH':'LH':price>previous?'HL':'LL';
   return{...result,shortLabel:code,semantic:code,confirmed:true,pivotSide:side,availableAt:index+rule.right,previousPivotIndex:earlier??null,pivotRule:{left:rule.left,right:rule.right,strict:true}};
  }
  return result;
 }
 function decorate(options={},lessonKey,context={}){
  if(!options||typeof options!=='object')return options;
  context=context&&typeof context==='object'?context:{};
  const key=String(lessonKey??context.lessonKey??options.lessonKey??''),minutes=timeframe(options,key,context),output={...options,instrument:'Учебная модель',timeAxisLabel:minutes?'Учебное время':'Порядок интервалов',timeIsSynthetic:true,timeframeLabel:minutes?frameLabel(minutes):'Интервалы'};
  if(minutes){output.timeframeMinutes=minutes;output.startTime=Number.isFinite(Date.parse(options.startTime))?options.startTime:SYNTHETIC_START;output.timeZone=options.timeZone||'UTC';}
  output.reference={...(options.reference||{}),lessonKey:key,simulation:true,timeIsSynthetic:true,timeframeMinutes:minutes,priceMeaning:'Условная цена синтетической учебной модели.'};
  if(pivotRules[key])output.reference.pivotRule={left:pivotRules[key].left,right:pivotRules[key].right,strict:true,scope:'Только уже отмеченные автором повороты; никакого поиска новых точек в будущем.'};
  if(Array.isArray(options.zones))output.zones=options.zones.map(z=>zoneMeta(z,key,options));
  if(options.zone&&typeof options.zone==='object')output.zone=zoneMeta(options.zone,key,options);
  if(Array.isArray(options.levels))output.levels=options.levels.map(l=>levelMeta(l,key));
  if(Array.isArray(options.markers))output.markers=options.markers.map(m=>markerMeta(m,key,options,context));
  if(Array.isArray(options.callouts))output.callouts=options.callouts.map(c=>{const[shortLabel,semantic]=eventLabel(c.label,key);return{...c,shortLabel,semantic,fullLabel:c.label||'Точка'};});
  if(Array.isArray(options.segments))output.segments=options.segments.map(s=>{const[shortLabel,semantic]=eventLabel(s.label,key);return{...s,shortLabel:s.label?shortLabel:'',semantic,fullLabel:s.label||''};});
  return output;
 }
 window.TDChartReference={decorate};
})();
