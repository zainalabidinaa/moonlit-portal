/**
 * Made-up illustrated profile characters for the marketing page. Original
 * flat vector art, so there is nothing to license and nothing to hotlink.
 * Each is a 64×64 square meant to sit inside a rounded-full mask.
 */

type AvatarProps = { className?: string };

const base = 'h-full w-full';

/** Orange fox with a white muzzle. */
export function FoxAvatar({ className = base }: AvatarProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="av-fox-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3a1d10" />
          <stop offset="1" stopColor="#1c0e08" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" fill="url(#av-fox-bg)" />
      <path d="M14 18 L22 34 L28 26 Z" fill="#ff7a3d" />
      <path d="M50 18 L42 34 L36 26 Z" fill="#ff7a3d" />
      <path d="M17 22 L22 31 L25 27 Z" fill="#2a130a" />
      <path d="M47 22 L42 31 L39 27 Z" fill="#2a130a" />
      <path d="M32 24 C44 24 50 32 50 40 C50 48 42 54 32 54 C22 54 14 48 14 40 C14 32 20 24 32 24 Z" fill="#ff8a35" />
      <path d="M32 38 C38 38 44 42 44 47 C44 51 38 54 32 54 C26 54 20 51 20 47 C20 42 26 38 32 38 Z" fill="#fff3e8" />
      <circle cx="25" cy="37" r="2.6" fill="#1a0b04" />
      <circle cx="39" cy="37" r="2.6" fill="#1a0b04" />
      <circle cx="25.8" cy="36.2" r=".8" fill="#fff" />
      <circle cx="39.8" cy="36.2" r=".8" fill="#fff" />
      <path d="M29.5 44 L34.5 44 L32 47 Z" fill="#1a0b04" />
    </svg>
  );
}

/** Blue astronaut with a moon on the visor. */
export function AstronautAvatar({ className = base }: AvatarProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="av-astro-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1b2a5c" />
          <stop offset="1" stopColor="#0c1230" />
        </linearGradient>
        <linearGradient id="av-astro-visor" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6d8cff" />
          <stop offset="1" stopColor="#2b3f9e" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" fill="url(#av-astro-bg)" />
      <circle cx="12" cy="14" r="1" fill="#fff" opacity=".7" />
      <circle cx="52" cy="10" r="1.2" fill="#fff" opacity=".8" />
      <circle cx="56" cy="30" r=".8" fill="#fff" opacity=".6" />
      <rect x="18" y="46" width="28" height="18" rx="8" fill="#e8ecf8" />
      <circle cx="32" cy="32" r="17" fill="#f2f4fb" />
      <rect x="20" y="24" width="24" height="17" rx="8.5" fill="url(#av-astro-visor)" />
      <path d="M36 28 C33 28 31 30.5 31 33 C31 35.5 33 38 36 38 C34.2 37 33.4 35 33.4 33 C33.4 31 34.2 29 36 28 Z" fill="#ffb27a" />
      <path d="M22.5 27 C24 25.5 26 25 27.5 25" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity=".8" />
      <circle cx="47" cy="30" r="2.4" fill="#ff7a3d" />
    </svg>
  );
}

/** Green sprout creature, used for kids profiles. */
export function SproutAvatar({ className = base }: AvatarProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="av-sprout-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#12392a" />
          <stop offset="1" stopColor="#081c14" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" fill="url(#av-sprout-bg)" />
      <path d="M32 22 C32 16 28 11 22 10 C22 16 26 21 32 22 Z" fill="#7be3a8" />
      <path d="M32 22 C32 15 37 10 44 9 C44 16 39 21 32 22 Z" fill="#4fcf8a" />
      <path d="M32 22 L32 27" stroke="#4fcf8a" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 26 C45 26 51 34 51 42 C51 50 43 56 32 56 C21 56 13 50 13 42 C13 34 19 26 32 26 Z" fill="#2fbf8f" />
      <ellipse cx="22" cy="45" rx="3.4" ry="2.2" fill="#ff9aa8" opacity=".6" />
      <ellipse cx="42" cy="45" rx="3.4" ry="2.2" fill="#ff9aa8" opacity=".6" />
      <circle cx="25" cy="40" r="3" fill="#0b1f16" />
      <circle cx="39" cy="40" r="3" fill="#0b1f16" />
      <circle cx="26" cy="39" r="1" fill="#fff" />
      <circle cx="40" cy="39" r="1" fill="#fff" />
      <path d="M28 47 C30 49.5 34 49.5 36 47" stroke="#0b1f16" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** Purple owl with big round eyes. */
export function OwlAvatar({ className = base }: AvatarProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="av-owl-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#35184f" />
          <stop offset="1" stopColor="#180a26" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" fill="url(#av-owl-bg)" />
      <path d="M16 20 L22 28 L18 30 Z" fill="#9b5cf0" />
      <path d="M48 20 L42 28 L46 30 Z" fill="#9b5cf0" />
      <path d="M32 22 C45 22 50 32 50 42 C50 52 42 58 32 58 C22 58 14 52 14 42 C14 32 19 22 32 22 Z" fill="#b57bff" />
      <path d="M32 40 C39 40 43 45 43 51 C43 55 38 58 32 58 C26 58 21 55 21 51 C21 45 25 40 32 40 Z" fill="#e6d4ff" />
      <circle cx="24.5" cy="35" r="7" fill="#fff" />
      <circle cx="39.5" cy="35" r="7" fill="#fff" />
      <circle cx="25.5" cy="35.5" r="3.6" fill="#1c0a2e" />
      <circle cx="38.5" cy="35.5" r="3.6" fill="#1c0a2e" />
      <circle cx="26.6" cy="34.2" r="1.1" fill="#fff" />
      <circle cx="39.6" cy="34.2" r="1.1" fill="#fff" />
      <path d="M29.5 41 L34.5 41 L32 45 Z" fill="#f2b84b" />
    </svg>
  );
}

/** Pink ghost, the "Add" or guest slot. */
export function GhostAvatar({ className = base }: AvatarProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="av-ghost-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4a1a33" />
          <stop offset="1" stopColor="#220b18" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" fill="url(#av-ghost-bg)" />
      <path d="M32 14 C43 14 49 22 49 32 L49 52 L44 48 L39 52 L34 48 L29 52 L24 48 L19 52 L15 48 L15 32 C15 22 21 14 32 14 Z" fill="#ffc2dd" />
      <ellipse cx="26" cy="31" rx="3" ry="4" fill="#3a0f24" />
      <ellipse cx="38" cy="31" rx="3" ry="4" fill="#3a0f24" />
      <circle cx="27" cy="29.5" r="1" fill="#fff" />
      <circle cx="39" cy="29.5" r="1" fill="#fff" />
      <ellipse cx="32" cy="40" rx="3" ry="2.4" fill="#3a0f24" />
      <ellipse cx="21" cy="37" rx="2.8" ry="1.8" fill="#ff7ab0" opacity=".55" />
      <ellipse cx="43" cy="37" rx="2.8" ry="1.8" fill="#ff7ab0" opacity=".55" />
    </svg>
  );
}
