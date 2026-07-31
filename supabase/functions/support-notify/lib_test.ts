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
