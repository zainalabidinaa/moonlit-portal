import { authHeaders } from './auth-headers';

/** Thrown when the endpoint answers 401: the access token is dead (expired,
 *  revoked, or from a session that was signed out elsewhere). Callers should
 *  sign out so the route guards send the user to /login. */
export class SessionExpiredError extends Error {
  constructor(message = 'Your session has expired. Please sign in again.') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

const SESSION_READ_TIMEOUT_MS = 10_000;
const REQUEST_TIMEOUT_MS = 20_000;
const TIMEOUT_MESSAGE = 'The request timed out — check your connection and try again.';

/** Races a promise against a timer so a stalled await surfaces as an error
 *  instead of leaving a page stuck on "Loading…" forever. */
export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

type JsonRequestInit = Omit<RequestInit, 'headers'> & { headers?: Record<string, string> };

/** Authed JSON fetch for edge functions: fresh token, bounded in both the
 *  session read and the request itself, one consistent error shape. */
export async function authedFetchJson<T>(
  url: string,
  init: JsonRequestInit = {},
  timeouts: { sessionMs?: number; requestMs?: number } = {},
): Promise<T> {
  const headers = await withTimeout(
    authHeaders(init.headers ?? {}),
    timeouts.sessionMs ?? SESSION_READ_TIMEOUT_MS,
    'Could not read your session — please refresh the page and sign in again.',
  );

  const controller = new AbortController();
  const requestMs = timeouts.requestMs ?? REQUEST_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), requestMs);
  try {
    const res = await withTimeout(
      fetch(url, { ...init, headers, signal: controller.signal }),
      requestMs,
      TIMEOUT_MESSAGE,
    );
    const data = await res.json().catch(() => null);
    if (res.status === 401) {
      throw new SessionExpiredError(data?.error ?? undefined);
    }
    if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
    return data as T;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error(TIMEOUT_MESSAGE);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
