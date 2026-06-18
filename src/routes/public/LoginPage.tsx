import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';

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
    await supabase.auth.signInWithOtp({ email });
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
    setSuccess('Password updated — sign in with your new password.');
  }

  return (
    recoveryMode ? (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <Card className="w-full max-w-sm p-8">
          <h1 className="text-2xl font-bold text-text mb-1">Set new password</h1>
          <p className="text-sm text-muted mb-6">Choose a new password for your account</p>
          <form onSubmit={handleNewPassword} className="flex flex-col gap-4">
            <Input id="new-password" label="New Password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required autoComplete="new-password" />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <Button type="submit" loading={newPasswordLoading} disabled={!newPassword.trim()} className="w-full">Set Password</Button>
          </form>
        </Card>
      </div>
    ) : (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <Card className="w-full max-w-sm p-8">
        <h1 className="text-2xl font-bold text-text mb-1">Welcome back</h1>
        <p className="text-sm text-muted mb-6">Sign in to your Moonlit account</p>

        {magicSent ? (
          <p className="text-sm text-green-600 bg-green-50 rounded-lg p-3">
            Check your email — we sent a magic link.
          </p>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input id="email" label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
              <Input id="password" label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
              <div className="text-right">
                <button type="button" onClick={() => { setShowReset(!showReset); setResetSent(false); setError(''); }} className="text-xs text-accent hover:underline">
                  Forgot password?
                </button>
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              {success && <p className="text-xs text-green-500">{success}</p>}
              <Button type="submit" loading={loading} className="w-full mt-1">Sign in</Button>
              <button type="button" onClick={handleMagicLink} className="text-xs text-muted hover:text-accent transition-colors text-center">
                Sign in with magic link
              </button>
            </form>
            {showReset && (
              <div className="mt-3 rounded-lg border border-border bg-bg2 p-3">
                {resetSent ? (
                  <p className="text-xs text-green-400">Check your email for a reset link.</p>
                ) : (
                  <form onSubmit={handleReset} className="flex flex-col gap-2">
                    <p className="text-xs text-muted">Enter your email and we&apos;ll send a reset link.</p>
                    <Input
                      id="reset-email"
                      type="email"
                      value={resetEmail}
                      onChange={e => setResetEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                    />
                    <Button type="submit" loading={resetLoading} variant="secondary" size="sm" disabled={!resetEmail.trim()}>
                      Send Reset Link
                    </Button>
                  </form>
                )}
              </div>
            )}
          </>
        )}

        <p className="text-xs text-muted text-center mt-6">
          Don&apos;t have an account? <Link to="/signup" className="text-accent hover:underline">Sign up</Link>
        </p>
      </Card>
    </div>
    )
  );
}
