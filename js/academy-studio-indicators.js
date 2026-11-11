(function(){
  'use strict';
  const I=window.LearningIndicators,course=window.TRADING_COURSE_V1;
  if(!I||!course)return;
  const registry=window.TD_STUDIO_LESSONS=window.TD_STUDIO_LESSONS||{};
  const names={ma:'Скользящие средние',rsi:'RSI — относительная сила',stochastic:'Stochastic — положение в диапазоне',macd:'MACD — разность средних',fractals:'Фракталы: центр и подтверждение',keltner:'Канал Кельтнера',bollinger:'Полосы Боллинджера',ao:'Awesome Oscillator (AO)',momentum:'Momentum — сравнение закрытий',supertrend:'Supertrend',vortex:'Vortex: VI+ и VI−',sar:'Parabolic SAR',demarker:'DeMarker',regression:'Регрессионный канал',heikin:'Heikin Ashi',donchian:'Канал Donchian',stc:'Schaff Trend Cycle (STC)','dual-supertrend':'Два Supertrend на Heikin Ashi'};
  const explanations={
    ma:['Средняя превращает несколько последних цен в одно число. Она помогает заметить общий ход, когда отдельные свечи отвлекают колебаниями.','Сначала найди свечи, затем линию среднего. Быстрая линия использует меньше свечей и обычно поворачивает раньше медленной.','Пересечение','Вчера быстрая линия была ниже медленной, сегодня закрылась выше: это новое пересечение, а не просто положение выше.'],
    votes:['Сводка — короткий список ответов «да/нет», вычисленных по цене. Она экономит место, но скрывает устройство отдельных правил.','Прочитай каждый голос под панелями. Проверь, какие из них используют те же закрытия.','Зависимые показатели','Несколько расчётов могут повторять одну и ту же информацию о цене.'],
    rsi:['RSI показывает, какие недавние изменения закрытий преобладали: повышения или снижения. Это шкала силы прошедшего движения, а не вероятность следующего роста.','Смотри на линию RSI и подписанные уровни 30 и 70. Выше 70 — недавние повышения преобладали; это ещё не команда продавать.','Порог','Заранее выбранное число, с которым сравнивают значение линии.'],
    stochastic:['Stochastic показывает, насколько близко закрытие к верхней или нижней части недавнего диапазона. Две линии сглаживают это положение разными способами.','Сначала прочитай %K и %D, затем уровни 20/80. Положение одной линии выше другой не означает, что они пересеклись именно сейчас.','Диапазон окна','Расстояние между наибольшим максимумом и наименьшим минимумом выбранных свечей.'],
    macd:['MACD сравнивает быструю и медленную средние цены. Положительная линия означает, что быстрая средняя выше медленной. Столбцы сравнивают сам MACD с его сигнальной линией.','Найди нулевую горизонталь. Затем сравни сплошную линию MACD с пунктирной сигнальной: их пересечение — другое событие, чем переход MACD через ноль.','Сигнальная линия','Сглаженное значение MACD; гистограмма показывает разность между ними.'],
    fractals:['Фрактал отмечает локальную вершину или впадину: центральная свеча выделяется среди двух соседей слева и двух справа.','Метка стоит на центре, но получить её можно только после двух правых закрытий. Последние две свечи ещё нельзя подтвердить как центры.','Подтверждение','Момент, когда все необходимые для правила данные уже доступны.'],
    keltner:['Канал Кельтнера показывает среднюю цену и обычный размер колебаний вокруг неё. Когда диапазоны свечей растут, канал может расширяться.','Найди середину и две крайние линии. Сравни закрытие с верхней и нижней границей; касание границы само по себе не обещает возврат.','ATR','Сглаженный диапазон свечей с учётом разрыва относительно предыдущего закрытия.'],
    bollinger:['Полосы Боллинджера показывают, насколько закрытия разбросаны вокруг их среднего. Здесь две пары полос: ближняя и дальняя, с общим центром.','Сначала найди среднюю линию, затем ближние и дальние границы. Выход и последующее возвращение внутрь — два разных события.','Стандартное отклонение σ','Численная мера разброса закрытий относительно среднего.'],
    ao:['AO сравнивает короткое и длинное средние середин свечей. Высота столбца показывает их разность.','Смотри отдельно на сторону относительно нуля и на изменение высоты от предыдущего столбца. Положительный столбец тоже может уменьшаться.','Медианная цена свечи','Здесь это полусумма максимума и минимума, а не средняя цена всех сделок.'],
    momentum:['Momentum сравнивает цену сейчас с ценой десять свечей назад. В этой версии 100 означает, что обе цены равны.','Выше 100 — текущее закрытие выше прошлого; ниже 100 — ниже. Изменение наклона линии не равно переходу через 100.','База сравнения','Закрытие десять свечей назад, с которым сопоставляют текущее.'],
    supertrend:['Supertrend строит переключаемую линию на расстоянии, связанном с диапазоном свечей. Линия помогает описать текущую сторону расчётного фильтра.','Сравни закрытие с линией. Проверь, поменялась ли сторона после последнего закрытия, а не только где линия находится сейчас.','Множитель ATR','Коэффициент, который задаёт расстояние расчётной границы от середины свечи.'],
    vortex:['Vortex сравнивает два вида движения между соседними свечами. Линии VI+ и VI− позволяют увидеть, какая величина сейчас больше.','Прочитай обе линии. Новое пересечение проверяют по двум соседним закрытиям; линия выше другой — это состояние, которое могло начаться раньше.','Нормировка','Деление движений на общий диапазон окна для сопоставимой шкалы.'],
    sar:['Parabolic SAR рисует точки, которые следуют за выбранным направлением цены и могут перейти на другую сторону. Расстояние меняется по заранее заданному алгоритму.','Найди точки и сравни их с ценой. Смена стороны точки и изменение последовательности вершин/впадин — разные проверки.','Ускорение AF','Коэффициент сближения следующей точки с крайним значением выбранного направления.'],
    demarker:['DeMarker сравнивает обновления соседних максимумов и минимумов. Рост показателя означает относительное преобладание обновлений вверх в выбранном окне.','Смотри на шкалу 0–100 и подписанные уровни 20/80. Порог, его пересечение и последующий разворот цены — разные события.','Обновление экстремума','Насколько текущий максимум выше предыдущего или текущий минимум ниже предыдущего.'],
    regression:['Регрессионный канал приближает последние закрытия прямой и измеряет их отклонения от неё. Он помогает описать наклон и разброс выбранного окна.','Линия здесь соединяет концы отдельных окон по 20 свечей. Сравни цену с серединой и границами; не переноси окно после результата.','Остаток','Разность фактического закрытия и значения подобранной прямой.'],
    heikin:['Heikin Ashi заменяет исходные свечи вычисленными. Сглаженный цвет легче читать, но он может отличаться от цвета реальной свечи.','Сравни исходное и вычисленное закрытия. Для результата реальной сделки нужна исходная цена, а не нарисованное HA-закрытие.','Синтетическая цена','Результат преобразования исходных цен; сделка по такой цене не подразумевается.'],
    donchian:['Donchian обводит наибольший максимум и наименьший минимум последних свечей. Середина канала находится ровно между этими границами.','Здесь окно 22 и текущая свеча включена. Для проверки выхода за прежнюю границу сравнивай с каналом предыдущей свечи.','Окно','Последние n свечей, участвующие в текущем расчёте.'],
    stc:['STC превращает разность средних в сглаженную шкалу от 0 до 100. Это ещё один способ описать изменение ценового движения.','Найди уровни 35/65. Наклон линии, пересечение порога и обещание будущего исхода — разные вещи; последнее индикатор не даёт.','Цикл расчёта','Окно нормировки внутри цепочки преобразований, а не гарантированный период повторения рынка.'],
    'dual-supertrend':['Сначала реальные свечи преобразуют в Heikin Ashi. Затем по этим вычисленным свечам строят два Supertrend с разной чувствительностью.','Проследи каждую линию отдельно: когда первая поменяла сторону и когда вторая согласовалась. Не заменяй реальную цену исполнения HA-ценой.','Согласование фильтров','Одновременное выполнение двух заданных условий; это не доказательство их независимости.']
  };
  const combinationSteps={
    '13.1':['На закрытии сравни SMA(2) и SMA(5).','Для пересечения проверь также предыдущее закрытие.','Если версия требует фрактал, дождись двух правых свечей; без него это другая версия.'],
    '13.2':['Отметь Close внутри канала, выше него или ниже.','Отдельно сравни VI+ и VI− и проверь новое пересечение.','Зафиксируй, нужны ли оба условия; при конфликте не выбирай удобную панель.'],
    '13.3':['До исхода выбери гипотезу: возврат у области или продолжение.','Укажи область на цене и положение RSI.','Назови событие подтверждения выбранной гипотезы; число RSI не выбирает её за тебя.'],
    '13.4':['Проверь, находится ли %K в выбранной зоне 20/80.','Проверь новое пересечение %K/%D по двум закрытиям.','Отдельно опиши направление вершин и впадин цены.'],
    '13.5':['Сравни Close с линией Supertrend.','Сравни Close со SMA(5).','Отметь все переключения, включая те, за которыми движение не продолжилось.'],
    '13.6':['Отметь выход за выбранную ближнюю или дальнюю полосу.','Дождись закрытия обратно внутри именно этой полосы.','Не подменяй версию возврата версией продолжения после результата.'],
    '13.8':['Сначала проверь, что линии рассчитаны по Heikin Ashi.','Отметь смену стороны ATR(21) ×1 и ATR(14) ×2 отдельно.','Проверь согласование на закрытии, результат считай по исходным ценам.'],
    '13.10':['Отметь касание границы Donchian(22).','Отдельно запиши наклон STC и положение относительно 35/65.','Заранее выбери событие: изменение наклона или пересечение порога; неизвестные настройки оставь неизвестными.']
  };
  const frames=new WeakMap(),history=new WeakMap();
  const canAnimate=(before,after)=>!!before&&!(before.revealed&&!after.revealed)&&before.count<=after.count;
  function animateGeometry(host,meta){
    if(!host.querySelectorAll)return;
    const nodes=Array.from(host.querySelectorAll('.as-indicator-svg path,.as-indicator-svg rect,.as-indicator-svg line,.as-indicator-svg circle'));
    const attributes=['x','y','width','height','x1','x2','y1','y2','cx','cy','r','d'];
    const current=nodes.map(node=>({tag:node.tagName,attrs:Object.fromEntries(attributes.map(a=>[a,node.getAttribute(a)]).filter(v=>v[1]!==null))}));
    const before=history.get(host);history.set(host,{...meta,geometry:current});
    if(!canAnimate(before,meta)||!window.requestAnimationFrame||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
    const changes=[];
    current.forEach((target,i)=>{const old=before.geometry[i];if(!old||old.tag!==target.tag)return;for(const [attr,value] of Object.entries(target.attrs)){
      const oldValue=old.attrs[attr];if(oldValue===undefined||oldValue===value)continue;
      if(attr==='d'){
        // Resample an existing polyline to the target vertex count; interpolate
        // actual coordinates rather than fading two chart images.
        if(!/^[ML\d., eE+\-]+$/.test(value)||!oldValue||!value)continue;
        const points=s=>Array.from(s.matchAll(/[ML]([\d.eE+\-]+),([\d.eE+\-]+)/g),m=>[Number(m[1]),Number(m[2])]),a=points(oldValue),b=points(value);
        if(!a.length||!b.length||[...a.flat(),...b.flat()].some(v=>!Number.isFinite(v)))continue;
        const source=b.map((_,j)=>{const t=j*(a.length-1)/Math.max(1,b.length-1),k=Math.floor(t),z=a[Math.min(k+1,a.length-1)];return a[k].map((v,n)=>v+(z[n]-v)*(t-k));});
        const commands=Array.from(value.matchAll(/[ML]/g),m=>m[0]);changes.push({node:nodes[i],attr,at:t=>b.map((p,j)=>commands[j]+p.map((v,n)=>source[j][n]+(v-source[j][n])*t).join(',')).join(' ')});
      }else{const a=Number(oldValue),b=Number(value);if(Number.isFinite(a)&&Number.isFinite(b))changes.push({node:nodes[i],attr,at:t=>a+(b-a)*t});}
    }});
    if(!changes.length)return;
    let start;const tick=time=>{if(start===undefined)start=time;const t=Math.min(1,(time-start)/260),ease=1-(1-t)**3;for(const c of changes)c.node.setAttribute(c.attr,c.at(ease));if(t<1)frames.set(host,window.requestAnimationFrame(tick));else frames.delete(host);};
    for(const c of changes)c.node.setAttribute(c.attr,c.at(0));frames.set(host,window.requestAnimationFrame(tick));
  }
  // One declared synthetic sequence for all calculations: a rise, range,
  // expansion and pullback. It is a comparison fixture, not a backtest.
  const closes=Array.from({length:96},(_,i)=>i<24?100+i*.55+Math.sin(i)*1.2:i<48?113+Math.sin(i*.85)*2:i<72?113+(i-48)*.8+Math.sin(i)*2:132-(i-72)*.65+Math.sin(i)*2.4);
  const bars=closes.map((c,i)=>{const o=i?closes[i-1]:99;return {o,c,h:Math.max(o,c)+1+(i%4)*.3,l:Math.min(o,c)-.8-(i%3)*.25};});
  // A separate practice fixture prevents the worked continuation becoming the
  // answer to the subsequent independent attempt. No lesson-key seeds.
  const practiceCloses=Array.from({length:96},(_,i)=>i<30?110+Math.sin(i*.6)*3:i<60?110+(i-30)*.65+Math.sin(i*.8)*1.4:129-(i-60)*.5+Math.sin(i*.7)*2);
  const practiceBars=practiceCloses.map((c,i)=>{const o=i?practiceCloses[i-1]:109;return {o,c,h:Math.max(o,c)+1.2,l:Math.min(o,c)-1};});
  const specs={
    '4.2':['ma','Сглаживание закрытий','SMA(3) = сумма трёх закрытий / 3.','Сначала меняется цена, затем средняя. Осциллятор RSI вынесен на отдельную шкалу.','ma','rsi'],
    '4.3':['ma','Зависимые факторы','SMA и EMA получают одни закрытия; RSI использует изменения тех же закрытий.','Согласование трёх производных одной цены не равно трём независимым источникам.','ma','rsi'],
    '9.5':['votes','Из чего состоит сводка','Учебные голоса: Close выше SMA(5), SMA(2) выше SMA(5), RSI(14) выше 50.','Это явно заданная демонстрационная сводка, а не копия оценки платформы. Правило 2 из 3 не доказывает преимущество.','ma','rsi'],
    '11.1':['rsi','Повышения и снижения','RSI = 100 − 100/(1 + сглаженные повышения / сглаженные снижения).','Сравни периоды 5 и 14; уровни 30/70 не обещают разворот.','rsi'],
    '11.2':['stochastic','Закрытие внутри окна','Сырой %K = 100 × (Close − Low₁₄)/(High₁₄ − Low₁₄); затем сглаживание 3 и %D(3).','Различай положение в диапазоне, пересечение линий и изменение структуры.','stochastic'],
    '11.3':['macd','Разность средних','MACD = EMA(12) − EMA(26); сигнал EMA(9); гистограмма = MACD − сигнал.','Нулевой уровень MACD и пересечение сигнала — разные события.','macd'],
    '11.4':['ma','Вес последней цены','SMA равномерно взвешивает окно; EMA использует α = 2/(n+1).','Переключи SMA/EMA при одинаковых периодах 2/5: правило и значения изменятся.','ma'],
    '11.5':['fractals','Подтверждение справа','Верхний фрактал: High центра строго выше двух High слева и двух справа.','Метка относится к центральной свече, но становится доступна только после второй правой.','fractals'],
    '11.6':['keltner','Цена и True Range','Центр EMA(19), границы ±2 ATR(17); ATR сглаживается по Уайлдеру.','Ширина зависит от диапазонов и разрывов относительно предыдущего Close, не от σ закрытий.','keltner'],
    '11.7':['bollinger','Разброс закрытий','SMA(25) и полосы ±2,2σ / ±2,8σ; σ рассчитывается с делителем n.','Обе ширины имеют общий центр; цена может двигаться вдоль полосы.','bollinger'],
    '11.8':['ao','Медианная цена','AO = SMA₅((H+L)/2) − SMA₃₄((H+L)/2).','Знак относительно нуля и рост относительно предыдущего столбца — разные признаки.','ao'],
    '11.9':['momentum','Сравнение с прошлым','Здесь Momentum = 100 × Close / Close десять свечей назад. Нейтральный уровень 100.','У разностной версии нейтральный уровень 0: нельзя смешивать шкалы.','momentum'],
    '11.10':['supertrend','Переключаемая линия','Учебная версия: True Range → ATR(10) → границы с множителем 3 → переключение по Close.','Одна смена стороны не гарантирует продолжения.','supertrend'],
    '11.11':['vortex','Межсвечные движения','VI+ = Σ|Highᵢ − Lowᵢ₋₁| / ΣTR; VI− = Σ|Lowᵢ − Highᵢ₋₁| / ΣTR, окно 14.','Пересечение двух линий описывает расчёт, а не независимый поток заявок.','vortex'],
    '11.12':['sar','Точка и ускорение','SARₜ = SARₜ₋₁ + AF × (экстремум − SARₜ₋₁), с ограничениями и сбросом при смене.','AF: начало 0,02, шаг 0,02, предел 0,2. Смена точки и смена структуры различаются.','sar'],
    '11.13':['demarker','Обновление экстремумов','DeMax=max(Hᵢ−Hᵢ₋₁,0); DeMin=max(Lᵢ₋₁−Lᵢ,0); 100 × SMA(DeMax)/(SMA(DeMax)+SMA(DeMin)).','Сравни окна 14/10. Уровни 20/80 на шкале 0–100 соответствуют 0,2/0,8.','demarker'],
    '11.14':['regression','Скользящее окно регрессии','Каждый конец линии использует последние 20 закрытий: OLS по индексам; границы ±2σ остатков.','Это последовательность концов окон, не одна прямая по всему показанному отрезку. Окно не переносим по исходу.','regression'],
    '11.15':['heikin','Вычисленные OHLC','HA Close=(O+H+L+C)/4; HA Open=(предыдущие HA Open+HA Close)/2.','Сравни исходные и вычисленные свечи. Синтетическое закрытие не является ценой исполнения.','heikin'],
    '11.16':['donchian','Экстремумы окна','Верх=max High₂₂, низ=min Low₂₂, середина=(верх+низ)/2. Текущая свеча включена.','Пробой прошлой границы — другое сравнение: на экране показаны обе границы на момент t и t−1.','donchian'],
    '11.17':['stc','Цепочка преобразований','Учебный STC: EMA(23/50) → MACD → нормировка(10) → сглаживание 0,5 → нормировка(10) → сглаживание 0,5.','Часть исходных настроек неизвестна; объявленная реализация не выдаётся за точную копию. Уровни 35/65.','stc'],
    '13.1':['ma','Средние и подтверждение','Сначала пересечение SMA(2)/SMA(5) на закрытии; фрактал проверяется отдельно, после двух правых свечей.','Вариант без фрактала и вариант с ним учитываются как разные правила.','ma','fractals'],
    '13.2':['keltner','Два расчёта, два условия','Кельтнер: EMA(19) ±2 ATR(17). Vortex: VI+/VI−(14). Общий источник — те же свечи.','Отметь положение цены и соотношение VI отдельно; при конфликте не выбирай удобное условие.','keltner','vortex'],
    '13.3':['rsi','Контекст меняет гипотезу','RSI(14/5) описывает относительную силу недавних повышений; одинаковое число допускает разные сценарии.','Возврат у области и продолжение направления — разные заранее выбранные правила.','rsi'],
    '13.4':['stochastic','Три разных проверки','%K/%D(14,3,3), зона 20/80 и структура цены проверяются отдельно.','Нахождение в зоне не означает, что пересечение уже состоялось.','stochastic'],
    '13.5':['supertrend','Фильтры по одной цене','Supertrend ATR(10) ×3 и SMA(5) рассчитываются отдельно, по закрытым свечам.','Просмотри также частые переключения в диапазоне. Совместное согласование не измеряет доходность.','supertrend','ma'],
    '13.6':['bollinger','Выход и возврат','Общий SMA(25), ширины 2,2σ/2,8σ. Выход и последующее возвращение внутрь — два события.','Не называй первое касание подтверждённым возвратом: следующая свеча ещё скрыта.','bollinger'],
    '13.8':['dual-supertrend','Сначала преобразование','Исходные OHLC → Heikin Ashi → Supertrend ATR(21) ×1 и ATR(14) ×2.','Согласование двух линий проверяем после закрытия; результат измеряем по исходным ценам.','dual-supertrend'],
    '13.10':['donchian','Канал и цикл','Donchian(22) и объявленная учебная реализация STC; ориентиры 35/65.','Касание канала, изменение наклона STC и пересечение порога — отдельные события. Недостающие настройки не угадываем.','donchian','stc']
  };
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function data(key,state={},parameter='default'){
    const spec=specs[key],timeline=spec[0]==='macd'?[40,48,60,72,96]:spec[0]==='ao'?[36,44,60,72,96]:[20,36,60,72,96],count=state.practice?(state.revealed?96:80):timeline[Math.max(0,Math.min(4,Number(state.step)||0))];
    const source=(state.practice?practiceBars:bars).slice(0,count).map(b=>({...b}));
    // An alternative changes only the still-hidden continuation, never history.
    if(state.alternate&&count===96)for(let i=80;i<source.length;i++){const c=source[79].c+(i-79)*.7;source[i]={o:i===80?source[79].c:source[i-1].c,c,h:c+1.4,l:c-1.1};}
    const panels=spec.slice(4).map(type=>{
      const options=parameter==='short'?{period:type==='donchian'?10:10}:{};
      let model=I.calculate(source,type,options);
      if(type==='ma'){
        const values=source.map(b=>b.c),fn=parameter==='ema'?I.ema:I.sma;
        model={lines:[{label:(parameter==='ema'?'EMA':'SMA')+'(2)',values:fn(values,2)},{label:(parameter==='ema'?'EMA':'SMA')+'(5)',values:fn(values,5)}],levels:[],bounded:false};
        if(key==='4.2')model.lines=[{label:'SMA(3)',values:I.sma(values,3)}];
        if(key==='13.5')model.lines=[{label:'SMA(5)',values:I.sma(values,5)}];
      }
      return {type,...model};
    });
    return {bars:source,panels,count,parameter};
  }
  function graph(source,model,candles=false,label='',width=740){
    const start=Math.max(0,source.length-(width<420?24:40)),shown=source.slice(start),lines=model?model.lines:[],bounded=model&&model.bounded;
    const nums=[...(candles?shown.flatMap(b=>[b.h,b.l]):[]),...lines.flatMap(l=>l.values.slice(start).filter(Number.isFinite)),...(model?model.levels:[])];
    if(!nums.length)return '<p class="as-indicator-warmup">Нужна история для полного окна: значения ещё не определены.</p>';
    let low=bounded?0:Math.min(...nums),high=bounded?100:Math.max(...nums);if(low===high){low-=1;high+=1;}const pad=(high-low)*.08;if(!bounded){low-=pad;high+=pad;}
    const right=width-18,x=i=>46+i*(right-46)/Math.max(1,shown.length-1),y=v=>24+(high-v)/(high-low)*236;
    const grid=[low,(low+high)/2,high].map(v=>'<line x1="40" x2="'+right+'" y1="'+y(v)+'" y2="'+y(v)+'"/><text x="36" y="'+(y(v)+4)+'" text-anchor="end">'+v.toFixed(1)+'</text>').join('');
    const candle=shown.map((b,i)=>'<g class="as-indicator-candle '+(b.c>=b.o?'as-indicator-up':'as-indicator-down')+'"><line x1="'+x(i)+'" x2="'+x(i)+'" y1="'+y(b.h)+'" y2="'+y(b.l)+'"/><rect x="'+(x(i)-4)+'" y="'+Math.min(y(b.o),y(b.c))+'" width="8" height="'+Math.max(1,Math.abs(y(b.o)-y(b.c)))+'"/></g>').join('');
    const paths=lines.map((l,j)=>{let started=false;const dot=model.type==='fractals'||model.type==='sar'&&j===1,hist=model.type==='ao'||model.type==='macd'&&j===2;
      const path=l.values.slice(start).map((v,i)=>{if(!Number.isFinite(v)){started=false;return '';}const p=(started?'L':'M')+x(i)+','+y(v);started=true;return p;}).join(' ');
      const marks=l.values.slice(start).map((v,i)=>Number.isFinite(v)?hist?'<rect x="'+(x(i)-3)+'" y="'+Math.min(y(v),y(0))+'" width="6" height="'+Math.max(1,Math.abs(y(v)-y(0)))+'"/>':dot?'<circle cx="'+x(i)+'" cy="'+y(v)+'" r="4"/>':'':'').join('');
      return '<g class="as-indicator-series as-indicator-series-'+j+'">'+(dot||hist?'':'<path d="'+path+'"/>')+marks+'</g>';}).join('');
    return '<svg viewBox="0 0 '+width+' 298" role="img" aria-label="'+esc(label)+'"><g class="as-indicator-grid">'+grid+'</g>'+(model?model.levels.map(v=>'<path class="as-indicator-level" d="M40 '+y(v)+'H'+right+'"/><text class="as-indicator-threshold" x="'+(right-3)+'" y="'+(y(v)-5)+'" text-anchor="end">'+(v===0?'Ноль · 0':v)+'</text>').join(''):'')+(candles?candle:'')+paths+'<text class="as-indicator-axis" x="46" y="286">Свеча '+(start+1)+'</text><text class="as-indicator-axis" x="'+right+'" y="286" text-anchor="end">'+source.length+'</text></svg>';
  }
  function reading(panel,source){
    const fmt=v=>Number.isFinite(v)?v.toFixed(2):'ещё нет значения',a=panel.lines[0].values,b=panel.lines[1]?.values,i=source.length-1,v=a[i],previous=a[i-1];
    const cross=b&&[v,previous,b[i],b[i-1]].every(Number.isFinite)?previous<=b[i-1]&&v>b[i]?'На последнем закрытии первая линия пересекла вторую вверх.':previous>=b[i-1]&&v<b[i]?'На последнем закрытии первая линия пересекла вторую вниз.':'На последнем закрытии нового пересечения двух линий нет.':'';
    if(panel.type==='fractals')return 'Круг отмечает центр поворота. Подтверждение доступно только через две правые свечи; последние две центральные метки ещё неизвестны.';
    if(!Number.isFinite(v))return 'Для полного расчёта ещё недостаточно закрытых свечей. Пустое место означает отсутствие значения, а не ноль.';
    if(panel.type==='rsi')return 'RSI(14) = '+fmt(v)+'. '+(v>70?'Выше 70: повышения преобладали.':v<30?'Ниже 30: снижения преобладали.':'Между 30 и 70.')+' '+(previous<=70&&v>70?'Сейчас пересечён порог 70 вверх.':previous>=30&&v<30?'Сейчас пересечён порог 30 вниз.':'Новое пересечение внешнего порога сейчас не подтверждено.');
    if(panel.type==='macd')return 'MACD '+fmt(v)+(v>=0?' выше нуля: EMA(12) выше EMA(26).':' ниже нуля: EMA(12) ниже EMA(26).')+' '+cross+' Столбец = MACD − сигнальная.';
    if(['stochastic','vortex','ma'].includes(panel.type))return panel.lines[0].label+' = '+fmt(v)+(b?'; '+panel.lines[1].label+' = '+fmt(b[i])+'. '+cross:'.');
    if(['demarker','stc'].includes(panel.type)){const levels=panel.levels;return 'Значение '+fmt(v)+'. '+(v<levels[0]?'Ниже '+levels[0]:v>levels.at(-1)?'Выше '+levels.at(-1):'Между '+levels.join(' и '))+'. '+(v>previous?'Линия растёт.':v<previous?'Линия снижается.':'Линия не изменилась.')+' Наклон и пересечение порога проверяют отдельно.';}
    if(['ao','momentum'].includes(panel.type)){const zero=panel.type==='ao'?0:100;return 'Сейчас '+fmt(v)+', '+(v>=zero?'выше':'ниже')+' нейтрального уровня '+zero+'. По сравнению с предыдущим закрытием значение '+(v>previous?'увеличилось.':v<previous?'уменьшилось.':'не изменилось.');}
    if(panel.type==='fractals')return 'Круг отмечает центр поворота. Подтверждение доступно только через две правые свечи; последние две центральные метки ещё неизвестны.';
    if(['keltner','bollinger','donchian','regression'].includes(panel.type)){const close=source[i].c;return 'Исходный Close = '+fmt(close)+'. '+panel.lines.map(l=>l.label+' '+fmt(l.values[i])).join('; ')+'. Сравни положение цены с границами; касание и последующее возвращение — разные события.';}
    if(panel.type==='heikin')return 'Исходный Close = '+fmt(v)+'; вычисленный HA Close = '+fmt(b[i])+'. Разница появилась из преобразования OHLC, а не из другой сделки.';
    return 'Исходный Close = '+fmt(source[i].c)+'. '+panel.lines.map(l=>l.label+' '+fmt(l.values[i])).join('; ')+'. Сравни сторону каждой линии сейчас и на предыдущем закрытии.';
  }
  function render(key,host,state){
    state={...state,revealed:state.practice?!!state.revealed:Number(state.step)===4};
    const spec=specs[key],teaching=registry[key].teaching;let parameter='default',terminalCleanups=[];
    function draw(){terminalCleanups.forEach(fn=>fn());terminalCleanups=[];if(frames.has(host)){window.cancelAnimationFrame(frames.get(host));frames.delete(host);}const d=data(key,state,parameter),latest=d.bars.at(-1),last=d.count-1,plot=(...args)=>graph(...args,Math.max(232,Math.min(1100,(host.clientWidth||764)-8))).replace('<svg ','<svg class="as-indicator-svg" ');
      const overlay=['ma','fractals','keltner','bollinger','sar','regression','heikin','donchian','supertrend','dual-supertrend'];
      const warming=!d.panels.some(p=>p.lines.some(l=>l.values.some(Number.isFinite)));
      const panels=(warming?'<p class="as-indicator-warmup" role="status">Пока показано '+d.count+' свечей: цепочке расчёта ещё нужна история. Пропуски не заполняются будущими значениями; переходи к следующим закрытиям.</p>':'')+d.panels.map((p,index)=>'<section class="as-indicator-panel"><h4>'+esc(names[p.type])+'</h4><p class="as-indicator-reading">'+esc(reading(p,d.bars))+'</p><div data-as-indicator-overlay="'+index+'">'+plot(d.bars,p,overlay.includes(p.type),spec[1]+': '+names[p.type])+'</div><ul class="as-indicator-values">'+p.lines.map((l,i)=>'<li class="as-indicator-label-'+i+'">'+esc(l.label)+': <strong>'+(Number.isFinite(l.values[last])?l.values[last].toFixed(2):'нет значения')+'</strong></li>').join('')+'</ul></section>').join('');
      let extra='';
      if(spec[0]==='votes'){const c=d.bars.map(b=>b.c),a=I.sma(c,2).at(-1),b=I.sma(c,5).at(-1),r=I.rsi(c,14).at(-1),votes=[['Close > SMA5',latest.c>b],['SMA2 > SMA5',a>b],['RSI14 > 50',r>50]];extra='<div class="as-indicator-votes">'+votes.map(v=>'<span>'+v[0]+': '+(v[1]?'да':'нет')+'</span>').join('')+'<strong>'+votes.filter(v=>v[1]).length+' из 3 — зависимые расчёты</strong></div>';}
      if(spec[0]==='donchian'){const u=d.panels[0].lines[0].values,fmt=v=>Number.isFinite(v)?v.toFixed(2):'ещё нет полного окна';extra='<p>Верх канала сейчас: '+fmt(u.at(-1))+'; известный до текущей свечи: '+fmt(u.at(-2))+'.</p>';}
      if(spec[0]==='fractals')extra='<p>Последние две свечи не могут иметь подтверждённую центральную метку: правых соседей ещё нет. Метка на t становится доступна на закрытии t+2.</p>';
      if(spec[0]==='heikin'){const ha=I.heikin(d.bars);extra='<h4>Вычисленные свечи Heikin Ashi</h4>'+plot(ha,null,true,'Heikin Ashi: вычисленные OHLC')+'<p>Исходный Close '+latest.c.toFixed(2)+'; HA Close '+ha.at(-1).c.toFixed(2)+'.</p>';}
      let contextZone;
      if(key==='13.3'){const high=Math.max(...d.bars.slice(0,20).map(b=>b.h));contextZone={low:high-1,high,label:'Область первых 20 свечей'};extra='<p class="as-indicator-reading">Область отмечена по уже известным первым 20 свечам: '+contextZone.low.toFixed(2)+'–'+contextZone.high.toFixed(2)+'. Текущее закрытие '+latest.c.toFixed(2)+(latest.c>=contextZone.low&&latest.c<=contextZone.high?' внутри области.':' вне области.')+' RSI не заменяет проверку подхода к этой области.</p>'+extra;}
      const canMa=!state.practice&&['11.4','4.3'].includes(key),canPeriod=!state.practice&&['11.13','11.16'].includes(key);
      if(state.practice){const lastCloses=d.bars.slice(77,80).map(b=>b.c.toFixed(4));extra='<p class="as-indicator-inputs">Исходные Close свечей 78–80: '+lastCloses.join(' · ')+'. Вопрос относится к показанному префиксу до свечи 80; после раскрытия сравни изменение расчёта.</p>'+extra;}
      const separatePrice=!overlay.includes(d.panels[0].type),checklist=combinationSteps[key];
      host.innerHTML='<div class="as-indicator-root">'+
        '<p class="as-indicator-meaning">'+esc(teaching.plain)+'</p><p class="as-indicator-read"><strong>Как читать: </strong>'+esc(teaching.read)+'</p>'+
        (checklist?'<ol class="as-indicator-checklist">'+checklist.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ol>':'')+
        (canMa?'<label>Тип средней <select class="as-indicator-parameter"><option value="default">SMA 2/5</option><option value="ema">EMA 2/5</option></select></label>':canPeriod?'<label>Окно <select class="as-indicator-parameter"><option value="default">'+(key==='11.16'?'22':'14')+'</option><option value="short">10</option></select></label>':'')+
        '<p class="as-indicator-status">Доступно '+d.count+' из 96 свечей · '+(state.revealed?'продолжение раскрыто':'будущее скрыто')+'</p>'+
        (separatePrice?'<section class="as-indicator-price"><h4>Цена: исходные свечи</h4><div data-as-indicator-price>'+plot(d.bars,null,true,'Исходные OHLC, только доступные свечи')+'</div></section>':'')+
        panels+extra+'<details class="as-indicator-formula"><summary>Как получаются числа: формула и параметры</summary><p>'+esc(spec[2])+'</p></details>'+
        '<p class="as-indicator-note">'+esc(spec[3])+'</p><p class="as-indicator-note">Синтетический учебный участок помогает понять расчёт. Он не проверяет доходность стратегии.</p></div>';
      const priceHost=host.querySelector('[data-as-indicator-price]');
      if(window.TDTerminalChart?.mount){
        if(separatePrice&&priceHost){const fn=window.TDTerminalChart.mount(priceHost,{bars:d.bars,zone:contextZone,caption:'Исходная цена · доступны только '+d.count+' закрытых свечей',id:'price'});if(typeof fn==='function')terminalCleanups.push(fn);}
        d.panels.forEach((p,index)=>{if(!overlay.includes(p.type)||['fractals','sar'].includes(p.type))return;const target=host.querySelector('[data-as-indicator-overlay="'+index+'"]');if(!target)return;const fn=window.TDTerminalChart.mount(target,{bars:d.bars,series:p.lines,caption:names[p.type]+' · линии рассчитаны по доступным свечам',id:'price'});if(typeof fn==='function')terminalCleanups.push(fn);});
      }
      const control=host.querySelector('.as-indicator-parameter');if(control){control.value=parameter;control.onchange=()=>{parameter=control.value;draw();};}
      animateGeometry(host,{revealed:!!state.revealed,count:d.count});
    }
    draw();return ()=>{terminalCleanups.forEach(fn=>fn());if(frames.has(host)){window.cancelAnimationFrame(frames.get(host));frames.delete(host);}host.innerHTML='';};
  }
  function practiceFor(key,spec){
    const d=data(key,{practice:true}),first=d.panels[0],focus=first.lines[['sar','regression','heikin','dual-supertrend'].includes(first.type)?1:0],last=focus.values.at(-1),value=Number.isFinite(last)?last.toFixed(2):'ещё не определено';
    const meanings={
      ma:['Это среднее прошлых закрытий выбранного окна.','Это цена следующего закрытия.','Это число независимых покупателей.'],
      votes:['Три голоса рассчитаны по одним ценам; согласование не делает их независимыми.','Каждый голос получен из отдельного источника заявок.','Два голоса гарантируют выигрыш следующего контракта.'],
      rsi:['Это соотношение сглаженных повышений и снижений закрытий.','Это доля покупок в реальном объёме.','Это вероятность выигрыша следующей сделки в процентах.'],
      stochastic:['Закрытие сопоставляется с диапазоном окна, затем линия сглаживается.','Показана сумма всех объёмов окна.','Зона 80 обязывает следующую свечу упасть.'],
      macd:['MACD — разность EMA(12) и EMA(26); гистограмма отдельно вычитает сигнал.','MACD и гистограмма всегда являются одним числом.','Высота гистограммы равна числу покупок.'],
      fractals:['Центральная метка становится доступна только после двух правых закрытий.','По метке можно было действовать на открытии центральной свечи.','Последние две свечи уже имеют полное правое подтверждение.'],
      keltner:['Границы отстоят от EMA(19) на 2 ATR(17).','Ширина равна двум стандартным отклонениям закрытий.','Верхняя граница является обязательной ценой разворота.'],
      bollinger:['Обе пары полос имеют общий SMA(25), но разные множители σ: 2,2 и 2,8.','Внешние полосы используют отдельный независимый поток цены.','Внешняя полоса обязана вернуть цену к центру на следующей свече.'],
      ao:['AO вычитает SMA(34) медианной цены из SMA(5); знак и изменение высоты различаются.','AO измеряет фактический объём покупок минус продаж.','Каждый положительный столбец обязательно выше предыдущего.'],
      momentum:['Текущий Close делится на Close десять свечей назад и умножается на 100.','Нейтральное значение этой относительной версии равно нулю.','Число показывает абсолютный прирост цены без деления.'],
      supertrend:['Линия рассчитана через ATR(10), множитель 3 и условие переключения по Close.','Линия показывает скрытые будущие заявки.','Любая смена стороны обязательно начинает длительный тренд.'],
      vortex:['VI+ и VI− нормируют межсвечные движения на сумму True Range окна 14.','Линии получены от двух независимых бирж.','VI+ выше VI− доказывает прибыльность входа.'],
      sar:['Точка зависит от предыдущей точки, экстремума и коэффициента ускорения.','Точка равна средней цене следующей свечи.','Точка измеряет реальный объём продаж.'],
      demarker:['DeMarker сравнивает обновления High и Low; здесь шкала умножена на 100.','Это процент всех купленных контрактов.','Порог 80 означает гарантированную смену направления.'],
      regression:['Показан конец регрессии окна 20, границы используют σ остатков этого окна.','Вся линия является одной прямой по всем 80 свечам.','Начало окна можно переносить после исхода без изменения метода.'],
      heikin:['HA Close — среднее исходных O,H,L,C; это вычисленная цена.','HA Close всегда совпадает с исходным Close.','HA Close автоматически доступен как цена реального исполнения.'],
      donchian:['Верх — наибольший High последних 22 свечей, текущая свеча включена.','Верх — среднее закрытий 22 свечей.','Верх уже включает максимумы пока скрытых свечей 81–96.'],
      stc:['Это цепочка сглаживаний и нормировок MACD; результат не является вероятностью.','Значение 65 означает 65% вероятности следующего роста.','Название STC гарантирует совпадение всех скрытых настроек автора.'],
      'dual-supertrend':['Сначала вычислены Heikin Ashi, затем обе линии Supertrend по этим свечам.','Одна линия использует реальные заявки, другая — будущие цены.','Результат исполнения нужно считать по синтетическому HA Close.']
    };
    let question='На свече 80 показана панель «'+names[first.type]+'». '+focus.label+' = '+value+'. Как прочитать этот расчёт?',answers=meanings[spec[0]]||meanings.ma;
    if(key==='4.2'){
      const inputs=d.bars.slice(-3).map(b=>b.c),answer=inputs.reduce((a,b)=>a+b,0)/3;
      question='На панели SMA(3) для свечи 80. Последние три Close указаны под графиком. Какое значение даёт их среднее (округление до 0,01)?';
      answers=[answer.toFixed(2)+' — сумма трёх Close, делённая на 3.',inputs.at(-1).toFixed(2)+' — берём только последнее Close.',(answer*3).toFixed(2)+' — складываем без деления.'];
    }
    if(spec[0]==='fractals')question='У последних двух доступных свечей нет подтверждённой центральной метки. Когда становится доступен фрактал?';
    if(key==='4.3')question='На графике одновременно средние и RSI, рассчитанные по одним Close. Что означает их согласование?';
    if(key==='4.3')answers=meanings.votes;
    if(key==='9.5')question='Посмотри на три вычисленных голоса под панелями. Что означает правило «два из трёх» в этой модели?';
    if(key==='13.1'){question='Сравни SMA(2)/SMA(5) и метки фракталов на доступных 80 свечах. Можно ли считать их одним одновременным событием?';answers=['Нет: пересечение проверяется на закрытии, центральный фрактал подтверждается двумя правыми свечами.','Да: фрактал известен на открытии его центральной свечи.','Да: любые две линии автоматически подтверждают центральный фрактал.'];}
    if(key==='13.2'){question='На свече 80 доступны канал Кельтнера и две линии Vortex. Как проверять комбинацию?';answers=['Отдельно записать положение Close относительно канала и соотношение VI+/VI−; затем проверить заранее выбранное совместное условие.','Выбрать только ту панель, которая обещает нужный исход.','Считать два расчёта независимыми источниками рыночных заявок.'];}
    if(key==='13.3'){question='На свече 80 RSI(14) = '+value+'. Достаточно ли этого числа, чтобы выбрать возврат у области вместо продолжения?';answers=['Нет: контекст, область и событие для каждой гипотезы задают отдельно до исхода.','Да: любое значение RSI однозначно определяет следующий цвет.','Можно выбрать название гипотезы после раскрытия свечи 81.'];}
    if(key==='13.4'){const k=first.lines[0].values.at(-1),v=first.lines[1].values.at(-1);question='На свече 80 %K = '+k.toFixed(2)+', %D = '+v.toFixed(2)+'. Что ещё нужно отличать от этого положения линий?';answers=['Само событие пересечения на соседних закрытиях, зону 20/80 и структуру цены проверяют отдельно.','Положение двух линий уже доказывает совпадение всех трёх условий.','Любое %K выше %D означает обязательный выигрыш.'];}
    if(key==='13.5'){question='На свече 80 показаны Supertrend и SMA(5). Как оценить совместный фильтр?';answers=['Зафиксировать каждое ценовое условие отдельно и проверить все переключения, включая неудачные.','Убрать неудобные переключения после раскрытия.','Считать согласование линий измеренной вероятностью выигрыша.'];}
    if(key==='13.6'){question='На свече 80 видны общий центр и две ширины Bollinger. Что требуется, чтобы назвать выход подтверждённым возвратом?';answers=['После выхода нужно наблюдаемое возвращение внутрь по заранее выбранному условию; одного касания недостаточно.','Само касание внешней полосы уже подтверждает возврат.','Достаточно посмотреть скрытую свечу 81 и переименовать прежнее касание.'];}
    if(key==='13.10'){const stc=d.panels[1].lines[0].values.at(-1);question='На свече 80 показан Donchian(22), STC = '+stc.toFixed(2)+'. Какие события нужно записать раздельно?';answers=['Касание границы, изменение наклона STC и пересечение 35/65: каждое имеет собственный момент доступности.','Любое касание канала уже означает, что STC пересёк нужный порог.','Название STC позволяет восстановить неназванные настройки автора.'];}
    const correct={text:answers[0],correct:true,feedback:answers[0]+' Данные ограничены свечой 80; продолжение не входит в расчёт.'};
    return {question,choices:[{text:answers[1],correct:false,feedback:'Проверь объявленную формулу. '+answers[0]},correct,{text:answers[2],correct:false,feedback:'Из показанных данных это не следует. '+answers[0]}],reveal:'Сравни значения на свече 80 с последующими. '+spec[3]+' Один исход не оценивает качество правила на серии.'};
  }
  for(const [key,spec] of Object.entries(specs)){
    const lesson=course.lessons.find(l=>l.key===key);if(!lesson)throw new Error('Missing indicator lesson '+key);
    const m=lesson.content.interactiveLesson,g=m.guide;
    const words=explanations[spec[0]]||explanations.ma,practiceData=data(key,{practice:true}),exampleRead=practiceData.panels.map(p=>names[p.type]+': '+reading(p,practiceData.bars)).join(' ');
    const teaching={goal:g.goal||spec[1],plain:words[0],read:words[1],example:'В самостоятельном участке остановимся на свече 80. '+exampleRead+' Сначала запиши наблюдение, затем открой продолжение и проверь, сохранилось ли состояние.',terms:[{term:words[2],meaning:words[3]},{term:'Закрытие свечи (Close)',meaning:'Последняя известная цена завершённого интервала; по ней проверяют событие на этом шаге.'}],takeaway:spec[3]};
    if(combinationSteps[key]){teaching.plain='Этот вариант соединяет несколько ценовых условий. Проверяй их по порядку. '+g.plain;teaching.read=combinationSteps[key].join(' ');}
    if(key==='4.3'){teaching.plain=explanations.votes[0]+' Средние и RSI здесь получены из одной последовательности закрытий.';teaching.read=explanations.votes[1];}
    const stages=[
      {title:'Читаем: '+names[spec.slice(4)[0]],body:teaching.plain,task:teaching.read},
      {title:spec[1]+': читаем числа',body:g.plain,task:'Сопоставь подпись значения над панелью с последним закрытием. '+words[1]},
      {title:combinationSteps[key]?'Проверяем условия по порядку':'Состояние или новое событие?',body:combinationSteps[key]?combinationSteps[key].join(' '):words[3],task:combinationSteps[key]?combinationSteps[key][1]:spec[3]},
      {title:'Когда вывод не подходит',body:g.trap,task:'На текущем участке назови один факт, которого недостаточно для вывода. '+spec[3]},
      {title:'Два продолжения одного наблюдения',body:'До свечи 80 обе ветки совпадают. После неё новые цены меняют расчёт. '+spec[3],task:'Переключи продолжение и сравни подписанные значения. Затем перейди к новому участку практики: его будущее снова скрыто.'}
    ];
    registry[key]={kind:'indicator',teaching,alternate:true,alternateFromStep:4,alternateAfterReveal:true,stages,render:(host,state)=>render(key,host,state||{}),practice:practiceFor(key,spec),quiz:m.quiz,reflection:'Своими словами: что измеряет линия, где на графике видно событие и какого будущего вывода из него сделать нельзя?'};
  }
  window.TD_STUDIO_INDICATORS={keys:Object.keys(specs),inspect:data,canAnimate};
})();
