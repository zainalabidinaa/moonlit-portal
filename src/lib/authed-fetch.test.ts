import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authedFetchJson, SessionExpiredError, withTimeout } from './authed-fetch';
import { authHeaders } from './auth-headers';

vi.mock('./auth-headers', () => ({ authHeaders: vi.fn() }));

const mockAuthHeaders = vi.mocked(authHeaders);

beforeEach(() => {
  vi.restoreAllMocks();
  // Mirror the real authHeaders contract (spread extra, then Authorization)
  // so the header merge callers depend on is actually exercised here.
  mockAuthHeaders.mockImplementation(async (extra = {}) => ({
    ...extra,
    Authorization: 'Bearer test',
  }));
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

  it('sends the resolved auth headers, merged with the call-site headers', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    vi.stubGlobal('fetch', mockFetch);
    await authedFetchJson('https://x.test', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://x.test',
      expect.objectContaining({
        method: 'PATCH',
        headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      }),
    );
  });

  it('resolves null when a successful response has a non-JSON body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('not json', { status: 200 }),
    ));
    await expect(authedFetchJson('https://x.test')).resolves.toBeNull();
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

  it('throws the timeout error when the abort lands during the body read', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init: RequestInit) =>
      Promise.resolve({
        status: 200,
        ok: true,
        json: () => new Promise((_, reject) => {
          init.signal?.addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }),
      } as unknown as Response),
    ));
    await expect(
      authedFetchJson('https://x.test', {}, { requestMs: 20 }),
    ).rejects.toThrow('timed out');
  });
});
