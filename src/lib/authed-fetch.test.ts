import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authedFetchJson, SessionExpiredError, withTimeout } from './authed-fetch';
import { authHeaders } from './auth-headers';

vi.mock('./auth-headers', () => ({ authHeaders: vi.fn() }));

const mockAuthHeaders = vi.mocked(authHeaders);

beforeEach(() => {
  vi.restoreAllMocks();
  mockAuthHeaders.mockResolvedValue({ Authorization: 'Bearer test' });
});

describe('withTimeout', () => {
  it('resolves when the promise beats the timer', async () => {
    await expect(withTimeout(Promise.resolve(1), 50, 'too slow')).resolves.toBe(1);
  });

  it('rejects with the given message when the promise never settles', async () => {
    await expect(withTimeout(new Promise(() => {}), 20, 'too slow')).rejects.toThrow('too slow');
  });
});

describe('authedFetchJson', () => {
  it('returns parsed JSON on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ users: [] }), { status: 200 }),
    ));
    await expect(authedFetchJson('https://x.test')).resolves.toEqual({ users: [] });
  });

  it('rejects with SessionExpiredError on 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    ));
    await expect(authedFetchJson('https://x.test')).rejects.toBeInstanceOf(SessionExpiredError);
  });

  it('rejects with the server message on other errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'boom' }), { status: 500 }),
    ));
    await expect(authedFetchJson('https://x.test')).rejects.toThrow('boom');
  });

  it('times out when fetch never settles', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    await expect(
      authedFetchJson('https://x.test', {}, { requestMs: 20 }),
    ).rejects.toThrow('timed out');
  });
});
