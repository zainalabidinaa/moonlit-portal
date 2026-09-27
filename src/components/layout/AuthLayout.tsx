import type { ReactNode } from 'react';
import { Navbar } from './Navbar';
import { useTrending, posterUrl } from '../../hooks/useTrending';

interface AuthLayoutProps {
  children: ReactNode;
  quote: string;
  attribution: string;
}

/**
 * Split layout for sign in and sign up: the form on the left, a slowly
 * drifting wall of poster art on the right (desktop only).
 */
export function AuthLayout({ children, quote, attribution }: AuthLayoutProps) {
  const trending = useTrending();
  const posters = trending.map((t) => posterUrl(t)).filter((s): s is string => !!s);
  const cols = posters.length >= 5
    ? Array.from({ length: 5 }, (_, c) => Array.from({ length: 6 }, (_, i) => posters[(c * 7 + i * 3) % posters.length]))
    : [];

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <div className="grid min-h-screen lg:grid-cols-2">
        <div className="grid content-center px-5 pb-12 pt-[calc(var(--nav-h)+48px)] md:px-8">
          <div className="mx-auto grid w-full max-w-[420px] gap-[22px]">{children}</div>
        </div>
        <div className="relative hidden overflow-hidden bg-black lg:block" aria-hidden="true">
          {cols.length > 0 && (
            <div className="absolute -inset-x-[5%] -inset-y-[10%] grid rotate-[-8deg] scale-[1.08] grid-cols-5 gap-2.5">
              {cols.map((col, c) => (
                <div key={c} className={`flex flex-col gap-2.5 ${c % 2 ? 'animate-wall-rev' : 'animate-wall'}`}>
                  {[...col, ...col].map((src, i) => (
                    <img key={i} src={src} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-lg object-cover opacity-85" />
                  ))}
                </div>
              ))}
            </div>
          )}
          <div className="absolute inset-0 bg-[linear-gradient(90deg,#08080a,rgba(8,8,10,.2)_30%,rgba(8,8,10,.35))]" />
          <div className="absolute inset-x-10 bottom-10 max-w-[26em]">
            <strong className="block text-[26px] font-semibold leading-[1.15] tracking-tight">{quote}</strong>
            <small className="mt-2.5 block text-sm text-muted">{attribution}</small>
          </div>
        </div>
      </div>
    </div>
  );
}
