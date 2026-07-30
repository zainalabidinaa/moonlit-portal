import type { ReactNode } from 'react';
import { Reveal } from './Reveal';
import { AppWindow } from './AppWindow';
import { AppMock } from './AppMock';
import { PlayerDemo } from './PlayerDemo';
import { SourcesDemo } from './SourcesDemo';

interface FeatureRowProps {
  eyebrow: string;
  title: ReactNode;
  body: string;
  points: string[];
  visual: ReactNode;
  /** Put the visual on the left instead of the right. */
  flip?: boolean;
}

function FeatureRow({ eyebrow, title, body, points, visual, flip }: FeatureRowProps) {
  return (
    <div className="grid items-center gap-6 lg:grid-cols-2 lg:gap-16">
      <Reveal from={flip ? 'right' : 'left'} className={flip ? 'lg:order-2' : ''}>
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.28em] text-accent">{eyebrow}</p>
        <h3 className="font-display text-[clamp(28px,4vw,48px)] font-extrabold uppercase leading-[1.04]">{title}</h3>
        <p className="mt-4 max-w-md text-[16px] text-muted">{body}</p>
        <ul className="mt-6 flex flex-col gap-2.5">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-2.5 text-sm text-muted">
              <span className="mt-0.5 text-accent">✓</span>
              {p}
            </li>
          ))}
        </ul>
      </Reveal>

      <Reveal from={flip ? 'left' : 'right'} delay={80} className={flip ? 'lg:order-1' : ''}>
        {visual}
      </Reveal>
    </div>
  );
}

export function FeatureShowcase() {
  return (
    <section id="features" className="mx-auto max-w-7xl px-5 py-16 md:py-24">
      <Reveal className="mx-auto mb-14 md:mb-20 max-w-2xl text-center">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.28em] text-accent">What you get</p>
        <h2 className="font-display text-[clamp(34px,5.5vw,68px)] font-extrabold uppercase leading-[1.02]">
          A player that shows off
        </h2>
        <p className="mt-4 text-[16px] text-muted">
          An interface built for the couch — cinematic, fast, and the same
          everywhere you sign in.
        </p>
      </Reveal>

      <div className="flex flex-col gap-16 md:gap-28">
        <FeatureRow
          eyebrow="Plays everything"
          title={<>Every format,<br />on the first try.</>}
          body="An MPV-grade playback core handles the demanding stuff most web players choke on — decoded natively, no transcoding, no stutter."
          points={[
            '4K UHD with Dolby Vision & HDR10+',
            'HEVC and AV1 hardware-decoded',
            'Atmos, TrueHD & DTS-HD passthrough',
            'Embedded and external subtitle tracks',
          ]}
          visual={<PlayerDemo />}
        />

        <FeatureRow
          flip
          eyebrow="Cinematic by default"
          title={<>A home screen<br />worth opening.</>}
          body="Curated hero art, franchise stacks and continue-watching rows — your household's own private front page, not an endless algorithmic scroll."
          points={[
            'Hand-tuned artwork on every collection',
            'Continue watching across all your devices',
            'Up to six profiles, each with its own library',
            'Zero ads, ever',
          ]}
          visual={<AppWindow float><AppMock /></AppWindow>}
        />

        <FeatureRow
          eyebrow="Every source, ranked"
          title={<>The best stream,<br />picked for you.</>}
          body="Moonlit filters out the junk before it ranks what's left, then selects the top result by default — so you press play, not detective."
          points={[
            'Cam rips, dead links & wrong episodes removed',
            'Ranked by quality, codec and health',
            'Top pick auto-selected — override anytime',
            'Already have your own sources? Bring them along too',
          ]}
          visual={<SourcesDemo />}
        />
      </div>
    </section>
  );
}
