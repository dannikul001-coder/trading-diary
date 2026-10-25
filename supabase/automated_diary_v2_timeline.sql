-- Automated Signals Diary V3: additive ledger timestamps and atomic financial writes.
-- Apply AFTER automated_diary_v1.sql. Run backup first; DO NOT run on unrelated main diary tables.
-- Existing rows retain their original created_at as the best available effective time.
BEGIN;
ALTER TABLE public.automated_diary_ledger ADD COLUMN IF NOT EXISTS operated_at timestamptz;
ALTER TABLE public.automated_diary_ledger ADD COLUMN IF NOT EXISTS operated_at_inferred boolean NOT NULL DEFAULT false;
UPDATE public.automated_diary_ledger SET operated_at = created_at, operated_at_inferred = true WHERE operated_at IS NULL;
ALTER TABLE public.automated_diary_ledger ALTER COLUMN operated_at SET DEFAULT now();
ALTER TABLE public.automated_diary_ledger ALTER COLUMN operated_at SET NOT NULL;
CREATE INDEX IF NOT EXISTS automated_diary_ledger_user_operated_idx ON public.automated_diary_ledger (user_id, operated_at, id);
ALTER TABLE public.automated_diary_ledger ADD COLUMN IF NOT EXISTS request_id uuid;
ALTER TABLE public.automated_diary_trades ADD COLUMN IF NOT EXISTS request_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS automated_diary_ledger_request_idx ON public.automated_diary_ledger(user_id, request_id) WHERE request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS automated_diary_trade_request_idx ON public.automated_diary_trades(user_id, request_id) WHERE request_id IS NOT NULL;
-- NOT VALID preserves legacy rows for audit; it still validates all future inserts and updates.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='automated_diary_profitable_close_v2') THEN
    ALTER TABLE public.automated_diary_trades ADD CONSTRAINT automated_diary_profitable_close_v2
      CHECK (status <> 'closed' OR payout > stake) NOT VALID;
  END IF;
END $$;

-- Audit trail of explicit corrections, no client-side insert/delete permissions.
CREATE TABLE IF NOT EXISTS public.automated_diary_ledger_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ledger_id uuid NOT NULL REFERENCES public.automated_diary_ledger(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  old_kind text NOT NULL, old_amount numeric(24,6) NOT NULL, old_operated_at timestamptz NOT NULL, old_note text NOT NULL,
  new_kind text NOT NULL, new_amount numeric(24,6) NOT NULL, new_operated_at timestamptz NOT NULL, new_note text NOT NULL
);
ALTER TABLE public.automated_diary_ledger_revisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS automated_diary_ledger_revisions_select_own ON public.automated_diary_ledger_revisions;
CREATE POLICY automated_diary_ledger_revisions_select_own ON public.automated_diary_ledger_revisions
  FOR SELECT TO authenticated USING (auth.uid()=user_id);
GRANT SELECT ON public.automated_diary_ledger_revisions TO authenticated;

