import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { completeEmailLink } from '../../lib/emailLink';

/** Landing page for email sign-in links on trymoonlit.app. */
export default function AuthConfirmPage() {
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void completeEmailLink('/auth/confirm').then((result) => {
      if (result === 'signed-in') navigate('/profiles', { replace: true });
      else setFailed(true);
    });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 text-center">
        {failed ? (
          <>
            <h1 className="text-xl font-bold text-text">This link has expired</h1>
            <p className="mt-2 text-sm text-muted">Sign-in links work once and only for a short time. Request a new one.</p>
            <Link to="/login" className="mt-5 inline-block text-sm font-semibold text-accent hover:underline">Back to sign in</Link>
          </>
        ) : (
          <p className="text-sm text-muted">Signing you in…</p>
        )}
      </div>
    </div>
  );
}
