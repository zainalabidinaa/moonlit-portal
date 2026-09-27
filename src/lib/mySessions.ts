import { supabase } from './supabase';

export interface MySession {
  id: string;
  created_at: string;
  updated_at: string | null;
  user_agent: string | null;
  ip: string | null;
}

export type DevicePlatform = 'apple' | 'mac' | 'ios' | 'windows' | 'android' | 'linux' | 'other';

export interface DeviceInfo {
  /** "Moonlit app", "Safari on Mac", "Chrome on Windows"… */
  name: string;
  /** Secondary line, e.g. "iPhone, iPad or Mac" for the native app. */
  detail: string | null;
  kind: 'app' | 'browser' | 'unknown';
  platform: DevicePlatform;
}

/**
 * Names a session's device from its user agent. The native apps send the
 * same `Moonlit/… Darwin/…` pattern from iOS and macOS, so they read as one
 * "Moonlit app" entry; browsers are named by browser and operating system.
 */
export function describeDevice(ua: string | null): DeviceInfo {
  if (!ua) return { name: 'Unknown device', detail: null, kind: 'unknown', platform: 'other' };
  if (ua.startsWith('Moonlit/') || /\bMoonlit(Mac|App)?\//.test(ua)) {
    return { name: 'Moonlit app', detail: 'iPhone, iPad or Mac', kind: 'app', platform: 'apple' };
  }
  const platform: DevicePlatform =
    /iPhone|iPad|iPod/.test(ua) ? 'ios' :
    /Macintosh|Mac OS X/.test(ua) ? 'mac' :
    /Windows/.test(ua) ? 'windows' :
    /Android/.test(ua) ? 'android' :
    /Linux|CrOS/.test(ua) ? 'linux' : 'other';
  const os = { ios: /iPad/.test(ua) ? 'iPad' : 'iPhone', mac: 'Mac', windows: 'Windows', android: 'Android', linux: /CrOS/.test(ua) ? 'ChromeOS' : 'Linux', apple: 'Apple', other: '' }[platform];
  const browser =
    /Edg\//.test(ua) ? 'Edge' :
    /OPR\/|Opera/.test(ua) ? 'Opera' :
    /Firefox\/|FxiOS/.test(ua) ? 'Firefox' :
    /Chrome\/|CriOS/.test(ua) ? 'Chrome' :
    /Safari\//.test(ua) ? 'Safari' : null;
  if (!browser) return { name: os ? `${os} device` : 'Unknown device', detail: null, kind: 'unknown', platform };
  return { name: os ? `${browser} on ${os}` : browser, detail: null, kind: 'browser', platform };
}

/** Hides the last part of an IP so the page shows a rough origin, not the full address. */
export function maskIp(ip: string | null): string | null {
  if (!ip) return null;
  if (ip.includes('.')) return ip.split('.').slice(0, 2).join('.') + '.•.•';
  if (ip.includes(':')) return ip.split(':').slice(0, 3).join(':') + ':…';
  return ip;
}

/** The session id inside the current access token, to mark "This browser". */
export function currentSessionId(accessToken: string | undefined): string | null {
  if (!accessToken) return null;
  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.session_id === 'string' ? payload.session_id : null;
  } catch {
    return null;
  }
}

/**
 * The signed-in user's sessions, newest activity first. Returns null when
 * the `my_sessions` database function isn't installed yet, so the page can
 * fall back to showing just this browser.
 */
export async function loadMySessions(limit = 20): Promise<MySession[] | null> {
  const { data, error } = await supabase.rpc('my_sessions', { limit_count: limit });
  if (error) {
    if (error.code === 'PGRST202' || /my_sessions/.test(error.message)) return null;
    throw new Error(error.message);
  }
  return (data ?? []) as MySession[];
}

/** Ends every other session for this account; this browser stays signed in. */
export async function signOutOtherDevices(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: 'others' });
  if (error) throw new Error(error.message);
}
