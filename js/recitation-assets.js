/**
 * Asset loader for the Recitation (تلاوة) feature.
 *
 * Downloads the tilawa ONNX model + JSON assets (URLs in CONFIG.TILAWA) with
 * streamed progress reporting and caches them via the Cache Storage API so the
 * 88 MB model is fetched only once per device.
 *
 * Global namespace object, same convention as `api` / `storage` / `ui`.
 */

const recitationAssets = {
  _quranPromise: null,

  isSupported() {
    return (
      typeof WebAssembly !== 'undefined' &&
      typeof Worker !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    );
  },

  _assetUrl(name) {
    return CONFIG.TILAWA.ASSET_BASE + CONFIG.TILAWA.ASSETS[name];
  },

  async _openCache() {
    if (typeof caches === 'undefined') return null; // e.g. non-secure context
    try {
      return await caches.open(CONFIG.TILAWA.CACHE_NAME);
    } catch (err) {
      debug.warn('Cache Storage unavailable:', err);
      return null;
    }
  },

  /** Drop caches from older tilawa versions (different CACHE_NAME). */
  async sweepStaleCaches() {
    if (typeof caches === 'undefined') return;
    try {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith('tilawa-') && n !== CONFIG.TILAWA.CACHE_NAME)
          .map((n) => caches.delete(n))
      );
    } catch (err) {
      debug.warn('cache sweep failed:', err);
    }
  },

  /** True if the model is already in Cache Storage (no download needed). */
  async isModelCached() {
    const cache = await this._openCache();
    if (!cache) return false;
    return !!(await cache.match(CONFIG.TILAWA.MODEL_URL));
  },

  /**
   * Fetch a URL as ArrayBuffer with progress callbacks and Cache Storage.
   * expectedBytes (optional) rejects truncated downloads before caching.
   * onProgress(loaded, total) — total is 0 when Content-Length is unknown.
   */
  async fetchWithProgress(url, { expectedBytes = 0, onProgress = null } = {}) {
    const cache = await this._openCache();
    if (cache) {
      const hit = await cache.match(url);
      if (hit) {
        const buf = await hit.arrayBuffer();
        if (!expectedBytes || buf.byteLength === expectedBytes) return buf;
        await cache.delete(url); // stale/corrupt entry — refetch
      }
    }

    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }

    let buffer;
    const total =
      expectedBytes || parseInt(response.headers.get('Content-Length') || '0', 10) || 0;
    if (response.body && typeof response.body.getReader === 'function') {
      const reader = response.body.getReader();
      const chunks = [];
      let loaded = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.byteLength;
        if (onProgress) onProgress(loaded, total);
      }
      buffer = new Uint8Array(loaded);
      let offset = 0;
      for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.byteLength;
      }
      buffer = buffer.buffer;
    } else {
      buffer = await response.arrayBuffer();
      if (onProgress) onProgress(buffer.byteLength, total);
    }

    if (expectedBytes && buffer.byteLength !== expectedBytes) {
      throw new Error(
        `Truncated download for ${url}: got ${buffer.byteLength}, expected ${expectedBytes}`
      );
    }

    if (cache) {
      try {
        await cache.put(url, new Response(buffer.slice(0), {
          headers: { 'Content-Type': 'application/octet-stream' },
        }));
      } catch (err) {
        // QuotaExceededError etc. — keep going without caching.
        debug.warn('cache.put failed (continuing uncached):', err);
      }
    }

    return buffer;
  },

  /** The full verse dataset (6,236 records). Cached in memory + Cache Storage. */
  async getQuranData() {
    if (!this._quranPromise) {
      this._quranPromise = this.fetchWithProgress(this._assetUrl('quran'))
        .then((buf) => JSON.parse(new TextDecoder('utf-8').decode(buf)))
        .catch((err) => {
          this._quranPromise = null; // allow retry
          throw err;
        });
    }
    return this._quranPromise;
  },

  /**
   * Load everything the worker needs. onProgress receives
   * { stage: 'assets'|'model', loaded, total } — the model dominates.
   */
  async loadAll(onProgress) {
    await this.sweepStaleCaches();

    const [vocabBuf, tokensBuf, quran] = await Promise.all([
      this.fetchWithProgress(this._assetUrl('vocab')),
      this.fetchWithProgress(this._assetUrl('quranCtcTokens'), {
        onProgress: (loaded, total) =>
          onProgress && onProgress({ stage: 'assets', loaded, total }),
      }),
      this.getQuranData(),
    ]);

    const model = await this.fetchWithProgress(CONFIG.TILAWA.MODEL_URL, {
      expectedBytes: CONFIG.TILAWA.MODEL_BYTES,
      onProgress: (loaded, total) =>
        onProgress && onProgress({ stage: 'model', loaded, total }),
    });

    const decode = (buf) => JSON.parse(new TextDecoder('utf-8').decode(buf));
    return {
      model,
      vocab: decode(vocabBuf),
      quranCtcTokens: decode(tokensBuf),
      quran,
    };
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = recitationAssets;
}
