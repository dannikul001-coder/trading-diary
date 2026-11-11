(function(){
 'use strict';
 const previousMount=window.LearningLabs.mount;
 const trades=[{stake:100,success:true},{stake:200,success:false},{stake:100,success:true}];
 function reconcile({opening,deposit,withdrawal,payout}){
  if(![opening,deposit,withdrawal,payout].every(value=>typeof value==='number'&&Number.isFinite(value)&&value>=0))throw new Error('Заполни все поля неотрицательными числами.');
  const integer=value=>{if(!Number.isSafeInteger(value))throw new Error('Число слишком велико для этого учебного расчёта.');return value;},cents=value=>integer(Math.round(value*100)),turnoverCents=trades.reduce((sum,trade)=>sum+cents(trade.stake),0),returnedCents=trades.reduce((sum,trade)=>sum+(trade.success?cents(trade.stake)+integer(Math.round(trade.stake*payout)):0),0),profitCents=integer(returnedCents-turnoverCents),closingCents=integer(cents(opening)+cents(deposit)-cents(withdrawal)+profitCents);
  return {closed:trades.length,successful:2,successRate:2/3,turnover:turnoverCents/100,returned:returnedCents/100,profit:profitCents/100,closing:closingCents/100};
 }
 function mount(host,key){
  if(key!=='15.1')return previousMount(host,key);
  host.className='ml-lab';host.dataset.attachmentLab='journal';
  host.innerHTML='<h3>Сверь прибыль и изменение капитала</h3><p>Отдельный учебный журнал из трёх закрытых сделок. Расходов и открытых позиций здесь нет. Это смоделированные числа, которые не связаны с твоим счётом.</p><div class="ml-journal-inputs"><label>Начальный капитал<input type="number" min="0" step="0.01" value="1000" data-lj-opening></label><label>Пополнение<input type="number" min="0" step="0.01" value="250" data-lj-deposit></label><label>Вывод<input type="number" min="0" step="0.01" value="100" data-lj-withdrawal></label><label>Чистая выплата за успех, %<input type="number" min="0" step="0.01" value="80" data-lj-payout></label></div><table class="ml-journal-table"><caption>Каждая строка — одна закрытая сделка</caption><thead><tr><th>Ставка</th><th>Исход</th><th>Чистый результат</th></tr></thead><tbody data-lj-rows></tbody></table><output data-lj-output aria-live="polite"></output><p>Измени вывод или пополнение: итоговый капитал изменится, а результат сделок и доля успехов останутся прежними. Затем измени выплату: доля успехов прежняя, денежный результат другой. Возвращённая сумма включает исходные ставки успешных сделок, поэтому её нельзя целиком назвать прибылью.</p>';
  const q=selector=>host.querySelector(selector),money=value=>value.toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2});
  function update(){const output=q('output');try{
    const input=Object.fromEntries(['opening','deposit','withdrawal','payout'].map(name=>{const field=q(`[data-lj-${name}]`);if(!field.value.trim()||!field.validity.valid)throw new Error('Заполни все поля неотрицательными числами.');return [name,Number(field.value)];})),result=reconcile(input);
    q('[data-lj-rows]').innerHTML=trades.map(trade=>`<tr><td>${money(trade.stake)}</td><td>${trade.success?'Успех':'Проигрыш'}</td><td>${money(trade.success?trade.stake*input.payout/100:-trade.stake)}</td></tr>`).join('');
    output.dataset.profit=String(result.profit);output.dataset.closing=String(result.closing);output.dataset.successRate=String(result.successRate);
    output.textContent=`Закрыто ${result.closed} сделки, успешных ${result.successful}: ${(result.successRate*100).toFixed(2)}%. Оборот ставок ${money(result.turnover)}. Вернулось ${money(result.returned)}. Чистый результат ${money(result.profit)} = вернулось − оборот. Итоговый капитал ${money(result.closing)} = ${money(input.opening)} + ${money(input.deposit)} − ${money(input.withdrawal)} + (${money(result.profit)}).`;
  }catch(error){q('[data-lj-rows]').replaceChildren();for(const name of ['profit','closing','successRate'])delete output.dataset[name];output.textContent=error.message;}}
  host.addEventListener('input',update);update();
 }
 window.LearningLabs.mount=mount;
 window.LearningJournalLab={reconcile};
})();
