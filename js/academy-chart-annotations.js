(function(){
 'use strict';
 const NS='http://www.w3.org/2000/svg',finite=Number.isFinite;
 const fmt=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n);
 const element=(name,attributes={},text)=>{const node=document.createElementNS(NS,name);for(const [key,value] of Object.entries(attributes))node.setAttribute(key,String(value));if(text!==undefined)node.textContent=text;return node;};
 function dock(requests,top,bottom,height,gap){
  const rows=requests.slice().sort((a,b)=>a.anchorY-b.anchorY),minimum=top+3,maximum=bottom-height-3;
  rows.forEach((row,i)=>row.boxY=Math.max(minimum,Math.min(maximum,row.anchorY-height/2),i?rows[i-1].boxY+height+gap:minimum));
  if(rows.at(-1)?.boxY>maximum){rows.at(-1).boxY=maximum;for(let i=rows.length-2;i>=0;i--)rows[i].boxY=Math.min(rows[i].boxY,rows[i+1].boxY-height-gap);}
  return rows;
 }
 function renderReferenceLabels(svg,options,layout,requests){
  const {left,right,top,bottom,dataRight,annotationLeft,width,formatPrice}=layout,labels=svg.querySelector('[data-tc-area-labels]'),terminal=svg.closest('.as-terminal'),rail=terminal.querySelector('[data-tc-annotation-rail]'),mobile=width<480;
  const fontSize=mobile?10:12,labelHeight=mobile?23:27,labelGap=6,labelWidth=Math.max(22,right-annotationLeft-5),limit=Math.max(1,Math.floor((bottom-top)/(labelHeight+labelGap)));
  const ordered=requests.slice().sort((a,b)=>(b.priority||0)-(a.priority||0)).slice(0,limit);
  const activate=(group,key)=>{if(!key)return;group.setAttribute('role','button');group.setAttribute('tabindex','0');group.setAttribute('aria-label',group.getAttribute('aria-label')||key);group.onclick=event=>{event.stopPropagation();rail?.selectAnnotation(key);};group.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();rail?.selectAnnotation(key);}};};
  const textNode=(text,maxWidth)=>{const node=element('text',{class:'as-ref-chip-text',x:8,y:labelHeight/2+fontSize*.35,'font-size':fontSize},text);labels.append(node);while(node.getComputedTextLength()>maxWidth-16&&node.textContent.length>2)node.textContent=node.textContent.slice(0,-2)+'…';node.measuredWidth=node.getComputedTextLength();node.remove();return node;};
  const compact=request=>{if(!mobile)return request.text;const short={ob:'OB',fvg:'FVG',support:'Подд.',resistance:'Сопр.',invalid:'Отм.',target:'Цель'}[request.role];if(short)return short;if(request.role==='liquidity')return /H|верх/i.test(request.text)?'Лик.H':'Лик.L';return request.text.replace('Прежний ','Пред.').replace('Опорный ','Опор.').replace('Закрытие','C').replace(/Ориентир\s*/,'').replace('Верхняя','Верх').replace('Нижняя','Низ');};
  for(const request of dock(ordered,top,bottom,labelHeight,labelGap)){
   const key=request.key,text=textNode(compact(request),labelWidth),chipWidth=Math.min(labelWidth,Math.ceil(text.measuredWidth)+18),chipX=['ob','fvg'].includes(request.role)?annotationLeft:right-chipWidth-5,group=element('g',{class:'as-ref-chip','data-role':request.role||'neutral','data-annotation-target':key,transform:'translate('+chipX+' '+request.boxY+')','aria-label':request.fullText||request.text});
   group.append(element('title',{},request.fullText||request.text),element('rect',{class:'as-ref-chip-bg',width:chipWidth,height:labelHeight,rx:4}),text);
   labels.append(element('path',{class:'as-ref-chip-leader','data-role':request.role||'neutral',d:'M'+chipX+' '+(request.boxY+labelHeight/2)+'L'+(dataRight+3)+' '+request.anchorY}));labels.append(group);activate(group,key);
  }
  const unique=[];
  const rolePriority=role=>({invalid:100,liquidity:80,target:70,ob:60,fvg:60,support:60,resistance:60,neutral:10}[role]||10);
  for(const request of requests)for(const price of request.prices||[]){if(!Number.isFinite(price))continue;const existing=unique.find(item=>Math.abs(item.price-price)<1e-10);if(existing){if(rolePriority(request.role)>rolePriority(existing.role))Object.assign(existing,request,{price,anchorY:layout.y(price)});continue;}unique.push({...request,price,anchorY:layout.y(price)});}
  if(Number.isFinite(layout.currentValue)&&!unique.some(item=>Math.abs(item.price-layout.currentValue)<1e-10))unique.push({price:layout.currentValue,anchorY:layout.y(layout.currentValue),role:'neutral',fullText:'Выбранная цена'});
  const tagHeight=mobile?22:26,tagWidth=width-right-10,maxTags=Math.max(1,Math.floor((bottom-top)/(tagHeight+4)));
  for(const request of dock(unique.slice(0,maxTags),top,bottom,tagHeight,4)){
   const group=element('g',{class:'as-ref-price-tag','data-role':request.role||'neutral',transform:'translate('+(right+5)+' '+request.boxY+')','aria-label':(request.fullText||'Цена')+' · '+formatPrice(request.price)});
   if(request.key)group.setAttribute('data-annotation-target',request.key);
   const text=element('text',{class:'as-ref-chip-text',x:tagWidth/2,y:tagHeight/2+4,'text-anchor':'middle','font-size':mobile?10:12},formatPrice(request.price));text.style.fontSize=(mobile?10:12)+'px';
   group.append(element('title',{},group.getAttribute('aria-label')),element('rect',{class:'as-ref-chip-bg',width:tagWidth,height:tagHeight,rx:4}),text);labels.append(group);
   while(text.getComputedTextLength()>tagWidth-8&&Number(text.getAttribute('font-size'))>8){const size=Number(text.getAttribute('font-size'))-.5;text.setAttribute('font-size',size);text.style.fontSize=size+'px';}
   labels.insertBefore(element('path',{class:'as-ref-price-leader','data-role':request.role||'neutral',d:'M'+right+' '+request.anchorY+'L'+(right+5)+' '+(request.boxY+tagHeight/2)}),group);activate(group,request.key);
  }
  for(const node of svg.querySelectorAll('[data-tc-focus] .as-terminal-price-tag,[data-tc-focus] .as-terminal-tag-text'))node.style.display='none';
  rail?.showAnnotation(terminal.dataset.activeAnnotation);
 }
 function renderRail(svg,entries,annotations){
  const terminal=svg.closest('.as-terminal');let rail=terminal.querySelector('[data-tc-annotation-rail]');
  if(!rail){
   rail=document.createElement('details');rail.className='as-market-annotation-rail';rail.setAttribute('data-tc-annotation-rail','');rail.setAttribute('aria-label','Пояснения к разметке');svg.after(rail);
   const show=key=>{
    for(const node of svg.querySelectorAll('[data-annotation-target]')){node.classList.toggle('is-annotation-active',node.getAttribute('data-annotation-target')===key);if(node.getAttribute('role')==='button')node.setAttribute('aria-pressed',String(node.getAttribute('data-annotation-target')===terminal.dataset.activeAnnotation));}
    for(const button of rail.querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.getAttribute('data-annotation-target')===terminal.dataset.activeAnnotation));
   };
   rail.selectAnnotation=key=>{terminal.dataset.activeAnnotation=terminal.dataset.activeAnnotation===key?'':key;show(terminal.dataset.activeAnnotation);};
   rail.onclick=event=>{const button=event.target.closest('button[data-annotation-target]');if(button)rail.selectAnnotation(button.getAttribute('data-annotation-target'));};
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
   const summary=document.createElement('summary');summary.className='as-market-annotation-summary';summary.textContent='Обозначения и точные цены · '+entries.length;rail.append(summary);
   const heading=document.createElement('p');heading.className='as-market-annotation-help';heading.textContent='Нажми на обозначение, чтобы выделить зону, линию или точку.';rail.append(heading);
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
  const {left,right,top,bottom,x,y,start,end,dx,annotations}=layout,entries=[],inline=[],fmt=layout.formatPrice||((n)=>String(n));
  const groups={};
  for(const [name,selector] of [['bands','data-tc-stage-bands'],['segments','data-tc-stage-segments']]){let group=svg.querySelector('['+selector+']');if(!group){group=element('g',{[selector]:''});svg.insertBefore(group,svg.querySelector('[data-tc-candles]'));}group.replaceChildren();groups[name]=group;}
  const areas=svg.querySelector('[data-tc-zones]'),labels=svg.querySelector('[data-tc-area-labels]'),points=svg.querySelector('[data-tc-labels]');areas.replaceChildren();labels.replaceChildren();
  for(const node of points.querySelectorAll('.as-terminal-mark,.as-terminal-mark-text,.as-market-arrow,.as-market-point'))node.remove();
  if(!annotations){renderRail(svg,entries,false);return;}
  const validIndex=i=>Number.isInteger(i)&&i>=start&&i<=end;
  const target=(node,key)=>{node.setAttribute('data-annotation-target',key);return node;};
  const insidePrice=price=>finite(price)&&y(price)>=top-1&&y(price)<=bottom+1;
  for(const index of options.highlight||[])if(validIndex(index)){const bar=options.bars?.[index],bounded=layout.reference&&options.mode!=='indicator'&&bar,upper=bounded?Math.max(top,y(bar.h)-5):top,lower=bounded?Math.min(bottom,y(bar.l)+5):bottom;groups.bands.append(element('rect',{class:'as-market-step-band',x:x(index)-dx*.48,y:upper,width:Math.max(2,dx*.96),height:Math.max(2,lower-upper),rx:2}));}
  function horizontal(from=0,to=end){if(to<start||from>end)return null;return{from:Math.max(left,x(Math.max(from,start))-dx*.48),to:Math.min(right,x(Math.min(to,end))+dx*.48)};}
  (options.zones||[]).forEach((zone,index)=>{
   const span=horizontal(zone.from??0,zone.to??end);if(!span||!finite(zone.low)||!finite(zone.high)||zone.low>zone.high)return;if(layout.reference&&zone.project)span.to=right;
   const upper=Math.max(top,y(zone.high)),lower=Math.min(bottom,y(zone.low));if(lower<upper)return;
   const kind=zone.kind||'neutral',key='zone:'+index,group=target(element('g',{class:'as-terminal-area as-terminal-area-'+kind,'data-role':zone.role||kind}),key);
   group.append(element('rect',{class:'as-terminal-zone',x:span.from,y:upper,width:Math.max(2,span.to-span.from),height:Math.max(2,lower-upper)}));
   for(const yy of [upper,lower])group.append(element('line',{class:'as-terminal-bound',x1:span.from,x2:span.to,y1:yy,y2:yy}));areas.append(group);
   entries.push({key,kind:'zone '+kind,badge:String.fromCharCode(65+index),title:zone.label||'Выделенная зона',detail:'Границы: '+fmt(zone.low)+'–'+fmt(zone.high)});
   if(layout.reference&&zone.role&&zone.role!=='neutral')inline.push({key,role:zone.role,text:zone.shortLabel||zone.role.toUpperCase(),fullText:zone.label,anchorY:upper-10,prices:[zone.high,zone.low],priority:30});
  });
  (options.levels||[]).forEach((level,index)=>{
   const span=horizontal(level.from??0,level.to??end);if(!span||!insidePrice(level.price))return;const yy=y(level.price),key='level:'+index;
   areas.append(target(element('line',{class:'as-terminal-bound as-market-reference-level','data-role':level.role||'neutral',x1:span.from,x2:layout.reference?right:span.to,y1:yy,y2:yy}),key));
   entries.push({key,kind:'level',badge:'—',title:level.label||'Уровень',detail:'Цена: '+fmt(level.price)});
   if(layout.reference)inline.push({key,role:level.role||'neutral',text:level.shortLabel||'Уровень',fullText:level.label,anchorY:yy,prices:[level.price],priority:level.role==='neutral'?5:15});
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
   const key='marker:'+index,px=x(marker.index),py=y(marker.price),down=marker.shape==='arrowDown',arrow=!(marker.confirmed&&/^(?:H|L|HH|HL|LH|LL)$/.test(marker.semantic||''))&&(down||marker.shape==='arrowUp'),cy=arrow?Math.max(top+9,Math.min(bottom-9,py+(down?-29:29))):py;
   if(arrow){const sign=down?1:-1;points.append(target(element('line',{class:'as-market-arrow',x1:px,x2:px,y1:cy+sign*8,y2:py-sign*6}),key),target(element('path',{class:'as-market-arrow',d:'M'+(px-4)+' '+(py-sign*11)+'L'+px+' '+(py-sign*5)+'L'+(px+4)+' '+(py-sign*11),fill:'none'}),key),target(element('circle',{class:'as-market-point',cx:px,cy:py,r:2.5}),key));}
   const circle=target(element('circle',{class:'as-terminal-mark'+((options.highlight||[]).includes(marker.index)?' as-terminal-mark-active':''),cx:px,cy:marker.shortLabel?py:cy,r:marker.shortLabel?3:8}),key);circle.append(element('title',{},marker.label));points.append(circle);const showShort=!options.series?.length||['H','L','HH','HL','LH','LL','breakout','return','reaction','invalid'].includes(marker.semantic);if(!marker.shortLabel||showShort)points.append(element('text',{class:marker.shortLabel?'as-ref-swing':'as-terminal-mark-text',x:Math.min(px,layout.dataRight?layout.dataRight-5:px),y:marker.shortLabel?Math.max(top+12,Math.min(bottom-3,py+((marker.pivotSide==='high'||['H','HH','LH','high','first-high'].includes(marker.semantic)||down)?-14:20))):cy+4,'text-anchor':marker.shortLabel&&layout.dataRight&&px>layout.dataRight-45?'end':'middle'},marker.shortLabel||i+1));
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
  if(layout.reference)renderReferenceLabels(svg,options,layout,inline);
 }
 window.TDChartAnnotations={render};
})();
