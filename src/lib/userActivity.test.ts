import { describe, it, expect } from 'vitest';
import { parseUserAgent, lastActiveStatus, formatRelativeTime } from './userActivity';

describe('parseUserAgent', () => {
  it('labels the native app regardless of iOS vs macOS', () => {
    expect(parseUserAgent('Moonlit/22 CFNetwork/3826.600.41.2.1 Darwin/24.6.0')).toBe('Moonlit app');
  });

  it('labels an iPhone browser', () => {
    expect(parseUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15')).toBe('Safari (iOS)');
  });

  it('labels a Mac browser', () => {
    expect(parseUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36')).toBe('Browser (Mac)');
  });

  it('falls back to a truncated raw string for anything unrecognized', () => {
    const result = parseUserAgent('SomeExoticClient/1.0 with a very long identifying string attached');
    expect(result.endsWith('…')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(41);
  });

  it('handles null', () => {
    expect(parseUserAgent(null)).toBe('Unknown device');
  });
});

describe('lastActiveStatus', () => {
  const now = new Date('2026-09-03T12:00:00Z');

  it('is "never" when there is no timestamp', () => {
    expect(lastActiveStatus(null, now)).toBe('never');
  });

  it('is "online" within the last 5 minutes', () => {
    expect(lastActiveStatus('2026-09-03T11:58:00Z', now)).toBe('online');
  });

  it('is "recent" within the last 24 hours but past 5 minutes', () => {
    expect(lastActiveStatus('2026-09-03T06:00:00Z', now)).toBe('recent');
  });

  it('is "stale" beyond 24 hours', () => {
    expect(lastActiveStatus('2026-08-01T06:00:00Z', now)).toBe('stale');
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2026-09-03T12:00:00Z');

  it('says "Just now" under a minute', () => {
    expect(formatRelativeTime('2026-09-03T11:59:40Z', now)).toBe('Just now');
  });

  it('formats minutes', () => {
    expect(formatRelativeTime('2026-09-03T11:55:00Z', now)).toBe('5 minutes ago');
  });

  it('formats a singular hour correctly', () => {
    expect(formatRelativeTime('2026-09-03T11:00:00Z', now)).toBe('1 hour ago');
  });

  it('formats hours', () => {
    expect(formatRelativeTime('2026-09-03T09:00:00Z', now)).toBe('3 hours ago');
  });

  it('formats days', () => {
    expect(formatRelativeTime('2026-09-01T12:00:00Z', now)).toBe('2 days ago');
  });

  it('falls back to a date beyond 30 days', () => {
    const result = formatRelativeTime('2026-01-01T12:00:00Z', now);
    expect(result).toBe(new Date('2026-01-01T12:00:00Z').toLocaleDateString());
  });
});
