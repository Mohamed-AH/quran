/**
 * Unit tests for the RecitationCoach state machine (js/recitation-coach.js).
 * Run with: npm test  (node --test test/)
 *
 * Events are scripted tilawa WorkerOutbound messages — no audio, no model.
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

const vm = (ayah, confidence = 0.9, surah = 1) => ({
  type: "verse_match",
  surah,
  ayah,
  confidence,
  verse_text: "",
  surah_name: "",
  surrounding_verses: [],
});

// word_index mirrors tilawa's semantics: the alignment position (first
// unmatched index), i.e. one past the furthest matched word.
const wp = (ayah, matched, surah = 1) => ({
  type: "word_progress",
  surah,
  ayah,
  word_index: matched.length ? Math.max(...matched) + 1 : 0,
  total_words: 0,
  matched_indices: matched,
});

// tilawa's tracking_cycle diagnostic: word_matches>0 (real lexical) vs
// acoustic_word/char_word fallback (position-only, duration-based).
const lc = (surah, ayah, lexical) => ({
  type: 'lex_check',
  surah,
  ayah,
  lexical,
});

const fin = (ayahs, confidence = 0.9) => ({
  type: "final_sequence",
  verses: ayahs.map((a) => ({ surah: 1, ayah: a, confidence })),
  confidence,
});

function allWords(ayah) {
  const total = RecitationCoach.countWords(FATIHA[ayah - 1].text);
  return Array.from({ length: total }, (_, i) => i);
}

/** Recite one verse fully: commit + full word progress. */
function reciteVerse(coach, ayah) {
  const effects = [];
  effects.push(...coach.handleEvent(vm(ayah)));
  effects.push(...coach.handleEvent(wp(ayah, allWords(ayah))));
  return effects;
}

const types = (effects) => effects.map((e) => e.type);

// ---------------------------------------------------------------------------
// Tokenization contract
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
// Start detection
// ---------------------------------------------------------------------------

test("ignores pre-roll noise and starts on first confident in-range match", () => {
  const coach = makeCoach();
  // Out-of-range noise before starting — never an error, never a strike.
  assert.deepEqual(coach.handleEvent(vm(255, 0.9, 2)), []);
  assert.deepEqual(coach.handleEvent(vm(1, 0.3)), []); // low confidence
  assert.equal(coach.state, "awaiting_start");

  const effects = coach.handleEvent(vm(1, 0.8));
  assert.deepEqual(types(effects), ["started", "verse-active"]);
  assert.equal(coach.state, "tracking");
  assert.equal(coach.cursor, 1);
});

test("starting mid-range marks earlier verses provisionally skipped", () => {
  const coach = makeCoach();
  const effects = coach.handleEvent(vm(3));
  assert.deepEqual(types(effects), ["verses-skipped", "started", "verse-active"]);
  assert.deepEqual(effects[0].ayahs, [1, 2]);
});

test("field scenario: a borderline mid-range commit from pre-recitation noise does not start the session", () => {
  // Reproduces build-2026-07-20j (Surah 87): isti'adhah + Basmala audio,
  // which doesn't exist in the scoped DB, spuriously committed to ayah 11
  // via tilawa's "live_span_collapsed" fallback at confidence 0.83 — well
  // above the general startConfidence floor (0.55) but below the bar a
  // mid-passage start (which accuses 1,2 of being skipped) should require.
  const coach = makeCoach();
  assert.deepEqual(coach.handleEvent(vm(3, 0.83)), []);
  assert.equal(coach.state, "awaiting_start");
  assert.equal(coach.cursor, null);

  // A later, properly confident match still starts the session normally.
  const effects = coach.handleEvent(vm(3, 0.9));
  assert.deepEqual(types(effects), ["verses-skipped", "started", "verse-active"]);
});

test("starting exactly at ayahStart is unaffected by the mid-range confidence bar", () => {
  const coach = makeCoach();
  const effects = coach.handleEvent(vm(1, 0.6)); // below candidateStartConfidence
  assert.deepEqual(types(effects), ["started", "verse-active"]);
});

test("strong word_progress opens the session even without a confident commit", () => {
  const coach = makeCoach();
  const effects = coach.handleEvent(wp(1, [0, 1]));
  assert.ok(types(effects).includes("started"));
  assert.equal(coach.cursor, 1);
});

// ---------------------------------------------------------------------------
// Word progress, missed words, repetition tolerance
// ---------------------------------------------------------------------------

