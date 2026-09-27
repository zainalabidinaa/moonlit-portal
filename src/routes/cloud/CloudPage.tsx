import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { cloudDate, cloudState, type CloudAccount, type CloudState } from '../../lib/cloudAccess';
import { completeEmailLink } from '../../lib/emailLink';

const CONNECT_ERRORS: Record<string, string> = {
  not_spotlight: 'Moonlit Cloud is included with an active Spotlight plan.',
  no_account: "We couldn't find your Moonlit account. Try signing out and in again.",
};

function Dot({ tone }: { tone: 'muted' | 'accent' | 'green' | 'red' }) {
  const cls = { muted: 'bg-faint', accent: 'bg-accent', green: 'bg-green-400', red: 'bg-red-400' }[tone];
  return <span className={`h-2 w-2 flex-none rounded-full ${cls}`} />;
}

function StatusLine({ tone, children }: { tone: 'muted' | 'accent' | 'green' | 'red'; children: React.ReactNode }) {
  const text = { muted: 'text-muted', accent: 'text-accent', green: 'text-green-400', red: 'text-red-400' }[tone];
  return (
    <div className={`flex items-center gap-2.5 text-[13px] font-semibold ${text}`}>
      <Dot tone={tone} />
      {children}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[20px] border border-border bg-surface p-6 sm:p-7">{children}</div>;
}

const primaryBtn = 'inline-flex h-11 items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-[#1a0b00] transition-opacity hover:opacity-90 disabled:opacity-50';
const secondaryBtn = 'inline-flex h-11 items-center justify-center rounded-full bg-white/10 px-6 text-sm font-semibold text-text transition-colors hover:bg-white/15 disabled:opacity-50';

function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [linkSent, setLinkSent] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (err) setError(err.message);
  }

  async function emailLink() {
    if (!email) { setError('Enter your email first.'); return; }
    setError('');
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin, shouldCreateUser: false },
    });
    setBusy(false);
    if (err) setError(err.message);
    else setLinkSent(true);
  }

  const input = 'h-11 w-full rounded-xl border border-border bg-bg px-4 text-sm text-text outline-none focus:border-accent';
  return (
    <Card>
      <StatusLine tone="muted">Sign in to connect</StatusLine>
      <h3 className="mt-3 font-display text-2xl font-bold tracking-tight text-text">Have Spotlight?</h3>
      <p className="mt-1.5 text-muted">Moonlit Cloud is included with your Spotlight plan. Sign in with your Moonlit account to connect it.</p>
      {linkSent ? (
        <p className="mt-5 rounded-xl bg-green-500/10 p-4 text-sm text-green-400">Check your email: we sent you a sign-in link.</p>
      ) : (
        <form onSubmit={signIn} className="mt-5 flex flex-col gap-3">
          <input className={input} type="email" placeholder="Email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className={input} type="password" placeholder="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="mt-1 flex flex-wrap gap-2.5">
            <button className={primaryBtn} type="submit" disabled={busy || !password}>Sign in</button>
            <button className={secondaryBtn} type="button" onClick={emailLink} disabled={busy}>Email me a link</button>
          </div>
          <p className="text-xs text-faint">Signed up with Apple in the app? Use "Email me a link".</p>
        </form>
      )}
    </Card>
  );
}

