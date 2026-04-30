// web/api/_rateLimit.js
const windows = new Map(); // key -> [{timestamp}]

export function rateLimit(key, maxRequests, windowMs) {
  const now = Date.now();
  const timestamps = (windows.get(key) || []).filter(t => now - t < windowMs);
  if (timestamps.length >= maxRequests) {
    return { limited: true, retryAfter: Math.ceil((timestamps[0] + windowMs - now) / 1000) };
  }
  timestamps.push(now);
  windows.set(key, timestamps);
  // Prevent unbounded growth
  if (windows.size > 10000) {
    const oldest = [...windows.keys()].slice(0, 1000);
    oldest.forEach(k => windows.delete(k));
  }
  return { limited: false };
}
