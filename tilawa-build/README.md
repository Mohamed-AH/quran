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
some tracking activity happened for the verse at all
(`fallbackAdvances[ayah] + lexAdvances[ayah] > 0`) but
`lexAdvances[ayah] < minLexAdvancesForVerse`. Checked at the moment a verse
would otherwise be marked `done` (`_commitAndAdvance`, `_finalize`); if it
fires, the verse is marked `unverified` instead — excluded from
`versesDone`, counted against `versesUnverified` (reported and rendered
separately in the UI, distinct from `versesSkipped` since the verse WAS
tracked, just never lexically confirmed), and contributes to the
verse-ratio denominator like a skip.

**The threshold moved twice, each time on real field evidence.** Started as
a guess (3 fallback-only cycles with zero lexical matches). A third field
case (Surah 21 ayah 99) completed via exactly ONE fallback cycle right
after a normal sequential advance — too fast to ever reach 3 — so the bar
became "any real lexical match clears it" (`lexAdvances >= 1`). Verified
against the full real-ONNX e2e corpus before shipping that: zero clean
recitations ever completed a verse on fallback alone with no lexical match.

That still wasn't enough. A fourth field case (Surah 21 ayah 110) showed a
single real lexical match can itself be a **coincidental leak from a
neighboring verse**: tilawa's own "live span collapsed to first ayah"
commit mislabeled ayah 111's real audio as ayah 110's tracking window, and
one of 111's words happened to resemble one of 110's closely enough to
register as a genuine (non-fallback) `word_matches` hit — ayah 110 itself
was never recited at all. The bar is now `minLexAdvancesForVerse: 2` — a
single coincidental match is far more plausible than two. Re-verified
against the same full e2e corpus before raising it: still zero false
positives on any clean recitation.

A hand-traced field case (Surah 87 ayah 13, 2 fallback cycles, genuinely
correct, zero real lexical matches) got flagged as soon as the bar left "0"
and still does — an accepted, deliberate tradeoff on explicit product
direction: this app's entire purpose is helping reciters catch a skipped
verse before reciting to a real teacher, so a missed skip is a worse
failure than an occasional false "unverified" flag on a fast, short verse.

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

### ...but only for multi-verse SPANS — a single-verse candidate needs no stability

Field case (build 2026-07-21f, Surah 21 ayahs 88-91): the coach sat in
`awaiting_start` chasing unrelated out-of-range acoustic locks while the
reciter correctly recited 88 and 89 — 89 word-perfectly — then genuinely
skipped 90, then the coach finally locked onto 91 late. That one late lock
blanket-flagged everything before it, INCLUDING the two genuinely-correct
verses, as skipped. The stability requirement above was the direct cause:
verse 89's only trace was a single 0.92-confidence discovery candidate that
never got a second sighting, so it was discarded outright — the same rule
that (correctly) protected against the ayah-27 case also threw away
perfectly good evidence here.

The distinction that resolves both cases without reintroducing either bug:
the conflation risk described above is specific to multi-verse SPANS, where
tilawa's one joint confidence number can be dragged up by just one strongly-
matching member. A SINGLE-verse candidate's confidence is specific to that
one verse — there's nothing for it to be conflated with, so even a single
sighting is real per-verse evidence. `_recordSpanEvidence` now only requires
`msg.stable` when `ayah_end > ayah` (a real span); a single-verse candidate
(`ayah_end` absent or equal to `ayah`) counts on its first sighting.

## missedWordIndices only accuses from where observation actually began

