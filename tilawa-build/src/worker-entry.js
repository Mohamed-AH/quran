/**
 * Tilawa inference Web Worker for the Hafiz recitation feature.
 *
 * Built with esbuild into js/vendor/tilawa-worker.js (ESM — create with
 * `new Worker(url, { type: "module" })`). The worker is a dumb tilawa host:
 * it owns the ONNX session and relays every tilawa event to the main thread.
 * All coaching logic lives on the main thread (js/recitation-coach.js).
 *
 * Inbound messages:
 *   { type: "init", model: ArrayBuffer, vocab, quranCtcTokens, quran, config? }
 *   { type: "feed", samples: Float32Array }        (transferred)
 *   { type: "stop" }        force a final flush by feeding synthetic silence
 *   { type: "reset" }
 *   { type: "setConfig", config: Partial<StreamingConfig> }
 *   { type: "setExpected", surah, ayahStart, ayahEnd }  word-accuracy window
 *                                                       + rescopes the tracker
 *                                                       to just that surah
 *   { type: "cursor", ayah }                       coach cursor updates
 *   { type: "transcribe", samples: Float32Array }  one-shot (harness/debug)
 *
 * Outbound messages:
 *   { type: "ready", build }        build = the `?v=` query on this script's
 *                                   own URL, echoed back so the main thread
 *                                   can detect a stale-cached worker bundle
 *                                   (see js/config.js WORKER_PATH)
 *   { type: "event", event: WorkerOutbound }       every tilawa onOutput event
 *                                                   (WorkerOutbound now also
 *                                                   includes "decoded_text" —
 *                                                   the raw CTC decode text,
 *                                                   forwarded on EVERY decode
 *                                                   cycle in both discovery
 *                                                   and tracking mode. This
 *                                                   is the primary signal for
 *                                                   the alignment-driven
 *                                                   coach — see
 *                                                   tilawa-build/README.md)
 *   { type: "stopped" }                            stop flush completed
 *   { type: "transcribed", prediction }            one-shot result
 *   { type: "error", message, fatal }
 */

import * as ort from "onnxruntime-web/wasm";
import { createTilawaSession, BALANCED_STREAMING_CONFIG } from "@tilawa/core";
import { alignTranscript } from "./align.js";

const SAMPLE_RATE = 16000;

// Echoed back on "ready" so the main thread can prove THIS bundle (not a
// stale cached one) is actually running — see the `?v=` cache-busting query
// js/config.js appends to WORKER_PATH. A mismatch (or a missing echo, from
// a worker old enough to predate this field) means the browser is running
// stale worker code regardless of what the page's own CONFIG.TILAWA.BUILD
// claims.
const workerBuild = (() => {
  try {
    return new URLSearchParams(self.location.search).get("v");
  } catch (e) {
    return null;
  }
})();

let session = null;
let feeding = Promise.resolve();
let stopping = false;

// Retained from init() so setExpected can REBUILD the session scoped to a
// single surah (see rescopeToSurah). runner/assets are cheap to keep around;
// the ONNX InferenceSession itself (inside runner) is never recreated.
let runner = null;
let fullQuranData = null;
let vocabData = null;
let ctcTokensData = null;
let currentConfig = {};
let scopedSurah = null; // null = full corpus (freestyle, pre-anchor)

// Word-accuracy layer: expected passage (from QuranDB.phoneme_words — same
// decode space as raw_transcript text) and the coach's cursor. Each
// raw_transcript fragment is aligned against a window around the cursor and
// per-word verdicts are emitted as a synthetic `word_verdicts` event.
let expectedRange = null; // { surah, ayahStart, ayahEnd }
let cursorAyah = null;

const MAX_WINDOW_WORDS = 64;

