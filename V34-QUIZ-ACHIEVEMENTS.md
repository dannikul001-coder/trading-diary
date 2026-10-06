# V34 — Quiz shuffle + saved achievements

- A/B/C/D display order is randomized every time a lesson test is opened or restarted.
- Wrong answer ends the current attempt and changes the action to «Начать заново».
- Successful perfect quiz attempts are persisted in `learning_quiz_attempts`.
- Profile shows all 68 lesson medals, with locked/unlocked state.
- Correct-answer mappings were normalized from the authored feedback to fix legacy mismatches.

Run `supabase/migration_v32_academy.sql` after updating the project.
