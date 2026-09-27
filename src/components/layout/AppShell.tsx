import { NavLink, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { FirstProfileGate } from '../profiles/FirstProfileGate';
import { useAuth } from '../../context/AuthContext';

const adminSections: { label: string; to: string }[] = [
  { label: 'Widgets', to: '/admin/home-presets' },
  { label: 'Collections', to: '/admin/catalog' },
  { label: 'Sources', to: '/admin/sources' },
  { label: 'Add-ons', to: '/admin/addons' },
  { label: 'Templates', to: '/admin/templates' },
  { label: 'Tab visibility', to: '/admin/tab-visibility' },
  { label: 'Users', to: '/admin/users' },
  { label: 'Invites', to: '/admin/invites' },
  { label: 'Support', to: '/admin/support' },
];

/** Secondary strip under the navbar listing every admin section. */
function AdminNav() {
  return (
    <div className="border-b border-border bg-bg2/60">
      <nav
        className="mx-auto flex max-w-[1240px] gap-1 overflow-x-auto px-5 py-2 [scrollbar-width:none] md:px-8"
        aria-label="Admin sections"
      >
        {adminSections.map((s) => (
          <NavLink
            key={s.to}
            to={s.to}
            className={({ isActive }) =>
              `whitespace-nowrap rounded-full px-3 py-1.5 text-[13.5px] font-medium transition-colors ${
                isActive ? 'bg-surface-2 text-text' : 'text-muted hover:text-text'
              }`
            }
          >
            {s.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function AppShell({ children, wide = true }: { children: React.ReactNode; wide?: boolean }) {
  const { role } = useAuth();
  const { pathname } = useLocation();
  const showAdminNav = role === 'admin' && pathname.startsWith('/admin');

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <Navbar />
      <div className="h-[var(--nav-h)]" aria-hidden="true" />
      {showAdminNav && <AdminNav />}
      <main className={`mx-auto w-full flex-1 px-5 py-10 md:px-8 ${wide ? 'max-w-[1240px]' : 'max-w-3xl'}`}>{children}</main>
      <FirstProfileGate />
    </div>
  );
}
