import { useNavigate } from 'react-router-dom';
import { Navbar } from '../../components/layout/Navbar';
import { Button } from '../../components/ui/Button';
import { Reveal } from '../../components/landing/Reveal';

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08ZM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25Z" />
    </svg>
  );
}

/**
 * SF Symbol `appletv`, rendered from the system symbol set to
 * `public/appletv.png` (same approach the app uses in `public/sf-symbols/`).
 * Drawn as a mask so it picks up `currentColor` like the inline-SVG icons.
 */
function AppleTvIcon() {
  const mask = {
    WebkitMaskImage: 'url(/appletv.png)',
    maskImage: 'url(/appletv.png)',
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
  } as const;
  return <span aria-hidden="true" className="block h-7 w-7 bg-current" style={mask} />;
}

function WindowsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7">
      <path d="M3 5.5 10.2 4.5v6.9H3V5.5Zm0 13 7.2 1v-6.8H3v5.8Zm8.4 1.2L21 21V12.6h-9.6v7.1Zm0-15.4v7.1H21V3l-9.6 1.3Z" />
    </svg>
  );
}

const platforms = [
  {
    name: 'macOS',
    sub: 'Apple silicon & Intel',
    note: 'Native desktop app with Live TV and IPTV built in.',
    icon: <AppleIcon />,
    downloadUrl: '/downloads/Moonlit-1.0.0.dmg',
    version: '1.0.0',
  },
  {
    name: 'iOS',
    sub: 'iPhone & iPad',
    note: 'Native playback engine, downloads and AirPlay. Public beta via TestFlight.',
    icon: <AppleIcon />,
    testflightUrl: 'https://testflight.apple.com/join/9HSBA4vz',
  },
  { name: 'Apple TV', sub: 'tvOS', note: 'The big-screen Moonlit, built for the remote.', icon: <AppleTvIcon /> },
  { name: 'Windows', sub: 'Windows 10 & 11', note: 'Desktop app with hardware-accelerated playback.', icon: <WindowsIcon /> },
];

export default function DownloadPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />

      {/* HEADER */}
      <section className="mx-auto max-w-7xl px-5 pb-8 pt-16">
        <Reveal>
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.28em] text-accent">Downloads</p>
          <h1 className="font-display text-[clamp(40px,6vw,80px)] font-extrabold uppercase leading-[1.02]">
            Coming to<br />every screen.
          </h1>
          <p className="mt-5 max-w-xl text-[17px] text-muted">
            The native Moonlit apps are on the way — built for real playback, not a browser tab.
            Moonlit already runs in any modern browser while you wait.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button size="lg" className="rounded-full" onClick={() => navigate('/pricing')}>
              Get Moonlit →
            </Button>
            <Button variant="ghost" size="lg" className="rounded-full" onClick={() => navigate('/')}>
              See what's inside
            </Button>
          </div>
        </Reveal>
      </section>

      {/* PLATFORMS */}
      <section className="mx-auto max-w-7xl px-5 py-16">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {platforms.map((p, i) => (
            <Reveal key={p.name} delay={i * 80}>
              <div className="flex h-full flex-col rounded-2xl border border-border bg-surface p-7">
                <div className="text-accent">{p.icon}</div>

                <div className="mt-5 font-display text-2xl font-extrabold uppercase">{p.name}</div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-faint">{p.sub}</div>
                <p className="mt-3 flex-1 text-sm text-muted">{p.note}</p>

                <div className="mt-6">
                  {p.downloadUrl ? (
                    <a
                      href={p.downloadUrl}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest text-bg"
                    >
                      Download v{p.version}
                    </a>
                  ) : p.testflightUrl ? (
                    <a
                      href={p.testflightUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest text-bg"
                    >
                      Join the beta →
                    </a>
                  ) : (
                    <span className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border-strong bg-bg2 px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest text-faint">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent/70" />
                      Coming soon
                    </span>
                  )}
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={120}>
          <p className="mt-10 text-center font-mono text-xs text-faint">
            Sign up today and every app lands on the account you already have.
          </p>
        </Reveal>

        <Reveal delay={160}>
          <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-border bg-surface p-6 text-sm text-muted">
            <p className="font-display text-xs font-extrabold uppercase tracking-widest text-text">
              Installing on Mac
            </p>
            <ol className="mt-3 list-decimal space-y-1 pl-5">
              <li>Open the downloaded <span className="text-text">.dmg</span>.</li>
              <li>
                Drag <span className="text-text">MoonlitMac</span> onto the{' '}
                <span className="text-text">Applications</span> folder in the same window.
              </li>
              <li>
                Launch it from Applications. macOS asks once whether you're sure you want to open an
                app downloaded from the internet — click <span className="text-text">Open</span>.
              </li>
            </ol>
            <p className="mt-3">
              Moonlit is signed and notarized by Apple, so that's the only prompt you'll see.
            </p>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
