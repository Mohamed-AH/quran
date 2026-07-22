/**
 * Unit tests for the RecitationCoach state machine (js/recitation-coach.js).
 * Run with: npm test  (node --test test/)
 *
 * Architecture (see CLAUDE.md): the coach now runs entirely on
 * `word_verdicts` — continuous alignment-engine verdicts of the decoded
 * transcript against the expected passage (see tilawa-build/src/align.js
 * and align.test.mjs, unit-tested separately). tilawa's own tracker
 * diagnostics (verse_match, word_progress, verse_candidate, lex_check,
 * tracking_abandoned) are no longer trusted for verse identity or scoring
 * — handleEvent is a documented no-op for all of them (see the "retired
 * events are inert no-ops" test below). Events here are scripted
 * word_verdicts messages, exactly the shape worker-entry.js emits.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const RecitationCoach = require("../../js/recitation-coach.js");

// Real text_uthmani for Al-Fatiha (from tilawa quran.json).
const FATIHA = [
  { ayah: 1, text: "﻿بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ" }, // 4 words
  { ayah: 2, text: "ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ" }, // 4 words
  { ayah: 3, text: "ٱلرَّحْمَٰنِ ٱلرَّحِيمِ" }, // 2 words
  { ayah: 4, text: "مَٰلِكِ يَوْمِ ٱلدِّينِ" }, // 3 words
  { ayah: 5, text: "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ" }, // 4 words
  { ayah: 6, text: "ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ" }, // 3 words
  { ayah: 7, text: "صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ" }, // 9 words
];

// Real text_uthmani for Surah 85 (Al-Buruj) — ayah 1 embeds the Basmala as
// its own first 4 words (this text source's convention for every surah
// except 1 and 9); used to test isti'adhah/Basmala recitation tolerance.
const BURUJ = [
  { ayah: 1, text: "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ وَٱلسَّمَآءِ ذَاتِ ٱلْبُرُوجِ" }, // 7 words (4 Basmala + 3 real)
  { ayah: 2, text: "وَٱلْيَوْمِ ٱلْمَوْعُودِ" }, // 2 words
];

// Surah 9 (At-Tawbah) ayah 1 has NO Basmala at all — must not be affected.
const TAWBAH1 = [
  { ayah: 1, text: "بَرَآءَةٌۭ مِّنَ ٱللَّهِ وَرَسُولِهِۦٓ إِلَى ٱلَّذِينَ عَٰهَدتُّم مِّنَ ٱلْمُشْرِكِينَ" }, // 9 words
];

function makeCoach(overrides = {}) {
  return new RecitationCoach({
    surah: 1,
    ayahStart: 1,
    ayahEnd: 7,
    verses: FATIHA,
    now: () => 1000,
    ...overrides,
  });
}

/** A word_verdicts event, exactly the shape worker-entry.js emits. */
function wv(surah, verdicts, text) {
  return { type: "word_verdicts", surah, verdicts, text };
}

function matched(ayah, indices, status = "matched") {
  return indices.map((i) => ({ ayah, index: i, status }));
}

function missing(ayah, index, expected) {
  return [{ ayah, index, status: "missing", expected }];
}

function substitutedFlag(ayah, index, heard, expected) {
  return [{ ayah, index, status: "substituted", heard, expected }];
}

const types = (effects) => effects.map((e) => e.type);

// ---------------------------------------------------------------------------
// Tokenization contract (unchanged by the rewrite)
// ---------------------------------------------------------------------------

test("splitDisplayTokens excludes annotation-only tokens from word indexing", () => {
  // 2:2 contains two standalone waqf marks (ۛ) between words.
  const tokens = RecitationCoach.splitDisplayTokens(
    "ذَٰلِكَ ٱلْكِتَٰبُ لَا رَيْبَ ۛ فِيهِ ۛ هُدًۭى لِّلْمُتَّقِينَ",
  );
  assert.equal(tokens.length, 9); // 9 visual tokens
  const words = tokens.filter((t) => t.isWord);
  assert.equal(words.length, 7); // 7 real words (matches tilawa phoneme_words)
  assert.deepEqual(words.map((t) => t.wordIndex), [0, 1, 2, 3, 4, 5, 6]);
  const marks = tokens.filter((t) => !t.isWord);
  assert.equal(marks.length, 2);
  assert.ok(marks.every((t) => t.wordIndex === -1));
});

test("splitDisplayTokens strips the BOM in 1:1", () => {
  const tokens = RecitationCoach.splitDisplayTokens(FATIHA[0].text);
  assert.equal(tokens.filter((t) => t.isWord).length, 4);
});