function expectedWindow() {
  if (!session || !expectedRange) return null;
  const words = [];
  // Before the session starts (no cursor yet) align against the head of the
  // expected passage — this powers transcript-based session start when the
  // tracker itself is stuck. After start: cursor verse + the next TWO, so a
  // fast reciter's fragment spanning multiple verses can still be matched
  // directly (mirrors the coach's multi-step transcript advance).
  const from = cursorAyah === null ? expectedRange.ayahStart : cursorAyah;
  const to =
    cursorAyah === null
      ? expectedRange.ayahEnd
      : Math.min(cursorAyah + 2, expectedRange.ayahEnd);
  for (let a = from; a <= to && words.length < MAX_WINDOW_WORDS; a++) {
    const verse = session.db.getVerse(expectedRange.surah, a);
    if (!verse) continue;
    verse.phoneme_words.forEach((w, i) => {
      if (words.length < MAX_WINDOW_WORDS) words.push({ word: w, ayah: a, index: i });
    });
  }
  return words.length ? words : null;
}

function maybeEmitWordVerdicts(event) {
  if (event.type !== "raw_transcript" || !event.text) return;
  const window = expectedWindow();
  if (!window) return;
  const decoded = event.text.trim().split(/\s+/).filter(Boolean);
  if (decoded.length === 0) return;
  const verdicts = alignTranscript(decoded, window);
  if (verdicts.length) {
    postEvent({ type: "word_verdicts", surah: expectedRange.surah, verdicts });
  }
}

// Debug instrumentation (toggled from the main thread via {type:"setDebug"}).
// When on: tilawa's onDiagnostic firehose is forwarded, and feed timing /
// queue-depth stats are posted every ~5 s so real-time headroom is visible.
let debugEnabled = false;
let queueDepth = 0;
const stats = { feeds: 0, feedMsTotal: 0, feedMsMax: 0, audioMs: 0, lastPost: 0 };

function postStats(now) {
  const avg = stats.feeds ? stats.feedMsTotal / stats.feeds : 0;
  // realtimeFactor < 1 means inference keeps up with the mic.
  const realtimeFactor = stats.audioMs ? stats.feedMsTotal / stats.audioMs : 0;
  self.postMessage({
    type: "stats",
    stats: {
      feeds: stats.feeds,
      avgFeedMs: Math.round(avg * 10) / 10,
      maxFeedMs: Math.round(stats.feedMsMax),
      queueDepth,
      realtimeFactor: Math.round(realtimeFactor * 100) / 100,
    },
  });
  stats.feeds = 0;
  stats.feedMsTotal = 0;
  stats.feedMsMax = 0;
  stats.audioMs = 0;
  stats.lastPost = now;
}

function postEvent(event) {
  self.postMessage({ type: "event", event });
  maybeEmitWordVerdicts(event);
}

function postError(message, fatal = false) {
  self.postMessage({ type: "error", message: String(message), fatal });
}

async function createRunner(modelBuffer) {
  // Single-threaded WASM is the reliable default: browser pthread startup can
  // hang in worker contexts, and multi-threading would require COOP/COEP
  // headers the app's static hosting does not send.
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.simd = true;
  ort.env.wasm.wasmPaths = new URL("./ort/", self.location.href).href;

  const ortSession = await ort.InferenceSession.create(modelBuffer, {
    executionProviders: ["wasm"],
  });

  return {
    async run(audio) {
      const inputTensor = new ort.Tensor("float32", audio, [1, audio.length]);
      const lengthTensor = new ort.Tensor(
        "int64",
        BigInt64Array.from([BigInt(audio.length)]),
        [1],
      );
      const results = await ortSession.run({
        audio_signal: inputTensor,
        length: lengthTensor,
      });
      const output = results[ortSession.outputNames[0]];
      const [, timeSteps, vocabSize] = output.dims;
      return { logprobs: output.data, timeSteps, vocabSize };
    },
  };
}

