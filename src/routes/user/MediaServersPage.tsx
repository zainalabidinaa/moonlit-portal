import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

type Server = {
  id: string;
  provider: 'jellyfin' | 'plex';
  display_name: string;
  endpoint: string;
  is_managed: boolean;
  media_server_profile_grants?: { profile_id: string }[];
};
type PlexResource = { machine_identifier: string; name: string; connections: { uri: string; local: boolean; relay: boolean }[] };

async function mediaServers(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('media-servers', { body });
  if (error || data?.error) throw new Error(data?.error || error?.message || 'Could not reach server settings');
  return data;
}

export default function MediaServersPage() {
  const { profiles, isOwner } = useAuth();
  const [servers, setServers] = useState<Server[]>([]);
  const [provider, setProvider] = useState<'jellyfin' | 'plex'>('jellyfin');
  const [displayName, setDisplayName] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [plexPinId, setPlexPinId] = useState<number | null>(null);
  const [plexLinked, setPlexLinked] = useState(false);
  const [plexAuthUrl, setPlexAuthUrl] = useState('');
  const [plexResources, setPlexResources] = useState<PlexResource[]>([]);
  const [plexMachineId, setPlexMachineId] = useState('');
  const [plexDisplayName, setPlexDisplayName] = useState('');
  const [profileIds, setProfileIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => setProfileIds(profiles.map((profile) => profile.id)), [profiles]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await mediaServers({ action: 'list' });
      setServers(result.servers ?? []);
      setError('');
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const pollPlexLink = useCallback(async (pinId: number) => {
    try {
      const result = await mediaServers({ action: 'plex_pin_poll', pin_id: pinId });
      if (!result.pending) {
        setPlexLinked(true);
        setPlexResources(result.resources ?? []);
        setPlexMachineId((current) => current || result.resources?.[0]?.machine_identifier || '');
        setPlexDisplayName((current) => current || result.resources?.[0]?.name || 'Plex server');
        if (!result.resources?.length) {
          setError('Plex account linked, but no available media servers were found.');
          setPlexPinId(null);
        }
      }
    } catch (cause) {
      setError((cause as Error).message);
      setPlexPinId(null);
    }
  }, []);

  useEffect(() => {
    if (!plexPinId || plexLinked) return;
    const timer = window.setInterval(() => void pollPlexLink(plexPinId), 2500);
    return () => window.clearInterval(timer);
  }, [plexPinId, plexLinked, pollPlexLink]);

  async function startPlexLink() {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await mediaServers({ action: 'plex_pin_start' });
      setPlexPinId(result.pin_id);
      setPlexLinked(false);
      setPlexAuthUrl(result.auth_url);
      setPlexResources([]); setPlexMachineId(''); setPlexDisplayName('');
      setNotice('Continue to Plex in the new tab, then keep this page open while Axis checks the link.');
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function completePlexSetup() {
    if (!plexPinId) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await mediaServers({
        action: 'plex_complete', pin_id: plexPinId, machine_identifier: plexMachineId,
        display_name: plexDisplayName, profile_ids: profileIds,
      });
      setNotice('Plex server registered for your account.');
      setPlexPinId(null); setPlexAuthUrl(''); setPlexResources([]); setPlexMachineId(''); setPlexDisplayName('');
      setPlexLinked(false);
      await load();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const secret = JSON.stringify({ username: username.trim(), password });
      await mediaServers({
        action: 'save', provider: 'jellyfin', display_name: displayName.trim(), endpoint: endpoint.trim(),
        secret, profile_ids: profileIds,
      });
      setDisplayName(''); setEndpoint(''); setUsername(''); setPassword('');
      setNotice('Server registered for your account.');
      await load();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(server: Server) {
    if (!window.confirm(`Remove ${server.display_name} from this account?`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await mediaServers({ action: 'remove', id: server.id });
      setNotice(`${server.display_name} was removed.`);
      await load();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const profileName = (id: string) => profiles.find((profile) => profile.id === id)?.name ?? 'Profile';

  return (
    <AppShell wide={false}>
      <div className="mx-auto grid max-w-[820px] gap-7">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[.13em] text-accent">Account settings</p>
          <h1 className="mt-2 text-[34px] font-semibold tracking-tight">Media servers</h1>
          <p className="mt-2 text-[15px] text-muted">See which servers are registered for your account and choose which profiles can use your personal servers.</p>
        </header>

        {error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
        {notice && <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{notice}</div>}

        <section className="grid gap-3" aria-label="Registered servers">
          {loading ? <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted">Loading your servers…</div> : null}
          {!loading && servers.length === 0 && <div className="rounded-2xl border border-dashed border-border-strong p-6 text-sm text-muted">No media servers are registered for this account yet.</div>}
          {servers.map((server) => {
            const granted = server.media_server_profile_grants?.map((grant) => profileName(grant.profile_id)) ?? [];
            return (
              <article key={server.id} className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border border-border bg-surface p-4 sm:p-5">
                <div className={`grid h-12 w-12 place-items-center rounded-[14px] text-lg font-bold ${server.provider === 'plex' ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-200'}`} aria-hidden="true">
                  {server.is_managed ? 'A' : server.provider === 'plex' ? 'P' : 'J'}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">{server.display_name}</h2>
                  <p className="truncate text-xs text-muted">{server.is_managed ? 'Managed Jellyfin server · included with your server access' : `${server.provider === 'plex' ? 'Plex' : 'Jellyfin'} · ${server.endpoint}`}</p>
                  <p className="mt-1 text-xs text-muted">Profiles: {server.is_managed ? 'All eligible profiles' : granted.join(', ') || 'None assigned'}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${server.is_managed ? 'bg-blue-400/10 text-blue-200' : 'bg-emerald-400/10 text-emerald-200'}`}>{server.is_managed ? 'Managed' : 'Registered'}</span>
                  {!server.is_managed && isOwner && <button type="button" disabled={busy} onClick={() => void remove(server)} className="text-xs text-muted hover:text-red-300 disabled:opacity-50">Remove</button>}
                </div>
              </article>
            );
          })}
        </section>

        {isOwner && (
          <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Set up your server</h2>
            <p className="mt-1 text-sm text-muted">Add a Jellyfin or Plex server and select the profiles that can use it.</p>
            <div className="mt-5 flex gap-2" role="group" aria-label="Server type">
              {(['jellyfin', 'plex'] as const).map((kind) => (
                <button key={kind} type="button" onClick={() => setProvider(kind)} aria-pressed={provider === kind}
                  className={`rounded-lg border px-4 py-2 text-sm font-semibold capitalize ${provider === kind ? 'border-accent/60 bg-accent/10 text-accent' : 'border-border-strong bg-bg text-muted hover:text-text'}`}>{kind}</button>
              ))}
            </div>
            {provider === 'jellyfin' ? <form onSubmit={save} className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-xs font-medium text-muted">Server name
                <input required maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Home library" className="h-11 rounded-lg border border-border-strong bg-bg px-3 text-sm text-text outline-none focus:border-accent" />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-muted">Server address
                <input required type="url" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder="https://media.example.net" className="h-11 rounded-lg border border-border-strong bg-bg px-3 text-sm text-text outline-none focus:border-accent" />
              </label>
              <>
                <label className="grid gap-1.5 text-xs font-medium text-muted">Jellyfin username
                  <input required autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} className="h-11 rounded-lg border border-border-strong bg-bg px-3 text-sm text-text outline-none focus:border-accent" />
                </label>
                <label className="grid gap-1.5 text-xs font-medium text-muted">Jellyfin password
                  <input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 rounded-lg border border-border-strong bg-bg px-3 text-sm text-text outline-none focus:border-accent" />
                </label>
              </>}
              <fieldset className="sm:col-span-2">
                <legend className="text-xs font-medium text-muted">Allow profiles</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {profiles.map((profile) => <label key={profile.id} className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs ${profileIds.includes(profile.id) ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100' : 'border-border-strong text-muted'}`}>
                    <input className="sr-only" type="checkbox" checked={profileIds.includes(profile.id)} onChange={(event) => setProfileIds((current) => event.target.checked ? [...current, profile.id] : current.filter((id) => id !== profile.id))} />
                    {profileIds.includes(profile.id) ? '✓ ' : ''}{profile.name}
                  </label>)}
                </div>
              </fieldset>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 sm:col-span-2">
                <p className="max-w-md text-xs text-muted">Credentials are stored in a private server table. This page never displays them after saving.</p>
                <button type="submit" disabled={busy || profileIds.length === 0} className="rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-[#092016] disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Saving…' : 'Save server'}</button>
              </div>
            </form> : <div className="mt-5 grid gap-4">
              {!plexPinId && <button type="button" disabled={busy} onClick={() => void startPlexLink()} className="h-11 w-fit rounded-lg border border-amber-300/40 bg-amber-300/10 px-4 text-sm font-semibold text-amber-200 disabled:opacity-50">Link your Plex account</button>}
              {plexAuthUrl && <a href={plexAuthUrl} target="_blank" rel="noreferrer" className="w-fit text-sm font-semibold text-accent underline underline-offset-4">Continue to Plex sign-in ↗</a>}
              {plexPinId && !plexLinked && <p role="status" className="text-sm text-muted">Waiting for Plex authorization… Keep this page open.</p>}
              {plexResources.length > 0 && <>
                <label className="grid gap-1.5 text-xs font-medium text-muted">Plex server
                  <select value={plexMachineId} onChange={(event) => { const id = event.target.value; setPlexMachineId(id); setPlexDisplayName(plexResources.find((resource) => resource.machine_identifier === id)?.name ?? 'Plex server'); }} className="h-11 rounded-lg border border-border-strong bg-bg px-3 text-sm text-text">
                    {plexResources.map((resource) => <option key={resource.machine_identifier} value={resource.machine_identifier}>{resource.name}</option>)}
                  </select>
                </label>
                <label className="grid gap-1.5 text-xs font-medium text-muted">Server name
                  <input required maxLength={80} value={plexDisplayName} onChange={(event) => setPlexDisplayName(event.target.value)} className="h-11 rounded-lg border border-border-strong bg-bg px-3 text-sm text-text outline-none focus:border-accent" />
                </label>
                <fieldset>
                  <legend className="text-xs font-medium text-muted">Allow profiles</legend>
                  <div className="mt-2 flex flex-wrap gap-2">{profiles.map((profile) => <label key={profile.id} className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs ${profileIds.includes(profile.id) ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100' : 'border-border-strong text-muted'}`}>
                    <input className="sr-only" type="checkbox" checked={profileIds.includes(profile.id)} onChange={(event) => setProfileIds((current) => event.target.checked ? [...current, profile.id] : current.filter((id) => id !== profile.id))} />
                    {profileIds.includes(profile.id) ? '✓ ' : ''}{profile.name}
                  </label>)}</div>
                </fieldset>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                  <p className="max-w-md text-xs text-muted">Plex authorization stays in Axis’s private server storage. This page never receives or displays the account token.</p>
                  <button type="button" disabled={busy || !profileIds.length} onClick={() => void completePlexSetup()} className="rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-[#092016] disabled:opacity-50">{busy ? 'Saving…' : 'Save Plex server'}</button>
                </div>
              </>}
            </div>}
          </section>
        )}
      </div>
    </AppShell>
  );
}
