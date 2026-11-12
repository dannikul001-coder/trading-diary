(function(){
 'use strict';
 const NS='http://www.w3.org/2000/svg';
 const element=(name,attributes={},text)=>{const node=document.createElementNS(NS,name);for(const [key,value] of Object.entries(attributes))node.setAttribute(key,String(value));if(text!==undefined)node.textContent=text;return node;};
 const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
 const finite=Number.isFinite;
 function render(svg,options,layout){
  const {left,right,top,bottom,x,y,start,end,dx,annotations}=layout;
  const groups={};
  for(const [name,selector] of [['bands','data-tc-stage-bands'],['segments','data-tc-stage-segments']]){let group=svg.querySelector('['+selector+']');if(!group){group=element('g',{[selector]:''});svg.insertBefore(group,svg.querySelector('[data-tc-candles]'));}group.replaceChildren();groups[name]=group;}
  const areas=svg.querySelector('[data-tc-zones]'),labels=svg.querySelector('[data-tc-area-labels]'),points=svg.querySelector('[data-tc-labels]');areas.replaceChildren();labels.replaceChildren();
  for(const node of points.querySelectorAll('.as-terminal-mark,.as-terminal-mark-text,.as-market-arrow,.as-market-point'))node.remove();
  if(!annotations)return;
  const validIndex=i=>Number.isInteger(i)&&i>=start&&i<=end;
  const occupied=[],requests=[],compact=right-left<360;
  const insidePrice=price=>finite(price)&&y(price)>=top-1&&y(price)<=bottom+1;
  for(const index of options.highlight||[])if(validIndex(index))groups.bands.append(element('rect',{class:'as-market-step-band',x:x(index)-dx*.48,y:top,width:Math.max(2,dx*.96),height:bottom-top,rx:2}));
  function horizontal(from=0,to=end){if(to<start||from>end)return null;return{from:Math.max(left,x(Math.max(from,start))-dx*.48),to:Math.min(right,x(Math.min(to,end))+dx*.48)};}
  for(const zone of options.zones||[]){
   const span=horizontal(zone.from??0,zone.to??end);if(!span||!finite(zone.low)||!finite(zone.high)||zone.low>zone.high)continue;
   const upper=Math.max(top,y(zone.high)),lower=Math.min(bottom,y(zone.low));if(lower<upper)continue;
   const kind=zone.kind||'neutral',group=element('g',{class:'as-terminal-area as-terminal-area-'+kind});
   group.append(element('rect',{class:'as-terminal-zone',x:span.from,y:upper,width:Math.max(2,span.to-span.from),height:Math.max(2,lower-upper)}));
   for(const yy of [upper,lower])group.append(element('line',{class:'as-terminal-bound',x1:span.from,x2:span.to,y1:yy,y2:yy}));
   areas.append(group);requests.push({anchorX:span.from+Math.min(12,(span.to-span.from)/2),anchorY:upper,text:compact?zone.low+'–'+zone.high:zone.label||'Область',fullText:zone.label,kind,align:'above'});
  }
  for(const level of options.levels||[]){
   const span=horizontal(level.from??0,level.to??end);if(!span||!insidePrice(level.price))continue;const yy=y(level.price);
   areas.append(element('line',{class:'as-terminal-bound as-market-reference-level',x1:span.from,x2:span.to,y1:yy,y2:yy}));
   if(!compact||!(options.zones||[]).some(zone=>zone.low===level.price||zone.high===level.price))requests.push({anchorX:span.from+8,anchorY:yy,text:compact?String(level.price):level.label||String(level.price),fullText:level.label,kind:'neutral',align:'above'});
  }
  for(const segment of options.segments||[]){
   if(![segment.fromIndex,segment.toIndex].every(Number.isInteger)||segment.toIndex<start||segment.fromIndex>end)continue;
   if(![segment.fromPrice,segment.toPrice].every(finite))continue;
   const a=Math.max(start,segment.fromIndex),b=Math.min(end,segment.toIndex),length=segment.toIndex-segment.fromIndex||1;
   const value=i=>segment.fromPrice+(segment.toPrice-segment.fromPrice)*(i-segment.fromIndex)/length;
   groups.segments.append(element('line',{class:'as-market-segment as-market-segment-'+(segment.kind||'structure'),x1:x(a),x2:x(b),y1:y(value(a)),y2:y(segment.fromIndex===segment.toIndex?segment.toPrice:value(b))}));
   if(segment.label&&!compact)requests.push({anchorX:x(b),anchorY:y(value(b)),text:segment.label,kind:'neutral',align:'above'});
  }
  const markers=(options.markers||[]).filter(m=>validIndex(m.index)&&finite(m.price));
  markers.forEach((marker,i)=>{
   const px=x(marker.index),py=y(marker.price),down=marker.shape==='arrowDown',arrow=down||marker.shape==='arrowUp',cy=arrow?Math.max(top+9,Math.min(bottom-9,py+(down?-29:29))):py;
   if(arrow){const sign=down?1:-1;points.append(element('line',{class:'as-market-arrow',x1:px,x2:px,y1:cy+sign*8,y2:py-sign*6}),element('path',{class:'as-market-arrow',d:'M'+(px-4)+' '+(py-sign*11)+'L'+px+' '+(py-sign*5)+'L'+(px+4)+' '+(py-sign*11),fill:'none'}),element('circle',{class:'as-market-point',cx:px,cy:py,r:2.5}));}
   const circle=element('circle',{class:'as-terminal-mark'+((options.highlight||[]).includes(marker.index)?' as-terminal-mark-active':''),cx:px,cy,r:8});
   circle.append(element('title',{},marker.label));points.append(circle,element('text',{class:'as-terminal-mark-text',x:px,y:cy+4,'text-anchor':'middle'},i+1));
   occupied.push({x:px-10,y:cy-10,width:20,height:20,isMarker:true});
   if(!compact&&(options.highlight||[]).includes(marker.index)&&!(options.callouts||[]).some(c=>c.index===marker.index))requests.push({anchorX:px,anchorY:py,text:marker.label,align:down?'above':'below',kind:'neutral'});
  });
  for(const callout of options.callouts||[])if(validIndex(callout.index)&&finite(callout.price))requests.push({anchorX:x(callout.index),anchorY:y(callout.price),text:callout.label,align:callout.align||'above',kind:callout.kind||'neutral'});
  const maxWidth=Math.min(210,right-left-4);
  const measuringGroup=element('g',{class:'as-terminal-zone-chip'}),measuringText=element('text',{class:'as-terminal-area-label'});measuringGroup.append(measuringText);labels.append(measuringGroup);
  const font=getComputedStyle(measuringText),context=document.createElement('canvas').getContext('2d');context.font=font.fontWeight+' '+font.fontSize+' '+font.fontFamily;
  const measure=value=>context.measureText(value).width;
  measuringGroup.remove();
  for(const request of requests){
   const words=String(request.text||'').split(/\s+/),lines=[];let line='';
   for(const word of words){if(measure((line+' '+word).trim())>maxWidth-16&&line){lines.push(line);line=word;}else line=(line+' '+word).trim();}if(line)lines.push(line);
   if(lines.length>3){lines.length=3;lines[2]+='…';}
   for(let i=0;i<lines.length;i++){const original=lines[i];while(measure(lines[i])>maxWidth-16&&lines[i].length>1)lines[i]=lines[i].slice(0,-1);if(lines[i]!==original){while(measure(lines[i]+'…')>maxWidth-16&&lines[i].length>1)lines[i]=lines[i].slice(0,-1);lines[i]+='…';}}
   const width=Math.min(maxWidth,Math.max(60,...lines.map(s=>measure(s)+16))),height=lines.length*15+12;
   const preferred=request.align==='below'?1:-1,candidates=[];
   for(const offset of [24,48,76,108,140,180,224,270,320])for(const direction of [preferred,-preferred])for(const side of [0,1,-1]){
    const xx=Math.max(left+2,Math.min(right-width-2,request.anchorX-width/2+side*(width/2+16))),yy=Math.max(8,Math.min(bottom-height,request.anchorY+(direction<0?-height-offset:offset)));
    const box={x:xx,y:yy,width,height},cost=occupied.reduce((sum,other)=>sum+overlap({...box,x:box.x-3,y:box.y-3,width:box.width+6,height:box.height+6},other),0)+Math.abs(xx+width/2-request.anchorX)*.015+Math.abs(yy+height/2-request.anchorY)*.005;
    candidates.push({...box,cost,collision:occupied.reduce((sum,other)=>sum+overlap({...box,x:box.x-3,y:box.y-3,width:box.width+6,height:box.height+6},other),0)});
   }
   candidates.sort((a,b)=>a.collision-b.collision||a.cost-b.cost);
   if(candidates[0]?.collision>0){
    for(let xx=left+2;xx<=right-width-2;xx+=16)for(let yy=8;yy<=bottom-height;yy+=6){
     const box={x:xx,y:yy,width,height},collision=occupied.reduce((sum,other)=>sum+overlap({...box,x:xx-3,y:yy-3,width:width+6,height:height+6},other),0);
     candidates.push({...box,collision,cost:Math.abs(xx+width/2-request.anchorX)*.015+Math.abs(yy+height/2-request.anchorY)*.005});
    }
    candidates.sort((a,b)=>a.collision-b.collision||a.cost-b.cost);
   }
   if(candidates[0]?.collision>0){
    for(const candidate of candidates)candidate.labelCollision=occupied.filter(other=>!other.isMarker).reduce((sum,other)=>sum+overlap({...candidate,x:candidate.x-3,y:candidate.y-3,width:candidate.width+6,height:candidate.height+6},other),0);
    candidates.sort((a,b)=>a.labelCollision-b.labelCollision||a.collision-b.collision||a.cost-b.cost);
   }
   const box=candidates[0];if(!box)continue;
   const targetX=Math.max(box.x+6,Math.min(box.x+box.width-6,request.anchorX)),targetY=request.anchorY<box.y?box.y:request.anchorY>box.y+box.height?box.y+box.height:box.y+box.height/2;
   labels.append(element('path',{class:'as-market-callout-line',d:'M'+request.anchorX+' '+request.anchorY+'L'+targetX+' '+targetY}));
   const group=element('g',{class:'as-terminal-zone-chip as-terminal-zone-chip-'+request.kind+' as-market-callout',transform:'translate('+box.x+' '+box.y+')'}),background=element('rect',{class:'as-terminal-zone-label-bg',width:box.width,height:box.height,rx:5});
   const text=element('text',{class:'as-terminal-area-label',x:7,y:17});lines.forEach((value,i)=>text.append(element('tspan',{x:7,dy:i?'15':'0'},value)));group.append(element('title',{},request.fullText||request.text),background,text);labels.append(group);occupied.push(box);
  }
 }
 window.TDChartAnnotations={render};
})();
