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

test("a done verse with PARTIAL coverage still reports its unreached tail", () => {
  const coach = makeCoach();
  coach.handleEvent(vm(1));
  coach.handleEvent(wp(1, [0, 1])); // some real data: words 0-1 confirmed, 2-3 never reached
  coach.handleEvent(vm(2));
  assert.deepEqual(coach.missedWordIndices(1), [2, 3]);
});

test("missed words are counted only when the verse is committed past", () => {
  const coach = makeCoach();
  coach.handleEvent(vm(1));
  coach.handleEvent(wp(1, [0, 1, 2])); // word 3 of 1:1 never matched
  const effects = coach.handleEvent(vm(2)); // advancing commits verse 1
  const committed = effects.find((e) => e.type === "verse-committed");
  assert.deepEqual(committed.missedWords, [3]);
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
