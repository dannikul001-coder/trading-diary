-- Trading Diary V31 — curriculum seeded from the supplied "Основы.md" draft.
-- Non-destructive: adds/updates only learning categories and lessons.
-- No trade/auth/sync tables are changed.

insert into public.learning_categories(slug,title,description,sort_order,published)
values
('basics','Основы','Базовые принципы торговли и общая концепция обучения.',10,true),
('candles','Свечи и паттерны','Японские свечи и чтение поведения цены.',20,true),
('technical','Технический анализ','Горизонтальные уровни, анализ графика и контекст рынка.',30,true),
('indicators','Индикаторы','MACD, Stochastic, Awesome Oscillator, RSI и Momentum.',40,true),
('strategies','Стратегии','Торговые сценарии и личные подходы к поиску входов.',50,true),
('psychology','Психология','Дисциплина, эмоции, мышление и проблемы новичков.',60,true),
('money-management','Мани-менеджмент','Риск, защита депозита и долгосрочная прибыль.',65,true),
('timing','Экспирации и тайминг','Выбор времени экспирации и контекст входа.',68,true),
('trade-review','Разбор сделок','Разбор ошибок, результатов недели и реальных сделок.',70,true),
('practice','Практика','Практические задания, кейсы и применение изученного.',80,true),
('advanced','Продвинутый уровень','Логика рынка, интуиция и стиль торговли автора.',90,true),
('market-analysis','Разбор рынка','Отдельный поток материалов с анализом рынка и торговых ситуаций.',95,true)
on conflict (slug) do update set
 title=excluded.title,
 description=excluded.description,
 sort_order=excluded.sort_order,
 published=true;

-- 01. Основы — первый эфир
insert into public.learning_lessons(slug,title,excerpt,lesson_type,duration_minutes,sort_order,status,category_id,content)
select 'basics-first-live','Первый эфир — базовые принципы торговли','Записанный первый эфир: базовые принципы торговли и фундамент, с которого начинается обучение.', 'video',50,10,'published',id,
jsonb_build_object(
 'videoUrl','',
 'article','Разобраны базовые принципы торговли, на которых построено дальнейшее обучение. В эфире показан личный подход к базовым принципам и логика действий на рынке.',
 'examples','В эфире были показаны сделки в прямом эфире и логика входа.',
 'practice','Пересмотри запись целиком и выпиши 3 базовых принципа, которые ты готов применять в своей торговле.',
 'quiz','[]'::jsonb,
 'keyTakeaway','Это база, на которой строится дальнейшее обучение.',
 'sourceTitle','Первый эфир (записанный)',
 'sourceDuration','50 минут 7 секунд',
 'sourceOrder',1
)
from public.learning_categories where slug='basics'
on conflict (slug) do update set title=excluded.title, excerpt=excluded.excerpt, lesson_type=excluded.lesson_type, duration_minutes=excluded.duration_minutes, sort_order=excluded.sort_order, status=excluded.status, category_id=excluded.category_id, content=excluded.content, updated_at=now();

-- 02. Свечи
insert into public.learning_lessons(slug,title,excerpt,lesson_type,duration_minutes,sort_order,status,category_id,content)
select 'candles-third-live','Свечи, которые дают деньги','Третий записанный эфир: как читать японские свечи, видеть настроение рынка и применять свечной анализ.', 'video',43,10,'published',id,
jsonb_build_object(
 'videoUrl','',
 'article','Разобраны японские свечи и чтение их с первого взгляда. Материал связывает свечной анализ с пониманием настроения рынка и логикой входа.',
 'examples','В эфире открывались сделки и объяснялась логика входа.',
 'practice','Пересмотри запись и выполни домашнее задание, озвученное в эфире.',
 'quiz','[]'::jsonb,
 'keyTakeaway','Свечи — один из базовых инструментов чтения поведения цены.',
 'sourceTitle','Третий эфир (записанный)',
 'sourceDuration','42 минуты 37 секунд',
 'sourceOrder',1
)
from public.learning_categories where slug='candles'
on conflict (slug) do update set title=excluded.title, excerpt=excluded.excerpt, lesson_type=excluded.lesson_type, duration_minutes=excluded.duration_minutes, sort_order=excluded.sort_order, status=excluded.status, category_id=excluded.category_id, content=excluded.content, updated_at=now();

