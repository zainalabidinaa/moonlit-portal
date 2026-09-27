import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { PLAN_LABELS } from '../../lib/plans';
import { AVATAR_URLS } from '../profiles/ProfileEditor';
import { Button } from '../ui/Button';

const AVATAR_COLORS = ['#ff7a3d', '#4f7cff', '#2fbf8f', '#c65cff', '#f2d27a', '#ff5c8a'];

export function Logo({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="moonlit-moon" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FF8A35" />
          <stop offset="100%" stopColor="#FF6A2B" />
        </linearGradient>
      </defs>
      <circle cx="256" cy="256" r="240" fill="#151517" />
      <path
        d="M336 96C280 108 240 160 240 220C240 280 280 340 336 352C304 376 264 388 220 388C140 388 76 324 76 244C76 164 140 100 220 100C264 100 304 112 336 96Z"
        fill="url(#moonlit-moon)"
      />
    </svg>
  );
}

function navClass({ isActive }: { isActive: boolean }) {
  return `whitespace-nowrap rounded-full px-3 py-2 text-[14.5px] font-medium transition-colors ${
    isActive ? 'bg-white/[.08] text-text' : 'text-muted hover:text-text'
  }`;
}

interface NavbarProps {
  /** Start transparent over a hero and turn solid after the page scrolls. */
  transparent?: boolean;
}

export function Navbar({ transparent = false }: NavbarProps) {
  const { session, role, isOwner, activeProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = role === 'admin';
  const isStudio = role === 'studio' || isAdmin;
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!transparent) return;
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [transparent]);

  // Close the phone menu whenever the route changes.
  useEffect(() => { setOpen(false); }, [location.pathname]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate('/');
  }

  const solid = !transparent || scrolled || open;
  const avatarUrl = activeProfile?.avatar_id != null ? AVATAR_URLS[activeProfile.avatar_id] : undefined;
  const avatarBg = activeProfile?.avatar_color ?? AVATAR_COLORS[(activeProfile?.profile_index ?? 0) % AVATAR_COLORS.length];

  const links = (
    <>
      <NavLink to="/catalog" className={navClass}>Catalog</NavLink>
      <NavLink to="/download" className={navClass}>Download</NavLink>
      {!session && <NavLink to="/pricing" className={navClass}>Pricing</NavLink>}
      {session && <NavLink to="/profiles" className={navClass}>Profiles</NavLink>}
      {session && isStudio && <NavLink to="/my-collections" className={navClass}>My collections</NavLink>}
      {session && isAdmin && <NavLink to="/admin/home-presets" className={navClass}>Widgets</NavLink>}
      {session && isOwner && <NavLink to="/billing" className={navClass}>Billing</NavLink>}
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
        <div className="mx-auto flex h-[var(--nav-h)] max-w-[1240px] items-center gap-6 px-5 md:px-8">
          <Link to="/" className="flex flex-none items-center gap-2.5 text-[19px] font-bold tracking-tight">
            <Logo />
            Moonlit
          </Link>

          <nav className="mx-auto hidden items-center gap-0.5 lg:flex" aria-label="Primary">
            {links}
          </nav>

          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            {session ? (
              <>
                <Link
                  to="/profiles"
                  className="hidden h-[38px] items-center gap-2.5 rounded-full border border-border-strong bg-white/[.06] py-0.5 pl-0.5 pr-3 text-[13.5px] font-medium sm:inline-flex"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="h-[30px] w-[30px] rounded-full object-cover" />
                  ) : (
                    <span
                      className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ background: avatarBg }}
                    >
                      {(activeProfile?.name ?? '?').slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span>{activeProfile?.name ?? 'Profiles'}</span>
                  {role && (
                    <span
                      className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                        isAdmin ? 'border-accent/50 bg-accent-light text-accent' : 'border-border-strong text-muted'
                      }`}
                    >
                      {PLAN_LABELS[role]}
                    </span>
                  )}
                </Link>
                <Button variant="ghost" size="sm" onClick={handleSignOut}>Sign out</Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => navigate('/login')}>Sign in</Button>
                <Button size="sm" onClick={() => navigate('/signup')}>Get Moonlit</Button>
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
            {links}
            {!session && <NavLink to="/login" className={navClass}>Sign in</NavLink>}
          </div>
        </nav>
      )}
    </>
  );
}