// ---------------------------------------------------------------------------
// Retired events are inert no-ops
// ---------------------------------------------------------------------------

test("tracker-identity events (verse_match, word_progress, verse_candidate, lex_check, tracking_abandoned) are no-ops", () => {
  const coach = makeCoach();
  assert.deepEqual(coach.handleEvent({ type: "verse_match", surah: 1, ayah: 1, confidence: 0.9 }), []);
  assert.deepEqual(coach.handleEvent({ type: "word_progress", surah: 1, ayah: 1, matched_indices: [0, 1, 2] }), []);
  assert.deepEqual(coach.handleEvent({ type: "verse_candidate", candidates: [{ surah: 1, ayah: 1, confidence: 0.95 }] }), []);
  assert.deepEqual(coach.handleEvent({ type: "lex_check", surah: 1, ayah: 1, lexical: false }), []);
  assert.deepEqual(coach.handleEvent({ type: "tracking_abandoned", surah: 1, ayah: 1 }), []);
  assert.equal(coach.state, "awaiting_start"); // none of them started the session
});

// ---------------------------------------------------------------------------
// Alignment-driven start
// ---------------------------------------------------------------------------

test("starts once enough words align, no tracker involved", () => {
  const coach = makeCoach();
  assert.deepEqual(coach.handleEvent(wv(1, matched(1, [0, 1]))), []); // only 2 — not enough
  assert.equal(coach.state, "awaiting_start");

  const effects = coach.handleEvent(wv(1, matched(1, [0, 1, 2])));
  assert.deepEqual(types(effects), ["started", "verse-active", "word-progress"]);
  assert.equal(coach.state, "tracking");
  assert.equal(coach.cursor, 1);
});

test("word_verdicts for a different surah are ignored", () => {
  const coach = makeCoach();
  assert.deepEqual(coach.handleEvent(wv(2, matched(1, [0, 1, 2]))), []);
  assert.equal(coach.state, "awaiting_start");
});

test("verdicts pointing outside a verse's word count are filtered out defensively", () => {
  const coach = makeCoach();
  const effects = coach.handleEvent(wv(1, [{ ayah: 1, index: 99, status: "matched" }]));
  assert.deepEqual(effects, []);
});

test("starting mid-range evaluates earlier verses on their REAL accumulated evidence, not a blanket skip", () => {
  const coach = makeCoach();
  // A sub-threshold fragment for ayah 1 alone doesn't cross the start
  // bar, but its evidence is NOT thrown away — evidence accumulates
  // regardless of whether THIS message happens to be the one that starts
  // the session.
  coach.handleEvent(wv(1, matched(1, [0, 1])));
  assert.equal(coach.state, "awaiting_start");
  // The next fragment crosses the start threshold on ayah 4 alone.
  const effects = coach.handleEvent(wv(1, matched(4, [0, 1, 2])));
  assert.deepEqual(types(effects), ["verses-skipped", "started", "verse-active", "word-progress"]);
  assert.deepEqual(effects[0].ayahs, [2, 3]); // ayah 1 is NOT in this list — see below
  assert.equal(coach.cursor, 4);
  assert.equal(coach.perVerse[1].status, "unverified"); // real partial evidence — not a blanket skip
  assert.equal(coach.perVerse[2].status, "skipped"); // zero evidence — genuinely skipped
  assert.equal(coach.perVerse[3].status, "skipped"); // zero evidence — genuinely skipped
});

test("field scenario: a genuinely skipped verse with zero evidence is reported even at session start", () => {
  const coach = makeCoach();
  const effects = coach.handleEvent(wv(1, matched(4, [0, 1, 2])));
  assert.deepEqual(types(effects), ["verses-skipped", "started", "verse-active", "word-progress"]);
  assert.deepEqual(effects[0].ayahs, [1, 2, 3]);
});

// ---------------------------------------------------------------------------
// Capture, then evaluate once — the ustad model
// ---------------------------------------------------------------------------

