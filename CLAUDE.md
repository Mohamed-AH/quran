# Hafiz — Tilawa Recitation Coach: Architecture Rewrite (living doc)

This file is the durable record of the in-progress coach rewrite. It survives
context compaction and model changes — **read this file first** when resuming
this work after a break, before re-deriving anything from git history or logs.

Branch: `claude/tilawa-recitation-feature-bm7gjt`, repo `Mohamed-AH/quran`.

## Why this rewrite is happening

The app's purpose (user's words): *"the entire purpose of this app is to help
folks who memorize realize if they have skipped any verses before they recite
to a real ustad. so it is a must to know if any verse has been skipped."*
False positives (flagging correct recitation) are an accepted tradeoff —
missing a real skip is the worse failure. And: *"Try to mimic a real ustad.
He is going to listen each verse and judge if it is correct or not. He is not
going to listen the first word he hears and jump to some wild goose chase."*

Every distinct bug found this project (false starts, verses credited "done"
with zero content confirmation, boundary mislabeling, missed skips, a session
scored 100% after two genuine skips + a wrong-surah recitation) traced back to
one root cause: `RecitationTracker`'s own verse-identity logic (`commit`,
`advance_decision`, position/timing fallback advancement) was built to keep a
cursor roughly in place, tolerating noise — not to *verify* correctness.

**Proof it's structural, not tunable**: field log Log15.txt (Surah 78/An-Naba,
build `2026-07-21m`) — verses 8 and 10 genuinely skipped (their real words
never appear in any decoded audio), verse 16 replaced with unrelated Surah 80
vocabulary. All three credited as done. All three show the *exact same* raw
signal (0 real lexical matches, 1-4 fallback-only tracking cycles) as verses
from other sessions that were genuinely recited correctly. Confirmed
empirically across 24 real per-verse data points: no threshold on that signal
separates "genuinely correct, sparse" from "genuinely wrong, mechanically
advanced."

**Decision**: stop trusting the tracker for verse identity/scoring. Use tilawa
purely for transcription (its CTC decode is reliable and keeps flowing in both
discovery and tracking mode — confirmed directly from field logs, unlike
`raw_transcript` which tracking mode suppresses). Build our own alignment
logic on top, modeled on a real ustad: capture one ayah, evaluate it once
against the correct text, give specific feedback — and when evidence is
genuinely ambiguous, say so plainly ("we heard X, this should be Y — you
decide") instead of forcing a verdict we can't stand behind.

## What stays, what goes

**Unchanged**: audio capture (`js/recitation-audio.js`), the ONNX/CTC decode,
the worker's audio buffering/VAD/batching engineering (`feed()`, `resetEpoch`,
`drainLoop` in `tilawa-build/src/worker-entry.js`), `quran.json`, the UI shell
(`js/recitation.js`, debug panel), and — critically —
`tilawa-build/src/align.js`'s `alignTranscript()` (semi-global Levenshtein
alignment; `matched`/`fuzzy`/`substituted`/`missing` verdicts; anchor-trimming
so ragged fragment edges aren't treated as evidence). This becomes the *core*
of the new engine instead of a disabled side feature.

**Retired** (once the new engine passes all regression cases — not before):
`js/recitation-coach.js`'s tracker-vocabulary state machine — `spanEvidence`,
forward-jump hysteresis on `verse_match`, the per-verse `lex_check`/
`_looksUnverified` fallback-counting gate, `tracking_abandoned` handling,
`passage-complete` driven by tilawa's `word_progress`. All of it exists to
compensate for the tracker's own unreliable verse-identity conclusions.

## New architecture

**1. Continuous decoded text is the primary signal.** The `transcribe`
diagnostic fires every decode cycle in both tracker modes. Forwarded
always-on (not debug-gated) as a new worker event:

```js
{ type: "decoded_text", text, audioSec, tokenCount, champion }
```

Fields are exactly what tilawa's `transcribe()` actually emits
(`tilawa-build/vendor/tilawa-core/src/index.ts:133`) — no invented
`confidence`/`is_final_chunk` fields; `champion` (whole-utterance match +
score) is the closest thing to a confidence signal tilawa gives us, and it's
per-utterance, not per-word.

**Important verified detail**: `text` is a full greedy re-decode of
`utteranceAudio`, a **sliding window** capped at
`trackingMaxWindowSec`/`discoveryMaxWindowSec` seconds
(`tilawa-core/src/tracker.ts:553-564`), not a growing full-session buffer and
not incremental deltas. Consequences for Phase 2:
- Each `decoded_text` event is a full re-decode of recent audio — trailing
  tokens revise cycle over cycle (stream jitter is real and expected, not a bug).
- Once audio ages out of the window, its words disappear from `text` even
  though they were genuinely recited — the coach must capture/evaluate an
  ayah's evidence *while it's in-window*, not assume it'll still be visible later.
- The window can span a verse boundary: tail of ayah N + growing head of
  ayah N+1 both appear in the same `text` string. This is real boundary
  leakage risk (see refinement below), not a hypothetical.

