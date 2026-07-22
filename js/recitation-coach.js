/**
 * RecitationCoach — pure state machine for the Recitation (تلاوة) feature.
 *
 * Architecture (see CLAUDE.md "record, then evaluate once" — this REPLACES
 * an earlier live per-ayah "capture, then evaluate" design): every attempt
 * at judging ayahs live, one at a time, while the reciter is still going —
 * a moving cursor, an advance-candidate scan, a stability window — kept
 * producing the same class of bug in different shapes: a cursor that gets
 * stuck on a hard/noisy verse silently blinds the coach to everything
 * recited afterward, no matter how correct, because the alignment window
 * and the "have we moved on" decision were both tied to that live cursor.
 *
 * The fix is to stop deciding anything live. tilawa's `transcribe`
 * diagnostic (forwarded continuously as `decoded_text`/`word_verdicts` —
 * see worker-entry.js) keeps flowing throughout the session regardless;
 * this coach just ACCUMULATES alignment evidence for every ayah in the
 * picked passage as it arrives, with no cursor and no per-ayah timing
 * decision. The reciter drives start/stop manually — there is no
 * auto-detected "session complete" anymore. Only when the session actually
 * ends (a manual stop, or the UI's fallback) does `finalize()` walk the
 * whole picked passage ONCE and decide, per ayah, using whatever evidence
 * ended up accumulated: done / skipped / uncertain. This is what the
 * "wait for the whole recitation, then evaluate" ask amounts to in
 * practice — decoding never pauses, only the JUDGMENT is deferred to the
 * end, because tilawa's own decode is a sliding window and can't hold
 * an entire multi-minute session's audio to transcribe in one shot.
 *
 * Three-tier per-ayah verdict (unchanged from the live design, still the
 * right idea — only the WHEN changed, not the WHAT):
 *   done       — high word coverage (missedWords/substitutedWords may
 *                still be attached — specific, confident mistakes).
 *   skipped    — near-zero coverage, with a LATER ayah confidently
 *                covered — the app's central purpose: catching a verse
 *                the reciter never said.
 *   uncertain  — coverage lands in the murky middle. No verdict is
 *                forced; the raw heard text is kept alongside the
 *                expected text so the reciter can judge for themself.
 *
 * handleEvent(event) returns a list of effect objects for the UI:
 *   {type:'started'}                                       first real evidence seen
 *   {type:'word-progress', ayah, matched, totalWords}       live accumulation
 *   {type:'checkpoint'}                                     tracker paused mid-session
 *   {type:'completed', summary}                             finalize() result
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

  // Mirrors tilawa's own QuranDB._startsWithArabicBismillah exactly (same 4
  // words, same surah 1/9 exclusions): ayah 1 of every surah except
  // Al-Fatiha (1, where the Basmala IS the verse) and At-Tawbah (9, which
  // has none) embeds the Basmala as the verse's own first 4 words in this
  // text source. Reciters accept several equally valid openings — isti'adhah
  // + Basmala, Basmala only, isti'adhah only, or straight into the surah —
  // so these 4 words must never be treated as required.
  const BSM_WORDS = ['بسم', 'الله', 'الرحمن', 'الرحيم'];

  // text_uthmani carries full diacritics and the alef-wasla variant (ٱ,
  // U+0671) — strip both so the comparison matches BSM_WORDS' bare forms.
  function normalizeArabicWord(text) {
    return String(text || '')
      .replace(/[ً-ٰٟـ]/g, '') // harakat/tanwin/shadda/sukun + tatweel
      .replace(/[آأإٱ]/g, 'ا'); // آأإٱ → ا
  }

  function basmalaPrefixLength(surah, ayah, words) {
    if (surah === 1 || surah === 9 || ayah !== 1) return 0;
    if (words.length <= BSM_WORDS.length) return 0;
    for (let i = 0; i < BSM_WORDS.length; i++) {
      if (normalizeArabicWord(words[i]) !== BSM_WORDS[i]) return 0;
    }
    return BSM_WORDS.length;
  }

  const DEFAULTS = {
    // Total real matched/fuzzy words accumulated ANYWHERE in the picked
    // passage before the session counts as genuinely "started" (drives the
    // one-time 'started' effect and summary.started — no longer a per-ayah
    // decision, since there's no cursor to place).
    startMinWords: 3,
    // Three-tier verdict thresholds (fraction of the ayah's scored words
    // that ended up matched/fuzzy), scaled by ayah length: a single
    // misdecode swings a short ayah's ratio far more than a long one's, so
    // short ayahs need a near-exact match to count as "done" instead of
    // "uncertain".
    shortAyahMaxWords: 3,
    shortAyahDoneRatio: 0.9,
    doneRatio: 0.75,
    skipRatio: 0.15,
    scoreWeights: { verses: 60, words: 40 },
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

      this.state = 'awaiting_start'; // awaiting_start -> tracking -> completed | stopped
      this.startedAt = null;
      this.endedAt = null;
      this.stopRequested = false;

      this.perVerse = {};
      for (const v of opts.verses) {
        const wordList = splitDisplayTokens(v.text)
          .filter(function (t) {
            return t.isWord;
          })
          .map(function (t) {
            return t.text;
          });
        this.perVerse[v.ayah] = {
          ayah: v.ayah,
          text: v.text,
          totalWords: wordList.length,
          // Leading word indices [0, optionalCount) that are never accused
          // of being missed — see basmalaPrefixLength above.
          optionalCount: basmalaPrefixLength(this.surah, v.ayah, wordList),
          matched: new Set(),
          // Word-level flags from alignment: index -> {status:
          // 'missing'|'substituted', heard?, expected}. A later matched/
          // fuzzy verdict for the same index REPAIRS (deletes) the flag —
          // re-recitation always clears an accusation.
          wordFlags: {},
          // Raw decoded text last seen touching this ayah — carried into
          // the 'unverified' tier so the reciter can compare what was
          // heard against what was expected themselves.
          lastHeardText: '',
          status: 'pending', // decided once, at finalize(): done | skipped | unverified | pending
        };
      }
    }

    inRange(surah, ayah) {
      return (
        surah === this.surah && ayah >= this.ayahStart && ayah <= this.ayahEnd
      );
    }

    coveredCount(ayah) {
      const v = this.perVerse[ayah];
      return v ? v.matched.size : 0;
    }

    coveredIndices(ayah) {
      const v = this.perVerse[ayah];
      if (!v) return [];
      return Array.from(v.matched).sort(function (a, b) {
        return a - b;
      });
    }

    coverage(ayah) {
      const v = this.perVerse[ayah];
      if (!v || v.totalWords === 0) return 0;
      return this.coveredCount(ayah) / v.totalWords;
    }

    /**
     * Word count used as the SCORING denominator for a verse: the optional
     * Basmala prefix only counts if it was actually recited (matched) —
     * omitting it validly must not drag down word-coverage percentage, but
     * saying it still earns credit like any other word.
     */
    _scoredWordTotal(ayah) {
      const v = this.perVerse[ayah];
      let unmatchedOptional = 0;
      for (let i = 0; i < v.optionalCount; i++) {
        if (!v.matched.has(i)) unmatchedOptional++;
      }
      return v.totalWords - unmatchedOptional;
    }

    missedWordIndices(ayah) {
      const v = this.perVerse[ayah];
      const out = [];
      for (const idx of Object.keys(v.wordFlags)) {
        if (v.wordFlags[idx].status === 'missing') out.push(Number(idx));
      }
      return out.sort(function (a, b) {
        return a - b;
      });
    }

    substitutedWords(ayah) {
      const v = this.perVerse[ayah];
      const out = [];
      for (const idx of Object.keys(v.wordFlags)) {
        const flag = v.wordFlags[idx];
        if (flag.status === 'substituted') {
          out.push({ index: Number(idx), heard: flag.heard, expected: flag.expected });
        }
      }
      return out.sort(function (a, b) {
        return a.index - b.index;
      });
    }

    /**
     * The three-tier verdict for one ayah, using whatever alignment
     * evidence ended up accumulated for it by the time finalize() runs.
     * Pure function — no side effects, safe to call speculatively.
     */
    _evaluateVerse(ayah) {
      const v = this.perVerse[ayah];
      const scoredTotal = this._scoredWordTotal(ayah);
      const ratio = scoredTotal > 0 ? this.coveredCount(ayah) / scoredTotal : 0;
      if (this.coveredCount(ayah) === 0) return 'skipped';
      const isShort = v.totalWords <= this.cfg.shortAyahMaxWords;
      const doneBar = isShort ? this.cfg.shortAyahDoneRatio : this.cfg.doneRatio;
      if (ratio >= doneBar) return 'done';
      if (ratio <= this.cfg.skipRatio) return 'skipped';
      return 'unverified';
    }

    /** Main entry point: one worker event in, a list of UI effects out. */
    handleEvent(event) {
      if (!event || this.state === 'completed' || this.state === 'stopped') {
        return [];
      }
      switch (event.type) {
        case 'word_verdicts':
          return this._onWordVerdicts(event);
        case 'final_sequence':
          return this._onFinalSequence(event);
        default:
          // verse_match / word_progress / verse_candidate / lex_check /
          // tracking_abandoned: tilawa's own tracker diagnostics, kept
          // flowing from the worker for its audio-capture engineering, but
          // no longer trusted for verse identity or scoring here — see the
          // class doc comment.
          return [];
      }
    }

    _onWordVerdicts(msg) {
      const effects = [];
      if (msg.surah !== this.surah) return effects;

      const verdicts = (msg.verdicts || []).filter(
        (vd) =>
          this.perVerse[vd.ayah] &&
          vd.index >= 0 &&
          vd.index < this.perVerse[vd.ayah].totalWords
      );
      if (verdicts.length === 0) return effects;

      const touched = new Set();
      for (const verdict of verdicts) {
        const v = this.perVerse[verdict.ayah];
        if (verdict.status === 'matched' || verdict.status === 'fuzzy') {
          const grew = !v.matched.has(verdict.index);
          v.matched.add(verdict.index);
          if (v.wordFlags[verdict.index]) delete v.wordFlags[verdict.index]; // repair
          if (grew) touched.add(verdict.ayah);
        } else if (verdict.status === 'missing' || verdict.status === 'substituted') {
          if (!v.matched.has(verdict.index)) {
            v.wordFlags[verdict.index] = {
              status: verdict.status,
              heard: verdict.heard,
              expected: verdict.expected,
            };
            touched.add(verdict.ayah);
          }
        }
      }
      if (msg.text) {
        for (const ayah of touched) this.perVerse[ayah].lastHeardText = msg.text;
      }

      if (this.state === 'awaiting_start') {
        let totalMatched = 0;
        for (const ayah in this.perVerse) totalMatched += this.perVerse[ayah].matched.size;
        if (totalMatched >= this.cfg.startMinWords) {
          this.state = 'tracking';
          this.startedAt = this.now();
          effects.push({ type: 'started' });
        }
      }

      for (const ayah of touched) {
        effects.push({
          type: 'word-progress',
          ayah: ayah,
          matched: this.coveredIndices(ayah),
          totalWords: this.perVerse[ayah].totalWords,
        });
      }
      return effects;
    }

    _onFinalSequence() {
      // tilawa's tracker flushed (silence-triggered) — no longer trusted
      // for verse identity, but still the signal that audio capture just
      // paused or the session is ending. There is no auto-stop anymore:
      // the reciter drives start/stop manually, so a flush only finalizes
      // when the UI has already requested a stop; otherwise it's just a
      // mid-session pause.
      if (this.stopRequested) {
        return [this._finalize()];
      }
      return [{ type: 'checkpoint' }];
    }

    /** UI calls this when the user taps Stop (before the worker flush). */
    requestStop() {
      this.stopRequested = true;
    }

    /**
     * Idempotent session end: evaluate every ayah in the picked passage
     * ONCE, using whatever evidence accumulated over the whole session,
     * and build the summary. Called via final_sequence (stop-flush) or
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

      // A verse counts as genuinely reached if it's done or ambiguous
      // (some real evidence exists); it's a real skip only if a LATER
      // verse was also reached — otherwise the reciter simply never got
      // that far, which isn't a mistake and is reported separately.
      let lastRecited = null;
      for (let a = this.ayahStart; a <= this.ayahEnd; a++) {
        const verdict = this._evaluateVerse(a);
        if (verdict !== 'skipped') {
          this.perVerse[a].status = verdict;
          lastRecited = a;
        }
      }
      for (let a = this.ayahStart; a <= this.ayahEnd; a++) {
        const v = this.perVerse[a];
        if (v.status !== 'done' && v.status !== 'unverified') {
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
      const uncertain = [];
      const missedWords = {};
      const substitutedWords = {};
      const uncertainDetail = {};
      let matchedTotal = 0;
      let wordTotal = 0;

      for (let a = this.ayahStart; a <= this.ayahEnd; a++) {
        const v = this.perVerse[a];
        if (v.status === 'done') {
          done.push(a);
          const missed = this.missedWordIndices(a);
          const subs = this.substitutedWords(a);
          if (missed.length) missedWords[a] = missed;
          if (subs.length) substitutedWords[a] = subs;
          matchedTotal += this.coveredCount(a);
          wordTotal += this._scoredWordTotal(a);
        } else if (v.status === 'unverified') {
          // Ambiguous evidence — never silently called done or wrong.
          // Surface exactly what was heard next to what was expected and
          // let the reciter judge; counted against neither the verse ratio
          // nor the word ratio.
          uncertain.push(a);
          uncertainDetail[a] = { heard: v.lastHeardText || '', expected: v.text };
        } else if (v.status === 'skipped') {
          skipped.push(a);
          wordTotal += v.totalWords;
        } else {
          notReached.push(a);
        }
      }

      const expectedCount = done.length + skipped.length;
      const verseRatio = expectedCount ? done.length / expectedCount : 0;
      const wordRatio = wordTotal ? matchedTotal / wordTotal : 0;

      const w = this.cfg.scoreWeights;
      const started = this.startedAt !== null;
      const score = started
        ? Math.max(
            0,
            Math.min(100, Math.round(w.verses * verseRatio + w.words * wordRatio))
          )
        : 0;

      return {
        surah: this.surah,
        ayahStart: this.ayahStart,
        ayahEnd: this.ayahEnd,
        started: started,
        versesDone: done,
        versesSkipped: skipped,
        versesUnverified: uncertain, // "uncertain / needs your review" tier
        versesNotReached: notReached,
        missedWords: missedWords,
        substitutedWords: substitutedWords,
        uncertainDetail: uncertainDetail, // {ayah: {heard, expected}}
        repeats: {}, // repetition tracking retired — see CLAUDE.md
        wordCoverage: Math.round(wordRatio * 100) / 100,
        score: score,
        durationSec:
          started && this.endedAt
            ? Math.round((this.endedAt - this.startedAt) / 1000)
            : 0,
      };
    }
  }

  /**
   * Freestyle ("just recite") support: derive a coach anchor from the first
   * confident verse_match of an un-anchored session. Tilawa's discovery mode
   * identifies the verse across all 6,236; the expected range then becomes
   * that verse through the end of its surah. Returns constructor options for
   * RecitationCoach, or null if the event is not a confident verse match.
   *
   * This is the one place verse_match/verse_candidate is still used: only
   * to pick WHERE an un-anchored session starts, never to judge whether a
   * verse was correctly recited. Once anchored, the coach behaves exactly
   * like a normal picked-passage session.
   */
  RecitationCoach.anchorFromEvent = function (event, quranData, opts) {
    const minConfidence = (opts && opts.minConfidence) || 0.55;
    if (!event) return null;
    let surah = null;
    let ayah = null;
    if (event.type === 'verse_match') {
      if ((event.confidence || 0) < minConfidence) return null;
      surah = event.surah;
      ayah = event.ayah;
    } else if (event.type === 'verse_candidate' && event.stable) {
      const top =
        (event.candidates || []).find(function (c) {
          return c.rank === 0;
        }) || (event.candidates || [])[0];
      if (!top || (top.confidence || 0) < Math.max(minConfidence, 0.85)) return null;
      surah = top.surah;
      ayah = top.ayah;
    } else {
      return null;
    }
    const verses = [];
    let ayahEnd = ayah;
    for (const v of quranData) {
      if (v.surah === surah && v.ayah >= ayah) {
        verses.push({ ayah: v.ayah, text: v.text_uthmani });
        if (v.ayah > ayahEnd) ayahEnd = v.ayah;
      }
    }
    if (verses.length === 0) return null;
    verses.sort(function (a, b) {
      return a.ayah - b.ayah;
    });
    return {
      surah: surah,
      ayahStart: ayah,
      ayahEnd: ayahEnd,
      verses: verses,
    };
  };

  RecitationCoach.splitDisplayTokens = splitDisplayTokens;
  RecitationCoach.countWords = countWords;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RecitationCoach;
  } else {
    globalScope.RecitationCoach = RecitationCoach;
  }
})(typeof self !== 'undefined' ? self : this);
