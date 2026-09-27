import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AppShell } from '../../components/layout/AppShell';
import { ProfileCard } from '../../components/profiles/ProfileCard';
import { ProfileEditor } from '../../components/profiles/ProfileEditor';
import { Badge } from '../../components/ui/Badge';
import { PLAN_LABELS, profileLimitFor } from '../../lib/plans';
import { MAC_DOWNLOAD_URL, MAC_VERSION, TESTFLIGHT_URL } from '../../lib/releases';
import { AppleIcon, GlobeIcon, PhoneIcon, TvIcon } from '../../components/landing/PlatformIcons';

export default function ProfilesPage() {
  const { profiles, activeProfile, setActiveProfile, user, isOwner, loading, role } = useAuth();
  const navigate = useNavigate();
  const [editMode, setEditMode] = useState(false);
  const [editingProfile, setEditingProfile] = useState<typeof profiles[0] | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);

  const limit = profileLimitFor(role);
  const canAdd = isOwner && !loading && (limit === null || profiles.length < limit) && !editMode;
  const atLimit = isOwner && !loading && limit !== null && profiles.length >= limit;

  function handleSelectProfile(p: typeof profiles[0]) {
    setActiveProfile(p);
    // Straight to that profile's own Home rows when the plan includes them.
    if (role === 'spotlight' || role === 'studio') navigate('/my-widgets');
  }

  function handleSaved() {
    setEditingProfile(null);
    setCreatingNew(false);
    window.location.reload();
  }

  // Owner: the "Edit" toggle makes every card editable/deletable, plus "Add
  // profile". Non-owner: no toggle, no add — the only thing they can touch is
  // whichever card is their own currently-active profile, and only to edit
  // it, never delete (see ProfileEditor's canDelete).
  function isCardEditable(p: typeof profiles[0]): boolean {
    return isOwner ? editMode : p.id === activeProfile?.id;
  }

  const expires = activeProfile?.role_expires_at ? new Date(activeProfile.role_expires_at) : null;

  return (
    <AppShell wide={false}>
      <div className="grid gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[34px] font-semibold tracking-tight">Who's watching?</h1>
            <p className="mt-1.5 text-[15px] text-muted">
              {limit === null
                ? `${profiles.length} profile${profiles.length === 1 ? '' : 's'} on this account.`
                : `${profiles.length} of ${limit} profiles on this account.`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {role && <Badge variant="purple">{PLAN_LABELS[role]}</Badge>}
            {isOwner && (
              <button type="button" onClick={() => setEditMode((e) => !e)} className="text-sm font-medium text-muted transition-colors hover:text-text">
                {editMode ? 'Done' : 'Edit'}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-4">
          {profiles.map((p) => (
            <ProfileCard
              key={p.id}
              profile={p}
              // Whichever profile is actually first in the (index-ordered)
              // list — not a hardcoded profile_index === 0 — so an account
              // whose original first profile was deleted before ownership
              // existed still gets exactly one recognized owner rather than
              // none. Shows regardless of how many profiles the account has,
              // including a solo one.
              isOwnerProfile={p.id === profiles[0]?.id}
              isActive={p.id === activeProfile?.id}
              editable={isCardEditable(p)}
              onSelect={() => handleSelectProfile(p)}
              onEdit={() => setEditingProfile(p)}
            />
          ))}
          {canAdd && (
            <button
              type="button"
              onClick={() => setCreatingNew(true)}
              className="group grid justify-items-center gap-2.5 rounded-2xl border border-dashed border-border-strong px-2.5 py-[18px] text-center transition-colors hover:border-accent"
            >
              <span className="grid h-[72px] w-[72px] place-items-center rounded-full border border-dashed border-border-strong text-[26px] font-light text-faint group-hover:border-accent group-hover:text-accent">+</span>
              <b className="text-sm font-semibold">Add profile</b>
              <small className="font-mono text-[10px] tracking-[.06em] text-faint">{limit === null ? 'NO LIMIT' : `${limit - profiles.length} LEFT`}</small>
            </button>
          )}
          {atLimit && !editMode && (
            <div className="grid justify-items-center gap-2.5 rounded-2xl border border-dashed border-border px-2.5 py-[18px] text-center opacity-55">
              <span className="grid h-[72px] w-[72px] place-items-center rounded-full border border-dashed border-border text-[26px] font-light text-faint">+</span>
              <b className="text-sm font-semibold">Add profile</b>
              <small className="font-mono text-[10px] tracking-[.06em] text-faint">LIMIT REACHED</small>
            </div>
          )}
        </div>

        {role === 'friends_family' && (
          <div className="rounded-3xl border border-border bg-surface p-7">
            <h2 className="mb-3 text-lg font-semibold">Invited access</h2>
            <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 border-b border-border py-3.5 text-[14.5px]"><span className="text-muted">Catalog</span><b className="font-semibold">Shared household catalog</b></div>
            {expires && (
              <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 py-3.5 text-[14.5px]"><span className="text-muted">Access until</span><b className="font-semibold tabular-nums">{expires.toLocaleDateString()}</b></div>
            )}
          </div>
        )}

        {role === 'spotlight' && isOwner && limit !== null && profiles.length >= limit - 1 && (
          <div className="grid gap-3.5 rounded-2xl border border-accent/35 bg-[linear-gradient(135deg,rgba(255,122,61,.12),transparent_60%)] bg-surface p-[22px]">
            <b className="text-base font-semibold">Need more than four profiles?</b>
            <p className="text-sm text-muted">Studio removes the profile limit and adds four simultaneous streams plus your own sources.</p>
            <Link to="/pricing" className="inline-flex h-[38px] w-fit items-center rounded-full border border-border-strong bg-white/[.06] px-4 text-sm font-semibold hover:bg-white/10">Compare plans</Link>
          </div>
        )}
        <div className="rounded-2xl border border-border bg-surface p-7">
          <h2 className="text-lg font-semibold">Watch on your devices</h2>
          <p className="mt-1 text-sm text-muted">Every profile here is on each device you sign in to, with the same library and progress.</p>
          <div className="mt-3">
            {[
              { icon: <AppleIcon className="h-5 w-5" />, name: 'Mac', note: `Moonlit for Mac ${MAC_VERSION}`, action: <a href={MAC_DOWNLOAD_URL} className="text-accent">Download</a> },
              { icon: <PhoneIcon className="h-5 w-5" />, name: 'iPhone and iPad', note: 'Public beta on TestFlight', action: <a href={TESTFLIGHT_URL} target="_blank" rel="noreferrer noopener" className="text-accent">Join the beta</a> },
              { icon: <GlobeIcon className="h-5 w-5" />, name: 'Web', note: 'Right here in the browser', action: <span className="text-faint">Signed in</span> },
              { icon: <TvIcon className="h-5 w-5" />, name: 'Apple TV', note: 'Enter the code the TV shows', action: <Link to="/activate" className="text-accent">Link a TV</Link> },
            ].map((d) => (
              <div key={d.name} className="grid grid-cols-[24px_1fr_auto] items-center gap-3 border-b border-border py-3.5 text-[14.5px] last:border-0">
                <span className="text-text">{d.icon}</span>
                <span><b className="font-semibold">{d.name}</b><span className="ml-2 text-muted">{d.note}</span></span>
                <span className="text-sm font-medium">{d.action}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {(editingProfile || creatingNew) && user && (
        <ProfileEditor
          profile={editingProfile}
          onClose={() => { setEditingProfile(null); setCreatingNew(false); }}
          onSaved={handleSaved}
          userId={user.id}
          nextIndex={profiles.reduce((max, p) => Math.max(max, p.profile_index), -1) + 1}
          // Only the owner may delete a profile, and never the owner's own —
          // losing that row would permanently strand the account with no
          // profile anyone can ever be recognized as owning.
          canDelete={isOwner && !!editingProfile && editingProfile.id !== profiles[0]?.id}
        />
      )}
    </AppShell>
  );
}