function buildSession(quranSubset, config) {
  return createTilawaSession(
    runner,
    {
      vocab: vocabData,
      quranCtcTokens: ctcTokensData,
      quran: quranSubset,
    },
    {
      config,
      // NOTE: no onOutput — streaming events are posted from the returned
      // messages of each feed() so that resets can drop stale in-flight
      // output (see drainLoop / resetEpoch).
      onDiagnostic: (event, data) => {
        if (debugEnabled) self.postMessage({ type: "diag", event, data });
        // Always-on continuous transcription signal (Phase 1 of the
        // alignment-driven coach rewrite — see tilawa-build/README.md).
        // Unlike every other tracker diagnostic, `event === "transcribe"`
        // IS meaningful here: this one is dispatched directly (not wrapped
        // as "tracker"), and it fires on EVERY decode cycle in BOTH
        // discovery and tracking mode (field-verified: unlike
        // `raw_transcript`, which tracking mode suppresses entirely, this
        // keeps flowing the whole session). This is deliberately forwarded
        // unconditionally, not gated behind debugEnabled — it's about to
        // become the primary data source for verse identity and mistake
        // detection, not a debug-only aid.
        if (event === "transcribe" && data && typeof data.text === "string") {
          postEvent({
            type: "decoded_text",
            text: data.text,
            audioSec: data.audioSec,
            tokenCount: data.tokenCount,
            champion: data.champion || null,
          });
        }
        // CRITICAL: `event` here is NOT the diagnostic's own type. The
        // vendored tracker wraps every one of its diagnostics as
        // onDiagnostic("tracker", {...theRealDiagnostic}) — event is
        // ALWAYS the literal string "tracker" for every tracking_cycle,
        // discovery_cycle, commit, advance_decision, stale_exit, etc. The
        // real type lives at `data.type`. (The ONE exception is the
        // one-shot `transcribe` diagnostic, dispatched directly as
        // onDiagnostic("transcribe", {...}) — that one's `event` IS
        // meaningful.) Field bug (builds 2026-07-21f through -21l): both
        // lex_check and tracking_abandoned below checked `event ===
        // "tracking_cycle"` / `event === "stale_exit"` — a comparison that
        // can NEVER be true, since `event` is always "tracker" — so
        // neither ever fired, in any build, ever. Every content-verification
        // gate and false-start-retraction fix built this session was
        // completely inert in production the entire time; confirmed by
        // replaying real field logs and by running the actual compiled
        // bundle (not a hand-mirrored test copy) end-to-end. The fix is
        // exactly this: check `data.type`, not `event`.
        //
        // tracking_cycle's `word_matches` is tilawa's own per-cycle LEXICAL
        // alignment count (alignPosition() against the tracked verse's real
        // words) — distinct from `matched_indices` in the word_progress
        // event, which falls back to acoustic_word/char_word (position-only,
        // duration-based) advances whenever word_matches is 0. That fallback
        // is invisible downstream, so a verse can complete tilawa's own
        // tracking with ZERO real lexical corroboration, ever (field case:
        // build 2026-07-21, reciting the English alphabet against a picked
        // surah scored 100 — every tracking_cycle showed word_matches:0).
        // Forwarded here as a session-wide signal (see coach _onLexCheck)
        // rather than per-verse: a short verse can legitimately clear on
        // 1-2 fallback cycles alone (observed in real correct recitation),
        // so only a sustained, whole-session absence of any real lexical
        // match is trustworthy negative evidence.
        if (
          data &&
          data.type === "tracking_cycle" &&
          data.advanced &&
          typeof data.ref === "string"
        ) {
          const sep = data.ref.indexOf(":");
          if (sep > 0) {
            postEvent({
              type: "lex_check",
              surah: Number(data.ref.slice(0, sep)),
              ayah: Number(data.ref.slice(sep + 1)),
              lexical: (data.word_matches || 0) > 0,
            });
          }
        }
        // stale_exit: tilawa's OWN tracker gave up on the current verse
        // after several cycles with no real advance — it never confirmed
        // this was genuinely the verse being recited. Forwarded so the
        // coach can detect a fallback-only OPENING commit (short_rescue /
        // acoustic_margin locking onto a verse from a handful of acoustic
        // tokens, e.g. the isti'adhah) that tilawa itself is now
        // abandoning, and undo a false "verses skipped" start rather than
        // let a bogus one-shot acoustic match stand — see coach
        // _onTrackingAbandoned.
        if (data && data.type === "stale_exit" && typeof data.ref === "string") {
          const sep = data.ref.indexOf(":");
          if (sep > 0) {
            postEvent({
              type: "tracking_abandoned",
              surah: Number(data.ref.slice(0, sep)),
              ayah: Number(data.ref.slice(sep + 1)),
            });
          }
        }
      },
    },
  );
}

