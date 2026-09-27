import { describe, expect, it } from 'vitest';
import { cloudState, type CloudAccount } from './cloudAccess';

const NOW = Date.parse('2026-09-27T12:00:00Z');
const FUTURE = '2026-10-27T00:00:00Z';
const PAST = '2026-09-20T00:00:00Z';
const acct = (over: Partial<CloudAccount>): CloudAccount => ({
  role: 'free', role_expires_at: null, server_access: false, server_access_expires_at: null,
  server_access_source: null, server_access_ended_at: null, ...over,
});

describe('cloudState', () => {
  it('offers Connect to an active Spotlight account that is not connected', () => {
    expect(cloudState(acct({ role: 'spotlight', role_expires_at: FUTURE }), NOW)).toEqual({ kind: 'ready', renewsAt: FUTURE });
  });

  it('shows connected when access came from the subscription', () => {
    const s = cloudState(acct({ role: 'spotlight', role_expires_at: FUTURE, server_access: true, server_access_source: 'subscription', server_access_expires_at: FUTURE }), NOW);
    expect(s).toEqual({ kind: 'connected', renewsAt: FUTURE });
  });

  it('never offers Connect to Studio', () => {
    expect(cloudState(acct({ role: 'studio', role_expires_at: FUTURE }), NOW).kind).toBe('studio');
  });

  it('does not offer Connect once the Spotlight plan has expired', () => {
    expect(cloudState(acct({ role: 'spotlight', role_expires_at: PAST }), NOW).kind).toBe('other');
  });

  it('explains a disconnection that happened when the plan ended', () => {
    expect(cloudState(acct({ role: 'free', server_access_ended_at: PAST }), NOW)).toEqual({ kind: 'ended', endedAt: PAST });
  });

  it('prefers a live grant over any plan message, including for Studio', () => {
    const s = cloudState(acct({ role: 'studio', server_access: true, server_access_source: 'manual' }), NOW);
    expect(s).toEqual({ kind: 'granted', until: null });
  });

  it('ignores a grant that has already run out', () => {
    const s = cloudState(acct({ role: 'free', server_access: true, server_access_source: 'manual', server_access_expires_at: PAST }), NOW);
    expect(s.kind).toBe('other');
  });

  it('treats admins as always on', () => {
    expect(cloudState(acct({ role: 'admin' }), NOW).kind).toBe('granted');
  });

  it('shows the plan message when there is no account row', () => {
    expect(cloudState(null, NOW).kind).toBe('other');
  });
});
