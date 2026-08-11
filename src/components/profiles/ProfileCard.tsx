import type { Profile } from '../../types';

const AVATAR_COLORS = ['#6d28d9', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

interface ProfileCardProps {
  profile: Profile;
  onSelect: () => void;
  onEdit: () => void;
  /** Card is clickable-to-edit at all — owner in edit mode over any card, or a
   *  non-owner over their own card only (see ProfilesPage). */
  editable: boolean;
  /** Passed by the caller (which has the full ordered list) rather than
   *  computed here from profile_index === 0 — see ProfilesPage for why that
   *  distinction matters. Shows regardless of how many profiles the account
   *  has, including a solo one, since it's just "is this profile row the
   *  first one," true or false either way. */
  isOwnerProfile: boolean;
}

export function ProfileCard({ profile, onSelect, onEdit, editable, isOwnerProfile }: ProfileCardProps) {
  const bg = profile.avatar_color ?? AVATAR_COLORS[profile.profile_index % AVATAR_COLORS.length];
  const initials = profile.name.slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col items-center gap-2 group cursor-pointer" onClick={editable ? onEdit : onSelect}>
      <div
        className="w-24 h-24 rounded-2xl flex items-center justify-center text-2xl font-bold text-white transition-all group-hover:ring-4 group-hover:ring-accent/40 relative"
        style={{ backgroundColor: bg }}
      >
        {initials}
        {editable && (
          <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center">
            <span className="text-white text-lg">&#9998;</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <p className="text-sm font-medium text-text">{profile.name}</p>
        {isOwnerProfile && (
          <span className="rounded-full bg-accent-light px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
            Owner
          </span>
        )}
      </div>
    </div>
  );
}
