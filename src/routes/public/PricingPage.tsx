import { Link } from 'react-router-dom';
import { Navbar } from '../../components/layout/Navbar';
import { Footer } from '../../components/layout/Footer';
import { PlansGrid } from '../../components/landing/PlansGrid';
import { SectionHead } from '../../components/landing/SectionHead';
import { Reveal } from '../../components/landing/Reveal';
import { useAuth } from '../../context/AuthContext';
import { COMPARISON } from '../../lib/plans';

const faqs = [
  { q: 'Can I change plans later?', a: 'Yes. Upgrade or downgrade from Billing at any time. The change applies on your next billing date.' },
  { q: 'What happens when I cancel?', a: 'Your profiles and library stay until the end of the paid period. Nothing is deleted on the day you cancel.' },
  { q: 'What does an invite code do?', a: 'A Moonlit admin can invite friends and family onto their household catalog at no cost. You get up to four profiles without a subscription.' },
  { q: 'Do I need my own sources?', a: 'No. The catalog and stream ranking are managed for you on every plan. Studio lets power users add their own sources on top.' },
];

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="border-t border-border">
      {items.map((f, i) => (
        <details key={f.q} open={i === 0} className="group border-b border-border">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-5 text-[17px] font-semibold tracking-tight [&::-webkit-details-marker]:hidden">
            {f.q}
            <span className="mr-1 h-2.5 w-2.5 flex-none rotate-45 border-b-[1.5px] border-r-[1.5px] border-muted transition-transform duration-300 group-open:-rotate-[135deg]" />
          </summary>
          <p className="max-w-[44em] pb-5 text-muted">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

export default function PricingPage() {
  const { role } = useAuth();

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />

      <div className="mx-auto max-w-[1240px] px-5 pb-24 pt-[calc(var(--nav-h)+72px)] md:px-8 md:pt-[calc(var(--nav-h)+110px)]">
        <div className="mx-auto mb-14 grid max-w-[680px] justify-items-center gap-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[.12em] text-accent">Pricing</p>
          <h1 className="text-[clamp(40px,6vw,72px)] font-semibold leading-[1.05]">Simple, honest pricing.</h1>
          <p className="max-w-[36em] text-lg text-muted">Pick the plan that fits how you watch. Every plan includes the full curated catalog and every device.</p>
        </div>

        <PlansGrid currentRole={role} />
        <p className="mt-[18px] text-center text-[13px] text-faint">Prices in USD, billed monthly through Stripe. Streams are simultaneous streams per account.</p>

        <div className="mt-[72px]">
          <Reveal className="mb-9"><SectionHead kicker="Compare" title="What's in each plan." /></Reveal>
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface px-3 py-1.5">
            <table className="w-full min-w-[640px] border-collapse text-[14.5px]">
              <thead>
                <tr>
                  <th className="border-b border-border px-3 py-3.5" />
                  {['Friends & Family', 'Spotlight', 'Studio'].map((h, i) => (
                    <th key={h} className={`w-1/5 border-b border-border px-3 py-3.5 text-center text-[13px] font-semibold uppercase tracking-[.04em] text-muted ${i === 1 ? 'bg-accent/[.06]' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.label}>
                    <td className="border-b border-border px-3 py-3.5 font-medium">{row.label}</td>
                    {row.values.map((v, i) => (
                      <td key={i} className={`border-b border-border px-3 py-3.5 text-center ${v === '✓' ? 'font-semibold text-accent' : 'text-muted'} ${i === 1 ? 'bg-accent/[.06]' : ''}`}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-[72px] grid gap-10 lg:grid-cols-[1fr_1.5fr] lg:gap-[72px]">
          <Reveal>
            <SectionHead
              kicker="Questions"
              title="Before you subscribe."
              lede={<>Anything else, ask us on the <Link to="/support" className="text-accent">Support page</Link>.</>}
            />
          </Reveal>
          <Faq items={faqs} />
        </div>
      </div>

      <Footer />
    </div>
  );
}
