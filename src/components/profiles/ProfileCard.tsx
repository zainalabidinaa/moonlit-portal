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
  /** The profile currently in use on this device. */
  isActive?: boolean;
}

export function ProfileCard({ profile, onSelect, onEdit, editable, isActive }: ProfileCardProps) {
  const bg = profile.avatar_color ?? AVATAR_COLORS[profile.profile_index % AVATAR_COLORS.length];
  const avatar = profile.avatar_id != null ? AVATAR_URLS[profile.avatar_id] : undefined;
  const initials = profile.name.slice(0, 2).toUpperCase();

  return (
    <button
      type="button"
      onClick={editable ? onEdit : onSelect}
      className={`group relative grid min-h-[160px] cursor-pointer justify-items-center content-center gap-2 rounded-2xl border bg-surface px-3 py-4 text-center transition-[transform,border-color,background-color] duration-200 hover:-translate-y-0.5 hover:border-border-strong ${
        isActive ? 'border-[#55555d] bg-white/[.035]' : 'border-border'
      }`}
    >
      <span className="relative block h-[84px] w-[84px]">
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
      <b className="text-sm font-semibold">{profile.name}</b>
      <small className="text-xs text-muted">{isActive ? 'Currently selected' : profile.pin_enabled ? 'PIN protected' : 'Profile'}</small>
    </button>
  );
}
