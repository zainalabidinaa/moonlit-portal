# Support confirmation email — design

Date: 2026-08-01
Status: approved, not yet implemented

## Problem

`support-notify` emails each contact-form submission to `hey@trymoonlit.app`. The
person who wrote in receives nothing. Two consequences:

1. They have no evidence the message arrived beyond a green banner on a page they
   are about to close.
2. When support replies, the reply lands as an orphan. The reply carries the
   internal notification's `In-Reply-To`, which references a message the sender has
   never held, so it does not thread. They see a bare `Re: [Moonlit General
   question] <their own name>` — an internal routing subject — and underneath it
   their mail client quotes the internal email, including `Signed in: no` and
   `Request id: …`.

## Goals

- Send the sender a confirmation containing a copy of their message.
- Make a human reply from `hey@trymoonlit.app` thread correctly on their side.
- Do not turn a public, unauthenticated form into a mail relay.

## Non-goals

- A reply composer in `/admin/support`. Sending replies through Resend from the
  portal would give full control of headers and stop internal metadata being
  quoted, but it needs sent-message storage and threading state. Tracked as a
  follow-up, not part of this work.
- Fixing the `db push` migration-history drift. Unrelated and pre-existing.

## Design

### One function, two sends

`support-notify` already loads the row by id under the service role. It gains a
second Resend call rather than a new function: no new deploy target, no second
network call from the browser, and one place where send state is written.

`SupportPage.tsx` does not change. It already inserts the row and invokes
`support-notify` with the id.

Ordering is significant. The confirmation is attempted **only after** the team
notification succeeds. The worst available failure is a sender being told "we have
your message" when nobody was told about it, so the reassuring, rate-limited,
visitor-facing send sits behind the reliable fixed-address one.

### Headers

|            | Internal notification            | Confirmation                     |
| ---------- | -------------------------------- | -------------------------------- |
| `to`       | `SUPPORT_TO`                     | the sender's address             |
| `from`     | `SUPPORT_FROM` (`noreply@`)      | `SUPPORT_CONFIRM_FROM` (`hey@`)  |
| `reply_to` | the sender's address             | `SUPPORT_TO`                     |
| `subject`  | `Your Moonlit support request — {Topic}` | *identical*              |

Both addresses are on the verified `trymoonlit.app` domain, so Resend accepts
either as `from`.

The confirmation sends `from` the same mailbox support replies from. Matching the
`From` identity and the subject is what lets the recipient's client group the
later reply into the same conversation: when the referenced `Message-ID` is absent,
Gmail and Apple Mail fall back to subject-plus-participant matching. This is
client behaviour, not a guarantee in any RFC, but it is what every consumer client
does in practice.

Cost: the internal subject loses its `[Moonlit …] <name>` prefix. `From` and
`Reply-To` still identify the sender in the inbox list, and `/admin/support` is the
triage surface.

### Confirmation content

Light theme. Web fonts are stripped by Gmail and Outlook, so the email uses a
system stack and carries the brand through colour, spacing, and the mark.

Palette:

| Role            | Value     |
| --------------- | --------- |
| Page background | `#f4efe9` |
| Card            | `#ffffff` |
| Primary text    | `#1a1310` |
| Secondary text  | `#5c534c` |
| Footer text     | `#8b8078` |
| Accent bar      | `#fa824d` |
| Accent text     | `#d1521c` |
| Rule            | `#ebe3db` |

Structure: logo and wordmark, headline, body, the sender's message beside a
3px `#fa824d` left border, rule, footer.

Copy (dry register; the wit sits in the closing line, after the reassurance has
landed, so it does not greet someone whose billing is broken):

> **We have your message**
>
> Thanks, {name}. A real person reads every one of these, and you'll get a reply at
> this address — usually within a day.
>
> [{Topic}]
> {their message}
>
> Forgot something? Just reply. We'll pretend you meant to send it all at once.
>
> Sent because you contacted Moonlit support on {date}.

Layout must survive Outlook's Word rendering engine: tables for structure, inline
styles only, no flexbox or grid. The accent bar is a `border-left`, not a column.

### Logo asset

`public/moonlit-icon.png` is 1.28 MB at 1024×1024 — unacceptable in an email that
renders it at 36px. `moonlit-icon.svg` is unusable because Gmail strips inline SVG.