async function handleInit(msg) {
  runner = await createRunner(msg.model);
  vocabData = msg.vocab;
  ctcTokensData = msg.quranCtcTokens;
  fullQuranData = msg.quran;
  currentConfig = msg.config || {};
  scopedSurah = null;
  session = buildSession(fullQuranData, currentConfig);
  self.postMessage({ type: "ready", build: workerBuild });
}

/**
 * Restrict the tilawa tracker's search space to a single surah.
 *
 * Cross-surah noise-locking is the single most common field failure so
 * far: pre-recitation ambient noise gets committed to some unrelated verse
 * (68:9, 104:9, 105:1, 87:1 all observed) purely because discovery searches
 * the entire 6,236-verse corpus. When the user has already picked a
 * passage, the surah is known in advance — there is no reason for
 * discovery to ever consider the other 113 surahs. Rebuilding the session
 * with QuranDB restricted to just that surah's verses makes a cross-surah
 * lock structurally impossible (those verses simply do not exist in the
 * tracker's world), and as a side effect shrinks the champion-matching
 * scan (quran-db.ts iterates `this.verses` on every decode cycle) from
 * 6,236 down to as few as 3 verses — a likely win for the persistent
 * real-time-lag issues seen on slow devices.
 *
 * Freestyle mode starts unscoped (surah unknown yet, needs the full
 * corpus for discovery) and rescopes here too, once anchored.
 */
function rescopeToSurah(surah) {
  if (surah === scopedSurah || !fullQuranData) return;
  const subset = fullQuranData.filter((v) => v.surah === surah);
  if (subset.length === 0) return; // defensive: keep the current session
  scopedSurah = surah;
  currentConfig = session ? session.getConfig() : currentConfig;
  session = buildSession(subset, currentConfig);
  self.postMessage({ type: "scoped", surah, verseCount: subset.length });
  // A rebuilt session is a brand new tracker: drop any queued backlog (it
  // was scored against the old DB) and invalidate in-flight feeds, same
  // safety net as a manual reset.
  pendingChunks = [];
  queueDepth = 0;
  cursorAyah = null;
  resetEpoch++;
}

// feed() calls must not interleave (the tracker is stateful), and on slow
// devices inference can fall behind real-time (observed: up to 5× on
// Safari/macOS). Pending chunks are therefore COALESCED — but capped at
// MAX_BATCH_SAMPLES per feed call: an unbounded batch makes a single
// session.feed() run for tens of seconds, during which a tracker reset
// cannot take effect (field bug: reset "did nothing" because a mega-feed
// on the OLD tracker kept emitting events long after the swap).
//
// resetEpoch makes resets authoritative: a reset bumps the epoch and drops
// the queued backlog (after a reset we listen FRESH — replaying lagged
// audio would just re-poison the new tracker), and any events produced by
// a feed that started before the reset are discarded.
const MAX_BATCH_SAMPLES = SAMPLE_RATE; // 1 s of audio per feed call
let pendingChunks = [];
let draining = false;
let resetEpoch = 0;

function resetStreaming() {
  if (session) session.reset();
  pendingChunks = [];
  queueDepth = 0;
  cursorAyah = null;
  resetEpoch++;
}

function enqueueFeed(samples) {
  pendingChunks.push(samples);
  queueDepth = pendingChunks.length;
  if (!draining) feeding = drainLoop();
}

function takeBatch() {
  let total = 0;
  let count = 0;
  while (count < pendingChunks.length && total < MAX_BATCH_SAMPLES) {
    total += pendingChunks[count].length;
    count++;
  }
  const batch = pendingChunks.splice(0, count);
  queueDepth = pendingChunks.length;
  if (batch.length === 1) return batch[0];
  const combined = new Float32Array(total);
  let offset = 0;
  for (const c of batch) {
    combined.set(c, offset);
    offset += c.length;
  }
  return combined;
}