test("clean recitation completes with full score components", () => {
  const coach = makeCoach();
  for (let a = 1; a <= 7; a++) reciteVerse(coach, a);
  const effects = coach.handleEvent(fin([1, 2, 3, 4, 5, 6, 7]));
  assert.deepEqual(types(effects), ["completed"]);
  const s = effects[0].summary;
  assert.deepEqual(s.versesDone, [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(s.versesSkipped, []);
  assert.deepEqual(s.versesNotReached, []);
  assert.deepEqual(s.missedWords, {});
  assert.equal(s.wordCoverage, 1);
  assert.ok(s.score >= 95, `score ${s.score}`);
});

test("a done verse with ZERO coverage reports no missed words (no data, not an accusation)", () => {
  // Field scenario (build 2026-07-20e): verse 1 was recognized and the
  // session advanced past it before any word-level alignment ever ran on
  // it specifically (progress=0, matched empty) — the summary must not
  // claim "you missed all 4 words" when the truth is "we have no data".
  const coach = makeCoach();
  coach.handleEvent(vm(1)); // starts, but no word_progress/word_verdicts for verse 1 at all
  coach.handleEvent(vm(2)); // advance commits verse 1 with zero coverage
  assert.deepEqual(coach.missedWordIndices(1), []);
  reciteVerse(coach, 2);
  coach.requestStop();
  const s = coach.handleEvent(fin([1, 2]))[0].summary;
  assert.equal(s.missedWords[1], undefined, "no accusation for a verse with no alignment data at all");
});

test("a done verse with PARTIAL coverage still reports its unreached tail, as uncertain (small trailing gap)", () => {
  // 2-word gap reaching the verse's true last word — within
  // trailingUncertainTolerance, so it's ambiguous (see splitMissedWordIndices)
  // rather than a confirmed accusation.
  const coach = makeCoach();
  coach.handleEvent(vm(1));
  coach.handleEvent(wp(1, [0, 1])); // some real data: words 0-1 confirmed, 2-3 never reached
  coach.handleEvent(vm(2));
  assert.deepEqual(coach.missedWordIndices(1), []);
  assert.deepEqual(coach.uncertainWordIndices(1), [2, 3]);
});

// ---------------------------------------------------------------------------
// Isti'adhah/Basmala recitation conventions (all four accepted openings)
// ---------------------------------------------------------------------------

test("skipping the embedded Basmala (direct-to-surah opening) is never accused", () => {
  // Field scenario (build 2026-07-20h, Surah 85): reciter opened straight
  // into the surah content, skipping the Basmala entirely (a valid, common
  // convention). The transcript-alignment layer only ever matched the
  // REAL content words (indices 4,5,6), progress never touched 0-3.
  const coach = new RecitationCoach({ surah: 85, ayahStart: 1, ayahEnd: 2, verses: BURUJ });
  coach.handleEvent(wv([
    { ayah: 1, index: 4, status: "matched", expected: "والسماء" },
    { ayah: 1, index: 5, status: "matched", expected: "ذات" },
    { ayah: 1, index: 6, status: "matched", expected: "البروج" },
  ], 85));
  assert.equal(coach.state, "tracking");
  assert.deepEqual(coach.missedWordIndices(1), [], "Basmala prefix never accused");
  coach.requestStop();
  const s = coach.finalize().summary;
  assert.equal(s.missedWords[1], undefined);
  assert.equal(s.wordCoverage, 1, "omitting the optional Basmala must not lower word coverage");
});

test("reciting the Basmala too still earns credit (never penalized for saying it)", () => {
  // Single-verse range so the summary isolates verse 1's own coverage,
  // undiluted by an incidental zero-coverage cursor verse at stop time.
  const coach = new RecitationCoach({ surah: 85, ayahStart: 1, ayahEnd: 1, verses: BURUJ });
  coach.handleEvent(vm(1, 0.9, 85));
  coach.handleEvent(wp(1, [0, 1, 2, 3, 4, 5, 6], 85)); // full verse matched, incl. Basmala
  assert.deepEqual(coach.missedWordIndices(1), []);
  coach.requestStop();
  const s = coach.finalize().summary;
  assert.equal(s.wordCoverage, 1, "reciting the Basmala earns full credit, not just neutrality");
});

test("Al-Fatiha's own verse 1 (the Basmala itself) is NOT stripped", () => {
  // surah === 1 is explicitly excluded — the Basmala IS Fatiha's verse 1,
  // not an optional prefix to it.
  const coach = makeCoach();
  coach.handleEvent(vm(1));
  coach.handleEvent(vm(2)); // advance with zero word-level coverage of verse 1
  assert.deepEqual(
    coach.missedWordIndices(1),
    [],
    "zero-coverage guard still applies (unrelated to Basmala logic)"
  );
  // But with PARTIAL coverage, all 4 words of 1:1 are real content — none
  // are "optional" here. The trailing 2-word gap is still real evidence of
  // an incomplete verse, just reported as uncertain rather than confirmed
  // (see splitMissedWordIndices), same as any other small trailing gap.
  const coach2 = makeCoach();
  coach2.handleEvent(vm(1));
  coach2.handleEvent(wp(1, [0, 1]));
  coach2.handleEvent(vm(2));
  assert.deepEqual(coach2.missedWordIndices(1), []);
  assert.deepEqual(coach2.uncertainWordIndices(1), [2, 3]);
});

test("At-Tawbah 9:1 (no Basmala at all) is unaffected by the stripping logic", () => {
  const coach = new RecitationCoach({ surah: 9, ayahStart: 1, ayahEnd: 1, verses: TAWBAH1 });
  coach.handleEvent(vm(1, 0.9, 9));
  coach.handleEvent(wp(1, [0, 1], 9)); // only 2 of 9 real words confirmed
  // A 7-word gap is well beyond trailingUncertainTolerance — no ambiguity
  // leniency applies, it's fully and confidently accusable.
  assert.deepEqual(coach.missedWordIndices(1), [2, 3, 4, 5, 6, 7, 8], "all remaining words are real content, fully accusable");
  assert.deepEqual(coach.uncertainWordIndices(1), []);
});

test("missed words are counted only when the verse is committed past", () => {
  const coach = makeCoach();
  coach.handleEvent(vm(1));
  coach.handleEvent(wp(1, [0, 1, 2])); // word 3 of 1:1 never matched
  const effects = coach.handleEvent(vm(2)); // advancing commits verse 1
  const committed = effects.find((e) => e.type === "verse-committed");
  // A single trailing word is ambiguous (see splitMissedWordIndices), not a
  // confirmed accusation — reported as uncertain, never in missedWords.
  assert.deepEqual(committed.missedWords, []);
  assert.deepEqual(committed.uncertainWords, [3]);
});

test("a LARGER trailing gap stays a confirmed miss — the leniency only covers a small confirmation lag", () => {
  const coach = makeCoach();
  coach.handleEvent(vm(1));
  coach.handleEvent(wp(1, [0])); // words 1,2,3 of 1:1 never matched — a 3-word gap
  const effects = coach.handleEvent(vm(2));
  const committed = effects.find((e) => e.type === "verse-committed");
  assert.deepEqual(committed.missedWords, [1, 2, 3], "beyond trailingUncertainTolerance — real incompleteness, not just a lag");
  assert.deepEqual(committed.uncertainWords, []);
});

test("a gap that does NOT reach the verse's true last word is always a confirmed miss, never uncertain", () => {
  // The verse's true last word (index 3) was separately confirmed THIS
  // cycle even though the position marker is still at 2 — a realistic
  // lookahead match. Since the tail itself is confirmed, there is no
  // ambiguity: the gap in between is real, positively-evidenced, and
  // ineligible for the trailing leniency (which only ever applies to a run
  // that reaches the true last index).
  const coach = makeCoach();
  coach.handleEvent(vm(1));
  coach.handleEvent({
    type: "word_progress",
    surah: 1,
    ayah: 1,
    word_index: 2,
    total_words: 4,
    matched_indices: [3],
  });
  assert.deepEqual(coach.missedWordIndices(1), [2]);
  assert.deepEqual(coach.uncertainWordIndices(1), []);
});

test("field scenario: a verse's own last word, confirmed live moments before the transition, is not wrongly re-flagged", () => {
  // Reproduces build 2026-07-21f, Surah 21 ayahs 82-83 (log14-6): the real
  // event stream was word_progress 21:82 idx=11/12 matched=[7,9,10] (word
  // 82's last word never separately confirmed), then verse_match 21:83 —
  // the transcript shows "لهم حافظين" (word 82's last word) was genuinely
  // spoken. A 1-word trailing gap is now uncertain, not a confirmed miss.
  const words82 = Array.from({ length: 12 }, (_, i) => `ك82_${i}`).join(" ");
  const words83 = Array.from({ length: 10 }, (_, i) => `ك83_${i}`).join(" ");
  const coach = new RecitationCoach({
    surah: 21,
    ayahStart: 82,
    ayahEnd: 83,
    verses: [
      { ayah: 82, text: words82 },
      { ayah: 83, text: words83 },
    ],
  });
  coach.handleEvent(vm(82, 0.9, 21));
  coach.handleEvent({ type: "word_progress", surah: 21, ayah: 82, word_index: 11, total_words: 12, matched_indices: [7, 9, 10] });
  const effects = coach.handleEvent(vm(83, 0.9, 21));
  const committed = effects.find((e) => e.type === "verse-committed");
  assert.deepEqual(committed.missedWords, [], "must not be confirmed-missing — the last word was likely said");
  assert.deepEqual(committed.uncertainWords, [11]);
});

test("word repetition only adds coverage — never subtracts", () => {
  const coach = makeCoach();
  coach.handleEvent(vm(1));
  coach.handleEvent(wp(1, [0, 1]));
  coach.handleEvent(wp(1, [0])); // reciter repeats the first word for emphasis
  coach.handleEvent(wp(1, [2, 3]));
  const effects = coach.handleEvent(vm(2));
  const committed = effects.find((e) => e.type === "verse-committed");
  assert.deepEqual(committed.missedWords, []);
});

test("duplicate verse_match for the current verse is silently absorbed", () => {
  // The tracker re-emits verse_match on confirm/flush cycles — these must
  // not surface as anything (reciting the current verse again is a no-op).
  const coach = makeCoach();
  coach.handleEvent(vm(1)); // start + commit signal
  const effects = coach.handleEvent(vm(1)); // tracker re-emission
  assert.deepEqual(types(effects), []);
  assert.equal(coach.cursor, 1);
  assert.equal(coach.perVerse[1].repeats, 0);
});

test("going back to an earlier verse is repetition (with hysteresis) and can clear missed words", () => {
  const coach = makeCoach();
  coach.handleEvent(vm(1));
  coach.handleEvent(wp(1, [0, 1, 2])); // word 3 (tail) never reached
  coach.handleEvent(vm(2)); // advance — verse 1 committed with a tail miss
  const first = coach.handleEvent(vm(1)); // could be a stale re-emission…
  assert.deepEqual(types(first), [], "single backward match is not yet a repetition");
  assert.equal(coach.cursor, 2, "cursor must not move backward");
  const confirmed = coach.handleEvent(wp(1, [3])); // …but word progress confirms the revisit
  assert.ok(types(confirmed).includes("repetition"));
  reciteVerse(coach, 3);
  coach.requestStop();
  const fx = coach.handleEvent(fin([1, 2, 3]));
  const s = fx[0].summary;
  assert.equal(s.missedWords[1], undefined, "revisit cleared the missed tail word");
  assert.deepEqual(s.repeats, { 1: 1 });
});

test("stale backward verse_match during stop-flush never counts as repetition", () => {
  const coach = makeCoach();
  reciteVerse(coach, 1);
  reciteVerse(coach, 2);
  reciteVerse(coach, 3);
  coach.requestStop();
  coach.handleEvent(vm(2)); // flush re-emission of an earlier verse
  const s = coach.handleEvent(fin([1, 2, 3]))[0].summary;
  assert.deepEqual(s.repeats, {});
});

test("missed words are only claimed beyond the alignment high-water mark", () => {
  // Sparse incremental matches below the high-water mark must not be
  // reported as misses — only the unreached tail counts.
  const coach = makeCoach({ ayahStart: 7, ayahEnd: 7 });
  coach.handleEvent(vm(7));
  // position reached word 6 of 9, but only words 2 and 5 were reported
  coach.handleEvent({
    type: "word_progress", surah: 1, ayah: 7,
    word_index: 6, total_words: 9, matched_indices: [2, 5],
  });
  coach.requestStop();
  const s = coach.handleEvent(fin([7]))[0].summary;
  assert.deepEqual(s.missedWords[7], [6, 7, 8], "only the unreached tail is missed");
});

// ---------------------------------------------------------------------------
// Skips and identical-phrase disambiguation
// ---------------------------------------------------------------------------

test("a single jump match does NOT skip (hysteresis) — e.g. الرحمن الرحيم 1:1 vs 1:3", () => {
  const coach = makeCoach();
  coach.handleEvent(vm(1));
  // One noisy match claims we're at ayah 3 (identical phrase to part of 1:1).
  const first = coach.handleEvent(vm(3));
  assert.deepEqual(types(first), [], "no skip on a single event");
  assert.equal(coach.cursor, 1);
  // Recitation continues normally to ayah 2 — the phantom jump dissolves.
  const cont = coach.handleEvent(vm(2));
  assert.deepEqual(types(cont), ["verse-committed", "verse-active"]);
  assert.equal(coach.cursor, 2);
  coach.requestStop();
  const s = coach.handleEvent(fin([1, 2]))[0].summary;
  assert.deepEqual(s.versesSkipped, []);
});

test("a consistent jump (verse_match then word_progress) is a real skip", () => {
  const coach = makeCoach();
  coach.handleEvent(vm(1));
  coach.handleEvent(wp(1, allWords(1)));
  coach.handleEvent(vm(3)); // arm pending jump
  const confirm = coach.handleEvent(wp(3, [0, 1])); // consistent follow-up
  assert.ok(types(confirm).includes("verse-committed"));
  assert.ok(types(confirm).includes("verses-skipped"));
  const skipped = confirm.find((e) => e.type === "verses-skipped");
  assert.deepEqual(skipped.ayahs, [2]);
  assert.equal(coach.cursor, 3);
});

test("two consecutive verse_match events on the jump target also confirm a skip", () => {
  const coach = makeCoach();
  coach.handleEvent(vm(1));
  coach.handleEvent(vm(4));
  const confirm = coach.handleEvent(vm(4));
  const skipped = confirm.find((e) => e.type === "verses-skipped");
  assert.deepEqual(skipped.ayahs, [2, 3]);
  assert.equal(coach.cursor, 4);
});

test("final_sequence reconciliation rescues a provisionally-skipped verse", () => {
  const coach = makeCoach();
  coach.handleEvent(vm(1));
  coach.handleEvent(vm(3));
  coach.handleEvent(wp(3, allWords(3))); // confirmed jump: 2 marked skipped
  reciteVerse(coach, 4);
  coach.requestStop();
  // Tilawa's own final path says verse 2 WAS recited (weak commit recovered).
  const s = coach.handleEvent(fin([1, 2, 3, 4]))[0].summary;
  assert.ok(s.versesDone.includes(2), "verse 2 rescued by reconciliation");
  assert.deepEqual(s.versesSkipped, []);
});

// ---------------------------------------------------------------------------
// Pauses, checkpoints, session end
// ---------------------------------------------------------------------------

test("mid-session silence flush is a checkpoint, not the end", () => {
  const coach = makeCoach();
  reciteVerse(coach, 1);
  reciteVerse(coach, 2);
  // Long contemplation pause → tracker flushes its final sequence.
  const fx = coach.handleEvent(fin([1, 2]));
  assert.deepEqual(types(fx), ["checkpoint"]);
  assert.equal(coach.state, "tracking", "session stays open through the pause");
  // Reciter resumes with the next verse (tracker re-discovery).
  const resumed = coach.handleEvent(vm(3));
  assert.ok(types(resumed).includes("verse-active"));
  assert.equal(coach.cursor, 3);
});

test("manual stop finalizes on the flushed final_sequence", () => {
  const coach = makeCoach();
  reciteVerse(coach, 1);
  coach.requestStop();
  const fx = coach.handleEvent(fin([1]));
  assert.deepEqual(types(fx), ["completed"]);
  const s = fx[0].summary;
  assert.deepEqual(s.versesDone, [1]);
  assert.deepEqual(s.versesNotReached, [2, 3, 4, 5, 6, 7]);
});

test("finishing the last verse auto-completes on the silence flush", () => {
  const coach = makeCoach({ ayahStart: 6, ayahEnd: 7 });
  reciteVerse(coach, 6);
  reciteVerse(coach, 7);
  const fx = coach.handleEvent(fin([6, 7])); // no stop requested
  assert.deepEqual(types(fx), ["completed"]);
  assert.deepEqual(fx[0].summary.versesDone, [6, 7]);
});

test("passage-complete fires as soon as the last verse is covered, not just on the silence flush", () => {
  // Field complaint: picking an end verse doesn't stop the mic there —
  // nothing signals "done" until tilawa's own silence timeout (several
  // seconds) or a manual stop. reciteVerse() commits via vm() then fully
  // covers via wp(ayah, allWords(ayah)) — the word_progress reaching full
  // coverage is what fires passage-complete (the transition vm(7) itself,
  // A===cursor+1, doesn't — only a verse_match for the SAME cursor verse or
  // word_progress checks it, mirroring exactly what _finalize() already
  // uses to decide the last verse is done).
  const coach = makeCoach({ ayahStart: 6, ayahEnd: 7 });
  reciteVerse(coach, 6);
  const fx = reciteVerse(coach, 7);
  assert.ok(types(fx).includes("passage-complete"));
  const effect = fx.find((e) => e.type === "passage-complete");
  assert.equal(effect.ayah, 7);
});

test("passage-complete does not fire before the last verse, and fires only once", () => {
  const coach = makeCoach({ ayahStart: 6, ayahEnd: 7 });
  const early = reciteVerse(coach, 6);
  assert.ok(!types(early).includes("passage-complete"), "verse 6 is not the last verse");
  const first = reciteVerse(coach, 7);
  assert.ok(types(first).includes("passage-complete"));
  // A duplicate verse_match for the same (already-committed) last verse
  // must not refire it.
  const again = coach.handleEvent(vm(7));
  assert.ok(!types(again).includes("passage-complete"));
});

test("passage-complete does NOT fire from a bare verse_match with no real word coverage", () => {
  // Field case (build 2026-07-21f, Surah 21 ayah 105): a content-blind
  // "live span collapsed" commit landed on the passage's last verse with
  // essentially zero word progress, and the coach fired passage-complete
  // immediately — js/recitation.js's auto-stop then cut the mic ~2s later,
  // before the verse's own final words were ever captured. A bare commit
  // (sawCommit alone) must never be enough on its own.
  const coach = makeCoach({ ayahStart: 7, ayahEnd: 7 });
  const fx = coach.handleEvent(vm(7));
  assert.ok(!types(fx).includes("passage-complete"), "no word coverage yet — must not stop the mic");
  const fx2 = coach.handleEvent(vm(7)); // even a repeated/re-confirmed bare commit
  assert.ok(!types(fx2).includes("passage-complete"));
});

test("field scenario: passage-complete waits for near-full coverage on a long last verse, not just 80%", () => {
  // Reproduces build 2026-07-21i, Surah 98 ayah 8 (21 words): the reciter
  // was still audibly continuing (raw transcribe activity for 4+ more
  // seconds) when word coverage merely crossed 18/21 (85.7%) — comfortably
  // above the old reconcileCoverage (0.8) bar — and the ~2s auto-stop timer
  // cut the mic before the last 2 words were ever captured. A coverage
  // FRACTION doesn't scale: 20% of 21 words is 4 words left uncaptured. The
  // bar is now absolute (at most 1 word may remain), regardless of verse
  // length.
  const words8 = Array.from({ length: 21 }, (_, i) => `ك8_${i}`).join(" ");
  const coach = new RecitationCoach({
    surah: 98,
    ayahStart: 8,
    ayahEnd: 8,
    verses: [{ ayah: 8, text: words8 }],
  });
  coach.handleEvent(vm(8, 0.99, 98));
  let fx = coach.handleEvent(wp(8, Array.from({ length: 18 }, (_, i) => i), 98)); // 18/21
  assert.ok(!types(fx).includes("passage-complete"), "18/21 (85.7%) is not near-done on a 21-word verse");
  fx = coach.handleEvent(wp(8, Array.from({ length: 19 }, (_, i) => i), 98)); // 19/21
  assert.ok(!types(fx).includes("passage-complete"), "19/21 still leaves 2 words — must keep listening");
  fx = coach.handleEvent(wp(8, Array.from({ length: 20 }, (_, i) => i), 98)); // 20/21 — only the last word left
  assert.ok(types(fx).includes("passage-complete"), "only 1 word remaining is close enough to stop safely");
});

test("finalize() is a safe idempotent fallback", () => {
  const coach = makeCoach();
  reciteVerse(coach, 1);
  const first = coach.finalize();
  assert.equal(first.type, "completed");
  const second = coach.finalize();
  assert.deepEqual(second, first);
  // Events after the end are ignored.
  assert.deepEqual(coach.handleEvent(vm(2)), []);
});

test("a session that never started scores zero", () => {
  const coach = makeCoach();
  coach.requestStop();
  const s = coach.finalize().summary;
  assert.equal(s.started, false);
  assert.equal(s.score, 0);
});

// ---------------------------------------------------------------------------
// Candidate-based start (tracker advance gate stuck on a noise commit)
// ---------------------------------------------------------------------------

// Mirrors the real tracker: rank starts at 1, first entry is the
// fusion/champion pick (which can be out-of-range).
const vc = (candidates, stable = true) => ({
  type: "verse_candidate",
  candidates: candidates.map((c, i) => ({ rank: i + 1, source: "discovery", ...c })),
  stable,
  final_flush: false,
});

test("a stable in-range span candidate starts the session through the span", () => {
  const coach = makeCoach();
  // Field scenario: tracker stuck on 104:9, discovery ranks 1:1-3 top.
  const fx = coach.handleEvent(vc([{ surah: 1, ayah: 1, ayah_end: 3, confidence: 0.98 }]));
  assert.ok(types(fx).includes("started"));
  assert.equal(coach.state, "tracking");
  assert.equal(coach.cursor, 3, "cursor lands on the span's last verse");
  assert.ok(coach.perVerse[1].sawCommit && coach.perVerse[2].sawCommit);
  coach.requestStop();
  const s = coach.handleEvent(fin([1, 2, 3]))[0].summary;
  assert.deepEqual(s.versesDone, [1, 2, 3]);
});

test("an unstable candidate needs two consistent sightings (hysteresis)", () => {
  const coach = makeCoach();
  assert.deepEqual(coach.handleEvent(vc([{ surah: 1, ayah: 1, confidence: 0.95 }], false)), []);
  assert.equal(coach.state, "awaiting_start");
  const fx = coach.handleEvent(vc([{ surah: 1, ayah: 1, confidence: 0.95 }], false));
  assert.ok(types(fx).includes("started"));
  assert.equal(coach.cursor, 1);
});

test("low-confidence and out-of-range candidates never start a session", () => {
  const coach = makeCoach();
  assert.deepEqual(coach.handleEvent(vc([{ surah: 1, ayah: 1, confidence: 0.5 }])), []);
  assert.deepEqual(coach.handleEvent(vc([{ surah: 104, ayah: 9, confidence: 0.99 }])), []);
  assert.equal(coach.state, "awaiting_start");
});

test("an in-range candidate ranked BELOW an out-of-range leader still starts", () => {
  // Field bug: fusion ranked 87:1 first while the correct 1:1-2 span sat
  // second — the coach must scan the whole list for in-range candidates.
  const coach = makeCoach();
  const fx = coach.handleEvent(
    vc([
      { surah: 87, ayah: 1, confidence: 0.86 },
      { surah: 1, ayah: 1, ayah_end: 2, confidence: 0.93 },
    ])
  );
  assert.ok(types(fx).includes("started"));
  assert.equal(coach.cursor, 2);
});

test("transcript-aligned words start the session with no tracker involvement", () => {
  const coach = makeCoach(); // default config — transcriptStart is on
  const fx = coach.handleEvent(
    wv([
      { ayah: 1, index: 0, status: "matched", expected: "بسم" },
      { ayah: 1, index: 1, status: "matched", expected: "الله" },
      { ayah: 1, index: 2, status: "matched", expected: "الرحمن" },
    ])
  );
  assert.ok(types(fx).includes("started"));
  assert.equal(coach.cursor, 1);
  // Two matched words are NOT enough evidence.
  const cold = makeCoach();
  assert.deepEqual(
    types(cold.handleEvent(wv([
      { ayah: 1, index: 0, status: "matched", expected: "x" },
      { ayah: 1, index: 1, status: "matched", expected: "y" },
    ]))),
    []
  );
});

test("field scenario: words spoken during a pre-recitation false lock are not accused, but a later real gap still is", () => {
  // Reproduces build-2026-07-21 (Surah 21 ayah 97): a pre-recitation false
  // lock on an out-of-range verse consumed the real audio for this verse's
  // first several words before the coach's own tracking (transcript-start,
  // never touching v.progress) took over mid-verse — those early words were
  // very likely said, just never observed, and must not be reported missed.
  // A genuine gap AFTER observation began (word 6, never confirmed even
  // though 3-5 and 7-8 were) is still real positive evidence and stays
  // accused.
  const coach = makeCoach();
  const fx = coach.handleEvent(
    wv([
      { ayah: 7, index: 3, status: "matched", expected: "w" },
      { ayah: 7, index: 4, status: "matched", expected: "w" },
      { ayah: 7, index: 5, status: "matched", expected: "w" },
    ])
  );
  assert.ok(types(fx).includes("started"), "transcript-start opens the session mid-verse");
  assert.equal(coach.cursor, 7);
  assert.equal(coach.perVerse[7].progress, 0, "tilawa's own tracker never touched this verse");
  coach.handleEvent(
    wv([
      { ayah: 7, index: 7, status: "matched", expected: "w" },
      { ayah: 7, index: 8, status: "matched", expected: "w" },
    ])
  );
  assert.deepEqual(
    coach.missedWordIndices(7),
    [6],
    "words 0-2 (before observation began) are not accused; word 6 (a real gap) still is"
  );
});

test("transcript-aligned words in the next verse advance the cursor", () => {
  const coach = makeCoach();
  coach.handleEvent(vm(1));
  coach.handleEvent(wp(1, allWords(1))); // verse 1 fully covered
  const fx = coach.handleEvent(
    wv([
      { ayah: 2, index: 0, status: "matched", expected: "الحمد" },
      { ayah: 2, index: 1, status: "matched", expected: "لله" },
    ])
  );
  assert.ok(types(fx).includes("verse-committed"));
  assert.equal(coach.cursor, 2, "advanced without any tracker verse_match");
});

test("accusation flags stay gated even though transcript-start is on", () => {
  const coach = makeCoach(); // useWordVerdicts false, transcriptStart true
  coach.handleEvent(vm(1));
  coach.handleEvent(wv([{ ayah: 1, index: 2, status: "substituted", heard: "x", expected: "y" }]));
  coach.requestStop();
  const s = coach.handleEvent(fin([1]))[0].summary;
  assert.deepEqual(s.substitutedWords, {}, "no accusations without the calibration flag");
});

test("field scenario: a collapsed span commit no longer accuses the covered verses", () => {
  // Reproduces the exact build-2026-07-20c report: tilawa's discovery finds
  // span 1:2-4 but (by its own documented design) commits only verse 2
  // ("live span collapsed to first ayah"), then later jumps straight to 5.
  const coach = makeCoach();
  coach.handleEvent(vm(1));
  coach.handleEvent(wp(1, allWords(1)));
  coach.handleEvent(vm(2)); // commit verse 2
  // Discovery's span candidate for 2-4 arrives (the evidence tilawa itself
  // saw before collapsing its commit) — recorded even though nothing acts
  // on it yet.
  coach.handleEvent(vc([{ surah: 1, ayah: 2, ayah_end: 4, confidence: 0.93 }]));
  // Tracker then jumps straight to verse 5 (hysteresis: match + confirming
  // word_progress), skipping past 3 and 4 in the tracker's own timeline.
  coach.handleEvent(vm(5));
  const fx = coach.handleEvent(wp(5, allWords(5)));
  assert.ok(types(fx).includes("verse-committed"));
  const skipEffect = fx.find((e) => e.type === "verses-skipped");
  assert.ok(!skipEffect, "3 and 4 must NOT be reported skipped — evidence covered them");
  assert.equal(coach.perVerse[3].status, "done");
  assert.equal(coach.perVerse[4].status, "done");
  coach.requestStop();
  const s = coach.handleEvent(fin([1, 2, 3, 4, 5]))[0].summary;
  assert.deepEqual(s.versesSkipped, []);
  assert.ok(s.versesDone.includes(3) && s.versesDone.includes(4));
});

test("field scenario: an unstable span candidate does NOT rescue a genuinely skipped verse", () => {
  // Reproduces build-2026-07-21 (Surah 21 / Al-Anbiya, ayahs 25-30): ayah 27
  // was never recited — the decoded transcript shows ayah 26's tail flowing
  // directly into ayah 28's opening — but a single, never-stable "1:2-4"
  // (mirroring the real "21:26-27") candidate, its confidence dominated by
  // the strongly-matching FIRST verse, got recorded as spanEvidence for the
  // second verse too, wrongly rescuing it from a real skip.
  const coach = makeCoach();
  coach.handleEvent(vm(1));
  coach.handleEvent(wp(1, allWords(1)));
  coach.handleEvent(vm(2));
  coach.handleEvent(wp(2, allWords(2)));
  // Unstable span candidate (stable: false) — must NOT count as evidence.
  coach.handleEvent(vc([{ surah: 1, ayah: 2, ayah_end: 3, confidence: 0.93 }], false));
  coach.handleEvent(vm(4)); // forward-jump hysteresis: first sighting only arms it
  const fx = coach.handleEvent(wp(4, allWords(4))); // second consistent event confirms
  const skipEffect = fx.find((e) => e.type === "verses-skipped");
  assert.ok(skipEffect, "verse 3 must be reported skipped — the only evidence for it was unstable");
  assert.deepEqual(skipEffect.ayahs, [3]);
  assert.equal(coach.perVerse[3].status, "skipped");
});

test("field scenario: a single never-stabilized SINGLE-verse candidate rescues a genuinely-recited verse from a late-lock cascade skip, while a real skip beside it is still caught", () => {
  // Reproduces build 2026-07-21f, Surah 21 ayahs 88-91: the coach sat in
  // awaiting_start chasing unrelated out-of-range acoustic locks while the
  // reciter correctly recited 88 and 89 (89 word-perfectly), then genuinely
  // skipped 90, then the coach finally locked onto 91 late — one event that
  // blanket-flagged EVERYTHING before it, including the genuinely correct
  // verses, as skipped. Verse 4 here stands in for 89: its only trace is a
  // single, never-stable, SINGLE-verse candidate at 0.92 — previously
  // discarded outright because spanEvidence required stability for every
  // candidate, span or not. Verse 5 stands in for the genuine skip (90): it
  // has zero evidence and must still be flagged. (88 is deliberately left
  // out of scope here — with literally zero recorded evidence, it's
  // indistinguishable from a real skip and correctly stays flagged, the
  // same accepted tradeoff as any other unevidenced gap.)
  const coach = makeCoach({ ayahStart: 4, ayahEnd: 6 });
  // Single-verse (ayah === ayah_end) candidate, seen only once, never stable.
  coach.handleEvent(vc([{ surah: 1, ayah: 4, ayah_end: 4, confidence: 0.92 }], false));
  // The coach never actually starts until the late lock on verse 6.
  const fx = coach.handleEvent(vm(6, 0.99));
  const skipEffect = fx.find((e) => e.type === "verses-skipped");
  assert.ok(skipEffect, "verse 5 (the genuine skip) must still be reported");
  assert.deepEqual(skipEffect.ayahs, [5], "verse 4 must be rescued, not blanket-flagged with the real skip");
  assert.equal(coach.perVerse[4].status, "done");
  assert.equal(coach.perVerse[5].status, "skipped");
});

test("a genuine skip with NO discovery evidence is still reported", () => {
  const coach = makeCoach();
  coach.handleEvent(vm(1));
  coach.handleEvent(wp(1, allWords(1)));
  coach.handleEvent(vm(2));
  // No verse_candidate evidence for 3/4 at all this time.
  coach.handleEvent(vm(5));
  const fx = coach.handleEvent(wp(5, allWords(5)));
  const skipEffect = fx.find((e) => e.type === "verses-skipped");
  assert.deepEqual(skipEffect.ayahs, [3, 4]);
  assert.equal(coach.perVerse[3].status, "skipped");
});

test("transcript advance can jump two verses at once when both are evidenced", () => {
  const coach = makeCoach();
  coach.handleEvent(vm(1));
  coach.handleEvent(wp(1, allWords(1)));
  const fx = coach.handleEvent(
    wv([
      { ayah: 2, index: 0, status: "matched", expected: "w" },
      { ayah: 2, index: 1, status: "matched", expected: "w" },
      { ayah: 3, index: 0, status: "matched", expected: "w" },
      { ayah: 3, index: 1, status: "matched", expected: "w" },
    ])
  );
  assert.ok(types(fx).includes("verse-committed"));
  assert.equal(coach.cursor, 3, "jumped straight to verse 3, verse 2 not left as pending");
  assert.equal(coach.perVerse[2].status, "done");
});

test("candidates are ignored once the session is tracking", () => {
  const coach = makeCoach();
  coach.handleEvent(vm(1));
  const fx = coach.handleEvent(vc([{ surah: 1, ayah: 5, ayah_end: 6, confidence: 0.99 }]));
  assert.deepEqual(fx, []);
  assert.equal(coach.cursor, 1, "candidate must not move the cursor mid-session");
});

test("anchorFromEvent also anchors freestyle from a stable candidate", () => {
  const anchor = RecitationCoach.anchorFromEvent(
    vc([{ surah: 1, ayah: 2, confidence: 0.97 }]),
    FATIHA.map((v) => ({ surah: 1, ayah: v.ayah, text_uthmani: v.text }))
  );
  assert.equal(anchor.surah, 1);
  assert.equal(anchor.ayahStart, 2);
  assert.equal(anchor.ayahEnd, 7);
  // Unstable candidates never anchor.
  assert.equal(
    RecitationCoach.anchorFromEvent(
      vc([{ surah: 1, ayah: 2, confidence: 0.97 }], false),
      FATIHA.map((v) => ({ surah: 1, ayah: v.ayah, text_uthmani: v.text }))
    ),
    null
  );
});

// ---------------------------------------------------------------------------
// Word verdicts (transcript-alignment layer)
// ---------------------------------------------------------------------------

const wv = (verdicts, surah = 1) => ({ type: "word_verdicts", surah, verdicts });

function verdictCoach() {
  return new RecitationCoach({
    surah: 1,
    ayahStart: 1,
    ayahEnd: 7,
    verses: FATIHA,
    now: () => 1000,
    config: { useWordVerdicts: true },
  });
}

test("word_verdicts are ignored entirely when the flag is off (default)", () => {
  const coach = makeCoach(); // default config — flag off
  coach.handleEvent(vm(1));
  const fx = coach.handleEvent(
    wv([{ ayah: 1, index: 2, status: "substituted", heard: "x", expected: "y" }])
  );
  assert.deepEqual(fx, []);
  coach.requestStop();
  const s = coach.handleEvent(fin([1]))[0].summary;
  assert.deepEqual(s.substitutedWords, {});
});

test("matched verdicts add coverage and repair earlier flags", () => {
  const coach = verdictCoach();
  coach.handleEvent(vm(1));
  coach.handleEvent(wv([{ ayah: 1, index: 1, status: "missing", expected: "w" }]));
  // Re-recitation: the same word now aligns as matched → flag repaired.
  const fx = coach.handleEvent(wv([{ ayah: 1, index: 1, status: "matched", expected: "w" }]));
  assert.ok(fx.some((e) => e.type === "word-progress"));
  coach.handleEvent(wv([{ ayah: 1, index: 0, status: "matched", expected: "w" },
                        { ayah: 1, index: 2, status: "matched", expected: "w" },
                        { ayah: 1, index: 3, status: "matched", expected: "w" }]));
  coach.requestStop();
  const s = coach.handleEvent(fin([1]))[0].summary;
  assert.equal(s.missedWords[1], undefined, "repaired flag never reaches the summary");
});

test("substituted and missing flags reach the summary for committed verses", () => {
  const coach = verdictCoach();
  coach.handleEvent(vm(1));
  // Full positional progress but only words 0 and 2 explicitly matched —
  // the tracker's position can advance past words it never confirmed.
  coach.handleEvent({
    type: "word_progress", surah: 1, ayah: 1,
    word_index: 4, total_words: 4, matched_indices: [0, 2],
  });
  coach.handleEvent(
    wv([
      { ayah: 1, index: 1, status: "substituted", heard: "سمعنا", expected: "المتوقع" },
      { ayah: 1, index: 3, status: "missing", expected: "الرحيم" },
    ])
  );
  reciteVerse(coach, 2);
  coach.requestStop();
  const s = coach.handleEvent(fin([1, 2]))[0].summary;
  assert.deepEqual(s.substitutedWords[1], [
    { index: 1, heard: "سمعنا", expected: "المتوقع" },
  ]);
  assert.ok(s.missedWords[1].includes(3), "alignment-confirmed miss in summary");
});

test("a flag never contradicts an explicit earlier match", () => {
  const coach = verdictCoach();
  coach.handleEvent(vm(1));
  coach.handleEvent(wv([{ ayah: 1, index: 2, status: "matched", expected: "w" }]));
  coach.handleEvent(wv([{ ayah: 1, index: 2, status: "substituted", heard: "x", expected: "w" }]));
  coach.handleEvent(wp(1, allWords(1)));
  reciteVerse(coach, 2);
  coach.requestStop();
  const s = coach.handleEvent(fin([1, 2]))[0].summary;
  assert.deepEqual(s.substitutedWords, {});
});

// ---------------------------------------------------------------------------
// Freestyle anchoring (just-recite mode)
// ---------------------------------------------------------------------------

const QURAN_LIKE = FATIHA.map((v) => ({ surah: 1, ayah: v.ayah, text_uthmani: v.text }));

test("anchorFromEvent builds a range from the detected verse to the surah end", () => {
  const anchor = RecitationCoach.anchorFromEvent(vm(3, 0.9), QURAN_LIKE);
  assert.equal(anchor.surah, 1);
  assert.equal(anchor.ayahStart, 3);
  assert.equal(anchor.ayahEnd, 7);
  assert.deepEqual(anchor.verses.map((v) => v.ayah), [3, 4, 5, 6, 7]);
  // The anchor drives a working coach that starts on the same event.
  const coach = new RecitationCoach({ ...anchor, now: () => 0 });
  const effects = coach.handleEvent(vm(3, 0.9));
  assert.ok(types(effects).includes("started"));
  assert.equal(coach.cursor, 3);
});

test("anchorFromEvent rejects low confidence, other event types, and unknown verses", () => {
  assert.equal(RecitationCoach.anchorFromEvent(vm(1, 0.3), QURAN_LIKE), null);
  assert.equal(RecitationCoach.anchorFromEvent(wp(1, [0, 1]), QURAN_LIKE), null);
  assert.equal(RecitationCoach.anchorFromEvent(vm(1, 0.9, 2), QURAN_LIKE), null); // surah 2 not in data
  assert.equal(RecitationCoach.anchorFromEvent(null, QURAN_LIKE), null);
});

// ---------------------------------------------------------------------------
// Off-track handling
// ---------------------------------------------------------------------------

test("wandering to another passage triggers one gentle off-track hint", () => {
  const coach = makeCoach();
  coach.handleEvent(vm(1));
  assert.deepEqual(types(coach.handleEvent(vm(1, 0.9, 2))), []);
  assert.deepEqual(types(coach.handleEvent(vm(2, 0.9, 2))), []);
  const third = coach.handleEvent(vm(3, 0.9, 2));
  assert.deepEqual(types(third), ["off-track"]);
  // An in-range event resets the strikes.
  coach.handleEvent(vm(2));
  assert.equal(coach.offTrackStrikes, 0);
});

// ---------------------------------------------------------------------------
// Content-verification gate (tracking_cycle.word_matches vs acoustic/char
// fallback — see js/recitation-coach.js _onLexCheck)
// ---------------------------------------------------------------------------

test('field scenario: gibberish tracked to completion on fallback alone scores 0 and is flagged unverified', () => {
  // Reproduces build-2026-07-21 (Surah 106, Al-Quraysh): reciting the
  // English alphabet against a picked passage completed all 4 verses via
  // acoustic-position fallback alone (tracking_cycle showed word_matches:0
  // on every single cycle) and scored 100 before this gate existed.
  const coach = makeCoach({ ayahEnd: 4 });
  for (let a = 1; a <= 4; a++) {
    coach.handleEvent(lc(1, a, false));
    coach.handleEvent(lc(1, a, false));
    reciteVerse(coach, a);
  }
  coach.requestStop();
  const s = coach.handleEvent(fin([1, 2, 3, 4]))[0].summary;
  assert.equal(s.contentUnverified, true);
  assert.equal(s.score, 0);
});

test('a short verse clearing on fallback alone does not trigger the gate when the session has real lexical matches elsewhere', () => {
  // Reproduces the real (correct) Surah 87 ayah 13 case from the SAME log
  // that motivated the gate: a short verse's entire tracking span was just
  // 2 fallback-only cycles with zero word_matches — legitimate, since short
  // verses can clear before any single cycle reaches tilawa's own
  // alignPosition() bar. The gate must not punish this in isolation.
  const coach = makeCoach({ ayahEnd: 4 });
  coach.handleEvent(lc(1, 1, true));
  for (let i = 0; i < 7; i++) coach.handleEvent(lc(1, 2, false));
  for (let a = 1; a <= 4; a++) reciteVerse(coach, a);
  coach.requestStop();
  const s = coach.handleEvent(fin([1, 2, 3, 4]))[0].summary;
  assert.equal(s.contentUnverified, false);
  assert.ok(s.score > 0);
});

test('too few fallback advances to judge — content trusted by default even with zero lexical matches', () => {
  const coach = makeCoach({ ayahEnd: 2 });
  coach.handleEvent(lc(1, 1, false));
  coach.handleEvent(lc(1, 1, false));
  reciteVerse(coach, 1);
  reciteVerse(coach, 2);
  coach.requestStop();
  const s = coach.handleEvent(fin([1, 2]))[0].summary;
  assert.equal(s.contentUnverified, false);
});

test('lex_check events for a different surah are ignored', () => {
  const coach = makeCoach();
  coach.handleEvent(lc(99, 1, false));
  assert.equal(coach.fallbackAdvances, 0);
  assert.equal(coach.lexAdvances, 0);
});

test('field scenario: a single verse fabricated on fallback alone is flagged unverified even inside an otherwise well-verified session', () => {
  // Reproduces build-2026-07-21 (Surah 20 / Ta-Ha, ayahs 87-95): ayah 91
  // was never actually recited — the tracker mislabeled ayah 90's own tail
  // audio as ayah 91, then "completed" it via 3 fallback-only cycles with
  // word_matches:0 throughout, sandwiched between two verses (90 and 92)
  // that both had real lexical matches. The session-wide gate correctly
  // stayed quiet (plenty of real matches elsewhere); this per-verse gate
  // must catch the specific fabricated verse.
  const coach = makeCoach({ ayahEnd: 3 });
  coach.handleEvent(lc(1, 1, true)); // verse 1: genuinely verified
  coach.handleEvent(lc(1, 1, true));
  coach.handleEvent(lc(1, 2, false)); // verse 2: fabricated, like ayah 91
  coach.handleEvent(lc(1, 2, false));
  coach.handleEvent(lc(1, 2, false));
  coach.handleEvent(lc(1, 3, true)); // verse 3: genuinely verified
  coach.handleEvent(lc(1, 3, true));
  for (let a = 1; a <= 3; a++) reciteVerse(coach, a);
  coach.requestStop();
  const s = coach.handleEvent(fin([1, 2, 3]))[0].summary;
  assert.deepEqual(s.versesUnverified, [2]);
  assert.ok(!s.versesDone.includes(2));
  assert.equal(s.contentUnverified, false); // session-wide gate stays quiet
});

test('field scenario: a verse skipped via a single fallback-only cycle right after a normal sequential advance is caught', () => {
  // Reproduces build-2026-07-21 (Surah 21 / Al-Anbiya, ayahs 97-101): ayah
  // 99 was never recited — the transcript shows ayah 98's full content
  // flowing directly into ayah 100's, no trace of 99 — but the tracker
  // committed a normal 98→99 sequential advance (no gap, so the
  // spanEvidence/jump-hysteresis paths never even look twice) and ayah 99
  // "completed" via exactly ONE fallback cycle before minFallbackForVerse-
  // Judgment was lowered from 3 to 1 specifically because of this case.
  const coach = makeCoach({ ayahEnd: 3 });
  coach.handleEvent(lc(1, 1, true)); // verse 1: genuinely verified
  coach.handleEvent(lc(1, 1, true));
  coach.handleEvent(lc(1, 2, false)); // verse 2: fabricated on ONE cycle
  coach.handleEvent(lc(1, 3, true)); // verse 3: genuinely verified
  coach.handleEvent(lc(1, 3, true));
  for (let a = 1; a <= 3; a++) reciteVerse(coach, a);
  coach.requestStop();
  const s = coach.handleEvent(fin([1, 2, 3]))[0].summary;
  assert.deepEqual(s.versesUnverified, [2]);
  assert.ok(!s.versesDone.includes(2));
});

test('a verse with 2+ real lexical matches is never flagged, no matter how many fallback cycles it also had', () => {
  const coach = makeCoach({ ayahEnd: 3 });
  coach.handleEvent(lc(1, 2, true));
  coach.handleEvent(lc(1, 2, true)); // 2 real lexical hits clears the bar
  for (let i = 0; i < 5; i++) coach.handleEvent(lc(1, 2, false));
  for (let a = 1; a <= 3; a++) reciteVerse(coach, a);
  coach.requestStop();
  const s = coach.handleEvent(fin([1, 2, 3]))[0].summary;
  assert.deepEqual(s.versesUnverified, []);
  assert.ok(s.versesDone.includes(2));
});

test('field scenario: a single COINCIDENTAL lexical match from a mislabeled neighboring verse is still caught', () => {
  // Reproduces build-2026-07-21 (Surah 21 / Al-Anbiya, ayah 110): ayah 110
  // was never recited — the transcript shows ayah 109's tail flowing
  // directly into ayah 111's real content — but tilawa's own "live span
  // collapsed to first ayah" commit mislabeled ayah 111's audio as ayah
  // 110's tracking window, and ONE of ayah 111's words happened to
  // resemble one of ayah 110's closely enough to register as a genuine
  // (non-fallback) word_matches hit. Zero fallback cycles, exactly one
  // real lexical cycle — below minLexAdvancesForVerse (2), so still
  // flagged even though the session-wide gate and the (former) "any real
  // match is enough" per-verse bar would both have missed it.
  const coach = makeCoach({ ayahEnd: 3 });
  coach.handleEvent(lc(1, 1, true));
  coach.handleEvent(lc(1, 1, true));
  coach.handleEvent(lc(1, 2, true)); // the one coincidental match — no fallback at all
  coach.handleEvent(lc(1, 3, true));
  coach.handleEvent(lc(1, 3, true));
  for (let a = 1; a <= 3; a++) reciteVerse(coach, a);
  coach.requestStop();
  const s = coach.handleEvent(fin([1, 2, 3]))[0].summary;
  assert.deepEqual(s.versesUnverified, [2]);
  assert.ok(!s.versesDone.includes(2));
});

test('a verse rescued via spanEvidence (no tracking_cycle data at all) is unaffected by the per-verse gate', () => {
  const coach = makeCoach();
  coach.handleEvent(vm(1));
  coach.handleEvent(wp(1, allWords(1)));
  coach.handleEvent(vm(2));
  coach.handleEvent(vc([{ surah: 1, ayah: 2, ayah_end: 4, confidence: 0.93 }])); // stable by default
  coach.handleEvent(vm(5));
  coach.handleEvent(wp(5, allWords(5)));
  assert.equal(coach.perVerse[3].status, 'done');
  assert.equal(coach.perVerse[4].status, 'done');
});

test('an unverified verse effect flags the UI and reports no missed-word claim', () => {
  const coach = makeCoach({ ayahEnd: 2 });
  coach.handleEvent(vm(1));
  coach.handleEvent(wp(1, allWords(1)));
  coach.handleEvent(lc(1, 1, false));
  coach.handleEvent(lc(1, 1, false));
  coach.handleEvent(lc(1, 1, false));
  const fx = coach.handleEvent(vm(2));
  const committed = fx.find((e) => e.type === 'verse-committed');
  assert.equal(committed.unverified, true);
  assert.deepEqual(committed.missedWords, []);
  assert.equal(coach.perVerse[1].status, 'unverified');
});
