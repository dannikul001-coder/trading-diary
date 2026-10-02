# Trading Diary V29 — Learning Lab

V29 is built on the verified V28 base.

## What's new
- Learning is available to authenticated users; admin-only controls remain restricted to admins.
- Full learning catalog with category rail, search, recommended lesson, roadmap and next step.
- Lesson flow: video → theory → examples → practice → quiz → notes → completion.
- YouTube links are embedded when a standard YouTube URL is supplied.
- Learner progress is saved to Supabase (`learning_progress`).
- Notes, quiz score, start/completion timestamps are stored per user.
- Admin can create/edit/publish/duplicate/delete categories and lessons.
- Lesson editor supports video URL, theory, examples, practice, quiz JSON and key takeaway.

## Quiz format
Use a JSON array in the lesson editor, for example:

[
  {"question":"Что означает уровень поддержки?","options":["Зона спроса","Случайная цена","Комиссия"],"answer":0},
  {"question":"Что должен содержать торговый план?","options":["Сценарий и риск","Только прогноз","Только сумму ставки"],"answer":0}
]

## Supabase migration
Run `supabase/migration_v14_learning_progress.sql` and, for V29.1 stability, `supabase/migration_v15_v29_1_stability.sql` once in Supabase SQL Editor.

Do not expose Supabase service-role/secret keys in the browser or repository.


## V29.1 stability patch
- Offline-safe delete tombstones for trades, plans and notes.
- Trade sync processes pending deletes before row-count reconciliation.
- Calendar exact-date filtering and 50-row trade pagination are retained.
- Psychology view includes result reactions, streaks, time concentration and state breakdown.
- Logout uses explicit Cancel / Logout actions instead of browser confirmation.

**Data safety:** do not use workspace reset/delete-all for testing against the real journal.
