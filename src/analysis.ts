// Pause / filler detection and cut snapping, all from the audio on the device.

export type Item = {
  id: number;
  kind: 'word' | 'pause' | 'filler';
  text: string;
  start: number;
  end: number;
  cut: boolean;
};

export const FRAME = 0.01; // 10 ms energy frames

/** RMS energy per 10 ms frame of 16 kHz mono audio. */
export function energy(pcm: Float32Array, rate = 16000): Float32Array {
  const n = Math.floor(pcm.length / (rate * FRAME));
  const out = new Float32Array(n);
  const step = Math.round(rate * FRAME);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = i * step; j < (i + 1) * step; j++) s += pcm[j] * pcm[j];
    out[i] = Math.sqrt(s / step);
  }
  return out;
}

export function voicedThreshold(e: Float32Array): number {
  const sorted = Array.from(e).sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length * 0.1)] || 0;
  return Math.max(floor * 3, 0.004);
}

/** Whisper stretches word edges over silence. Pull each edge in to where there is actually sound. */
export function refineWords<T extends { start: number; end: number }>(words: T[], e: Float32Array): T[] {
  const thr = voicedThreshold(e);
  return words.map((w) => {
    let a = Math.floor(w.start / FRAME), b = Math.min(e.length - 1, Math.ceil(w.end / FRAME));
    const a0 = a, b0 = b;
    while (a < b && e[a] <= thr) a++;
    while (b > a && e[b] <= thr) b--;
    // only trust the trim if some sound was found, and never shrink a word below 60 ms
    if (e.slice(a0, b0 + 1).every((v) => v <= thr) || (b - a) * FRAME < 0.06) return w;
    return { ...w, start: a * FRAME, end: (b + 1) * FRAME };
  });
}

/** Words + gap chips. Gaps >= 0.4 s are pauses; gaps with sound but no word are "um?" fillers. */
export function buildItems(words: { text: string; start: number; end: number }[], e: Float32Array, pauseMin = 0.4): Item[] {
  const thr = voicedThreshold(e);
  words = refineWords(words, e);
  const items: Item[] = [];
  let id = 0;
  const push = (kind: Item['kind'], text: string, start: number, end: number) =>
    items.push({ id: id++, kind, text, start, end, cut: false });

  words.forEach((w, i) => {
    if (i > 0) {
      const gs = words[i - 1].end, ge = w.start, g = ge - gs;
      if (g >= 0.3) {
        const a = Math.floor(gs / FRAME), b = Math.ceil(ge / FRAME);
        let run = 0, best = 0, bestAt = a;
        for (let f = a; f < b && f < e.length; f++) {
          if (e[f] > thr) { run++; if (run > best) { best = run; bestAt = f - run + 1; } } else run = 0;
        }
        if (best * FRAME >= 0.2 && best * FRAME >= g * 0.5) push('filler', 'um?', bestAt * FRAME, (bestAt + best) * FRAME);
        else if (g >= pauseMin) push('pause', `${g.toFixed(1)}s`, gs, ge);
      }
    }
    push('word', w.text, w.start, w.end);
  });
  return items;
}

/** Move an edge to the quietest point within +/- 150 ms. */
export function snap(t: number, e: Float32Array, win = 0.15): number {
  const a = Math.max(0, Math.round((t - win) / FRAME)), b = Math.min(e.length - 1, Math.round((t + win) / FRAME));
  let best = a, bv = Infinity;
  for (let f = a; f <= b; f++) {
    const v = (e[f - 1] ?? e[f]) + e[f] + (e[f + 1] ?? e[f]); // light smoothing
    if (v < bv - 1e-9 || (Math.abs(v - bv) < 1e-9 && Math.abs(f * FRAME - t) < Math.abs(best * FRAME - t))) { bv = v; best = f; }
  }
  return best * FRAME;
}

export type Segment = { in: number; out: number; firstItem: number; lastItem: number };

/** Kept segments are computed, never stored. Runs of kept items merge; edges snap; stray bits (<0.25 s) drop. */
export function keptSegments(items: Item[], e: Float32Array, duration: number, pad = 0.04): Segment[] {
  const segs: Segment[] = [];
  let run: Item[] = [];
  const flush = () => {
    if (!run.length) return;
    const first = run[0], last = run[run.length - 1];
    const i0 = items.indexOf(first), i1 = items.indexOf(last);
    const before = i0 > 0 ? items[i0 - 1].end : 0;
    const after = i1 < items.length - 1 ? items[i1 + 1].start : duration;
    let a = first.start - pad, b = last.end + pad;
    // do not snap into a neighbouring kept word: stay between neighbours
    a = Math.max(snap(a, e), Math.min(before, first.start));
    b = Math.min(snap(b, e), Math.max(after, last.end));
    a = Math.max(0, Math.min(a, first.start));
    b = Math.min(duration, Math.max(b, last.end));
    if (b - a >= 0.25) segs.push({ in: a, out: b, firstItem: first.id, lastItem: last.id });
    run = [];
  };
  for (const it of items) { if (it.cut) flush(); else run.push(it); }
  flush();
  // segments must not overlap after padding
  for (let i = 1; i < segs.length; i++) if (segs[i].in < segs[i - 1].out) { const m = (segs[i].in + segs[i - 1].out) / 2; segs[i].in = segs[i - 1].out = m; }
  return segs;
}
