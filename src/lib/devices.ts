// Shape returned per user by the admin-users edge function, from the
// admin_list_user_devices() RPC (Moonlit/supabase/migrations/20261029_user_devices.sql).
export type DevicePlatform = 'ios' | 'ipados' | 'macos' | 'tvos' | 'visionos' | 'androidtv' | 'windows';

export type UserDevice = {
  device_id: string;
  platform: DevicePlatform;
  model: string | null;
  os_version: string | null;
  app_version: string | null;
  first_seen_at: string;
  last_seen_at: string;
  signed_in: boolean;
};

// Apple model identifiers → marketing names. Only models new enough to run
// the apps (iOS/tvOS 17+) are listed; anything newer or missing falls back to
// the family name from the identifier's prefix (see deviceName).
const APPLE_MODELS: Record<string, string> = {
  'iPhone12,8': 'iPhone SE (2nd gen)',
  'iPhone13,1': 'iPhone 12 mini',
  'iPhone13,2': 'iPhone 12',
  'iPhone13,3': 'iPhone 12 Pro',
  'iPhone13,4': 'iPhone 12 Pro Max',
  'iPhone14,2': 'iPhone 13 Pro',
  'iPhone14,3': 'iPhone 13 Pro Max',
  'iPhone14,4': 'iPhone 13 mini',
  'iPhone14,5': 'iPhone 13',
  'iPhone14,6': 'iPhone SE (3rd gen)',
  'iPhone14,7': 'iPhone 14',
  'iPhone14,8': 'iPhone 14 Plus',
  'iPhone15,2': 'iPhone 14 Pro',
  'iPhone15,3': 'iPhone 14 Pro Max',
  'iPhone15,4': 'iPhone 15',
  'iPhone15,5': 'iPhone 15 Plus',
  'iPhone16,1': 'iPhone 15 Pro',
  'iPhone16,2': 'iPhone 15 Pro Max',
  'iPhone17,1': 'iPhone 16 Pro',
  'iPhone17,2': 'iPhone 16 Pro Max',
  'iPhone17,3': 'iPhone 16',
  'iPhone17,4': 'iPhone 16 Plus',
  'iPhone17,5': 'iPhone 16e',
  'iPhone18,1': 'iPhone 17 Pro',
  'iPhone18,2': 'iPhone 17 Pro Max',
  'iPhone18,3': 'iPhone 17',
  'iPhone18,4': 'iPhone Air',
  'AppleTV6,2': 'Apple TV 4K',
  'AppleTV11,1': 'Apple TV 4K (2nd gen)',
  'AppleTV14,1': 'Apple TV 4K (3rd gen)',
};

const FAMILY_PREFIXES: [RegExp, string][] = [
  [/^iPhone/, 'iPhone'],
  [/^iPad/, 'iPad'],
  [/^AppleTV/, 'Apple TV'],
  [/^MacBookAir/, 'MacBook Air'],
  [/^MacBookPro/, 'MacBook Pro'],
  [/^iMac/, 'iMac'],
  [/^Macmini/, 'Mac mini'],
  [/^MacPro/, 'Mac Pro'],
  [/^Mac\d/, 'Mac'],
  [/^RealityDevice/, 'Apple Vision Pro'],
];

const PLATFORM_FALLBACK: Record<DevicePlatform, string> = {
  ios: 'iPhone',
  ipados: 'iPad',
  macos: 'Mac',
  tvos: 'Apple TV',
  visionos: 'Apple Vision Pro',
  androidtv: 'Android TV',
  windows: 'Windows PC',
};

export const PLATFORM_OS: Record<DevicePlatform, string> = {
  ios: 'iOS',
  ipados: 'iPadOS',
  macos: 'macOS',
  tvos: 'tvOS',
  visionos: 'visionOS',
  androidtv: 'Android',
  windows: 'Windows',
};

/** "iPhone17,1" → "iPhone 16 Pro". Unknown Apple identifiers fall back to
 *  their family ("iPhone"); non-Apple models (Android TV's Build.MODEL,
 *  e.g. "SHIELD Android TV") are already human-readable and pass through. */
export function deviceName(model: string | null, platform: DevicePlatform): string {
  if (!model) return PLATFORM_FALLBACK[platform] ?? 'Unknown device';
  const known = APPLE_MODELS[model];
  if (known) return known;
  for (const [pattern, family] of FAMILY_PREFIXES) {
    if (pattern.test(model)) return family;
  }
  if (platform === 'androidtv' || platform === 'windows') return model;
  return PLATFORM_FALLBACK[platform] ?? model;
}

/** "iOS 26.0" — or just the OS name when the version wasn't reported. */
export function osLabel(device: Pick<UserDevice, 'platform' | 'os_version'>): string {
  const os = PLATFORM_OS[device.platform] ?? device.platform;
  return device.os_version ? `${os} ${device.os_version}` : os;
}

/**
 * The one-line text for the Devices column on the Users table.
 * `devices` is newest-first (by last_seen_at).
 */
export function summarizeDevices(devices: UserDevice[]): string {
  // TODO(zain): decide what an admin sees at a glance — see the note in chat.
  if (devices.length === 0) return '—';
  return deviceName(devices[0].model, devices[0].platform);
}