-- Atomic chronological balance check, including open-stake reservations and historical cash movements.
-- Same-second ordering: cash deposits/bonuses, closed payouts, trade opens, withdrawals.
CREATE OR REPLACE FUNCTION public.ad_validate_cash_v2(p_user uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE bad_time timestamptz; bad_balance numeric;
BEGIN
  WITH movements AS (
    SELECT l.operated_at AS at, CASE WHEN l.kind = 'deposit' THEN 0 ELSE 3 END AS rank,
           l.id::text AS tie, CASE WHEN l.kind = 'deposit' THEN l.amount ELSE -l.amount END AS amount
    FROM public.automated_diary_ledger l WHERE l.user_id=p_user
    UNION ALL
    SELECT t.opened_at, 2, t.id::text, -t.stake FROM public.automated_diary_trades t WHERE t.user_id=p_user
    UNION ALL
    SELECT t.closed_at, 1, t.id::text, t.payout FROM public.automated_diary_trades t WHERE t.user_id=p_user AND t.status='closed'
    UNION ALL
    SELECT coalesce(b.received_at,b.created_at), 0, b.id::text, b.amount
      FROM public.automated_diary_bonuses b WHERE b.user_id=p_user AND b.status='received'
  ), run AS (
    SELECT m.at, (p.initial_balance + sum(m.amount) OVER(ORDER BY m.at,m.rank,m.tie ROWS UNBOUNDED PRECEDING)) AS cash
    FROM movements m CROSS JOIN public.automated_diary_profiles p WHERE p.user_id=p_user
  )
  SELECT at,cash INTO bad_time,bad_balance FROM run WHERE cash < 0 ORDER BY at LIMIT 1;
  IF bad_time IS NOT NULL THEN
    RAISE EXCEPTION 'Недостаточно средств на % (исторический баланс: %). Проверьте время операций.',bad_time,bad_balance USING ERRCODE='P0001';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.ad_validate_cash_v2(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ad_open_trade_v2(
  p_stake numeric, p_opened_at timestamptz, p_duration_seconds integer, p_note text, p_request_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u uuid := auth.uid(); existing uuid; created uuid;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'Требуется авторизация'; END IF;
  IF p_stake IS NULL OR p_stake <= 0 OR scale(p_stake)>6 OR p_duration_seconds IS NULL OR p_duration_seconds<1 OR p_opened_at IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'Некорректные параметры сделки';
  END IF;
  IF p_opened_at > now() + interval '10 seconds' THEN RAISE EXCEPTION 'Нельзя открыть сделку в будущем'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(u::text, 0));
  SELECT id INTO existing FROM public.automated_diary_trades WHERE user_id=u AND request_id=p_request_id;
  IF existing IS NOT NULL THEN RETURN existing; END IF;
  INSERT INTO public.automated_diary_trades(user_id,stake,opened_at,duration_seconds,note,request_id,status)
  VALUES(u,p_stake,p_opened_at,p_duration_seconds,coalesce(p_note,''),p_request_id,'open') RETURNING id INTO created;
  PERFORM public.ad_validate_cash_v2(u);
  RETURN created;
END $$;

CREATE OR REPLACE FUNCTION public.ad_close_trade_v2(
  p_trade_id uuid, p_payout numeric, p_closed_at timestamptz
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u uuid := auth.uid(); t public.automated_diary_trades%ROWTYPE;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'Требуется авторизация'; END IF;
  IF p_closed_at IS NULL OR p_payout IS NULL OR scale(p_payout)>6 THEN RAISE EXCEPTION 'Некорректный возврат или время'; END IF;
  IF p_closed_at > now() + interval '10 seconds' THEN RAISE EXCEPTION 'Время закрытия в будущем'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(u::text,0));
  SELECT * INTO t FROM public.automated_diary_trades WHERE id=p_trade_id AND user_id=u FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Сделка не найдена'; END IF;
  IF t.status <> 'open' THEN RAISE EXCEPTION 'Сделка уже закрыта'; END IF;
  IF p_payout<=t.stake THEN RAISE EXCEPTION 'В этом дневнике возврат должен превышать ставку'; END IF;
  IF p_closed_at<t.opened_at THEN RAISE EXCEPTION 'Закрытие не может быть раньше открытия'; END IF;
  UPDATE public.automated_diary_trades SET payout=p_payout,closed_at=p_closed_at,status='closed' WHERE id=t.id;
  PERFORM public.ad_validate_cash_v2(u);
  RETURN t.id;
END $$;

CREATE OR REPLACE FUNCTION public.ad_record_cash_v2(
  p_kind text, p_amount numeric, p_operated_at timestamptz, p_note text, p_request_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u uuid := auth.uid(); existing uuid; created uuid;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'Требуется авторизация'; END IF;
  IF p_kind NOT IN ('deposit','withdrawal') OR p_amount IS NULL OR p_amount<=0 OR scale(p_amount)>6 OR p_operated_at IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'Некорректные параметры операции';
  END IF;
  IF p_operated_at>now()+interval '10 seconds' THEN RAISE EXCEPTION 'Будущие операции нужно вносить после их выполнения'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(u::text,0));
  SELECT id INTO existing FROM public.automated_diary_ledger WHERE user_id=u AND request_id=p_request_id;
  IF existing IS NOT NULL THEN RETURN existing; END IF;
  INSERT INTO public.automated_diary_ledger(user_id,kind,amount,operated_at,note,request_id)
  VALUES (u,p_kind,p_amount,p_operated_at,coalesce(p_note,''),p_request_id) RETURNING id INTO created;
  PERFORM public.ad_validate_cash_v2(u);
  RETURN created;
END $$;
-- Correction retains a separate immutable audit record; entire transaction rolls back
-- if changing an earlier deposit would invalidate a later trade/withdrawal.
CREATE OR REPLACE FUNCTION public.ad_correct_cash_v2(
  p_operation_id uuid, p_kind text, p_amount numeric, p_operated_at timestamptz, p_note text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u uuid := auth.uid(); old public.automated_diary_ledger%ROWTYPE;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'Требуется авторизация'; END IF;
  IF p_kind NOT IN ('deposit','withdrawal') OR p_amount IS NULL OR p_amount<=0 OR scale(p_amount)>6 OR p_operated_at IS NULL THEN
    RAISE EXCEPTION 'Некорректные параметры исправления';
  END IF;
  IF p_operated_at>now()+interval '10 seconds' THEN RAISE EXCEPTION 'Время операции не может быть в будущем'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(u::text,0));
  SELECT * INTO old FROM public.automated_diary_ledger WHERE id=p_operation_id AND user_id=u FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Операция не найдена'; END IF;
  UPDATE public.automated_diary_ledger SET kind=p_kind,amount=p_amount,operated_at=p_operated_at,
    operated_at_inferred=false,note=coalesce(p_note,'') WHERE id=old.id;
  PERFORM public.ad_validate_cash_v2(u);
  INSERT INTO public.automated_diary_ledger_revisions(user_id,ledger_id,old_kind,old_amount,old_operated_at,old_note,new_kind,new_amount,new_operated_at,new_note)
  VALUES(u,old.id,old.kind,old.amount,old.operated_at,old.note,p_kind,p_amount,p_operated_at,coalesce(p_note,''));
  RETURN old.id;
END $$;

-- A changed initial balance is also a financial write; verify the entire historical sequence.
CREATE OR REPLACE FUNCTION public.ad_update_profile_v2(
  p_initial_balance numeric, p_currency text, p_timezone text,
  p_duration_seconds integer, p_stake_percent numeric, p_profit_percent numeric
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u uuid := auth.uid();
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'Требуется авторизация'; END IF;
  IF p_initial_balance<0 OR scale(p_initial_balance)>6 OR
    p_duration_seconds<1 OR p_stake_percent<0 OR p_profit_percent<0 OR
    p_currency NOT IN ('USDT','USD','EUR','BTC') OR length(p_timezone)>100 THEN
    RAISE EXCEPTION 'Некорректные параметры';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(u::text,0));
  UPDATE public.automated_diary_profiles SET initial_balance=p_initial_balance,
    currency=p_currency, timezone=p_timezone, duration_seconds=p_duration_seconds,
    stake_percent=p_stake_percent, profit_percent=p_profit_percent, updated_at=now()
  WHERE user_id=u;
  IF NOT FOUND THEN RAISE EXCEPTION 'Профиль не найден'; END IF;
  PERFORM public.ad_validate_cash_v2(u);
END $$;
REVOKE ALL ON FUNCTION public.ad_open_trade_v2(numeric,timestamptz,integer,text,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.ad_close_trade_v2(uuid,numeric,timestamptz) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.ad_record_cash_v2(text,numeric,timestamptz,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ad_open_trade_v2(numeric,timestamptz,integer,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ad_close_trade_v2(uuid,numeric,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ad_record_cash_v2(text,numeric,timestamptz,text,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.ad_update_profile_v2(numeric,text,text,integer,numeric,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ad_update_profile_v2(numeric,text,text,integer,numeric,numeric) TO authenticated;
REVOKE ALL ON FUNCTION public.ad_correct_cash_v2(uuid,text,numeric,timestamptz,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ad_correct_cash_v2(uuid,text,numeric,timestamptz,text) TO authenticated;
COMMIT;
