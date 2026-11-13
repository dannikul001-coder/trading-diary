(function(){
 'use strict';
 const definitions=window.TD_MARKET_SCENES||{},registry=window.TD_STUDIO_LESSONS||{};
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n);
 const facts=detail=>detail&&typeof detail==='object'&&detail.rows?.length?'<section class="as-market-facts"><h3>'+esc(detail.title||'Проверка по ценам')+'</h3><dl>'+detail.rows.map(([label,value])=>'<div><dt>'+esc(label)+'</dt><dd>'+esc(value)+'</dd></div>').join('')+'</dl></section>':'';
 function paths(detail){
  if(detail?.kind!=='paths'||!detail.paths?.length)return '';
  return '<section class="as-market-paths"><h3>'+ (detail.paths.length===1?'Один возможный путь внутри свечи':'Два возможных пути внутри одной свечи') +'</h3><p>Это схемы возможного порядка цен, а не запись реальных сделок. Свеча сама по себе не сообщает, какой путь был пройден.</p><div>'+detail.paths.map(item=>{
   const lo=Math.min(...item.values),hi=Math.max(...item.values),span=hi-lo||1,points=item.values.map((v,i)=>(24+i*74)+','+(95-(v-lo)/span*65)).join(' ');
   return '<figure><figcaption>'+esc(item.label)+'</figcaption><svg viewBox="0 0 276 132" role="img" aria-label="'+esc(item.label)+'"><polyline points="'+points+'"/>'+item.values.map((v,i)=>'<circle cx="'+(24+i*74)+'" cy="'+(95-(v-lo)/span*65)+'" r="4"/><text x="'+(24+i*74)+'" y="119" text-anchor="middle">'+esc(fmt(v))+'</text>').join('')+'</svg></figure>';
  }).join('')+'</div></section>';
 }
 function render(host,key,options){
  const definition=definitions[key],config=definition.build(options);
  const awaitingAnswer=options.practice&&!options.revealed;
  const detail=awaitingAnswer&&key!=='6.3'?null:config.detail;
  if(!host.querySelector('[data-market-primary]'))host.innerHTML='<div data-market-primary></div><div data-market-secondary></div><div data-market-facts></div>';
  const primary=host.querySelector('[data-market-primary]'),secondary=host.querySelector('[data-market-secondary]'),factsHost=host.querySelector('[data-market-facts]'),dispose=[];
  const mount=(target,settings)=>dispose.push(window.TDTerminalChart.mount(target,{authored:true,chartRole:'context',height:420,mobileHeight:340,mobileLimit:40,...settings}));
  // Keep the problem's price history and stated boundaries available. Worked
  // labels and calculated panels return once the learner submits an answer.
  const chart=awaitingAnswer?{
   ...config,
   caption:'Самостоятельный участок',
   markers:[],callouts:[],segments:[],
   levels:key==='0.1'?[]:config.levels,
   zones:config.detail?.kind==='aggregation'?[]:config.zones
  }:config;
  mount(primary,{...chart,id:'market-primary',chartRole:'context'});
  secondary.hidden=true;
  if(detail&&typeof detail==='object'){
   if(detail.kind==='candle'&&detail.bar){
    secondary.hidden=false;
    const b=detail.bar,forming=!!detail.forming;
    const labels=[['Открытие',b.o],['Максимум',b.h],['Минимум',b.l],[forming?'Сейчас':'Закрытие',b.c]];
    const grouped=new Map();for(const [name,price] of labels)grouped.set(price,[...(grouped.get(price)||[]),name]);
    mount(secondary,{id:'market-detail',chartRole:'detail',bars:[b],caption:detail.title||'Увеличенная свеча из общей истории',intervalLabel:'увеличение свечи '+((detail.index??config.bars.length-1)+1)+' · те же цены',defaultLimit:1,mobileLimit:1,focus:0,directOHLC:false,forming,height:300,mobileHeight:300,markers:[...grouped].map(([price,names])=>({index:0,price,label:names.join(' / ')+' '+fmt(price)})),callouts:[...grouped].map(([price,names])=>({index:0,price,label:names.join(' / ')+' '+fmt(price)}))});
   }else if(detail.kind==='aggregation'&&detail.bars?.length){
    secondary.hidden=false;
    mount(secondary,{id:'market-detail',chartRole:'detail',bars:detail.bars,caption:detail.title,intervalLabel:'3 минуты · только завершённые группы',defaultLimit:detail.bars.length,mobileLimit:detail.bars.length,focus:detail.focusGroup,highlight:[detail.focusGroup],timeframeMinutes:3,startTime:detail.startTime,height:280,mobileHeight:270,markers:[{index:detail.focusGroup,price:detail.bars[detail.focusGroup].c,label:'Та же группа · закрытие '+fmt(detail.bars[detail.focusGroup].c)}]});
   }else if(detail.kind==='atr'&&detail.values?.length){
    secondary.hidden=false;
    mount(secondary,{id:'market-detail',chartRole:'detail',mode:'indicator',bars:config.bars,caption:'ATR(3) · средний истинный диапазон',intervalLabel:config.intervalLabel,defaultLimit:config.defaultLimit,focus:detail.index,series:[{label:'ATR(3)',values:detail.values}],height:240,mobileHeight:230});
   }
  }
  if(secondary.hidden)secondary.replaceChildren();
  factsHost.innerHTML=facts(detail)+paths(detail);
  const description=config.narration||definition.describe?.(options);
  if(description)options.onDescription?.(typeof description==='string'?{body:description}:description);
  if(options.context?.startsWith('example:'))options.onExampleChange?.(description?.body||definition.teaching.example);
  return()=>dispose.forEach(fn=>fn?.());
 }
 for(const [key,definition] of Object.entries(definitions)){
  registry[key]={...registry[key],...definition,marketAuthored:true,kind:definition.kind||registry[key]?.kind||'price',render:(host,options={})=>render(host,key,options)};
 }
 // All consumers, including example thumbnails, read the same authored fixture.
 const price=window.TD_STUDIO_PRICE,legacy={scene:price.scene,visible:price.visible,terminalConfig:price.terminalConfig};
 price.scene=(key,practice=false)=>definitions[key]?{...definitions[key],bars:practice?definitions[key].practiceBars:definitions[key].bars,cut:practice?definitions[key].practiceCut:definitions[key].cut}:legacy.scene(key,practice);
 price.visible=(key,options={})=>{
  if(!definitions[key])return legacy.visible(key,options);
  const c=definitions[key].build(options),cut=options.practice?definitions[key].practiceCut:definitions[key].cut;
  return{bars:c.bars,step:options.step||0,count:c.bars.length,forming:!!c.forming,hidden:!!options.practice&&!options.revealed,futureHidden:c.bars.length<=cut,zone:c.zone};
 };
 price.terminalConfig=(key,options={})=>definitions[key]?definitions[key].build(options):legacy.terminalConfig(key,options);
})();