-- 03. Технический анализ — уровни
insert into public.learning_lessons(slug,title,excerpt,lesson_type,duration_minutes,sort_order,status,category_id,content)
select 'technical-horizontal-levels','Горизонтальные уровни','Второй записанный эфир: что такое горизонтальные уровни, как их находить и использовать в реальной торговле.', 'video',44,10,'published',id,
jsonb_build_object(
 'videoUrl','',
 'article','Разобраны горизонтальные уровни: определение, поиск и применение в реальной торговле.',
 'examples','В эфире были открыты три сделки в моменте с объяснением применения уровней.',
 'practice','Открой минимум одну сделку по уровням, используя принципы из урока, и зафиксируй логику входа в журнале.',
 'quiz','[]'::jsonb,
 'keyTakeaway','Уровень нужно не просто увидеть, а понимать, как он используется в торговом сценарии.',
 'sourceTitle','Второй эфир (записанный)',
 'sourceDuration','43 минуты 36 секунд',
 'sourceOrder',1
)
from public.learning_categories where slug='technical'
on conflict (slug) do update set title=excluded.title, excerpt=excluded.excerpt, lesson_type=excluded.lesson_type, duration_minutes=excluded.duration_minutes, sort_order=excluded.sort_order, status=excluded.status, category_id=excluded.category_id, content=excluded.content, updated_at=now();

-- 04. Индикаторы
insert into public.learning_lessons(slug,title,excerpt,lesson_type,duration_minutes,sort_order,status,category_id,content)
select 'indicators-fourth-live','Индикаторы для уверенной торговли','Четвёртый записанный эфир: MACD, Stochastic, Awesome Oscillator, RSI и Momentum.', 'video',50,10,'published',id,
jsonb_build_object(
 'videoUrl','',
 'article','Разобраны важнейшие индикаторы для торговли: MACD, Stochastic, Awesome Oscillator, RSI и Momentum. Материал посвящён правильному использованию индикаторов и их роли в точности сделок.',
 'examples','В эфире объяснялось применение каждого индикатора и разбирались частые вопросы.',
 'practice','Для каждого индикатора выпиши: что он показывает, как его использовать и какую ошибку важно не допустить.',
 'quiz','[]'::jsonb,
 'keyTakeaway','Индикатор — инструмент анализа, а не самостоятельная гарантия результата.',
 'sourceTitle','Четвёртый эфир (записанный)',
 'sourceDuration','49 минут 37 секунд',
 'sourceOrder',1
)
from public.learning_categories where slug='indicators'
on conflict (slug) do update set title=excluded.title, excerpt=excluded.excerpt, lesson_type=excluded.lesson_type, duration_minutes=excluded.duration_minutes, sort_order=excluded.sort_order, status=excluded.status, category_id=excluded.category_id, content=excluded.content, updated_at=now();

-- 05. Стратегия пробоев
insert into public.learning_lessons(slug,title,excerpt,lesson_type,duration_minutes,sort_order,status,category_id,content)
select 'strategies-breakouts','Стратегия торговли по пробоям','Как находить пробои, видеть фейк-пробои, выбирать точки входа и избегать главных ошибок.', 'video',14,10,'published',id,
jsonb_build_object(
 'videoUrl','',
 'article','Урок посвящён торговле пробоев: как их находить, какие ошибки не допускать, как видеть фейк-пробои и в каких точках рассматривать вход.',
 'examples','Материал построен не как механическая схема «1-2-3», а как подход, где важны логика, психология и понимание рынка.',
 'practice','Открыть 3 сделки по этой стратегии и подготовить отчёт по каждой: почему выбран вход, что подтверждало сценарий и чем закончилась сделка.',
 'quiz','[]'::jsonb,
 'keyTakeaway','Пробой нужно оценивать через контекст и логику рынка, а не воспринимать как автоматический сигнал.',
 'sourceTitle','Стратегия торговли по пробоям',
 'sourceDuration','14 минут 3 секунды',
 'sourceOrder',1
)
from public.learning_categories where slug='strategies'
on conflict (slug) do update set title=excluded.title, excerpt=excluded.excerpt, lesson_type=excluded.lesson_type, duration_minutes=excluded.duration_minutes, sort_order=excluded.sort_order, status=excluded.status, category_id=excluded.category_id, content=excluded.content, updated_at=now();

