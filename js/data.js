const DEFAULT_DATA = {
  quotes: [
    'Результат начинается с дисциплины.',
    'Сначала процесс. Потом результат.',
    'Одна хорошая привычка сильнее десяти импульсивных решений.',
    'Не каждая сделка должна быть сделана.'
  ],
  currencies: [
    ['USD','$'],['EUR','€'],['GBP','£'],['JPY','¥'],['CHF','CHF'],['CAD','C$'],['AUD','A$'],['NZD','NZ$'],['CNY','¥'],['HKD','HK$'],['SGD','S$'],['SEK','kr'],['NOK','kr'],['DKK','kr'],['PLN','zł'],['CZK','Kč'],['TRY','₺'],['AED','د.إ'],['UAH','₴'],['GEL','₾'],['KZT','₸']
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
  settings: {currency:'USD', timezone:Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', startingBalance:0, dateFormat:'DD.MM.YYYY'},
  trades: [], notes: [], plans: [], goals: [], journal: {}, mainGoal: {title:'Построить стабильную торговую систему',description:'Долгосрочная цель: постепенно прийти к заданному балансу, win rate и дисциплине без разрушения риск-менеджмента.',targetBalance:10000,targetWinRate:60,targetTrades:500,targetPnl:5000}
};
function cryptoId(){return 'id_'+Math.random().toString(36).slice(2)+Date.now().toString(36)}
const TZ_FALLBACK=['UTC','Europe/London','Europe/Berlin','Europe/Moscow','Europe/Kyiv','Europe/Paris','Asia/Dubai','Asia/Tbilisi','Asia/Almaty','Asia/Tashkent','Asia/Tokyo','Asia/Shanghai','Asia/Singapore','Australia/Sydney','America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Toronto','America/Sao_Paulo','Africa/Cairo','Africa/Johannesburg','Asia/Kolkata','Asia/Bangkok','Asia/Jakarta','Pacific/Auckland'];
function getTimezones(){try{return Intl.supportedValuesOf('timeZone')}catch{return TZ_FALLBACK}}
