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

  // Mirrors tilawa's own QuranDB._startsWithArabicBismillah exactly (same 4
  // words, same surah 1/9 exclusions): ayah 1 of every surah except
  // Al-Fatiha (1, where the Basmala IS the verse) and At-Tawbah (9, which
  // has none) embeds the Basmala as the verse's own first 4 words in this
  // text source. Reciters accept several equally valid openings — isti'adhah
  // + Basmala, Basmala only, isti'adhah only, or straight into the surah —
  // so these 4 words must never be treated as required. (Isti'adhah itself,
  // "أعوذ بالله من الشيطان الرجيم", isn't Quran text at all — it never
  // appears in any verse's word list, so it was never scored to begin with;
  // once the tracker is scoped to the picked surah, that audio simply
  // matches nothing and is silently ignored until real recitation starts.)
  const BSM_WORDS = ['بسم', 'الله', 'الرحمن', 'الرحيم'];

  // text_uthmani carries full diacritics and the alef-wasla variant (ٱ,
  // U+0671) — strip both so the comparison matches BSM_WORDS' bare forms.
  function normalizeArabicWord(text) {
    return String(text || '')
      .replace(/[ً-ٰٟـ]/g, '') // harakat/tanwin/shadda/sukun + tatweel
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
    startConfidence: 0.55, // min verse_match confidence to open the session
    doneCoverage: 0.6, // word coverage for the active verse to count as done at finalize
    reconcileCoverage: 0.8, // coverage that counts a verse done even without a commit
    offTrackLimit: 3, // consecutive out-of-range events before the off-track hint
    // verse_candidate-based start: discovery's ranked candidates identify
    // the passage even when the tracker's advance gate is stuck on a
    // noise-acquired verse (field bug: perfect Fatiha decode, tracker
    // blocked on 104:9). Stable in-range candidates open the session.
    candidateStartConfidence: 0.85,
    // Corroborating span evidence recorded from ANY in-range verse_candidate
    // (not just at session start) — see spanEvidence below. Lower bar than
    // candidateStartConfidence because this only ever RESCUES a verse from
    // a false skip accusation, never accuses; the risk of being generous
    // here is a verse marked done that maybe wasn't fully recited, not a
    // false mistake claim.
    spanEvidenceConfidence: 0.75,
    // Transcript-alignment session start/advance: independent of tilawa's
    // tracker entirely — if the aligner proves >=N expected words were
    // recited, that IS the recitation. The strongest defense against a
    // tracker stuck on a noise commit.
    transcriptStart: true,
    transcriptStartWords: 3,
    scoreWeights: { verses: 60, words: 30, confidence: 10 },
    // Transcript-alignment word verdicts (worker `word_verdicts` events).
    // Off until calibrated against real wrong-recitation clips — see
    // CONFIG.FEATURES.WORD_VERDICTS.
    useWordVerdicts: false,
    // Content-verification gate (worker `lex_check` events, from tilawa's
    // own tracking_cycle.word_matches diagnostic — see _onLexCheck). A
    // session needs at least this many fallback-only (non-lexical) advances
    // accumulated, with ZERO real lexical advances anywhere in the whole
    // session, before its content is judged unverified. Session-wide, not
    // per-verse: a single short verse can legitimately clear in 1-2
    // fallback cycles with no lexical hit (field-observed in genuine
    // correct recitation), so only a sustained absence across the whole
    // session is trustworthy negative evidence.
    minFallbackForJudgment: 6,
    // Per-verse counterpart: catches a SINGLE fabricated verse sandwiched
    // inside an otherwise well-verified session (session-wide totals never
    // cross minFallbackForJudgment there, since the rest of the session has
    // plenty of real matches). Deliberately imprecise — the only two real
    // data points available sit right on either side of this number (2
    // fallback cycles / genuinely correct, Surah 87 ayah 13; 3 fallback
    // cycles / genuinely fabricated, Surah 20 ayah 91) — but shipped anyway:
    // for this app, a missed skip is worse than an occasional false
    // "unverified" flag on a fast, short verse.
    minFallbackForVerseJudgment: 3,
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
      // Session-wide content-verification counters — see _onLexCheck.
      this.lexAdvances = 0;
      this.fallbackAdvances = 0;
      // ayah -> confidence, from ANY in-range verse_candidate seen so far
      // (tracking or awaiting_start). tilawa's discovery often identifies a
      // multi-verse span (e.g. "1:2-4") and then — by design — commits only
      // its first ayah ("live span collapsed to first ayah"); without this,
      // the coach would later see a jump past 3-4 and wrongly call them
      // skipped even though the recognizer's own evidence covered them.
      this.spanEvidence = {};

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
          // Tilawa's word_progress carries `word_index` (the alignment
          // position — first unmatched word, a high-water mark) and
          // `matched_indices` (INCREMENTAL matches for the cycle, often a
          // single index). Coverage is therefore progress-based; the
          // matched set only adds stragglers beyond the high-water mark.
          progress: 0,
          matched: new Set(),
          // Word-level flags from transcript alignment: index →
          // {status: 'missing'|'substituted', heard?, expected}. A later
          // matched/fuzzy verdict for the same index REPAIRS (deletes) the
          // flag — re-recitation can always clear an accusation.
          wordFlags: {},
          repeats: 0,
          sawCommit: false,
          status: 'pending', // pending | active | done | skipped | unverified
          // Per-verse content-verification counters — see _onLexCheck /
          // _looksUnverified.
          lexAdvances: 0,
          fallbackAdvances: 0,
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
     *
     * A verse with ZERO coverage at all (progress=0, nothing matched) is a
     * different situation entirely: it means the tracker advanced past this
     * verse before any word-level alignment ever ran on it (e.g. a fast
     * commit+advance on a short opening verse) — we have no data, not
     * evidence of specific missing words. Reporting all N words as "missed"
     * would misrepresent an absence of data as an accusation; field-tested
     * case (build 2026-07-20e): a session that recited verse 1:1 correctly
     * still had all 4 of its words reported "missed" this way.
     */
    missedWordIndices(ayah) {
      const v = this.perVerse[ayah];
      if (v.progress === 0 && v.matched.size === 0) return [];
      const missed = [];
      for (let i = v.progress; i < v.totalWords; i++) {
        if (i < v.optionalCount) continue; // Basmala prefix — never accused
        if (!v.matched.has(i)) missed.push(i);
      }
      return missed;
    }

    /**
     * Word count used as the SCORING denominator for a verse: the optional
     * Basmala prefix only counts if it was actually recited (matched) —
     * omitting it validly must not drag down word-coverage percentage, but
     * saying it still earns credit like any other word.
     */
    _scoredWordTotal(ayah) {
      const v = this.perVerse[ayah];
      // Same "covered" notion as coveredCount(): an index counts as covered
      // if it's below the progress high-water mark OR explicitly matched.
      let unmatchedOptional = 0;
      for (let i = 0; i < v.optionalCount; i++) {
        const covered = i < v.progress || v.matched.has(i);
        if (!covered) unmatchedOptional++;
      }
      return v.totalWords - unmatchedOptional;
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
        case 'word_verdicts':
          return this._onWordVerdicts(event);
        case 'lex_check':
          return this._onLexCheck(event);
        case 'verse_candidate':
          return this._onVerseCandidate(event);
        case 'final_sequence':
          return this._onFinalSequence(event);
        default:
          return [];
      }
    }

    /**
     * Start the session from discovery candidates when the verse_match path
     * is unavailable (tracker stuck on a pre-recitation noise commit).
     * Requires a stable top candidate inside the expected range — or the
     * same unstable top candidate twice in a row (hysteresis).
     */
    /** Record every in-range candidate as corroborating span evidence,
     *  regardless of session state — this is pure bookkeeping, never an
     *  action by itself.
     *
     *  Requires msg.stable: a single volatile sighting of a multi-verse span
     *  is not reliable per-verse evidence — tilawa's own joint-match score
     *  for a span is ONE number covering the whole span, and a strong match
     *  on one verse can drag a weak/absent second verse's confidence over
     *  spanEvidenceConfidence too. Field case (build 2026-07-21, Surah 21
     *  ayahs 25-30): ayah 27 was never recited — the transcript shows ayah
     *  26's tail flowing directly into ayah 28's opening — but a single,
     *  never-stable "21:26-27" candidate (confidence up to 0.99, driven
     *  entirely by ayah 26's strong match) got recorded as evidence for 27
     *  too, rescuing it from a real skip. Requiring stability (the same bar
     *  _onVerseCandidate already uses to open a session) filters out
     *  exactly this kind of one-off, unconfirmed span sighting while
     *  keeping the original rescue case intact — every existing spanEvidence
     *  test already uses a stable candidate. */
    _recordSpanEvidence(msg) {
      if (!msg.stable) return;
      for (const c of msg.candidates || []) {
        if (c.surah !== this.surah) continue;
        if ((c.confidence || 0) < this.cfg.spanEvidenceConfidence) continue;
        const start = Math.max(c.ayah, this.ayahStart);
        const end = Math.min(c.ayah_end || c.ayah, this.ayahEnd);
        for (let a = start; a <= end; a++) {
          if (!this.spanEvidence[a] || c.confidence > this.spanEvidence[a]) {
            this.spanEvidence[a] = c.confidence;
          }
        }
      }
    }

    _onVerseCandidate(msg) {
      this._recordSpanEvidence(msg);
      const effects = [];
      if (this.state !== 'awaiting_start') return effects;
      // Scan ALL candidates for the best IN-RANGE one — the first entry is
      // tilawa's fusion/champion pick, which can be an out-of-range verse
      // (field case: 87:1 ranked above the correct 1:1-2 span). The user
      // told us the passage; an out-of-range leader is irrelevant to us.
      let top = null;
      for (const c of msg.candidates || []) {
        if ((c.confidence || 0) < this.cfg.candidateStartConfidence) continue;
        const cEnd = c.ayah_end || c.ayah;
        if (c.surah !== this.surah || cEnd < this.ayahStart || c.ayah > this.ayahEnd) continue;
        if (!top || (c.confidence || 0) > (top.confidence || 0)) top = c;
      }
      if (!top) {
        this.pendingCandidate = null;
        return effects;
      }
      const spanStart = top.ayah;
      const spanEnd = top.ayah_end || top.ayah;

      const key = `${top.surah}:${spanStart}-${spanEnd}`;
      if (!msg.stable) {
        if (this.pendingCandidate !== key) {
          this.pendingCandidate = key; // wait for a second consistent sighting
          return effects;
        }
      }
      this.pendingCandidate = null;

      // The candidate span is what has ALREADY been recited: start at the
      // span's first in-range ayah, then advance through the span so the
      // cursor lands on its last verse. Word coverage arrives afterwards
      // via word_verdicts/word_progress; reconciliation counts committed
      // verses as done.
      const from = Math.max(spanStart, this.ayahStart);
      const to = Math.min(spanEnd, this.ayahEnd);
      effects.push(...this._start(from));
      for (let a = from + 1; a <= to; a++) {
        effects.push(...this._commitAndAdvance(a));
      }
      return effects;
    }

    /**
     * Session-wide content-verification bookkeeping — see `lex_check` in
     * tilawa-build/src/worker-entry.js and minFallbackForJudgment above.
     * Pure counting; the actual gate is applied once, at finalize (see
     * _buildSummary), against the whole session's totals.
     */
    _onLexCheck(msg) {
      if (!this.inRange(msg.surah, msg.ayah)) return [];
      const v = this.perVerse[msg.ayah];
      if (msg.lexical) {
        this.lexAdvances++;
        v.lexAdvances++;
      } else {
        this.fallbackAdvances++;
        v.fallbackAdvances++;
      }
      return [];
    }

    /**
     * Per-verse counterpart to the session-wide content-verification gate
     * (minFallbackForJudgment) — see minFallbackForVerseJudgment above for
     * the field motivation and the two data points the threshold sits
     * between. Checked at the moment a verse would otherwise be marked
     * 'done' (_commitAndAdvance, _finalize) so it can be marked 'unverified'
     * instead.
     */
    _looksUnverified(ayah) {
      const v = this.perVerse[ayah];
      return (
        v.fallbackAdvances >= this.cfg.minFallbackForVerseJudgment &&
        v.lexAdvances === 0
      );
    }

    _onWordVerdicts(msg) {
      const effects = [];
      if (!this.cfg.useWordVerdicts && !this.cfg.transcriptStart) return effects;
      if (msg.surah !== this.surah) return effects;
      if (this.state !== 'tracking' && this.state !== 'awaiting_start') return effects;

      const verdicts = (msg.verdicts || []).filter(
        (vd) =>
          this.perVerse[vd.ayah] &&
          vd.index >= 0 &&
          vd.index < this.perVerse[vd.ayah].totalWords
      );

      // Transcript-based session start: alignment proving that expected
      // words were recited is direct evidence, no tracker involved.
      if (this.state === 'awaiting_start') {
        if (!this.cfg.transcriptStart) return effects;
        const matchedVerdicts = verdicts.filter(
          (vd) => vd.status === 'matched' || vd.status === 'fuzzy'
        );
        if (matchedVerdicts.length < this.cfg.transcriptStartWords) return effects;
        effects.push(...this._start(matchedVerdicts[0].ayah));
      }

      const touched = new Set();
      for (const verdict of verdicts) {
        const v = this.perVerse[verdict.ayah];
        if (verdict.status === 'matched' || verdict.status === 'fuzzy') {
          const grew = !v.matched.has(verdict.index);
          v.matched.add(verdict.index);
          if (v.wordFlags[verdict.index]) delete v.wordFlags[verdict.index]; // repair
          if (grew) touched.add(verdict.ayah);
        } else if (
          this.cfg.useWordVerdicts &&
          (verdict.status === 'missing' || verdict.status === 'substituted')
        ) {
          // Accusations stay behind the calibration flag, and never
          // contradict an explicit earlier match for the same word.
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

      for (const ayah of touched) {
        effects.push({
          type: 'word-progress',
          ayah: ayah,
          matched: this.coveredIndices(ayah),
          totalWords: this.perVerse[ayah].totalWords,
        });
      }

      // Transcript-driven advance: enough aligned words in an UPCOMING verse
      // (not just the immediate next one — a fast reciter's fragment can
      // cover two verses at once) means the reciter moved on, even if the
      // tracker's own advance gate never says so. Scans forward through the
      // alignment window and jumps to the furthest well-evidenced verse;
      // _commitAndAdvance's span-evidence rescue (fed by the same
      // verse_candidate stream) keeps any verse in between from being
      // wrongly called skipped.
      let target = this.cursor;
      for (let a = this.cursor + 1; a <= Math.min(this.cursor + 2, this.ayahEnd); a++) {
        if (this.perVerse[a] && this.perVerse[a].matched.size >= 2) target = a;
      }
      if (
        target > this.cursor &&
        (this.coverage(this.cursor) >= 0.5 || this.perVerse[this.cursor].sawCommit)
      ) {
        this.pendingJump = null;
        this.pendingBack = null;
        effects.push(...this._commitAndAdvance(target));
      }
      return effects;
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
        if (A > this.ayahStart && (msg.confidence || 0) < this.cfg.candidateStartConfidence) {
          // Starting mid-passage immediately accuses the skipped-over verses —
          // demand the same bar as a discovery-candidate start (0.85), not the
          // low bar (0.55) meant for starting cleanly at ayahStart. Field bug
          // (build 2026-07-20j, Surah 87): isti'adhah + Basmala pre-recitation
          // audio spuriously committed to ayah 11 at confidence 0.83 via
          // tilawa's "live_span_collapsed" fallback, and the coach accepted it
          // as the real start — falsely accusing 1,2,5-10 of being skipped
          // while the reciter was still on the isti'adhah/Basmala.
          return effects;
        }
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
        // have meant to start mid-range) — and rescued immediately if
        // discovery evidence already covers a verse (see spanEvidence).
        const skipped = [];
        for (let a = this.ayahStart; a < ayah; a++) {
          if (this.spanEvidence[a] >= this.cfg.spanEvidenceConfidence) {
            this.perVerse[a].status = 'done';
            this.perVerse[a].sawCommit = true;
          } else {
            this.perVerse[a].status = 'skipped';
            skipped.push(a);
          }
        }
        if (skipped.length) effects.push({ type: 'verses-skipped', ayahs: skipped });
      }
      effects.push({ type: 'started', ayah: ayah });
      effects.push({ type: 'verse-active', ayah: ayah });
      return effects;
    }

    _commitAndAdvance(toAyah) {
      const effects = [];
      const cur = this.perVerse[this.cursor];
      cur.status = this._looksUnverified(this.cursor) ? 'unverified' : 'done';
      effects.push({
        type: 'verse-committed',
        ayah: cur.ayah,
        unverified: cur.status === 'unverified',
        missedWords: cur.status === 'done' ? this.missedWordIndices(cur.ayah) : [],
      });

      if (toAyah > this.cursor + 1) {
        const skipped = [];
        for (let a = this.cursor + 1; a < toAyah; a++) {
          if (this.perVerse[a].status !== 'pending') continue;
          // Rescue: the recognizer's own discovery evidence covered this
          // verse (typically a multi-verse span tilawa committed only the
          // head of — "live span collapsed to first ayah"), OR it already
          // has direct word-level matches (e.g. a multi-step transcript
          // advance just aligned it in the same batch as the target verse).
          // Either is positive evidence of recitation, not a mistake.
          if (
            this.spanEvidence[a] >= this.cfg.spanEvidenceConfidence ||
            this.perVerse[a].matched.size >= 2
          ) {
            this.perVerse[a].status = 'done';
            this.perVerse[a].sawCommit = true;
          } else {
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
          v.status = this._looksUnverified(a) ? 'unverified' : 'done';
          lastRecited = a;
        }
      }
      // Active verse with partial coverage still counts when good enough.
      if (
        this.cursor !== null &&
        this.perVerse[this.cursor].status !== 'done' &&
        this.perVerse[this.cursor].status !== 'unverified' &&
        this.coverage(this.cursor) >= this.cfg.doneCoverage
      ) {
        this.perVerse[this.cursor].status = this._looksUnverified(this.cursor)
          ? 'unverified'
          : 'done';
        if (lastRecited === null || this.cursor > lastRecited) {
          lastRecited = this.cursor;
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
      const unverified = [];
      const missedWords = {};
      const substitutedWords = {};
      const repeats = {};
      let matchedTotal = 0;
      let wordTotal = 0;

      for (let a = this.ayahStart; a <= this.ayahEnd; a++) {
        const v = this.perVerse[a];
        if (v.status === 'done') {
          done.push(a);
          // Misses = unreached tail ∪ alignment-confirmed missing words.
          const missedSet = new Set(this.missedWordIndices(a));
          const subs = [];
          for (const idx of Object.keys(v.wordFlags)) {
            const flag = v.wordFlags[idx];
            if (flag.status === 'missing') {
              missedSet.add(Number(idx));
            } else if (flag.status === 'substituted') {
              subs.push({ index: Number(idx), heard: flag.heard, expected: flag.expected });
            }
          }
          if (missedSet.size) {
            missedWords[a] = Array.from(missedSet).sort(function (x, y) {
              return x - y;
            });
          }
          if (subs.length) {
            substitutedWords[a] = subs.sort(function (x, y) {
              return x.index - y.index;
            });
          }
          matchedTotal += this.coveredCount(a);
          wordTotal += this._scoredWordTotal(a);
        } else if (v.status === 'unverified') {
          // Tracked to apparent completion, but with no real lexical
          // corroboration anywhere — counts against the reciter like a
          // skip (a "go check this verse again" flag), never as done.
          unverified.push(a);
          wordTotal += v.totalWords;
        } else if (v.status === 'skipped') {
          skipped.push(a);
          wordTotal += v.totalWords;
        } else {
          notReached.push(a);
        }
        if (v.repeats > 0) repeats[a] = v.repeats;
      }

      const expectedCount = done.length + skipped.length + unverified.length;
      const verseRatio = expectedCount ? done.length / expectedCount : 0;
      const wordRatio = wordTotal ? matchedTotal / wordTotal : 0;
      const avgConfidence = this.confidences.length
        ? this.confidences.reduce(function (s, c) {
            return s + c;
          }, 0) / this.confidences.length
        : 0;

      const w = this.cfg.scoreWeights;
      const started = this.startedAt !== null;
      // Content-verification gate: tilawa's own tracking can complete a
      // verse purely on acoustic/char-position fallback (duration alone),
      // with ZERO real lexical corroboration (see _onLexCheck). A genuine
      // multi-verse recitation reliably produces SOME real lexical advances
      // somewhere; a session with none at all, despite a real volume of
      // tracked advances, was never actually verified as this passage —
      // field case: reciting the English alphabet against a picked surah
      // otherwise scored 100 (build 2026-07-21, Surah 106).
      const contentUnverified =
        started &&
        this.fallbackAdvances >= this.cfg.minFallbackForJudgment &&
        this.lexAdvances === 0;
      const score = contentUnverified
        ? 0
        : started
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
        versesUnverified: unverified,
        versesNotReached: notReached,
        missedWords: missedWords,
        substitutedWords: substitutedWords,
        repeats: repeats,
        contentUnverified: contentUnverified,
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

  /**
   * Freestyle ("just recite") support: derive a coach anchor from the first
   * confident verse_match of an un-anchored session. Tilawa's discovery mode
   * identifies the verse across all 6,236; the expected range then becomes
   * that verse through the end of its surah. Returns constructor options for
   * RecitationCoach, or null if the event is not a confident verse match.
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
      // Discovery candidates can anchor a freestyle session even when the
      // tracker's advance gate is stuck — stable top candidate only.
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
