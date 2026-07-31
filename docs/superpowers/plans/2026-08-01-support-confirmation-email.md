# Support Confirmation Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Email the sender a branded confirmation of their support request, and make a human reply from `hey@trymoonlit.app` thread correctly in their inbox.

**Architecture:** The existing `support-notify` edge function gains a second Resend call rather than a new function — it already loads the row under the service role. Pure logic (subject building, HTML rendering, rate-limit decisions) moves into `lib.ts` so it is testable with `deno test` without a database or network. `Deno.serve` stays a thin shell over those helpers. The client (`SupportPage.tsx`) does not change; it already invokes the function with the row id.

**Tech Stack:** Deno (Supabase Edge Functions), Resend HTTP API, Postgres, React + TypeScript, vitest (client tests), `deno test` (function tests).

**Spec:** `docs/superpowers/specs/2026-08-01-support-confirmation-email-design.md`

**Branch:** `feat/support-confirmation-email` (already created, spec committed at `4e99511`)

---

## File Structure

| File | Responsibility |
| --- | --- |
| `supabase/functions/support-notify/lib.ts` | **Create.** Pure, dependency-free helpers: topic labels, subject builder, HTML escaping, confirmation renderer, rate-limit decision. No I/O — this is the whole testable surface. |
| `supabase/functions/support-notify/lib_test.ts` | **Create.** `deno test` suite for `lib.ts`. Named with an underscore so vitest's `**/*.test.ts` glob does not pick it up. |
| `supabase/functions/support-notify/index.ts` | **Modify.** Imports from `lib.ts`, hashes the submitter IP, runs the rate-limit query, sends the confirmation, writes `confirmed_at`. |
| `supabase/migrations/20260801100000_support_confirmations.sql` | **Create.** Adds `confirmed_at` and `submitter_ip_hash` plus supporting indexes. |
| `public/moonlit-icon-96.png` | **Create.** 96×96 logo for the email, generated from the existing 1024×1024 PNG. |
| `src/types/index.ts` | **Modify.** Adds the two new fields to `SupportRequest`. |
| `src/routes/admin/SupportRequestsPage.tsx` | **Modify.** Adds a "No confirmation" badge and aligns the reply `mailto:` subject with the new shared subject. |

---

### Task 1: Subject builder

The subject is shared verbatim by both emails. If they ever drift apart, replies stop threading **silently** — no error, nothing in the logs. This test is the guard against that.

**Files:**
- Create: `supabase/functions/support-notify/lib.ts`
- Test: `supabase/functions/support-notify/lib_test.ts`

- [ ] **Step 1: Write the failing test**

Create `supabase/functions/support-notify/lib_test.ts`:

```ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildSubject, topicLabel } from './lib.ts';

Deno.test('topicLabel maps known topics to human labels', () => {
  assertEquals(topicLabel('billing'), 'Billing & plans');
  assertEquals(topicLabel('bug'), 'Bug report');
});

Deno.test('topicLabel falls back to the raw topic when unknown', () => {
  assertEquals(topicLabel('something-new'), 'something-new');
});

Deno.test('buildSubject produces the shared customer-facing subject', () => {
  assertEquals(buildSubject('billing'), 'Your Moonlit support request — Billing & plans');
});

Deno.test('buildSubject carries no sender name or internal tag', () => {
  const subject = buildSubject('general');
  assertEquals(subject.includes('['), false);
  assertEquals(subject, 'Your Moonlit support request — General question');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test supabase/functions/support-notify/lib_test.ts`
Expected: FAIL — `Module not found "./lib.ts"`

- [ ] **Step 3: Write minimal implementation**

Create `supabase/functions/support-notify/lib.ts`:

```ts
/**
 * Pure helpers for support-notify. No I/O and no imports, so `deno test` can
 * exercise them without a database, a network, or Supabase env vars.
 */

export const TOPIC_LABELS: Record<string, string> = {
  general: 'General question',
  account: 'Account & profiles',
  billing: 'Billing & plans',
  playback: 'Playback & devices',
  bug: 'Bug report',
};

export const topicLabel = (topic: string) => TOPIC_LABELS[topic] ?? topic;

/**
 * Used verbatim by BOTH the internal notification and the confirmation.
 * Identical subjects are what let a reply from hey@ thread into the
 * confirmation the sender is holding — clients fall back to subject matching
 * when the referenced Message-ID is one they never received.
 */
export const buildSubject = (topic: string) =>
  `Your Moonlit support request — ${topicLabel(topic)}`;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test supabase/functions/support-notify/lib_test.ts`