-- 06. Психология — эфир
insert into public.learning_lessons(slug,title,excerpt,lesson_type,duration_minutes,sort_order,status,category_id,content)
select 'psychology-sixth-live','Психология трейдинга — база','Шестой записанный эфир: основные проблемы новичков и пошаговая база торговой психологии.', 'video',60,10,'published',id,
jsonb_build_object(
 'videoUrl','',
 'article','Разобраны основные проблемы новичков и даны пошаговые инструкции, что с ними делать. Материал формирует базу психологии в трейдинге.',
 'examples','В конце эфира были разобраны вопросы участников.',
 'practice','Пересмотри запись и выпиши 3 личные проблемы, которые могут влиять на качество твоих решений.',
 'quiz','[]'::jsonb,
 'keyTakeaway','Психология — часть торгового процесса, а не отдельная тема после стратегии.',
 'sourceTitle','Шестой эфир (записанный)',
 'sourceDuration','59 минут 45 секунд',
 'sourceOrder',1
)
from public.learning_categories where slug='psychology'
on conflict (slug) do update set title=excluded.title, excerpt=excluded.excerpt, lesson_type=excluded.lesson_type, duration_minutes=excluded.duration_minutes, sort_order=excluded.sort_order, status=excluded.status, category_id=excluded.category_id, content=excluded.content, updated_at=now();

-- 07. Психология — YouTube
insert into public.learning_lessons(slug,title,excerpt,lesson_type,duration_minutes,sort_order,status,category_id,content)
select 'psychology-main-principle','Психология трейдинга | Урок 1: главный принцип','Первый отдельный урок по психологии трейдинга. Домашнее задание озвучено в видео.', 'video',null,20,'published',id,
jsonb_build_object(
 'videoUrl','https://youtu.be/a9y1pxJfDRU',
 'article','Урок посвящён одному из главных принципов психологии в трейдинге.',
 'examples','Содержание и примеры раскрываются непосредственно в видео.',
 'practice','Выполнить домашнее задание, озвученное в видео.',
 'quiz','[]'::jsonb,
 'keyTakeaway','Психологию нужно изучать как отдельную часть торговой системы.',
 'sourceTitle','Психология трейдинга | Урок 1: главный принцип',
 'sourceDuration','Длительность в исходном списке не указана',
 'sourceOrder',2
)
from public.learning_categories where slug='psychology'
on conflict (slug) do update set title=excluded.title, excerpt=excluded.excerpt, lesson_type=excluded.lesson_type, duration_minutes=excluded.duration_minutes, sort_order=excluded.sort_order, status=excluded.status, category_id=excluded.category_id, content=excluded.content, updated_at=now();

-- 08. Практическая стратегия инвестинга
insert into public.learning_lessons(slug,title,excerpt,lesson_type,duration_minutes,sort_order,status,category_id,content)
select 'strategies-investing-a-to-z','Инвестинг от А до Я — личный подход','Практическое видео о выборе валютных пар, пропуске слабых сигналов, личном подходе и типичных ошибках новичков.', 'video',19,20,'published',id,
jsonb_build_object(
 'videoUrl','',
 'article','Видео описывает личный подход к стратегии инвестинга: выбор валютных пар, фильтрацию сигналов, логику торговли и ошибки новичков.',
 'examples','Показан личный подход автора к торговле и выходу в плюс.',
 'practice','После просмотра выпиши критерии выбора валютной пары и признаки сигнала, который ты будешь пропускать.',
 'quiz','[]'::jsonb,
 'keyTakeaway','Практика начинается с фильтрации ситуаций, а не с попытки торговать каждый сигнал.',
 'sourceTitle','Инвестинг от А до Я — мой личный соус',
 'sourceDuration','19 минут 1 секунда',
 'sourceOrder',1
)
from public.learning_categories where slug='strategies'
on conflict (slug) do update set title=excluded.title, excerpt=excluded.excerpt, lesson_type=excluded.lesson_type, duration_minutes=excluded.duration_minutes, sort_order=excluded.sort_order, status=excluded.status, category_id=excluded.category_id, content=excluded.content, updated_at=now();