**2. Ayah-by-ayah capture, then evaluate.** Coach core (replacing most of
`js/recitation-coach.js`) tracks a current-ayah pointer over the picked
passage's known word list. Every incoming `decoded_text` is aligned via
`alignTranscript()` against a window of `[current ayah, +1..2 lookahead]`
(generalizing `expectedWindow()` in `worker-entry.js`, which currently only
runs on discovery-mode `raw_transcript` — must run continuously off
`decoded_text` instead). Per-word verdicts accumulate as evidence arrives.

An ayah's capture window **closes** — mirroring a listener recognizing the
reciter moved on — once alignment evidence has clearly and *stably* shifted
onto the next ayah's words, or a pause is detected. At that point the ayah is
evaluated **once**, on its frozen accumulated evidence, and the pointer
advances. Not a continuously-revised running guess.

**3. Three-tier per-ayah verdict** (resolves the calibration problem — no
deliberately-wrong-audio corpus exists to tune a hard fuzzy/substituted
threshold against):
- **Correct** — high word coverage, high alignment confidence.
- **Mistake** — specific and confident: missing word(s), substituted word(s)
  (`alignTranscript` already reports heard-vs-expected pairs), or a full
  **skip** (near-zero coverage before next ayah's content is confidently present).
- **Uncertain / needs your review** — coverage/confidence lands in the murky
  middle. Surface raw heard text next to expected text; let the reciter judge.
  Ambiguous cases go to the human instead of being silently misclassified
  either direction.

**4. Skip detection falls out directly**: if the pointer has confident
coverage on ayah N+1 while ayah N's window closed with near-zero coverage,
ayah N is skipped. This is the exact mechanism that would have caught
An-Naba 8 and 10.

**5. UI**: new "uncertain" status chip alongside done/skipped, with a
heard-vs-expected detail view (user-facing, not just debug) — extends the
existing verse-list chip pattern in `js/recitation.js`.

## Refinements adopted from external review (2026-07-22)

A second opinion reviewed this plan and flagged three real risks. Verified
each against actual tilawa source before adopting:

1. **Boundary leakage** (confirmed real, see sliding-window detail above):
   don't close ayah N's window on the first transient sign of ayah N+1
   content. Require the alignment's confident coverage of ayah N+1 to be
   **stable across ≥2 consecutive `decoded_text` cycles** before closing
   ayah N's evaluation — a single transient match can be sliding-window
   noise, not a real boundary.
2. **Short vs. long ayahs**: a single misdecode on a 2-3 word ayah (e.g.
   An-Naba 8: "وخلقنكم ازواجا") swings coverage % wildly more than the same
   error on a long ayah. Don't use a flat coverage ratio for the
   correct/mistake/uncertain split — scale the tolerance by ayah length
   (short ayahs need near-exact match for "Correct"; long ayahs can average
   over more words before the ratio moves much). Exact bucket boundaries are
   a Phase 2 implementation/calibration detail, not frozen here.
3. **Stream jitter / prefix instability**: this is inherent to re-decoding a
   sliding window every cycle (confirmed above), not an edge case. Never
   emit a final verdict off a mid-stream snapshot — only evaluate once an
   ayah's window has closed (per refinement 1), on the last stable
   `decoded_text` that still had that ayah in-window.

Rejected/adjusted from the review: the suggested `decoded_text` schema
(`confidence`, `is_final_chunk`, `timestamp`) doesn't match what tilawa
actually emits — used the real fields instead (see above). The
"is_final_chunk" concept doesn't apply since there are no discrete chunks,
only sliding-window re-decodes.

## Validation strategy

- Convert real field logs (Surah 78/87/86/85/21 and others, already
  hand-verified against ground truth this project) into synthetic replay
  fixtures: feed their raw `transcribe` text sequences straight into the new
  engine (bypassing ONNX), assert the now-known-correct verdict (e.g. Surah 78
  must show ayahs 8 and 10 skipped, ayah 16 uncertain-or-wrong — never 100%).
- Keep the real-ONNX e2e suite (`scratchpad/e2e/`) re-verified against the
  clean fixture corpus (An-Naas, Al-Falaq, Ya-Sin, Ar-Rahman, Al-Mulk, Al-Asr)
  — zero false mistakes on correct recitation.
- **Always verify the actual compiled worker bundle** end-to-end
  (`scratchpad/e2e/realworker.mjs` / `realworker_multi.mjs`, which dynamically
  import the real `js/vendor/tilawa-worker.js`), never a hand-mirrored copy of
  the diagnostic-forwarding logic — a hand-mirrored copy is exactly what let
  the `event`/`data.type` bug (see below) hide for an entire session.

## Open implementation calls (defaults; flag if going differently)

- Keep tilawa's `feed()`/`RecitationTracker` running for audio engineering
  (buffering, VAD, realtime batching) and simply ignore its verse-identity
  output, rather than rebuilding VAD from scratch.
- Ayah-boundary "pause" detection reuses existing mic-level/silence signals
  as a secondary cue; content-based alignment shift (per refinement 1 above)
  is the primary boundary signal, since real recitation often flows
  verse-to-verse without a clean pause (wasl).

## Phased delivery — status

- [x] **Phase 0 — root cause + plan**: traced every prior bug to tracker
  verse-identity heuristics; proved it's structural via Log15.txt; user
  confirmed full architecture change with ayah-by-ayah + three-tier verdict
  design.
- [x] **Phase 1 — foundation**: make `transcribe` an always-on forwarded
  `decoded_text` event. No coach behavior change — confirmed inert (existing
  81 unit tests unaffected; new event type isn't consumed by the coach yet).
  - [x] `worker-entry.js`: header doc comment updated; `onDiagnostic` now
    forwards every `transcribe` diagnostic as `decoded_text` unconditionally
    (not debug-gated).
  - [x] Rebuilt `js/vendor/tilawa-worker.js` (`cd tilawa-build && node build.mjs`).
  - [x] `npm test` in `tilawa-build/` — 80/80 pass, no regressions.
  - [x] Verified via a NEW real-bundle harness
    (session scratchpad `e2e/realworker.mjs` — mocks `self`, dynamically
    imports the actual compiled `js/vendor/tilawa-worker.js`, real ONNX via
    onnxruntime-web/wasm, real audio `multi_036_001_005.wav` — Ya-Sin 36:1-5):
    22 `decoded_text` events over a 28.6s session, all non-empty text, first
    at message #2 and last at #48 of 51 total worker messages — confirms
    continuous coverage across both discovery and tracking mode, exactly the
    Phase 1 exit criterion. Zero errors.
    (Note: `scratchpad/e2e/e2e.mjs`, the OLD hand-mirrored harness, currently
    fails to even load — `@tilawa/core`'s package resolution is broken for
    plain `node --test`/`node` in this environment, unrelated to this change.
    Not worth fixing: the real-bundle harness is the authoritative one per
    this doc's own validation strategy; e2e.mjs's hand-mirrored diagnostic
    logic is exactly what hid the event/data.type bug for a whole session.)
  - Build stamp NOT bumped yet — deliberately deferred to Phase 4 cutover
    per the phased-delivery plan (this change is inert until Phase 2 wires
    `decoded_text` into actual coach behavior; bumping now would be pure
    version churn with no user-visible effect).
- [ ] **Phase 2 — core engine**: ayah-capture-and-evaluate state machine,
  three-tier verdict, direct skip detection, boundary-stability refinement,
  short-ayah threshold scaling. Validate against field-log replay fixtures +
  clean e2e corpus together. NOT STARTED.
  - Scope note: `expectedWindow()`'s generalization (running continuously off
    `decoded_text` instead of discovery-only `raw_transcript`) belongs HERE,
    not Phase 1 — emitting word-level verdicts continuously without the
    boundary-close gate would just re-surface the stream-jitter problem
    (refinement #3 above) with no evaluation discipline. Build the
    capture/close/evaluate-once logic and the continuous window read
    together, not the window read alone first.
- [ ] **Phase 3 — UI**: uncertain/review chip + heard-vs-expected detail in
  `js/recitation.js`. NOT STARTED.
- [ ] **Phase 4 — cutover**: remove retired tracker-dependent logic once new
  engine passes every known regression case; bump `CONFIG.TILAWA.BUILD` +
  all HTML `?v=` stamps; commit; push. NOT STARTED.

## Known landmines (don't re-learn these the hard way)

- **`event` vs `data.type`**: tilawa wraps ALL tracker diagnostics as
  `onDiagnostic("tracker", {...theRealDiagnostic})` — `event` is always the
  literal string `"tracker"`; the real type is `data.type`. The one exception:
  `transcribe` is dispatched directly, so `event === "transcribe"` IS
  meaningful there. Getting this backwards silently disables whatever
  depends on it — it did, for this project, for a long time.
- **`raw_transcript` vs `transcribe`**: `raw_transcript` (tracker's own event)
  only fires in discovery mode. `transcribe` fires every cycle in both modes.
  Anything meant to run continuously must key off `transcribe`/`decoded_text`.
- **Hand-mirrored test harnesses lie**: `scratchpad/e2e/e2e.mjs` hand-mirrors
  the worker's diagnostic-forwarding logic and can carry the same bug the
  real bundle has (or had) — it gave false confidence for a long time. Trust
  `realworker.mjs`/`realworker_multi.mjs` (real compiled bundle, real ONNX)
  over it.
- **`tracking_abandoned` false-positives on normal session end**: `stale_exit`
  also fires on the tracker's ordinary end-of-session flush, not just genuine
  give-up. Any logic reacting to it needs to distinguish "gave up mid-passage"
  from "recitation legitimately just ended."
- **Cache-busting is manual**: no HTML build step exists. Every recitation
  change requires bumping `CONFIG.TILAWA.BUILD` in `js/config.js` *and* the
  `?v=` query string on `WORKER_PATH` and every `<script src="js/...">` tag in
  `app.html`/`admin.html`/`callback.html`/`index.html`/`test-recitation.html`.
