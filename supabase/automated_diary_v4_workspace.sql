-- Trading Diary 02 V4: additive workspace / controlled financial corrections.
-- PREREQUISITES: automated_diary_v1.sql and automated_diary_v2_timeline.sql.
-- Make an independent database backup and test on a staging project first.
BEGIN;
ALTER TABLE public.automated_diary_profiles ADD COLUMN IF NOT EXISTS email_notifications_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.automated_diary_signals ADD COLUMN IF NOT EXISTS instrument text NOT NULL DEFAULT '';
ALTER TABLE public.automated_diary_signals ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT '';
ALTER TABLE public.automated_diary_signals ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS public.automated_diary_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '', body text NOT NULL DEFAULT '', note_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.automated_diary_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL, plan_date date NOT NULL DEFAULT CURRENT_DATE, done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.automated_diary_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL, target numeric(24,6) NOT NULL CHECK(target>0), current_value numeric(24,6) NOT NULL DEFAULT 0,
  due_date date, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ad_notes_date_idx ON public.automated_diary_notes(user_id,note_date DESC);
CREATE INDEX IF NOT EXISTS ad_plans_date_idx ON public.automated_diary_plans(user_id,plan_date DESC);
CREATE INDEX IF NOT EXISTS ad_goals_user_idx ON public.automated_diary_goals(user_id);
DO $$ DECLARE tbl text; BEGIN
  FOREACH tbl IN ARRAY ARRAY['automated_diary_notes','automated_diary_plans','automated_diary_goals'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',tbl||'_owner',tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (user_id=auth.uid()) WITH CHECK(user_id=auth.uid())',tbl||'_owner',tbl);
    EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',tbl);
  END LOOP;
END $$;

-- Immutable financial audit history readable by owner, writable only by SECURITY DEFINER functions.
CREATE TABLE IF NOT EXISTS public.automated_diary_trade_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_id uuid NOT NULL REFERENCES public.automated_diary_trades(id), changed_at timestamptz NOT NULL DEFAULT now(),
  old_data jsonb NOT NULL, new_data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS public.automated_diary_bonus_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bonus_id uuid NOT NULL REFERENCES public.automated_diary_bonuses(id), changed_at timestamptz NOT NULL DEFAULT now(),
  old_data jsonb NOT NULL, new_data jsonb NOT NULL
);
DO $$ DECLARE tbl text; BEGIN
  FOREACH tbl IN ARRAY ARRAY['automated_diary_trade_revisions','automated_diary_bonus_revisions'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',tbl||'_select_own',tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (user_id=auth.uid())',tbl||'_select_own',tbl);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',tbl);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated',tbl);
  END LOOP;
END $$;

-- Restrict all financial writes to audited, locked RPCs (RLS is still enabled).
-- Even a user with normal authenticated credentials cannot bypass validation with direct UPDATE.
REVOKE INSERT,UPDATE,DELETE ON public.automated_diary_trades FROM authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.automated_diary_ledger FROM authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.automated_diary_bonuses FROM authenticated;
REVOKE UPDATE,DELETE ON public.automated_diary_profiles FROM authenticated;