-- 09. Тайминг / экспирация
insert into public.learning_lessons(slug,title,excerpt,lesson_type,duration_minutes,sort_order,status,category_id,content)
select 'timing-expiration','Как подбирать время экспирации для сделки?','На что смотреть перед входом, как отличается экспирация при импульсе и флете и почему 1 минута подходит не всегда.', 'video',8,10,'published',id,
jsonb_build_object(
 'videoUrl','',
 'article','Разобраны факторы выбора времени экспирации перед входом, различия для импульса и флета и ситуации, когда короткая экспирация не является решением.',
 'examples','В видео показан контекст перед входом и объяснено, почему одинаковая экспирация подходит не всегда.',
 'practice','Для нескольких учебных ситуаций запиши выбранную экспирацию и объясни, почему она соответствует контексту.',
 'quiz','[]'::jsonb,
 'keyTakeaway','Экспирация должна соответствовать характеру движения и контексту сделки.',
 'sourceTitle','Как подбирать время экспирации для сделки?',
 'sourceDuration','7 минут 57 секунд',
 'sourceOrder',1
)
from public.learning_categories where slug='timing'
on conflict (slug) do update set title=excluded.title, excerpt=excluded.excerpt, lesson_type=excluded.lesson_type, duration_minutes=excluded.duration_minutes, sort_order=excluded.sort_order, status=excluded.status, category_id=excluded.category_id, content=excluded.content, updated_at=now();

-- 10. Продвинутый — интуиция
insert into public.learning_lessons(slug,title,excerpt,lesson_type,duration_minutes,sort_order,status,category_id,content)
select 'advanced-trading-intuition','Торговля по интуиции','Урок о том, как автор описывает торговлю по интуиции и что стоит за таким решением.', 'video',12,10,'published',id,
jsonb_build_object(
 'videoUrl','',
 'article','Автор показывает, как может открывать сделки по интуиции, и объясняет свой подход на примере трёх сделок.',
 'examples','В видео открыты 3 сделки и объясняется логика, стоящая за решениями.',
 'practice','Выполнить домашнее задание, озвученное в конце урока. Отдельно зафиксировать, какие наблюдения предшествовали решению.',
 'quiz','[]'::jsonb,
 'keyTakeaway','Интуиция в представленном материале рассматривается через накопленное понимание рынка и наблюдения.',
 'sourceTitle','Урок №3. Торговля по интуиции',
 'sourceDuration','11 минут 53 секунды',
 'sourceOrder',1
)
from public.learning_categories where slug='advanced'
on conflict (slug) do update set title=excluded.title, excerpt=excluded.excerpt, lesson_type=excluded.lesson_type, duration_minutes=excluded.duration_minutes, sort_order=excluded.sort_order, status=excluded.status, category_id=excluded.category_id, content=excluded.content, updated_at=now();

-- 11. Разбор ошибок недели
insert into public.learning_lessons(slug,title,excerpt,lesson_type,duration_minutes,sort_order,status,category_id,content)
select 'trade-review-week-errors','Итоги недели — разбор ошибок','Пятый записанный эфир: причины потери средств, разбор сделок и причины разницы между результатами трейдеров.', 'video',39,10,'published',id,
jsonb_build_object(
 'videoUrl','',
 'article','Разобраны основные причины потери средств, реальные сделки и причины, почему один трейдер зарабатывает, а другой нет.',
 'examples','Основной формат — разбор сделок и итогов недели.',
 'practice','Пересмотри материал и найди в собственных сделках минимум одну ошибку или повторяющийся паттерн поведения.',
 'quiz','[]'::jsonb,
 'keyTakeaway','Разбор собственных ошибок — обязательная часть обучения и роста.',
 'sourceTitle','Пятый эфир (записанный)',
 'sourceDuration','38 минут 57 секунд',
 'sourceOrder',1
)
from public.learning_categories where slug='trade-review'
on conflict (slug) do update set title=excluded.title, excerpt=excluded.excerpt, lesson_type=excluded.lesson_type, duration_minutes=excluded.duration_minutes, sort_order=excluded.sort_order, status=excluded.status, category_id=excluded.category_id, content=excluded.content, updated_at=now();

-- 12. Долгосрочная прибыль
insert into public.learning_lessons(slug,title,excerpt,lesson_type,duration_minutes,sort_order,status,category_id,content)
select 'money-long-term-profit','Важность долгосрочной прибыли','Короткое аудио о важности долгосрочного результата.', 'audio',9,10,'published',id,
jsonb_build_object(
 'videoUrl','',
 'article','Материал посвящён важности долгосрочной прибыли.',
 'examples','Формат материала — аудиосообщение.',
 'practice','Прослушай материал и сформулируй, что для тебя означает долгосрочный результат в торговле.',
 'quiz','[]'::jsonb,
 'keyTakeaway','Оценивать торговлю нужно не только по отдельной сделке, а по долгосрочному результату.',
 'sourceTitle','Важность долгосрочной прибыли',
 'sourceDuration','8 минут 59 секунд',
 'sourceOrder',1
)
from public.learning_categories where slug='money-management'
on conflict (slug) do update set title=excluded.title, excerpt=excluded.excerpt, lesson_type=excluded.lesson_type, duration_minutes=excluded.duration_minutes, sort_order=excluded.sort_order, status=excluded.status, category_id=excluded.category_id, content=excluded.content, updated_at=now();

