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
- [x] **Phase 2 — core engine**: ayah-capture-and-evaluate state machine,
  three-tier verdict, direct skip detection, boundary-stability refinement,
  short-ayah threshold scaling.
  - `worker-entry.js`: `maybeEmitWordVerdicts` now triggers off
    `decoded_text` (continuous, both modes) instead of discovery-only
    `raw_transcript`; `word_verdicts` now also carries the raw `text` so the
    'unverified' tier can show heard-vs-expected detail. `expectedWindow()`
    itself was already cursor-driven and needed no change.
  - `js/recitation-coach.js`: rewritten. `handleEvent` now only meaningfully
    processes `word_verdicts` and `final_sequence` — `verse_match`,
    `word_progress`, `verse_candidate`, `lex_check`, `tracking_abandoned`
    are documented no-ops (tilawa's tracker keeps running for audio capture
    only; `verse_candidate`/`verse_match` are still used ONLY by
    `anchorFromEvent` to pick where an un-anchored freestyle session
    starts — never to judge correctness). Retired entirely: spanEvidence,
    forward-jump hysteresis, the lex_check/fallback-counting gate,
    tracking_abandoned retraction, the old progress-high-water-mark model,
    per-word repetition tracking. Coverage is now purely
    `matched.size` from real alignment evidence; `missedWordIndices`/
    `substitutedWords` read straight off `wordFlags`.
  - Status string: kept as `'unverified'` (not `'uncertain'`) internally so
    the existing live per-verse chip in `js/recitation.js` (which already
    has an 'unverified' chip) keeps working unchanged. `summary.repeats` is
    always `{}` now (repetition tracking retired) — kept only so
    `js/recitation.js`'s `Object.values(sum.repeats)` doesn't crash on the
    old field name. `CONFIG.FEATURES.WORD_VERDICTS` removed (word_verdicts
    is now foundational, not an opt-in accusation layer).
  - Tests: `tilawa-build/test/coach.test.mjs` fully rewritten (34 tests,
    all against the new `word_verdicts`-driven engine); `align.test.mjs`
    (8 tests, alignment engine itself) untouched and still passing.
  - **Real bug found and fixed during this rewrite**: `_start()` used to
    evaluate earlier-verse evidence and decide whether to fire before that
    same message's own verdicts were applied to `perVerse` — meaning a
    fragment carrying real evidence for an earlier ayah in the SAME message
    that finally crosses the start threshold couldn't get credit yet. Fixed
    by accumulating all verdicts into `perVerse` first, then deciding
    start/advance off the now-current state.
  - **Real-ONNX integration validation** (new harness,
    `scratchpad/e2e/realcoach.mjs` — drives the actual compiled worker
    bundle AND the actual production `js/recitation-coach.js` together, no
    hand-mirrored logic) — FULL RUN, all 7 real clean fixtures:
    Al-Falaq 113:1-5 → 100 (all done, zero skips); An-Nas 114:1-6 → 100;
    Ar-Rahman 55:1-4 → 100; Al-Mulk 67:1-4 → 100; Al-Asr 103:1-3 → 100;
    Fatiha 1:1-only-then-stop → verse 1 done, verses 2-7 correctly
    'not reached' (NOT skipped) — the stop-early-is-not-an-accusation
    behavior works. 6 of 7 fixtures: zero false skips, zero false
    mistakes. **The one exception**: Ya-Sin 36:1-5 produced a real false
    skip on ayah 4 ("عَلَىٰ صِرَٰطٍ مُّسْتَقِيمٍ", 3 words) — zero
    alignment coverage ever landed on it before evidence for ayah 5
    stabilized. Ayah 1 in the same fixture (embeds the Basmala + the
    standalone letter "يٓسٓ") correctly landed in the 'unverified' tier
    rather than being force-called either way — heard "ل والقر الرحمن
    الرحيم" vs expected "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ يسٓ", an
    honest call given "يس" (a 2-letter mystical/muqatta'at word) is a
    genuinely hard ASR target — this is the NEW tier working as designed,
    not a bug.
    The ayah-4 false skip is a real, open calibration gap: a short
    (<=3-word) ayah sandwiched between two others can end up with zero
    anchors if the alignment window's anchor-trimming happens to land on
    its neighbors — plausibly aggravated here by ayah 1's own decode
    trouble disrupting the alignment window shortly before. Per the user's
    explicitly stated priority, a false skip on genuinely correct audio is
    an ACCEPTED tradeoff (worse than missing a real skip, better than
    crediting one) — so 1 false skip out of 7 clean fixtures (all other 6
    perfect) does not block calling Phase 2 functionally complete, but it
    is a concrete, real (not hypothetical) follow-up: consider whether
    short ayahs need a wider/dedicated capture window, or whether
    zero-coverage-at-close should get one extra decode cycle of grace
    before finalizing 'skipped' when the ayah is short. NOT yet tuned — do
    not blind-guess a threshold fix here; the same "premature calibration
    without a real corpus" mistake from the old tracker-fallback gate
    applies equally to a new signal.
- [ ] **Phase 3 — UI**: uncertain/review chip + heard-vs-expected detail in
  `js/recitation.js`. NOT STARTED.
- [ ] **Phase 4 — cutover**: remove retired tracker-dependent logic once new
  engine passes every known regression case; bump `CONFIG.TILAWA.BUILD` +
  all HTML `?v=` stamps; commit; push. NOT STARTED.

## Phase 2 hotfix — stuck-cursor blind spot (2026-07-22, Log16.txt)

User tested Phase 2 live (build `2026-07-21m`, Surah 94/Ash-Sharh 1-8):
reported "very poor result and did not auto stop" despite reciting the
whole passage. `Log16.txt`'s raw `transcribe` log proved it: ayahs 4-8 were
decoded almost perfectly by ~36s into a 102s session, but the coach's
cursor never left ayah 1 (`milestones` shows "now on ayah 1" exactly once).
Final summary: only ayah 1 done, ayahs 2-3 'unverified' off contaminated
early evidence, ayahs 4-8 wrongly reported 'not reached', score 90, no
auto-stop (needs `cursor === ayahEnd`, unreachable).

**Root cause**: both `expectedWindow()` (worker-entry.js) and the coach's
advance-candidate scan (`_onWordVerdicts` in recitation-coach.js) capped
the post-start lookahead at `cursorAyah + 2`. Ayah 1's own decode was
messy (a hard-to-transcribe short opening line) and never produced 2
stable matched words on ayah 2 or 3 — so the cursor never advanced. Once
stuck, the window never widened, so genuine evidence for ayahs 4-8 was
**never even compared** against the right expected words for the rest of
the session — not a scoring error, a total blind spot. This is worse than
any single false skip: it can silently discard most of a correct session.

**Fix**: both the worker's window and the coach's candidate scan now
cover the FULL remaining range (`[cursor, ayahEnd]`), not `cursor+2`.
`MAX_WINDOW_WORDS` raised 64→96 for headroom. `align.js`'s own
`MIN_ANCHORS` gate and the coach's existing 2-consecutive-cycle stability
requirement are the real guards against a coincidental far-ahead match —
a tight window was never actually buying safety, just creating this blind
spot. New regression test in `coach.test.mjs` ("a stuck cursor can still
catch up to evidence far beyond the old +2 lookahead") directly
reproduces the Log16.txt failure pattern and confirms the fix — cursor
now reaches ayah 6 from a stuck ayah 1 in one shot. All 35 unit tests
pass. Re-ran the real-ONNX clean-fixture suite — Al-Falaq and Ya-Sin
confirmed unaffected/unchanged (Ya-Sin's separate short-ayah false-skip
finding, above, persists unchanged — confirms it's a distinct issue, not
caused by this bug); full 7-fixture re-run confirmed clean — identical
results to the pre-fix run (6/7 perfect, Ya-Sin's ayah-4 issue unchanged)
— the widened window introduced zero regressions across the whole corpus.
Build stamp bumped to `2026-07-22a` (config.js + all HTML `?v=` tags) —
this is a real, user-visible fix, unlike Phase 1/2's initial landing
which was deliberately left unstamped.

## Phase 2.5 — pivot to "record, then evaluate once" (2026-07-22, Log17.txt)

User tested again (`Log17.txt`, Surah 101/Al-Qari'ah 1-11): "problem
persists, skipped verse not detected." Traced first: `Log17.txt`'s
`build`/`workerBuild` both read `2026-07-21m` — the stuck-cursor hotfix
above (`2026-07-22a`) had NOT reached this deploy yet (Render lag or a
pre-refresh test). So this specific log is NOT proof the hotfix failed —
same failure shape (cursor stuck at ayah 3 the whole session, milestones
show "now on ayah 3" exactly once, ayahs 5-11 never reached) as the
already-fixed bug.

Independent of that, the user proposed a bigger simplification: stop
judging ayah-by-ayah live at all. Wait for the whole recitation (manual
start/stop, no auto-stop), then evaluate. Rationale, and it's a fair one:
every bug this project has hit for several rounds running — stuck cursor,
boundary leakage, stability-window tuning, auto-stop timing — traces to
the same source, trying to decide verse status WHILE still streaming and
noisy. Confirmed and agreed to implement.

**New model** (supersedes "Ayah-by-ayah capture, then evaluate" and the
"3-tier verdict" mechanics in the New architecture section above — the
three-tier verdict ITSELF is unchanged, only WHEN it's computed):
- No live cursor, no advance-candidate scan, no stability-cycle gate, no
  passage-complete/auto-stop. The reciter drives start/stop manually.
- tilawa's decode keeps flowing continuously the whole session exactly as
  before (`decoded_text`/`word_verdicts` — unaffected, still fires every
  cycle in both modes). What changed is scope and timing: `expectedWindow()`
  in `worker-entry.js` is now STATIC — always the full picked passage,
  from session start, not cursor-relative at all. The `{type:'cursor'}`
  message and `cursorAyah` state are removed entirely from the worker —
  nothing to widen or get stuck anymore, because there's no narrow window
  to begin with.
- `js/recitation-coach.js`: `_onWordVerdicts` now ONLY accumulates
  evidence (matched/wordFlags/lastHeardText per ayah) and emits
  `word-progress` — no side effects, no ordering assumptions, evidence for
  any ayah can arrive in any order relative to any other. `state` is still
  `awaiting_start` -> `tracking` (a `started` effect fires once total
  accumulated matched words crosses `startMinWords`, for UI purposes only —
  it's no longer a per-ayah anchor decision). `finalize()` — called ONLY
  on a manual stop (`requestStop()` + the worker's stop-flush
  `final_sequence`), or the UI's existing timeout fallback — walks the
  WHOLE picked passage exactly once with `_evaluateVerse()` (the three-tier
  logic is untouched) and reconciles skipped-vs-not-reached with the same
  `lastRecited` logic as before. `final_sequence` without a requested stop
  is just a `checkpoint` (mid-session pause ping) — never auto-completes.
- Removed entirely (all were mechanisms to make live per-ayah judgment
  safer, and are now moot): `cursor`, `advanceCandidate`,
  `advanceMinWords`/`advanceStabilityCycles` config, `_closeAndAdvance`,
  `_checkPassageComplete`, the `verse-active`/`verse-committed`/
  `verses-skipped`(live)/`passage-complete`/`start-retracted`/`repetition`/
  `off-track` effects (the last three were already dead since Phase 2 —
  tied to tracker-identity events no longer trusted — and are now cleaned
  up rather than left as unreachable code).
- `js/recitation.js`: replaced the single "current verse" live pane
  (`_renderCurrentVerse`, cursor-gated) with `_renderPassageText()` — the
  WHOLE picked passage renders once at session start, and `word-progress`
  highlights matched words on whatever ayah it touches, wherever that is
  in the passage. `_session.cursor` (previously doubling as a "has the
  session started" proxy, `=== null` meaning "not yet") replaced with an
  explicit `_session.started` boolean, set by the `started` effect — fixes
  what would otherwise have been a real regression (mic-health silence/low
  warnings staying on forever, since nothing ever set the old `cursor`
  field again). New CSS: `.recite-passage-verse` for per-verse spacing in
  the full-passage view.
- `test-recitation.html` (dev-only harness, not linked from the app):
  dropped the dead `cursor` postMessage and the no-longer-existent
  `useWordVerdicts` config key.

**Validation**: `tilawa-build/test/coach.test.mjs` fully rewritten again
for the new accumulate-then-evaluate-once model (30 tests — dropped every
test that depended on cursor/advance timing, added
"evidence accumulates regardless of the order ayahs are touched in" and
kept the core skip/uncertain/Basmala/length-scaling coverage).
Real-ONNX validation via `scratchpad/e2e/realcoach.mjs` (drives the real
compiled worker bundle + real production coach) re-run against the full
7-fixture corpus: IDENTICAL results to every prior run — 6/7 perfect
(Al-Falaq, An-Nas, Ar-Rahman, Al-Mulk, Al-Asr all 100/100 zero skips; the
Fatiha stop-early scenario still correctly reports not-reached, not
skipped), Ya-Sin's pre-existing ayah-4 short-verse false skip unchanged
(confirms, again, it's a distinct calibration gap, not touched by this
change). Zero regressions, and the entire stuck-cursor failure CLASS is
now structurally impossible — there is no cursor left to get stuck.
Build stamp bumped to `2026-07-22b`.

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
