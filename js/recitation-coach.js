/**
 * RecitationCoach — pure state machine for the Recitation (تلاوة) feature.
 *
 * Consumes raw tilawa streaming events (verse_match / word_progress /
 * final_sequence) and produces coaching verdicts: session start & end,
 * missed words, skipped verses, and repetition tolerance. No DOM, no
 * timers, no globals — fully unit-testable (tilawa-build/test/).
 *
 * Design rules (see tilawa-build/README.md for the word-index contract):
 *  - The user picks the passage first, so the expected verse sequence is
 *    known. That range is the strongest disambiguator for identical
 *    phrases (e.g. الرَّحْمَٰنِ الرَّحِيمِ in Al-Fatiha 1:1 vs 1:3): events
 *    are interpreted relative to the expected cursor, and a forward jump
 *    needs a second consistent event (hysteresis) before it counts as a
 *    skip.
 *  - Repetition is NEVER an error: re-matching the current verse, going
 *    back to an earlier verse, or re-reciting words only ever adds
 *    coverage (matched-index sets are unioned over time).
 *  - Pauses are invisible here. Tilawa absorbs short silences; if a long
 *    contemplation pause makes the tracker emit final_sequence, the coach
 *    treats it as a CHECKPOINT and keeps the session open — only a manual
 *    stop, finalize(), or completing the last verse ends a session.
 *
 * handleEvent(event) returns a list of effect objects for the UI:
 *   {type:'started', ayah}
 *   {type:'verse-active', ayah}
 *   {type:'word-progress', ayah, matched:[i...], totalWords}
 *   {type:'verse-committed', ayah, missedWords:[i...]}
 *   {type:'verses-skipped', ayahs:[...]}   (provisional until finalize)
 *   {type:'repetition', ayah, count}
 *   {type:'off-track'}
 *   {type:'checkpoint'}
 *   {type:'completed', summary}
 */