function StatusCard({ state, busy, error, onConnect, onDisconnect }: {
  state: CloudState;
  busy: boolean;
  error: string;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const err = error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null;
  switch (state.kind) {
    case 'ready':
      return (
        <Card>
          <StatusLine tone="accent">Included with your Spotlight plan · not connected</StatusLine>
          <h3 className="mt-3 font-display text-2xl font-bold tracking-tight text-text">Connect Moonlit Cloud</h3>
          <p className="mt-1.5 text-muted">It's part of your plan at no extra cost. Once connected it stays on for as long as Spotlight is active.</p>
          <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
            {[
              ['1 · Connect', 'Press the button below.'],
              ['2 · Open Moonlit', 'Within a couple of minutes it appears under Settings → Servers.'],
              ['3 · Watch', 'Your library is ready on every device.'],
            ].map(([t, d]) => (
              <div key={t} className="rounded-xl border border-border bg-white/[0.03] px-3.5 py-3 text-[13px] text-muted">
                <b className="mb-0.5 block text-text">{t}</b>{d}
              </div>
            ))}
          </div>
          <button className={`${primaryBtn} mt-5 w-full`} onClick={onConnect} disabled={busy}>
            {busy ? 'Connecting…' : 'Connect Moonlit Cloud'}
          </button>
          {err}
        </Card>
      );
    case 'connected':
      return (
        <Card>
          <StatusLine tone="green">Connected</StatusLine>
          <h3 className="mt-3 font-display text-2xl font-bold tracking-tight text-text">Moonlit Cloud is on</h3>
          <p className="mt-1.5 text-muted">
            It stays connected while your Spotlight plan renews.
            {state.renewsAt && <> Next renewal: {cloudDate(state.renewsAt)}.</>}
          </p>
          <p className="mt-3 text-[13px] text-faint">If Spotlight ends, Cloud disconnects with it. Come back here to reconnect after you subscribe again.</p>
          <button className={`${secondaryBtn} mt-5`} onClick={onDisconnect} disabled={busy}>
            {busy ? 'Disconnecting…' : 'Disconnect'}
          </button>
          {err}
        </Card>
      );
    case 'granted':
      return (
        <Card>
          <StatusLine tone="green">Active on your account</StatusLine>
          <h3 className="mt-3 font-display text-2xl font-bold tracking-tight text-text">Moonlit Cloud is on</h3>
          <p className="mt-1.5 text-muted">
            Your access was set up for you{state.until ? <> and runs until {cloudDate(state.until)}</> : null}. Open Moonlit and it's there.
          </p>
        </Card>
      );
    case 'studio':
      return (
        <Card>
          <StatusLine tone="muted">Not included with your plan</StatusLine>
          <h3 className="mt-3 font-display text-2xl font-bold tracking-tight text-text">Moonlit Cloud is part of Spotlight</h3>
          <p className="mt-1.5 text-muted">Your account is on <b className="text-text">Studio</b>, which is built around your own server. Moonlit Cloud is available with the Spotlight plan.</p>
        </Card>
      );
    case 'ended':
      return (
        <Card>
          <StatusLine tone="red">Disconnected on {cloudDate(state.endedAt)}</StatusLine>
          <h3 className="mt-3 font-display text-2xl font-bold tracking-tight text-text">Cloud disconnected when Spotlight ended</h3>
          <p className="mt-1.5 text-muted">Your Spotlight plan finished, so Moonlit Cloud was disconnected. Your watch history and settings are kept.</p>
          <p className="mt-3 text-[13px] text-faint">Subscribe to Spotlight again, then come back here and connect.</p>
        </Card>
      );
    case 'other':
      return (
        <Card>
          <StatusLine tone="muted">Not included with your plan</StatusLine>
          <h3 className="mt-3 font-display text-2xl font-bold tracking-tight text-text">Moonlit Cloud is part of Spotlight</h3>
          <p className="mt-1.5 text-muted">Moonlit Cloud is available with the Spotlight plan. There's nothing to buy on this site.</p>
        </Card>
      );
  }
}

export default function CloudPage() {
  const { session, loading } = useAuth();
  const [account, setAccount] = useState<CloudAccount | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [linkExpired, setLinkExpired] = useState(false);

  // Sign-in emails link to /auth/confirm on this site; finish the sign-in
  // here and settle back on the page's own address.
  useEffect(() => {
    void completeEmailLink('/').then((result) => setLinkExpired(result === 'failed'));
  }, []);

  const load = useCallback(async () => {
    if (!session) { setAccount(undefined); return; }
    const { data, error: err } = await supabase
      .from('accounts')
      .select('role, role_expires_at, server_access, server_access_expires_at, server_access_source, server_access_ended_at')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (err) { setError(err.message); setAccount(null); return; }
    setAccount((data as CloudAccount | null) ?? null);
  }, [session]);

  useEffect(() => { void load(); }, [load]);

  async function setConnected(connect: boolean) {
    setBusy(true);
    setError('');
    const { data, error: err } = await supabase.rpc('cloud_connect', { p_connect: connect });
    setBusy(false);
    if (err) { setError('Something went wrong. Try again.'); return; }
    if (typeof data === 'string' && CONNECT_ERRORS[data]) setError(CONNECT_ERRORS[data]);
    await load();
  }

  const signedIn = !!session;
  const state = account !== undefined ? cloudState(account) : null;

  return (
    <div className="min-h-screen bg-[#08070a] text-text">
      <header className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-9">
        <div className="flex items-center gap-2.5 text-[15px] font-semibold">
          <span className="block h-[26px] w-[26px] rounded-[7px] bg-gradient-to-br from-[#ff9d4d] to-[#9b3f12]" />
          Moonlit Cloud
        </div>
        {signedIn && (
          <div className="flex items-center gap-3 text-[13px] text-muted">
            <span className="hidden sm:inline">{session.user.email}</span>
            <button className="text-faint hover:text-text" onClick={() => supabase.auth.signOut()}>Sign out</button>
          </div>
        )}
      </header>

      <section className="relative overflow-hidden px-5 pb-10 pt-12 text-center sm:px-9 sm:pt-16">
        <div className="pointer-events-none absolute inset-x-0 -top-1/3 h-[120%] bg-[radial-gradient(50%_50%_at_50%_30%,rgba(250,130,77,0.18),transparent_70%)]" />
        <h1 className="relative font-display text-[34px] font-bold leading-[1.06] tracking-tight sm:text-5xl">Your library,<br />ready when you are.</h1>
        <p className="relative mx-auto mt-4 max-w-[520px] text-[15px] text-muted sm:text-[17px]">
          Moonlit Cloud is Moonlit's own server, included with Spotlight. Connect it once and your movies and shows are there, with nothing to install or configure.
        </p>
      </section>

      <main className="mx-auto max-w-[640px] px-4 sm:px-9">
        {loading || (signedIn && state === null) ? (
          <Card><p className="text-sm text-muted">Loading…</p></Card>
        ) : !signedIn ? (
          <>
            {linkExpired && (
              <p className="mb-3 rounded-xl bg-red-500/10 p-4 text-sm text-red-400">That sign-in link has expired or was already used. Send yourself a new one below.</p>
            )}
            <SignIn />
          </>
        ) : (
          <StatusCard
            state={state!}
            busy={busy}
            error={error}
            onConnect={() => setConnected(true)}
            onDisconnect={() => setConnected(false)}
          />
        )}
      </main>

      <section className="mx-auto mt-11 grid max-w-[900px] gap-3.5 px-4 sm:grid-cols-3 sm:px-9">
        {[
          ['⚡', 'No setup', "No server address or password. Connect once and it's in the app."],
          ['⟲', 'Picks up where you left off', 'Progress syncs across iPhone, iPad, Mac and Apple TV.'],
          ['▦', 'Works in other apps', 'Also opens in Jellyfin-compatible apps like Infuse and Swiftfin.'],
        ].map(([icon, title, body]) => (
          <div key={title} className="rounded-2xl border border-border bg-surface p-5">
            <div className="mb-2.5 grid h-8 w-8 place-items-center rounded-[9px] bg-accent/15 text-accent">{icon}</div>
            <b className="block text-[14.5px]">{title}</b>
            <span className="text-[13px] text-muted">{body}</span>
          </div>
        ))}
      </section>

      <section className="mx-auto mt-11 max-w-[640px] px-5 pb-14 sm:px-9">
        <h4 className="mb-2 text-[13px] uppercase tracking-wide text-faint">Questions</h4>
        {[
          ['Does it cost extra?', "No. It's included with Spotlight. There is nothing to buy here."],
          ['Why do I have to connect it?', "So it's only switched on for people who want it. Connecting takes one tap."],
          ['What if my Spotlight payment fails?', "Cloud stays on during Apple's grace period. If the plan ends, it disconnects."],
          ['How many screens?', 'Up to 4 at once per account, shared by all its profiles.'],
        ].map(([q, a]) => (
          <div key={q} className="border-t border-border py-3.5">
            <b className="block text-[14.5px]">{q}</b>
            <span className="text-[13.5px] text-muted">{a}</span>
          </div>
        ))}
      </section>

      <footer className="flex flex-wrap justify-between gap-2.5 border-t border-border px-5 py-5 text-xs text-faint sm:px-9">
        <span>© 2026 Moonlit</span>
        <span className="flex gap-3">
          <a className="hover:text-text" href="https://trymoonlit.app/terms">Terms</a>
          <a className="hover:text-text" href="https://trymoonlit.app/privacy">Privacy</a>
          <a className="hover:text-text" href="https://trymoonlit.app/support">Support</a>
        </span>
      </footer>
    </div>
  );
}
