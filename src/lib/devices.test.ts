import { describe, expect, it } from 'vitest';
import { deviceName, osLabel } from './devices';

describe('deviceName', () => {
  it('maps known Apple identifiers to marketing names', () => {
    expect(deviceName('iPhone17,1', 'ios')).toBe('iPhone 16 Pro');
    expect(deviceName('AppleTV14,1', 'tvos')).toBe('Apple TV 4K (3rd gen)');
  });

  it('falls back to the family for identifiers it does not know yet', () => {
    expect(deviceName('iPhone19,9', 'ios')).toBe('iPhone');
    expect(deviceName('iPad16,3', 'ipados')).toBe('iPad');
    expect(deviceName('MacBookAir10,1', 'macos')).toBe('MacBook Air');
    expect(deviceName('Mac15,12', 'macos')).toBe('Mac');
  });

  it('passes readable Android TV models through', () => {
    expect(deviceName('SHIELD Android TV', 'androidtv')).toBe('SHIELD Android TV');
  });

  it('uses the platform when no model was reported', () => {
    expect(deviceName(null, 'tvos')).toBe('Apple TV');
  });
});

describe('osLabel', () => {
  it('joins OS name and version', () => {
    expect(osLabel({ platform: 'ipados', os_version: '26.0' })).toBe('iPadOS 26.0');
    expect(osLabel({ platform: 'windows', os_version: null })).toBe('Windows');
  });
});
