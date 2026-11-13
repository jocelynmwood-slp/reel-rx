// Renders the edit frame by frame in the browser and encodes an MP4. Nothing is uploaded.
import {
  Input, ALL_FORMATS, BlobSource, Output, Mp4OutputFormat, BufferTarget,
  CanvasSink, CanvasSource, AudioBufferSource, QUALITY_HIGH, canEncodeAudio,
} from 'mediabunny';
import { registerAacEncoder } from '@mediabunny/aac-encoder';
import type { Segment, Item } from './analysis';

export type Transition = 'smart' | 'cross' | 'hard';
export type ExportOpts = {
  file: File; audio: AudioBuffer; segments: Segment[]; items: Item[];
  transition: Transition; captions: 'box' | 'clean' | 'off'; hook: string;
  onProgress: (frac: number, msg: string) => void;
};
export type Placed = Segment & { outStart: number; outEnd: number; zoom: number; xfadeIn: number };

const W = 1080, H = 1920, FPS = 30, XFADE = 0.25, MICRO = 0.03;

/** Place kept segments on the output timeline. Crossfades overlap the two shots, so the video shortens. */
export function place(segments: Segment[], transition: Transition): { placed: Placed[]; total: number } {
  const placed: Placed[] = [];
  let cursor = 0, zoomed = false;
  segments.forEach((s, i) => {
    const xf = i > 0 && transition === 'cross' ? Math.min(XFADE, (s.out - s.in) / 2, (placed[i - 1].outEnd - placed[i - 1].outStart) / 2) : 0;
    if (i > 0 && transition === 'smart') zoomed = !zoomed;
    const outStart = cursor - xf;
    const outEnd = outStart + (s.out - s.in);
    placed.push({ ...s, outStart, outEnd, zoom: zoomed ? 1.1 : 1, xfadeIn: xf });
    cursor = outEnd;
  });
  return { placed, total: cursor };
}

/** Source time -> output time for a word, so captions follow the edit. */
function outTime(placed: Placed[], t: number): number | null {
  for (const p of placed) if (t >= p.in && t <= p.out) return p.outStart + (t - p.in);
  return null;
}

function buildAudio(src: AudioBuffer, placed: Placed[], total: number): AudioBuffer {
  const sr = src.sampleRate, ch = Math.min(2, src.numberOfChannels);
  const out = new AudioBuffer({ length: Math.ceil(total * sr), sampleRate: sr, numberOfChannels: 2 });
  placed.forEach((p, i) => {
    const next = placed[i + 1];
    const fadeIn = i === 0 ? 0.005 : (p.xfadeIn || MICRO);
    const fadeOut = i === placed.length - 1 ? 0.01 : (next?.xfadeIn || MICRO);
    const len = Math.round((p.out - p.in) * sr), s0 = Math.round(p.in * sr), o0 = Math.round(p.outStart * sr);
    for (let c = 0; c < 2; c++) {
      const from = src.getChannelData(Math.min(c, ch - 1)), to = out.getChannelData(c);
      for (let k = 0; k < len; k++) {
        const t = k / sr, rem = (len - k) / sr;
        let g = 1;
        if (t < fadeIn) g = p.xfadeIn ? Math.sin((t / fadeIn) * Math.PI / 2) : t / fadeIn;
        if (rem < fadeOut) g *= next?.xfadeIn ? Math.cos((1 - rem / fadeOut) * Math.PI / 2) : rem / fadeOut;
        const d = o0 + k;
        if (d >= 0 && d < to.length) to[d] += (from[s0 + k] || 0) * g;
      }
    }
  });
  return out;
}

type CapLine = { start: number; end: number; text: string };
function captionLines(items: Item[], placed: Placed[]): CapLine[] {
  const words = items.filter((i) => i.kind === 'word' && !i.cut);
  const lines: CapLine[] = [];
  let cur: { text: string; start: number; end: number } | null = null;
  for (const w of words) {
    const a = outTime(placed, w.start), b = outTime(placed, w.end);
    if (a == null || b == null) continue;
    const t = w.text.trim();
    if (!cur) cur = { text: t, start: a, end: b };
    else if ((cur.text + ' ' + t).length > 28 || a - cur.end > 0.6) { lines.push(cur); cur = { text: t, start: a, end: b }; }
    else { cur.text += ' ' + t; cur.end = b; }
  }
  if (cur) lines.push(cur);
  // hold each line until the next starts (max 0.4 s) so it doesn't flicker
  lines.forEach((l, i) => { const n = lines[i + 1]; l.end = Math.min(l.end + 0.4, n ? n.start : l.end + 0.4); });
  return lines;
}

