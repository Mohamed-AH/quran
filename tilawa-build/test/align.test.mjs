/**
 * Unit tests for the transcript-alignment word-verdict engine
 * (tilawa-build/src/align.js). Run with: npm test
 */
import test from "node:test";
import assert from "node:assert/strict";
import { alignTranscript, similarity } from "../src/align.js";

// Expected window helper: flat words with ayah/index.
const win = (...verses) => {
  const out = [];
  verses.forEach(([ayah, words]) =>
    words.forEach((w, i) => out.push({ word: w, ayah, index: i }))
  );
  return out;
};

const FATIHA_1 = ["بسم", "الله", "الرحمن", "الرحيم"];
const FATIHA_2 = ["الحمد", "لله", "رب", "العلمين"];

const byStatus = (verdicts, status) => verdicts.filter((v) => v.status === status);

test("similarity: identical=1, disjoint≈0, near-words high", () => {
  assert.equal(similarity("الرحمن", "الرحمن"), 1);
  assert.ok(similarity("الرحمن", "الرحيم") < 0.75);
  assert.ok(similarity("العلمين", "العالمين") > 0.75); // decode variance
  assert.equal(similarity("", "الله"), 0);
});

test("clean fragment: every word matched, nothing accused", () => {
  const verdicts = alignTranscript(FATIHA_1, win([1, FATIHA_1], [2, FATIHA_2]));
  assert.equal(byStatus(verdicts, "matched").length, 4);
  assert.equal(byStatus(verdicts, "missing").length, 0);
  assert.equal(byStatus(verdicts, "substituted").length, 0);
  assert.deepEqual(verdicts.map((v) => v.ayah), [1, 1, 1, 1]);
});

test("fragment covering the middle gives no verdicts outside its span", () => {
  // Only words 1-2 of verse 1 recited so far.
  const verdicts = alignTranscript(["الله", "الرحمن"], win([1, FATIHA_1]));
  const indices = verdicts.map((v) => v.index);
  assert.ok(!indices.includes(0), "word before the span is not judged");
  assert.ok(!indices.includes(3), "word after the span is not judged");
});

test("a word missing inside the covered span is flagged", () => {
  // Reciter skipped الرحمن: heard bsm, allah, alrahim.
  const verdicts = alignTranscript(
    ["بسم", "الله", "الرحيم"],
    win([1, FATIHA_1])
  );
  const missing = byStatus(verdicts, "missing");
  assert.equal(missing.length, 1);
  assert.equal(missing[0].index, 2);
  assert.equal(missing[0].expected, "الرحمن");
});

test("a substituted word inside the span is flagged with what was heard", () => {
  const verdicts = alignTranscript(
    ["بسم", "الله", "القوي", "الرحيم"], // القوي instead of الرحمن
    win([1, FATIHA_1])
  );
  const subs = byStatus(verdicts, "substituted");
  assert.equal(subs.length, 1);
  assert.equal(subs[0].index, 2);
  assert.equal(subs[0].heard, "القوي");
});

test("repeated words (stutter/emphasis) are never penalized", () => {
  const verdicts = alignTranscript(
    ["بسم", "بسم", "الله", "الله", "الله", "الرحمن", "الرحيم"],
    win([1, FATIHA_1])
  );
  assert.equal(byStatus(verdicts, "missing").length, 0);
  assert.equal(byStatus(verdicts, "substituted").length, 0);
  assert.equal(byStatus(verdicts, "matched").length, 4);
});

test("noisy fragment with fewer than 2 anchors emits nothing", () => {
  assert.deepEqual(alignTranscript(["شيء", "اخر"], win([1, FATIHA_1])), []);
  assert.deepEqual(alignTranscript([], win([1, FATIHA_1])), []);
  assert.deepEqual(alignTranscript(FATIHA_1, []), []);
});

test("fragment spanning a verse boundary judges words in both verses", () => {
  const verdicts = alignTranscript(
    ["الرحمن", "الرحيم", "الحمد", "لله"],
    win([1, FATIHA_1], [2, FATIHA_2])
  );
  const ayahs = new Set(verdicts.map((v) => v.ayah));
  assert.ok(ayahs.has(1) && ayahs.has(2));
  assert.equal(byStatus(verdicts, "missing").length, 0);
});