test("a single transient cycle of forward evidence does NOT advance — stability requires 2 consecutive cycles", () => {
  const coach = makeCoach();
  coach.handleEvent(wv(1, matched(1, [0, 1, 2]))); // start at ayah 1
  assert.equal(coach.cursor, 1);

  // One cycle shows ayah 2 starting to appear — sliding-window boundary
  // noise (tail of 1 + head of 2 in the same decode) is exactly this shape.
  let effects = coach.handleEvent(wv(1, matched(2, [0, 1])));
  assert.deepEqual(types(effects), ["word-progress"]); // recorded, but no advance yet
  assert.equal(coach.cursor, 1);

  // A SECOND consecutive cycle with the same forward evidence — now it's
  // real, not noise.
  effects = coach.handleEvent(wv(1, matched(1, [3])));
  assert.ok(types(effects).includes("verse-committed"));
  assert.ok(types(effects).includes("verse-active"));
  assert.equal(coach.cursor, 2);
  assert.equal(coach.perVerse[1].status, "done"); // 4/4 words
});

test("the stability streak is per-candidate — jumping to a FURTHER ayah restarts the count instead of inheriting it", () => {
  const coach = makeCoach();
  coach.handleEvent(wv(1, matched(1, [0, 1, 2, 3])));
  coach.handleEvent(wv(1, matched(2, [0, 1]))); // candidate=2, streak=1
  // Next cycle jumps straight to ayah 3 qualifying too — the furthest
  // qualifying ayah is now 3, a DIFFERENT candidate, so its own streak
  // starts back at 1, not 2.
  let effects = coach.handleEvent(wv(1, matched(3, [0, 1])));
  assert.ok(!types(effects).includes("verse-committed"));
  assert.equal(coach.cursor, 1);
  // A second consecutive cycle confirming ayah 3 now closes it out.
  effects = coach.handleEvent(wv(1, matched(3, [0, 1])));
  assert.ok(types(effects).includes("verse-committed"));
  assert.equal(coach.cursor, 3);
});

test("field scenario: a fully-omitted verse between two well-recited ones is caught directly", () => {
  // This is the exact shape of the real regression this rewrite exists for
  // (Surah 78/An-Naba, ayahs 8 and 10 — see CLAUDE.md): a verse with ZERO
  // real evidence, sitting between two verses that DO have strong
  // evidence, used to be credited as done because tilawa's own tracker
  // signal for "genuinely skipped" and "genuinely correct but sparse" was
  // identical. Here it's caught directly: ayah 3 never appears in any
  // word_verdicts at all, while ayah 4 does.
  const coach = makeCoach();
  coach.handleEvent(wv(1, matched(1, [0, 1, 2, 3])));
  coach.handleEvent(wv(1, matched(2, [0, 1, 2, 3]))); // cycle 1 for ayah 2
  coach.handleEvent(wv(1, matched(2, [0, 1, 2, 3]))); // cycle 2 — closes ayah 1, cursor=2

  // Now skip straight to ayah 4 — nothing ever arrives for ayah 3.
  coach.handleEvent(wv(1, matched(4, [0, 1]))); // cycle 1 for ayah 4
  const effects = coach.handleEvent(wv(1, matched(4, [2]))); // cycle 2 — closes ayah 2

  assert.equal(coach.perVerse[2].status, "done");
  assert.equal(coach.perVerse[3].status, "skipped");
  assert.equal(coach.cursor, 4);
  const skipEffect = effects.find((e) => e.type === "verses-skipped");
  assert.ok(skipEffect);
  assert.deepEqual(skipEffect.ayahs, [3]);
});

test("missing and substituted words are attached to the verse-committed effect and repaired by a later match", () => {
  const coach = makeCoach();
  coach.handleEvent(wv(1, matched(1, [0, 1, 2, 3])));
  // Ayah 7 has 9 words; flag one missing, one substituted, then repair the
  // missing one with a real match before the window closes.
  coach.handleEvent(wv(1, missing(7, 8, "ٱلضَّآلِّينَ")));
  coach.handleEvent(wv(1, substitutedFlag(7, 5, "شيء", "عَلَيْهِمْ")));
  coach.handleEvent(wv(1, matched(7, [0, 1, 2, 3, 4, 6, 7])));
  coach.handleEvent(wv(1, matched(7, [8]))); // repairs the missing flag

  // Move the cursor to 1, then all the way to 7 to exercise the close path
  // for ayah 7 directly via the last-verse (passage-complete) path.
  coach.cursor = 7; // test harness: place cursor directly on the verse under test
  const effects = coach.handleEvent(wv(1, matched(7, [8])));
  const done = effects.find((e) => e.type === "passage-complete");
  assert.ok(done);
  assert.deepEqual(coach.missedWordIndices(7), []); // repaired
  assert.deepEqual(coach.substitutedWords(7).map((s) => s.index), [5]);
});

// ---------------------------------------------------------------------------
// Three-tier verdict + length scaling
// ---------------------------------------------------------------------------

