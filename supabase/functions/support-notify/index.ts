import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  buildSubject,
  escapeHtml,
  rateLimitDecision,
  RATE_LIMIT_WINDOW_MS,
  renderConfirmation,
  topicLabel,
} from './lib.ts';

/**
 * Emails a support request to the team inbox via Resend, then sends the person
 * who wrote in a confirmation.
 *
 * Takes only a row id: the message body is read back from `support_requests`
 * with the service role, so a caller can never post arbitrary content into the
 * inbox, and `notified_at` makes the send idempotent.
 *
 * The confirmation goes to a visitor-supplied address, so it is rate limited —
 * without that, a public form is a mail relay. The team notification is not,
 * since it only ever goes to SUPPORT_TO.
 *
 * Deploy with `--no-verify-jwt` — the contact page is public.
 *
 *   supabase functions deploy support-notify --no-verify-jwt
 *   supabase secrets set RESEND_API_KEY=re_xxx
 *   supabase secrets set SUPPORT_TO=hey@trymoonlit.app
 *   supabase secrets set SUPPORT_FROM="Moonlit <noreply@trymoonlit.app>"
 *   supabase secrets set SUPPORT_CONFIRM_FROM="Moonlit <hey@trymoonlit.app>"
 *   supabase secrets set SUPPORT_IP_SALT=<random string>
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

async function hashIp(ip: string, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${ip}${salt}`));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface ResendMessage {
  from: string;
  to: string[];
  reply_to: string;
  subject: string;
  text: string;
  html: string;
}

async function sendViaResend(apiKey: string, msg: ResendMessage) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(msg),
  });
  if (!res.ok) return { ok: false as const, status: res.status, detail: await res.text() };
  return { ok: true as const };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!apiKey) return json({ error: 'RESEND_API_KEY is not configured' }, 500);

    const to = Deno.env.get('SUPPORT_TO') ?? 'hey@trymoonlit.app';
    const from = Deno.env.get('SUPPORT_FROM') ?? 'Moonlit <noreply@trymoonlit.app>';
    const confirmFrom = Deno.env.get('SUPPORT_CONFIRM_FROM') ?? `Moonlit <${to}>`;
    const salt = Deno.env.get('SUPPORT_IP_SALT');

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

    if (request.notified_at) return json({ skipped: true, reason: 'already notified' });

    const topic = topicLabel(request.topic);
    const subject = buildSubject(request.topic);
    const received = new Date(request.created_at).toUTCString();

    // ---- 1. Team notification. Fixed address, never rate limited. ----
    const teamText =
      `${request.message}\n\n` +
      `— ${request.name} <${request.email}>\n` +
      `Topic: ${topic}\n` +
      `Received: ${received}\n` +
      `Signed in: ${request.user_id ? `yes (${request.user_id})` : 'no'}\n` +
      `Request id: ${request.id}`;

    const teamHtml = `
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

    const teamSend = await sendViaResend(apiKey, {
      from,
      to: [to],
      reply_to: request.email,
      subject,
      text: teamText,
      html: teamHtml,
    });

    if (!teamSend.ok) {
      console.error('resend send failed:', teamSend.status, teamSend.detail);
      return json(
        { error: 'Email provider rejected the send', status: teamSend.status, detail: teamSend.detail },
        502,
      );
    }

    const { error: markErr } = await supabaseAdmin
      .from('support_requests')
      .update({ notified_at: new Date().toISOString() })
      .eq('id', id);

    if (markErr) console.error('could not set notified_at:', markErr.message);

    // ---- 2. Confirmation. Visitor-supplied address, so it is gated. ----
    // Only attempted once the team notification has succeeded: nobody should be
    // told "we have your message" about a message nobody was told about.
    let confirmed = false;
    let confirmSkipped: string | null = null;

    if (!salt) {
      // Fail closed. Hashing with an empty salt would make the stored digest a
      // plain rainbow-table lookup of the IP.
      confirmSkipped = 'SUPPORT_IP_SALT is not configured';
      console.error(confirmSkipped);
    } else {
      const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
      const ipHash = ip ? await hashIp(ip, salt) : null;
      const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();

      const { count: byEmail } = await supabaseAdmin
        .from('support_requests')
        .select('id', { count: 'exact', head: true })
        .eq('email', request.email)
        .not('confirmed_at', 'is', null)
        .gte('created_at', since);

      let bySubmitter = 0;
      if (ipHash) {
        const { count } = await supabaseAdmin
          .from('support_requests')
          .select('id', { count: 'exact', head: true })
          .eq('submitter_ip_hash', ipHash)
          .not('confirmed_at', 'is', null)
          .gte('created_at', since);
        bySubmitter = count ?? 0;
      }

      const verdict = rateLimitDecision({ byEmail: byEmail ?? 0, bySubmitter });

      if (!verdict.allowed) {
        confirmSkipped = `rate limited (${verdict.reason})`;
        console.warn('confirmation', confirmSkipped, 'for request', id);
      } else {
        const { html, text } = renderConfirmation(request);
        const confirmSend = await sendViaResend(apiKey, {
          from: confirmFrom,
          to: [request.email],
          reply_to: to,
          subject,
          text,
          html,
        });

        if (confirmSend.ok) {
          confirmed = true;
          const { error: confErr } = await supabaseAdmin
            .from('support_requests')
            .update({ confirmed_at: new Date().toISOString(), submitter_ip_hash: ipHash })
            .eq('id', id);
          if (confErr) console.error('could not set confirmed_at:', confErr.message);
        } else {
          confirmSkipped = `resend rejected the confirmation (${confirmSend.status})`;
          console.error(confirmSkipped, confirmSend.detail);
        }
      }
    }

    return json({ sent: true, confirmed, confirmSkipped });
  } catch (err) {
    console.error('support-notify error:', err);
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
