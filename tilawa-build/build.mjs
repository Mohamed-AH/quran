/**
 * Builds the tilawa inference worker bundle and vendors the onnxruntime-web
 * WASM runtime files next to it.
 *
 *   cd tilawa-build && npm install && npm run build
 *
 * Outputs (committed to the repo so the app needs no build step):
 *   ../js/vendor/tilawa-worker.js   ESM worker bundle (@tilawa/core + ort glue)
 *   ../js/vendor/ort/ort-wasm-*     ONNX Runtime WASM binaries + loaders
 */

import { build } from "esbuild";
import { cp, mkdir, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const vendorDir = join(here, "..", "js", "vendor");
const ortOutDir = join(vendorDir, "ort");
const ortDistDir = join(here, "node_modules", "onnxruntime-web", "dist");

await mkdir(ortOutDir, { recursive: true });

await build({
  entryPoints: [join(here, "src", "worker-entry.js")],
  bundle: true,
  minify: true,
  format: "esm",
  target: ["es2020"],
  outfile: join(vendorDir, "tilawa-worker.js"),
  define: { "process.env.NODE_ENV": '"production"' },
  // ORT loads its WASM glue with a runtime-computed dynamic import; leave it
  // external instead of letting esbuild try to resolve it.
  logOverride: { "unsupported-dynamic-import": "silent" },
});

// The wasm-only build loads ort-wasm-simd-threaded.{mjs,wasm} at runtime from
// ort.env.wasm.wasmPaths (set to js/vendor/ort/ by the worker).
const ortFiles = (await readdir(ortDistDir)).filter(
  (f) =>
    f.startsWith("ort-wasm-simd-threaded") &&
    (f.endsWith(".wasm") || f.endsWith(".mjs")) &&
    !f.includes("jsep") && // WebGPU build — not used (wasm EP only)
    !f.includes("jspi") && // JSPI build — never referenced by the wasm EP glue
    !f.includes("asyncify"),
);
if (ortFiles.length === 0) {
  throw new Error(`No ort-wasm files found in ${ortDistDir}`);
}
for (const f of ortFiles) {
  await cp(join(ortDistDir, f), join(ortOutDir, f));
}

console.log("Built js/vendor/tilawa-worker.js");
console.log(`Copied ORT runtime: ${ortFiles.join(", ")}`);
