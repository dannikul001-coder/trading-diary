// Produces a private, reproducible candidate map. Keyword matches establish
// discovery/provenance, not proof that every detail of a source was adapted.
const fs=require('node:fs'),path=require('node:path');
const input=process.argv[2],output=process.argv[3];if(!input||!output)throw new Error('Pass private review JSON and output directory');
const records=JSON.parse(fs.readFileSync(input,'utf8'));
const rules=[
 ['11.1|13.3',/\brsi\b|аэрос|aerosci|эрэс|арэс/iu],['11.2|13.4',/stochastic|ст[ао]хаст/iu],['11.3',/\bmacd\b|макд|макди/iu],
 ['11.4|13.1',/moving\s*(?:average|coverage)|скользящ|мувинг|sma|ema|дв[ае]\s+средн/iu],['11.5|13.1',/фрактал|fractal/iu],['11.6|13.2',/кель[тн]|keltner/iu],['11.7|13.6',/бол+ин|bollinger/iu],['11.8',/awesome|а[ув]ес[оа]м/iu],['11.9',/momentum|моментум/iu],['11.10|13.5',/super\s*trend|супер\s*тренд/iu],['11.11|13.2',/vortex|вортекс/iu],
 ['12.1|12.2',/ликвид|liquidity|сняти[ея]\s+(?:максимум|минимум|стоп)/iu],['12.3',/order\s*block|ордер\s*блок|\bOB\b/iu],['12.4',/\bfvg\b|fair\s*value|фвг/iu],['12.5',/order\s*flow|ордер\s*флоу|поток\s+заяв/iu],['12.6',/клин|флаг|треугольник|двойн.*вершин|двойн.*основан/iu],['12.7|3.1',/поглощ|дожи|молот|повешен|свечн.*модел/iu],
 ['9.1|14.1',/выплат|payout|бинар|фиксированн.*(?:доход|результат)/iu],['9.2',/терминал|интерфейс|выбира[ею].*пар|открывать\s+позиц/iu],['9.3',/сигнал|бот|карточк.*сдел/iu],['9.4',/\botc\b|отс|внебирж/iu],['9.5',/инвестинг|investing|два\s+из\s+тр[её]х|2\s*из\s*3|сводк/iu],
 ['10.1',/forex|форекс|сесси|fedwire|cls|банки|часов.*пояс/iu],['10.2|10.3',/новост|non.?farm|нон.?фарм|nfp|календарь|ставк.*фрс/iu],['10.4',/не\s+(?:стоит|нужно)\s+торг|не\s+торгую|плох.*рынок/iu],
 ['14.3|5.3',/догон|мартинг|лестниц|лесенк|1%.*2%|1\s*[→-]\s*2/iu],['14.4',/просад|восстанов|отбива|вернуть\s+потер/iu],['14.5',/одновременн.*позици|коррел|общ.*риск|совокуп/iu],['14.6',/копи.?трейд|копир|повторя[ею].*сдел/iu],
 ['15.1|15.2',/дневник|журнал|разбор.*ошиб|разбор.*сдел|анализ.*сесси/iu],['15.3|7.2',/сон|питани|режим|устал|перерыв|эмоци|самоконтрол|страх|жадност|лудоман/iu],['15.4',/демо|обучени|учиться|практик|дисциплин/iu],
 ['1.1|12.7',/свеч|тени|закрыти.*открыти/iu],['1.2|1.3',/тренд|откат|разворот|вершин|впадин|боковик|флэт/iu],['2.1|2.2',/уровн|сопротивлен|поддержк|пробой|ретест/iu],['0.2|3.3',/таймфрейм|тайм.?фрейм|\bтф\b/iu],['4.1',/волатильн/iu],['5.1|5.2',/риск|процент|торгов.*план|размер.*сдел/iu],['13.7',/стратеги|тестир|статистик|выборк/iu],['7.1|7.2',/психолог|мышлен|состояни|мотиваци|результат|попытк|привычк/iu]
];
const indexPattern=/БАЗА ТРЕЙДИНГА:|навигаци|закрепленн|закреплённ|материалы.*Амира/is;
const ads=/платн|порог\s+входа|стоимост.*доступ|очищен.*канал|призов|победител|розыгрыш|скидк|купить\s+доступ/iu;
const seen=new Map();
const map=records.map(r=>{
 const text=r.text,lessonKeys=[...new Set(rules.filter(([,re])=>re.test(text)).flatMap(([keys])=>keys.split('|')))];
 const evidence=rules.filter(([,re])=>re.test(text)).map(([keys,re])=>({lessonKeys:keys.split('|'),matched:text.match(re)[0]}));
 let disposition=r.transcripts.length?'transcript_topic_candidate':indexPattern.test(text)&&text.length<15000?'navigation_index':ads.test(text)&&!r.transcripts.length?'commercial_or_mixed_context':'text_topic_candidate';
 const duplicateOf=seen.get(r.hash);if(duplicateOf!==undefined&&r.text.length>100&&r.transcripts.length===0){disposition='possible_text_duplicate';}else if(r.text.length>100)seen.set(r.hash,r.index);
 if(!lessonKeys.length)disposition='needs_editorial_review';
 if([50,52,56].includes(r.index)){lessonKeys.push('6.1','6.2','6.3');disposition='exercise_goal_reference';evidence.push({lessonKeys:['6.1','6.2','6.3'],matched:'Manually inspected prompt: make and explain a decision before future reveal. Historical prices are not recreated.'});}
 if([58,237].includes(r.index)){disposition='test_announcement_without_questions';evidence.push({lessonKeys:[],matched:'Manually inspected announcement; no actual question text in this card.'});}
 return {index:r.index,sourceKey:r.key,title:r.title,transcripts:r.transcripts,lessonKeys,disposition,duplicateOf:disposition==='possible_text_duplicate'?duplicateOf:null,evidence,coverageClaim:'Topic candidate only; does not certify line-by-line adaptation.'};
});
fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'source-to-lesson-map.json'),JSON.stringify(map,null,2));
const summary={catalogEntries:map.length,withTopicCandidates:map.filter(r=>r.lessonKeys.length).length,unclassified:map.filter(r=>!r.lessonKeys.length).map(r=>({index:r.index,title:r.title})),dispositions:Object.fromEntries([...new Set(map.map(r=>r.disposition))].map(k=>[k,map.filter(r=>r.disposition===k).length])),mappingLevel:'automatic topic candidates; editorial adaptation completeness not certified'};
fs.writeFileSync(path.join(output,'mapping-summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
