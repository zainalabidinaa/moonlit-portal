import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../../components/layout/Navbar';
import { Footer } from '../../components/layout/Footer';
import { Reveal } from '../../components/landing/Reveal';
import { SectionHead } from '../../components/landing/SectionHead';
import { AppleIcon, GlobeIcon, PhoneIcon, StatusPill, TvIcon, WindowsIcon } from '../../components/landing/PlatformIcons';
import { TvInstallGuide } from '../../components/download/TvInstallGuide';
import { MAC_MIN_OS, MAC_TESTFLIGHT_URL, TESTFLIGHT_URL, TV_DOWNLOAD_URL, TV_VERSION, WINDOWS_CERT_URL, WINDOWS_CHECKSUM_URL, WINDOWS_DOWNLOAD_URL, WINDOWS_VERSION, fetchReleaseNotes, type ReleaseNote } from '../../lib/releases';

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
          <h1 className="text-[clamp(40px,6vw,72px)] font-semibold leading-[1.05]">Axis on every screen.</h1>
          <p className="max-w-[36em] text-lg text-muted">
            Axis for Windows and Android TV is out now, and the Mac, iPhone and iPad betas are open on TestFlight. Apple TV is next. Axis also runs in any modern browser today.
          </p>
        </div>

        <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          <Card className="md:col-span-2 xl:col-span-3 md:grid md:grid-cols-[1fr_1.2fr] md:items-center md:gap-7 md:p-8">
            <div className="grid gap-3.5">
              <AppleIcon className={icon} />
              <span><StatusPill now>Public beta</StatusPill></span>
              <h3 className="text-[22px] font-semibold tracking-tight">Axis for Mac</h3>
              <p className="text-[14.5px] text-muted">The full Axis experience with native playback, Live TV and IPTV, automatic subtitle sync and Sign in with Apple.</p>
              <p className="text-[13px] text-faint">Requires {MAC_MIN_OS}. Apple silicon and Intel. Installed through TestFlight.</p>
              <div className="flex flex-wrap gap-2.5">
                <a href={MAC_TESTFLIGHT_URL} target="_blank" rel="noreferrer noopener" className="inline-flex h-[46px] items-center rounded-full bg-text px-5 text-[15px] font-semibold text-[#0a0a0c] hover:bg-white">Get it on TestFlight</a>
                <a href="#release-notes" className="inline-flex h-[46px] items-center rounded-full border border-border-strong bg-white/[.06] px-5 text-[15px] font-semibold hover:bg-white/10">Release notes</a>
              </div>
            </div>
            <img
              src="/screenshots/mac-home.webp"
              alt="Axis for Mac home screen"
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
            <p className="text-[14.5px] text-muted">Nothing to install. Sign in at tryaxis.io and play in Safari, Chrome or Edge.</p>
            <p className="text-[13px] text-faint">Best in a current browser with hardware video decoding.</p>
            <div className="mt-auto flex flex-wrap gap-2.5 pt-1">
              <Link to="/login" className="inline-flex h-[46px] items-center rounded-full border border-border-strong bg-white/[.06] px-5 text-[15px] font-semibold hover:bg-white/10">Open in the browser</Link>
            </div>
          </Card>

          <Card>
            <TvIcon className={icon} />
            <span><StatusPill>Coming soon</StatusPill></span>
            <h3 className="text-[22px] font-semibold tracking-tight">Apple TV</h3>
            <p className="text-[14.5px] text-muted">The big-screen Axis, built for the Siri Remote.</p>
            <p className="text-[13px] text-faint">tvOS. In development. Already have the TV app? <Link to="/activate" className="text-accent">Link it here</Link>.</p>
          </Card>

          <Card>
            <WindowsIcon className={icon} />
            <span><StatusPill now>Version {WINDOWS_VERSION}</StatusPill></span>
            <h3 className="text-[22px] font-semibold tracking-tight">Windows</h3>
            <p className="text-[14.5px] text-muted">Desktop app with hardware-accelerated playback, Live TV and downloads.</p>
            <p className="text-[13px] text-faint">Windows 10 and 11, 64-bit.</p>
            <div className="mt-auto flex flex-wrap gap-2.5 pt-1">
              <a href={WINDOWS_DOWNLOAD_URL} className="inline-flex h-[46px] items-center rounded-full bg-text px-5 text-[15px] font-semibold text-[#0a0a0c] hover:bg-white">Download for Windows</a>
            </div>
          </Card>

          <Card>
            <TvIcon className={icon} />
            <span><StatusPill now>Version {TV_VERSION} · Beta</StatusPill></span>
            <h3 className="text-[22px] font-semibold tracking-tight">Android TV</h3>
            <p className="text-[14.5px] text-muted">Built for the remote. Works on Google TV, Chromecast with Google TV, Fire TV and Nvidia Shield.</p>
            <p className="text-[13px] text-faint">Android 7 or later. About 79 MB. Installed from an APK.</p>
            <div className="mt-auto flex flex-wrap gap-2.5 pt-1">
              <a href={TV_DOWNLOAD_URL} className="inline-flex h-[46px] items-center rounded-full bg-text px-5 text-[15px] font-semibold text-[#0a0a0c] hover:bg-white">Download APK</a>
              <a href="#install-android-tv" className="inline-flex h-[46px] items-center rounded-full border border-border-strong bg-white/[.06] px-5 text-[15px] font-semibold hover:bg-white/10">How to install</a>
            </div>
          </Card>
        </div>

        <div id="release-notes" className="mt-14 grid gap-10 scroll-mt-24 lg:grid-cols-[1fr_1.5fr] lg:gap-[72px]">
          <Reveal>
            <SectionHead kicker="Release notes" title="What's new on Mac." lede="Axis for Mac updates through TestFlight. Here is what the last releases changed." />
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
                <li>Install <span className="text-text">TestFlight</span> from the Mac App Store if you do not have it.</li>
                <li>Open the invite with <span className="text-text">Get it on TestFlight</span> and click <span className="text-text">Accept</span>, then <span className="text-text">Install</span>.</li>
                <li>Open Axis from Applications. TestFlight keeps it up to date.</li>
              </ol>
              <p className="mt-2.5">Sign in with the same account you use everywhere else.</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface px-[22px] py-5 text-sm text-muted">
              <p className="font-semibold text-text">Installing on Windows</p>
              <ol className="mt-2.5 list-decimal space-y-1 pl-5">
                <li>Run the downloaded <span className="text-text">.exe</span>.</li>
                <li>Windows may say <span className="text-text">Windows protected your PC</span>. Click <span className="text-text">More info</span>, then <span className="text-text">Run anyway</span>.</li>
                <li>Follow the installer, then open Axis from the Start menu.</li>
              </ol>
              <p className="mt-2.5">
                That warning appears because the installer is signed with our own certificate rather than one Microsoft already recognises. To check your download, compare its SHA-256 checksum with{' '}
                <a className="text-accent" href={WINDOWS_CHECKSUM_URL}>the published one</a>. To make a PC you control trust the installer for good, install{' '}
                <a className="text-accent" href={WINDOWS_CERT_URL} download>our certificate</a> into <span className="text-text">Trusted Root Certification Authorities</span> and <span className="text-text">Trusted Publishers</span>.
              </p>
            </div>
            <TvInstallGuide />
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
