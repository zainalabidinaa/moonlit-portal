import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../../components/layout/Navbar';
import { Footer } from '../../components/layout/Footer';
import { Reveal } from '../../components/landing/Reveal';
import { SectionHead } from '../../components/landing/SectionHead';
import { AppleIcon, GlobeIcon, PhoneIcon, StatusPill, TvIcon, WindowsIcon } from '../../components/landing/PlatformIcons';
import { MAC_DOWNLOAD_URL, MAC_MIN_OS, MAC_VERSION, TESTFLIGHT_URL, fetchReleaseNotes, type ReleaseNote } from '../../lib/releases';

const icon = 'h-[30px] w-[30px]';

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-3.5 rounded-3xl border border-border bg-surface p-[26px] ${className}`}>{children}</div>;
}

export default function DownloadPage() {
  const [notes, setNotes] = useState<ReleaseNote[]>([]);
  useEffect(() => { fetchReleaseNotes(3).then(setNotes); }, []);

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />

      <div className="mx-auto max-w-[1240px] px-5 pb-24 pt-[calc(var(--nav-h)+72px)] md:px-8 md:pt-[calc(var(--nav-h)+110px)]">
        <div className="mb-14 grid max-w-[720px] gap-4">
          <p className="text-xs font-semibold uppercase tracking-[.12em] text-accent">Download</p>
          <h1 className="text-[clamp(40px,6vw,72px)] font-semibold leading-[1.05]">Moonlit on every screen.</h1>
          <p className="max-w-[36em] text-lg text-muted">
            Moonlit for Mac is out now and the iPhone and iPad beta is open on TestFlight. Apple TV and Windows are next. Moonlit also runs in any modern browser today.
          </p>
        </div>

        <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          <Card className="md:col-span-2 xl:col-span-3 md:grid md:grid-cols-[1fr_1.2fr] md:items-center md:gap-7 md:p-8">
            <div className="grid gap-3.5">
              <AppleIcon className={icon} />
              <span><StatusPill now>Version {MAC_VERSION}</StatusPill></span>
              <h3 className="text-[22px] font-semibold tracking-tight">Moonlit for Mac</h3>
              <p className="text-[14.5px] text-muted">The full Moonlit experience with native playback, Live TV and IPTV, automatic subtitle sync and Sign in with Apple.</p>
              <p className="text-[13px] text-faint">Requires {MAC_MIN_OS}. Apple silicon and Intel. About 57 MB.</p>
              <div className="flex flex-wrap gap-2.5">
                <a href={MAC_DOWNLOAD_URL} className="inline-flex h-[46px] items-center rounded-full bg-text px-5 text-[15px] font-semibold text-[#0a0a0c] hover:bg-white">Download for Mac</a>
                <a href="#release-notes" className="inline-flex h-[46px] items-center rounded-full border border-border-strong bg-white/[.06] px-5 text-[15px] font-semibold hover:bg-white/10">Release notes</a>
              </div>
            </div>
            <img
              src="/screenshots/mac-home.webp"
              alt="Moonlit for Mac home screen"
              width="1500"
              height="904"
              loading="lazy"
              className="mt-6 w-full rounded-[14px] shadow-window md:mt-0"
            />
          </Card>

          <Card>
            <PhoneIcon className={icon} />
            <span><StatusPill now>Public beta</StatusPill></span>
            <h3 className="text-[22px] font-semibold tracking-tight">iPhone and iPad</h3>
            <p className="text-[14.5px] text-muted">Native playback engine, downloads for the plane and AirPlay to the TV.</p>
            <p className="text-[13px] text-faint">Installed through TestFlight.</p>
            <div className="mt-auto flex flex-wrap gap-2.5 pt-1">
              <a href={TESTFLIGHT_URL} target="_blank" rel="noreferrer noopener" className="inline-flex h-[46px] items-center rounded-full bg-text px-5 text-[15px] font-semibold text-[#0a0a0c] hover:bg-white">Join the beta</a>
            </div>
          </Card>

          <Card>
            <GlobeIcon className={icon} />
            <span><StatusPill now>Available</StatusPill></span>
            <h3 className="text-[22px] font-semibold tracking-tight">Web</h3>
            <p className="text-[14.5px] text-muted">Nothing to install. Sign in at trymoonlit.app and play in Safari, Chrome or Edge.</p>
            <p className="text-[13px] text-faint">Best in a current browser with hardware video decoding.</p>
            <div className="mt-auto flex flex-wrap gap-2.5 pt-1">
              <Link to="/login" className="inline-flex h-[46px] items-center rounded-full border border-border-strong bg-white/[.06] px-5 text-[15px] font-semibold hover:bg-white/10">Open in the browser</Link>
            </div>
          </Card>

          <Card>
            <TvIcon className={icon} />
            <span><StatusPill>Coming soon</StatusPill></span>
            <h3 className="text-[22px] font-semibold tracking-tight">Apple TV</h3>
            <p className="text-[14.5px] text-muted">The big-screen Moonlit, built for the Siri Remote.</p>
            <p className="text-[13px] text-faint">tvOS. In development. Already have the TV app? <Link to="/activate" className="text-accent">Link it here</Link>.</p>
          </Card>

          <Card>
            <WindowsIcon className={icon} />
            <span><StatusPill>Coming soon</StatusPill></span>
            <h3 className="text-[22px] font-semibold tracking-tight">Windows</h3>
            <p className="text-[14.5px] text-muted">Desktop app with hardware-accelerated playback.</p>
            <p className="text-[13px] text-faint">Windows 10 and 11. In development.</p>
          </Card>
        </div>

        <div id="release-notes" className="mt-14 grid gap-10 scroll-mt-24 lg:grid-cols-[1fr_1.5fr] lg:gap-[72px]">
          <Reveal>
            <SectionHead kicker="Release notes" title="What's new on Mac." lede="Moonlit for Mac updates itself. Here is what the last releases changed." />
          </Reveal>
          <div className="grid gap-4">
            {notes.map((n) => (
              <div key={n.version} className="rounded-2xl border border-border bg-surface px-[22px] py-5">
                <div className="flex items-baseline justify-between gap-3 font-semibold">
                  Version {n.version}
                  <small className="font-mono text-xs font-normal text-faint">{n.date}</small>
                </div>
                <ul className="mt-2.5 grid list-disc gap-1.5 pl-[18px] text-[14.5px] text-muted">
                  {n.items.map((it) => <li key={it}>{it}</li>)}
                </ul>
              </div>
            ))}
            {notes.length === 0 && <p className="text-sm text-faint">Release notes load from the same feed the Mac app updates from.</p>}
            <div className="rounded-2xl border border-border bg-surface px-[22px] py-5 text-sm text-muted">
              <p className="font-semibold text-text">Installing on Mac</p>
              <ol className="mt-2.5 list-decimal space-y-1 pl-5">
                <li>Open the downloaded <span className="text-text">.dmg</span>.</li>
                <li>Drag <span className="text-text">Moonlit</span> onto the <span className="text-text">Applications</span> folder in the same window.</li>
                <li>Launch it from Applications. macOS asks once whether you want to open an app downloaded from the internet. Click <span className="text-text">Open</span>.</li>
              </ol>
              <p className="mt-2.5">Moonlit is signed and notarized by Apple, so that is the only prompt you will see.</p>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
