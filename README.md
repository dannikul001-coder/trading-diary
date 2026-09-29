# Trading Diary — Journal Workbench

Это новая конструктивная версия интерфейса Trading Diary.

## Что изменено

- Полностью заменена компоновка: вместо прежней панели/верхней сетки используется левый командный rail + верхняя служебная строка + рабочее полотно.
- Навигация разделена на WORK / BUILD / REFLECT / SYSTEM.
- Главный экран построен как editorial workbench: крупные показатели, рабочий график и информационные панели вместо одинаковых карточек.
- Использована новая визуальная система: тёплый бумажный фон, графит, зелёный функциональный акцент, DM Sans + DM Mono + Playfair Display.
- Glassmorphism и неоновая стилистика убраны из базового оформления.
- Все интерактивные кнопки имеют отдельную геометрию, фиксированную высоту, padding и line-height, чтобы текст не «съезжал».
- Фоновые паттерны отделены от интерактивных поверхностей.
- Существующая логика сделок, статистики, графиков, целей, журнала, заметок, Playbook, Import Center и Supabase сохранена.

## Запуск

Откройте `index.html` через локальный сервер или используйте GitHub Pages.

GitHub Pages лучше подключать только после локальной проверки регистрации, входа, создания сделки, P&L и выхода из аккаунта.

## Safe cloud sync v5

Run `supabase/migration_v5_safe_trade_sync.sql` once in Supabase SQL Editor before importing the clean trade history.

Normal synchronization uses a stable per-user `sync_key` and batched UPSERTs. Normal sync never deletes remote trades because a device has fewer rows. Explicit deletes are recorded as cloud tombstones (`deleted_at`) so another device cannot resurrect the deleted trade.

Recommended clean start: sign in with the intended account, clear the workspace once if old local data must also be removed, then use Import Center to import the XLSX/CSV history. The provided terminal export format is supported, including Russian headers such as `Направление`, `Сделка`, `Экспирация`, `Актив`, `Время открытия`, `Время закрытия`, `Цена открытия`, `Цена закрытия`, `Размер сделки`, `Прибыль`, `Валюта`.


## V19 — профиль и пополнения
- Пополнения баланса хранятся в `balance_operations`, принимают сотые (`0.01`) и показываются историей с редактированием/удалением.
- Профиль справа сверху позволяет менять никнейм и аватарку; данные сохраняются в `profiles` и доступны на других устройствах.
- Перед использованием V19 один раз выполнить `supabase/migration_v8_profile_deposits.sql`.

## V20 — ручная сделка и устойчивость синхронизации
- Исправлена синхронизация ручных сделок: один проблемный ряд больше не блокирует остальные сделки.
- Добавлена повторная отправка с минимальным набором обязательных колонок, если Supabase отклоняет необязательное поле.
- `sync_key`, фото и остальные поля сохраняются при загрузке из облака.
- 2855+ существующих сделок не удаляются и не пересоздаются из-за ошибки одной новой сделки.
- SQL-миграции V18/V19 повторно выполнять не нужно.


## V21 balance operations and photo viewer
- Run `supabase/migration_v9_balance_withdrawals.sql` once after the existing balance migrations.
- Balance operations now support both `deposit` (Пополнение) and `withdrawal` (Вывод). Existing rows remain deposits.
- Amounts accept and preserve cents to 0.01. Withdrawals reduce balance and appear in history and balance charts.
- Trade photos now open inside the app modal instead of a blank new browser page.
