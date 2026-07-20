/**
 * Recitation (تلاوة) tab controller — the "personal listening coach".
 *
 * Orchestrates: surah picker → one-time model download → live coaching view
 * (word-by-word highlighting) → session summary. Wires together:
 *   recitationAssets (download/cache) → tilawa worker (inference)
 *   recitationAudio (mic → 16 kHz chunks) → RecitationCoach (verdicts) → DOM.
 *
 * Everything here is DOM/orchestration; all coaching decisions live in
 * js/recitation-coach.js and all recognition in js/vendor/tilawa-worker.js.
 */

const recitationUI = {
  // Streaming config tuned for a patient coach: max allowed silence window
  // (tilawa clamps finalSilenceSec to 5 s) so breathing pauses are absorbed;
  // a longer pause just flushes a checkpoint and the session stays open.
  STREAMING_CONFIG: { audioChunkMs: 200, finalSilenceSec: 5 },

  _initialized: false,
  _worker: null,
  _engineReady: false,
  _enginePromise: null,
  _quranData: null,

  _phase: 'picker', // picker | setup | live | summary
  _session: null, // { surah, ayahStart, ayahEnd, verses, coach, startedAtMs }
  _confirmSurah: null,
  _elapsedTimer: null,
  _hintTimer: null,
  _lastSummary: null,

  // -------------------------------------------------------------------------
  // Local strings for dynamically rendered content (static markup is handled
  // by app.js trans + applyLanguage via element ids).
  // -------------------------------------------------------------------------
  _rt: {
    ar: {
      ayahs: 'آية',
      range: 'الآيات',
      downloadingAssets: 'تحميل بيانات الآيات…',
      downloadingModel: 'تنزيل نموذج الاستماع…',
      initializing: 'تشغيل المستمع… لحظات',
      listening: 'أستمع إليك…',
      awaitingStart: 'ابدأ التلاوة متى شئت — أنا أستمع، خذ وقتك',
      freestyleTitle: 'اتلُ مباشرة',
      freestyleDesc: 'من أي موضع — سأتعرف على السورة تلقائياً',
      freestyleListening: 'اتلُ من أي موضع في القرآن — سأتعرف على موضعك وأتابعك',
      anchored: (name) => `🎯 ${name} — تابع، أنا معك`,
      stillListening: 'لم أسمع تلاوة بعد — ما زلت أستمع',
      repetition: '🔁 إعادة — أحسنت التدبر',
      checkpoint: 'توقفت للتأمل؟ خذ وقتك، ما زلت أستمع',
      micSilent: '🎤 لا أسمع أي صوت — تحقق من الميكروفون',
      micLow: '🎤 صوتك منخفض — ارفع صوتك قليلاً أو اقترب من الميكروفون',
      micHot: '🎤 الصوت مرتفع جداً — ابتعد قليلاً عن الميكروفون',
      relisten: '🔄 أعيد الاستماع من جديد — تابع التلاوة',
      summaryMicHint: '🎤 كان مستوى الصوت منخفضاً جداً طوال الجلسة — جرّب رفع صوتك أو الاقتراب من الميكروفون',
      summaryHeardOther: '👂 سمعتُ صوتاً لكن لم أتعرف على السورة المختارة — جرّب البدء مباشرة بالتلاوة في مكان هادئ',
      offTrack: 'يبدو أنك تتلو موضعاً آخر — أتابع السورة المختارة',
      stopping: 'لحظة… أراجع ما سمعت',
      verseOf: (n, m) => `آية ${n} من ${m}`,
      chipDone: 'تمت',
      chipSkipped: 'تخطيتها',
      chipRepeated: (n) => `تكرار ×${n}`,
      micDenied: 'لم أستطع الوصول للميكروفون. اسمح بالوصول من إعدادات المتصفح ثم أعد المحاولة',
      micMissing: 'لم يتم العثور على ميكروفون',
      downloadFailed: 'تعذر التنزيل — تحقق من الاتصال وأعد المحاولة',
      engineFailed: 'تعذر تشغيل محرك الاستماع',
      retry: 'إعادة المحاولة',
      summaryTitle: 'ملخص التلاوة',
      scoreLabel: 'النتيجة',
      statDone: 'آيات مُتلوّة',
      statSkipped: 'آيات مُتخطّاة',
      statMissed: 'كلمات فائتة',
      statRepeats: 'إعادات',
      missedTitle: 'كلمات فاتتك (بالأحمر)',
      substitutedTitle: 'كلمات مُبدلة',
      heardInstead: (heard, expected) => `سمعت «${heard}» بدل «${expected}»`,
      skippedTitle: 'آيات تخطيتها',
      notReachedNote: (n) => `توقفت قبل ${n} آية من نهاية المقطع`,
      repeatsNote: 'الإعادة للتدبر ليست خطأ — أحسنت',
      noMistakes: 'ما شاء الله — تلاوة متقنة بلا أخطاء! 🌟',
      neverStarted: 'لم أسمع تلاوة في هذه الجلسة',
      btnRetry: '🔁 إعادة المحاولة',
      btnNew: '📖 تلاوة أخرى',
      duration: 'المدة',
      seconds: 'ث',
      minutes: 'د',
    },
    en: {
      ayahs: 'ayahs',
      range: 'Ayahs',
      downloadingAssets: 'Downloading verse data…',
      downloadingModel: 'Downloading the listening model…',
      initializing: 'Starting the listener… one moment',
      listening: 'Listening…',
      awaitingStart: 'Begin whenever you are ready — I am listening, take your time',
      freestyleTitle: 'Just Recite',
      freestyleDesc: 'From anywhere — the surah is detected automatically',
      freestyleListening: 'Recite from anywhere in the Quran — I will find your place and follow along',
      anchored: (name) => `🎯 ${name} — keep going, I am with you`,
      stillListening: 'No recitation heard yet — still listening',
      repetition: '🔁 Repetition — beautiful contemplation',
      checkpoint: 'Pausing to reflect? Take your time — still listening',
      micSilent: '🎤 I hear no sound at all — check your microphone',
      micLow: '🎤 Your voice is faint — speak up a little or move closer to the mic',
      micHot: '🎤 Too loud — move back a little from the mic',
      relisten: '🔄 Listening afresh — keep reciting',
      summaryMicHint: '🎤 Your audio level was very low throughout — try speaking up or moving closer to the microphone',
      summaryHeardOther: '👂 I heard sound but could not recognize the chosen surah — try starting directly with the recitation in a quiet place',
      offTrack: 'You seem to be reciting a different passage — following your chosen surah',
      stopping: 'One moment… reviewing what I heard',
      verseOf: (n, m) => `Ayah ${n} of ${m}`,
      chipDone: 'done',
      chipSkipped: 'skipped',
      chipRepeated: (n) => `repeated ×${n}`,
      micDenied: 'Microphone access was blocked. Allow it in your browser settings and try again',
      micMissing: 'No microphone found',
      downloadFailed: 'Download failed — check your connection and retry',
      engineFailed: 'The listening engine failed to start',
      retry: 'Retry',
      summaryTitle: 'Recitation Summary',
      scoreLabel: 'Score',
      statDone: 'Verses recited',
      statSkipped: 'Verses skipped',
      statMissed: 'Missed words',
      statRepeats: 'Repetitions',
      missedTitle: 'Words you missed (in red)',
      substitutedTitle: 'Substituted words',
      heardInstead: (heard, expected) => `heard “${heard}” instead of “${expected}”`,
      skippedTitle: 'Verses you skipped',
      notReachedNote: (n) => `You stopped ${n} ayah(s) before the end of the passage`,
      repeatsNote: 'Repetition for reflection is never a mistake — well done',
      noMistakes: 'Masha’Allah — a flawless recitation! 🌟',
      neverStarted: 'No recitation was heard in this session',
      btnRetry: '🔁 Try Again',
      btnNew: '📖 New Recitation',
      duration: 'Duration',
      seconds: 's',
      minutes: 'm',
    },
  },

  /** Verbose pipeline logging — enable with ?debug=1 (see CONFIG.TILAWA.DEBUG). */
  _log(...args) {
    if (CONFIG.TILAWA.DEBUG) {
      console.log('%c[recite:ui]', 'color:#d4af37', ...args);
      if (typeof recitationDebug !== 'undefined') {
        recitationDebug.push('ui', args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' '));
      }
    }
  },

  /** Always-on lifecycle breadcrumbs — never gated, so the console always
   *  proves whether the pipeline is alive even without debug mode. */
  _breadcrumb(...args) {
    console.info('[recite]', ...args);
  },

  _lang() {
    try {
      return data.settings.language === 'en' ? 'en' : 'ar';
    } catch (e) {
      return 'ar';
    }
  },

  _t() {
    return this._rt[this._lang()];
  },

  _num(n) {
    return this._lang() === 'ar' && typeof convertToArabicNumerals === 'function'
      ? convertToArabicNumerals(n)
      : String(n);
  },

  // -------------------------------------------------------------------------
  // Init & panels
  // -------------------------------------------------------------------------

  init() {
    if (!CONFIG.FEATURES.RECITATION || !recitationAssets.isSupported()) {
      this._showPanel('reciteUnsupported');
      return;
    }
    if (!this._initialized) {
      this._initialized = true;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && this.isSessionActive()) {
          this.stopSession(); // audio is suspended in background anyway
        }
      });
      window.addEventListener('pagehide', () => {
        if (this.isSessionActive()) this.abandonSession();
      });
    }
    if (this._phase === 'live') {
      this._showPanel('reciteLive');
      return;
    }
    if (this._phase === 'summary' && this._lastSummary) {
      this._showPanel('reciteSummary');
      return;
    }
    this._phase = 'picker';
    this._renderPicker();
    this._showPanel('recitePicker');
  },

  onLanguageChange() {
    if (document.getElementById('reciteTab') === null) return;
    if (this._phase === 'picker') this._renderPicker();
    if (this._phase === 'summary' && this._lastSummary) {
      this._renderSummary(this._lastSummary);
    }
    if (this._phase === 'live' && this._session) {
      this._renderVersePosition();
      this._renderVerseList();
    }
  },

  isSessionActive() {
    return this._phase === 'live' || this._phase === 'setup';
  },

  _showPanel(id) {
    ['reciteUnsupported', 'recitePicker', 'reciteSetup', 'reciteLive', 'reciteSummary'].forEach(
      (p) => {
        const el = document.getElementById(p);
        if (el) el.style.display = p === id ? 'block' : 'none';
      }
    );
  },

  // -------------------------------------------------------------------------
  // Surah picker + confirm modal
  // -------------------------------------------------------------------------

  _renderPicker() {
    const grid = document.getElementById('surahGrid');
    if (!grid) return;
    const lang = this._lang();
    const t = this._t();
    const freestyleCard = `
      <div class="juz-card surah-card freestyle-card" onclick="recitationUI.startFreestyle()">
        <div class="juz-number">🎯</div>
        <div class="surah-card-name">${t.freestyleTitle}</div>
        <div class="surah-card-en">${t.freestyleDesc}</div>
      </div>`;
    grid.innerHTML = freestyleCard + RECITATION_SURAHS.map(
      (s) => `
      <div class="juz-card surah-card" onclick="recitationUI.openConfirm(${s.n})">
        <div class="juz-number">${this._num(s.n)}</div>
        <div class="surah-card-name">${s.name}</div>
        <div class="surah-card-en">${lang === 'ar' ? this._num(s.ayahs) + ' ' + t.ayahs : s.en + ' · ' + s.ayahs + ' ' + t.ayahs}</div>
      </div>`
    ).join('');
  },

  openConfirm(surahNum) {
    const s = RECITATION_SURAHS[surahNum - 1];
    this._confirmSurah = s;
    document.getElementById('reciteConfirmTitle').textContent = s.name;
    document.getElementById('reciteConfirmAyahs').textContent =
      this._lang() === 'ar'
        ? `${s.en} — ${this._num(s.ayahs)} ${this._t().ayahs}`
        : `${s.en} — ${s.ayahs} ${this._t().ayahs}`;
    const from = document.getElementById('reciteFromAyah');
    const to = document.getElementById('reciteToAyah');
    from.value = 1;
    from.max = s.ayahs;
    to.value = s.ayahs;
    to.max = s.ayahs;
    document.getElementById('reciteConfirmModal').classList.add('active');
  },

  closeConfirm() {
    document.getElementById('reciteConfirmModal').classList.remove('active');
  },

  // -------------------------------------------------------------------------
  // Engine (worker + assets), created once and reused across sessions
  // -------------------------------------------------------------------------

  _ensureEngine() {
    if (this._engineReady) return Promise.resolve();
    if (!this._enginePromise) {
      this._enginePromise = this._bootEngine().catch((err) => {
        this._enginePromise = null;
        throw err;
      });
    }
    return this._enginePromise;
  },

  async _bootEngine() {
    const t = this._t();
    this._setProgress(0, 0, t.downloadingAssets);

    const tAssets0 = Date.now();
    const assets = await recitationAssets.loadAll(({ stage, loaded, total }) => {
      const label = stage === 'model' ? this._t().downloadingModel : this._t().downloadingAssets;
      this._setProgress(loaded, total, label);
    });
    this._quranData = assets.quran;
    this._log(`assets ready in ${Date.now() - tAssets0}ms (model ${assets.model.byteLength} bytes)`);

    this._setProgress(1, 1, t.initializing);

    const tInit0 = Date.now();
    this._engineInitStartedAt = tInit0;
    const worker = new Worker(CONFIG.TILAWA.WORKER_PATH, { type: 'module' });
    this._worker = worker;
    worker.onmessage = (e) => this._onWorkerMessage(e.data);
    worker.onerror = (e) => {
      debug.error('tilawa worker error:', e);
      this._engineReady = false;
    };

    await new Promise((resolve, reject) => {
      this._engineResolve = resolve;
      this._engineReject = reject;
      worker.postMessage(
        {
          type: 'init',
          model: assets.model,
          vocab: assets.vocab,
          quranCtcTokens: assets.quranCtcTokens,
          quran: assets.quran,
          config: this.STREAMING_CONFIG,
        },
        [assets.model]
      );
    });
    this._engineReady = true;
  },

  _onWorkerMessage(msg) {
    switch (msg.type) {
      case 'ready':
        this._breadcrumb(`engine ready (ONNX init ${Date.now() - (this._engineInitStartedAt || Date.now())}ms)`);
        if (CONFIG.TILAWA.DEBUG && this._worker) {
          this._worker.postMessage({ type: 'setDebug', enabled: true });
        }
        if (this._engineResolve) {
          this._engineResolve();
          this._engineResolve = null;
          this._engineReject = null;
        }
        break;
      case 'event':
        this._onTilawaEvent(msg.event);
        break;
      case 'diag':
        // tilawa's internal diagnostics firehose (decode windows, tracker
        // transitions, rollbacks) — the ground truth when chasing jitter.
        console.log('%c[tilawa:diag]', 'color:#888', msg.event, msg.data);
        if (typeof recitationDebug !== 'undefined') {
          recitationDebug.push('diag', `${msg.event} ${JSON.stringify(msg.data).slice(0, 160)}`);
        }
        break;
      case 'stats': {
        const s = msg.stats;
        const behind = s.realtimeFactor > 0.9;
        const style = behind || s.queueDepth > 5 ? 'color:#e05c5c;font-weight:bold' : 'color:#888';
        console.log(
          `%c[tilawa:stats] feeds=${s.feeds} avgFeedMs=${s.avgFeedMs} maxFeedMs=${s.maxFeedMs} queueDepth=${s.queueDepth} realtimeFactor=${s.realtimeFactor}${behind ? ' ← INFERENCE NOT KEEPING UP WITH REAL-TIME' : ''}`,
          style
        );
        if (typeof recitationDebug !== 'undefined') {
          recitationDebug.set('inference', `${s.avgFeedMs}ms avg, queue ${s.queueDepth}, rtFactor ${s.realtimeFactor}${behind ? ' ⚠️ BEHIND' : ''}`);
        }
        // Adaptive eco mode: on devices where inference can't keep up
        // (observed rtFactor 2.8 on Safari/macOS), switch to larger chunks
        // and less frequent, smaller decode windows. Applied once per
        // engine lifetime after two consecutive slow readings.
        if (!this._ecoApplied) {
          if (s.realtimeFactor > 1.3) {
            this._slowStatsCount = (this._slowStatsCount || 0) + 1;
            if (this._slowStatsCount >= 2 && this._worker) {
              this._ecoApplied = true;
              this._worker.postMessage({
                type: 'setConfig',
                config: {
                  audioChunkMs: 300,
                  finalSilenceSec: 5,
                  trackingTriggerSec: 0.8,
                  discoveryTriggerSec: 3,
                  trackingMaxWindowSec: 8,
                  discoveryMaxWindowSec: 8,
                },
              });
              this._breadcrumb(`eco mode enabled — inference ${s.realtimeFactor}x slower than real-time on this device`);
              if (typeof recitationDebug !== 'undefined') recitationDebug.set('mode', 'ECO (slow device)');
            }
          } else {
            this._slowStatsCount = 0;
          }
        }
        break;
      }
      case 'stopped':
        this._onWorkerStopped();
        break;
      case 'error':
        debug.error('tilawa:', msg.message);
        if (msg.fatal && this._engineReject) {
          this._engineReject(new Error(msg.message));
          this._engineResolve = null;
          this._engineReject = null;
        }
        break;
      default:
        break;
    }
  },

  _setProgress(loaded, total, label) {
    const bar = document.getElementById('reciteProgressBar');
    const text = document.getElementById('reciteProgressText');
    if (!bar || !text) return;
    if (total > 0) {
      const pct = Math.min(100, Math.round((loaded / total) * 100));
      bar.style.width = pct + '%';
      bar.classList.remove('indeterminate');
      const mb = (n) => (n / (1024 * 1024)).toFixed(1);
      text.textContent = `${label} ${this._num(pct)}% (${mb(loaded)} / ${mb(total)} MB)`;
    } else {
      bar.style.width = '100%';
      bar.classList.add('indeterminate');
      text.textContent = label;
    }
  },

  cancelSetup() {
    // Downloads already in flight will settle into Cache Storage; we just
    // return to the picker and drop the pending session.
    this._pendingStart = null;
    this._phase = 'picker';
    this._showPanel('recitePicker');
  },

  // -------------------------------------------------------------------------
  // Session lifecycle
  // -------------------------------------------------------------------------

  async startSession() {
    const s = this._confirmSurah;
    if (!s) return;
    const from = Math.max(1, Math.min(s.ayahs, parseInt(document.getElementById('reciteFromAyah').value, 10) || 1));
    const to = Math.max(from, Math.min(s.ayahs, parseInt(document.getElementById('reciteToAyah').value, 10) || s.ayahs));
    this.closeConfirm();
    await this._launch({ surah: s.n, from, to });
  },

  /** Freestyle mode: no passage picked — tilawa's discovery identifies the
   *  verse being recited and the coach anchors itself on the fly. */
  async startFreestyle() {
    await this._launch({ freestyle: true });
  },

  async _launch(spec) {
    this._phase = 'setup';
    this._showPanel('reciteSetup');
    this._pendingStart = spec;

    try {
      await this._ensureEngine();
    } catch (err) {
      debug.error('engine boot failed:', err);
      this._showSetupError(this._t().downloadFailed + ' — ' + this._t().engineFailed);
      return;
    }
    if (!this._pendingStart) return; // user cancelled during download

    // Mic start must stay close to a user gesture; on iOS the gesture chain
    // from the Start tap is preserved when the model is already cached.
    try {
      await recitationAudio.start({
        onChunk: (chunk) => {
          if (this._worker && this._phase === 'live') {
            this._worker.postMessage({ type: 'feed', samples: chunk }, [chunk.buffer]);
          }
        },
        onLevel: (rms) => this._updatePulse(rms),
      });
    } catch (err) {
      const t = this._t();
      const msg = err && err.name === 'NotFoundError' ? t.micMissing : t.micDenied;
      this._showSetupError(msg);
      return;
    }

    this._pendingStart = null;
    this._breadcrumb(
      spec.freestyle
        ? 'session started (freestyle — auto-detect)'
        : `session started (surah ${spec.surah}, ayahs ${spec.from}–${spec.to})`,
      `mic: contextRate=${recitationAudio._ctx ? recitationAudio._ctx.sampleRate : '?'}Hz, path=${recitationAudio._stats ? recitationAudio._stats.workletPath : '?'}`
    );
    if (typeof recitationDebug !== 'undefined') {
      recitationDebug.set('session', spec.freestyle ? 'freestyle' : `surah ${spec.surah} (${spec.from}–${spec.to})`);
      recitationDebug.set('mic', `${recitationAudio._ctx ? recitationAudio._ctx.sampleRate : '?'}Hz via ${recitationAudio._stats ? recitationAudio._stats.workletPath : '?'}`);
    }
    this._worker.postMessage({ type: 'reset' });

    if (spec.freestyle) {
      this._session = {
        freestyle: true,
        coach: null, // anchored on the first confident verse_match
        committed: false,
        lastOutOfRange: null,
        startedAtMs: Date.now(),
        cursor: null,
        ended: false,
      };
    } else {
      this._session = Object.assign(
        this._sessionFieldsFor({
          surah: spec.surah,
          ayahStart: spec.from,
          ayahEnd: spec.to,
        }),
        { startedAtMs: Date.now(), cursor: null, ended: false }
      );
      this._sendExpected(this._session);
    }

    this._phase = 'live';
    this._showPanel('reciteLive');
    this._renderLiveInitial();
    this._startElapsedTimer();
    this._startMeterLoop();

    // Per-session diagnostics state.
    this._micLowSeen = false;
    this._trackerResets = 0;
    this._slowStatsCount = 0;

    // Periodic fallback of the wrong-track watchdog: if nothing in-range has
    // been recognized for 20 s (tracker may be silently stuck in a state we
    // can't observe without debug diagnostics), reset it and re-listen.
    this._lastTrackerResetAt = Date.now();
    this._watchdogTimer = setInterval(() => {
      const s = this._session;
      if (!s || s.ended) return;
      const stuck =
        (!s.freestyle && s.coach && s.coach.state === 'awaiting_start') ||
        (s.freestyle && !s.coach);
      if (stuck && Date.now() - this._lastTrackerResetAt > 20000) {
        this._resetTracker('no in-range recognition for 20s');
      }
    }, 5000);
  },

  /** Reset ONLY the tilawa tracker (coach state is ours and stays). */
  _resetTracker(reason, force) {
    if (!force && Date.now() - (this._lastTrackerResetAt || 0) < 8000) return; // cooldown
    this._lastTrackerResetAt = Date.now();
    this._trackerResets = (this._trackerResets || 0) + 1;
    this._breadcrumb(`tracker reset — ${reason}`);
    if (typeof recitationDebug !== 'undefined') recitationDebug.push('ui', `tracker reset: ${reason}`);
    if (this._worker) this._worker.postMessage({ type: 'reset' });
    this._showHint(this._t().relisten, 3000);
  },

  /**
   * 60 fps volume meter driven by the analyser tap — immediate feedback on
   * whether the mic is working, too quiet, or too hot. Also raises gentle
   * hints on sustained problems (throttled so it never nags).
   */
  _startMeterLoop() {
    const fill = document.getElementById('reciteMeterFill');
    if (!fill) return;
    const health = { silentSince: null, lowSince: null, hotCount: 0, hotWindowStart: 0, lastWarnAt: 0 };
    const tick = () => {
      if (!this._session || this._session.ended) {
        fill.style.width = '0%';
        return;
      }
      const level = recitationAudio.getLevel();
      if (level) {
        // Speech RMS lives around 0.02–0.25; sqrt curve gives useful travel.
        const pct = Math.min(100, Math.round(Math.sqrt(Math.min(1, level.rms / 0.35)) * 100));
        fill.style.width = pct + '%';
        fill.className =
          'recite-meter-fill ' +
          (level.peak > 0.95 ? 'level-hot' : pct >= 18 ? 'level-good' : 'level-low');
        this._trackMicHealth(level, health);
        if (typeof recitationDebug !== 'undefined' && (!health.lastPanelAt || Date.now() - health.lastPanelAt > 500)) {
          health.lastPanelAt = Date.now();
          recitationDebug.set('level', `rms=${level.rms.toFixed(4)} peak=${level.peak.toFixed(2)} (${pct}%)`);
          if (recitationAudio._stats) recitationDebug.set('chunks', recitationAudio._stats.chunks);
        }
      }
      this._meterRaf = requestAnimationFrame(tick);
    };
    this._meterRaf = requestAnimationFrame(tick);
  },

  _trackMicHealth(level, health) {
    const now = Date.now();
    const t = this._t();
    const warn = (msg, tag) => {
      if (tag === 'silent' || tag === 'low') this._micLowSeen = true; // for the summary
      if (now - health.lastWarnAt < 10000) return;
      health.lastWarnAt = now;
      this._showHint(msg, 3500);
      this._log(`mic health: ${tag} (rms=${level.rms.toFixed(4)} peak=${level.peak.toFixed(2)})`);
    };

    // Silence/faint-voice feedback only BEFORE the recitation is recognized:
    // once the session is tracking, quiet stretches are legitimate pauses
    // for breath and contemplation and must never draw a warning.
    const notStartedYet = this._session && this._session.cursor === null;

    // Dead silence: no signal at all (mic muted / wrong device).
    if (notStartedYet && level.rms < 0.0015) {
      if (!health.silentSince) health.silentSince = now;
      else if (now - health.silentSince > 4000) warn(t.micSilent, 'silent');
    } else {
      health.silentSince = null;
    }

    // Sustained faint-but-present voice (whispering / mic too far).
    if (notStartedYet && level.rms >= 0.0015 && level.rms < 0.01) {
      if (!health.lowSince) health.lowSince = now;
      else if (now - health.lowSince > 6000) warn(t.micLow, 'low');
    } else {
      health.lowSince = null;
    }

    // Clipping: many near-full-scale peaks in a short window.
    if (level.peak > 0.98) {
      if (now - health.hotWindowStart > 3000) {
        health.hotWindowStart = now;
        health.hotCount = 0;
      }
      if (++health.hotCount > 20) warn(t.micHot, 'hot');
    }
  },

  /** Build the coach + verse lookup fields for a known passage. */
  _sessionFieldsFor(anchor) {
    const verses =
      anchor.verses ||
      this._quranData
        .filter((v) => v.surah === anchor.surah && v.ayah >= anchor.ayahStart && v.ayah <= anchor.ayahEnd)
        .map((v) => ({ ayah: v.ayah, text: v.text_uthmani }));
    return {
      surah: anchor.surah,
      ayahStart: anchor.ayahStart,
      ayahEnd: anchor.ayahEnd,
      surahInfo: RECITATION_SURAHS[anchor.surah - 1],
      verses,
      versesByAyah: Object.fromEntries(verses.map((v) => [v.ayah, v])),
      coach: new RecitationCoach({
        surah: anchor.surah,
        ayahStart: anchor.ayahStart,
        ayahEnd: anchor.ayahEnd,
        verses,
        config: { useWordVerdicts: CONFIG.FEATURES.WORD_VERDICTS },
      }),
    };
  },

  /** Tell the worker what passage to align transcripts against. */
  _sendExpected(s) {
    if (!this._worker || !s || !s.coach) return;
    this._worker.postMessage({
      type: 'setExpected',
      surah: s.surah,
      ayahStart: s.ayahStart,
      ayahEnd: s.ayahEnd,
    });
  },

  /** Anchor (or re-anchor) a freestyle session at a detected verse. */
  _anchorFreestyle(anchor) {
    const s = this._session;
    Object.assign(s, this._sessionFieldsFor(anchor));
    s.cursor = null;
    s.committed = false;
    s.lastOutOfRange = null;
    this._sendExpected(s);
    document.getElementById('reciteSurahTitle').textContent = s.surahInfo.name;
    this._renderVersePosition();
    document.getElementById('reciteVerseList').innerHTML = '';
  },

  _showSetupError(message) {
    const text = document.getElementById('reciteProgressText');
    const bar = document.getElementById('reciteProgressBar');
    if (bar) {
      bar.style.width = '0%';
      bar.classList.remove('indeterminate');
    }
    if (text) {
      text.innerHTML = `⚠️ ${message}<br><button class="btn" style="margin-top:12px" onclick="recitationUI.retrySetup()">${this._t().retry}</button>`;
    }
  },

  retrySetup() {
    if (this._pendingStart) {
      const { surah, from, to } = this._pendingStart;
      const s = RECITATION_SURAHS[surah - 1];
      this._confirmSurah = s;
      document.getElementById('reciteFromAyah').value = from;
      document.getElementById('reciteToAyah').value = to;
      this.startSession();
    } else {
      this._phase = 'picker';
      this._showPanel('recitePicker');
    }
  },

  stopSession() {
    if (!this._session || this._session.ended) return;
    if (this._session.coach) this._session.coach.requestStop();
    this._showHint(this._t().stopping, 0);
    recitationAudio.stop();
    if (this._worker) this._worker.postMessage({ type: 'stop' });
    // Fallback: if the worker never reports back, finalize locally.
    this._stopFallbackTimer = setTimeout(() => this._finishSession(), 15000);
  },

  abandonSession() {
    // Discard without a summary (tab switch / page hide mid-session).
    recitationAudio.stop();
    if (this._worker && this._engineReady) this._worker.postMessage({ type: 'reset' });
    this._clearTimers();
    this._session = null;
    this._phase = 'picker';
    this._showPanel('recitePicker');
  },

  _onWorkerStopped() {
    // Stop-flush is done; if no final_sequence arrived, finalize directly.
    this._finishSession();
  },

  _finishSession() {
    if (!this._session || this._session.ended) return;
    if (!this._session.coach) {
      // Freestyle session stopped before any recitation was recognized.
      this._applyEffects([{ type: 'completed', summary: { started: false } }]);
      return;
    }
    this._applyEffects([this._session.coach.finalize()]);
  },

  _clearTimers() {
    if (this._elapsedTimer) clearInterval(this._elapsedTimer);
    if (this._hintTimer) clearTimeout(this._hintTimer);
    if (this._stopFallbackTimer) clearTimeout(this._stopFallbackTimer);
    if (this._awaitTimer) clearTimeout(this._awaitTimer);
    if (this._meterRaf) cancelAnimationFrame(this._meterRaf);
    if (this._watchdogTimer) clearInterval(this._watchdogTimer);
    this._elapsedTimer = this._hintTimer = this._stopFallbackTimer = this._awaitTimer = this._meterRaf = this._watchdogTimer = null;
  },

  // -------------------------------------------------------------------------
  // Tilawa events → coach → DOM
  // -------------------------------------------------------------------------

  _onTilawaEvent(event) {
    const s = this._session;
    if (!s || s.ended) return;

    // Wrong-track watchdog: the tilawa tracker doesn't know which passage
    // we expect, and pre-recitation noise can lock it onto a random verse —
    // after which it BLOCKS "non-continuation" jumps to the real recitation
    // (seen in the field: tracker stuck on 87:x while decoding Fatiha 1:5
    // at 0.98 confidence). While the session hasn't started, confident
    // matches OUTSIDE the expected passage mean the tracker is lost: reset
    // it so discovery can re-run against the actual recitation.
    if (
      !s.freestyle &&
      s.coach &&
      s.coach.state === 'awaiting_start' &&
      event.type === 'verse_match' &&
      (event.confidence || 0) >= 0.55 &&
      !s.coach.inRange(event.surah, event.ayah)
    ) {
      s.offRangeCount = (s.offRangeCount || 0) + 1;
      if (s.offRangeCount >= 2) {
        s.offRangeCount = 0;
        this._resetTracker(`locked on ${event.surah}:${event.ayah} outside expected passage`);
      }
    }

    if (s.freestyle && !s.coach) {
      // Un-anchored freestyle session: wait for tilawa's discovery to
      // identify what is being recited, then anchor the coach there.
      const anchor = RecitationCoach.anchorFromEvent(event, this._quranData);
      if (!anchor) return;
      this._anchorFreestyle(anchor);
      this._showHint(this._t().anchored(s.surahInfo.name), 3500);
      // fall through: the anchoring event also starts the coach
    } else if (
      s.freestyle &&
      s.coach &&
      !s.committed &&
      event.type === 'verse_match' &&
      (event.confidence || 0) >= 0.55 &&
      !s.coach.inRange(event.surah, event.ayah)
    ) {
      // Remember confident out-of-range matches: if the initial anchor was
      // wrong (e.g. an identical opening phrase), the off-track effect
      // below re-anchors to where the reciter actually is.
      s.lastOutOfRange = event;
    }

    const effects = s.coach.handleEvent(event);
    if (CONFIG.TILAWA.DEBUG) {
      const brief =
        event.type === 'verse_match'
          ? `verse_match ${event.surah}:${event.ayah} conf=${event.confidence}`
          : event.type === 'word_progress'
            ? `word_progress ${event.surah}:${event.ayah} idx=${event.word_index}/${event.total_words} matched=[${event.matched_indices}]`
            : event.type === 'verse_candidate'
              ? `verse_candidate${event.stable ? ' STABLE' : ''} [${(event.candidates || [])
                  .slice(0, 3)
                  .map((c) => `${c.surah}:${c.ayah}${c.ayah_end ? '-' + c.ayah_end : ''}@${c.confidence}`)
                  .join(', ')}]`
              : event.type === 'word_verdicts'
                ? `word_verdicts [${(event.verdicts || [])
                    .map((v) => `${v.ayah}.${v.index}:${v.status[0]}`)
                    .join(',')}]`
                : event.type;
      this._log(
        `event: ${brief} → coach[cursor=${s.coach.cursor} state=${s.coach.state}]:`,
        effects.length ? effects.map((e) => e.type).join(', ') : '(no effect)'
      );
      if (typeof recitationDebug !== 'undefined') {
        recitationDebug.set('coach', `state=${s.coach.state} cursor=${s.coach.cursor}`);
      }
    }
    this._applyEffects(effects);
  },

  _applyEffects(effects) {
    for (const fx of effects || []) {
      switch (fx.type) {
        case 'started': {
          this._breadcrumb(`recitation recognized — started at ayah ${fx.ayah}`);
          this._showHint(this._t().listening, 2500);
          // If the tracker had locked onto an out-of-range verse before the
          // session started (candidate-based start), break its anchor now
          // so it re-discovers and locks onto the actual passage.
          const s = this._session;
          if (s && (s.offRangeCount || 0) > 0) {
            s.offRangeCount = 0;
            this._resetTracker('tracker was off-passage at session start', true);
          }
          break;
        }
        case 'verse-active':
          this._session.cursor = fx.ayah;
          if (this._worker) this._worker.postMessage({ type: 'cursor', ayah: fx.ayah });
          this._renderCurrentVerse();
          this._renderVersePosition();
          this._renderVerseList();
          break;
        case 'word-progress':
          if (fx.ayah === this._session.cursor) {
            this._highlightWords(fx.matched);
          }
          break;
        case 'verse-committed':
          this._session.committed = true;
          this._renderVerseList();
          break;
        case 'verses-skipped':
          this._renderVerseList();
          break;
        case 'repetition':
          this._showHint(this._t().repetition, 2500);
          this._renderVerseList();
          break;
        case 'checkpoint':
          this._showHint(this._t().checkpoint, 4000);
          break;
        case 'off-track': {
          const s = this._session;
          if (s.freestyle && !s.committed && s.lastOutOfRange) {
            // The first anchor never took hold and the reciter is
            // consistently somewhere else — move the coach there.
            const detected = s.lastOutOfRange; // _anchorFreestyle clears it
            const anchor = RecitationCoach.anchorFromEvent(detected, this._quranData);
            if (anchor) {
              this._anchorFreestyle(anchor);
              this._showHint(this._t().anchored(s.surahInfo.name), 3500);
              this._applyEffects(s.coach.handleEvent(detected));
              break;
            }
          }
          this._showHint(this._t().offTrack, 4000);
          break;
        }
        case 'completed':
          this._breadcrumb(
            `session ended — score ${fx.summary.score}, done ${fx.summary.versesDone ? fx.summary.versesDone.length : 0}, ` +
              `skipped ${fx.summary.versesSkipped ? fx.summary.versesSkipped.length : 0}`
          );
          this._session.ended = true;
          this._clearTimers();
          recitationAudio.stop();
          this._lastSummary = fx.summary;
          this._phase = 'summary';
          this._renderSummary(fx.summary);
          this._showPanel('reciteSummary');
          break;
        default:
          break;
      }
    }
  },

  // -------------------------------------------------------------------------
  // Live view rendering
  // -------------------------------------------------------------------------

  _renderLiveInitial() {
    const s = this._session;
    document.getElementById('reciteSurahTitle').textContent = s.freestyle && !s.coach
      ? this._t().freestyleTitle
      : s.surahInfo.name;
    document.getElementById('reciteVerseText').innerHTML = '';
    document.getElementById('reciteVerseList').innerHTML = '';
    this._renderVersePosition();
    this._showHint(s.freestyle ? this._t().freestyleListening : this._t().awaitingStart, 0);
    // Gentle nudge if nothing is heard for a while (not an error).
    this._awaitTimer = setTimeout(() => {
      if (this._session && !this._session.ended && this._session.cursor === null) {
        this._showHint(this._t().stillListening, 0);
      }
    }, 60000);
  },

  _renderVersePosition() {
    const s = this._session;
    if (!s) return;
    const el = document.getElementById('reciteVersePos');
    if (!el) return;
    if (!s.coach) {
      el.textContent = '';
    } else if (s.cursor === null) {
      el.textContent = `${this._t().range}: ${this._num(s.ayahStart)}–${this._num(s.ayahEnd)}`;
    } else {
      el.textContent = this._t().verseOf(this._num(s.cursor), this._num(s.ayahEnd));
    }
  },

  _renderCurrentVerse() {
    const s = this._session;
    const verse = s.versesByAyah[s.cursor];
    if (!verse) return;
    const tokens = RecitationCoach.splitDisplayTokens(verse.text);
    document.getElementById('reciteVerseText').innerHTML = tokens
      .map((tok) =>
        tok.isWord
          ? `<span class="word" data-w="${tok.wordIndex}">${tok.text}</span>`
          : `<span class="waqf-mark">${tok.text}</span>`
      )
      .join(' ');
    // Re-apply any coverage the coach already has (e.g. after a jump-back).
    const covered = s.coach.coveredIndices(s.cursor);
    if (covered.length) this._highlightWords(covered);
  },

  _highlightWords(indices) {
    const container = document.getElementById('reciteVerseText');
    if (!container) return;
    for (const i of indices) {
      const el = container.querySelector(`.word[data-w="${i}"]`);
      if (el) el.classList.add('word-matched');
    }
  },

  _renderVerseList() {
    const s = this._session;
    if (!s || !s.coach) return;
    const t = this._t();
    const items = [];
    for (const v of s.verses) {
      if (v.ayah === s.cursor) continue;
      const st = s.coach.perVerse[v.ayah];
      if (st.status === 'pending') continue;
      let chip = '';
      if (st.status === 'done') chip = `<span class="recite-chip chip-done">✓ ${t.chipDone}</span>`;
      else if (st.status === 'skipped') chip = `<span class="recite-chip chip-skipped">↷ ${t.chipSkipped}</span>`;
      if (st.repeats > 0) chip += ` <span class="recite-chip chip-repeat">↻ ${t.chipRepeated(this._num(st.repeats))}</span>`;
      if (!chip) continue;
      items.push(
        `<div class="recite-verse-item"><span class="recite-verse-num">${this._num(v.ayah)}</span> ${chip}</div>`
      );
    }
    document.getElementById('reciteVerseList').innerHTML = items.join('');
  },

  _showHint(text, autoHideMs) {
    const el = document.getElementById('reciteHint');
    if (!el) return;
    if (this._hintTimer) clearTimeout(this._hintTimer);
    el.textContent = text || '';
    el.classList.toggle('visible', !!text);
    if (text && autoHideMs > 0) {
      this._hintTimer = setTimeout(() => el.classList.remove('visible'), autoHideMs);
    }
  },

  _updatePulse(rms) {
    const el = document.getElementById('recitePulse');
    if (!el) return;
    // Map RMS (~0..0.3 speech) to a visible scale so the user sees the coach
    // "hearing" them; near-silence keeps a slow idle pulse via CSS.
    const level = Math.min(1, rms * 8);
    el.style.transform = `scale(${1 + level * 0.9})`;
    el.classList.toggle('speaking', level > 0.12);
  },

  _startElapsedTimer() {
    const el = document.getElementById('reciteElapsed');
    this._elapsedTimer = setInterval(() => {
      if (!this._session) return;
      const sec = Math.floor((Date.now() - this._session.startedAtMs) / 1000);
      const m = Math.floor(sec / 60);
      const ss = String(sec % 60).padStart(2, '0');
      if (el) el.textContent = `${this._num(m)}:${this._lang() === 'ar' ? convertToArabicNumerals(ss) : ss}`;
      // Session cap: 30 minutes (battery/memory guard).
      if (sec >= 1800) this.stopSession();
    }, 1000);
  },

  // -------------------------------------------------------------------------
  // Summary rendering
  // -------------------------------------------------------------------------

  _renderSummary(sum) {
    const t = this._t();
    const panel = document.getElementById('reciteSummary');
    if (!panel) return;
    const s = this._session;
    const surahInfo = RECITATION_SURAHS[sum.surah - 1];

    if (!sum.started) {
      // Say WHY nothing was recognized, using what the session observed.
      const hints = [];
      if (this._micLowSeen) hints.push(t.summaryMicHint);
      if (((s && s.offRangeCount) || 0) + (this._trackerResets || 0) > 0 && !this._micLowSeen) {
        hints.push(t.summaryHeardOther);
      }
      panel.innerHTML = `
        <div class="empty-state"><p>${t.neverStarted}</p>${hints.map((h) => `<p class="recite-note">${h}</p>`).join('')}</div>
        <div class="button-group recite-summary-actions">
          <button class="btn" onclick="recitationUI.retrySameRange()">${t.btnRetry}</button>
          <button class="btn btn-secondary" onclick="recitationUI.backToPicker()">${t.btnNew}</button>
        </div>`;
      return;
    }

    const missedCount = Object.values(sum.missedWords).reduce((a, m) => a + m.length, 0);
    const repeatCount = Object.values(sum.repeats).reduce((a, n) => a + n, 0);
    const ring = 339.292;
    const offset = ring * (1 - sum.score / 100);
    const durM = Math.floor(sum.durationSec / 60);
    const durS = sum.durationSec % 60;

    let mistakes = '';
    const versesByAyah = s ? s.versesByAyah : null;
    if (Object.keys(sum.missedWords).length && versesByAyah) {
      const rows = Object.keys(sum.missedWords)
        .map((ayah) => {
          const verse = versesByAyah[ayah];
          if (!verse) return '';
          const missed = new Set(sum.missedWords[ayah]);
          const tokens = RecitationCoach.splitDisplayTokens(verse.text);
          const html = tokens
            .map((tok) =>
              tok.isWord
                ? `<span class="word${missed.has(tok.wordIndex) ? ' word-missed' : ''}">${tok.text}</span>`
                : `<span class="waqf-mark">${tok.text}</span>`
            )
            .join(' ');
          return `<div class="recite-mistake-verse"><span class="recite-verse-num">${this._num(Number(ayah))}</span><div class="verse-text-sm" dir="rtl">${html}</div></div>`;
        })
        .join('');
      mistakes += `<h4 class="recite-section-title">${t.missedTitle}</h4>${rows}`;
    }
    const subsByAyah = sum.substitutedWords || {};
    if (Object.keys(subsByAyah).length) {
      const rows = Object.keys(subsByAyah)
        .map((ayah) =>
          subsByAyah[ayah]
            .map(
              (sub) =>
                `<div class="recite-mistake-verse"><span class="recite-verse-num">${this._num(Number(ayah))}</span><div>${t.heardInstead(sub.heard || '؟', sub.expected)}</div></div>`
            )
            .join('')
        )
        .join('');
      mistakes += `<h4 class="recite-section-title">${t.substitutedTitle}</h4>${rows}`;
    }
    if (sum.versesSkipped.length && versesByAyah) {
      const rows = sum.versesSkipped
        .map((ayah) => {
          const verse = versesByAyah[ayah];
          return verse
            ? `<div class="recite-mistake-verse"><span class="recite-verse-num">${this._num(ayah)}</span><div class="verse-text-sm" dir="rtl">${verse.text}</div></div>`
            : '';
        })
        .join('');
      mistakes += `<h4 class="recite-section-title">${t.skippedTitle}</h4>${rows}`;
    }
    if (!mistakes) {
      mistakes = `<p class="recite-no-mistakes">${t.noMistakes}</p>`;
    }
    if (sum.versesNotReached.length) {
      mistakes += `<p class="recite-note">${t.notReachedNote(this._num(sum.versesNotReached.length))}</p>`;
    }
    if (repeatCount > 0) {
      mistakes += `<p class="recite-note">↻ ${t.repeatsNote}</p>`;
    }

    panel.innerHTML = `
      <h2 style="color: var(--gold); margin-bottom: 6px;">${t.summaryTitle}</h2>
      <p style="color: var(--sage); margin-bottom: 20px;">${surahInfo.name} — ${t.range} ${this._num(sum.ayahStart)}–${this._num(sum.ayahEnd)} · ${t.duration}: ${this._num(durM)}${t.minutes} ${this._num(durS)}${t.seconds}</p>
      <div class="recite-summary-grid">
        <div class="stat-card">
          <svg class="progress-ring" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(212, 175, 55, 0.2)" stroke-width="8"/>
            <circle cx="60" cy="60" r="54" fill="none" stroke="var(--gold)" stroke-width="8"
                    stroke-linecap="round" stroke-dasharray="${ring}" stroke-dashoffset="${offset}"
                    class="progress-ring-circle"/>
            <text x="60" y="60" text-anchor="middle" dy=".3em" fill="var(--gold)" font-size="26" font-weight="700">${this._num(sum.score)}</text>
          </svg>
          <div class="stat-label">${t.scoreLabel}</div>
        </div>
        <div class="stat-card"><div class="stat-value">${this._num(sum.versesDone.length)}</div><div class="stat-label">${t.statDone}</div></div>
        <div class="stat-card"><div class="stat-value">${this._num(sum.versesSkipped.length)}</div><div class="stat-label">${t.statSkipped}</div></div>
        <div class="stat-card"><div class="stat-value">${this._num(missedCount)}</div><div class="stat-label">${t.statMissed}</div></div>
        <div class="stat-card"><div class="stat-value">${this._num(repeatCount)}</div><div class="stat-label">${t.statRepeats}</div></div>
      </div>
      <div class="recite-mistakes">${mistakes}</div>
      <div class="button-group recite-summary-actions">
        <button class="btn" onclick="recitationUI.retrySameRange()">${t.btnRetry}</button>
        <button class="btn btn-secondary" onclick="recitationUI.backToPicker()">${t.btnNew}</button>
      </div>`;
  },

  retrySameRange() {
    const sum = this._lastSummary;
    this._session = null;
    this._lastSummary = null;
    if (!sum) return this.backToPicker();
    const s = RECITATION_SURAHS[sum.surah - 1];
    this._confirmSurah = s;
    this.openConfirm(sum.surah);
    document.getElementById('reciteFromAyah').value = sum.ayahStart;
    document.getElementById('reciteToAyah').value = sum.ayahEnd;
  },

  backToPicker() {
    this._session = null;
    this._lastSummary = null;
    this._phase = 'picker';
    this._renderPicker();
    this._showPanel('recitePicker');
  },
};

// Hide the tab button entirely when the feature is off or unsupported.
document.addEventListener('DOMContentLoaded', () => {
  console.info(
    `[recite] module loaded — build ${CONFIG.TILAWA.BUILD}, app v${CONFIG.VERSION}, ` +
      `debug=${CONFIG.TILAWA.DEBUG ? 'ON (panel + verbose logs)' : 'off — enable with ?debug=1 or 7 taps on the Recite title'}`
  );
  const tabBtn = document.getElementById('tabRecite');
  if (tabBtn && (!CONFIG.FEATURES.RECITATION || !recitationAssets.isSupported())) {
    tabBtn.style.display = 'none';
  }
  if (typeof recitationDebug !== 'undefined') {
    recitationDebug.init();
    const title = document.getElementById('reciteTitle');
    if (title) title.addEventListener('click', () => recitationDebug.handleTitleTap());
  }
});
