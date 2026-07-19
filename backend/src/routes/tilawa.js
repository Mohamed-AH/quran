/**
 * Tilawa Model Proxy
 *
 * GET /api/tilawa/model — serves the recitation-recognition ONNX model
 * (~88 MB) from a server-side cache, downloading it once from the upstream
 * URL. This lets browsers on networks that block GitHub (corporate proxies,
 * firewalls) fetch the model from the app's own origin; the static-site
 * deployment rewrites /api/* to this backend, so the request is same-origin
 * from the client's perspective.
 *
 * Public route (a static asset — no authentication).
 * Upstream override: TILAWA_MODEL_UPSTREAM env var (e.g. an internal mirror).
 */

const express = require('express');
const fs = require('fs');
const fsp = require('fs').promises;
const os = require('os');
const path = require('path');
const https = require('https');
const http = require('http');

const router = express.Router();

const MODEL_BYTES = 88307366;
const DEFAULT_UPSTREAM =
  'https://media.githubusercontent.com/media/Mohamed-AH/tilawa/ec5cdc72c1c48ba29866ca2e3197d6b9a0e2e793/web/frontend/public/fastconformer_full_mixed.onnx';

const cacheDir = path.join(os.tmpdir(), 'hafiz-tilawa');
const cachePath = path.join(cacheDir, 'fastconformer_full_mixed.onnx');

let downloadPromise = null; // concurrent first requests share one download

function upstreamUrl() {
  return process.env.TILAWA_MODEL_UPSTREAM || DEFAULT_UPSTREAM;
}

/** Follow redirects (GitHub → CDN) and stream the body to a file. */
function fetchToFile(url, destination, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const request = client.get(url, (response) => {
      if (
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        response.resume();
        if (redirectsLeft <= 0) return reject(new Error('Too many redirects'));
        return resolve(fetchToFile(response.headers.location, destination, redirectsLeft - 1));
      }
      if (response.statusCode !== 200) {
        response.resume();
        return reject(new Error(`Upstream HTTP ${response.statusCode}`));
      }
      const out = fs.createWriteStream(destination);
      response.pipe(out);
      out.on('finish', () => out.close(resolve));
      out.on('error', reject);
      response.on('error', reject);
    });
    request.on('error', reject);
    request.setTimeout(120000, () => request.destroy(new Error('Upstream timeout')));
  });
}

async function isCacheValid() {
  try {
    const stat = await fsp.stat(cachePath);
    return stat.size === MODEL_BYTES;
  } catch (err) {
    return false;
  }
}

async function ensureModelCached() {
  if (await isCacheValid()) return;
  if (!downloadPromise) {
    downloadPromise = (async () => {
      await fsp.mkdir(cacheDir, { recursive: true });
      const partPath = `${cachePath}.part`;
      console.log(`Tilawa model cache miss — downloading from ${upstreamUrl()}`);
      try {
        await fetchToFile(upstreamUrl(), partPath);
        const stat = await fsp.stat(partPath);
        if (stat.size !== MODEL_BYTES) {
          throw new Error(`Truncated model download: ${stat.size} of ${MODEL_BYTES} bytes`);
        }
        await fsp.rename(partPath, cachePath); // atomic publish
        console.log('Tilawa model cached successfully');
      } catch (err) {
        await fsp.unlink(partPath).catch(() => {});
        throw err;
      }
    })().finally(() => {
      downloadPromise = null;
    });
  }
  return downloadPromise;
}

router.get('/model', async (req, res) => {
  const started = Date.now();
  const wasCached = await isCacheValid();
  console.log(`[tilawa] model requested (server cache ${wasCached ? 'HIT' : 'MISS'})`);
  res.on('finish', () => {
    console.log(`[tilawa] model response ${res.statusCode} in ${Date.now() - started}ms`);
  });
  try {
    await ensureModelCached();
  } catch (err) {
    console.error(`Tilawa model fetch failed: ${err.message}`);
    return res.status(502).json({
      success: false,
      error: 'Model upstream unavailable',
    });
  }

  res.set({
    'Content-Type': 'application/octet-stream',
    'Content-Length': String(MODEL_BYTES),
    'Cache-Control': 'public, max-age=31536000, immutable',
  });
  const stream = fs.createReadStream(cachePath);
  stream.on('error', (err) => {
    console.error(`Tilawa model stream error: ${err.message}`);
    if (!res.headersSent) res.status(500).end();
    else res.destroy();
  });
  stream.pipe(res);
});

module.exports = router;
