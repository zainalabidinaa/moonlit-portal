import { Reveal } from './Reveal';

const steps = [
  {
    n: '01',
    title: 'Sign up',
    body: 'Pick a plan, or use an invite code if someone already has Moonlit.',
  },
  {
    n: '02',
    title: 'Open the app',
    body: 'iOS, Mac, or right here in the browser — everything is already set up for you.',
  },
  {
    n: '03',
    title: 'Press play',
    body: 'Browse the curated collections and start watching. No configuration required.',
  },
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-24">
      <Reveal className="mx-auto mb-16 max-w-2xl text-center">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.28em] text-accent">
          Getting started
        </p>
        <h2 className="font-display text-[clamp(32px,5vw,60px)] font-extrabold uppercase">
          Three steps, that's it
        </h2>
      </Reveal>

      <div className="grid gap-8 md:grid-cols-3">
        {steps.map((s, i) => (
          <Reveal key={s.n} delay={i * 90}>
            <div className="rounded-2xl border border-border bg-surface p-7 text-center">
              <div
                className="font-display text-4xl font-extrabold text-accent"
                style={{ textShadow: '0 0 30px var(--accent-glow)' }}
              >
                {s.n}
              </div>
              <h3 className="mt-3 font-display text-xl font-extrabold uppercase">{s.title}</h3>
              <p className="mt-2 text-sm text-muted">{s.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
