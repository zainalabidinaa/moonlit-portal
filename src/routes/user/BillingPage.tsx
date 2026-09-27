import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { authHeaders } from '../../lib/auth-headers';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { PLAN_BY_ID, PLAN_LABELS } from '../../lib/plans';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 border-b border-border py-3.5 text-[14.5px] last:border-0">
      <span className="text-muted">{label}</span>
      <b className="text-right font-semibold tabular-nums">{children}</b>
    </div>
  );
}

export default function BillingPage() {
  const { role, session, user, activeProfile, isOwner } = useAuth();
  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  const isBilledPlan = role === 'spotlight' || role === 'studio';
  const plan = role === 'spotlight' || role === 'studio' || role === 'friends_family' ? PLAN_BY_ID[role] : null;

  async function openCustomerPortal() {
    if (!session) return;
    setLoading(true);
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/create-checkout-session`, {
      method: 'POST',
      headers: await authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ action: 'portal' }),
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
    setLoading(false);
  }

  async function handleRedeemInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError('');
    setInviteSuccess('');
    if (!user || !inviteCode.trim()) return;

    setInviteLoading(true);
    const code = inviteCode.trim().toUpperCase();

    // redeem_invite_code grants the role directly onto `accounts` now (see
    // 20260812_redeem_invite_writes_account.sql) — no separate profiles
    // write needed; the sync trigger propagates it to every profile.
    const { error: redeemError } = await supabase.rpc('redeem_invite_code', {
      p_code: code,
      p_user_id: user.id,
      p_email: user.email,
    });

    if (redeemError) {
      setInviteError(redeemError.message);
      setInviteLoading(false);
      return;
    }

    setInviteSuccess('Invite code redeemed. Reloading…');
    setInviteCode('');
    setInviteLoading(false);
    setTimeout(() => window.location.reload(), 1500);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    if (!newPassword || newPassword.length < 6) {
      setPwError('Password must be at least 6 characters');
      return;
    }
    setPwLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwLoading(false);
    if (error) { setPwError(error.message); return; }
    setPwSuccess('Password updated');
    setNewPassword('');
    setTimeout(() => setPwSuccess(''), 4000);
  }

  const passwordCard = (
    <Card className="p-7">
      <h2 className="mb-3 text-lg font-semibold">Change password</h2>
      <form onSubmit={handleChangePassword} className="grid max-w-[420px] gap-3">
        <Input
          id="new-password"
          label="New password"
          type="password"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          placeholder="At least 6 characters"
          error={pwError}
          disabled={pwLoading}
          autoComplete="new-password"
        />
        {pwSuccess && <p className="text-xs text-cyan">{pwSuccess}</p>}
        <Button type="submit" loading={pwLoading} disabled={!newPassword.trim()} variant="ghost" className="w-fit">Update password</Button>
      </form>
    </Card>
  );

  const header = (
    <div>
      <h1 className="text-[34px] font-semibold tracking-tight">Billing</h1>
      <p className="mt-1.5 text-[15px] text-muted">Your plan, payment method and account security.</p>
    </div>
  );

  // Defense in depth: the Navbar link is already hidden from non-owners, but
  // this guards direct navigation to /billing too.
  if (!isOwner) {
    return (
      <AppShell wide={false}>
        <div className="grid gap-6">
          {header}
          <Card className="p-7">
            <p className="text-[14.5px] text-muted">Only the account owner can manage billing. Switch to that profile to view this page.</p>
          </Card>
          {passwordCard}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell wide={false}>
      <div className="grid gap-6">
        {header}

        <Card className="p-7">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Current plan</h2>
            <Badge variant="purple">{role ? PLAN_LABELS[role] : '—'}</Badge>
          </div>

          {role === 'friends_family' && (
            <>
              <p className="mb-2 text-[14.5px] text-muted">Your access was granted by invitation. No billing required.</p>
              <Row label="Catalog">Shared household catalog</Row>
              <Row label="Profiles">Up to {plan?.profileLimit}</Row>
              {activeProfile?.role_expires_at && (
                <Row label="Expires">{new Date(activeProfile.role_expires_at).toLocaleDateString()}</Row>
              )}
            </>
          )}

          {role === 'admin' && (
            <>
              <p className="mb-2 text-[14.5px] text-muted">You manage this Moonlit instance. No subscription required.</p>
              <Row label="Account">{user?.email}</Row>
            </>
          )}

          {role === 'free' && (
            <>
              <p className="text-[14.5px] text-muted">Your account is set to free. Access is limited.</p>
              <div className="mt-4 border-t border-border pt-4">
                <p className="mb-3 text-[13px] text-muted">Enter an invite code to regain access.</p>
                <form onSubmit={handleRedeemInvite} className="grid max-w-[420px] gap-3">
                  <Input
                    id="invite-code"
                    label="Invite code"
                    value={inviteCode}
                    onChange={e => setInviteCode(e.target.value)}
                    placeholder="XXXX-XXXX"
                    error={inviteError}
                    disabled={inviteLoading}
                    className="font-mono uppercase tracking-[.1em]"
                  />
                  {inviteSuccess && <p className="text-xs text-cyan">{inviteSuccess}</p>}
                  <Button type="submit" loading={inviteLoading} disabled={!inviteCode.trim()} className="w-fit">Redeem invite code</Button>
                </form>
              </div>
            </>
          )}

          {isBilledPlan && plan && (
            <>
              <Row label="Plan">{plan.name} · {plan.price} / month</Row>
              <Row label="Simultaneous streams">{plan.streams}</Row>
              <Row label="Profiles">{plan.profileLimit === null ? 'Unlimited' : `Up to ${plan.profileLimit}`}</Row>
              <Row label="Account">{user?.email}</Row>
              <div className="mt-4 flex flex-wrap gap-2.5">
                <Button onClick={openCustomerPortal} loading={loading} variant="ghost" size="sm">Manage billing</Button>
              </div>
              <p className="mt-3 text-[12.5px] text-faint">Update your card, change plan, see invoices or cancel through the Stripe billing portal.</p>
            </>
          )}
        </Card>

        {role === 'spotlight' && (
          <div className="grid gap-3.5 rounded-2xl border border-accent/35 bg-[linear-gradient(135deg,rgba(255,122,61,.12),transparent_60%)] bg-surface p-[22px]">
            <b className="text-base font-semibold">Upgrade to Studio · {PLAN_BY_ID.studio.price} a month</b>
            <p className="text-sm text-muted">Four streams at once, unlimited profiles, your own sources and catalog, priority stream warm-up and early features.</p>
            <Button onClick={openCustomerPortal} loading={loading} size="sm" className="w-fit">Upgrade</Button>
          </div>
        )}

        {role === 'friends_family' && (
          <div className="grid gap-3.5 rounded-2xl border border-accent/35 bg-[linear-gradient(135deg,rgba(255,122,61,.12),transparent_60%)] bg-surface p-[22px]">
            <b className="text-base font-semibold">Want your own household?</b>
            <p className="text-sm text-muted">Subscribe to Spotlight for your own profiles and library, from {PLAN_BY_ID.spotlight.price} a month.</p>
            <Link to="/pricing" className="inline-flex h-[38px] w-fit items-center rounded-full bg-text px-4 text-sm font-semibold text-[#0a0a0c] hover:bg-white">See plans</Link>
          </div>
        )}

        {passwordCard}
      </div>
    </AppShell>
  );
}