-- 13. Концепция Exclusive
insert into public.learning_lessons(slug,title,excerpt,lesson_type,duration_minutes,sort_order,status,category_id,content)
select 'basics-exclusive-concept','Концепция работы в Amir Family Exclusive','Вводный материал о заявленной системе обучения, её механике и подходе.', 'video',10,20,'published',id,
jsonb_build_object(
 'videoUrl','',
 'article','Материал описывает концепцию работы в Amir Family Exclusive и заявленный системный подход к торговле.',
 'examples','В исходном описании подчёркиваются механика, системность и отказ от случайных сигналов.',
 'practice','После просмотра выпиши 3 принципа, которые ты считаешь ключевыми в заявленной системе.',
 'quiz','[]'::jsonb,
 'keyTakeaway','Перед изучением отдельных инструментов важно понимать общую концепцию обучения и торгового процесса.',
 'sourceTitle','КОНЦЕПЦИЯ РАБОТЫ В AMIR FAMILY EXCLUSIVE',
 'sourceDuration','9 минут 30 секунд',
 'sourceOrder',2
)
from public.learning_categories where slug='basics'
on conflict (slug) do update set title=excluded.title, excerpt=excluded.excerpt, lesson_type=excluded.lesson_type, duration_minutes=excluded.duration_minutes, sort_order=excluded.sort_order, status=excluded.status, category_id=excluded.category_id, content=excluded.content, updated_at=now();

-- 14. Анализ рынка
insert into public.learning_lessons(slug,title,excerpt,lesson_type,duration_minutes,sort_order,status,category_id,content)
select 'market-analysis-how-i-analyze','Как я анализирую рынок?','Разбор двух сделок с объяснением анализа рынка и логики действий.', 'video',14,10,'published',id,
jsonb_build_object(
 'videoUrl','',
 'article','Автор показывает анализ рынка на примере двух сделок и объясняет, как обучаться анализу самостоятельно.',
 'examples','Две сделки разобраны непосредственно в видео.',
 'practice','После просмотра возьми одну свою сделку и опиши последовательность анализа до входа.',
 'quiz','[]'::jsonb,
 'keyTakeaway','Цель анализа — понимать логику движения и принимать решение на основе контекста.',
 'sourceTitle','как я анализирую рынок?',
 'sourceDuration','13 минут 58 секунд',
 'sourceOrder',1
)
from public.learning_categories where slug='market-analysis'
on conflict (slug) do update set title=excluded.title, excerpt=excluded.excerpt, lesson_type=excluded.lesson_type, duration_minutes=excluded.duration_minutes, sort_order=excluded.sort_order, status=excluded.status, category_id=excluded.category_id, content=excluded.content, updated_at=now();

-- 15. Когда не стоит торговать
insert into public.learning_lessons(slug,title,excerpt,lesson_type,duration_minutes,sort_order,status,category_id,content)
select 'money-when-not-to-trade','Как понять, когда не стоит торговать?','Гайд о ситуациях, когда отказ от сделки помогает сохранить деньги и долгосрочный результат.', 'video',12,20,'published',id,
jsonb_build_object(
 'videoUrl','',
 'article','Материал посвящён распознаванию ситуаций, когда не стоит торговать.',
 'examples','В исходном описании материал позиционируется как способ сохранить деньги и работать на долгосрочный результат.',
 'practice','После просмотра составь личный список ситуаций, в которых ты не открываешь сделку.',
 'quiz','[]'::jsonb,
 'keyTakeaway','Умение не входить в неподходящую ситуацию является частью торгового процесса.',
 'sourceTitle','как понять, когда не стоит торговать?',
 'sourceDuration','11 минут 31 секунда',
 'sourceOrder',2
)
from public.learning_categories where slug='money-management'
on conflict (slug) do update set title=excluded.title, excerpt=excluded.excerpt, lesson_type=excluded.lesson_type, duration_minutes=excluded.duration_minutes, sort_order=excluded.sort_order, status=excluded.status, category_id=excluded.category_id, content=excluded.content, updated_at=now();