Field case (build 2026-07-21, Surah 21 ayah 97): the opening 9 words got
reported "missed" even though the reciter very likely said them. What
actually happened: pre-recitation audio (isti'adhah) briefly locked the
tracker onto an out-of-range verse; while it was locked, the coach's own
tracking hadn't started yet, so those first ~9 words' worth of real audio
passed by unobserved. The wrong-track watchdog correctly reset the lock and
the session started via transcript-alignment (`word_verdicts`) at word index
9 — but `missedWordIndices` looped from `v.progress` (0, since a
transcript-started verse never gets touched by tilawa's own
`word_progress`) all the way to the end, treating "never observed" the same
as "observed and absent."

Fix: the loop now starts from `v.progress` when tilawa's own tracker
established it (unchanged — that's a real high-water mark), but from the
EARLIEST confirmed `word_verdicts` index when `v.progress` is still 0 (a
verse whose coverage came entirely from transcript-alignment). Indices
before that point were never observed at all and are no longer accused; a
genuine gap AFTER observation began is still real positive evidence and
stays accused exactly as before.

## A verse's own last word(s) can be said but never confirmed — a third "uncertain" verdict

Field cases (build 2026-07-21f, Surah 21): ayah 82's last word ("حافظين")
and ayah 90's last two words ("وكانوا لنا") were both clearly present in
the raw decoded transcript — even reflected in a live `word_progress`
match moments earlier for 82 — but both got reported "missed" in the final
summary. Mechanism: tilawa's own `tracking_cycle` for the OUTGOING verse
doesn't always get one more confirming cycle before the tracker advances
into the next verse's discovery window (the two verses' audio lands in the
same buffer), so the verse's own trailing word(s) never individually reach
`matched_indices` even though they were genuinely spoken.

This is a real precision/recall tension, not a simple bug: from the
coach's information alone (`word_progress`'s `word_index`/`matched_indices`
only), a genuine last-word omission and "said but tilawa's tracker didn't
get a confirming cycle" are **indistinguishable** — both look like
"progress stalls 1-2 words short, then the next verse commits." An
existing test (`wp(1,[0,1,2])` → `vm(2)`) deliberately protected accusing
a 1-word trailing gap for exactly this shape of evidence, so silently
suppressing it would also forgive real last-word omissions elsewhere —
directly against this app's standing priority that missing a real mistake
is worse than a false flag.

Resolution: rather than picking a side, `missedWordIndices` now splits into
two verdicts (`splitMissedWordIndices`):
- **`missed`** (confirmed) — unchanged algorithm, still a positively-evidenced
  accusation.
- **`uncertain`** — the verse's own TRAILING contiguous gap, only when it
  reaches the verse's true last word index (so a gap that stops short of
  the end, because the last word WAS separately confirmed, has no
  ambiguity and stays a confirmed miss) and is small
  (`trailingUncertainTolerance`, 2 words — a larger trailing gap is real
  evidence of incompleteness, not just a confirmation lag).

`uncertain` is never merged into `missedWords`, never scored against the
reciter (word coverage/score are driven by `coveredCount`, untouched by
this split), and surfaces softly in the UI as "words you possibly missed
(unconfirmed)" — visually distinct from a confirmed accusation, honestly
reporting the coach's actual certainty instead of forcing a binary
yes/no verdict onto genuinely ambiguous evidence.

## The mic stops when the picked passage's last verse is done

Field complaint (build 2026-07-21): picking an end verse and finishing it
didn't stop the recording — the session just kept listening until either
tilawa's own silence-timeout flush (several seconds of quiet) or a manual
tap on Stop, which read as the app "not noticing" the recitation was over.

