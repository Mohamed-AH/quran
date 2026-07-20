/**
 * Microphone capture for the Recitation (تلاوة) feature.
 *
 * getUserMedia → AudioWorklet (ScriptProcessor fallback) → linear resample to
 * 16 kHz mono → fixed 200 ms Float32Array chunks (3200 samples) handed to
 * onChunk. Also reports an RMS level per chunk for the "listening" pulse.
 *
 * Usage:
 *   await recitationAudio.start({ onChunk, onLevel });
 *   ...
 *   recitationAudio.stop();
 *
 * IMPORTANT: start() must be called from a user-gesture handler — iOS Safari
 * only allows AudioContext creation/resume inside a tap.
 */

const recitationAudio = {
  TARGET_RATE: 16000,
  CHUNK_SAMPLES: 3200, // 200 ms @ 16 kHz — within tilawa's 150–300 ms guidance

  _ctx: null,
  _stream: null,
  _sourceNode: null,
  _captureNode: null,
  _analyser: null,
  _analyserBuf: null,
  _active: false,
  _stats: null,

  // Debug logging, enabled via ?debug=1 / localStorage hafiz_recite_debug=1
  // (CONFIG.TILAWA.DEBUG). Safe no-op outside the browser (node tests).
  _log(...args) {
    try {
      if (CONFIG.TILAWA.DEBUG) console.log('%c[recite:audio]', 'color:#8ba888', ...args);
    } catch (e) { /* CONFIG not defined (node) */ }
  },

  // Resampler state carried across audio blocks (avoids seams).
  _resamplePos: 0,
  _lastSample: 0,
  _pending: null,
  _pendingLen: 0,

  isActive() {
    return this._active;
  },

  async start({ onChunk, onLevel } = {}) {
    if (this._active) this.stop();

    let stream;
    const preferred = {
      audio: {
        channelCount: 1,
        // Match the tilawa reference demo (web/frontend/src/main.ts):
        // echo cancellation + noise suppression ON. The model and its
        // silence-RMS thresholds are tuned against this processed input;
        // a raw mic signal carries a noise floor that can defeat silence
        // detection and make decode windows flush late and bursty.
        echoCancellation: true,
        noiseSuppression: true,
        // Explicit AGC: field debugging (Safari/macOS) showed sessions with
        // peak levels of 0.02 — far too faint for reliable decoding.
        autoGainControl: true,
      },
    };
    try {
      stream = await navigator.mediaDevices.getUserMedia(preferred);
    } catch (err) {
      if (err && (err.name === 'OverconstrainedError' || err.name === 'TypeError')) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } else {
        throw err; // NotAllowedError / NotFoundError handled by caller
      }
    }

    // Never assume 16 kHz is honored — Safari ignores the sampleRate hint.
    let ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: this.TARGET_RATE,
      });
    } catch (err) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctx.state === 'suspended') {
      await ctx.resume(); // must happen inside the same user gesture
    }

    this._ctx = ctx;
    this._stream = stream;
    this._resamplePos = 0;
    this._lastSample = 0;
    this._pending = new Float32Array(this.CHUNK_SAMPLES * 4);
    this._pendingLen = 0;
    this._onChunk = onChunk || null;
    this._onLevel = onLevel || null;

    const source = ctx.createMediaStreamSource(stream);
    this._sourceNode = source;

    // Analyser tap for the volume meter: read on demand (rAF in the UI)
    // for smooth 60 fps metering, independent of the 200 ms chunk cadence.
    try {
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      this._analyser = analyser;
      this._analyserBuf = new Float32Array(analyser.fftSize);
    } catch (err) {
      this._analyser = null;
      debug.warn('analyser unavailable:', err);
    }

    this._stats = {
      startedAt: Date.now(),
      lastLogAt: Date.now(),
      blocks: 0,
      chunks: 0,
      rmsSum: 0,
      workletPath: null,
    };
    this._log('mic started', {
      contextSampleRate: ctx.sampleRate,
      needsResample: ctx.sampleRate !== this.TARGET_RATE,
      trackSettings: stream.getAudioTracks()[0] && stream.getAudioTracks()[0].getSettings
        ? stream.getAudioTracks()[0].getSettings()
        : 'n/a',
    });

    if (ctx.audioWorklet && typeof ctx.audioWorklet.addModule === 'function') {
      await ctx.audioWorklet.addModule('js/recitation-audio-processor.js');
      const node = new AudioWorkletNode(ctx, 'recitation-capture', {
        numberOfInputs: 1,
        numberOfOutputs: 0,
        channelCount: 1,
      });
      node.port.onmessage = (e) => this._handleBlock(e.data);
      source.connect(node);
      this._captureNode = node;
      this._stats.workletPath = 'AudioWorklet';
    } else {
      // Legacy fallback (very old Safari): deprecated but functional.
      const node = ctx.createScriptProcessor(4096, 1, 1);
      node.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const copy = new Float32Array(input.length);
        copy.set(input);
        this._handleBlock(copy);
      };
      source.connect(node);
      // ScriptProcessor only fires when connected to the graph output;
      // route through a zero-gain node so nothing is audible.
      const mute = ctx.createGain();
      mute.gain.value = 0;
      node.connect(mute);
      mute.connect(ctx.destination);
      this._captureNode = node;
      this._stats.workletPath = 'ScriptProcessor (fallback)';
    }
    this._log('capture path:', this._stats.workletPath);

    this._active = true;
    return { sampleRate: ctx.sampleRate };
  },

  /**
   * Instantaneous input level from the analyser tap (for the volume meter).
   * Returns { rms, peak } in [0..1], or null when inactive. Poll with
   * requestAnimationFrame for smooth metering.
   */
  getLevel() {
    if (!this._active || !this._analyser) return null;
    this._analyser.getFloatTimeDomainData(this._analyserBuf);
    let sum = 0;
    let peak = 0;
    for (let i = 0; i < this._analyserBuf.length; i++) {
      const v = this._analyserBuf[i];
      sum += v * v;
      const a = v < 0 ? -v : v;
      if (a > peak) peak = a;
    }
    return { rms: Math.sqrt(sum / this._analyserBuf.length), peak };
  },

  stop() {
    this._active = false;
    try {
      if (this._captureNode) {
        if (this._captureNode.port) this._captureNode.port.onmessage = null;
        this._captureNode.disconnect();
      }
      if (this._analyser) this._analyser.disconnect();
      if (this._sourceNode) this._sourceNode.disconnect();
      if (this._stream) this._stream.getTracks().forEach((t) => t.stop());
      if (this._ctx && this._ctx.state !== 'closed') this._ctx.close();
    } catch (err) {
      debug.warn('audio teardown:', err);
    }
    // Flush the residual partial chunk (zero-padded) so the tail of the
    // recitation isn't lost.
    if (this._pendingLen > 0 && this._onChunk) {
      const tail = new Float32Array(this.CHUNK_SAMPLES);
      tail.set(this._pending.subarray(0, this._pendingLen));
      this._pendingLen = 0;
      this._onChunk(tail);
    }
    this._captureNode = null;
    this._sourceNode = null;
    this._analyser = null;
    this._stream = null;
    this._ctx = null;
  },

  _handleBlock(block) {
    if (!this._active || !block || block.length === 0) return;
    const inRate = this._ctx ? this._ctx.sampleRate : this.TARGET_RATE;
    const resampled =
      inRate === this.TARGET_RATE ? block : this._resample(block, inRate);
    this._append(resampled);
  },

  /**
   * Streaming linear-interpolation downsampler. Keeps a fractional read
   * position and the previous block's last sample so chunk boundaries are
   * seamless.
   */
  _resample(block, inRate) {
    const ratio = inRate / this.TARGET_RATE;
    const out = [];
    let pos = this._resamplePos;
    while (pos < block.length) {
      const i = Math.floor(pos);
      const frac = pos - i;
      const prev = i === 0 ? this._lastSample : block[i - 1];
      const curr = block[Math.min(i, block.length - 1)];
      // interpolate between the sample before pos and the one at pos
      out.push(prev + (curr - prev) * frac);
      pos += ratio;
    }
    this._resamplePos = pos - block.length;
    this._lastSample = block[block.length - 1];
    return Float32Array.from(out);
  },

  _append(samples) {
    // Grow the pending buffer if needed.
    if (this._pendingLen + samples.length > this._pending.length) {
      const grown = new Float32Array((this._pendingLen + samples.length) * 2);
      grown.set(this._pending.subarray(0, this._pendingLen));
      this._pending = grown;
    }
    this._pending.set(samples, this._pendingLen);
    this._pendingLen += samples.length;

    while (this._pendingLen >= this.CHUNK_SAMPLES) {
      const chunk = this._pending.slice(0, this.CHUNK_SAMPLES);
      this._pending.copyWithin(0, this.CHUNK_SAMPLES, this._pendingLen);
      this._pendingLen -= this.CHUNK_SAMPLES;

      let sum = 0;
      for (let i = 0; i < chunk.length; i++) sum += chunk[i] * chunk[i];
      const rms = Math.sqrt(sum / chunk.length);
      if (this._onLevel) this._onLevel(rms);
      if (this._onChunk) this._onChunk(chunk);

      if (this._stats) {
        this._stats.chunks++;
        this._stats.rmsSum += rms;
        const now = Date.now();
        if (now - this._stats.lastLogAt >= 5000) {
          const elapsed = (now - this._stats.startedAt) / 1000;
          const expectedChunks = Math.floor(
            (elapsed * this.TARGET_RATE) / this.CHUNK_SAMPLES
          );
          this._log(
            `cadence: ${this._stats.chunks} chunks in ${elapsed.toFixed(1)}s ` +
              `(expected ~${expectedChunks}), avg chunk RMS ${(this._stats.rmsSum / this._stats.chunks).toFixed(4)}`
          );
          this._stats.lastLogAt = now;
        }
      }
    }
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = recitationAudio;
}