async function drainLoop() {
  draining = true;
  try {
    while (pendingChunks.length && session && !stopping) {
      // Yield to the MACROTASK queue: an async loop continues on microtasks
      // and would otherwise starve onmessage entirely while chunks are
      // pending — control messages (reset/setConfig) queued behind feeds
      // were being applied minutes late on slow devices.
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (!pendingChunks.length || !session || stopping) break;
      const combined = takeBatch();
      const epochAtStart = resetEpoch;
      const t0 = Date.now();
      let messages = null;
      try {
        messages = await session.feed(combined);
      } catch (err) {
        postError(`feed failed: ${err && err.message}`);
      }
      // Drop events from a feed that straddled a reset — they belong to
      // the discarded tracker state.
      if (messages && resetEpoch === epochAtStart) {
        for (const msg of messages) postEvent(msg);
      }
      if (debugEnabled) {
        const ms = Date.now() - t0;
        stats.feeds++;
        stats.feedMsTotal += ms;
        if (ms > stats.feedMsMax) stats.feedMsMax = ms;
        stats.audioMs += (combined.length / SAMPLE_RATE) * 1000;
        if (Date.now() - stats.lastPost >= 5000) postStats(Date.now());
      }
    }
  } finally {
    draining = false;
  }
}

/**
 * There is no public flush API on the tracker; its final_sequence emission is
 * driven by accumulated silence (finalSilenceSec). A manual stop therefore
 * feeds synthetic silence until the flush fires (bounded to avoid spinning).
 */
async function handleStop() {
  if (!session) {
    self.postMessage({ type: "stopped" });
    return;
  }
  try {
    await feeding; // drain ALL pending real audio (incl. the mic tail) first
    stopping = true;
    const cfg = session.getConfig();
    const chunk = new Float32Array(Math.round(SAMPLE_RATE * 0.3));
    const flushSec = (cfg.finalSilenceSec || 5) + 1.5;
    const maxChunks = Math.ceil((flushSec * SAMPLE_RATE) / chunk.length);
    for (let i = 0; i < maxChunks; i++) {
      const messages = await session.feed(chunk);
      for (const msg of messages) postEvent(msg);
      if (messages.some((m) => m.type === "final_sequence")) break;
    }
  } catch (err) {
    postError(`stop flush failed: ${err && err.message}`);
  } finally {
    stopping = false;
    self.postMessage({ type: "stopped" });
  }
}

self.onmessage = (e) => {
  const msg = e.data;
  try {
    switch (msg.type) {
      case "init":
        handleInit(msg).catch((err) =>
          postError(`init failed: ${err && err.message}`, true),
        );
        break;
      case "feed":
        enqueueFeed(msg.samples);
        break;
      case "stop":
        handleStop();
        break;
      case "reset":
        resetStreaming();
        break;
      case "setExpected":
        rescopeToSurah(msg.surah);
        expectedRange = {
          surah: msg.surah,
          ayahStart: msg.ayahStart,
          ayahEnd: msg.ayahEnd,
        };
        cursorAyah = null;
        break;
      case "cursor":
        cursorAyah = typeof msg.ayah === "number" ? msg.ayah : null;
        break;
      case "setConfig":
        if (session) session.setConfig(msg.config || {});
        currentConfig = session ? session.getConfig() : currentConfig;
        break;
      case "setDebug":
        debugEnabled = !!msg.enabled;
        stats.lastPost = Date.now();
        break;
      case "transcribe":
        (async () => {
          const prediction = await session.transcribe(msg.samples);
          self.postMessage({ type: "transcribed", prediction });
        })().catch((err) =>
          postError(`transcribe failed: ${err && err.message}`),
        );
        break;
      default:
        break;
    }
  } catch (err) {
    postError(err && err.message);
  }
};

// Referencing the preset keeps it in the bundle for setConfig baselines and
// documents the default the main thread starts from.
export { BALANCED_STREAMING_CONFIG };
