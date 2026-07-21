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

## Search space is scoped to the picked surah, not the full 6,236-verse corpus

`QuranDB` takes a plain verse array in its constructor — nothing tilawa-side
requires the full corpus. When the user has already picked a passage, its
surah is known before a single audio chunk arrives, so there is no reason for
discovery to search the other 113 surahs at all. The worker
(`tilawa-build/src/worker-entry.js`, `rescopeToSurah`) rebuilds the tilawa
session with `QuranDB` restricted to just that surah on every `setExpected`
message (reusing the same already-initialized ONNX `runner` — only the
cheap text-side wrapper is rebuilt).

This makes the cross-surah noise-locking bug above **structurally
impossible** in picked-passage mode (those verses don't exist in the
tracker's world, so it cannot commit to them), and shrinks the
champion-matching scan every decode cycle performs (`quran-db.ts` iterates
`this.verses` in `bestJoint03Match` and related methods) from 6,236 verses
down to as few as 3 — a meaningful speed-up on the slow devices seen in the
field (verified: `session.db.totalVerses === 6` for a session scoped to
Surah 114, vs the full corpus's 6,236).

Freestyle ("just recite") mode starts unscoped, since the surah isn't known
until something is recognized — but rescopes too, immediately after
anchoring, so the rest of a freestyle session gets the same protection.

## Isti'adhah / Basmala are optional, not required content

Reciters legitimately open a surah four different ways: isti'adhah +
Basmala, Basmala only, isti'adhah only, or straight into the surah. All are
accepted; none should be flagged.

- **Isti'adhah** ("أعوذ بالله من الشيطان الرجيم") isn't Quran text at all —
  it never appears in any verse's word list, so it was never scored. Note
  it is NOT acoustically invisible, though: discovery's span matcher always
  returns its *best-fit* verse for whatever audio it's given, so isti'adhah
  and Basmala audio can still generate weak-to-moderate confidence matches
  against arbitrary in-range verses (field-observed up to 0.83) before real
  recitation starts. See "Pre-recitation noise cannot open a mid-passage
  session" below for how the coach guards against that.
- **Basmala**: this text source (`assets/tilawa/quran.json`) embeds it as
  the literal first 4 words of ayah 1 for every surah except Al-Fatiha (1,
  where it IS the verse) and At-Tawbah (9, which has none) — mirroring
  tilawa's own `QuranDB._startsWithArabicBismillah` rule exactly (same 4
  words, same two exclusions). `RecitationCoach` (`js/recitation-coach.js`,
  `basmalaPrefixLength`) detects this and marks those 4 word indices
  optional: `missedWordIndices()` never accuses them, and the word-coverage
  denominator excludes them unless they were actually recited — so skipping
  the Basmala costs nothing, and saying it still earns credit. Word
  comparison normalizes diacritics and alef variants (ٱ/أ/إ/آ → ا) since
  `text_uthmani` carries full tashkeel where the reference words don't.

Field motivation: build 2026-07-20h found a real recitation of Surah 85
flagged all 4 opening words "missed" purely because of this text
convention, independent of the tracker-lock issue that compounded it.

## Pre-recitation noise cannot open a mid-passage session

`RecitationCoach._onVerseMatch` uses two different confidence bars for
opening a session from `awaiting_start`:

- `startConfidence` (0.55) — a plain start at `ayahStart`. Being wrong here
  costs nothing: no earlier verse gets accused of anything.
- `candidateStartConfidence` (0.85) — required instead whenever the match is
  for `ayah > ayahStart`, because opening there immediately marks every verse
  from `ayahStart` up to it as provisionally skipped.

Field motivation (build 2026-07-20j, Surah 87, 19-verse pick): isti'adhah +
Basmala audio — which doesn't exist in the scoped DB as literal text (see
above) — got fuzzy-matched by tilawa's span discovery to ayah 11-12, and the
tracker's own conservative "commit only the first ayah of a collapsed span"
fallback (`live_span_collapsed`) turned that into a `verse_match` for ayah 11
at confidence 0.83. The coach accepted it as the real start (0.83 clears the
0.55 floor) and reported ayahs 1, 2, 5-10 as skipped — while the reciter was
still on the isti'adhah/Basmala, about to recite verse 1. Once locked, the
tracker's word-by-word confirmation is acoustic/positional (duration-based),
not lexical, so it self-confirmed through ayahs 11-19 by timing alone as the
reciter's real (but misattributed) audio streamed in, and the whole session
finished having tracked the right *amount* of speech against the wrong verse
numbers. 0.83 is comfortably below `candidateStartConfidence` (0.85), so
gating mid-passage starts at that bar closes this specific hole; a genuine
low-confidence mid-passage start still opens the session via word_progress's
own defensive path (`_onWordProgress`, `matched_indices.length >= 2`), which
requires actual cumulative word-level evidence rather than a single
borderline commit.

