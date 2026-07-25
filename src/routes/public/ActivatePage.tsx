import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';

const FUNCTIONS_URL = 'https://hvfsntdyowapjxobtyli.supabase.co/functions/v1';

export default function ActivatePage() {
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState(searchParams.get('code') ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [linked, setLinked] = useState(false);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSession(data.session);
        setEmail(data.session.user.email ?? '');
      }
    });
  }, []);

  async function handleLink() {
    if (!session) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${FUNCTIONS_URL}/device-code?action=link`, {
        method: 'POST',
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          access_token: session.access_token,
          refresh_token: session.refresh_token ?? '',
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Could not link device. Check the code and try again.');
      } else {
        setLinked(true);
      }
    } catch {
      setError('Connection failed. Please try again.');
    }
    setLoading(false);
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;
      if (data.session) {
        setSession(data.session);
        await doLink(data.session.access_token, data.session.refresh_token ?? '');
        return;
      }
    } catch (err: any) {
      setError(err.message || 'Sign in failed');
    }
    setLoading(false);
  }

  async function doLink(accessToken: string, refreshToken: string) {
    try {
      const res = await fetch(`${FUNCTIONS_URL}/device-code?action=link`, {
        method: 'POST',
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: code.trim().toUpperCase(), access_token: accessToken, refresh_token: refreshToken }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Could not link device.');
        setLoading(false);
      } else {
        setLinked(true);
        setLoading(false);
      }
    } catch {
      setError('Connection failed.');
      setLoading(false);
    }
  }

  if (linked) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <Card className="max-w-sm w-full text-center p-8">
          <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-ink mb-2">Device Linked!</h1>
          <p className="text-sm text-muted">Your Apple TV is now signed in. You can close this page.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <Card className="max-w-sm w-full p-6">
        <h1 className="text-xl font-semibold text-ink text-center mb-1">Link your Apple TV</h1>
        <p className="text-sm text-muted text-center mb-6">Enter the code shown on your TV.</p>

        <div className="mb-4">
          <label className="block text-xs font-medium text-muted mb-1.5">Device Code</label>
          <Input
            type="text"
            className="font-mono tracking-[0.25em] text-center text-lg"
            placeholder="ABC123"
            maxLength={6}
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(''); }}
          />
        </div>

        {session ? (
          <>
            <p className="text-sm text-muted mb-4">Signed in as <span className="text-ink">{session.user.email}</span></p>
            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
            <Button className="w-full" onClick={handleLink} loading={loading} disabled={code.length < 6}>
              Link Device
            </Button>
          </>
        ) : (
          <form onSubmit={handleSignIn}>
            <div className="mb-3">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="mb-4">
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
            <Button type="submit" className="w-full" loading={loading} disabled={code.length < 6}>
              Sign In & Link
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
