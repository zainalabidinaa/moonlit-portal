import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { AppleIcon, GlobeIcon, PhoneIcon, WindowsIcon } from '../landing/PlatformIcons';
import { currentSessionId, describeDevice, loadMySessions, maskIp, signOutOtherDevices, type DevicePlatform, type MySession } from '../../lib/mySessions';
import { formatRelativeTime } from '../../lib/userActivity';

const FIVE_MIN = 5 * 60_000;

function PlatformIcon({ platform, kind }: { platform: DevicePlatform; kind: string }) {
  const cls = 'h-[18px] w-[18px]';
  if (kind === 'app' || platform === 'mac' || platform === 'apple') return <AppleIcon className={cls} />;
  if (platform === 'ios' || platform === 'android') return <PhoneIcon className={cls} />;
  if (platform === 'windows') return <WindowsIcon className={cls} />;
  return <GlobeIcon className={cls} />;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * "Connected devices" and "Sign-in activity" for the signed-in account,
 * from its own auth sessions (the `my_sessions` database function). Until
 * that function is installed it shows this browser only.
 */
export function AccountActivity() {
  const { session } = useAuth();
  const [sessions, setSessions] = useState<MySession[] | null>(null);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [notice, setNotice] = useState('');
  const currentId = currentSessionId(session?.access_token);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await loadMySessions(20);
      if (rows === null) { setAvailable(false); setSessions([]); }
      else { setAvailable(true); setSessions(rows); }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const now = Date.now();
  const devices = useMemo(() => {
    const list = (sessions ?? []).map((s) => ({ s, info: describeDevice(s.user_agent) }));
    // This browser first, then most recently active.
    return list.sort((a, b) => (a.s.id === currentId ? -1 : b.s.id === currentId ? 1 : 0));
  }, [sessions, currentId]);
  const signIns = useMemo(
    () => [...(sessions ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8),
    [sessions]
  );
  const others = devices.filter((d) => d.s.id !== currentId).length;

  async function handleSignOutOthers() {
    setSigningOut(true);
    setError('');
    try {
      await signOutOtherDevices();
      setNotice('Signed out everywhere else. Other devices will ask to sign in again.');
      setConfirming(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSigningOut(false);
    }
  }

  const thisBrowser = describeDevice(typeof navigator !== 'undefined' ? navigator.userAgent : null);

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
      <section className="rounded-2xl border border-border bg-surface p-6" aria-labelledby="devices-h">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="devices-h" className="text-lg font-semibold">Connected devices</h2>
          {available && !loading && <span className="text-xs text-faint">{devices.length} signed in</span>}
        </div>
        <p className="mt-1 text-sm text-muted">Everywhere this account is signed in. Every profile is available on each of them.</p>

        <ul className="mt-3">
          {loading && <li className="py-4 text-sm text-faint">Loading devices…</li>}
          {!loading && !available && (
            <li className="grid grid-cols-[34px_1fr_auto] items-center gap-3 border-b border-border py-3.5 last:border-0">
              <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-surface-2 text-text"><PlatformIcon platform={thisBrowser.platform} kind={thisBrowser.kind} /></span>
              <span className="min-w-0"><b className="block truncate text-sm font-semibold">{thisBrowser.name}</b><small className="text-xs text-muted">Active now</small></span>
              <span className="rounded-full border border-accent/40 bg-accent-light px-2 py-0.5 text-[11px] font-semibold text-accent">This browser</span>
            </li>
          )}
          {!loading && available && devices.map(({ s, info }) => {
            const last = s.updated_at ?? s.created_at;
            const online = now - new Date(last).getTime() < FIVE_MIN;
            const isCurrent = s.id === currentId;
            return (
              <li key={s.id} className="grid grid-cols-[34px_1fr_auto] items-center gap-3 border-b border-border py-3.5 last:border-0">
                <span className="relative grid h-[34px] w-[34px] place-items-center rounded-full bg-surface-2 text-text">
                  <PlatformIcon platform={info.platform} kind={info.kind} />
                  {(online || isCurrent) && <i className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-cyan" />}
                </span>
                <span className="min-w-0">
                  <b className="block truncate text-sm font-semibold">{info.name}{info.detail && <span className="ml-1.5 font-normal text-faint">{info.detail}</span>}</b>
                  <small className="block truncate text-xs text-muted">
                    {isCurrent || online ? 'Active now' : `Last active ${formatRelativeTime(last).toLowerCase()}`} · Signed in {new Date(s.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </small>
                </span>
                {isCurrent
                  ? <span className="rounded-full border border-accent/40 bg-accent-light px-2 py-0.5 text-[11px] font-semibold text-accent">This browser</span>
                  : <span className="font-mono text-[11px] text-faint">{maskIp(s.ip)}</span>}
              </li>
            );
          })}
          {!loading && available && devices.length === 0 && <li className="py-4 text-sm text-faint">No other sessions.</li>}
        </ul>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        {notice && <p className="mt-3 text-sm text-cyan">{notice}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          {confirming ? (
            <>
              <span className="text-sm text-muted">Sign out every other device?</span>
              <Button size="sm" loading={signingOut} onClick={handleSignOutOthers}>Sign them out</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" disabled={available && !loading && others === 0} onClick={() => { setNotice(''); setConfirming(true); }}>
              Sign out of other devices
            </Button>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-6" aria-labelledby="signins-h">
        <h2 id="signins-h" className="text-lg font-semibold">Sign-in activity</h2>
        <p className="mt-1 text-sm text-muted">Recent sign-ins to this account. Don’t recognise one? Sign out other devices and change your password in Billing.</p>
        {available ? (
          <ol className="relative mt-4 grid gap-4 border-l border-border pl-5">
            {loading && <li className="text-sm text-faint">Loading…</li>}
            {!loading && signIns.map((s) => {
              const info = describeDevice(s.user_agent);
              return (
                <li key={s.id} className="relative">
                  <i className={`absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface ${s.id === currentId ? 'bg-accent' : 'bg-border-strong'}`} />
                  <b className="block text-sm font-semibold">{info.name}</b>
                  <small className="block text-xs text-muted">
                    {fmtDate(s.created_at)}{s.ip ? ` · IP ${maskIp(s.ip)}` : ''}{s.id === currentId ? ' · this browser' : ''}
                  </small>
                </li>
              );
            })}
            {!loading && signIns.length === 0 && <li className="text-sm text-faint">No sign-ins yet.</li>}
          </ol>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-5 text-sm text-faint">Sign-in history will appear here.</p>
        )}
      </section>
    </div>
  );
}