## Lexical substitutions within a tracked verse are not yet flagged

Tilawa's in-tracking word-progress confirmation (`matched_indices`) is
acoustic/positional — it confirms "N words' worth of audio happened," not
"the Nth word was word X." So a reciter who substitutes one word for another
of similar length/duration (field case: build 2026-07-20j, Surah 87 ayah 19,
"مُوسَىٰ" recited as "دَاوُۥد") completes the verse with a normal, unflagged
`verse_match`/`word_progress` sequence — the substitution is only visible in
tilawa's separately-streamed `raw_transcript`/`word_verdicts` (decoded text),
which IS wired up (`tilawa-build/src/align.js`) but gated off by
`CONFIG.FEATURES.WORD_VERDICTS = false` pending calibration against more
real wrong-recitation clips (the "positive evidence only" bar: zero false
accusations on clean recitations is non-negotiable before this can accuse
anyone of anything). Not a regression — this is the documented, intentional
scope limit from the original Workstream B design. See below for a coarser,
already-shipped defense against the worst case this enables.

## Content-verification gate: a session can't score without ANY real lexical evidence

Field case (build 2026-07-21, Surah 106 / Al-Quraysh): reciting the English
alphabet against a picked passage completed all 4 verses and scored 100.
Every `tracking_cycle` diagnostic for the whole session showed
`word_matches: 0` — tilawa's tracker advances `word_progress` via a fallback
(`acoustic_word`/`char_word`: position-only, duration-based) whenever its own
lexical alignment (`alignPosition()` against the tracked verse's actual
words, exposed as `word_matches`) finds nothing. The fallback is invisible
downstream — `word_progress.matched_indices` doesn't distinguish a real
lexical hit from a fallback advance — so a verse (or an entire session) can
complete tilawa's own tracking with zero real content verification, ever.

`worker-entry.js`'s `onDiagnostic` hook now forwards every `tracking_cycle`
as a synthetic `lex_check` event (`{surah, ayah, lexical}`, where `lexical =
word_matches > 0`), letting `RecitationCoach` (`_onLexCheck`) accumulate
session-wide `lexAdvances`/`fallbackAdvances` counters. At finalize, if
`fallbackAdvances >= minFallbackForJudgment` (6) and `lexAdvances === 0` —
sustained tracking activity with not one single real lexical match anywhere
— the summary gets `contentUnverified: true` and the score is forced to 0.

This is deliberately **session-wide, not per-verse**: a genuinely short verse
can clear in 1-2 fallback-only cycles with zero lexical matches purely
because it's short, and per-cycle fragments are frequently too small (often
1 word) to reach tilawa's own lexical-alignment bar — field-verified in the
SAME log that motivated this gate (build 2026-07-20j, the real, correct
recitation of Surah 87 ayah 13 cleared on exactly 2 fallback cycles with
`word_matches: 0` both times). Gating on that in isolation would have been a
false accusation. A single real lexical match anywhere in the session
(`lexAdvances >= 1`) clears the gate permanently, since genuine multi-verse
recitation reliably produces at least one somewhere; gibberish typically
never does, because tilawa's own alignment is being compared against
completely unrelated text throughout.

## Per-verse content-verification: catching one fabricated verse inside a good session

