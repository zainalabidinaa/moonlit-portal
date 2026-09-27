export interface CloudAccount {
  role: string | null;
  role_expires_at: string | null;
  server_access: boolean;
  server_access_expires_at: string | null;
  server_access_source: 'manual' | 'subscription' | 'store' | null;
  server_access_ended_at: string | null;
}

export type CloudState =
  | { kind: 'ready'; renewsAt: string | null }
  | { kind: 'connected'; renewsAt: string | null }
  | { kind: 'granted'; until: string | null }
  | { kind: 'studio' }
  | { kind: 'ended'; endedAt: string }
  | { kind: 'other' };

function live(expiry: string | null, now: number): boolean {
  return expiry === null || Date.parse(expiry) > now;
}

/** What the Cloud page shows a signed-in account. Cloud is Spotlight-only and
 *  never on until the account presses Connect; grants from an admin (or a
 *  purchase) show as on without offering Connect/Disconnect. */
export function cloudState(a: CloudAccount | null, now: number = Date.now()): CloudState {
  if (!a) return { kind: 'other' };
  if (a.role === 'admin') return { kind: 'granted', until: null };
  const access = a.server_access && live(a.server_access_expires_at, now);
  if (access && a.server_access_source === 'subscription') {
    return { kind: 'connected', renewsAt: a.server_access_expires_at };
  }
  if (access) return { kind: 'granted', until: a.server_access_expires_at };
  const spotlight = a.role === 'spotlight' && live(a.role_expires_at, now);
  if (spotlight) return { kind: 'ready', renewsAt: a.role_expires_at };
  if (a.role === 'studio') return { kind: 'studio' };
  if (a.server_access_ended_at) return { kind: 'ended', endedAt: a.server_access_ended_at };
  return { kind: 'other' };
}

export function cloudDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