(function (globalScope) {
  'use strict';

  /**
   * Split verse display text (text_uthmani) into tokens. Tokens with no
   * Arabic letters (standalone waqf/annotation marks such as ۖ ۛ ۩) are
   * rendered but excluded from word indexing — the remaining letter-bearing
   * tokens align 1:1 with tilawa's phoneme_words for all 6,236 verses
   * (verified against Mohamed-AH/tilawa commit ec5cdc7).
   */
  function splitDisplayTokens(text) {
    const rawTokens = String(text || '')
      .replace(/﻿/g, '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const hasLetters = /[ء-يٱ-ەۮ-ۿ]/;
    let wordIndex = 0;
    return rawTokens.map(function (t) {
      if (hasLetters.test(t)) {
        return { text: t, isWord: true, wordIndex: wordIndex++ };
      }
      return { text: t, isWord: false, wordIndex: -1 };
    });
  }

  function countWords(text) {
    return splitDisplayTokens(text).filter(function (t) {
      return t.isWord;
    }).length;
  }

  const DEFAULTS = {
    startConfidence: 0.55, // min verse_match confidence to open the session
    doneCoverage: 0.6, // word coverage for the active verse to count as done at finalize
    reconcileCoverage: 0.8, // coverage that counts a verse done even without a commit
    offTrackLimit: 3, // consecutive out-of-range events before the off-track hint
    scoreWeights: { verses: 60, words: 30, confidence: 10 },
  };

  class RecitationCoach {
    /**
     * @param {Object} opts
     * @param {number} opts.surah
     * @param {number} opts.ayahStart
     * @param {number} opts.ayahEnd
     * @param {Array<{ayah:number, text:string}>} opts.verses — display text
     *   (text_uthmani) for every ayah in [ayahStart, ayahEnd], in order.
     * @param {Object} [opts.config] — overrides for DEFAULTS.
     * @param {Function} [opts.now] — clock, injectable for tests.
     */
    constructor(opts) {
      this.surah = opts.surah;
      this.ayahStart = opts.ayahStart;
      this.ayahEnd = opts.ayahEnd;
      this.cfg = Object.assign({}, DEFAULTS, opts.config || {});
      this.now = opts.now || Date.now;

      this.state = 'awaiting_start';
      this.cursor = null; // ayah currently being recited
      this.startedAt = null;
      this.endedAt = null;
      this.stopRequested = false;
      this.offTrackStrikes = 0;
      this.pendingJump = null; // {ayah} — forward-jump hysteresis
      this.pendingBack = null; // {ayah} — backward-repetition hysteresis
      this.confidences = [];

      this.perVerse = {};
      for (const v of opts.verses) {
        this.perVerse[v.ayah] = {
          ayah: v.ayah,
          text: v.text,
          totalWords: countWords(v.text),
          // Tilawa's word_progress carries `word_index` (the alignment
          // position — first unmatched word, a high-water mark) and
          // `matched_indices` (INCREMENTAL matches for the cycle, often a
          // single index). Coverage is therefore progress-based; the
          // matched set only adds stragglers beyond the high-water mark.
          progress: 0,
          matched: new Set(),
          repeats: 0,
          sawCommit: false,
          status: 'pending', // pending | active | done | skipped
        };
      }
    }

    inRange(surah, ayah) {
      return (
        surah === this.surah && ayah >= this.ayahStart && ayah <= this.ayahEnd
      );
    }

    /** Words considered recited: everything below the alignment high-water
     *  mark, plus explicit matches beyond it. */
    coveredCount(ayah) {
      const v = this.perVerse[ayah];
      if (!v) return 0;
      let covered = Math.min(v.progress, v.totalWords);
      for (const i of v.matched) {
        if (i >= v.progress && i < v.totalWords) covered++;
      }
      return covered;
    }

    /** Indices treated as recited (for live highlighting). */
    coveredIndices(ayah) {
      const v = this.perVerse[ayah];
      const out = [];
      for (let i = 0; i < v.totalWords; i++) {
        if (i < v.progress || v.matched.has(i)) out.push(i);
      }
      return out;
    }

    coverage(ayah) {
      const v = this.perVerse[ayah];
      if (!v || v.totalWords === 0) return 0;
      return this.coveredCount(ayah) / v.totalWords;
    }

    /**
     * Only positive evidence counts as a miss: words beyond the alignment
     * high-water mark were provably never reached. Gaps below it are NOT
     * reported — tilawa's incremental match reports are too sparse to
     * accuse the reciter of skipping individual mid-verse words.
     */
    missedWordIndices(ayah) {
      const v = this.perVerse[ayah];
      const missed = [];
      for (let i = v.progress; i < v.totalWords; i++) {
        if (!v.matched.has(i)) missed.push(i);
      }
      return missed;
    }

    /** Main entry point: one tilawa event in, a list of UI effects out. */
    handleEvent(event) {
      if (!event || this.state === 'completed' || this.state === 'stopped') {
        return [];
      }
      switch (event.type) {
        case 'verse_match':
          return this._onVerseMatch(event);
        case 'word_progress':
          return this._onWordProgress(event);
        case 'final_sequence':
          return this._onFinalSequence(event);
        default:
          return [];
      }
    }

    _onVerseMatch(msg) {
      const effects = [];
      const A = msg.ayah;

      if (typeof msg.confidence === 'number') {
        this.confidences.push(msg.confidence);
      }

      if (!this.inRange(msg.surah, A)) {
        if (this.state !== 'awaiting_start') {
          this.offTrackStrikes++;
          if (this.offTrackStrikes === this.cfg.offTrackLimit) {
            effects.push({ type: 'off-track' });
          }
        }
        return effects; // pre-roll noise / different passage — never an error
      }
      this.offTrackStrikes = 0;

      if (this.state === 'awaiting_start') {
        if ((msg.confidence || 0) < this.cfg.startConfidence) return effects;
        return this._start(A);
      }

      const cur = this.perVerse[this.cursor];
      const target = this.perVerse[A];

      if (A === this.cursor) {
        // First verse_match for the cursor verse is its commit signal.
        // The tracker re-emits verse_match for the same verse during
        // confirm/flush cycles, so duplicates are silently absorbed
        // (repeating the current verse aloud is a no-op anyway — the
        // alignment high-water mark never decreases).
        cur.sawCommit = true;
        this.pendingJump = null;
        this.pendingBack = null;
        return effects;
      }

      if (A < this.cursor) {
        // Going back to an earlier verse = contemplation/re-recitation —
        // never an error. The final flush can re-emit a stale verse_match
        // for an earlier verse, so require a second consistent event
        // (hysteresis, like forward jumps) before counting a repetition.
        this.pendingJump = null;
        if (this.stopRequested) return effects; // flush artifacts
        if (this.pendingBack && this.pendingBack.ayah === A) {
          this.pendingBack = null;
          target.repeats++;
          target.sawCommit = true;
          effects.push({ type: 'repetition', ayah: A, count: target.repeats });
        } else {
          this.pendingBack = { ayah: A };
        }
        return effects;
      }

      if (A === this.cursor + 1) {
        this.pendingJump = null;
        this.pendingBack = null;
        effects.push(...this._commitAndAdvance(A));
        return effects;
      }

      // Forward jump beyond the next verse: require a second consistent
      // event before treating it as a skip, so an identical phrase shared
      // with a later verse can't cause a phantom jump on one noisy match.
      if (this.pendingJump && this.pendingJump.ayah === A) {
        this.pendingJump = null;
        effects.push(...this._commitAndAdvance(A));
      } else {
        this.pendingJump = { ayah: A };
      }
      return effects;
    }

    _onWordProgress(msg) {
      const effects = [];
      if (!this.inRange(msg.surah, msg.ayah)) return effects;

      if (this.state === 'awaiting_start') {
        // Defensive: solid word progress counts as a start even if the
        // verse_match commit was missed or under-confident.
        if ((msg.matched_indices || []).length >= 2) {
          effects.push(...this._start(msg.ayah));
        } else {
          return effects;
        }
      }

      const A = msg.ayah;
      const v = this.perVerse[A];

      // Hysteresis confirmations: word progress on a pending jump/backward
      // target is the "second consistent event" that makes it real.
      if (this.pendingJump && this.pendingJump.ayah === A) {
        this.pendingJump = null;
        effects.push(...this._commitAndAdvance(A));
      } else if (this.pendingBack && this.pendingBack.ayah === A && !this.stopRequested) {
        this.pendingBack = null;
        v.repeats++;
        v.sawCommit = true;
        effects.push({ type: 'repetition', ayah: A, count: v.repeats });
      }

      if (A === this.cursor || v.status === 'done' || v.repeats > 0) {
        // Progress only ever grows (word-level repetition tolerance), and
        // re-reciting an earlier verse may even clear previously-missed
        // tail words — generous by design.
        const beforeCovered = this.coveredCount(A);
        if (typeof msg.word_index === 'number' && msg.word_index > v.progress) {
          v.progress = Math.min(msg.word_index, v.totalWords);
        }
        for (const i of msg.matched_indices || []) {
          if (i >= 0 && i < v.totalWords) v.matched.add(i);
        }
        if (this.coveredCount(A) !== beforeCovered || A === this.cursor) {
          effects.push({
            type: 'word-progress',
            ayah: A,
            matched: this.coveredIndices(A),
            totalWords: v.totalWords,
          });
        }
        this.offTrackStrikes = 0;
      }
      return effects;
    }

    _onFinalSequence(msg) {
      // Mark everything tilawa committed in its final path.
      for (const fv of msg.verses || []) {
        if (this.inRange(fv.surah, fv.ayah)) {
          const v = this.perVerse[fv.ayah];
          v.sawCommit = true;
          if (typeof fv.confidence === 'number') {
            this.confidences.push(fv.confidence);
          }
        }
      }

      const finishedLastVerse =
        this.cursor === this.ayahEnd &&
        (this.perVerse[this.ayahEnd].sawCommit ||
          this.coverage(this.ayahEnd) >= this.cfg.doneCoverage);

      if (this.stopRequested || finishedLastVerse) {
        return [this._finalize()];
      }

      // A long contemplation pause flushed the tracker mid-session. Keep the
      // session open — tilawa re-discovers when the user resumes reciting.
      return [{ type: 'checkpoint' }];
    }

    _start(ayah) {
      const effects = [];
      this.state = 'tracking';
      this.startedAt = this.now();
      this.cursor = ayah;
      const v = this.perVerse[ayah];
      v.status = 'active';
      v.sawCommit = true;
      if (ayah > this.ayahStart) {
        // Provisional: reconciled at finalize (the reciter may genuinely
        // have meant to start mid-range).
        const skipped = [];
        for (let a = this.ayahStart; a < ayah; a++) {
          this.perVerse[a].status = 'skipped';
          skipped.push(a);
        }
        effects.push({ type: 'verses-skipped', ayahs: skipped });
      }
      effects.push({ type: 'started', ayah: ayah });
      effects.push({ type: 'verse-active', ayah: ayah });
      return effects;
    }

    _commitAndAdvance(toAyah) {
      const effects = [];
      const cur = this.perVerse[this.cursor];
      cur.status = 'done';
      effects.push({
        type: 'verse-committed',
        ayah: cur.ayah,
        missedWords: this.missedWordIndices(cur.ayah),
      });

      if (toAyah > this.cursor + 1) {
        const skipped = [];
        for (let a = this.cursor + 1; a < toAyah; a++) {
          if (this.perVerse[a].status === 'pending') {
            this.perVerse[a].status = 'skipped';
            skipped.push(a);
          }
        }
        if (skipped.length) {
          effects.push({ type: 'verses-skipped', ayahs: skipped });
        }
      }

      this.cursor = toAyah;
      const next = this.perVerse[toAyah];
      next.status = 'active';
      next.sawCommit = true;
      effects.push({ type: 'verse-active', ayah: toAyah });
      return effects;
    }

    /** UI calls this when the user taps Stop (before the worker flush). */
    requestStop() {
      this.stopRequested = true;
    }

    /**
     * Idempotent session end: reconcile statuses and build the summary.
     * Called via final_sequence (stop-flush or last verse finished) or
     * directly by the UI as a fallback.
     */
    finalize() {
      if (this.state === 'completed' || this.state === 'stopped') {
        return this._lastSummaryEffect;
      }
      return this._finalize();
    }

    _finalize() {
      this.endedAt = this.now();
      const started = this.state === 'tracking';
      this.state = this.stopRequested && !started ? 'stopped' : 'completed';

      // Reconciliation: a verse is done if it was committed or has enough
      // coverage; skipped only if a LATER verse was recited; otherwise it
      // was simply never reached (not the reciter's mistake if they stopped
      // early on purpose — reported separately).
      let lastRecited = null;
      for (let a = this.ayahStart; a <= this.ayahEnd; a++) {
        const v = this.perVerse[a];
        const recited =
          (v.sawCommit && v.status !== 'pending') ||
          this.coverage(a) >= this.cfg.reconcileCoverage;
        if (recited) {
          v.status = 'done';
          lastRecited = a;
        }
      }
      // Active verse with partial coverage still counts when good enough.
      if (
        this.cursor !== null &&
        this.perVerse[this.cursor].status !== 'done' &&
        this.coverage(this.cursor) >= this.cfg.doneCoverage
      ) {
        this.perVerse[this.cursor].status = 'done';
        if (lastRecited === null || this.cursor > lastRecited) {
          lastRecited = this.cursor;
        }
      }
      for (let a = this.ayahStart; a <= this.ayahEnd; a++) {
        const v = this.perVerse[a];
        if (v.status !== 'done') {
          v.status = lastRecited !== null && a < lastRecited ? 'skipped' : 'pending';
        }
      }

      const summary = this._buildSummary();
      const effect = { type: 'completed', summary: summary };
      this._lastSummaryEffect = effect;
      return effect;
    }

    _buildSummary() {
      const done = [];
      const skipped = [];
      const notReached = [];
      const missedWords = {};
      const repeats = {};
      let matchedTotal = 0;
      let wordTotal = 0;

      for (let a = this.ayahStart; a <= this.ayahEnd; a++) {
        const v = this.perVerse[a];
        if (v.status === 'done') {
          done.push(a);
          const missed = this.missedWordIndices(a);
          if (missed.length) missedWords[a] = missed;
          matchedTotal += this.coveredCount(a);
          wordTotal += v.totalWords;
        } else if (v.status === 'skipped') {
          skipped.push(a);
          wordTotal += v.totalWords;
        } else {
          notReached.push(a);
        }
        if (v.repeats > 0) repeats[a] = v.repeats;
      }

      const expectedCount = done.length + skipped.length;
      const verseRatio = expectedCount ? done.length / expectedCount : 0;
      const wordRatio = wordTotal ? matchedTotal / wordTotal : 0;
      const avgConfidence = this.confidences.length
        ? this.confidences.reduce(function (s, c) {
            return s + c;
          }, 0) / this.confidences.length
        : 0;

      const w = this.cfg.scoreWeights;
      const started = this.startedAt !== null;
      const score = started
        ? Math.max(
            0,
            Math.min(
              100,
              Math.round(
                w.verses * verseRatio +
                  w.words * wordRatio +
                  w.confidence * Math.min(1, avgConfidence)
              )
            )
          )
        : 0;

      return {
        surah: this.surah,
        ayahStart: this.ayahStart,
        ayahEnd: this.ayahEnd,
        started: started,
        versesDone: done,
        versesSkipped: skipped,
        versesNotReached: notReached,
        missedWords: missedWords,
        repeats: repeats,
        wordCoverage: Math.round(wordRatio * 100) / 100,
        avgConfidence: Math.round(avgConfidence * 100) / 100,
        score: score,
        durationSec:
          started && this.endedAt
            ? Math.round((this.endedAt - this.startedAt) / 1000)
            : 0,
      };
    }
  }

  RecitationCoach.splitDisplayTokens = splitDisplayTokens;
  RecitationCoach.countWords = countWords;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RecitationCoach;
  } else {
    globalScope.RecitationCoach = RecitationCoach;
  }
})(typeof self !== 'undefined' ? self : this);
