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
