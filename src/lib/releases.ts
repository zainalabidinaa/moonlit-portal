/**
 * Release facts for Moonlit for Mac. The version and download URL are the
 * ones the Download page and the devices section show; the appcast the Mac
 * app updates from is the source of truth for release notes.
 */
export const MAC_VERSION = '1.0.5';
export const MAC_DOWNLOAD_URL = `/downloads/Moonlit-${MAC_VERSION}.dmg`;
export const MAC_MIN_OS = 'macOS 14 or later';
export const TESTFLIGHT_URL = 'https://testflight.apple.com/join/9HSBA4vz';

export interface ReleaseNote {
  version: string;
  date: string;
  items: string[];
}

/**
 * Parses the Sparkle appcast at /appcast.xml into release notes, newest
 * first. Returns [] when the feed is unreachable or malformed.
 */
export async function fetchReleaseNotes(limit = 3): Promise<ReleaseNote[]> {
  try {
    const res = await fetch('/appcast.xml');
    if (!res.ok) return [];
    const xml = new DOMParser().parseFromString(await res.text(), 'application/xml');
    const items = Array.from(xml.querySelectorAll('item')).slice(0, limit);
    return items.map((item) => {
      const version =
        item.getElementsByTagNameNS('*', 'shortVersionString')[0]?.textContent?.trim() ||
        item.querySelector('title')?.textContent?.replace(/^Version\s+/i, '').trim() ||
        '';
      const pub = item.querySelector('pubDate')?.textContent?.trim();
      const date = pub ? new Date(pub).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
      const html = item.querySelector('description')?.textContent ?? '';
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const notes = Array.from(doc.querySelectorAll('li')).map((li) => li.textContent?.trim() ?? '').filter(Boolean);
      return { version, date, items: notes };
    }).filter((r) => r.version && r.items.length > 0);
  } catch {
    return [];
  }
}
