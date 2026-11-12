(function(){
 'use strict';
 const NS='http://www.w3.org/2000/svg',finite=Number.isFinite;
 const fmt=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n);
 const element=(name,attributes={},text)=>{const node=document.createElementNS(NS,name);for(const [key,value] of Object.entries(attributes))node.setAttribute(key,String(value));if(text!==undefined)node.textContent=text;return node;};
 function renderRail(svg,entries,annotations){
  const terminal=svg.closest('.as-terminal');let rail=terminal.querySelector('[data-tc-annotation-rail]');
  if(!rail){
   rail=document.createElement('section');rail.className='as-market-annotation-rail';rail.setAttribute('data-tc-annotation-rail','');rail.setAttribute('aria-label','Пояснения к разметке');svg.after(rail);
   const show=key=>{
    for(const node of svg.querySelectorAll('[data-annotation-target]'))node.classList.toggle('is-annotation-active',node.getAttribute('data-annotation-target')===key);
    for(const button of rail.querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.getAttribute('data-annotation-target')===terminal.dataset.activeAnnotation));
   };
   rail.onclick=event=>{const button=event.target.closest('button[data-annotation-target]');if(!button)return;const key=button.getAttribute('data-annotation-target');terminal.dataset.activeAnnotation=terminal.dataset.activeAnnotation===key?'':key;show(terminal.dataset.activeAnnotation);};
   rail.onpointerover=event=>{const button=event.target.closest('button[data-annotation-target]');if(button)show(button.getAttribute('data-annotation-target'));};
   rail.onpointerleave=()=>show(terminal.dataset.activeAnnotation);
   rail.onfocusin=event=>{const button=event.target.closest('button[data-annotation-target]');if(button)show(button.getAttribute('data-annotation-target'));};
   rail.onfocusout=event=>{if(!rail.contains(event.relatedTarget))show(terminal.dataset.activeAnnotation);};
   rail.showAnnotation=show;
  }
  rail.hidden=!annotations||!entries.length;
  const signature=JSON.stringify(entries);
  if(rail.dataset.signature!==signature){
   rail.dataset.signature=signature;rail.replaceChildren();
   const heading=document.createElement('p');heading.className='as-market-annotation-help';heading.textContent='Нажми на подпись, чтобы выделить элемент на графике.';rail.append(heading);
   const list=document.createElement('div');list.className='as-market-annotation-list';rail.append(list);
   for(const entry of entries){
    const button=document.createElement('button');button.type='button';button.className='as-market-callout as-market-annotation-card as-market-annotation-'+entry.kind;button.setAttribute('data-annotation-target',entry.key);button.setAttribute('aria-pressed','false');
    const badge=document.createElement('span');badge.className='as-market-annotation-badge';badge.textContent=entry.badge;badge.setAttribute('aria-hidden','true');
    const copy=document.createElement('span');copy.className='as-market-annotation-copy';const title=document.createElement('span');title.className='as-market-annotation-title';title.textContent=entry.title;copy.append(title);
    if(entry.detail){const detail=document.createElement('span');detail.className='as-market-annotation-detail';detail.textContent=entry.detail;copy.append(detail);}
    button.append(badge,copy);list.append(button);
   }
  }
  rail.showAnnotation(annotations?terminal.dataset.activeAnnotation:'');
 }
 function render(svg,options,layout){
  const {left,right,top,bottom,x,y,start,end,dx,annotations}=layout,entries=[];
  const groups={};
  for(const [name,selector] of [['bands','data-tc-stage-bands'],['segments','data-tc-stage-segments']]){let group=svg.querySelector('['+selector+']');if(!group){group=element('g',{[selector]:''});svg.insertBefore(group,svg.querySelector('[data-tc-candles]'));}group.replaceChildren();groups[name]=group;}
  const areas=svg.querySelector('[data-tc-zones]'),labels=svg.querySelector('[data-tc-area-labels]'),points=svg.querySelector('[data-tc-labels]');areas.replaceChildren();labels.replaceChildren();
  for(const node of points.querySelectorAll('.as-terminal-mark,.as-terminal-mark-text,.as-market-arrow,.as-market-point'))node.remove();
  if(!annotations){renderRail(svg,entries,false);return;}
  const validIndex=i=>Number.isInteger(i)&&i>=start&&i<=end;
  const target=(node,key)=>{node.setAttribute('data-annotation-target',key);return node;};
  const insidePrice=price=>finite(price)&&y(price)>=top-1&&y(price)<=bottom+1;
  for(const index of options.highlight||[])if(validIndex(index))groups.bands.append(element('rect',{class:'as-market-step-band',x:x(index)-dx*.48,y:top,width:Math.max(2,dx*.96),height:bottom-top,rx:2}));
  function horizontal(from=0,to=end){if(to<start||from>end)return null;return{from:Math.max(left,x(Math.max(from,start))-dx*.48),to:Math.min(right,x(Math.min(to,end))+dx*.48)};}
  (options.zones||[]).forEach((zone,index)=>{
   const span=horizontal(zone.from??0,zone.to??end);if(!span||!finite(zone.low)||!finite(zone.high)||zone.low>zone.high)return;
   const upper=Math.max(top,y(zone.high)),lower=Math.min(bottom,y(zone.low));if(lower<upper)return;
   const kind=zone.kind||'neutral',key='zone:'+index,group=target(element('g',{class:'as-terminal-area as-terminal-area-'+kind}),key);
   group.append(element('rect',{class:'as-terminal-zone',x:span.from,y:upper,width:Math.max(2,span.to-span.from),height:Math.max(2,lower-upper)}));
   for(const yy of [upper,lower])group.append(element('line',{class:'as-terminal-bound',x1:span.from,x2:span.to,y1:yy,y2:yy}));areas.append(group);
   entries.push({key,kind:'zone '+kind,badge:String.fromCharCode(65+index),title:zone.label||'Выделенная зона',detail:'Границы: '+fmt(zone.low)+'–'+fmt(zone.high)});
  });
  (options.levels||[]).forEach((level,index)=>{
   const span=horizontal(level.from??0,level.to??end);if(!span||!insidePrice(level.price))return;const yy=y(level.price),key='level:'+index;
   areas.append(target(element('line',{class:'as-terminal-bound as-market-reference-level',x1:span.from,x2:span.to,y1:yy,y2:yy}),key));
   entries.push({key,kind:'level',badge:'—',title:level.label||'Уровень',detail:'Цена: '+fmt(level.price)});
  });
  (options.segments||[]).forEach((segment,index)=>{
   if(![segment.fromIndex,segment.toIndex].every(Number.isInteger)||segment.toIndex<start||segment.fromIndex>end||![segment.fromPrice,segment.toPrice].every(finite))return;
   const a=Math.max(start,segment.fromIndex),b=Math.min(end,segment.toIndex),length=segment.toIndex-segment.fromIndex||1,key='segment:'+index;
   const value=i=>segment.fromPrice+(segment.toPrice-segment.fromPrice)*(i-segment.fromIndex)/length;
   groups.segments.append(target(element('line',{class:'as-market-segment as-market-segment-'+(segment.kind||'structure'),x1:x(a),x2:x(b),y1:y(value(a)),y2:y(segment.fromIndex===segment.toIndex?segment.toPrice:value(b))}),key));
   if(segment.label)entries.push({key,kind:'segment',badge:'↗',title:segment.label,detail:'Свечи '+(segment.fromIndex+1)+'–'+(segment.toIndex+1)});
  });
  const markers=(options.markers||[]).map((marker,index)=>({marker,index})).filter(({marker:m})=>validIndex(m.index)&&finite(m.price));
  markers.forEach(({marker,index},i)=>{
   const key='marker:'+index,px=x(marker.index),py=y(marker.price),down=marker.shape==='arrowDown',arrow=down||marker.shape==='arrowUp',cy=arrow?Math.max(top+9,Math.min(bottom-9,py+(down?-29:29))):py;
   if(arrow){const sign=down?1:-1;points.append(target(element('line',{class:'as-market-arrow',x1:px,x2:px,y1:cy+sign*8,y2:py-sign*6}),key),target(element('path',{class:'as-market-arrow',d:'M'+(px-4)+' '+(py-sign*11)+'L'+px+' '+(py-sign*5)+'L'+(px+4)+' '+(py-sign*11),fill:'none'}),key),target(element('circle',{class:'as-market-point',cx:px,cy:py,r:2.5}),key));}
   const circle=target(element('circle',{class:'as-terminal-mark'+((options.highlight||[]).includes(marker.index)?' as-terminal-mark-active':''),cx:px,cy,r:8}),key);circle.append(element('title',{},marker.label));points.append(circle,element('text',{class:'as-terminal-mark-text',x:px,y:cy+4,'text-anchor':'middle'},i+1));
   entries.push({key,kind:'marker',badge:String(i+1),title:marker.label,detail:'Свеча '+(marker.index+1)+' · '+fmt(marker.price)});
  });
  (options.callouts||[]).forEach((callout,index)=>{
   if(!validIndex(callout.index)||!finite(callout.price))return;
   const matching=markers.find(({marker})=>marker.index===callout.index&&marker.price===callout.price),key=matching?'marker:'+matching.index:'callout:'+index;
   const entry=entries.find(item=>item.key===key);
   if(entry){if(entry.title!==callout.label)entry.detail+=' · '+callout.label;return;}
   points.append(target(element('circle',{class:'as-market-point',cx:x(callout.index),cy:y(callout.price),r:3.5}),key));
   entries.push({key,kind:'point',badge:'•',title:callout.label,detail:'Свеча '+(callout.index+1)+' · '+fmt(callout.price)});
  });
  renderRail(svg,entries,true);
 }
 window.TDChartAnnotations={render};
})();
