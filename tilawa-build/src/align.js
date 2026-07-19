/**
 * Transcript-vs-expected word alignment for the word-accuracy layer.
 *
 * Tilawa's `raw_transcript` events carry its decoded Arabic text; the app
 * knows what the reciter SHOULD be saying (the picked passage). Both sides
 * live in the same CTC-decode space (expected words come from
 * QuranDB.phoneme_words), so a plain word-level semi-global alignment yields
 * per-word verdicts far richer than the tracker's sparse matched_indices.
 *
 * Pure, dependency-free JS — unit-tested directly with node --test and
 * bundled into the worker.
 *
 * Verdict semantics (conservative by design — a coach that falsely accuses
 * is worse than one that misses):
 *   matched     similarity ≥ MATCH_SIM
 *   fuzzy       MAYBE_SIM ≤ similarity < MATCH_SIM   (counts as recited)
 *   substituted aligned pair with similarity < SUB_SIM (heard ≠ expected)
 *   missing     expected word skipped INSIDE the covered span
 * Expected words outside the span the fragment actually covers get NO
 * verdict (streamed transcripts are fragments; absence there is not
 * evidence). Fragments that anchor with < MIN_ANCHORS matches emit nothing.
 */

const MATCH_SIM = 0.75;
const MAYBE_SIM = 0.5;
const SUB_SIM = 0.5;
const MIN_ANCHORS = 2;

/** Character-level Levenshtein similarity ratio in [0, 1]. */
function similarity(a, b) {
  if (a === b) return 1;
  const la = a.length;
  const lb = b.length;
  if (la === 0 || lb === 0) return 0;
  let prev = new Array(lb + 1);
  let curr = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;
  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= lb; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return 1 - prev[lb] / Math.max(la, lb);
}

/**
 * Align decoded transcript words against an expected word window.
 *
 * @param {string[]} decoded — words from a raw_transcript fragment
 * @param {Array<{word:string, ayah:number, index:number}>} expected —
 *   flattened expected window (e.g. cursor verse + next verse)
 * @returns {Array<{ayah:number, index:number, status:string, heard?:string, expected:string}>}
 */
function alignTranscript(decoded, expected) {
  const n = decoded.length;
  const m = expected.length;
  if (n === 0 || m === 0) return [];

  // Precompute pair similarities.
  const sim = [];
  for (let i = 0; i < n; i++) {
    sim.push(expected.map((e) => similarity(decoded[i], e.word)));
  }

  const PAIR_GOOD = 2; // aligned pair, similar
  const PAIR_BAD = -0.5; // aligned pair, dissimilar (substitution candidate)
  const GAP_DECODED = -0.2; // extra spoken word / repetition — cheap
  const GAP_EXPECTED = -1; // expected word skipped — the real signal

  // dp[i][j]: best score aligning decoded[0..i) with expected[0..j).
  // Semi-global on the expected side: leading expected gaps are free
  // (dp[0][j] = 0) and the end is the max over the last row — the fragment
  // may cover any span of the expected window.
  const dp = [];
  const bt = [];
  for (let i = 0; i <= n; i++) {
    dp.push(new Float64Array(m + 1));
    bt.push(new Int8Array(m + 1)); // 1=diag 2=up(decoded gap) 3=left(expected gap)
  }
  for (let i = 1; i <= n; i++) {
    dp[i][0] = dp[i - 1][0] + GAP_DECODED;
    bt[i][0] = 2;
  }
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const s = sim[i - 1][j - 1];
      // Fuzzy pairs (MAYBE..MATCH) score low enough that a skip+perfect-match
      // path beats them — otherwise a missing word gets papered over by
      // fuzzy-pairing its neighbor (e.g. الرحيم absorbed into الرحمن).
      const pairScore = s >= MATCH_SIM ? PAIR_GOOD * s : s >= MAYBE_SIM ? 0.6 * s : PAIR_BAD;
      const diag = dp[i - 1][j - 1] + pairScore;
      const up = dp[i - 1][j] + GAP_DECODED;
      const left = dp[i][j - 1] + GAP_EXPECTED;
      if (diag >= up && diag >= left) {
        dp[i][j] = diag;
        bt[i][j] = 1;
      } else if (up >= left) {
        dp[i][j] = up;
        bt[i][j] = 2;
      } else {
        dp[i][j] = left;
        bt[i][j] = 3;
      }
    }
  }

  let jEnd = 0;
  for (let j = 1; j <= m; j++) {
    if (dp[n][j] >= dp[n][jEnd]) jEnd = j;
  }

  // Backtrace over the covered span.
  const ops = [];
  let i = n;
  let j = jEnd;
  while (i > 0 && j > 0) {
    const move = bt[i][j];
    if (move === 1) {
      ops.push({ type: 'pair', di: i - 1, ej: j - 1, sim: sim[i - 1][j - 1] });
      i--;
      j--;
    } else if (move === 2) {
      ops.push({ type: 'extra', di: i - 1 });
      i--;
    } else {
      ops.push({ type: 'skip', ej: j - 1 });
      j--;
    }
  }
  while (i > 0) {
    ops.push({ type: 'extra', di: --i });
  }
  ops.reverse();

  const anchors = ops.filter((op) => op.type === 'pair' && op.sim >= MATCH_SIM).length;
  if (anchors < MIN_ANCHORS) return [];

  // Trim: verdicts only between the first and last well-matched anchor —
  // skips at the fragment's ragged edges are not evidence.
  let first = -1;
  let last = -1;
  ops.forEach((op, k) => {
    if (op.type === 'pair' && op.sim >= MATCH_SIM) {
      if (first === -1) first = k;
      last = k;
    }
  });

  const verdicts = [];
  for (let k = first; k <= last; k++) {
    const op = ops[k];
    if (op.type === 'pair') {
      const e = expected[op.ej];
      if (op.sim >= MATCH_SIM) {
        verdicts.push({ ayah: e.ayah, index: e.index, status: 'matched', expected: e.word });
      } else if (op.sim >= MAYBE_SIM) {
        verdicts.push({ ayah: e.ayah, index: e.index, status: 'fuzzy', expected: e.word });
      } else {
        verdicts.push({
          ayah: e.ayah,
          index: e.index,
          status: 'substituted',
          heard: decoded[op.di],
          expected: e.word,
        });
      }
    } else if (op.type === 'skip') {
      const e = expected[op.ej];
      verdicts.push({ ayah: e.ayah, index: e.index, status: 'missing', expected: e.word });
    }
    // 'extra' (unexpected/repeated spoken word) is never penalized.
  }
  return verdicts;
}

export { alignTranscript, similarity, MATCH_SIM, MAYBE_SIM, SUB_SIM };
