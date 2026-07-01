// web/src/utils/cache.js
//
// Tiny TTL-based localStorage cache for NON-CRITICAL, read-only data only
// (GST lookups, company metadata, recent searches, UI prefs). Never cache auth,
// trust scores, or the trade list — those must always be read live/authoritative.
//
// Cutting repeat GST lookups + company reads is also the main guard on the
// Firebase budget (reads/egress dominate cost, not Storage).

const PREFIX = 'dotko:';
const VERSION = 'v1'; // bump to invalidate all cached entries after a schema change

function key(k) {
  return `${PREFIX}${VERSION}:${k}`;
}

/** Read a cached value, or null if missing/expired/corrupt. */
export function getCached(k) {
  try {
    const raw = localStorage.getItem(key(k));
    if (!raw) return null;
    const { value, exp } = JSON.parse(raw);
    if (exp && Date.now() > exp) {
      localStorage.removeItem(key(k));
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

/** Store a value with a TTL in ms. Silent on quota / serialization errors. */
export function setCached(k, value, ttlMs) {
  try {
    localStorage.setItem(key(k), JSON.stringify({ value, exp: ttlMs ? Date.now() + ttlMs : 0 }));
  } catch {
    /* quota exceeded or unavailable — caching is best-effort */
  }
}

/** Remove a cached entry. */
export function clearCached(k) {
  try { localStorage.removeItem(key(k)); } catch { /* noop */ }
}

// Common TTLs
export const TTL = {
  GST_LOOKUP: 24 * 60 * 60 * 1000, // 24h — registry data changes rarely
  COMPANY:    10 * 60 * 1000,      // 10m — instant back/forward nav
};
