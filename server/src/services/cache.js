/**
 * Small in-process cache for expensive, per-user reads like analytics (guide §04).
 * - TTL with random jitter, so entries don't all expire in the same second (cache avalanche).
 * - Request coalescing: concurrent misses for the same key share one computation (cache stampede).
 * - Invalidated as soon as the user's data changes (stale data); short TTL bounds staleness on other instances.
 * - Bounded size with oldest-first eviction (cache out of memory).
 * If the loader fails, nothing is cached and the error goes to the caller.
 */
const MAX_ENTRIES = 5000;
const store = new Map(); // key -> { value, expires }
const inflight = new Map(); // key -> Promise
const userKeys = new Map(); // userId -> Set<key>

export const cache = {
  async getOrLoad(userId, key, ttlMs, loader) {
    const full = `${userId}:${key}`;
    const hit = store.get(full);
    if (hit && hit.expires > Date.now()) return hit.value;
    if (inflight.has(full)) return inflight.get(full);
    const p = (async () => {
      try {
        const value = await loader();
        if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value);
        store.set(full, { value, expires: Date.now() + ttlMs + Math.floor(Math.random() * ttlMs * 0.2) });
        if (!userKeys.has(String(userId))) userKeys.set(String(userId), new Set());
        userKeys.get(String(userId)).add(full);
        return value;
      } finally {
        inflight.delete(full);
      }
    })();
    inflight.set(full, p);
    return p;
  },
  invalidateUser(userId) {
    const keys = userKeys.get(String(userId));
    if (!keys) return;
    for (const k of keys) store.delete(k);
    userKeys.delete(String(userId));
  },
  stats: () => ({ entries: store.size, inflight: inflight.size }),
};
