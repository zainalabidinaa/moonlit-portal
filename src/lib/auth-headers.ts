import { supabase } from './supabase';

/**
 * Authorization header for an edge-function call, using a token that is fresh
 * at the moment of the request.
 *
 * Pages hold the session in React state (via AuthContext) and were reading
 * `session.access_token` straight from that copy. Access tokens are short-lived
 * — a tab left open across an expiry, or a laptop that slept through one, sends
 * a dead token and the function answers 401 "Unauthorized", which reads to the
 * user as a permissions problem when it is really a staleness problem.
 *
 * `getSession()` refreshes the token when it is expired or close to it, so
 * asking for it at call time is what keeps long-lived admin tabs working.
 */
export async function authHeaders(
  extra: Record<string, string> = {},
): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error('Your session has expired. Please sign in again.');
  }
  return { ...extra, Authorization: `Bearer ${token}` };
}