Generate `public/moonlit-icon-96.png` at 96×96 with `sips`, served from
`https://trymoonlit.app/moonlit-icon-96.png`. Images can be blocked by default, so
`alt="Moonlit"` is required and the email must read correctly without it.

### Data model

Two nullable columns on `public.support_requests`:

- `confirmed_at timestamptz` — when the confirmation was sent. Deliberately
  separate from `notified_at`: the two sends fail independently, and one column
  would let a failed confirmation hide behind a successful team notification.
- `submitter_ip_hash text` — see below.

Supporting indexes for the rate-limit queries:

```sql
create index if not exists support_requests_ip_hash_idx
  on public.support_requests (submitter_ip_hash, created_at desc);
create index if not exists support_requests_email_idx
  on public.support_requests (lower(email), created_at desc);
```

No RLS changes. The service role bypasses RLS, and the existing
`support_requests_select_own` policy exposes only a sender's own row.

Applied with `supabase db query --linked`, not `db push`, which is blocked by
pre-existing migration-history drift. The migration file is still committed with
`if not exists` guards so a future working `db push` no-ops over it.

### Abuse guard

The confirmation goes to an address typed by an anonymous visitor
(`support_requests_insert_any` allows `anon` inserts `with check (true)`). Without
a guard, anyone can make a verified Moonlit domain send mail to any address, and
the cost lands on the domain's sending reputation.

The team notification is never rate limited — it goes to a fixed address under
Moonlit's control and has no abuse surface. Only the confirmation is gated.

Two limits, both counting rows with `confirmed_at is not null` in the last hour:

- **Per email address:** 3/hour. Stops one address being bombed.
- **Per submitter:** 10/hour. Stops one actor spraying many different addresses,
  which per-email limits do not catch.

The per-submitter signal is the client IP from `x-forwarded-for` on the function
invocation. The browser calls the function directly, so this is the visitor's
address.

**It is stored as `sha256(ip + SUPPORT_IP_SALT)`, never in the clear.** Rate
limiting only ever asks "have I seen this submitter this hour", which a hash
answers exactly, so retaining an identifier for every visitor who contacts support
buys nothing. The salt lives in Supabase secrets.

Being throttled is not an error. The row is saved, the team is notified, and
`confirmed_at` stays null.

### New secrets

| Secret                 | Default                       |
| ---------------------- | ----------------------------- |
| `SUPPORT_CONFIRM_FROM` | `Moonlit <hey@trymoonlit.app>` |
| `SUPPORT_IP_SALT`      | none — required               |

If `SUPPORT_IP_SALT` is unset the function skips the confirmation and logs, rather
than hashing with an empty salt or sending unguarded.

### Admin inbox

`/admin/support` already flags rows where `notified_at` is null with an amber "Not
emailed" badge. It gains a quieter neutral "No confirmation" badge for rows where
`confirmed_at` is null — a lower-severity state, since the message did reach the
team. `SupportRequest` in `src/types/index.ts` gains both fields.

### Testing

`SupportPage.test.tsx` needs no changes; the client is untouched.

The edge function currently has no tests, and its logic is now worth testing. Pure
helpers move into `supabase/functions/support-notify/lib.ts`:

- `buildSubject(topic)` — shared by both emails, so a drift between them silently
  breaks threading. Highest-value test in this change.
- `renderConfirmation(request)` — asserts the message body is HTML-escaped and the
  sender's name appears.
- `rateLimitDecision(counts, policy)` — a pure function over already-fetched
  counts, so the policy is testable without a database.

Run with `deno test`. `Deno.serve` stays a thin shell over these.

## Deployment

1. `supabase db query --linked` — add the two columns and two indexes.
2. `sips` the 96px icon, deploy the portal so it is reachable.
3. `supabase secrets set SUPPORT_IP_SALT=…` (and `SUPPORT_CONFIRM_FROM` to
   override the default).
4. `supabase functions deploy support-notify --no-verify-jwt`.
5. Submit a real test from `/contact`; confirm both emails arrive and that a reply
   threads on the sender's side.

## Open items

- `hey@trymoonlit.app` must be a mailbox that can *send*, not only an alias
  forwarding into a personal inbox. If it forwards, replies will go out from the
  personal address and the threading benefit is lost. Verify before step 5.
- The rate-limit numbers above are starting values, tunable in one place
  (`rateLimitDecision`) once real traffic exists.
