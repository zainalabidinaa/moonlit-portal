import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import type { UserRole } from '../../types';

const PLAN_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  friends_family: 'Friends & Family',
  premium: 'Premium',
  premium_plus: 'Premium+',
  free: 'Free',
  restricted: 'Restricted',
};

export default function BillingPage() {
  const { role, session, user, activeProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  const isBilledPlan = role === 'premium' || role === 'premium_plus';

  async function openCustomerPortal() {
    if (!session) return;
    setLoading(true);
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
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

    const { data: durationDays, error: redeemError } = await supabase.rpc('redeem_invite_code', {
      p_code: code,
      p_user_id: user.id,
      p_email: user.email,
    });

    if (redeemError) {
      setInviteError(redeemError.message);
      setInviteLoading(false);
      return;
    }

    const roleExpiresAt = durationDays !== null && durationDays !== undefined
      ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { error: profileErr } = await supabase
      .from('profiles')
      .update({
        role: 'friends_family',
        role_expires_at: roleExpiresAt,
      })
      .eq('user_id', user.id);

    if (profileErr) {
      setInviteError(profileErr.message);
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
    setPwSuccess('Password updated successfully');
    setNewPassword('');
    setTimeout(() => setPwSuccess(''), 4000);
  }

  return (
    <AppShell>
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-text mb-6">Billing</h1>

        <Card className="p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-text">Current Plan</p>
            <Badge variant="purple">{role ? PLAN_LABELS[role] : '—'}</Badge>
          </div>

          {role === 'friends_family' && (
            <div>
              <p className="text-sm text-muted">Your access was granted by invitation. No billing required.</p>
              {activeProfile?.role_expires_at && (
                <p className="text-xs text-muted mt-1">
                  Expires {new Date(activeProfile.role_expires_at).toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          {role === 'admin' && (
            <p className="text-sm text-muted">You manage this Moonlit instance. No subscription required.</p>
          )}

          {role === 'free' && (
            <>
              <p className="text-sm text-muted">Your account is set to free. Access is limited.</p>
              <div className="border-t border-border pt-4">
                <p className="text-xs text-muted mb-3">Enter an invite code to regain access.</p>
                <form onSubmit={handleRedeemInvite} className="flex flex-col gap-3">
                  <Input
                    id="invite-code"
                    label="Invite Code"
                    value={inviteCode}
                    onChange={e => setInviteCode(e.target.value)}
                    placeholder="XXXX-XXXX"
                    error={inviteError}
                    disabled={inviteLoading}
                  />
                  {inviteSuccess && <p className="text-xs text-green-400">{inviteSuccess}</p>}
                  <Button type="submit" loading={inviteLoading} disabled={!inviteCode.trim()}>
                    Redeem Invite Code
                  </Button>
                </form>
              </div>
            </>
          )}

          {isBilledPlan && (
            <div className="border-t border-border pt-4">
              <p className="text-xs text-muted mb-3">Manage your subscription, update payment method, or cancel through the billing portal.</p>
              <Button onClick={openCustomerPortal} loading={loading} variant="secondary">
                Manage Billing
              </Button>
            </div>
          )}
        </Card>

        <Card className="p-6 mt-5">
          <h2 className="text-sm font-semibold text-text mb-4">Change Password</h2>
          <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
            <Input
              id="new-password"
              label="New Password"
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Min 6 characters"
              error={pwError}
              disabled={pwLoading}
              autoComplete="new-password"
            />
            {pwSuccess && <p className="text-xs text-green-400">{pwSuccess}</p>}
            <Button type="submit" loading={pwLoading} disabled={!newPassword.trim()} variant="secondary">
              Update Password
            </Button>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
