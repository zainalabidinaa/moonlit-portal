import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../../components/layout/Navbar';
import { Footer } from '../../components/layout/Footer';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
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

const helps: { title: string; body: string; to: string; cta: string }[] = [
  { title: 'Playback and devices', body: 'Stuttering, subtitles out of sync, a title that will not start.', to: '/download', cta: 'Get the latest apps' },
  { title: 'Account and profiles', body: 'Sign-in links, passwords, adding a profile, kids mode.', to: '/profiles', cta: 'Manage profiles' },
  { title: 'Billing and plans', body: 'Invoices, changing plans, cancelling.', to: '/billing', cta: 'Open billing' },
  { title: 'Sign in on Apple TV', body: 'Open Moonlit on the TV, note the code it shows, then enter it here.', to: '/activate', cta: 'Link a device' },
];

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export default function SupportPage() {
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

    // The id is generated here rather than read back from the insert. This page
    // is public, and RLS grants anon INSERT but no SELECT policy covers it — so
    // `.select()` compiles to RETURNING, Postgres evaluates it against the
    // SELECT policies, and the whole statement aborts with 42501 for every
    // logged-out visitor. Generating it client-side keeps the insert write-only.
    const requestId = crypto.randomUUID();

    const { error } = await supabase
      .from('support_requests')
      .insert({
        id: requestId,
        user_id: session?.user?.id ?? null,
        name: name.trim(),
        email: email.trim(),
        topic,
        message: message.trim(),
      });

    if (error) {
      setSubmitting(false);
      setSendError(`We could not send that. Email us at ${SUPPORT_EMAIL} and we will pick it up there.`);
      return;
    }

    // The message is stored at this point. Emailing it to the team inbox is a
    // separate step, and a failure there must not tell the visitor to write
    // again — it is logged, and the admin inbox flags rows that never went out.
    try {
      const { error: notifyErr } = await supabase.functions.invoke('support-notify', {
        body: { id: requestId },
      });
      if (notifyErr) console.error('support-notify failed:', notifyErr.message);
    } catch (err) {
      console.error('support-notify failed:', err);
    }

    setSubmitting(false);
    setSent(true);
    setMessage('');
  }

  const fieldClass = 'h-[46px] w-full rounded-[10px] border border-border-strong bg-bg2 px-3.5 text-[15px] text-text outline-none transition-[border-color,box-shadow] focus:border-accent focus:shadow-[0_0_0_3px_rgba(255,122,61,.12)]';

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />

      <div className="mx-auto max-w-[1240px] px-5 pb-24 pt-[calc(var(--nav-h)+72px)] md:px-8 md:pt-[calc(var(--nav-h)+110px)]">
        <div className="mb-14 grid max-w-[720px] gap-4">
          <p className="text-xs font-semibold uppercase tracking-[.12em] text-accent">Support</p>
          <h1 className="text-[clamp(40px,6vw,72px)] font-semibold leading-[1.05]">How can we help?</h1>
          <p className="max-w-[36em] text-lg text-muted">
            A person reads every message. Tell us what happened and on which device, and we will get back to you by email. Prefer your own mail app? Write to{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent">{SUPPORT_EMAIL}</a>.
          </p>
        </div>

        <div className="grid gap-10 lg:grid-cols-[1fr_1.5fr] lg:gap-[72px]">
          <div className="grid content-start gap-3.5">
            {helps.map((h) => (
              <div key={h.title} className="grid gap-1.5 rounded-2xl border border-border bg-surface p-[22px]">
                <b className="text-base font-semibold">{h.title}</b>
                <p className="text-[14.5px] text-muted">{h.body}</p>
                <Link to={h.to} className="text-sm font-medium text-accent">{h.cta} →</Link>
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-border bg-surface p-7">
            <h2 className="text-2xl font-semibold tracking-tight">Send a message</h2>

            {sent ? (
              <div className="mt-6 rounded-xl border border-accent/40 bg-accent-light p-6">
                <h3 className="text-base font-semibold">Message sent</h3>
                <p className="mt-1 text-[14.5px] text-muted">
                  We have it. Look for a reply at <span className="text-text">{email}</span>. If it is about playback, the title and the device help us reproduce it.
                </p>
                <Button variant="ghost" size="sm" className="mt-4" onClick={() => setSent(false)}>Send another</Button>
              </div>
            ) : (
              <form className="mt-6 grid gap-4" onSubmit={handleSubmit} noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input id="support-name" label="Your name" placeholder="Ada Lovelace" autoComplete="name" value={name} error={errors.name} onChange={(e) => setName(e.target.value)} />
                  <Input id="support-email" type="email" label="Email" placeholder="you@example.com" autoComplete="email" value={email} error={errors.email} onChange={(e) => setEmail(e.target.value)} />
                </div>

                <div className="grid gap-1.5">
                  <label htmlFor="support-topic" className="text-[13.5px] font-medium text-muted">Topic</label>
                  <select id="support-topic" value={topic} onChange={(e) => setTopic(e.target.value as SupportTopic)} className={fieldClass}>
                    {topics.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>

                <div className="grid gap-1.5">
                  <label htmlFor="support-message" className="text-[13.5px] font-medium text-muted">Message</label>
                  <textarea
                    id="support-message"
                    rows={6}
                    placeholder="What happened, and on which device?"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className={`${fieldClass} h-auto min-h-[140px] resize-y py-3 ${errors.message ? '!border-red-400' : ''}`}
                  />
                  {errors.message && <p className="text-xs text-red-400">{errors.message}</p>}
                </div>

                {sendError && <p className="text-sm text-red-400">{sendError}</p>}

                <Button type="submit" loading={submitting} className="w-full">Send message</Button>
                <p className="text-[13px] text-faint">We reply to the email above, usually within a business day. Nothing is shared outside the support team.</p>
              </form>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
