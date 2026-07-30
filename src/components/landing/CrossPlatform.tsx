import { Reveal } from './Reveal';

/** A compact phone mockup showing the Moonlit app on iOS. */
function PhoneFrame() {
  const posters = [
    'linear-gradient(160deg,#5a2d16,#241009)',
    'linear-gradient(160deg,#2c3340,#12161c)',
    'linear-gradient(160deg,#4a2033,#1c0d15)',
    'linear-gradient(160deg,#463019,#1e140a)',
    'linear-gradient(160deg,#3d2440,#170d18)',
    'linear-gradient(160deg,#2f3d2a,#141a10)',
  ];
  return (
    <div className="animate-float relative w-[150px] md:w-[190px] rounded-[2.2rem] border border-border-strong bg-black p-2 shadow-2xl">
      <div className="overflow-hidden rounded-[1.7rem] bg-bg">
        {/* notch */}
        <div className="relative h-6 bg-bg">
          <div className="absolute left-1/2 top-1.5 h-4 w-20 -translate-x-1/2 rounded-full bg-black" />
        </div>
        {/* hero */}
        <div className="relative h-28">
          <div className="absolute inset-0" style={{ background: 'linear-gradient(140deg,#5a2d16,#241009)' }} />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 80% 0%, rgba(250,130,77,.4), transparent 55%), linear-gradient(0deg,#0d0604,transparent 65%)' }} />
          <div className="absolute bottom-2 left-3 right-3">
            <div className="font-display text-sm font-extrabold uppercase leading-none">Midnight Reel</div>
            <div className="mt-1 flex gap-1">
              <span className="rounded bg-accent px-1 py-0.5 font-mono text-[7px] font-bold text-[#2a1206]">4K</span>
              <span className="rounded border border-border bg-surface px-1 py-0.5 font-mono text-[7px] text-faint">HDR</span>
            </div>
          </div>
        </div>
        {/* rows */}
        <div className="space-y-2 p-3">
          {[0, 1].map((row) => (
            <div key={row} className="flex gap-1.5 overflow-hidden">
              {posters.map((g, i) => (
                <div key={i} className="aspect-[2/3] w-9 flex-none rounded" style={{ background: g }} />
              ))}
            </div>
          ))}
        </div>
        {/* tab bar */}
        <div className="flex items-center justify-around border-t border-border py-2">
          {['Home', 'Live', 'Search', 'You'].map((t, i) => (
            <span key={t} className={`font-mono text-[7px] ${i === 0 ? 'text-accent' : 'text-faint'}`}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

const platforms = [
  { name: 'Web', tag: 'trymoonlit.app', note: 'Nothing to install — sign in and play.' },
  { name: 'iOS', tag: 'iPhone & iPad', note: 'Native app with the MPV playback engine.' },
  { name: 'Mac', tag: 'Apple silicon', note: 'Desktop app with Live TV & IPTV built in.' },
];

export function CrossPlatform() {
  return (
    <section className="relative overflow-hidden border-y border-border bg-bg2 py-16 md:py-24">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(900px 400px at 50% 0%, rgba(250,130,77,.08), transparent 60%)' }}
      />
      <div className="mx-auto max-w-7xl px-5">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.28em] text-accent">One account, every screen</p>
          <h2 className="font-display text-[clamp(34px,5.5vw,68px)] font-extrabold uppercase leading-[1.02]">
            Moonlit everywhere
          </h2>
          <p className="mt-4 text-[16px] text-muted">
            Start on the couch, finish on the train. Your profiles, library and continue-watching
            follow you across web, iPhone and Mac.
          </p>
        </Reveal>

        <Reveal delay={100} className="mt-16 flex justify-center">
          <PhoneFrame />
        </Reveal>

        <div className="mx-auto mt-16 grid max-w-4xl gap-4 md:grid-cols-3">
          {platforms.map((p, i) => (
            <Reveal key={p.name} delay={i * 90}>
              <div className="h-full rounded-2xl border border-border bg-surface p-5 md:p-6 text-center">
                <div className="font-display text-2xl font-extrabold uppercase text-accent">{p.name}</div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-faint">{p.tag}</div>
                <p className="mt-3 text-sm text-muted">{p.note}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