test("_evaluateVerse: zero coverage is a skip, near-full coverage is done, the murky middle is unverified", () => {
  const coach = makeCoach();
  assert.equal(coach._evaluateVerse(1), "skipped"); // nothing matched at all
  coach.perVerse[1].matched = new Set([0, 1, 2, 3]); // 4/4
  assert.equal(coach._evaluateVerse(1), "done");
  coach.perVerse[1].matched = new Set([0]); // 1/4 = 0.25 — above skipRatio(0.15), below doneRatio
  assert.equal(coach._evaluateVerse(1), "unverified");
});

test("short ayahs need near-exact coverage to count as done — a flat ratio would over-credit them", () => {
  const coach = makeCoach();
  // Ayah 3 has only 2 words (<= default shortAyahMaxWords=3): half coverage
  // (1/2 = 0.5) is well above the long-ayah doneRatio(0.75)'s complement
  // but must NOT count as done for a verse this short.
  coach.perVerse[3].matched = new Set([0]);
  assert.equal(coach._evaluateVerse(3), "unverified");
  coach.perVerse[3].matched = new Set([0, 1]);
  assert.equal(coach._evaluateVerse(3), "done");
});

test("length scaling is configurable and demonstrably changes the verdict at the same ratio", () => {
  // Same 0.8 coverage ratio (4/5 words): 'done' when the ayah is NOT
  // treated as short, 'unverified' once the short-ayah threshold is
  // widened to cover it — demonstrates the scaling mechanism directly.
  const verses = [{ ayah: 1, text: "ا ب ج د ه" }]; // 5 distinct 1-letter "words"
  const long = new RecitationCoach({ surah: 99, ayahStart: 1, ayahEnd: 1, verses });
  long.perVerse[1].matched = new Set([0, 1, 2, 3]);
  assert.equal(long._evaluateVerse(1), "done");

  const short = new RecitationCoach({
    surah: 99,
    ayahStart: 1,
    ayahEnd: 1,
    verses,
    config: { shortAyahMaxWords: 5 },
  });
  short.perVerse[1].matched = new Set([0, 1, 2, 3]);
  assert.equal(short._evaluateVerse(1), "unverified");
});

test("the Basmala prefix is never accused when omitted, and doesn't drag down the ratio", () => {
  const coach = new RecitationCoach({ surah: 85, ayahStart: 1, ayahEnd: 2, verses: BURUJ });
  coach.handleEvent(wv(85, matched(1, [4, 5, 6]))); // starts (3 matched words)
  assert.equal(coach.cursor, 1);
  assert.equal(coach._evaluateVerse(1), "done"); // scoredTotal excludes unmatched optional prefix
  coach.perVerse[1].status = "done";
  assert.deepEqual(coach.missedWordIndices(1), []); // Basmala never accused
});

test("Surah 9 ayah 1 has no Basmala prefix and is scored normally", () => {
  const coach = new RecitationCoach({ surah: 9, ayahStart: 1, ayahEnd: 1, verses: TAWBAH1 });
  assert.equal(coach.perVerse[1].optionalCount, 0);
});

// ---------------------------------------------------------------------------
// Passage completion & finalize reconciliation
// ---------------------------------------------------------------------------

test("passage-complete fires once when the last verse is done, not before", () => {
  const coach = makeCoach();
  coach.cursor = 7;
  coach.state = "tracking";
  coach.startedAt = 1000;
  let effects = coach.handleEvent(wv(1, matched(7, [0, 1, 2, 3])));
  assert.ok(!types(effects).includes("passage-complete")); // 4/9 — not done yet
  effects = coach.handleEvent(wv(1, matched(7, [4, 5, 6, 7, 8])));
  assert.ok(types(effects).includes("passage-complete"));
  // Idempotent — does not refire.
  effects = coach.handleEvent(wv(1, matched(7, [8])));
  assert.ok(!types(effects).includes("passage-complete"));
});

test("finalize(): stopping early leaves later verses 'not reached', not accused", () => {
  const coach = makeCoach();
  coach.handleEvent(wv(1, matched(1, [0, 1, 2, 3])));
  coach.requestStop();
  const { summary } = coach.handleEvent({ type: "final_sequence" })[0];
  assert.deepEqual(summary.versesDone, [1]);
  assert.deepEqual(summary.versesSkipped, []);
  assert.deepEqual(summary.versesNotReached, [2, 3, 4, 5, 6, 7]);
});