-- 16. Как постоянно выходить в плюс
insert into public.learning_lessons(slug,title,excerpt,lesson_type,duration_minutes,sort_order,status,category_id,content)
select 'money-how-to-stay-profitable','Как я постоянно выхожу в плюс?','Короткое аудио о личном подходе к постоянному положительному результату.', 'audio',5,20,'published',id,
jsonb_build_object(
 'videoUrl','',
 'article','Аудиосообщение о личном подходе автора к постоянному положительному результату.',
 'examples','Формат материала — аудио.',
 'practice','Прослушай материал и выпиши один принцип, который можно проверить на собственных данных.',
 'quiz','[]'::jsonb,
 'keyTakeaway','Личный торговый подход нужно проверять через собственную практику и результаты.',
 'sourceTitle','Как я постоянно выхожу в плюс?',
 'sourceDuration','4 минуты 39 секунд',
 'sourceOrder',3
)
from public.learning_categories where slug='money-management'
on conflict (slug) do update set title=excluded.title, excerpt=excluded.excerpt, lesson_type=excluded.lesson_type, duration_minutes=excluded.duration_minutes, sort_order=excluded.sort_order, status=excluded.status, category_id=excluded.category_id, content=excluded.content, updated_at=now();

-- 17. Трейдинг начинается в голове
insert into public.learning_lessons(slug,title,excerpt,lesson_type,duration_minutes,sort_order,status,category_id,content)
select 'psychology-trading-starts-in-head','Трейдинг начинается в голове — Урок 1','Почему депозит может сливаться не из-за стратегии: серии минусов, завышенный риск, отыгрыш и эмоциональная торговля.', 'video',18,30,'published',id,
jsonb_build_object(
 'videoUrl','',
 'article','Разбираются причины слива депозита, которые в описании урока связываются не со стратегией и рынком, а с поведением трейдера: серии минусов, завышенный риск, отыгрыш и эмоциональная торговля.',
 'examples','Материал перечисляет признаки проблемного торгового поведения и изменения, необходимые для перехода к системной торговле.',
 'practice','После просмотра выпиши, какие из перечисленных проблем уже встречались в твоей торговле.',
 'quiz','[]'::jsonb,
 'keyTakeaway','Системная торговля требует контроля риска и поведения, а не только поиска стратегии.',
 'sourceTitle','Курс: Трейдинг начинается в голове — Урок 1. Почему ты сливаешь депозит (и дело не в стратегии)',
 'sourceDuration','18 минут 29 секунд',
 'sourceOrder',3
)
from public.learning_categories where slug='psychology'
on conflict (slug) do update set title=excluded.title, excerpt=excluded.excerpt, lesson_type=excluded.lesson_type, duration_minutes=excluded.duration_minutes, sort_order=excluded.sort_order, status=excluded.status, category_id=excluded.category_id, content=excluded.content, updated_at=now();

-- 18. Риск и прибыль
insert into public.learning_lessons(slug,title,excerpt,lesson_type,duration_minutes,sort_order,status,category_id,content)
select 'money-profit-with-minimal-risk','Как зарабатывать много с минимальными рисками?','Материал о соотношении риска и прибыли, торговом плане и контроле поведения при потере баланса.', 'video',21,30,'published',id,
jsonb_build_object(
 'videoUrl','',
 'article','Материал посвящён соотношению риска и прибыли, построению торговой стратегии и плану. В описании отдельно отмечены страх потери баланса, догоны, долгий путь к цели, быстрый слив и потеря контроля.',
 'examples','Рассматриваются типичные ситуации, в которых трейдер теряет контроль над риском и поведением.',
 'practice','Составь собственные правила риска и список ситуаций, при которых торговля прекращается.',
 'quiz','[]'::jsonb,
 'keyTakeaway','Контроль риска и поведения является частью торговой системы.',
 'sourceTitle','КАК ЗАРАБАТЫВАТЬ МНОГО С МИНИМАЛЬНЫМИ РИСКАМИ?',
 'sourceDuration','20 минут 33 секунды',
 'sourceOrder',4
)
from public.learning_categories where slug='money-management'
on conflict (slug) do update set title=excluded.title, excerpt=excluded.excerpt, lesson_type=excluded.lesson_type, duration_minutes=excluded.duration_minutes, sort_order=excluded.sort_order, status=excluded.status, category_id=excluded.category_id, content=excluded.content, updated_at=now();

