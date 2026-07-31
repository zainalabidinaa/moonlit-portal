import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Emails a support request to the team inbox via Resend.
 *
 * Takes only a row id: the message body is read back from `support_requests`
 * with the service role, so a caller can never post arbitrary content into the
 * inbox, and `notified_at` makes the send idempotent (one email per request,
 * however many times it is invoked).
 *
 * Deploy with `--no-verify-jwt` — the contact page is public, so visitors who
 * are not signed in have to be able to reach it.
 *
 *   supabase functions deploy support-notify --no-verify-jwt
 *   supabase secrets set RESEND_API_KEY=re_xxx
 *   supabase secrets set SUPPORT_TO=hey@trymoonlit.app
 *   supabase secrets set SUPPORT_FROM="Moonlit <noreply@trymoonlit.app>"
 *
 * SUPPORT_FROM must be on a domain verified in Resend, otherwise Resend
 * rejects the send.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const TOPIC_LABELS: Record<string, string> = {
  general: 'General question',
  account: 'Account & profiles',
  billing: 'Billing & plans',
  playback: 'Playback & devices',
  bug: 'Bug report',
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!apiKey) return json({ error: 'RESEND_API_KEY is not configured' }, 500);

    const to = Deno.env.get('SUPPORT_TO') ?? 'hey@trymoonlit.app';
    const from = Deno.env.get('SUPPORT_FROM') ?? 'Moonlit <noreply@trymoonlit.app>';

    const { id } = await req.json().catch(() => ({ id: null }));
    if (!id || typeof id !== 'string') return json({ error: 'A support request id is required' }, 400);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: request, error: readErr } = await supabaseAdmin
      .from('support_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (readErr) throw readErr;
    if (!request) return json({ error: 'Support request not found' }, 404);

    // Already emailed — treat as success so retries stay harmless.
    if (request.notified_at) return json({ skipped: true, reason: 'already notified' });

    const topic = TOPIC_LABELS[request.topic] ?? request.topic;
    const received = new Date(request.created_at).toUTCString();
    const text =
      `${request.message}\n\n` +
      `— ${request.name} <${request.email}>\n` +
      `Topic: ${topic}\n` +
      `Received: ${received}\n` +
      `Signed in: ${request.user_id ? `yes (${request.user_id})` : 'no'}\n` +
      `Request id: ${request.id}`;

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px">
        <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8a6f5f">
          ${escapeHtml(topic)}
        </p>
        <h2 style="margin:0 0 16px;font-size:20px">New support request</h2>
        <p style="white-space:pre-wrap;font-size:15px;line-height:1.6;margin:0 0 24px">${escapeHtml(request.message)}</p>
        <table style="font-size:13px;color:#555;border-collapse:collapse">
          <tr><td style="padding:2px 12px 2px 0">From</td><td>${escapeHtml(request.name)} &lt;${escapeHtml(request.email)}&gt;</td></tr>
          <tr><td style="padding:2px 12px 2px 0">Received</td><td>${escapeHtml(received)}</td></tr>
          <tr><td style="padding:2px 12px 2px 0">Signed in</td><td>${request.user_id ? 'yes' : 'no'}</td></tr>
          <tr><td style="padding:2px 12px 2px 0">Request id</td><td>${escapeHtml(request.id)}</td></tr>
        </table>
      </div>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [to],
        // Hitting reply in the inbox answers the person who wrote in.
        reply_to: request.email,
        subject: `[Moonlit ${topic}] ${request.name}`,
        text,
        html,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error('resend send failed:', res.status, detail);
      return json({ error: 'Email provider rejected the send', status: res.status, detail }, 502);
    }

    const { error: markErr } = await supabaseAdmin
      .from('support_requests')
      .update({ notified_at: new Date().toISOString() })
      .eq('id', id);

    // The mail is already out; a failed bookkeeping update must not read as failure.
    if (markErr) console.error('could not set notified_at:', markErr.message);

    return json({ sent: true });
  } catch (err) {
    console.error('support-notify error:', err);
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
