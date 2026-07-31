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
