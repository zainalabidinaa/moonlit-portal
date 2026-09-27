import { describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({ supabase: { auth: {} } }));
import { readEmailLink } from './emailLink';

describe('readEmailLink', () => {
  it('reads the token and type from our confirm link', () => {
    expect(readEmailLink('?token_hash=abc123&type=email')).toEqual({ tokenHash: 'abc123', type: 'email' });
  });

  it('ignores a page opened without a link', () => {
    expect(readEmailLink('')).toBeNull();
    expect(readEmailLink('?next=/profiles')).toBeNull();
  });

  it('rejects an unknown type rather than guessing', () => {
    expect(readEmailLink('?token_hash=abc&type=sms')).toBeNull();
  });

  it('needs both parts', () => {
    expect(readEmailLink('?token_hash=abc')).toBeNull();
    expect(readEmailLink('?type=email')).toBeNull();
  });
});
