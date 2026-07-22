/**
 * Unit tests for the RecitationCoach state machine (js/recitation-coach.js).
 * Run with: npm test  (node --test test/)
 *
 * Architecture (see CLAUDE.md, "record, then evaluate once"): the coach no
 * longer tracks a live cursor or decides anything ayah-by-ayah in real
 * time. It accumulates alignment evidence (word_verdicts — see
 * align.test.mjs for the alignment engine itself) for every ayah in the
 * picked passage as it arrives, with no ordering/timing assumptions, and
 * only decides done/skipped/uncertain per ayah ONCE, at finalize() (a
 * manual stop, or the UI's fallback). tilawa's own tracker diagnostics
 * (verse_match, word_progress, verse_candidate, lex_check,
 * tracking_abandoned) are no longer trusted for verse identity or scoring
 * — handleEvent is a documented no-op for all of them.
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
// Accumulation — no cursor, no ordering assumptions
// ---------------------------------------------------------------------------

test("'started' fires once total accumulated evidence crosses the threshold, spread across messages and ayahs", () => {
  const coach = makeCoach();
  // Evidence accumulates (and word-progress fires) even before the
  // 'started' threshold is crossed — there's no cursor to protect from a
  // premature start anymore, so there's nothing to gate.
  const first = coach.handleEvent(wv(1, matched(1, [0, 1]))); // 2 total — not enough to start
  assert.deepEqual(types(first), ["word-progress"]);
  assert.equal(coach.state, "awaiting_start");
  // A SEPARATE ayah's evidence in a later message pushes the total over —
  // no per-message or per-ayah anchor point required.
  const effects = coach.handleEvent(wv(1, matched(4, [0])));
  assert.deepEqual(types(effects), ["started", "word-progress"]);
  assert.equal(coach.state, "tracking");
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

test("evidence accumulates regardless of the order ayahs are touched in", () => {
  const coach = makeCoach();
  // Ayah 4 evidenced before ayah 1 or 2 — there is no cursor to confuse.
  coach.handleEvent(wv(1, matched(4, [0, 1, 2])));
  coach.handleEvent(wv(1, matched(1, [0, 1, 2, 3])));
  coach.requestStop();
  const { summary } = coach.handleEvent({ type: "final_sequence" })[0];
  assert.ok(summary.versesDone.includes(1));
  assert.ok(summary.versesDone.includes(4));
});

test("missing and substituted words are attached at finalize, and a later match repairs an earlier flag", () => {
  const coach = makeCoach();
  coach.handleEvent(wv(1, matched(1, [0, 1, 2]))); // gets the session started
  // Ayah 7 has 9 words; flag one missing, one substituted, then repair the
  // missing one with a real match before finalize.
  coach.handleEvent(wv(1, missing(7, 8, "ٱلضَّآلِّينَ")));
  coach.handleEvent(wv(1, substitutedFlag(7, 5, "شيء", "عَلَيْهِمْ")));
  coach.handleEvent(wv(1, matched(7, [0, 1, 2, 3, 4, 6, 7])));
  coach.handleEvent(wv(1, matched(7, [8]))); // repairs the missing flag
  coach.requestStop();
  const { summary } = coach.handleEvent({ type: "final_sequence" })[0];
  assert.ok(summary.versesDone.includes(7));
  assert.deepEqual(summary.missedWords[7] || [], []); // repaired — not reported
  assert.equal(summary.substitutedWords[7][0].index, 5);
});

// ---------------------------------------------------------------------------
// Three-tier verdict + length scaling (pure function, unchanged in spirit)
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
  // Only the 3 REAL words of ayah 1 (indices 4,5,6) are ever matched — the
  // Basmala prefix (0-3) is skipped, as isti'adhah/Basmala conventions
  // allow.
  coach.handleEvent(wv(85, matched(1, [4, 5, 6])));
  assert.equal(coach.cursor, undefined); // no cursor concept anymore
  assert.equal(coach._evaluateVerse(1), "done"); // scoredTotal excludes unmatched optional prefix
  coach.perVerse[1].status = "done";
  assert.deepEqual(coach.missedWordIndices(1), []); // Basmala never accused
});

test("Surah 9 ayah 1 has no Basmala prefix and is scored normally", () => {
  const coach = new RecitationCoach({ surah: 9, ayahStart: 1, ayahEnd: 1, verses: TAWBAH1 });
  assert.equal(coach.perVerse[1].optionalCount, 0);
});

// ---------------------------------------------------------------------------
// finalize() — the ONE evaluation pass
// ---------------------------------------------------------------------------

test("field scenario: an ayah with zero evidence between two well-recited ones is caught at finalize", () => {
  // This is the exact shape of the real regression this whole rewrite
  // exists for (Surah 78/An-Naba, ayahs 8 and 10 — see CLAUDE.md): a verse
  // with ZERO real evidence, sitting between two verses that DO have
  // strong evidence. There is no cursor to get confused by ordering or
  // timing anymore — finalize() just looks at what ended up accumulated
  // for every ayah, once, at the end.
  const coach = makeCoach();
  coach.handleEvent(wv(1, matched(1, [0, 1, 2, 3])));
  coach.handleEvent(wv(1, matched(4, [0, 1, 2]))); // ayahs 2 and 3 never touched at all
  coach.requestStop();
  const { summary } = coach.handleEvent({ type: "final_sequence" })[0];
  assert.deepEqual(summary.versesDone.slice().sort(), [1, 4]);
  assert.deepEqual(summary.versesSkipped, [2, 3]);
  assert.deepEqual(summary.versesNotReached, [5, 6, 7]);
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

test("final_sequence without a requested stop is just a checkpoint — no auto-completion", () => {
  const coach = makeCoach();
  coach.handleEvent(wv(1, matched(1, [0, 1, 2, 3])));
  const effects = coach.handleEvent({ type: "final_sequence" });
  assert.deepEqual(types(effects), ["checkpoint"]);
  assert.equal(coach.state, "tracking"); // session stays open
});

test("the 'uncertain / needs review' tier reports what was heard next to what was expected", () => {
  const coach = makeCoach();
  coach.handleEvent(wv(1, matched(1, [0, 1, 2, 3])));
  // Ayah 3 (2 words) gets only 1 matched word and the last raw text seen —
  // ambiguous, not enough for done, not zero so not a skip either.
  coach.handleEvent(wv(1, matched(3, [0]), "بعض الكلام غير الواضح"));
  coach.requestStop();
  const { summary } = coach.handleEvent({ type: "final_sequence" })[0];
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
