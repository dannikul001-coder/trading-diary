-- V29 Learning Lab: richer learner progress without breaking existing rows.
alter table public.learning_progress
  add column if not exists notes text not null default '';
alter table public.learning_progress
  add column if not exists quiz_score numeric(5,2);
alter table public.learning_progress
  add column if not exists started_at timestamptz;
alter table public.learning_progress
  add column if not exists completed_at timestamptz;

-- Expand the learning catalog to the full V29 curriculum.
insert into public.learning_categories(slug,title,description,sort_order,published)
values
('candles','Свечи и паттерны','Свечи, формации и чтение поведения цены.',20,true),
('technical','Технический анализ','Структура рынка, уровни, тренды и контекст.',30,true),
('indicators','Индикаторы','Индикаторы, настройки и правила применения.',40,true),
('chart-analysis','Графический анализ','Уровни, фигуры и сценарии на графике.',45,true),
('strategies','Стратегии','Торговые сценарии и системный playbook.',50,true),
('psychology','Психология','Дисциплина, эмоции и качество решений.',60,true),
('money-management','Мани-менеджмент','Риск, размер позиции и контроль серии.',65,true),
('timing','Экспирации и тайминг','Время входа, экспирации и управление контекстом.',68,true),
('trade-review','Разбор сделок','Разбор реальных сделок и ошибок.',70,true),
('practice','Практика','Кейсы, задания и симуляции.',80,true),
('advanced','Продвинутый уровень','Сложные сценарии и системное мышление.',90,true)
on conflict (slug) do update set title=excluded.title, description=excluded.description, sort_order=excluded.sort_order;

notify pgrst, 'reload schema';
