import type { Profile } from '../../types';
import { AVATAR_URLS } from './ProfileEditor';

const AVATAR_COLORS = ['#ff7a3d', '#4f7cff', '#2fbf8f', '#c65cff', '#f2d27a', '#ff5c8a'];

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
  /** The profile currently in use on this device. */
  isActive?: boolean;
}

export function ProfileCard({ profile, onSelect, onEdit, editable, isOwnerProfile, isActive }: ProfileCardProps) {
  const bg = profile.avatar_color ?? AVATAR_COLORS[profile.profile_index % AVATAR_COLORS.length];
  const avatar = profile.avatar_id != null ? AVATAR_URLS[profile.avatar_id] : undefined;
  const initials = profile.name.slice(0, 2).toUpperCase();

  return (
    <button
      type="button"
      onClick={editable ? onEdit : onSelect}
      className={`group grid cursor-pointer justify-items-center gap-2.5 rounded-2xl border bg-surface px-2.5 py-[18px] text-center transition-[transform,border-color] duration-300 ease-out hover:-translate-y-1 hover:border-border-strong ${
        isActive ? 'border-accent/50' : 'border-border'
      }`}
    >
      <span className="relative block h-[72px] w-[72px]">
        {avatar ? (
          <img src={avatar} alt="" className="h-full w-full rounded-full object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center rounded-full text-xl font-semibold text-white" style={{ backgroundColor: bg }}>
            {initials}
          </span>
        )}
        {editable && (
          <span className="absolute inset-0 grid place-items-center rounded-full bg-black/50 text-lg text-white">&#9998;</span>
        )}
      </span>
      <b className="text-sm font-semibold">
        {profile.name}
        {profile.pin_enabled && <span className="ml-1.5 rounded bg-accent-light px-1.5 py-px font-mono text-[9.5px] text-accent">PIN</span>}
      </b>
      <small className="font-mono text-[10px] tracking-[.06em] text-faint">{isOwnerProfile ? 'OWNER' : 'PROFILE'}</small>
    </button>
  );
}
