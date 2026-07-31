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
