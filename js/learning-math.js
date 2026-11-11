(function(){
  'use strict';
  const finite=n=>typeof n==='number'&&Number.isFinite(n);
  function payoutModel(stake,payout,probability){if(!finite(stake)||!finite(payout)||!finite(probability)||stake<0||payout<0||probability<0||probability>1)throw new Error('Проверь сумму, выплату и вероятность от 0 до 100%.');return {profit:stake*payout,loss:-stake,breakEven:1/(1+payout),expectation:stake*(probability*payout-(1-probability))};}
  function series(base,steps,payout){if(!finite(base)||base<0||!finite(payout)||payout<0||!steps.length||!steps.every(v=>finite(v)&&v>=0))throw new Error('Некорректные параметры серии.');const stakes=steps.map(v=>base*v/100),sum=stakes.reduce((a,b)=>a+b,0);return {stakes,totalLoss:sum,lastWinNet:stakes.at(-1)*payout-stakes.slice(0,-1).reduce((a,b)=>a+b,0)};}
  function recovery(drawdown){if(!finite(drawdown)||drawdown<0||drawdown>=1)throw new Error('Просадка должна быть от 0 до менее 100%.');return drawdown/(1-drawdown);}
  function mount(host,key){
    const configs={
      '14.1':['Ставка и выплата',['base','payout']],
      '14.2':['Предположение и математическое ожидание',['base','payout','p']],
      '14.3':['Сравни три лестницы риска',['base','payout']],
      '14.4':['От какой суммы считать восстановление',['base','d']],
      '14.5':['Помещается ли следующий риск в лимит',['limit','lost','open','next']],
      '14.6':['Расходы при повторении чужого метода',['base','payout','fee']]
    },fields={base:['Ставка / исходный капитал',100],payout:['Чистая выплата за успех, %',80],p:['Предполагаемая доля успехов, %',60,100],d:['Просадка, %',20,99.99],limit:['Дневной предел потерь, сумма',500],lost:['Уже потеряно сегодня, сумма',100],open:['Риск открытых позиций, сумма',200],next:['Новая возможная потеря, сумма',250],fee:['Расход за каждый исход, сумма',10]},config=configs[key];
    if(!config)return;
    host.innerHTML=`<section class="lm-lab"><h3>${config[0]}</h3><p>Учебные числа. Изменяй только параметры текущего вопроса. Проценты серий считаются от неизменного исходного капитала.</p><div>${config[1].map(name=>{const [originalLabel,value,max]=fields[name],label=name==='base'?(['14.3','14.4'].includes(key)?'Исходный капитал, сумма':'Ставка, сумма'):originalLabel;return `<label>${label}<input type="number" min="${name==='base'?'0.01':'0'}" ${max===undefined?'':`max="${max}"`} value="${value}" step="0.01" data-lm-${name}></label>`;}).join('')}</div><output data-lm-output aria-live="polite"></output></section>`;
    const output=host.querySelector('[data-lm-output]'),read=name=>{const input=host.querySelector(`[data-lm-${name}]`),value=Number(input.value);if(!input.value.trim()||!finite(value)||value<0||!input.validity.valid)throw new Error('Заполни поля допустимыми неотрицательными числами.');return value;},money=n=>n.toFixed(2);
    function update(){try{
      const v=Object.fromEntries(config[1].map(name=>[name,read(name)])),rate=v.payout/100;
      if(key==='14.1'){const m=payoutModel(v.base,rate,0);output.textContent=`Ставка ${money(v.base)}: успех +${money(m.profit)}, проигрыш ${money(m.loss)}. Точка безубыточности без расходов: ${(m.breakEven*100).toFixed(2)}% успехов. Это требование к результатам, а не измеренная вероятность.`;}
      if(key==='14.2'){const m=payoutModel(v.base,rate,v.p/100);output.textContent=`Предположили ${v.p}% успехов. Средний денежный исход модели: ${money(m.expectation)} на попытку = ставка × (доля успехов × выплата − доля потерь). Реальная серия может отличаться. Введённая доля не подтверждается этим расчётом.`;}
      if(key==='14.3'){const versions=[['1–2–4',[1,2,4]],['1–2–6',[1,2,6]],['2–4–8–16–32',[2,4,8,16,32]]];output.textContent=versions.map(([name,steps])=>{const s=series(v.base,steps,rate);return `Серия ${name}%: ставки ${s.stakes.map(money).join(' → ')}; все проиграли: −${money(s.totalLoss)}; последний выиграл после остальных потерь: ${money(s.lastWinNet)}.`;}).join('\n')+' Удвоение не гарантирует возмещение при выплате меньше 100%. Смена пары не обнуляет уже потерянное.';}
      if(key==='14.4'){const d=v.d/100,remaining=v.base*(1-d);output.textContent=`Осталось ${money(remaining)} из ${money(v.base)}. Чтобы вернуться к исходной сумме, нужно ${money(v.base-remaining)}: ${(recovery(d)*100).toFixed(2)}% от остатка. Процент восстановления считают от уменьшившегося капитала.`;}
      if(key==='14.5'){const total=v.lost+v.open+v.next;output.textContent=`Уже потеряно ${money(v.lost)} + возможная потеря открытого ${money(v.open)} + новый риск ${money(v.next)} = ${money(total)}. Предел ${money(v.limit)}. ${total>v.limit?'Превышение на '+money(total-v.limit)+': этот риск не помещается в заданный предел.':'В пределах выбранного ограничения; запас '+money(v.limit-total)+'.'} Предел не сбрасывается с началом новой серии.`;}
      if(key==='14.6'){const win=v.base*rate-v.fee,loss=v.base+v.fee,denominator=win+loss;output.textContent=`В этой модели одинаковый расход ${money(v.fee)} платится за каждый исход. Чистый успех ${money(win)}, неудача −${money(loss)}. ${win<=0?'Успешный исход также не даёт положительного результата.':`Безубыточная доля успехов ${(loss/denominator*100).toFixed(2)}%.`} Реальные комиссии могут начисляться иначе. Для сравнения с автором нужны твои исполнения и твои расходы.`;}
    }catch(error){output.textContent=error.message;}}
    host.addEventListener('input',update);update();
  }
  window.LearningMath={payoutModel,series,recovery,mount};
})();