Expected: PASS — 4 passed

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/support-notify/lib.ts supabase/functions/support-notify/lib_test.ts
git commit -m "feat: add shared subject builder for support emails"
```

---

### Task 2: Confirmation renderer

**Files:**
- Modify: `supabase/functions/support-notify/lib.ts`
- Test: `supabase/functions/support-notify/lib_test.ts`

- [ ] **Step 1: Write the failing test**

Append to `supabase/functions/support-notify/lib_test.ts`:

```ts
import { escapeHtml, renderConfirmation } from './lib.ts';

const sample = {
  name: 'Sarah',
  topic: 'billing',
  message: 'I switched to yearly but still show monthly.',
  created_at: '2026-08-01T10:24:00.000Z',
};

Deno.test('escapeHtml neutralises markup', () => {
  assertEquals(escapeHtml('<script>&"'), '&lt;script&gt;&amp;&quot;');
});

Deno.test('renderConfirmation escapes the sender message in the HTML part', () => {
  const { html } = renderConfirmation({ ...sample, message: '<img src=x onerror=alert(1)>' });
  assertEquals(html.includes('<img src=x'), false);
  assertEquals(html.includes('&lt;img src=x'), true);
});

Deno.test('renderConfirmation includes the name, topic label and message', () => {
  const { html, text } = renderConfirmation(sample);
  assertEquals(html.includes('Sarah'), true);
  assertEquals(html.includes('Billing &amp; plans'), true);
  assertEquals(text.includes('I switched to yearly but still show monthly.'), true);
  assertEquals(text.includes('Billing & plans'), true);
});

Deno.test('renderConfirmation gives the logo alt text so image-blocked clients still read', () => {
  const { html } = renderConfirmation(sample);
  assertEquals(html.includes('alt="Moonlit"'), true);
});