CREATE OR REPLACE FUNCTION public.ad_edit_trade_v4(
  p_id uuid,p_stake numeric,p_opened_at timestamptz,p_duration_seconds integer,
  p_note text,p_closed_at timestamptz DEFAULT NULL,p_payout numeric DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); old_row public.automated_diary_trades%ROWTYPE; new_row jsonb;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Войдите в аккаунт'; END IF;
 IF p_stake IS NULL OR p_stake<=0 OR scale(p_stake)>6 OR p_opened_at IS NULL OR p_duration_seconds IS NULL OR p_duration_seconds<1 OR
    p_opened_at>now()+interval '10 seconds' OR length(coalesce(p_note,''))>300 THEN RAISE EXCEPTION 'Некорректные параметры сделки'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text,0));
 SELECT * INTO old_row FROM public.automated_diary_trades WHERE user_id=u AND id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Сделка не найдена'; END IF;
 IF old_row.status='closed' THEN
   IF p_closed_at IS NULL OR p_payout IS NULL OR p_payout<=p_stake OR scale(p_payout)>6 OR p_closed_at<p_opened_at OR p_closed_at>now()+interval '10 seconds' THEN
     RAISE EXCEPTION 'Закрытая сделка должна иметь прибыльный возврат и корректное время'; END IF;
 ELSE
   IF p_closed_at IS NOT NULL OR p_payout IS NOT NULL THEN RAISE EXCEPTION 'Для закрытия используйте отдельную операцию'; END IF;
 END IF;
 UPDATE public.automated_diary_trades SET stake=p_stake,opened_at=p_opened_at,duration_seconds=p_duration_seconds,note=coalesce(p_note,''),
   closed_at=CASE WHEN old_row.status='closed' THEN p_closed_at ELSE NULL END,
   payout=CASE WHEN old_row.status='closed' THEN p_payout ELSE NULL END WHERE id=p_id;
 PERFORM public.ad_validate_cash_v2(u);
 SELECT to_jsonb(t) INTO new_row FROM public.automated_diary_trades t WHERE t.id=p_id;
 INSERT INTO public.automated_diary_trade_revisions(user_id,trade_id,old_data,new_data)
 VALUES(u,p_id,to_jsonb(old_row),new_row);
 RETURN p_id;
END $$;

ALTER TABLE public.automated_diary_bonuses ADD COLUMN IF NOT EXISTS request_id uuid;
CREATE OR REPLACE FUNCTION public.ad_save_bonus_v4(
 p_id uuid,p_title text,p_amount numeric,p_status text,p_received_at timestamptz,p_request_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); old_row public.automated_diary_bonuses%ROWTYPE; new_id uuid; new_row jsonb;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Войдите в аккаунт'; END IF;
 IF length(btrim(coalesce(p_title,'')))<1 OR length(p_title)>120 OR p_amount IS NULL OR p_amount<0 OR scale(p_amount)>4 OR
    p_status NOT IN ('received','pending','cancelled') OR (p_status='received' AND (p_amount<=0 OR p_received_at IS NULL OR p_received_at>now()+interval '10 seconds')) THEN
    RAISE EXCEPTION 'Проверьте название, статус, сумму и фактическое время бонуса'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text,0));
 IF p_id IS NULL THEN
   IF p_request_id IS NULL THEN RAISE EXCEPTION 'Не указан уникальный номер запроса'; END IF;
   SELECT id INTO new_id FROM public.automated_diary_bonuses WHERE user_id=u AND request_id=p_request_id;
   IF new_id IS NOT NULL THEN RETURN new_id; END IF;
   INSERT INTO public.automated_diary_bonuses(user_id,title,amount,status,received_at,request_id)
   VALUES(u,p_title,p_amount,p_status,p_received_at,p_request_id) RETURNING id INTO new_id;
 ELSE
   SELECT * INTO old_row FROM public.automated_diary_bonuses WHERE id=p_id AND user_id=u FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Бонус не найден'; END IF;
   UPDATE public.automated_diary_bonuses SET title=p_title,amount=p_amount,status=p_status,received_at=p_received_at WHERE id=p_id;
   new_id:=p_id;
 END IF;
 PERFORM public.ad_validate_cash_v2(u);
 IF p_id IS NOT NULL THEN
   SELECT to_jsonb(b) INTO new_row FROM public.automated_diary_bonuses b WHERE b.id=new_id;
   INSERT INTO public.automated_diary_bonus_revisions(user_id,bonus_id,old_data,new_data)
   VALUES(u,new_id,to_jsonb(old_row),new_row);
 END IF;
 RETURN new_id;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS automated_diary_bonus_request_idx ON public.automated_diary_bonuses(user_id,request_id) WHERE request_id IS NOT NULL;

