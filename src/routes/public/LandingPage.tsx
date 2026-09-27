import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Navbar } from '../../components/layout/Navbar';
import { Footer } from '../../components/layout/Footer';
import { Reveal } from '../../components/landing/Reveal';
import { SectionHead } from '../../components/landing/SectionHead';
import { PosterRails, type RailPoster } from '../../components/landing/PosterRails';
import { FeatureBento } from '../../components/landing/FeatureBento';
import { CollectionsShowcase } from '../../components/landing/CollectionsShowcase';
import { Devices } from '../../components/landing/Devices';
import { PlansGrid } from '../../components/landing/PlansGrid';
import { CtaBand } from '../../components/landing/CtaBand';
import { AppleIcon, CheckIcon, GlobeIcon, PhoneIcon, TvIcon, WindowsIcon } from '../../components/landing/PlatformIcons';
import { useTrending, posterUrl, backdropUrl } from '../../hooks/useTrending';
import { useCollectionPreviews, type CollectionPreview } from '../../hooks/useCollectionPreviews';
import { PLANS } from '../../lib/plans';

const heroMeta = [`From ${PLANS[1].price} a month`, 'No ads, cancel anytime', 'Up to 4 profiles'];

/** "Tonight's collection": rotates through the real collections every 7s. */
function TonightCard({ collections, posters }: { collections: CollectionPreview[]; posters: string[] }) {
  const picks = useMemo(() => collections.slice(0, 6), [collections]);
  const [i, setI] = useState(0);
  const [swap, setSwap] = useState(false);

  useEffect(() => {
    if (picks.length < 2 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => {
      setSwap(true);
      setTimeout(() => { setI((n) => (n + 1) % picks.length); setSwap(false); }, 450);
    }, 7000);
    return () => clearInterval(id);
  }, [picks.length]);

  const c = picks[i];
  if (!c || posters.length < 3) return null;
  // Decorative stack of real TMDB posters; the collection name is the real one.
  const art = [0, 1, 2].map((j) => posters[(i * 3 + j) % posters.length]);
  const groups = c.folders.length;

  return (
    <Link
      to="/catalog"
      className="mt-7 grid w-full max-w-[460px] grid-cols-[auto_1fr] items-center gap-3.5 rounded-[14px] border border-border-strong bg-[rgba(14,14,17,.62)] py-3 pl-3 pr-4 text-left backdrop-blur-xl"
    >
      <div className="relative h-[58px] w-[74px] flex-none">
        {art.map((src, j) => (
          <img
            key={`${i}-${j}`}
            src={src}
            alt=""
            className={`absolute bottom-0 aspect-[2/3] w-[38px] rounded-[5px] object-cover shadow-[0_8px_20px_-8px_rgba(0,0,0,1),0_0_0_1px_rgba(255,255,255,.1)] transition-opacity duration-500 ${swap ? 'opacity-0' : 'opacity-100'} ${
              j === 0 ? 'left-0 -rotate-[8deg]' : j === 1 ? 'left-[18px] bottom-1 z-10' : 'left-9 rotate-[8deg]'
            }`}
          />
        ))}
      </div>
      <div className={`transition-opacity duration-500 ${swap ? 'opacity-0' : 'opacity-100'}`}>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.1em] text-muted">
          <i className="animate-ping-soft h-1.5 w-1.5 rounded-full bg-accent" />
          Tonight's collection
        </div>
        <div className="mt-0.5 truncate text-base font-semibold tracking-tight">{c.name}</div>
        <div className="text-[13px] text-muted">{groups > 1 ? `${groups} groups · curated weekly` : 'Curated · updated weekly'}</div>
      </div>
    </Link>
  );
}

const strip = [
  { icon: <AppleIcon className="h-[18px] w-[18px]" />, label: 'Mac' },
  { icon: <PhoneIcon className="h-[18px] w-[18px]" />, label: 'iPhone & iPad' },
  { icon: <GlobeIcon className="h-[18px] w-[18px]" />, label: 'Web' },
  { icon: <TvIcon className="h-[18px] w-[18px]" />, label: 'Apple TV', soon: true },
  { icon: <WindowsIcon className="h-[18px] w-[18px]" />, label: 'Windows', soon: true },
];

