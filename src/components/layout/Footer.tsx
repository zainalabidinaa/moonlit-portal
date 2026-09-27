import { Link } from 'react-router-dom';
import { Logo } from './Navbar';

const columns: { title: string; links: { label: string; to: string }[] }[] = [
  { title: 'Product', links: [{ label: 'Catalog', to: '/catalog' }, { label: 'Download', to: '/download' }, { label: 'Pricing', to: '/pricing' }] },
  { title: 'Account', links: [{ label: 'Sign in', to: '/login' }, { label: 'Create account', to: '/signup' }, { label: 'Redeem an invite', to: '/signup?tab=invite' }] },
  { title: 'Help', links: [{ label: 'Support', to: '/support' }, { label: 'Link a TV', to: '/activate' }, { label: 'Release notes', to: '/download#release-notes' }] },
];

export function Footer({ wide = false }: { wide?: boolean } = {}) {
  return (
    <footer className="border-t border-border bg-bg pb-10 pt-14">
      <div className={`mx-auto px-5 md:px-8 ${wide ? 'max-w-[1600px]' : 'max-w-[1240px]'}`}>
        <div className="grid gap-9 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link to="/" className="flex items-center gap-2.5 text-[19px] font-bold tracking-tight">
              <Logo />
              Moonlit
            </Link>
            <p className="mt-3 max-w-[26em] text-sm text-muted">
              Curated streaming for the whole household. Collections picked by people, real 4K playback, and a profile for everyone.
            </p>
          </div>
          {columns.map((c) => (
            <div key={c.title}>
              <h4 className="mb-3.5 text-[13px] font-semibold uppercase tracking-[.08em] text-muted">{c.title}</h4>
              <ul className="flex flex-col gap-2.5 text-[14.5px]">
                {c.links.map((l) => (
                  <li key={l.label}><Link to={l.to} className="hover:text-accent">{l.label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap justify-between gap-x-6 gap-y-2.5 border-t border-border pt-6 text-[12.5px] text-faint">
          <span>© 2026 Moonlit</span>
          <span>Artwork and metadata courtesy of The Movie Database (TMDB). Moonlit is not endorsed or certified by TMDB.</span>
        </div>
      </div>
    </footer>
  );
}
