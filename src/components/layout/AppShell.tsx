import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { FirstProfileGate } from '../profiles/FirstProfileGate';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

type Section = { label: string; to: string; count?: 'invites' | 'support' };

const groups: { title: string; sections: Section[] }[] = [
  {
    title: 'Catalog',
    sections: [
      { label: 'Widgets', to: '/admin/home-presets' },
      { label: 'Collections', to: '/admin/catalog' },
      { label: 'Sources', to: '/admin/sources' },
      { label: 'Add-ons', to: '/admin/addons' },
      { label: 'Templates', to: '/admin/templates' },
      { label: 'Tab visibility', to: '/admin/tab-visibility' },
    ],
  },
  {
    title: 'People',
    sections: [
      { label: 'Users', to: '/admin/users' },
      { label: 'Invites', to: '/admin/invites', count: 'invites' },
      { label: 'Support', to: '/admin/support', count: 'support' },
    ],
  },
];

/** Unused invite codes and support requests still waiting on a first reply. */
function useAdminCounts(enabled: boolean) {
  const [counts, setCounts] = useState<{ invites?: number; support?: number }>({});
  const { pathname } = useLocation();

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const [inv, sup] = await Promise.all([
          supabase.from('invite_codes').select('code', { count: 'exact', head: true }).is('used_by', null).eq('is_active', true),
          supabase.from('support_requests').select('id', { count: 'exact', head: true }).eq('status', 'new'),
        ]);
        if (!cancelled) setCounts({ invites: inv.count ?? undefined, support: sup.count ?? undefined });
      } catch {
        /* counts are decoration; the links work without them */
      }
    })();
    return () => { cancelled = true; };
    // Refresh when moving between admin pages so the numbers follow edits.
  }, [enabled, pathname]);

  return counts;
}

function countLabel(kind: Section['count'], n: number | undefined) {
  if (!kind || !n) return null;
  return kind === 'invites' ? `${n} unused` : `${n} new`;
}

/** Sticky, grouped section list on wide screens; a scrolling strip on narrow ones. */
function AdminSidebar({ counts }: { counts: { invites?: number; support?: number } }) {
  const link = ({ isActive }: { isActive: boolean }) =>
    `flex items-center justify-between gap-2.5 whitespace-nowrap rounded-[10px] px-3 py-2 text-sm font-medium transition-colors ${
      isActive ? 'bg-surface-2 text-text' : 'text-muted hover:bg-surface-2/60 hover:text-text'
    }`;

  return (
    <nav aria-label="Admin sections" className="flex gap-1 overflow-x-auto [scrollbar-width:none] lg:sticky lg:top-[calc(var(--nav-h)+24px)] lg:flex-col lg:overflow-visible">
      {groups.map((g) => (
        <div key={g.title} className="contents lg:mt-5 lg:block lg:first:mt-0">
          <span className="hidden px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[.1em] text-faint lg:block">
            {g.title}
          </span>
          {g.sections.map((s) => {
            const badge = countLabel(s.count, s.count ? counts[s.count] : undefined);
            return (
              <NavLink key={s.to} to={s.to} className={link}>
                {s.label}
                {badge && (
                  <i className="rounded-full bg-accent-light px-1.5 py-0.5 font-mono text-[10.5px] not-italic text-accent">{badge}</i>
                )}
              </NavLink>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function AppShell({ children, wide = true }: { children: React.ReactNode; wide?: boolean }) {
  const { role } = useAuth();
  const { pathname } = useLocation();
  const isAdminArea = role === 'admin' && pathname.startsWith('/admin');
  const counts = useAdminCounts(isAdminArea);

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <Navbar />
      <div className="h-[var(--nav-h)]" aria-hidden="true" />
      {isAdminArea ? (
        <div className="mx-auto grid w-full max-w-[1240px] flex-1 gap-6 px-5 pb-20 pt-12 md:px-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10 lg:pt-[72px]">
          <AdminSidebar counts={counts} />
          <main className="min-w-0">{children}</main>
        </div>
      ) : (
        <main className={`mx-auto w-full flex-1 px-5 pb-20 pt-12 md:px-8 md:pt-[72px] ${wide ? 'max-w-[1240px]' : 'max-w-3xl'}`}>{children}</main>
      )}
      <Footer />
      <FirstProfileGate />
    </div>
  );
}
