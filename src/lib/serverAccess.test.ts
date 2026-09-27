import { describe, expect, it } from 'vitest';
import { grantExpiry, matchesServerFilter, serverAccessState } from './serverAccess';

const NOW = Date.parse('2026-09-27T12:00:00Z');
const base = { server_access: false, server_access_expires_at: null, server_access_source: null } as const;

describe('serverAccessState', () => {
  it('treats admins as always having access', () => {
    expect(serverAccessState({ ...base, role: 'admin' }, NOW).label).toBe('Admin');
  });

  it('reports no access when the grant is off', () => {
    expect(serverAccessState({ ...base }, NOW).kind).toBe('none');
  });

  it('shows the source and the end date of an active grant', () => {
    const s = serverAccessState({ server_access: true, server_access_expires_at: '2026-10-27T00:00:00Z', server_access_source: 'store' }, NOW);
    expect(s.kind).toBe('store');
    expect(s.label).toBe('Bought on store');
    expect(s.detail).toMatch(/^Until /);
  });

  it('treats an open-ended grant as active with no end date', () => {
    const s = serverAccessState({ server_access: true, server_access_expires_at: null, server_access_source: 'manual' }, NOW);
    expect(s).toEqual({ kind: 'manual', label: 'Granted by you', detail: 'No end date' });
  });

  it('marks a grant past its end date as expired, like the bridge does', () => {
    const s = serverAccessState({ server_access: true, server_access_expires_at: '2026-09-20T00:00:00Z', server_access_source: 'manual' }, NOW);
    expect(s.kind).toBe('expired');
  });

  it('defaults an unlabelled grant to manual', () => {
    expect(serverAccessState({ server_access: true, server_access_expires_at: null, server_access_source: null }, NOW).kind).toBe('manual');
  });
});

describe('matchesServerFilter', () => {
  const active = serverAccessState({ server_access: true, server_access_expires_at: null, server_access_source: 'subscription' }, NOW);
  const none = serverAccessState({ ...base }, NOW);
  it('groups every live source under active', () => {
    expect(matchesServerFilter(active, 'active')).toBe(true);
    expect(matchesServerFilter(none, 'active')).toBe(false);
  });
  it('matches a single kind exactly', () => {
    expect(matchesServerFilter(active, 'subscription')).toBe(true);
    expect(matchesServerFilter(active, 'manual')).toBe(false);
  });
});

describe('grantExpiry', () => {
  it('adds the preset days, or returns null for no end date', () => {
    expect(grantExpiry('30d', NOW)).toBe(new Date(NOW + 30 * 86_400_000).toISOString());
    expect(grantExpiry('never', NOW)).toBeNull();
  });
  it('rejects an unknown preset', () => {
    expect(() => grantExpiry('2w', NOW)).toThrow();
  });
});
