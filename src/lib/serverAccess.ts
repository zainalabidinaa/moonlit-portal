export type ServerAccessSource = 'manual' | 'subscription' | 'store';

export type ServerAccessKind = 'manual' | 'subscription' | 'store' | 'expired' | 'none';

export interface ServerAccessFields {
  role?: string;
  server_access: boolean;
  server_access_expires_at: string | null;
  server_access_source: ServerAccessSource | null;
}

export interface ServerAccessState {
  kind: ServerAccessKind;
  label: string;
  detail: string | null;
}

const LABEL: Record<ServerAccessKind, string> = {
  manual: 'Granted by you',
  subscription: 'Via subscription',
  store: 'Bought on store',
  expired: 'Expired',
  none: 'No access',
};

export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Mirrors the bridge: admins always have access; otherwise the grant must be
 *  on and either open-ended or not yet past its end date. */
export function serverAccessState(u: ServerAccessFields, now: number = Date.now()): ServerAccessState {
  if (u.role === 'admin') return { kind: 'manual', label: 'Admin', detail: 'Always has access' };
  const expiry = u.server_access_expires_at ? Date.parse(u.server_access_expires_at) : null;
  if (u.server_access && expiry !== null && expiry <= now) {
    return { kind: 'expired', label: LABEL.expired, detail: `Ended ${formatDay(u.server_access_expires_at!)}` };
  }
  if (!u.server_access) return { kind: 'none', label: LABEL.none, detail: null };
  const kind: ServerAccessKind = u.server_access_source ?? 'manual';
  const detail = expiry === null ? 'No end date' : `Until ${formatDay(u.server_access_expires_at!)}`;
  return { kind, label: LABEL[kind], detail };
}

export type ServerAccessFilter = 'all' | 'active' | 'manual' | 'subscription' | 'store' | 'expired' | 'none';

export function matchesServerFilter(state: ServerAccessState, filter: ServerAccessFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'active') return state.kind === 'manual' || state.kind === 'subscription' || state.kind === 'store';
  return state.kind === filter;
}

export const GRANT_PRESETS: { value: string; label: string; days: number | null }[] = [
  { value: '7d', label: '7 days', days: 7 },
  { value: '30d', label: '30 days', days: 30 },
  { value: '90d', label: '90 days', days: 90 },
  { value: '365d', label: '1 year', days: 365 },
  { value: 'never', label: 'No end date', days: null },
];

export function grantExpiry(preset: string, now: number = Date.now()): string | null {
  const p = GRANT_PRESETS.find((g) => g.value === preset);
  if (!p) throw new Error(`Unknown preset ${preset}`);
  return p.days === null ? null : new Date(now + p.days * 86_400_000).toISOString();
}