-- Profile corrections are audited; changing currency does NOT silently convert old money.
CREATE TABLE IF NOT EXISTS public.automated_diary_profile_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 changed_at timestamptz NOT NULL DEFAULT now(),old_data jsonb NOT NULL,new_data jsonb NOT NULL
);
ALTER TABLE public.automated_diary_profile_revisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ad_profile_revisions_read ON public.automated_diary_profile_revisions;
CREATE POLICY ad_profile_revisions_read ON public.automated_diary_profile_revisions FOR SELECT TO authenticated USING(user_id=auth.uid());
REVOKE ALL ON public.automated_diary_profile_revisions FROM anon,authenticated;
GRANT SELECT ON public.automated_diary_profile_revisions TO authenticated;
CREATE OR REPLACE FUNCTION public.ad_update_profile_v2(
 p_initial_balance numeric,p_currency text,p_timezone text,p_duration_seconds integer,
 p_stake_percent numeric,p_profit_percent numeric
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); old_row public.automated_diary_profiles%ROWTYPE;new_row jsonb;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Войдите в аккаунт'; END IF;
 IF p_initial_balance IS NULL OR p_initial_balance<0 OR scale(p_initial_balance)>6 OR
    p_duration_seconds IS NULL OR p_duration_seconds<1 OR p_stake_percent IS NULL OR p_stake_percent<0 OR
    p_profit_percent IS NULL OR p_profit_percent<0 OR p_currency NOT IN ('USDT','USD','EUR','BTC') OR
    p_timezone IS NULL OR length(p_timezone)>100 THEN RAISE EXCEPTION 'Некорректные настройки'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text,0));
 SELECT * INTO old_row FROM public.automated_diary_profiles WHERE user_id=u FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Профиль не найден'; END IF;
 IF p_currency<>old_row.currency AND (
   EXISTS(SELECT 1 FROM public.automated_diary_trades WHERE user_id=u) OR
   EXISTS(SELECT 1 FROM public.automated_diary_ledger WHERE user_id=u) OR
   EXISTS(SELECT 1 FROM public.automated_diary_bonuses WHERE user_id=u AND status='received')
 ) THEN RAISE EXCEPTION 'Валюту счёта с операциями нельзя менять без отдельной конвертации истории'; END IF;
 UPDATE public.automated_diary_profiles SET initial_balance=p_initial_balance,currency=p_currency,timezone=p_timezone,
 duration_seconds=p_duration_seconds,stake_percent=p_stake_percent,profit_percent=p_profit_percent,updated_at=now()
 WHERE user_id=u;
 PERFORM public.ad_validate_cash_v2(u);
 SELECT to_jsonb(p) INTO new_row FROM public.automated_diary_profiles p WHERE user_id=u;
 INSERT INTO public.automated_diary_profile_revisions(user_id,old_data,new_data) VALUES(u,to_jsonb(old_row),new_row);
END $$;

-- Explicit opt-in for reminders. No address is stored in the browser or the public profile table.
CREATE OR REPLACE FUNCTION public.ad_set_email_v4(p_enabled boolean) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Войдите в аккаунт'; END IF;
 UPDATE public.automated_diary_profiles SET email_notifications_enabled=coalesce(p_enabled,false),updated_at=now() WHERE user_id=auth.uid();
END $$;

