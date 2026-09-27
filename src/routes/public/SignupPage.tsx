import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { PLAN_BY_ID } from '../../lib/plans';
import type { Plan } from '../../types';

type Tab = 'invite' | 'subscribe';
type InviteStep = 'form' | 'confirm';

const PLAN_SUMMARY: Record<Plan, string> = {
  spotlight: '2 streams · up to 4 profiles · 4K HDR',
  studio: '4 streams · unlimited profiles · your own sources',
};

export default function SignupPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialTab: Tab = params.get('tab') === 'invite' ? 'invite' : params.get('plan') ? 'subscribe' : 'subscribe';
  const initialPlan = (params.get('plan') as Plan | null) ?? 'spotlight';

  const [tab, setTab] = useState<Tab>(initialTab);
  const [inviteStep, setInviteStep] = useState<InviteStep>('form');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<Plan>(initialPlan);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Wrong-email signups are hard to undo — the invite code is single-use, so a
  // typo here burns the code on an account the person didn't mean to create.
  // This step exists purely to make them look at what they typed before it's
  // irreversible; "Change email" just goes back to the same form, code and
  // password intact.
  function handleReviewInvite(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInviteStep('confirm');
  }

  async function handleInviteSignup() {
    setError('');
    setLoading(true);

    const trimmedCode = code.trim().toUpperCase();

    // Create account first
    const { data: authData, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError || !authData.user) {
      setError(signUpError?.message ?? 'Signup failed');
      setLoading(false);
      setInviteStep('form');
      return;
    }

    // Redeem invite code (validates + marks used). The returned duration_days
    // used to be turned into role_expires_at right here; that's now computed
    // by the database from this redemption's own timestamp, whenever the
    // first profile actually gets created (see below).
    const { error: redeemError } = await supabase.rpc('redeem_invite_code', {
      p_code: trimmedCode,
      p_user_id: authData.user.id,
      p_email: email,
    });

    if (redeemError) {
      setError(redeemError.message);
      setLoading(false);
      setInviteStep('form');
      return;
    }

    // Deliberately NOT inserting a profile here. The account now has zero
    // profiles, which FirstProfileGate (mounted in AppShell) turns into a
    // mandatory "create your profile" step the moment they land on any
    // authenticated page — same one iOS/macOS already show for a profile-less
    // account. Whichever client ends up creating that first profile, a
    // database trigger (tg_apply_signup_grant) stamps it with the role and
    // expiry this invite code granted — not from anything held in this
    // browser tab, so it survives closing the site and coming back days
    // later, or finishing signup on the phone instead. See
    // 20260811_signup_profile_gate.sql.

    setLoading(false);
    navigate('/profiles');
  }

  async function handleStripeSignup() {
    setError('');
    setLoading(true);
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: selectedPlan }),
    });
    const { url, error: fnError } = await res.json();
    if (fnError || !url) { setError('Could not start checkout. Try again.'); setLoading(false); return; }
    window.location.href = url;
  }

  return (
    <AuthLayout quote="Collections picked by people. Real 4K playback. A profile for everyone at home." attribution="What you get with Moonlit">
      <h1 className="text-[34px] font-semibold tracking-tight">Create your account.</h1>
      <p className="-mt-2.5 text-[15px] text-muted">Subscribe in a minute, or redeem an invite from someone who already has Moonlit.</p>

      <div className="flex rounded-full border border-border bg-bg2 p-1" role="tablist">
        {(['subscribe', 'invite'] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => { setTab(t); setError(''); }}
            className={`h-9 flex-1 rounded-full text-sm font-medium transition-colors ${tab === t ? 'bg-surface-2 text-text' : 'text-muted'}`}
          >
            {t === 'invite' ? 'I have an invite code' : 'Subscribe'}
          </button>
        ))}
      </div>

      {tab === 'invite' ? (
        inviteStep === 'form' ? (
          <form onSubmit={handleReviewInvite} className="grid gap-4">
            <Input id="code" label="Invite code" value={code} onChange={e => setCode(e.target.value)} placeholder="XXXX-XXXX" required className="font-mono uppercase tracking-[.1em]" />
            <Input id="email" label="Email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            <Input id="password" label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <Button type="submit" className="w-full">Continue</Button>
            <p className="text-[13px] text-faint">An invite code works once. Double-check the email before continuing.</p>
          </form>
        ) : (
          <div className="grid gap-4">
            <div>
              <p className="text-sm text-muted">You are creating an account with:</p>
              <p className="break-all text-base font-semibold">{email}</p>
            </div>
            <p className="text-[13px] text-faint">This invite code can only be used once. Double-check the email before continuing.</p>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <Button onClick={handleInviteSignup} loading={loading} className="w-full">This is correct, create account</Button>
            <Button variant="ghost" onClick={() => setInviteStep('form')} disabled={loading} className="w-full">Change email</Button>
          </div>
        )
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-2.5">
            {(['spotlight', 'studio'] as Plan[]).map((p) => {
              const facts = PLAN_BY_ID[p];
              const on = selectedPlan === p;
              return (
                <label
                  key={p}
                  className={`grid cursor-pointer grid-cols-[1fr_auto] gap-x-3 gap-y-1 rounded-xl border px-4 py-3.5 transition-colors ${on ? 'border-accent bg-accent-light' : 'border-border-strong hover:border-muted'}`}
                >
                  <input type="radio" name="plan" value={p} checked={on} onChange={() => setSelectedPlan(p)} className="sr-only" />
                  <b className="text-[15px] font-semibold">{facts.name}</b>
                  <em className="row-span-2 self-center text-[15px] font-semibold not-italic tabular-nums">{facts.price}/mo</em>
                  <span className="text-[13px] text-muted">{PLAN_SUMMARY[p]}</span>
                </label>
              );
            })}
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <Button loading={loading} className="w-full" onClick={handleStripeSignup}>Continue to payment →</Button>
          <p className="text-[13px] text-faint">Secure checkout by Stripe. Cancel any time from Billing.</p>
        </div>
      )}

      <p className="text-[13px] text-faint">Already have an account? <Link to="/login" className="text-accent">Sign in</Link></p>
    </AuthLayout>
  );
}