Deno.test('renderConfirmation pins the colour scheme to light', () => {
  const { html } = renderConfirmation(sample);
  assertEquals(html.includes('name="color-scheme" content="light only"'), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test supabase/functions/support-notify/lib_test.ts`
Expected: FAIL — `The requested module './lib.ts' does not provide an export named 'renderConfirmation'`

- [ ] **Step 3: Write minimal implementation**

Append to `supabase/functions/support-notify/lib.ts`:

```ts
export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const LOGO_URL = 'https://trymoonlit.app/moonlit-icon-96.png';

export interface ConfirmationRequest {
  name: string;
  topic: string;
  message: string;
  created_at: string;
}

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/**
 * Email HTML, not page HTML: tables for structure, inline styles only, no web
 * fonts (Gmail and Outlook strip @font-face), and the accent bar is a table
 * cell rather than a border so Outlook's Word engine renders it.
 */
export function renderConfirmation(r: ConfirmationRequest): { html: string; text: string } {
  const topic = topicLabel(r.topic);
  const date = new Date(r.created_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });

  const text =
    `We have your message\n\n` +
    `Thanks, ${r.name}. A real person reads every one of these, and you'll get a reply ` +
    `at this address — usually within a day.\n\n` +
    `${topic}\n${r.message}\n\n` +
    `Forgot something? Just reply. We'll pretend you meant to send it all at once.\n\n` +
    `Sent because you contacted Moonlit support on ${date}.`;

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
</head>
<body style="margin:0;padding:0;background:#f4efe9">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4efe9" style="background:#f4efe9">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background:#ffffff;border-radius:12px;max-width:520px">
<tr><td style="padding:34px 32px;font-family:${FONT}">

<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 30px"><tr>
<td style="padding-right:11px"><img src="${LOGO_URL}" width="36" height="36" alt="Moonlit" style="display:block;border:0"></td>
<td style="font-size:15px;letter-spacing:.15em;text-transform:uppercase;color:#1a1310">moonlit</td>
</tr></table>

<div style="font-size:22px;line-height:1.3;color:#1a1310;margin:0 0 12px">We have your message</div>

<div style="font-size:15px;line-height:1.65;color:#5c534c;margin:0 0 26px">
Thanks, ${escapeHtml(r.name)}. A real person reads every one of these, and you'll get a reply at this address — usually within a day.
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px"><tr>
<td width="3" bgcolor="#fa824d" style="width:3px;background:#fa824d;font-size:0;line-height:0">&nbsp;</td>
<td style="padding-left:15px">
<div style="font-size:11px;letter-spacing:.11em;text-transform:uppercase;color:#d1521c;margin:0 0 7px">${escapeHtml(topic)}</div>
<div style="font-size:15px;line-height:1.65;color:#1a1310;white-space:pre-wrap">${escapeHtml(r.message)}</div>
</td>
</tr></table>

<div style="height:1px;background:#ebe3db;font-size:0;line-height:0;margin:0 0 18px">&nbsp;</div>

<div style="font-size:12px;line-height:1.7;color:#8b8078">
Forgot something? Just reply. We'll pretend you meant to send it all at once.<br>
Sent because you contacted Moonlit support on ${escapeHtml(date)}.
</div>

</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return { html, text };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test supabase/functions/support-notify/lib_test.ts`
Expected: PASS — 9 passed

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/support-notify/lib.ts supabase/functions/support-notify/lib_test.ts
git commit -m "feat: render the support confirmation email"
```

---

### Task 3: Rate-limit decision

**Files:**
- Modify: `supabase/functions/support-notify/lib.ts`
- Test: `supabase/functions/support-notify/lib_test.ts`

- [ ] **Step 1: Write the failing test**

Append to `supabase/functions/support-notify/lib_test.ts`:

```ts
import { DEFAULT_POLICY, rateLimitDecision } from './lib.ts';

Deno.test('allows a submitter under both limits', () => {
  assertEquals(rateLimitDecision({ byEmail: 0, bySubmitter: 0 }), { allowed: true });
  assertEquals(rateLimitDecision({ byEmail: 2, bySubmitter: 9 }), { allowed: true });
});

Deno.test('blocks once the per-address limit is reached', () => {
  assertEquals(rateLimitDecision({ byEmail: 3, bySubmitter: 0 }), {
    allowed: false, reason: 'email',
  });
});

Deno.test('blocks once the per-submitter limit is reached', () => {
  assertEquals(rateLimitDecision({ byEmail: 0, bySubmitter: 10 }), {
    allowed: false, reason: 'submitter',
  });
});

Deno.test('reports the address limit first when both are exceeded', () => {
  assertEquals(rateLimitDecision({ byEmail: 5, bySubmitter: 20 }), {
    allowed: false, reason: 'email',
  });
});

Deno.test('honours an overridden policy', () => {
  assertEquals(
    rateLimitDecision({ byEmail: 1, bySubmitter: 0 }, { maxPerEmail: 1, maxPerSubmitter: 10 }),
    { allowed: false, reason: 'email' },
  );
});

Deno.test('default policy is 3 per address and 10 per submitter', () => {
  assertEquals(DEFAULT_POLICY, { maxPerEmail: 3, maxPerSubmitter: 10 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test supabase/functions/support-notify/lib_test.ts`
Expected: FAIL — `does not provide an export named 'rateLimitDecision'`

- [ ] **Step 3: Write minimal implementation**

Append to `supabase/functions/support-notify/lib.ts`:

```ts
export interface RateLimitCounts {
  /** Confirmations sent to this address in the window. */
  byEmail: number;
  /** Confirmations triggered by this submitter hash in the window. */
  bySubmitter: number;
}

export interface RateLimitPolicy {
  maxPerEmail: number;
  maxPerSubmitter: number;
}

export type RateLimitVerdict =
  | { allowed: true }
  | { allowed: false; reason: 'email' | 'submitter' };

/** Window all counts are taken over. */
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/**
 * Per-address stops one inbox being bombed. Per-submitter stops one actor
 * spraying many different addresses, which a per-address limit never sees.
 */
export const DEFAULT_POLICY: RateLimitPolicy = { maxPerEmail: 3, maxPerSubmitter: 10 };

export function rateLimitDecision(
  counts: RateLimitCounts,
  policy: RateLimitPolicy = DEFAULT_POLICY,
): RateLimitVerdict {
  if (counts.byEmail >= policy.maxPerEmail) return { allowed: false, reason: 'email' };
  if (counts.bySubmitter >= policy.maxPerSubmitter) return { allowed: false, reason: 'submitter' };
  return { allowed: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test supabase/functions/support-notify/lib_test.ts`
Expected: PASS — 15 passed

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/support-notify/lib.ts supabase/functions/support-notify/lib_test.ts
git commit -m "feat: add rate-limit policy for support confirmations"
```

---

### Task 4: Database columns

**Files:**
- Create: `supabase/migrations/20260801100000_support_confirmations.sql`

`db push` is blocked by pre-existing migration-history drift, so the file is applied directly with `db query -f`. It keeps `if not exists` guards so a future working `db push` no-ops over it.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260801100000_support_confirmations.sql`:

```sql
-- Tracks the confirmation sent to the person who wrote in. Kept separate from
-- notified_at because the two sends fail independently — one column would let a
-- failed confirmation hide behind a successful team notification.
alter table public.support_requests
  add column if not exists confirmed_at timestamptz,
  add column if not exists submitter_ip_hash text;

-- Salted SHA-256 of the client IP, never the address itself: rate limiting only
-- needs to recognise a repeat submitter, which a hash answers exactly.
comment on column public.support_requests.submitter_ip_hash is
  'sha256(client ip + SUPPORT_IP_SALT). Never store the raw address.';

create index if not exists support_requests_ip_hash_idx
  on public.support_requests (submitter_ip_hash, created_at desc);

create index if not exists support_requests_email_idx
  on public.support_requests (email, created_at desc);
```

- [ ] **Step 2: Apply it to the linked database**

Run: `supabase db query --linked -f supabase/migrations/20260801100000_support_confirmations.sql`
Expected: JSON envelope with `"rows": []` and no error.

- [ ] **Step 3: Verify the columns and indexes exist**

Run:
```bash
supabase db query --linked "select column_name from information_schema.columns where table_schema='public' and table_name='support_requests' and column_name in ('confirmed_at','submitter_ip_hash') order by column_name;"
```
Expected: two rows — `confirmed_at`, `submitter_ip_hash`.

Run:
```bash
supabase db query --linked "select indexname from pg_indexes where schemaname='public' and indexname in ('support_requests_ip_hash_idx','support_requests_email_idx') order by indexname;"
```
Expected: two rows — `support_requests_email_idx`, `support_requests_ip_hash_idx`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260801100000_support_confirmations.sql
git commit -m "feat: add confirmed_at and submitter_ip_hash to support_requests"
```

---

### Task 5: Logo asset

**Files:**
- Create: `public/moonlit-icon-96.png`

- [ ] **Step 1: Generate the 96px icon**

Run:
```bash
sips -Z 96 public/moonlit-icon.png --out public/moonlit-icon-96.png
```
Expected: `/Users/zain/projects/Moonlit/moonlit-portal/public/moonlit-icon-96.png`

- [ ] **Step 2: Verify size and dimensions**

Run: `sips -g pixelWidth -g pixelHeight public/moonlit-icon-96.png && ls -lh public/moonlit-icon-96.png`
Expected: `pixelWidth: 96`, `pixelHeight: 96`, and a file well under 50 KB (the 1024px source is 1.28 MB).

- [ ] **Step 3: Commit**

```bash
git add public/moonlit-icon-96.png
git commit -m "feat: add 96px Moonlit icon for transactional email"
```

---

### Task 6: Wire the confirmation into the function

**Files:**
- Modify: `supabase/functions/support-notify/index.ts`

- [ ] **Step 1: Replace the file**

Replace the entire contents of `supabase/functions/support-notify/index.ts` with:

```ts
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
```

- [ ] **Step 2: Type-check the function**

Run: `deno check supabase/functions/support-notify/index.ts`
Expected: no errors (network access is needed on first run to fetch the esm.sh types).

- [ ] **Step 3: Re-run the unit tests**

Run: `deno test supabase/functions/support-notify/lib_test.ts`
Expected: PASS — 15 passed. `lib.ts` is unchanged by this task; this confirms the import surface still matches.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/support-notify/index.ts
git commit -m "feat: send a confirmation email to the support request sender"
```

---

### Task 7: Types and admin inbox

**Files:**
- Modify: `src/types/index.ts:100-112`
- Modify: `src/routes/admin/SupportRequestsPage.tsx:122-130`, `src/routes/admin/SupportRequestsPage.tsx:143`

- [ ] **Step 1: Extend the type**

In `src/types/index.ts`, replace:

```ts
  /** Set once the request has been emailed to the team inbox. */
  notified_at: string | null;
}
```

with:

```ts
  /** Set once the request has been emailed to the team inbox. */
  notified_at: string | null;
  /** Set once the sender has been sent their confirmation copy. */
  confirmed_at: string | null;
  /** Salted hash of the submitter's IP, used only for rate limiting. */
  submitter_ip_hash: string | null;
}
```

- [ ] **Step 2: Add the badge**

In `src/routes/admin/SupportRequestsPage.tsx`, immediately after the closing `)}` of the `{!r.notified_at && (…)}` block (line 130), insert:

```tsx
                    {r.notified_at && !r.confirmed_at && (
                      <span
                        title="Reached the team, but the sender never got their confirmation copy — rate limited, or check the support-notify logs."
                        className="inline-flex items-center gap-1.5 rounded-full border border-border-strong px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-faint"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-faint" />
                        No confirmation
                      </span>
                    )}
```

The `r.notified_at &&` guard matters: a row that reached nobody already shows the amber badge, and stacking a second badge on it would just be noise.

- [ ] **Step 3: Align the reply subject so admin replies thread too**

In `src/routes/admin/SupportRequestsPage.tsx` line 143, replace:

```tsx
                  href={`mailto:${r.email}?subject=${encodeURIComponent('Re: your Moonlit support request')}`}
```

with:

```tsx
                  href={`mailto:${r.email}?subject=${encodeURIComponent(`Re: Your Moonlit support request — ${TOPIC_LABELS[r.topic] ?? r.topic}`)}`}
```

Without this, the one reply path that goes *through the portal* uses a subject that matches neither email, and threads nowhere.

- [ ] **Step 4: Type-check and run the client tests**

Run: `npm run build`
Expected: `tsc` completes with no errors.

Run: `npm test`
Expected: all suites pass, including the existing `SupportPage.test.tsx` (the client is unchanged by this plan).

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/routes/admin/SupportRequestsPage.tsx
git commit -m "feat: flag unconfirmed requests in the admin inbox"
```

---

### Task 8: Deploy and verify end to end

**Files:** none — deployment only.

- [ ] **Step 1: Set the new secrets**

`SUPPORT_IP_SALT` must be a random string. Generate and set it:

```bash
supabase secrets set SUPPORT_IP_SALT="$(openssl rand -hex 32)"
supabase secrets set SUPPORT_CONFIRM_FROM="Moonlit <hey@trymoonlit.app>"
```

Expected: `Finished supabase secrets set.` for each.

- [ ] **Step 2: Deploy the portal so the logo URL resolves**

The email references `https://trymoonlit.app/moonlit-icon-96.png`. Deploy the site by whatever route publishes `public/`, then confirm:

```bash
curl -s -o /dev/null -w "%{http_code} %{size_download}\n" https://trymoonlit.app/moonlit-icon-96.png
```
Expected: `200` and a non-zero byte count. **Do not proceed until this returns 200** — otherwise every confirmation ships a broken image.

- [ ] **Step 3: Deploy the function**

Run: `supabase functions deploy support-notify --no-verify-jwt --project-ref hvfsntdyowapjxobtyli`
Expected: `Deployed Functions on project hvfsntdyowapjxobtyli: support-notify`

- [ ] **Step 4: Smoke-test that it is live and public**

Run:
```bash
curl -s -w "\nHTTP %{http_code}\n" -X POST https://hvfsntdyowapjxobtyli.supabase.co/functions/v1/support-notify -H 'Content-Type: application/json' -d '{}'
```
Expected: `{"error":"A support request id is required"}` and `HTTP 400`. A `401` means `--no-verify-jwt` did not take; a `500` about `RESEND_API_KEY` means the secret is missing.

- [ ] **Step 5: Real end-to-end test**

Submit a message from `/contact` using an address you can read that is **not** `hey@trymoonlit.app`. Then confirm both sides:

```bash
supabase db query --linked "select id, email, notified_at, confirmed_at, (submitter_ip_hash is not null) as has_hash from public.support_requests order by created_at desc limit 1;"
```
Expected: `notified_at` and `confirmed_at` both set, `has_hash` true.

Check that `hey@trymoonlit.app` received the internal copy and the test address received the confirmation, and that the confirmation renders with the logo.

- [ ] **Step 6: Verify threading**

Reply to the internal notification from `hey@trymoonlit.app`. In the test address's inbox, the reply must land **inside** the confirmation thread, not as a separate message.

If it lands separately, the cause is almost always that `hey@trymoonlit.app` is a forwarding alias rather than a sending mailbox, so the reply went out from a different address. That is the open item flagged in the spec.

- [ ] **Step 7: Verify the raw IP is not stored**

```bash
supabase db query --linked "select submitter_ip_hash from public.support_requests where submitter_ip_hash is not null limit 1;"
```
Expected: a 64-character hex digest. Anything resembling a dotted quad or a colon-separated IPv6 address is a bug — stop and fix before going further.

- [ ] **Step 8: Merge**

```bash
git checkout main && git merge --no-ff feat/support-confirmation-email
```

---

## Notes for the implementer

- **Do not modify `src/routes/public/SupportPage.tsx`.** It already inserts the row and invokes the function; the whole change lives behind that call.
- **Three files in the working tree** (`CuratorSpotlight.tsx`, `CuratorSpotlight.test.tsx`, `Navbar.tsx`) have unrelated uncommitted changes belonging to someone else. Never `git add -A`; stage the exact paths listed in each commit step.
- **`lib_test.ts` is named with an underscore on purpose** so vitest's `**/*.test.ts` glob ignores it. Renaming it to `lib.test.ts` will make `npm test` try to run Deno code and fail.
