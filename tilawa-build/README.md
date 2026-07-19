# tilawa-build

Builds the inference Web Worker for the Recitation (تلاوة) feature. The rest of
the app has **no build step** — this folder exists only to bundle
[`@tilawa/core`](https://github.com/Mohamed-AH/tilawa) (vendored under
`vendor/tilawa-core/`, MIT) together with `onnxruntime-web` into a single
worker file. **The build output is committed**, so you only need to run this
when upgrading tilawa or onnxruntime.

## Rebuild

```bash
cd tilawa-build
npm install
npm run build     # writes js/vendor/tilawa-worker.js + js/vendor/ort/*
npm test          # coach state-machine tests (node --test)
```

## Outputs (committed)

| File | What |
|---|---|
| `js/vendor/tilawa-worker.js` | ESM worker bundle: `@tilawa/core` + ORT glue. Create with `new Worker(path, { type: "module" })`. |
| `js/vendor/ort/ort-wasm-simd-threaded.{mjs,wasm}` | ONNX Runtime WASM (single-threaded + SIMD). Loaded at runtime by the worker via `ort.env.wasm.wasmPaths`. |

The `.jsep`/`.jspi` ORT variants are deliberately excluded — the worker uses the
plain `wasm` execution provider only (single-threaded avoids the COOP/COEP
cross-origin-isolation requirement that the app's static hosting does not meet).

## The 88 MB ONNX model is NOT committed

`fastconformer_full_mixed.onnx` is downloaded at runtime by
`js/recitation-assets.js` and cached in the browser via the Cache Storage API.
Sources are ORDERED FALLBACK CHAINS in `CONFIG.TILAWA` (`js/config.js`),
same-origin first so the feature works on networks that block GitHub:

1. **Model**: `/api/tilawa/model` — the backend proxy
   (`backend/src/routes/tilawa.js`) downloads the model server-side once
   (upstream configurable via `TILAWA_MODEL_UPSTREAM`, default = the
   `Mohamed-AH/tilawa` Git LFS URL) and streams it from a disk cache.
   Fallback: the GitHub LFS URL directly (`media.githubusercontent.com`).
2. **JSON assets** (`vocab.json`, `quran.json`, `quran_ctc_tokens.json`):
   committed copies under `assets/tilawa/` (same commit as the vendored core),
   with `raw.githubusercontent.com` as fallback.

If you update the vendored core to a new tilawa commit, refresh the
`assets/tilawa/` copies from that commit too — the CTC token table, verse
text, and model must stay in sync.

## Updating the vendored core

`vendor/tilawa-core/src` is a copy of `packages/core/src` from
`Mohamed-AH/tilawa` (commit noted in `vendor/tilawa-core/package.json`). To
upgrade: copy the new `src/` over it, update the commit hash, rebuild, and
re-run `npm test` plus the harness page (`test-recitation.html`).

## Word-index alignment contract (verified against commit ec5cdc7)

Tilawa's `word_progress.matched_indices` index into `phoneme_words` (the
CTC-token-derived word split). The UI splits `text_uthmani` on whitespace and
**filters out tokens with no Arabic letters** (standalone waqf/annotation marks,
U+06D6–U+06ED); the remaining letter-bearing tokens align 1:1 with
`phoneme_words` for **all 6,236 verses** (verified 0 mismatches). Keep that
filter (`js/recitation-coach.js` `splitDisplayWords`) in sync if the verse data
source ever changes.

## CSP note

If production hosting ever enables a Content-Security-Policy for static pages,
onnxruntime-web needs `'wasm-unsafe-eval'` in `script-src`.
