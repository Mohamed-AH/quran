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

## `raw_transcript` is discovery-mode only (field-verified, commit ec5cdc7)

`RecitationTracker` emits `{type:"raw_transcript"}` — the event our
transcript-alignment layer (`tilawa-build/src/align.js`) depends on — **only**
from `_handleDiscovery()`. `_handleTracking()` never emits it. Practically:
once the tracker locks onto ANY verse (right or wrong) it stops feeding our
alignment layer entirely until it exits tracking (advances, goes stale, or
gets reset) and returns to discovery.

This matters because pre-recitation noise can commit the tracker to a wrong
verse before the user starts (seen repeatedly in the field: commits like
`68:9`, `104:9`, `105:1` via `short_rescue`/weak acoustic evidence). While
stuck there, tilawa's own `transcribe` diagnostic can show the ACTUAL
recitation being decoded correctly at high confidence — but our alignment
layer never sees it, because tracking-mode suppresses `raw_transcript`. One
observed consequence: a verse whose text embeds the Basmala as its own first
words (a text-source convention — see `assets/tilawa/quran.json`, e.g. Surah
85 ayah 1 is 7 words: `بسم الله الرحمن الرحيم` + the actual verse content) can
end up with those opening words honestly reported as unconfirmed, even though
the reciter said them clearly, if the tracker happened to be stuck on a wrong
verse at that exact moment.

Mitigation in `js/recitation.js`'s wrong-track watchdog: react on the FIRST
confident off-range `verse_match` OR stable off-range `verse_candidate` while
`awaiting_start` (not the second — a wrong lock may only ever produce one
visible off-range event before going quiet in tracking mode), resetting the
tracker immediately to reopen the discovery window as early as possible.

## CSP note

If production hosting ever enables a Content-Security-Policy for static pages,
onnxruntime-web needs `'wasm-unsafe-eval'` in `script-src`.
