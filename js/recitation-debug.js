/**
 * On-screen debug panel for the Recitation feature — visibility without
 * devtools (phones, locked-down work machines). Active only when
 * CONFIG.TILAWA.DEBUG is on (?debug=1 once, #debug, or 7 taps on the
 * Recite tab title). Collects live pipeline state + a rolling event log and
 * can copy a full JSON debug report to the clipboard.
 *
 * NOTE for anyone reading Render server logs: recitation produces NO server
 * traffic by design — mic audio, inference, and coaching all run on-device.
 * The only server-side event that exists is the one-time model download
 * (logged by backend/src/routes/tilawa.js).
 */

const recitationDebug = {
  // Field lesson (build 2026-07-20e): a real 150s session generates
  // hundreds of diag/ui lines, so a 50-entry rolling log discarded the
  // exact moment a verse got skipped before the report could be copied.
  // Raised generously — plain text, cheap to hold even at this size.
  MAX_LOG: 1000,
  _log: [],
  // Separate, coarser trail of only the COACH's decisions (started,
  // verse-committed, verses-skipped, repetition, off-track, completed) —
  // there are at most a few dozen of these even in a long session, so this
  // never needs to evict anything and always survives to the report,
  // giving an at-a-glance decision timeline without wading through the
  // much noisier per-chunk diag stream.
  MAX_MILESTONES: 300,
  _milestones: [],
  _live: {},
  _el: null,
  _bodyEl: null,
  _collapsed: false,
  _renderQueued: false,
  _titleTaps: [],

  enabled() {
    try {
      return !!CONFIG.TILAWA.DEBUG;
    } catch (e) {
      return false;
    }
  },

  /** Rolling event log. kind: audio|ui|event|effect|diag|stats|error */
  push(kind, text) {
    if (!this.enabled()) return;
    this._log.push({
      t: new Date().toISOString().slice(11, 23),
      kind,
      text: String(text),
    });
    if (this._log.length > this.MAX_LOG) this._log.shift();
    this._queueRender();
  },

  /** Coarse, high-priority trail of coach DECISIONS — always survives to
   *  the report even when the noisy diag/ui log has scrolled past it. */
  milestone(text) {
    if (!this.enabled()) return;
    this._milestones.push({
      t: new Date().toISOString().slice(11, 23),
      text: String(text),
    });
    if (this._milestones.length > this.MAX_MILESTONES) this._milestones.shift();
    this._queueRender();
  },

  /** Live key/value status shown at the top of the panel. */
  set(key, value) {
    if (!this.enabled()) return;
    this._live[key] = value;
    this._queueRender();
  },

  init() {
    if (!this.enabled() || this._el) return;
    const el = document.createElement('div');
    el.id = 'reciteDebugPanel';
    el.innerHTML = `
      <div class="rdbg-header">
        <span>🔧 recite debug — build ${CONFIG.TILAWA.BUILD}</span>
        <span>
          <button class="rdbg-btn" id="rdbgCopy">📋 copy report</button>
          <button class="rdbg-btn" id="rdbgToggle">▾</button>
        </span>
      </div>
      <div class="rdbg-body" id="rdbgBody">
        <div class="rdbg-live" id="rdbgLive"></div>
        <div class="rdbg-milestones" id="rdbgMilestones"></div>
        <div class="rdbg-log" id="rdbgLog"></div>
      </div>`;
    document.body.appendChild(el);
    this._el = el;
    this._bodyEl = el.querySelector('#rdbgBody');
    el.querySelector('#rdbgToggle').onclick = () => {
      this._collapsed = !this._collapsed;
      this._bodyEl.style.display = this._collapsed ? 'none' : 'block';
      el.querySelector('#rdbgToggle').textContent = this._collapsed ? '▸' : '▾';
    };
    el.querySelector('#rdbgCopy').onclick = () => this.copyReport();
    this.set('build', CONFIG.TILAWA.BUILD);
    this.set('note', 'no server logs during recitation — pipeline is 100% on-device');
  },

  _queueRender() {
    if (this._renderQueued || !this._el) return;
    this._renderQueued = true;
    requestAnimationFrame(() => {
      this._renderQueued = false;
      this._render();
    });
  },

  _render() {
    if (!this._el || this._collapsed) return;
    const liveEl = this._el.querySelector('#rdbgLive');
    const milestonesEl = this._el.querySelector('#rdbgMilestones');
    const logEl = this._el.querySelector('#rdbgLog');
    liveEl.innerHTML = Object.entries(this._live)
      .map(
        ([k, v]) =>
          `<div><span class="rdbg-k">${k}</span> ${typeof v === 'object' ? JSON.stringify(v) : v}</div>`
      )
      .join('');
    if (milestonesEl) {
      milestonesEl.innerHTML = this._milestones
        .map((e) => `<div class="rdbg-milestone">${e.t} ★ ${e.text}</div>`)
        .join('');
    }
    logEl.innerHTML = this._log
      .map((e) => `<div class="rdbg-${e.kind}">${e.t} [${e.kind}] ${e.text}</div>`)
      .join('');
    logEl.scrollTop = logEl.scrollHeight;
  },

  buildReport() {
    let audioState = {};
    try {
      audioState = {
        active: recitationAudio.isActive(),
        contextSampleRate: recitationAudio._ctx ? recitationAudio._ctx.sampleRate : null,
        capturePath: recitationAudio._stats ? recitationAudio._stats.workletPath : null,
        chunks: recitationAudio._stats ? recitationAudio._stats.chunks : null,
      };
    } catch (e) { audioState = { error: String(e) }; }
    let coachState = {};
    try {
      const s = recitationUI._session;
      coachState = s && s.coach
        ? {
            phase: recitationUI._phase,
            freestyle: !!s.freestyle,
            surah: s.surah,
            range: [s.ayahStart, s.ayahEnd],
            cursor: s.coach.cursor,
            state: s.coach.state,
          }
        : { phase: recitationUI._phase };
    } catch (e) { coachState = { error: String(e) }; }

    // The finalize() summary — score, versesDone/Skipped/NotReached,
    // missedWords — is the actual verdict the user saw on screen. Without
    // it, confirming a session's correctness from the report alone means
    // manually replaying the event log by hand; with it, the report is
    // self-contained.
    let lastSummary = null;
    try {
      lastSummary = recitationUI._lastSummary || null;
    } catch (e) { /* recitationUI not defined */ }

    return JSON.stringify(
      {
        build: CONFIG.TILAWA.BUILD,
        // The worker's own echoed build stamp (see js/recitation.js 'ready'
        // handler) — must match `build` above. A mismatch, or "(none —
        // stale worker)", means the browser ran an OLD cached
        // js/vendor/tilawa-worker.js despite the page reporting the latest
        // build; every tracker-side fix since that cached version is silently
        // not running. See tilawa-build/README.md.
        workerBuild: this._live.workerBuild || null,
        appVersion: CONFIG.VERSION,
        when: new Date().toISOString(),
        userAgent: navigator.userAgent,
        hardwareConcurrency: navigator.hardwareConcurrency,
        origin: window.location.origin,
        audio: audioState,
        coach: coachState,
        summary: lastSummary,
        live: this._live,
        milestones: this._milestones,
        log: this._log,
      },
      null,
      2
    );
  },

  async copyReport() {
    const report = this.buildReport();
    try {
      await navigator.clipboard.writeText(report);
      if (typeof ui !== 'undefined') ui.showSuccess('Debug report copied', false);
    } catch (e) {
      // Clipboard blocked (permissions) — show it for manual copy.
      window.prompt('Copy the debug report:', report);
    }
  },

  /** 7 taps on the Recite tab title toggles debug mode persistently. */
  handleTitleTap() {
    const now = Date.now();
    this._titleTaps = this._titleTaps.filter((t) => now - t < 3000);
    this._titleTaps.push(now);
    if (this._titleTaps.length >= 7) {
      this._titleTaps = [];
      try {
        const on = localStorage.getItem('hafiz_recite_debug') === '1';
        if (on) localStorage.removeItem('hafiz_recite_debug');
        else localStorage.setItem('hafiz_recite_debug', '1');
        window.location.reload();
      } catch (e) { /* storage unavailable */ }
    }
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = recitationDebug;
}