-- Admin reports: only user_roles admins can see other accounts. No mutation permissions.
CREATE OR REPLACE FUNCTION public.ad_is_admin_v4() RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='admin');
$$;
CREATE OR REPLACE FUNCTION public.ad_admin_overview_v4()
RETURNS TABLE(user_id uuid,display_name text,email text,currency text,diary_started boolean,available numeric,capital numeric,
  earned numeric,trades_total bigint,trades_closed bigint,bonuses_total numeric,signals_total bigint,
  plans_done bigint,plans_total bigint,goals_total bigint,goals_complete bigint,learning_completed bigint,learning_total bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.ad_is_admin_v4() THEN RAISE EXCEPTION 'Доступ только для администратора'; END IF;
 RETURN QUERY
 SELECT u.id,coalesce(p.display_name,u.email,'Участник')::text,u.email::text,coalesce(pr.currency,'—')::text,(pr.user_id IS NOT NULL)::boolean,
    (coalesce(pr.initial_balance,0)+coalesce(c.dep,0)-coalesce(c.wdr,0)+coalesce(b.bonus,0)+coalesce(t.payouts,0)-coalesce(t.stakes,0))::numeric,
    (coalesce(pr.initial_balance,0)+coalesce(c.dep,0)-coalesce(c.wdr,0)+coalesce(b.bonus,0)+coalesce(t.earned,0))::numeric,
    coalesce(t.earned,0)::numeric,coalesce(t.ct,0)::bigint,coalesce(t.cc,0)::bigint,coalesce(b.bonus,0)::numeric,
    coalesce(s.ct,0)::bigint,coalesce(pl.done_count,0)::bigint,coalesce(pl.ct,0)::bigint,
    coalesce(g.ct,0)::bigint,coalesce(g.done_count,0)::bigint,coalesce(lp.ct,0)::bigint,coalesce(lt.ct,0)::bigint
 FROM auth.users u LEFT JOIN public.automated_diary_profiles pr ON pr.user_id=u.id
 LEFT JOIN public.profiles p ON p.id=u.id
 LEFT JOIN LATERAL (SELECT COUNT(*) ct,COUNT(*) FILTER(WHERE status='closed') cc,
      coalesce(sum(stake) FILTER(WHERE opened_at<=now()),0) stakes,
      coalesce(sum(payout) FILTER(WHERE status='closed' AND closed_at<=now()),0) payouts,
      coalesce(sum(payout-stake) FILTER(WHERE status='closed' AND closed_at<=now()),0) earned
      FROM public.automated_diary_trades trd WHERE trd.user_id=u.id) t ON true
 LEFT JOIN LATERAL (SELECT coalesce(sum(amount) FILTER(WHERE kind='deposit' AND operated_at<=now()),0) dep,
      coalesce(sum(amount) FILTER(WHERE kind='withdrawal' AND operated_at<=now()),0) wdr
      FROM public.automated_diary_ledger led WHERE led.user_id=u.id) c ON true
 LEFT JOIN LATERAL (SELECT coalesce(sum(amount) FILTER(WHERE status='received' AND coalesce(received_at,created_at)<=now()),0) bonus
      FROM public.automated_diary_bonuses bn WHERE bn.user_id=u.id) b ON true
 LEFT JOIN LATERAL (SELECT count(*) ct FROM public.automated_diary_signals sig WHERE sig.user_id=u.id) s ON true
 LEFT JOIN LATERAL (SELECT count(*) ct,count(*) FILTER(WHERE done) done_count FROM public.automated_diary_plans plan WHERE plan.user_id=u.id) pl ON true
 LEFT JOIN LATERAL (SELECT count(*) ct,count(*) FILTER(WHERE current_value>=target) done_count FROM public.automated_diary_goals goal WHERE goal.user_id=u.id) g ON true
 LEFT JOIN LATERAL (SELECT count(*) ct FROM public.learning_progress prog JOIN public.learning_lessons lesson ON lesson.id=prog.lesson_id WHERE prog.user_id=u.id AND prog.status='completed' AND lesson.status='published') lp ON true
 LEFT JOIN LATERAL (SELECT count(*) ct FROM public.learning_lessons WHERE status='published') lt ON true
 ORDER BY u.email;
END $$;

-- Delivery queue; delivery is only "accepted" after mail provider confirms acceptance.
CREATE TABLE IF NOT EXISTS public.automated_diary_email_queue (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 signal_id uuid NOT NULL REFERENCES public.automated_diary_signals(id) ON DELETE CASCADE,
 starts_at timestamptz NOT NULL,remind_minutes integer NOT NULL, status text NOT NULL DEFAULT 'pending'
 CHECK (status IN ('pending','processing','accepted','failed')),
 attempts integer NOT NULL DEFAULT 0, locked_at timestamptz,
 provider_message_id text, last_error text,updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(signal_id,starts_at,remind_minutes)
);
ALTER TABLE public.automated_diary_email_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ad_email_queue_own_read ON public.automated_diary_email_queue;
CREATE POLICY ad_email_queue_own_read ON public.automated_diary_email_queue FOR SELECT TO authenticated USING(user_id=auth.uid());
REVOKE ALL ON public.automated_diary_email_queue FROM anon,authenticated;
GRANT SELECT ON public.automated_diary_email_queue TO authenticated;

CREATE OR REPLACE FUNCTION public.ad_claim_email_v4(p_limit integer DEFAULT 30)
 RETURNS TABLE(queue_id uuid,recipient text,signal_title text,signal_starts_at timestamptz,timezone text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Service only'; END IF;
 INSERT INTO public.automated_diary_email_queue(user_id,signal_id,starts_at,remind_minutes)
 SELECT s.user_id,s.id,s.starts_at,s.remind_minutes FROM public.automated_diary_signals s
 JOIN public.automated_diary_profiles p ON p.user_id=s.user_id
 JOIN auth.users verified_user ON verified_user.id=s.user_id AND verified_user.email_confirmed_at IS NOT NULL
 WHERE s.enabled AND p.signals_enabled AND p.email_notifications_enabled
   AND s.starts_at > now()-interval '5 minutes'
   AND (s.starts_at-s.remind_minutes*interval '1 minute')<=now()
 ON CONFLICT DO NOTHING;
 RETURN QUERY
 WITH claimed AS (
   SELECT q.id FROM public.automated_diary_email_queue q
   WHERE (q.status='pending' OR (q.status='processing' AND q.locked_at<now()-interval '10 minutes') OR
      (q.status='failed' AND q.attempts<3 AND q.updated_at<now()-interval '3 minutes'))
   ORDER BY q.updated_at FOR UPDATE SKIP LOCKED LIMIT least(greatest(p_limit,1),100)
 ), changed AS (
   UPDATE public.automated_diary_email_queue q SET status='processing',attempts=q.attempts+1,locked_at=now(),updated_at=now()
   WHERE q.id IN (SELECT id FROM claimed) RETURNING q.*
 )
 SELECT c.id,u.email::text,s.title::text,s.starts_at,p.timezone::text FROM changed c
 JOIN public.automated_diary_signals s ON s.id=c.signal_id AND s.starts_at=c.starts_at AND s.remind_minutes=c.remind_minutes
 JOIN public.automated_diary_profiles p ON p.user_id=c.user_id
 JOIN auth.users u ON u.id=c.user_id
 WHERE s.enabled AND p.email_notifications_enabled AND p.signals_enabled AND u.email IS NOT NULL;
END $$;
CREATE OR REPLACE FUNCTION public.ad_finish_email_v4(p_queue_id uuid,p_accepted boolean,p_provider_id text DEFAULT NULL,p_error text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Service only'; END IF;
 UPDATE public.automated_diary_email_queue SET status=CASE WHEN p_accepted THEN 'accepted' ELSE 'failed' END,
  provider_message_id=CASE WHEN p_accepted THEN p_provider_id ELSE NULL END,
  last_error=CASE WHEN p_accepted THEN NULL ELSE left(coalesce(p_error,'Provider unavailable'),500) END,updated_at=now()
 WHERE id=p_queue_id AND status='processing';
END $$;
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('ad_edit_trade_v4','ad_save_bonus_v4','ad_set_email_v4','ad_is_admin_v4','ad_admin_overview_v4','ad_claim_email_v4','ad_finish_email_v4') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.ad_edit_trade_v4(uuid,numeric,timestamptz,integer,text,timestamptz,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ad_save_bonus_v4(uuid,text,numeric,text,timestamptz,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ad_set_email_v4(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ad_is_admin_v4() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ad_admin_overview_v4() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ad_claim_email_v4(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.ad_finish_email_v4(uuid,boolean,text,text) TO service_role;
COMMIT;