Every verse before the last one already gets a live signal the moment the
cursor advances past it (`verse-committed`). The LAST verse never advances
anywhere, so nothing previously told the UI "the recitation the user asked
for is actually finished" until the tracker's own flush machinery kicked
in. `RecitationCoach._checkPassageComplete()` fires a `passage-complete`
effect exactly once, checked from both the word_progress and verse_match
paths, since either can be what pushes the last verse over the bar.
`js/recitation.js` shows a "reached the end — stopping" hint and calls
`stopSession()` ~2 seconds later (a short debounce so trailing elongation on
the very last word isn't cut off mid-sound), rather than leaving the mic
open indefinitely.

### passage-complete needs REAL coverage, not just a bare commit

Field case (build 2026-07-21f, Surah 21 ayah 105): a content-blind "live
span collapsed" commit (see the collapsed-span section above) landed on the
passage's last verse with essentially zero word progress, and
`_checkPassageComplete()`'s original bar — `sawCommit` OR
`coverage >= doneCoverage` — accepted the bare commit on its own. That fired
`passage-complete` immediately, and the ~2 second auto-stop timer cut the
mic before the verse's own final 2 words were ever captured — which then
surfaced as a false `missedWords` accusation on words the reciter likely
still would have said, because the recording literally stopped before they
could be. This effect is unlike a normal "done" verdict: a wrong "done" can
still be corrected by more audio arriving later, but a wrong
`passage-complete` stops the mic — there is no more audio to correct it
with.

Fix: dropped the `sawCommit`-alone bypass entirely and raised the bar from
`doneCoverage` (0.6) to the stricter `reconcileCoverage` (0.8, already used
elsewhere for coverage-only reconciliation) — passage-complete now always
requires real word coverage close to done before it will stop the mic.

### ...but a coverage FRACTION doesn't scale to long verses

Field case (build 2026-07-21i, Surah 98 ayah 8, 21 words): the reciter was
still audibly continuing (raw `transcribe` activity for 4+ more seconds)
when word coverage merely crossed 18/21 (85.7%) — comfortably above the
`reconcileCoverage` (0.8) bar above — and the ~2s auto-stop timer cut the
mic before the last 2 words were ever captured. The fix immediately above
this one wasn't wrong, just insufficiently scaled: 20% of a 21-word verse
is 4 words left uncaptured, versus 20% of a 4-word verse being under 1.

Fix: `_checkPassageComplete()` now uses an ABSOLUTE word-count bar instead
of a coverage fraction — at most 1 word may remain unconfirmed
(`v.totalWords - v.progress <= 1`), mirroring tilawa's own "final word
reached" completion concept. This scales correctly regardless of verse
length, where a percentage cannot.

If production hosting ever enables a Content-Security-Policy for static pages,
onnxruntime-web needs `'wasm-unsafe-eval'` in `script-src`.

## A stale cached worker bundle can silently disable every fix in this file

Field case (build 2026-07-21f, Surah 99): the coach reported a clean
`99/100, contentUnverified:false` on a session where the raw diagnostics
show **63 consecutive `tracking_cycle` events, every one with
`word_matches:0`** — a too-quiet mic decoding to garbage the entire time,
zero real lexical alignment ever occurring. Replaying the equivalent
`lex_check` stream directly against `RecitationCoach` in isolation produces
the *correct* result (`contentUnverified:true, score:0`) — the gate logic
itself is sound. The only way the real session diverged is if the
`lex_check` events never reached the coach at all, which means the browser
was running a `js/vendor/tilawa-worker.js` bundle from *before* that wiring
was added (see "Content-verification gate" above), despite the page's own
`CONFIG.TILAWA.BUILD` reporting the current stamp.

Root cause: `js/config.js` pointed `new Worker(...)` at a bare,
unversioned `js/vendor/tilawa-worker.js`. The static site (Render, `env:
static`, see `render.yaml`) sets no explicit `Cache-Control` for `/js/*`.
Small files like `config.js` tend to revalidate quickly; the large worker
bundle can sit cached well past a deploy, so a returning user's browser
keeps running old tracker code — including old *or missing* safety gates —
while every other signal in the app insists it's on the latest build. This
plausibly explains several other "already-fixed bug recurred" field reports
across the same build stamp: the fix genuinely shipped, it just never
reached that browser.

Fix, two parts:
- `js/config.js` appends `?v=<BUILD>` to `WORKER_PATH` once `BUILD` is set,
  so every build bump forces a fresh fetch of the worker script regardless
  of whatever caching layer sits in front of it.
- The worker reads that same `?v=` back off `self.location.search` and
  echoes it in its `ready` message (`{type:"ready", build}`).
  `js/recitation.js`'s `ready` handler compares it against
  `CONFIG.TILAWA.BUILD` and logs `STALE WORKER BUNDLE` to the console (plus
  a `workerBuild` field in the debug panel and report) on any mismatch —
  including a worker old enough to have no `build` field at all. This is
  the piece that was actually missing before: without an echo, a stale
  worker is completely invisible from the page's own reporting, which is
  exactly what made this bug take 8 field logs to catch.

## ...and it wasn't just the worker — EVERY script tag needed the same fix

Field case (build 2026-07-21j, Surah 87): a session showed verses marked
`done` that the CURRENT `recitation-coach.js` should have marked
`unverified` or left `skipped`, with both `build` and `workerBuild`
confirmed on the latest stamp. `config.js` reading the latest `BUILD` never
actually proved anything else was fresh — it's a coincidence of that one
file's small size revalidating reliably, not a guarantee shared by every
`<script>` tag. `js/recitation-coach.js` itself — the file carrying every
fix in this document — was stale-cached, completely independently of the
worker fix above.

Fix: every `<script src="js/...">` tag in `app.html`, `admin.html`,
`callback.html`, `index.html`, and `test-recitation.html` now carries its
own `?v=` query string. There's no HTML build step in this repo, so this is
a manual convention: bump every script tag's `?v=` alongside
`CONFIG.TILAWA.BUILD` on every recitation change (documented directly next
to the `BUILD` constant).

## An uncorroborated OPENING commit is retracted, not trusted

The user's framing of the remaining problem, verbatim: *"Try to mimic a
real ustad. He is going to listen [to] each verse and judge if it is
correct or not. He is not going to listen [to] the first word he hears and
jump to some wild goose chase."* Field case (build 2026-07-21j, Surah 87):
"اعوذ" — 4 tokens of the isti'adhah, not surah content at all —
short_rescue-committed to ayah 14 at confidence 0.85 (tilawa's own
fallback for sparse audio, an acoustic guess disconnected from real lexical
content — see the `short_rescue`/`acoustic_margin` commit reasons discussed
throughout this document). The coach immediately flagged ayahs 1-13 as
skipped. Four tracking cycles later, tilawa's own tracker gave up on ayah
14 (`stale_exit`) having never confirmed a single real word — but by then
the false "verses skipped" verdict was already locked in and irreversible.

This is the SAME acoustic-fallback problem behind several fixes already in
this document (`short_rescue`/`acoustic_margin` commits with confidence
disconnected from real content), but none of the existing gates catch it
at the moment it matters: the per-verse content-verification gate
(`minLexAdvancesForVerse`) only ever downgrades a verse to `unverified` —
it never un-skips the EARLIER verses a bogus opening commit accused. The
`spanEvidence` rescue only helps if some OTHER candidate happened to cover
those verses; here nothing did.

Fix: the worker forwards tilawa's own `stale_exit` diagnostic (a fresh
signal, previously debug-only) as a structured `tracking_abandoned`
event. `RecitationCoach._onTrackingAbandoned()` — when this fires for the
verse the session actually **opened** on (`this.cursor === this.startAyah`,
tracked via a new `startAyah` field set in `_start()`), and that verse has
zero real lexical corroboration (`lexAdvances === 0`) — undoes the entire
opening commit: resets every verse back to `pending`, returns the coach to
`awaiting_start`, and emits a `start-retracted` effect instead of leaving
the false "verses skipped" verdict standing. A verse abandoned LATER in a
session (already advanced past the opening) is untouched here — it already
has its own safety net (the per-verse gate marks it `unverified`, not
`done`). `js/recitation.js` shows the same "listening afresh" hint used
elsewhere for a tracker reset, rather than an alarming skip notice.

This only ever makes the coach MORE cautious, never less: it can't turn a
real skip into a false pass (a genuinely well-corroborated opening commit
is untouched; `lexAdvances > 0` is required to trust it), and the worst
case if tilawa's stale_exit fires on a genuinely-correct-but-slow opening
commit is simply re-listening for the start signal again — not an
incorrect verdict.
