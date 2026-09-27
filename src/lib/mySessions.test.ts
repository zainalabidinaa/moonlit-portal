import { describe, it, expect, vi } from 'vitest';

vi.mock('./supabase', () => ({ supabase: {} }));

import { currentSessionId, describeDevice, maskIp } from './mySessions';

describe('describeDevice', () => {
  it('names the native app, which sends the same agent on iOS and Mac', () => {
    expect(describeDevice('Moonlit/4 CFNetwork/1498.700.2 Darwin/24.0.0')).toMatchObject({ name: 'Moonlit app', kind: 'app', platform: 'apple' });
  });
  it('names browsers by browser and system', () => {
    expect(describeDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15').name).toBe('Safari on Mac');
    expect(describeDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36').name).toBe('Chrome on Windows');
    expect(describeDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 Edg/140.0').name).toBe('Edge on Windows');
    expect(describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1').name).toBe('Safari on iPhone');
  });
  it('handles a missing agent', () => {
    expect(describeDevice(null).name).toBe('Unknown device');
  });
});

describe('maskIp', () => {
  it('hides the host part of the address', () => {
    expect(maskIp('83.250.14.9')).toBe('83.250.•.•');
    expect(maskIp('2001:db8:85a3:0:0:8a2e:370:7334')).toBe('2001:db8:85a3:…');
    expect(maskIp(null)).toBeNull();
  });
});

describe('currentSessionId', () => {
  it('reads session_id from the access token payload', () => {
    const payload = btoa(JSON.stringify({ sub: 'u1', session_id: 'abc-123' })).replace(/=+$/, '');
    expect(currentSessionId(`h.${payload}.s`)).toBe('abc-123');
    expect(currentSessionId('not-a-jwt')).toBeNull();
    expect(currentSessionId(undefined)).toBeNull();
  });
});
