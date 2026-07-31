import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Navbar } from '../../components/layout/Navbar';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Reveal } from '../../components/landing/Reveal';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import type { SupportTopic } from '../../types';

/** Where the "email us directly" links point. Change here to reroute support mail. */
export const SUPPORT_EMAIL = 'hey@trymoonlit.app';

const topics: { value: SupportTopic; label: string }[] = [
  { value: 'general', label: 'General question' },
  { value: 'account', label: 'Account & profiles' },
  { value: 'billing', label: 'Billing & plans' },
  { value: 'playback', label: 'Playback & devices' },
  { value: 'bug', label: 'Report a bug' },
];

const faqs: { q: string; a: string; to?: string; cta?: string }[] = [
  {
    q: 'How do I sign in on my Apple TV?',
    a: 'Open Moonlit on the TV, note the six-character code it shows, then enter it on the activation page from any browser.',
    to: '/activate',
    cta: 'Link a device',
  },
  {
    q: 'Can I add profiles for the rest of the house?',
    a: 'Yes. Every account carries its own set of profiles, each with its own sources and PIN.',
    to: '/profiles',
    cta: 'Manage profiles',
  },
  {
    q: 'How do I change or cancel my plan?',
    a: 'Plans are managed from your billing page — switch tiers or cancel at any time and keep access until the period ends.',
    to: '/billing',
    cta: 'Open billing',
  },
  {
    q: 'Which devices can I watch on?',
    a: 'Moonlit runs in any modern browser today, with native macOS, iOS, Apple TV and Windows apps on the way.',
    to: '/download',
    cta: 'See downloads',
  },
];

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export default function SupportPage() {
  const navigate = useNavigate();
  const { session, activeProfile } = useAuth();

  const [name, setName] = useState(activeProfile?.name ?? '');
  const [email, setEmail] = useState(session?.user?.email ?? '');
  const [topic, setTopic] = useState<SupportTopic>('general');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string; message?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sent, setSent] = useState(false);

  function validate() {
    const next: typeof errors = {};
    if (!name.trim()) next.name = 'Tell us who you are.';
    if (!email.trim()) next.email = 'We need an address to reply to.';
    else if (!isValidEmail(email)) next.email = 'That email address does not look right.';
    if (message.trim().length < 10) next.message = 'Add a little more detail (at least 10 characters).';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSendError('');
    if (!validate()) return;

    setSubmitting(true);
    const { error } = await supabase.from('support_requests').insert({
      user_id: session?.user?.id ?? null,
      name: name.trim(),
      email: email.trim(),
      topic,
      message: message.trim(),
    });
    setSubmitting(false);

    if (error) {
      setSendError(`We could not send that. Email us at ${SUPPORT_EMAIL} and we will pick it up there.`);
      return;
    }
    setSent(true);
    setMessage('');
  }

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />

      {/* HEADER */}
      <section className="mx-auto max-w-7xl px-5 pb-8 pt-16">
        <Reveal>
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.28em] text-accent">Support</p>
          <h1 className="font-display text-[clamp(40px,6vw,80px)] font-extrabold uppercase leading-[1.02]">
            Stuck? Talk<br />to a human.
          </h1>
          <p className="mt-5 max-w-xl text-[17px] text-muted">
            Account trouble, a payment question, or something that simply will not play — send it over and
            we will get back to you by email, usually within a day.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-base font-semibold text-[#2a1206] shadow-glow transition-colors hover:bg-accent-2"
            >
              Email {SUPPORT_EMAIL}
            </a>
            <Button variant="ghost" size="lg" className="rounded-full" onClick={() => navigate('/download')}>
              Get the apps
            </Button>
          </div>
        </Reveal>
      </section>

      {/* CONTACT FORM + SIDEBAR */}
      <section className="mx-auto max-w-7xl px-5 py-10">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <Reveal>
            <div className="h-full rounded-2xl border border-border bg-surface p-7 md:p-9">
              <h2 className="font-display text-2xl font-extrabold uppercase">Send a message</h2>
              <p className="mt-2 text-sm text-muted">
                The more you can tell us — device, plan, what you were doing — the faster we can fix it.
              </p>

              {sent ? (
                <div className="mt-7 rounded-2xl border border-accent/40 bg-accent-light p-7 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/20">
                    <svg className="h-6 w-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="font-display text-xl font-extrabold uppercase">Message sent</h3>
                  <p className="mt-2 text-sm text-muted">
                    We have it. Look for a reply at <span className="text-text">{email}</span>.
                  </p>
                  <Button variant="ghost" className="mt-5 rounded-full" onClick={() => setSent(false)}>
                    Send another
                  </Button>
                </div>
              ) : (
                <form className="mt-7 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
                  <Input
                    id="support-name"
                    label="Your name"
                    placeholder="Ada Lovelace"
                    value={name}
                    error={errors.name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <Input
                    id="support-email"
                    type="email"
                    label="Email"
                    placeholder="you@example.com"
                    value={email}
                    error={errors.email}
                    onChange={(e) => setEmail(e.target.value)}
                  />

                  <div className="flex flex-col gap-1">
                    <label htmlFor="support-topic" className="text-sm font-medium text-text">Topic</label>
                    <select
                      id="support-topic"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value as SupportTopic)}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-accent"
                    >
                      {topics.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label htmlFor="support-message" className="text-sm font-medium text-text">Message</label>
                    <textarea
                      id="support-message"
                      rows={6}
                      placeholder="What happened, and on which device?"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className={`w-full rounded-lg border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors placeholder:text-muted
                        ${errors.message ? 'border-red-400 focus:border-red-500' : 'border-border focus:border-accent'}`}
                    />
                    {errors.message && <p className="text-xs text-red-500">{errors.message}</p>}
                  </div>

                  {sendError && <p className="text-sm text-red-400">{sendError}</p>}

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <Button type="submit" size="lg" className="rounded-full" loading={submitting}>
                      Send message
                    </Button>
                    <span className="font-mono text-[11px] uppercase tracking-widest text-faint">
                      Replies within 1 business day
                    </span>
                  </div>
                </form>
              )}
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className="flex h-full flex-col gap-5">
              <div className="rounded-2xl border border-border bg-surface p-7">
                <div className="font-mono text-[10px] uppercase tracking-widest text-faint">Email</div>
                <a href={`mailto:${SUPPORT_EMAIL}`} className="mt-2 block font-display text-xl font-extrabold text-accent break-words">
                  {SUPPORT_EMAIL}
                </a>
                <p className="mt-3 text-sm text-muted">
                  Prefer your own mail app? Write to us directly — same inbox, same people.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-surface p-7">
                <div className="font-mono text-[10px] uppercase tracking-widest text-faint">Billing</div>
                <div className="mt-2 font-display text-xl font-extrabold uppercase">Plans & payments</div>
                <p className="mt-3 text-sm text-muted">
                  Upgrades, downgrades and cancellations all live on your billing page.
                </p>
                <Link
                  to="/billing"
                  className="mt-4 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-accent"
                >
                  Open billing →
                </Link>
              </div>

              <div className="rounded-2xl border border-border bg-surface p-7">
                <div className="font-mono text-[10px] uppercase tracking-widest text-faint">Devices</div>
                <div className="mt-2 font-display text-xl font-extrabold uppercase">Link a TV</div>
                <p className="mt-3 text-sm text-muted">
                  Got a code on screen? Enter it here and the TV signs in to your account.
                </p>
                <Link
                  to="/activate"
                  className="mt-4 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-accent"
                >
                  Activate a device →
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-7xl px-5 py-16">
        <Reveal>
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.28em] text-accent">Before you write</p>
          <h2 className="font-display text-[clamp(32px,5vw,60px)] font-extrabold uppercase">Common questions</h2>
        </Reveal>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {faqs.map((f, i) => (
            <Reveal key={f.q} delay={i * 80}>
              <div className="flex h-full flex-col rounded-2xl border border-border bg-surface p-7">
                <h3 className="font-display text-xl font-extrabold">{f.q}</h3>
                <p className="mt-3 flex-1 text-sm text-muted">{f.a}</p>
                {f.to && f.cta && (
                  <Link
                    to={f.to}
                    className="mt-5 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-accent"
                  >
                    {f.cta} →
                  </Link>
                )}
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={120}>
          <p className="mt-10 text-center font-mono text-xs text-faint">
            Still stuck? Send the form above — real people read every message.
          </p>
        </Reveal>
      </section>
    </div>
  );
}
