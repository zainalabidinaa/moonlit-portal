import { Link } from 'react-router-dom';
import { Reveal } from './Reveal';
import { SectionHead } from './SectionHead';
import { AppleIcon, GlobeIcon, PhoneIcon, StatusPill, TvIcon, WindowsIcon } from './PlatformIcons';
import { MAC_VERSION } from '../../lib/releases';

const rows = [
  { icon: <AppleIcon className="h-[22px] w-[22px]" />, name: 'Mac', note: 'Native app, Apple silicon and Intel. Live TV and IPTV built in.', status: `v${MAC_VERSION}`, now: true },
  { icon: <PhoneIcon className="h-[22px] w-[22px]" />, name: 'iPhone and iPad', note: 'Native playback engine, downloads and AirPlay.', status: 'TestFlight', now: true },
  { icon: <GlobeIcon className="h-[22px] w-[22px]" />, name: 'Web', note: 'Nothing to install. Sign in and play.', status: 'Live', now: true },
  { icon: <TvIcon className="h-[22px] w-[22px]" />, name: 'Apple TV', note: 'Built for the remote.', status: 'Coming', now: false },
  { icon: <WindowsIcon className="h-[22px] w-[22px]" />, name: 'Windows', note: 'Hardware-accelerated playback.', status: 'Coming', now: false },
];

/**
 * Device list beside the real Mac screenshot. The still is shown in a
 * window with an ambient glow sampled from the image itself.
 */
export function Devices() {
  return (
    <section className="relative overflow-hidden border-y border-border bg-bg2 py-20 md:py-[120px]">
      <div className="mx-auto grid max-w-[1240px] items-center gap-12 px-5 md:px-8 lg:grid-cols-[.9fr_1.1fr] lg:gap-16">
        <Reveal>
          <SectionHead
            kicker="One account, every screen"
            title="Start on the couch. Finish on the train."
            lede="Native apps where playback matters, the browser everywhere else. Your library follows you."
            className="mb-11"
          />
          <div className="border-t border-border">
            {rows.map((r) => (
              <div key={r.name} className="grid grid-cols-[28px_1fr_auto] items-center gap-x-3.5 gap-y-1.5 border-b border-border py-4">
                <span className="row-span-2 text-text">{r.icon}</span>
                <strong className="text-base font-semibold">{r.name}</strong>
                <span className="row-span-2"><StatusPill now={r.now}>{r.status}</StatusPill></span>
                <p className="col-start-2 text-sm text-muted">{r.note}</p>
              </div>
            ))}
          </div>
          <Link to="/download" className="mt-6 inline-flex items-center gap-2 text-[15px] font-semibold text-accent">
            Downloads and release notes <span aria-hidden="true">→</span>
          </Link>
        </Reveal>

        <Reveal delay={120} className="relative min-w-0">
          <div className="pointer-events-none absolute -inset-x-[10%] -inset-y-[20%]" aria-hidden="true">
            <img src="/screenshots/mac-home.webp" alt="" className="h-full w-full object-cover opacity-50 blur-[90px] saturate-150" />
          </div>
          <img
            src="/screenshots/mac-home.webp"
            alt="Moonlit for Mac: the Home screen with a featured title and a Continue Watching row"
            width="1500"
            height="904"
            className="relative w-full rounded-[14px] shadow-window"
          />
        </Reveal>
      </div>
    </section>
  );
}
