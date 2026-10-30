// Server-side reminder dispatch: NEVER expose service role or Resend token to browser.
// Deploy as private scheduled Edge Function with JWT verification DISABLED only when
// JOB_SECRET checked here and protected by random secret in Vault / env.
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (request: Request) => {
  const jobSecret = Deno.env.get('AD_REMINDER_JOB_SECRET');
  if (!jobSecret || request.headers.get('x-job-secret') !== jobSecret) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('AD_REMINDER_FROM_EMAIL');
  if (!url || !serviceKey || !resendKey || !from) return new Response('Server setup incomplete', { status: 503 });
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: jobs, error: claimError } = await db.rpc('ad_claim_email_v4', { p_limit: 30 });
  if (claimError) {
    console.error('claim error', claimError.code);
    return new Response('Unable to claim reminders', { status: 500 });
  }
  let accepted = 0, failed = 0;
  for (const job of jobs ?? []) {
    let providerId: string | null = null;
    let errorMessage: string | null = null;
    try {
      // UTC is always accurate. Users can see their local wall-clock time on the site.
      const time = new Date(job.signal_starts_at).toLocaleString('ru-RU', { timeZone: job.timezone, dateStyle: 'medium', timeStyle: 'medium' });
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json',
          'Idempotency-Key': `ad-${job.queue_id}` },
        body: JSON.stringify({
          from, to: [job.recipient],
          subject: 'Trading Diary 02 — напоминание о сигнале',
          text: `Сигнал: ${job.signal_title}\nВремя: ${time}\nЧасовой пояс: ${job.timezone}\n\nЧтобы отключить письма, откройте настройки второго дневника.`
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.id) throw new Error(`Resend ${response.status}: ${JSON.stringify(result).slice(0,250)}`);
      providerId = result.id;
      accepted++;
    } catch (error) {
      errorMessage = String(error).slice(0,400);
      failed++;
    }
    const { error: finishError } = await db.rpc('ad_finish_email_v4', {
      p_queue_id: job.queue_id, p_accepted: !!providerId,
      p_provider_id: providerId, p_error: errorMessage
    });
    if (finishError) console.error('finish error', finishError.code);
  }
  // "accepted" means provider accepted the API request, NOT confirmed inbox delivery.
  return Response.json({ accepted, failed });
});
