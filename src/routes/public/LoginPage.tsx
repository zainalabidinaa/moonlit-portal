import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { AuthLayout } from '../../components/layout/AuthLayout';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const [recoveryMode, setRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordLoading, setNewPasswordLoading] = useState(false);
  const recoveryTokens = useRef<{ access_token: string; refresh_token: string } | null>(null);

  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);

    if (params.get('type') === 'recovery') {
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');

      if (access_token && refresh_token) {
        recoveryTokens.current = { access_token, refresh_token };
        setRecoveryMode(true);
        window.history.replaceState(null, '', '/login');
      }
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) { setError(authError.message); return; }
    navigate('/profiles');
  }

  async function handleMagicLink() {
    if (!email) { setError('Enter your email first'); return; }
    setLoading(true);
    await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    setLoading(false);
    setMagicSent(true);
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setResetLoading(true);
    setError('');
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${window.location.origin}/login`,
    });
    setResetLoading(false);
    if (resetErr) { setError(resetErr.message); return; }
    setResetSent(true);
  }

  async function handleNewPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword.trim() || !recoveryTokens.current) return;
    setNewPasswordLoading(true);
    setError('');

    (window as any).__recoveryInProgress = true;
    await supabase.auth.setSession(recoveryTokens.current);
    const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
    await supabase.auth.signOut();
    (window as any).__recoveryInProgress = false;

    setNewPasswordLoading(false);
    if (updateErr) { setError(updateErr.message); return; }
    setRecoveryMode(false);
    recoveryTokens.current = null;
    setSuccess('Password updated. Sign in with your new password.');
  }

  const quote = 'Five apps, forty minutes of scrolling, and everyone settles. Moonlit is the fix we wanted for our own living room.';

  if (recoveryMode) {
    return (
      <AuthLayout quote={quote} attribution="Why we built it">
        <h1 className="text-[34px] font-semibold tracking-tight">Set a new password.</h1>
        <p className="-mt-2.5 text-[15px] text-muted">Choose a new password for your account.</p>
        <form onSubmit={handleNewPassword} className="grid gap-4">
          <Input id="new-password" label="New password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required autoComplete="new-password" />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <Button type="submit" loading={newPasswordLoading} disabled={!newPassword.trim()} className="w-full">Set password</Button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout quote={quote} attribution="Why we built it">
      <h1 className="text-[34px] font-semibold tracking-tight">Welcome back.</h1>
      <p className="-mt-2.5 text-[15px] text-muted">Sign in to manage profiles, billing and your library.</p>

      {magicSent ? (
        <div className="rounded-xl border border-accent/40 bg-accent-light p-4 text-[14.5px]">
          <b className="font-semibold">Check your email.</b> We sent a sign-in link. Open it on this device to finish signing in.
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <Input id="email" label="Email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            <Input id="password" label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
            {error && <p className="text-xs text-red-400">{error}</p>}
            {success && <p className="text-xs text-cyan">{success}</p>}
            <Button type="submit" loading={loading} className="w-full">Sign in</Button>
            <div className="flex items-center gap-3 text-xs uppercase tracking-[.1em] text-faint before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">or</div>
            <Button type="button" variant="ghost" onClick={handleMagicLink} disabled={loading} className="w-full">Email me a sign-in link</Button>
            <p className="text-[13px] text-faint">
              <button type="button" onClick={() => { setShowReset(!showReset); setResetSent(false); setError(''); }} className="text-muted hover:text-text">
                Forgot password?
              </button>
              {' · '}No account? <Link to="/signup" className="text-accent">Get Moonlit</Link>
            </p>
          </form>

          {showReset && (
            <div className="rounded-xl border border-border bg-bg2 p-4">
              {resetSent ? (
                <p className="text-sm text-cyan">Check your email for a reset link.</p>
              ) : (
                <form onSubmit={handleReset} className="grid gap-3">
                  <p className="text-sm text-muted">Enter your email and we will send a reset link.</p>
                  <Input id="reset-email" type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} placeholder="you@example.com" required />
                  <Button type="submit" loading={resetLoading} variant="secondary" size="sm" disabled={!resetEmail.trim()}>Send reset link</Button>
                </form>
              )}
            </div>
          )}
        </>
      )}
    </AuthLayout>
  );
}