function wrap(ctx: OffscreenCanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' '), out: string[] = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out;
}

function drawText(ctx: OffscreenCanvasRenderingContext2D, text: string, y: number, size: number, style: 'box' | 'clean') {
  ctx.font = `800 ${size}px -apple-system, "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lines = wrap(ctx, text, W - 240), lh = size * 1.25;
  lines.forEach((ln, i) => {
    const ly = y + (i - (lines.length - 1) / 2) * lh;
    if (style === 'box') {
      const w = ctx.measureText(ln).width + 44;
      ctx.fillStyle = 'rgba(20,20,22,.78)';
      ctx.beginPath(); ctx.roundRect((W - w) / 2, ly - lh / 2 + 4, w, lh - 8, 16); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(ln, W / 2, ly);
    } else {
      ctx.lineWidth = size * 0.16; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineJoin = 'round';
      ctx.strokeText(ln, W / 2, ly); ctx.fillStyle = '#fff'; ctx.fillText(ln, W / 2, ly);
    }
  });
}

export async function exportReel(o: ExportOpts) {
  const T0 = performance.now();
  const { placed, total } = place(o.segments, o.transition);
  const input = new Input({ source: new BlobSource(o.file), formats: ALL_FORMATS });
  const vtrack = await input.getPrimaryVideoTrack();
  if (!vtrack) throw new Error('No video track found in this file.');
  const opts = { width: W, height: H, fit: 'cover' as const, poolSize: 3 };
  const sinkA = new CanvasSink(vtrack, opts), sinkB = new CanvasSink(vtrack, opts);

  const aacNative = await canEncodeAudio('aac');
  if (!aacNative) registerAacEncoder();

  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  const canvas = new OffscreenCanvas(W, H);
  const ctx = canvas.getContext('2d')!;
  const vsrc = new CanvasSource(canvas, { codec: 'avc', bitrate: QUALITY_HIGH });
  const asrc = new AudioBufferSource({ codec: 'aac', bitrate: 128_000 });
  output.addVideoTrack(vsrc, { frameRate: FPS });
  output.addAudioTrack(asrc);
  await output.start();

  o.onProgress(0.02, 'Mixing audio…');
  await asrc.add(buildAudio(o.audio, placed, total));
  asrc.close();

  const lines = o.captions === 'off' ? [] : captionLines(o.items, placed);
  const frames = Math.floor(total * FPS);
  const draw = (wc: { canvas: any } | null, zoom: number, alpha: number) => {
    if (!wc) return;
    ctx.globalAlpha = alpha;
    ctx.save();
    ctx.translate(W / 2, H * 0.47); ctx.scale(zoom, zoom); ctx.translate(-W / 2, -H * 0.47);
    ctx.drawImage(wc.canvas, 0, 0, W, H);
    ctx.restore(); ctx.globalAlpha = 1;
  };
  let lastMsg = 0;
  for (let n = 0; n < frames; n++) {
    const t = n / FPS;
    const active = placed.filter((p) => t >= p.outStart && t < p.outEnd);
    const a = active[0] ?? placed[placed.length - 1];
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const wcA = await sinkA.getCanvas(Math.min(a.out - 0.001, a.in + (t - a.outStart)));
    draw(wcA, a.zoom, 1);
    if (active.length > 1) {
      const b = active[1], alpha = Math.min(1, (t - b.outStart) / b.xfadeIn);
      const wcB = await sinkB.getCanvas(b.in + (t - b.outStart));
      draw(wcB, b.zoom, alpha);
    }
    // text: hook for the first 2 s, captions after
    if (o.hook && t < 2) drawText(ctx, o.hook, H * 0.3, 84, o.captions === 'clean' ? 'clean' : 'box');
    if (o.captions !== 'off') {
      const l = lines.find((x) => t >= x.start && t < x.end);
      if (l) drawText(ctx, l.text, H * 0.62, 64, o.captions);
    }
    await vsrc.add(t, 1 / FPS);
    const now = performance.now();
    if (now - lastMsg > 250) { lastMsg = now; o.onProgress(0.05 + 0.93 * (n / frames), `Rendering frame ${n} of ${frames}`); await new Promise((r) => setTimeout(r)); }
  }
  vsrc.close();
  await output.finalize();
  const buf = (output.target as BufferTarget).buffer!;
  return {
    blob: new Blob([buf], { type: 'video/mp4' }),
    ms: performance.now() - T0, outSeconds: total, frames, segments: placed.length,
    aacNative, joins: placed.length - 1,
  };
}
