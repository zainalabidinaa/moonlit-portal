import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import type { Plan } from '../../types';

type Tab = 'invite' | 'subscribe';
type InviteStep = 'form' | 'confirm';

const PLAN_LABELS: Record<Plan, string> = {
  premium: 'Premium — $9.99/mo',
  premium_plus: 'Premium+ — $14.99/mo',
};

export default function SignupPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialTab: Tab = params.get('tab') === 'invite' ? 'invite' : params.get('plan') ? 'subscribe' : 'invite';
  const initialPlan = (params.get('plan') as Plan | null) ?? 'premium';

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
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <Card className="w-full max-w-sm p-8">
        <h1 className="text-2xl font-bold text-text mb-1">Create your account</h1>
        <p className="text-sm text-muted mb-6">Join Moonlit today</p>

        {/* Tabs */}
        <div className="flex gap-1 bg-border rounded-lg p-1 mb-6">
          {(['invite', 'subscribe'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === t ? 'bg-surface text-text shadow-sm' : 'text-muted'}`}
            >
              {t === 'invite' ? 'Invite Code' : 'Subscribe'}
            </button>
          ))}
        </div>

        {tab === 'invite' ? (
          inviteStep === 'form' ? (
            <form onSubmit={handleReviewInvite} className="flex flex-col gap-4">
              <Input id="code" label="Invite Code" value={code} onChange={e => setCode(e.target.value)} placeholder="XXXX-XXXX" required />
              <Input id="email" label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
              <Input id="password" label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <Button type="submit" className="w-full mt-1">Continue</Button>
            </form>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm text-muted mb-1">You're creating an account with:</p>
                <p className="text-base font-semibold text-text break-all">{email}</p>
              </div>
              <p className="text-xs text-muted">
                This invite code can only be used once — double-check the email before continuing.
              </p>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <Button onClick={handleInviteSignup} loading={loading} className="w-full">
                This is correct — Create Account
              </Button>
              <Button variant="ghost" onClick={() => setInviteStep('form')} disabled={loading} className="w-full">
                Change email
              </Button>
            </div>
          )
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              {(['premium', 'premium_plus'] as Plan[]).map(p => (
                <button
                  key={p}
                  onClick={() => setSelectedPlan(p)}
                  className={`px-4 py-3 rounded-lg border text-sm text-left transition-colors ${selectedPlan === p ? 'border-accent bg-accent-light text-accent' : 'border-border text-text hover:border-accent/40'}`}
                >
                  {PLAN_LABELS[p]}
                </button>
              ))}
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <Button loading={loading} className="w-full" onClick={handleStripeSignup}>
              Continue to Payment
            </Button>
          </div>
        )}

        <p className="text-xs text-muted text-center mt-6">
          Already have an account? <Link to="/login" className="text-accent hover:underline">Sign in</Link>
        </p>
      </Card>
    </div>
  );
}
