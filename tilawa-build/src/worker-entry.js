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
 *   { type: "transcribe", samples: Float32Array }  one-shot (harness/debug)
 *
 * Outbound messages:
 *   { type: "ready" }
 *   { type: "event", event: WorkerOutbound }       every tilawa onOutput event
 *   { type: "stopped" }                            stop flush completed
 *   { type: "transcribed", prediction }            one-shot result
 *   { type: "error", message, fatal }
 */

import * as ort from "onnxruntime-web/wasm";
import { createTilawaSession, BALANCED_STREAMING_CONFIG } from "@tilawa/core";

const SAMPLE_RATE = 16000;

let session = null;
let feeding = Promise.resolve();
let stopping = false;

function postEvent(event) {
  self.postMessage({ type: "event", event });
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

async function handleInit(msg) {
  const runner = await createRunner(msg.model);
  session = createTilawaSession(
    runner,
    {
      vocab: msg.vocab,
      quranCtcTokens: msg.quranCtcTokens,
      quran: msg.quran,
    },
    {
      config: msg.config || {},
      onOutput: postEvent,
    },
  );
  self.postMessage({ type: "ready" });
}

// feed() calls must not interleave: the tracker is stateful. Serialize them.
function enqueueFeed(samples) {
  feeding = feeding
    .then(() => (session && !stopping ? session.feed(samples) : null))
    .catch((err) => postError(`feed failed: ${err && err.message}`));
  return feeding;
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
  stopping = true;
  try {
    await feeding; // let in-flight feeds drain
    const cfg = session.getConfig();
    const chunk = new Float32Array(Math.round(SAMPLE_RATE * 0.3));
    const flushSec = (cfg.finalSilenceSec || 5) + 1.5;
    const maxChunks = Math.ceil((flushSec * SAMPLE_RATE) / chunk.length);
    for (let i = 0; i < maxChunks; i++) {
      const messages = await session.feed(chunk);
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
        if (session) session.reset();
        break;
      case "setConfig":
        if (session) session.setConfig(msg.config || {});
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
