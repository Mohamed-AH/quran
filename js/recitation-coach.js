/**
 * RecitationCoach — pure state machine for the Recitation (تلاوة) feature.
 *
 * Architecture (rewrite — see CLAUDE.md "Rebuild the coach on our own
 * alignment engine"): tilawa's own tracker (verse_match / word_progress /
 * verse_candidate / lex_check / tracking_abandoned) is used ONLY to drive
 * audio capture in the worker; none of its verse-identity or scoring
 * conclusions are trusted here anymore. Every prior bug in this feature —
 * false starts, verses credited "done" with zero content confirmation,
 * boundary mislabeling, missed skips — traced back to that tracker's own
 * heuristics, which were built to keep a cursor roughly in place, not to
 * verify correctness. Proof it's structural, not tunable: real field data
 * showed genuinely-skipped verses and genuinely-correct-but-sparse verses
 * emitting the EXACT SAME tracker signal — no threshold separates them.
 *
 * The coach now runs entirely on `word_verdicts` — continuous, alignment-
 * engine (tilawa-build/src/align.js) verdicts of the decoded transcript
 * against the expected passage text, forwarded by the worker on every
 * decode cycle (see `decoded_text` / `word_verdicts` in worker-entry.js).
 * This mimics a real ustad: listen to one ayah, then judge it once —
 * NOT a continuously-revised running guess reacting to the first word
 * heard.
 *
 * Model:
 *  - Each ayah is a "capture window": alignment evidence (matched/fuzzy/
 *    missing/substituted words) accumulates as it arrives.
 *  - The window CLOSES — the ayah is evaluated once, a verdict is fixed,
 *    and the cursor advances — only once alignment evidence has STABLY
 *    shifted onto a later ayah for several consecutive cycles (a single
 *    transient hit can be sliding-window boundary noise: tilawa re-decodes
 *    a sliding audio window every cycle, so the tail of one ayah and the
 *    head of the next can appear in the same fragment).
 *  - Verdict at close time is THREE-TIER, scaled by ayah length (a single
 *    misdecode swings a 2-word ayah's coverage ratio far more than a
 *    20-word ayah's):
 *      done       — high word coverage (missedWords/substitutedWords may
 *                   still be attached — specific, confident mistakes).
 *      skipped    — near-zero coverage before later content is confidently
 *                   present. This is the app's central purpose: catching a
 *                   verse the reciter never said.
 *      uncertain  — coverage lands in the murky middle. No verdict is
 *                   forced; the raw heard text is kept alongside the
 *                   expected text so the reciter can judge for themself.
 *  - Repetition is never an error: content that doesn't anchor inside the
 *    live expected window (an earlier verse recited again) simply
 *    contributes no alignment evidence and is silently ignored.
 *
 * handleEvent(event) returns a list of effect objects for the UI:
 *   {type:'started', ayah}
 *   {type:'verse-active', ayah}
 *   {type:'word-progress', ayah, matched:[i...], totalWords}
 *   {type:'verse-committed', ayah, missedWords:[i...], substitutedWords:[...]}
 *   {type:'verses-skipped', ayahs:[...]}   (provisional until finalize)
 *   {type:'passage-complete', ayah}
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
    // Alignment-based session start: proof that this many expected words
    // were actually recited is direct evidence — no tracker involved.
    startMinWords: 3,
    // How many matched/fuzzy words on an UPCOMING ayah count as "the
    // reciter has moved on" evidence for that ayah.
    advanceMinWords: 2,
    // An upcoming ayah must show that evidence STABLY, across this many
    // consecutive word_verdicts cycles, before the current ayah's capture
    // window closes. tilawa re-decodes a SLIDING window of recent audio
    // every cycle (not incremental deltas), so a fragment spanning a verse
    // boundary can transiently show a sliver of the next ayah's content —
    // one such cycle is not enough to safely conclude the reciter moved on.
    advanceStabilityCycles: 2,
    // Three-tier verdict thresholds (fraction of the ayah's scored words
    // that ended up matched/fuzzy). Scaled by ayah length: a single
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

      this.state = 'awaiting_start';
      this.cursor = null; // ayah currently being captured (open window)
      this.startedAt = null;
      this.endedAt = null;
      this.stopRequested = false;
      // {ayah, streak} — the furthest upcoming ayah currently showing
      // advance-worthy evidence, and how many consecutive cycles it's held.
      this.advanceCandidate = null;
      this.passageCompleteEmitted = false;

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
          // Raw decoded text last seen while this ayah was under evaluation
          // — carried into the 'uncertain' tier so the reciter can compare
          // what was heard against what was expected themselves.
          lastHeardText: '',
          status: 'pending', // pending | done | skipped | uncertain
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
     * The three-tier verdict for one ayah's CLOSED capture window — see the
     * class doc comment. Pure function of accumulated alignment evidence;
     * called exactly once per ayah (at window-close, or at session end for
     * whatever's still open) so a verdict is never revised after the fact.
     *
     * Returns the status string 'unverified' for the "uncertain / needs
     * your review" tier — kept as the existing status name (rather than a
     * new 'uncertain' string) so the live per-verse chip rendering in
     * js/recitation.js, which already has an 'unverified' chip, keeps
     * working unchanged; Phase 3 does the deliberate rename + detail view.
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

      // Accumulate evidence FIRST, before deciding whether this message
      // starts the session — a fragment can carry real matches for an
      // earlier ayah alongside the ayah that actually crosses the start
      // threshold (align.js emits verdicts in expected-word order, so an
      // earlier ayah's evidence always precedes a later one's in the same
      // fragment). Evaluating "what's already known" for earlier verses
      // must see this message's own evidence too, not just prior messages'.
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

      // Alignment-based session start: real evidence that the expected
      // passage is actually being recited, independent of any tracker.
      if (this.state === 'awaiting_start') {
        const matchedVerdicts = verdicts.filter(
          (vd) => vd.status === 'matched' || vd.status === 'fuzzy'
        );
        if (matchedVerdicts.length < this.cfg.startMinWords) return effects;
        effects.push(...this._start(matchedVerdicts[0].ayah));
      }

      for (const ayah of touched) {
        effects.push({
          type: 'word-progress',
          ayah: ayah,
          matched: this.coveredIndices(ayah),
          totalWords: this.perVerse[ayah].totalWords,
        });
      }

      if (this.state !== 'tracking') return effects;

      // The current ayah is the LAST in the picked range — there is no
      // "next ayah" to gather advance evidence from, so completion is
      // judged directly against this ayah's own coverage.
      if (this.cursor === this.ayahEnd) {
        effects.push(...this._checkPassageComplete());
        return effects;
      }

      // Advance-stability check: does an UPCOMING ayah now show enough
      // evidence, and has it shown it consistently for enough consecutive
      // cycles (see advanceStabilityCycles) to safely close the current
      // ayah's window rather than react to one noisy fragment?
      //
      // Scans the FULL remaining range, not just cursor+1/+2 (field bug,
      // Log16.txt/Surah 94: a messy decode of ayah 1 never produced 2
      // stable matched words on ayah 2 or 3, so the cursor never moved —
      // and with a narrow lookahead, later ayahs (4-8, clearly and
      // correctly recited soon after) were never even considered as
      // candidates, so the session silently missed most of a genuinely
      // correct recitation. worker-entry.js's expectedWindow() widens to
      // match — the alignment window and this scan must cover the same
      // range or genuine far-ahead evidence exists but is invisible here.
      let candidate = this.cursor;
      for (let a = this.cursor + 1; a <= this.ayahEnd; a++) {
        if (this.perVerse[a] && this.perVerse[a].matched.size >= this.cfg.advanceMinWords) {
          candidate = a;
        }
      }
      if (candidate === this.cursor) {
        this.advanceCandidate = null;
        return effects;
      }
      if (this.advanceCandidate && this.advanceCandidate.ayah === candidate) {
        this.advanceCandidate.streak++;
      } else {
        this.advanceCandidate = { ayah: candidate, streak: 1 };
      }
      if (this.advanceCandidate.streak >= this.cfg.advanceStabilityCycles) {
        this.advanceCandidate = null;
        effects.push(...this._closeAndAdvance(candidate));
      }
      return effects;
    }

    /**
     * Fires 'passage-complete' once the picked passage's LAST verse
     * reaches a "done" verdict — every earlier verse gets a live signal
     * when its window closes (verse-committed), but the last verse never
     * advances anywhere, so nothing else tells the UI the recitation is
     * actually finished before tilawa's own silence timeout or a manual
     * stop.
     */
    _checkPassageComplete() {
      if (this.passageCompleteEmitted) return [];
      if (this._evaluateVerse(this.ayahEnd) !== 'done') return [];
      this.passageCompleteEmitted = true;
      const v = this.perVerse[this.ayahEnd];
      v.status = 'done';
      return [{ type: 'passage-complete', ayah: this.ayahEnd }];
    }

    _start(ayah) {
      const effects = [];
      this.state = 'tracking';
      this.startedAt = this.now();
      this.cursor = ayah;

      if (ayah > this.ayahStart) {
        // Provisional (reconciled at finalize): evaluate whatever real
        // alignment evidence already accumulated for the verses before the
        // detected start — a fragment spanning the eventual start ayah can
        // carry genuine evidence for earlier verses too, in the same batch.
        // Anything with no real evidence is a genuine skip, not a guess.
        const skipped = [];
        for (let a = this.ayahStart; a < ayah; a++) {
          const verdict = this._evaluateVerse(a);
          this.perVerse[a].status = verdict;
          if (verdict === 'skipped') skipped.push(a);
        }
        if (skipped.length) effects.push({ type: 'verses-skipped', ayahs: skipped });
      }
      effects.push({ type: 'started', ayah: ayah });
      effects.push({ type: 'verse-active', ayah: ayah });
      return effects;
    }

    _closeAndAdvance(toAyah) {
      const effects = [];
      const cur = this.perVerse[this.cursor];
      cur.status = this._evaluateVerse(this.cursor);
      if (cur.status === 'skipped') {
        effects.push({ type: 'verses-skipped', ayahs: [this.cursor] });
      } else {
        effects.push({
          type: 'verse-committed',
          ayah: cur.ayah,
          unverified: cur.status === 'unverified',
          missedWords: cur.status === 'done' ? this.missedWordIndices(cur.ayah) : [],
          substitutedWords: cur.status === 'done' ? this.substitutedWords(cur.ayah) : [],
        });
      }

      // toAyah can be cursor+2 (the advance window looks two ayahs ahead) —
      // any ayah strictly between never gathered its own advance evidence
      // and is a genuine skip: this is the direct mechanism that catches a
      // fully-omitted verse between two correctly recited ones.
      if (toAyah > this.cursor + 1) {
        const skipped = [];
        for (let a = this.cursor + 1; a < toAyah; a++) {
          const verdict = this._evaluateVerse(a);
          this.perVerse[a].status = verdict;
          if (verdict === 'skipped') skipped.push(a);
        }
        if (skipped.length) effects.push({ type: 'verses-skipped', ayahs: skipped });
      }

      this.cursor = toAyah;
      effects.push({ type: 'verse-active', ayah: toAyah });
      return effects;
    }

    _onFinalSequence() {
      // tilawa's tracker flushed (silence-triggered) — no longer trusted
      // for verse identity, but still the signal that audio capture just
      // paused or the session is ending; kept as a coarse secondary cue
      // and the stop-flush completion signal.
      const finishedLastVerse =
        this.cursor === this.ayahEnd && this._evaluateVerse(this.ayahEnd) === 'done';

      if (this.stopRequested || finishedLastVerse) {
        return [this._finalize()];
      }
      // A long contemplation pause flushed the tracker mid-session. Keep the
      // session open — the reciter resumes and alignment picks up again.
      return [{ type: 'checkpoint' }];
    }

    /** UI calls this when the user taps Stop (before the worker flush). */
    requestStop() {
      this.stopRequested = true;
    }

    /**
     * Idempotent session end: reconcile every verse's final status and
     * build the summary. Called via final_sequence (stop-flush or last
     * verse finished) or directly by the UI as a fallback.
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

      // Evaluate every verse whose window never explicitly closed (the
      // open cursor verse, and anything beyond it) exactly like a normal
      // close would have. A verse reached only stays 'skipped' if a LATER
      // verse was genuinely recited too — one simply not reached because
      // the reciter stopped there on purpose is reported separately
      // ('not reached'), not as a mistake.
      let lastRecited = null;
      for (let a = this.ayahStart; a <= this.ayahEnd; a++) {
        const v = this.perVerse[a];
        if (v.status === 'done' || v.status === 'unverified') {
          lastRecited = a;
          continue;
        }
        if (v.status === 'skipped') continue; // already closed as a skip
        const verdict = this._evaluateVerse(a);
        if (verdict !== 'skipped') {
          v.status = verdict;
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
        repeats: {}, // repetition tracking retired — see CLAUDE.md Phase 2
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
