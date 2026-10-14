import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { AVATAR_URLS } from '../profiles/ProfileEditor';
import { Button } from '../ui/Button';
import type { Profile } from '../../types';

const AVATAR_COLORS = ['#ff7a3d', '#4f7cff', '#2fbf8f', '#c65cff', '#f2d27a', '#ff5c8a'];

/** Axis icon, shared with the Mac and iOS apps. */
export function Logo({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <img
      src="/moonlit-icon-96.png"
      alt=""
      aria-hidden="true"
      width={28}
      height={28}
      className={`${className} flex-none rounded-[22%] shadow-[0_2px_8px_rgba(0,0,0,.5)]`}
    />
  );
}

function navClass({ isActive }: { isActive: boolean }) {
  return `whitespace-nowrap rounded-full px-3 py-2 text-[14.5px] font-medium transition-colors ${
    isActive ? 'bg-white/[.08] text-text' : 'text-muted hover:text-text'
  }`;
}

function ProfileAvatar({ profile, className }: { profile: Profile | null; className: string }) {
  const avatarUrl = profile?.avatar_id != null ? AVATAR_URLS[profile.avatar_id] : undefined;
  const color = profile?.avatar_color ?? AVATAR_COLORS[(profile?.profile_index ?? 0) % AVATAR_COLORS.length];
  return avatarUrl ? (
    <img src={avatarUrl} alt="" className={`${className} shrink-0 rounded-full object-cover`} />
  ) : (
    <span className={`${className} grid shrink-0 place-items-center rounded-full font-semibold text-white`} style={{ backgroundColor: color }}>
      {(profile?.name ?? '?').slice(0, 1).toUpperCase()}
    </span>
  );
}

interface NavbarProps {
  /** Start transparent over a hero and turn solid after the page scrolls. */
  transparent?: boolean;
  /** Match the wider admin layout so the logo lines up with its sidebar. */
  wide?: boolean;
}