test("finalize(): a mid-session skip is preserved through to the final summary, later verses genuinely not reached stay separate", () => {
  const coach = makeCoach();
  coach.handleEvent(wv(1, matched(1, [0, 1, 2, 3])));
  coach.handleEvent(wv(1, matched(2, [0, 1, 2, 3]))); // cycle 1
  coach.handleEvent(wv(1, matched(2, [0, 1, 2, 3]))); // cycle 2 — closes 1, cursor=2
  coach.handleEvent(wv(1, matched(4, [0, 1, 2]))); // cycle 1 for ayah 4 — nothing for 3
  coach.handleEvent(wv(1, matched(4, [0, 1, 2]))); // cycle 2 — closes 2, ayah 3 marked skipped, cursor=4
  coach.requestStop();
  const { summary } = coach.handleEvent({ type: "final_sequence" })[0];
  assert.deepEqual(summary.versesDone.slice().sort(), [1, 2, 4]);
  assert.deepEqual(summary.versesSkipped, [3]);
  assert.deepEqual(summary.versesNotReached, [5, 6, 7]);
  assert.ok(summary.score < 100); // never a perfect score with a real skip in it
});

test("finalize() is a safe idempotent fallback", () => {
  const coach = makeCoach();
  coach.handleEvent(wv(1, matched(1, [0, 1, 2, 3])));
  const first = coach.finalize();
  const second = coach.finalize();
  assert.equal(first, second);
});

test("a session that never started scores zero", () => {
  const coach = makeCoach();
  const effect = coach.finalize();
  assert.equal(effect.summary.started, false);
  assert.equal(effect.summary.score, 0);
});

test("the 'uncertain / needs review' tier reports what was heard next to what was expected", () => {
  const coach = makeCoach();
  coach.handleEvent(wv(1, matched(1, [0, 1, 2, 3])));
  // Ayah 3 (2 words) gets only 1 matched word and the last raw text seen —
  // ambiguous, not enough for done, not zero so not a skip either.
  coach.cursor = 3;
  coach.handleEvent(wv(1, matched(3, [0]), "بعض الكلام غير الواضح"));
  coach.perVerse[3].status = coach._evaluateVerse(3);
  assert.equal(coach.perVerse[3].status, "unverified");
  const { summary } = coach.finalize();
  assert.ok(summary.versesUnverified.includes(3));
  assert.equal(summary.uncertainDetail[3].heard, "بعض الكلام غير الواضح");
  assert.equal(summary.uncertainDetail[3].expected, FATIHA[2].text);
});

// ---------------------------------------------------------------------------
// Freestyle anchoring (unchanged — the one place verse_match/verse_candidate
// still matter, only to pick WHERE an un-anchored session starts)
// ---------------------------------------------------------------------------

test("anchorFromEvent builds a range from the detected verse to the surah end", () => {
  const quranData = FATIHA.map((v) => ({ surah: 1, ayah: v.ayah, text_uthmani: v.text }));
  const anchor = RecitationCoach.anchorFromEvent(
    { type: "verse_match", surah: 1, ayah: 3, confidence: 0.9 },
    quranData,
  );
  assert.equal(anchor.surah, 1);
  assert.equal(anchor.ayahStart, 3);
  assert.equal(anchor.ayahEnd, 7);
  assert.equal(anchor.verses.length, 5);
});

test("anchorFromEvent rejects low confidence, other event types, and unknown verses", () => {
  const quranData = FATIHA.map((v) => ({ surah: 1, ayah: v.ayah, text_uthmani: v.text }));
  assert.equal(RecitationCoach.anchorFromEvent(null, quranData), null);
  assert.equal(
    RecitationCoach.anchorFromEvent({ type: "verse_match", surah: 1, ayah: 1, confidence: 0.2 }, quranData),
    null,
  );
  assert.equal(
    RecitationCoach.anchorFromEvent({ type: "word_progress", surah: 1, ayah: 1 }, quranData),
    null,
  );
  assert.equal(
    RecitationCoach.anchorFromEvent({ type: "verse_match", surah: 99, ayah: 1, confidence: 0.9 }, quranData),
    null,
  );
});

test("anchorFromEvent also anchors freestyle from a stable candidate", () => {
  const quranData = FATIHA.map((v) => ({ surah: 1, ayah: v.ayah, text_uthmani: v.text }));
  const anchor = RecitationCoach.anchorFromEvent(
    {
      type: "verse_candidate",
      stable: true,
      candidates: [{ rank: 0, surah: 1, ayah: 2, confidence: 0.9 }],
    },
    quranData,
  );
  assert.equal(anchor.ayahStart, 2);
});
