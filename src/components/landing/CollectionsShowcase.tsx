import { Link } from 'react-router-dom';
import { Reveal } from './Reveal';
import { SectionHead } from './SectionHead';
import { collectionCover, folderArt, type CollectionPreview } from '../../hooks/useCollectionPreviews';

function ShowcaseCard({ c, delay }: { c: CollectionPreview; delay: number }) {
  const cover = collectionCover(c);
  const fan = folderArt(c, 4);
  const count = c.folders.length;
  return (
    <Reveal delay={delay}>
      <Link
        to="/catalog"
        className="group relative block aspect-[4/5] overflow-hidden rounded-3xl border border-border bg-surface-2 md:aspect-[3/4]"
      >
        {cover && (
          <img src={cover} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.06]" />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(8,8,10,.96)_0%,rgba(8,8,10,.55)_45%,rgba(8,8,10,.1)_100%)]" />
        {fan.length > 1 && (
          <div className="absolute inset-x-[22px] bottom-[112px] flex">
            {fan.map((src, i) => (
              <img
                key={src}
                src={src}
                alt=""
                loading="lazy"
                className={`-mr-3.5 aspect-[2/3] w-[58px] origin-bottom-left rounded-md object-cover shadow-[0_10px_30px_-10px_rgba(0,0,0,1),0_0_0_1px_rgba(255,255,255,.1)] transition-transform duration-500 ease-out ${
                  i === 0 ? 'group-hover:-translate-x-1.5 group-hover:translate-y-0.5 group-hover:-rotate-[8deg]' :
                  i === 2 ? 'group-hover:translate-x-2.5 group-hover:translate-y-0.5 group-hover:rotate-[6deg]' :
                  i === 3 ? 'group-hover:translate-x-5 group-hover:translate-y-1.5 group-hover:rotate-[12deg]' : ''
                }`}
              />
            ))}
          </div>
        )}
        <div className="absolute inset-x-[22px] bottom-[22px]">
          <p className="text-xs font-semibold uppercase tracking-[.12em] text-muted">
            {count > 1 ? `${count} groups` : 'Collection'}
          </p>
          <strong className="mt-1.5 block text-[26px] font-semibold leading-[1.05] tracking-tight">{c.name}</strong>
          <small className="mt-2 block text-[13px] text-muted">
            {count > 1 ? c.folders.slice(0, 3).map((f) => f.name).join(' · ') : 'Curated · updated weekly'}
          </small>
        </div>
      </Link>
    </Reveal>
  );
}

export function CollectionsShowcase({ collections }: { collections: CollectionPreview[] }) {
  const picks = collections.filter((c) => collectionCover(c)).slice(0, 3);
  if (picks.length === 0) return null;
  return (
    <section className="pb-20 md:pb-[120px]">
      <div className="mx-auto max-w-[1240px] px-5 md:px-8">
        <Reveal className="mb-9 flex flex-wrap items-end justify-between gap-5">
          <SectionHead
            kicker="The catalog"
            title="Collections, not an infinite scroll."
            lede="Open one and start at the top. Updated by the curators every week."
          />
          <Link to="/catalog" className="inline-flex h-[46px] items-center gap-2 rounded-full border border-border-strong bg-white/[.06] px-5 text-[15px] font-semibold hover:bg-white/10">
            All collections <span aria-hidden="true">→</span>
          </Link>
        </Reveal>
        <div className="grid gap-3.5 md:grid-cols-3">
          {picks.map((c, i) => <ShowcaseCard key={c.id} c={c} delay={i * 90} />)}
        </div>
      </div>
    </section>
  );
}