-- 19. Как торгует Амир
insert into public.learning_lessons(slug,title,excerpt,lesson_type,duration_minutes,sort_order,status,category_id,content)
select 'advanced-how-amir-trades','Как торгует Амир?','Разбор личного стиля торговли, технического анализа, торгового плана, риск-менеджмента и мышления автора.', 'video',12,20,'published',id,
jsonb_build_object(
 'videoUrl','',
 'article','Автор показывает свой стиль торговли, технический анализ, торговый план, риск-менеджмент и мышление.',
 'examples','Формат — демонстрация личного подхода автора.',
 'practice','Во время просмотра фиксируй не сигналы, а последовательность анализа и принятия решения.',
 'quiz','[]'::jsonb,
 'keyTakeaway','Разбор чужой торговли полезен как способ увидеть процесс принятия решения, а не как набор готовых сигналов.',
 'sourceTitle','Как торгует Амир?',
 'sourceDuration','12 минут 6 секунд',
 'sourceOrder',1
)
from public.learning_categories where slug='advanced'
on conflict (slug) do update set title=excluded.title, excerpt=excluded.excerpt, lesson_type=excluded.lesson_type, duration_minutes=excluded.duration_minutes, sort_order=excluded.sort_order, status=excluded.status, category_id=excluded.category_id, content=excluded.content, updated_at=now();

-- 20. Как торгует Амир — часть 2
insert into public.learning_lessons(slug,title,excerpt,lesson_type,duration_minutes,sort_order,status,category_id,content)
select 'advanced-how-amir-trades-2','Как торгует Амир? — Часть 2','Три сделки, логика рынка и напоминание об одной стратегии.', 'video',9,30,'published',id,
jsonb_build_object(
 'videoUrl','',
 'article','В видео проведены три сделки и объяснена логика рынка. В конце автор напоминает об одной стратегии.',
 'examples','Три реальные торговые ситуации в рамках авторского разбора.',
 'practice','Открыть одну учебную сделку по упомянутой стратегии за день и подготовить отчёт, как указано в исходном материале.',
 'quiz','[]'::jsonb,
 'keyTakeaway','Разбор сделки должен включать объяснение логики рынка, а не только результат.',
 'sourceTitle','КАК ТОРГУЕТ АМИР? — Часть 2',
 'sourceDuration','8 минут 50 секунд',
 'sourceOrder',2
)
from public.learning_categories where slug='advanced'
on conflict (slug) do update set title=excluded.title, excerpt=excluded.excerpt, lesson_type=excluded.lesson_type, duration_minutes=excluded.duration_minutes, sort_order=excluded.sort_order, status=excluded.status, category_id=excluded.category_id, content=excluded.content, updated_at=now();

-- 21. Пилотный выпуск разбора рынка
insert into public.learning_lessons(slug,title,excerpt,lesson_type,duration_minutes,sort_order,status,category_id,content)
select 'market-review-pilot','Пилотный выпуск — разбор рынка от Амира','Разбор рынка с логикой входа, поведением цены и мышлением трейдера.', 'video',17,20,'published',id,
jsonb_build_object(
 'videoUrl','',
 'article','Автор разбирает рынок, показывает логику входа, объясняет поведение цены и предлагает смотреть на торговлю как на понимание того, что стоит за движением.',
 'examples','Формат — личный разбор рынка от автора.',
 'practice','При следующем разборе своей сделки попробуй описать не только точку входа, но и логику движения цены до неё.',
 'quiz','[]'::jsonb,
 'keyTakeaway','Цель разбора рынка — перейти от шаблонного нажатия к пониманию движения цены.',
 'sourceTitle','ПИЛОТНЫЙ ВЫПУСК | РАЗБОР РЫНКА ОТ АМИРА',
 'sourceDuration','17 минут 5 секунд',
 'sourceOrder',1
)
from public.learning_categories where slug='market-analysis'
on conflict (slug) do update set title=excluded.title, excerpt=excluded.excerpt, lesson_type=excluded.lesson_type, duration_minutes=excluded.duration_minutes, sort_order=excluded.sort_order, status=excluded.status, category_id=excluded.category_id, content=excluded.content, updated_at=now();

notify pgrst, 'reload schema';
