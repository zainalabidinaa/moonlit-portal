import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AppShell } from '../../components/layout/AppShell';
import { ProfileCard } from '../../components/profiles/ProfileCard';
import { ProfileEditor } from '../../components/profiles/ProfileEditor';

export default function ProfilesPage() {
  const { profiles, activeProfile, setActiveProfile, user, role, isOwner, loading } = useAuth();
  const navigate = useNavigate();
  const [editMode, setEditMode] = useState(false);
  const [editingProfile, setEditingProfile] = useState<typeof profiles[0] | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);

  function handleSelectProfile(p: typeof profiles[0]) {
    setActiveProfile(p);
    navigate('/addons');
  }

  function handleSaved() {
    setEditingProfile(null);
    setCreatingNew(false);
    window.location.reload();
  }

  // Owner: the "Edit" toggle makes every card editable/deletable, plus "Add
  // Profile". Non-owner: no toggle, no add — the only thing they can touch is
  // whichever card is their own currently-active profile, and only to edit
  // it, never delete (see ProfileEditor's canDelete).
  function isCardEditable(p: typeof profiles[0]): boolean {
    return isOwner ? editMode : p.id === activeProfile?.id;
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-text">Who&apos;s watching?</h1>
          {isOwner && (
            <button onClick={() => setEditMode(e => !e)} className="text-sm text-muted hover:text-text transition-colors">
              {editMode ? 'Done' : 'Edit'}
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-6">
          {profiles.map(p => (
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
              editable={isCardEditable(p)}
              onSelect={() => handleSelectProfile(p)}
              onEdit={() => setEditingProfile(p)}
            />
          ))}
          {isOwner && !loading && profiles.length < 5 && !editMode && (
            <div
              onClick={() => setCreatingNew(true)}
              className="flex flex-col items-center gap-2 cursor-pointer group"
            >
              <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-border flex items-center justify-center text-3xl text-muted group-hover:border-accent group-hover:text-accent transition-all">
                +
              </div>
              <p className="text-sm text-muted">Add Profile</p>
            </div>
          )}
        </div>
      </div>

      {(editingProfile || creatingNew) && user && (
        <ProfileEditor
          profile={editingProfile}
          onClose={() => { setEditingProfile(null); setCreatingNew(false); }}
          onSaved={handleSaved}
          userId={user.id}
          nextIndex={profiles.reduce((max, p) => Math.max(max, p.profile_index), -1) + 1}
          accountRole={role ?? 'free'}
          // Only the owner may delete a profile, and never the owner's own —
          // losing that row would permanently strand the account with no
          // profile anyone can ever be recognized as owning.
          canDelete={isOwner && !!editingProfile && editingProfile.id !== profiles[0]?.id}
        />
      )}
    </AppShell>
  );
}