export function Navbar({ transparent = false, wide = false }: NavbarProps) {
  const { session, role, isOwner, profiles, activeProfile, setActiveProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = role === 'admin';
  const isStudio = role === 'studio';
  // Personal Home widgets: Spotlight and Studio. Admin edits the shared presets instead.
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!transparent) return;
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [transparent]);

  // Close the phone menu whenever the route changes.
  useEffect(() => {
    setOpen(false);
    setAccountOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!accountOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAccountOpen(false);
        accountRef.current?.querySelector('button')?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [accountOpen]);

  async function handleSignOut() {
    await supabase.auth.signOut({ scope: 'local' });
    navigate('/');
  }

  const solid = !transparent || scrolled || open;
  function handleProfileSelect(profile: Profile) {
    setActiveProfile(profile);
    setAccountOpen(false);
    navigate(role === 'spotlight' || role === 'studio' ? '/my-widgets' : '/profiles');
  }

  const links = (mobile: boolean) => (
    <>
      <NavLink to="/" end className={navClass}>Home</NavLink>
      <NavLink to="/download" className={navClass}>Download</NavLink>
      {!session && <NavLink to="/pricing" className={navClass}>Pricing</NavLink>}
      {session && mobile && <NavLink to="/profiles" className={navClass}>Profiles</NavLink>}
      {session && isOwner && <NavLink to="/media-servers" className={navClass}>Connections</NavLink>}
      {session && (role === 'spotlight' || isStudio) && <NavLink to="/my-widgets" className={navClass}>My widgets</NavLink>}
      {session && isStudio && <NavLink to="/my-collections" className={navClass}>My collections</NavLink>}
      {session && isAdmin && <NavLink to="/admin/home-presets" className={navClass}>Widgets</NavLink>}
      <NavLink to="/support" className={navClass}>Support</NavLink>
      {session && isAdmin && (
        <NavLink to="/admin/users" className={({ isActive }) => `${navClass({ isActive })} !text-accent`}>Admin</NavLink>
      )}
    </>
  );

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color,backdrop-filter] duration-300 ${
          solid ? 'border-border bg-bg/75 backdrop-blur-xl backdrop-saturate-150' : 'border-transparent bg-transparent'
        }`}
      >
        <div className={`mx-auto flex h-[var(--nav-h)] items-center gap-6 px-5 md:px-8 ${wide ? 'max-w-[1600px]' : 'max-w-[1240px]'}`}>
          <Link to="/" className="flex flex-none items-center gap-2.5 text-[19px] font-bold tracking-tight">
            <Logo />
            Axis
          </Link>

          <nav className="mx-auto hidden items-center gap-0.5 lg:flex" aria-label="Primary">
            {links(false)}
          </nav>

          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            {session ? (
              <>
                <div ref={accountRef} className="relative">
                  <button
                    type="button"
                    aria-label={`Account menu for ${activeProfile?.name ?? 'profiles'}`}
                    aria-haspopup="dialog"
                    aria-expanded={accountOpen}
                    aria-controls="axis-account-menu"
                    onClick={() => setAccountOpen((value) => !value)}
                    className="flex min-h-[44px] items-center gap-2 border-0 bg-transparent p-0 text-left text-text transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                  >
                    <ProfileAvatar profile={activeProfile} className="h-[40px] w-[40px] text-sm max-[420px]:h-[36px] max-[420px]:w-[36px]" />
                    <span className="min-w-0 leading-tight">
                      <strong className="max-w-[88px] truncate text-[14px] font-semibold">{activeProfile?.name ?? 'Profiles'}</strong>
                    </span>
                    <svg className={`h-3 w-3 shrink-0 text-[#c7c4c8] transition-transform ${accountOpen ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                      <path d="m2 4 4 4 4-4" />
                    </svg>
                  </button>
                  {accountOpen && (
                    <div
                      id="axis-account-menu"
                      role="dialog"
                      aria-label="Account and profiles"
                      className="account-menu-popover absolute right-0 top-[calc(100%+12px)] z-[60] w-[min(380px,calc(100vw-24px))] rounded-2xl border border-white/20 bg-[rgba(24,24,28,.76)] p-6 text-text shadow-[0_24px_64px_rgba(0,0,0,.58)] backdrop-blur-2xl backdrop-saturate-150"
                    >
                      <div>
                        <h2 className="text-[21px] font-semibold tracking-[-.03em]">Who’s watching?</h2>
                        <p className="mt-1 text-[12px] text-[#c2c0c5]">Pick up where you left off.</p>
                      </div>
                      <div className="mt-6 flex gap-4 overflow-x-auto px-2 pb-5 pt-2" aria-label="Choose profile">
                        {profiles.map((profile) => (
                          <button
                            key={profile.id}
                            type="button"
                            aria-label={`Switch to ${profile.name}`}
                            aria-current={profile.id === activeProfile?.id ? 'true' : undefined}
                            onClick={() => handleProfileSelect(profile)}
                            className="group grid w-[72px] shrink-0 justify-items-center gap-3 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                          >
                            <span className={`block h-[60px] w-[60px] rounded-full ${profile.id === activeProfile?.id ? 'outline outline-2 outline-offset-[4px] outline-[#ece9ed]' : ''}`}>
                              <ProfileAvatar profile={profile} className="h-[60px] w-[60px] text-xl" />
                            </span>
                            <span className="w-full truncate text-[12px] text-[#e3e0e4] group-hover:text-white">{profile.name}</span>
                          </button>
                        ))}
                      </div>
                      <div className="h-px bg-[#37373c]" />
                      <div className="grid pt-[10px] text-[12px]">
                        <Link to="/profiles" onClick={() => setAccountOpen(false)} className="py-2 text-[#e2e0e2] hover:text-white">Manage profiles</Link>
                        <Link to="/billing" onClick={() => setAccountOpen(false)} className="py-2 text-[#e2e0e2] hover:text-white">Account &amp; billing</Link>
                        <button type="button" onClick={handleSignOut} className="py-2 text-left text-[#aaa8ad] hover:text-white">Sign out</button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => navigate('/login')}>Sign in</Button>
                <Button size="sm" onClick={() => navigate('/signup')}>Get Axis</Button>
              </>
            )}
            <button
              type="button"
              aria-label="Menu"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-full border border-border-strong bg-white/[.06] lg:hidden"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          </div>
        </div>
      </header>

      {open && (
        <nav
          className="fixed inset-x-0 top-[var(--nav-h)] z-40 flex flex-col border-b border-border bg-bg/95 px-5 pb-5 pt-3 backdrop-blur-xl lg:hidden"
          aria-label="Mobile"
        >
          <div className="flex flex-col [&>a]:border-b [&>a]:border-border [&>a]:py-3 [&>a]:text-lg [&>a]:rounded-none [&>a]:px-2 [&>a:last-child]:border-0">
            {links(true)}
            {!session && <NavLink to="/login" className={navClass}>Sign in</NavLink>}
          </div>
        </nav>
      )}
    </>
  );
}