export default function LandingPage() {
  const { session } = useAuth();
  const trending = useTrending();
  const { collections } = useCollectionPreviews();

  // Real TMDB posters only. Folder and collection covers are admin widget
  // art (genre tiles with text baked in, landscape crops), so they never go
  // into anything presented as a poster.
  const posters = useMemo(() => trending.map((t) => posterUrl(t)).filter((s): s is string => !!s), [trending]);
  const rail: RailPoster[] = useMemo(
    () => trending
      .filter((t) => t.poster_path)
      .map((t) => ({ key: `t-${t.media_type}-${t.id}`, src: posterUrl(t) as string, title: t.title, sub: t.media_type === 'tv' ? 'Series' : 'Film' })),
    [trending]
  );

  // Landscape stills for the player and continue-watching mockups, also TMDB.
  const stills = useMemo(
    () => trending.map((t) => ({ t, src: backdropUrl(t) })).filter((x): x is { t: typeof trending[number]; src: string } => !!x.src),
    [trending]
  );
  const continueArt = stills.slice(1, 4).map(({ t, src }, i) => ({
    src,
    title: t.title,
    sub: t.media_type === 'tv' ? ['S2 E4 · 31 min left', 'S1 E6 · 39 min left', 'S3 E1 · 18 min left'][i] : ['1:12:40 left', '48 min left', '1:31:05 left'][i],
    pct: [42, 61, 55][i],
    device: ['MAC', 'IPHONE', 'WEB'][i],
  }));
  const curatedArt = posters.length > 8 ? posters.slice(-8) : posters.slice(0, 8);

  return (
    <div className="min-h-screen bg-bg">
      <Navbar transparent />

      {/* HERO: copy left, the real Mac app on the right */}
      <section className="relative overflow-hidden pb-12 pt-[calc(var(--nav-h)+56px)]">
        <div className="mx-auto grid max-w-[1240px] items-center gap-10 px-5 md:px-8 lg:grid-cols-[.9fr_1.1fr] lg:gap-14 lg:py-6">
          <div className="intro">
            <p className="text-xs font-semibold uppercase tracking-[.12em] text-accent">Curated streaming for the whole household</p>
            <h1 className="mt-3.5 max-w-[12em] text-[clamp(32px,4.4vw,56px)] font-semibold leading-[1.04] tracking-[-0.035em]">
              Your own streaming service, already set up.
            </h1>
            <p className="mt-[18px] max-w-[34em] text-[17px] leading-relaxed text-[#d0d0d6]">
              Collections picked by people, real 4K playback, and a profile for everyone at home. Open Moonlit on Mac, iPhone or the web and press play.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to={session ? '/profiles' : '/signup'} className="group inline-flex h-[54px] items-center gap-2 rounded-full bg-text px-7 text-base font-semibold text-[#0a0a0c] transition-[transform,box-shadow] hover:-translate-y-px hover:bg-white hover:shadow-[0_10px_40px_-10px_rgba(255,255,255,.35)]">
                {session ? 'Open Moonlit' : 'Start watching'}
                <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
              </Link>
              <Link to="/catalog" className="inline-flex h-[54px] items-center rounded-full border border-border-strong bg-white/[.06] px-7 text-base font-semibold backdrop-blur transition-[transform,background] hover:-translate-y-px hover:bg-white/10">
                Browse the catalog
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-[22px] gap-y-2 text-sm font-medium text-muted">
              {heroMeta.map((m) => (
                <span key={m} className="inline-flex items-center gap-2"><CheckIcon className="h-4 w-4 text-accent" />{m}</span>
              ))}
            </div>
            <TonightCard collections={collections} posters={posters} />
          </div>

          <div className="intro relative min-w-0 lg:-mr-[6%]">
            <div className="pointer-events-none absolute -inset-x-[10%] -inset-y-[20%]" aria-hidden="true">
              <img src="/screenshots/mac-home.webp" alt="" className="h-full w-full object-cover opacity-55 blur-[90px] saturate-[1.6]" />
            </div>
            <img
              src="/screenshots/mac-home.webp"
              alt="Moonlit for Mac: the Home screen with a featured title and a Continue Watching row"
              width="1500"
              height="904"
              fetchPriority="high"
              className="relative w-full rounded-[14px] shadow-window"
            />
          </div>
        </div>
      </section>

      {/* PLATFORM STRIP */}
      <div className="border-y border-border bg-bg">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-x-7 gap-y-3 px-5 py-[18px] text-sm font-medium text-muted md:px-8">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {strip.map((p) => (
              <span key={p.label} className="inline-flex items-center gap-2">
                {p.icon}{p.label}
                {p.soon && <em className="rounded border border-border-strong px-1.5 py-0.5 font-mono text-[10px] not-italic text-faint">soon</em>}
              </span>
            ))}
          </div>
          <span>One account. Same library on every screen.</span>
        </div>
      </div>

      <PosterRails posters={rail} caption="A slice of what is on Moonlit this week. Artwork courtesy of TMDB." />

      <FeatureBento
        playerBackdrop={stills[0]?.src}
        playerTitle={stills[0]?.t.title}
        continueArt={continueArt}
        curatedArt={curatedArt}
      />

      <CollectionsShowcase collections={collections} posters={posters} />

      <Devices />

      {/* PRICING SUMMARY */}
      <section className="py-20 md:py-[120px]">
        <div className="mx-auto max-w-[1240px] px-5 md:px-8">
          <Reveal className="mb-11">
            <SectionHead
              center
              kicker="Pricing"
              title="Two plans and an invite."
              lede="Every plan includes the full curated catalog and every device. Cancel any time from Billing."
            />
          </Reveal>
          <PlansGrid />
          <p className="mt-[18px] text-center text-[13px] text-faint">
            Prices in USD. Streams are simultaneous streams per account.{' '}
            <Link to="/pricing" className="text-accent">Compare plans in detail →</Link>
          </p>
        </div>
      </section>

      <CtaBand posters={posters.length > 12 ? posters.slice(6, 11) : posters.slice(0, 5)} signedIn={!!session} />

      <Footer />
    </div>
  );
}
