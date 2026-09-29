const DEFAULT_DATA = {
  quotes: [
    'Результат начинается с дисциплины.',
    'Сначала процесс. Потом результат.',
    'Одна хорошая привычка сильнее десяти импульсивных решений.',
    'Не каждая сделка должна быть сделана.',
    'Твоя задача — не угадать рынок, а выполнить свой сценарий.',
    'Сильный трейдер умеет не только входить, но и ждать.',
    'Риск контролируешь ты. Рынок контролирует остальное.',
    'Последовательность важнее одной красивой сделки.',
    'Пауза — тоже торговое решение.',
    'Не мсти рынку. Рынок ничего тебе не должен.',
    'Сохраняй капитал, пока ищешь своё преимущество.',
    'Хорошая сделка — это сделка по плану, независимо от результата.',
    'Когда эмоции растут, размер позиции должен уменьшаться.',
    'Сначала защити капитал. Потом думай о росте.',
    'Статистика показывает правду, которую эмоции пытаются скрыть.',
    'Не меняй систему из-за одной сделки.',
    'Терпение — часть стратегии.',
    'Убыточная сделка не делает тебя плохим трейдером.',
    'Прибыль не отменяет ошибку, если решение было нарушением плана.',
    'Каждая сессия должна оставлять тебе один полезный вывод.',
    'Меньше шума. Больше структуры.',
    'Не ищи идеальный вход. Ищи понятный сценарий.',
    'Рынок меняется. Дисциплина должна оставаться.',
    'Твоя статистика важнее твоего настроения.',
    'Лучший сигнал иногда звучит как: «не входить».',
    'Размер позиции не должен определять твои эмоции.',
    'Сначала вероятность, потом действие.',
    'Не путай движение цены с качественным сетапом.',
    'План помогает принимать решения до того, как появляются эмоции.',
    'После серии побед особенно важно не терять дисциплину.',
    'После серии потерь особенно важно не искать реванш.',
    'Торговый дневник превращает опыт в данные.',
    'Каждая ошибка становится активом, если ты её записал и понял.',
    'Торговля — это игра вероятностей, а не обещаний.',
    'Стабильность строится из повторяемых действий.',
    'Не увеличивай риск только потому, что хочется быстрее.',
    'Хорошая система выдерживает скуку.',
    'Умение пропустить сделку — часть профессионализма.',
    'Твоя цель — не быть правым, а управлять риском.',
    'Пусть цифры говорят громче ощущений.',
    'Каждый день — новый набор условий, но правила остаются.',
    'Контроль начинается с размера риска.',
    'Если сценария нет, нет и причины нажимать кнопку.'
  ],
  currencies: [
    ['USD','$'],['EUR','€'],['GBP','£'],['RUB','₽'],['JPY','¥'],['CHF','CHF'],['CAD','C$'],['AUD','A$'],['NZD','NZ$'],['CNY','¥'],['HKD','HK$'],['SGD','S$'],['SEK','kr'],['NOK','kr'],['DKK','kr'],['ISK','kr'],['PLN','zł'],['CZK','Kč'],['HUF','Ft'],['RON','lei'],['BGN','лв'],['TRY','₺'],['UAH','₴'],['GEL','₾'],['KZT','₸'],['UZS','soʻm'],['AZN','₼'],['AMD','֏'],['BYN','Br'],['MDL','L'],['AED','د.إ'],['SAR','﷼'],['QAR','﷼'],['KWD','د.ك'],['BHD','ب.د'],['OMR','﷼'],['ILS','₪'],['INR','₹'],['PKR','₨'],['BDT','৳'],['THB','฿'],['VND','₫'],['MYR','RM'],['IDR','Rp'],['PHP','₱'],['KRW','₩'],['TWD','NT$'],['ZAR','R'],['BRL','R$'],['MXN','MX$'],['ARS','$'],['CLP','$'],['COP','$'],['PEN','S/'],['UYU','$U'],['EGP','£'],['MAD','د.م.'],['NGN','₦'],['KES','KSh'],['GHS','₵'],['TZS','TSh'],['XAU','Au'],['XAG','Ag']
  ],
  instruments: [
    ['Forex','EUR/USD'],['Forex','GBP/USD'],['Forex','USD/JPY'],['Forex','USD/CHF'],['Forex','AUD/USD'],['Forex','USD/CAD'],['Forex','NZD/USD'],['Forex','EUR/GBP'],['Forex','EUR/JPY'],['Forex','GBP/JPY'],['Forex','EUR/CHF'],['Forex','AUD/JPY'],['Forex','CAD/JPY'],['Forex','NZD/JPY'],['Forex','USD/TRY'],['Forex','USD/SGD'],['Forex','USD/MXN'],['Forex','USD/ZAR'],
    ['Crypto','BTC/USD'],['Crypto','ETH/USD'],['Crypto','XRP/USD'],['Crypto','SOL/USD'],['Crypto','DOGE/USD'],['Crypto','BNB/USD'],['Crypto','ADA/USD'],
    ['Commodities','Gold'],['Commodities','Silver'],['Commodities','Oil'],['Commodities','Natural Gas'],
    ['Indices','NASDAQ'],['Indices','S&P 500'],['Indices','Dow Jones'],['Indices','DAX'],['Indices','FTSE 100'],['Indices','Nikkei 225'],
    ['Stocks','Apple'],['Stocks','Tesla'],['Stocks','NVIDIA'],['Stocks','Amazon'],['Stocks','Microsoft'],
    ['OTC','EUR/USD OTC'],['OTC','GBP/USD OTC'],['OTC','Gold OTC']
  ].map(([category,name]) => ({id: cryptoId(), category, name, custom:false})),
  strategies: ['Без стратегии','Trend','Breakout','Support / Resistance','Price Action','News','Scalping'],
  settings: {currency:'USD', balanceCurrency:'USD', timezone:Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', startingBalance:0, dateFormat:'DD.MM.YYYY', appearance:{preset:'midnight',theme:'dark',primary:'#0b1220',secondary:'#131d2d',accent:'teal'}},
  trades: [], notes: [], plans: [], goals: [], journal: {}, deposits: [], profile: {displayName:'',avatarUrl:''}, mainGoal: {title:'Построить стабильную торговую систему',description:'Долгосрочная цель: постепенно прийти к заданному балансу, win rate и дисциплине без разрушения риск-менеджмента.',targetBalance:10000,targetWinRate:60,targetTrades:500,targetPnl:5000}
};
function cryptoId(){return 'id_'+Math.random().toString(36).slice(2)+Date.now().toString(36)}
const TZ_FALLBACK=['UTC','Europe/London','Europe/Berlin','Europe/Moscow','Europe/Kyiv','Europe/Paris','Asia/Dubai','Asia/Tbilisi','Asia/Almaty','Asia/Tashkent','Asia/Tokyo','Asia/Shanghai','Asia/Singapore','Australia/Sydney','America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Toronto','America/Sao_Paulo','Africa/Cairo','Africa/Johannesburg','Asia/Kolkata','Asia/Bangkok','Asia/Jakarta','Pacific/Auckland'];
function getTimezones(){try{return Intl.supportedValuesOf('timeZone')}catch{return TZ_FALLBACK}}