Field case (build 2026-07-21, Surah 20 / Ta-Ha, ayahs 87-95): ayah 91 was
never actually recited. Tracing the raw decoded text: the tracker armed the
90→91 transition, then labeled verse 90's OWN tail audio ("فَٱتَّبِعُونِى
وَأَطِيعُوٓا۟ أَمْرِى") as ayah 91's tracking content, "confirmed" it via 3
fallback-only cycles (`word_matches: 0` on every one), then ~3 seconds of
silence/noise passed before ayah 92's real content began. Ayah 91's actual
text ("قَالُوا۟ لَن نَّبْرَحَ...") never appears anywhere in the transcript.
The session-wide gate above correctly stayed quiet — every OTHER verse in
the session had real lexical matches, so the session total never crossed
`minFallbackForJudgment`.

`RecitationCoach._looksUnverified(ayah)` adds the same check per-verse:
`fallbackAdvances[ayah] >= minFallbackForVerseJudgment` and
`lexAdvances[ayah] === 0`. Checked at the moment a verse would otherwise be
marked `done` (`_commitAndAdvance`, `_finalize`); if it fires, the verse is
marked `unverified` instead — excluded from `versesDone`, counted against
`versesUnverified` (reported and rendered separately in the UI, distinct
from `versesSkipped` since the verse WAS tracked, just never lexically
confirmed), and contributes to the verse-ratio denominator like a skip.

**The threshold started as a guess (3) and was lowered to 1** after a third
field case (build 2026-07-21, Surah 21 / Al-Anbiya, ayah 99): ayah 98's
content flowed directly into ayah 100's with zero trace of 99 anywhere, but
99 completed via a normal 98→99 sequential advance (no gap, so
spanEvidence/jump-hysteresis never even looked at it) on exactly ONE
fallback cycle — below the original threshold of 3. Before lowering it, the
full real-ONNX e2e corpus (An-Naas, Al-Falaq, Fatiha fragments, freestyle)
was re-run at threshold 1: zero verses ever completed on fallback alone with
no lexical match, on any clean recitation — a much stronger empirical result
than the original guess had. A hand-traced field case (Surah 87 ayah 13, 2
fallback cycles, genuinely correct) will now also get flagged — an accepted,
deliberate tradeoff on explicit product direction: this app's entire purpose
is helping reciters catch a skipped verse before reciting to a real teacher,
so a missed skip is a worse failure than an occasional false "unverified"
flag on a fast, short verse.

## spanEvidence requires a STABLE candidate

Field case (build 2026-07-21, Surah 21 / Al-Anbiya, ayahs 25-30): ayah 27 was
never recited. The decoded transcript shows ayah 26's tail flowing directly
into ayah 28's opening, with no trace of ayah 27's words anywhere — but the
summary reported it `done`, no skip. Cause: a single, never-stable `"21:26-
27"` discovery candidate (confidence up to 0.99) got recorded as
`spanEvidence` for BOTH ayahs in the span, and `_commitAndAdvance`'s gap-fill
rescue (see "Round 4" / the collapsed-span section above) used that evidence
to mark 27 `done` when the tracker jumped straight from 26 to 28.

The root problem: tilawa's `VerseCandidate` carries ONE joint-match
confidence for the WHOLE span (`{ayah, ayah_end, confidence}` — no
per-verse breakdown), and that score can be dominated by just one strongly-
matching verse in the span while the other has no support at all — exactly
what happened here (26 was fully, clearly recited; 27 never was; the pair's
joint score still cleared `spanEvidenceConfidence` on 26's strength alone).

Fix: `_recordSpanEvidence` now requires `msg.stable` — the same bar
`_onVerseCandidate` already uses to open a session, and the value every
existing spanEvidence test already used by default (`vc()`'s `stable`
parameter defaults to `true`). A single volatile sighting no longer counts;
the span needs to persist across tilawa's own stability window before its
confidence is trusted as evidence for every verse inside it.

If production hosting ever enables a Content-Security-Policy for static pages,
onnxruntime-web needs `'wasm-unsafe-eval'` in `script-src`.
