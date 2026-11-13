import { canEncodeAudio, canEncodeVideo, Input, ALL_FORMATS, BlobSource, AudioBufferSink } from 'mediabunny';
import { energy, buildItems, keptSegments, type Item } from './analysis';
import { exportReel, place } from './export';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const video = $<HTMLVideoElement>('video');
const logEl = $('log'), statusEl = $('status'), prog = $<HTMLProgressElement>('prog');
const log = (m: string) => { logEl.textContent += `[${(performance.now() / 1000).toFixed(1)}s] ${m}\n`; logEl.scrollTop = 1e9; console.log(m); };
const status = (m: string) => { statusEl.textContent = m; };
// Remember the current stage so a silent page restart (phone out of memory) can be reported on the next load.
const stage = (name: string) => { try { sessionStorage.setItem('rx-stage', JSON.stringify({ name, t: Date.now(), model: ($('model') as HTMLSelectElement)?.value })); } catch {} };
const stageDone = () => { try { sessionStorage.removeItem('rx-stage'); } catch {} };
window.addEventListener('error', (e) => { status('Error: ' + e.message); log('window error: ' + e.message); });
window.addEventListener('unhandledrejection', (e) => { status('Error: ' + (e.reason?.message || e.reason)); log('unhandled: ' + (e.reason?.stack || e.reason)); });
try {
  const prev = sessionStorage.getItem('rx-stage');
  if (prev) { const p = JSON.parse(prev); setTimeout(() => { status(`The page restarted by itself while "${p.name}" (${p.model}). That almost always means the phone ran out of memory. Try the tiny model.`); setR('Last run', `<span class="bad">page restarted during "${p.name}" with ${p.model}: out of memory</span>`); }, 0); sessionStorage.removeItem('rx-stage'); }
} catch {}
if (/iPhone|iPad|Android/i.test(navigator.userAgent)) {
  // Tested 2026-11-10: base.en crashes iPhone Safari (out of memory); tiny.en works. Phones get tiny only.
  const m = $('model') as HTMLSelectElement;
  m.value = 'Xenova/whisper-tiny.en';
  Array.from(m.options).forEach((o) => { if (o.value !== 'Xenova/whisper-tiny.en') { o.disabled = true; o.textContent += ' (laptop only)'; } });
}

let file: File | null = null;
let url = '';
let items: Item[] = [];
let en = new Float32Array();
let fullAudio: AudioBuffer | null = null;
let duration = 0;
let anchor: number | null = null;
let worker: Worker | null = null;
const report: Record<string, string> = {};
const setR = (k: string, v: string) => { report[k] = v; renderReport(); };
function renderReport() {
  $('report').innerHTML = Object.entries(report).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
}

async function environment() {
  setR('Browser', navigator.userAgent);
  setR('Cross-origin isolated (threads)', String(self.crossOriginIsolated));
  setR('Cores / memory', `${navigator.hardwareConcurrency} cores / ${(navigator as any).deviceMemory ?? '?'} GB`);
  setR('WebGPU', 'gpu' in navigator ? 'present' : 'absent');
  setR('WebCodecs VideoEncoder', 'VideoEncoder' in self ? 'yes' : 'NO');
  try { setR('H.264 encode', String(await canEncodeVideo('avc'))); } catch { setR('H.264 encode', 'check failed'); }
  try { setR('AAC encode (native)', (await canEncodeAudio('aac')) ? 'native' : 'needs add-on'); } catch { setR('AAC encode (native)', 'check failed'); }
}

function renderTranscript() {
  const el = $('transcript');
  el.innerHTML = '';
  for (const it of items) {
    const s = document.createElement('span');
    s.dataset.id = String(it.id);
    if (it.kind === 'word') s.className = 'w' + (it.cut ? ' cut' : '');
    else s.className = 'chip ' + it.kind + (it.cut ? ' cut' : '');
    s.textContent = it.kind === 'word' ? it.text.trim() : it.kind === 'pause' ? `· ${it.text} ·` : it.text;
    s.onclick = (ev) => onTap(it, ev as MouseEvent);
    el.append(s, ' ');
  }
  updateLens();
}

function onTap(it: Item, ev: MouseEvent) {
  if (ev.shiftKey && anchor != null) {
    const a = Math.min(anchor, it.id), b = Math.max(anchor, it.id);
    const to = !items[a].cut;
    for (let i = a; i <= b; i++) items[i].cut = to;
    anchor = null;
  } else { it.cut = !it.cut; anchor = it.id; }
  if (!it.cut) video.currentTime = it.start;
  renderTranscript();
}

function segments() { return keptSegments(items, en, duration); }
function updateLens() {
  const s = segments();
  const kept = s.reduce((a, x) => a + (x.out - x.in), 0);
  const tr = ($<HTMLSelectElement>('trans').value) as any;
  const total = place(s, tr).total;
  $('lens').textContent = `${total.toFixed(1)}s edited · was ${duration.toFixed(1)}s · ${s.length} clips kept (${kept.toFixed(1)}s before transition overlap)`;
}

// ---- preview: skip cut ranges, highlight the current word ----
let playing = false;
function tick() {
  if (!playing) return;
  const segs = segments(), t = video.currentTime;
  const cur = segs.find((s) => t >= s.in && t < s.out);
  if (!cur) {
    const nxt = segs.find((s) => s.in > t);
    if (nxt) video.currentTime = nxt.in; else { video.pause(); playing = false; $('play').textContent = '▶ Preview edit'; }
  }
  document.querySelectorAll('.w.now').forEach((e) => e.classList.remove('now'));
  const w = items.find((i) => i.kind === 'word' && t >= i.start && t < i.end);
  if (w) document.querySelector(`[data-id="${w.id}"]`)?.classList.add('now');
  requestAnimationFrame(tick);
}
$('play').onclick = () => {
  if (playing) { video.pause(); playing = false; $('play').textContent = '▶ Preview edit'; return; }
  const segs = segments();
  if (segs.length) video.currentTime = segs[0].in;
  video.play(); playing = true; $('play').textContent = '❚❚ Stop'; tick();
};

$('rmPause').onclick = () => { items.forEach((i) => { if (i.kind === 'pause') i.cut = true; }); renderTranscript(); };
$('rmUm').onclick = () => { items.forEach((i) => { if (i.kind === 'filler') i.cut = true; }); renderTranscript(); };
$('restore').onclick = () => { items.forEach((i) => (i.cut = false)); renderTranscript(); };
$('trans').onchange = updateLens;

// ---- file + transcription ----
$<HTMLInputElement>('file').onchange = (e) => {
  file = (e.target as HTMLInputElement).files?.[0] ?? null;
  if (!file) return;
  if (url) URL.revokeObjectURL(url);
  url = URL.createObjectURL(file);
  video.src = url;
  $<HTMLButtonElement>('go').disabled = false;
  setR('Clip', `${file.name} · ${(file.size / 1e6).toFixed(1)} MB`);
  video.onloadedmetadata = () => { duration = video.duration; setR('Clip length', `${duration.toFixed(1)} s · ${video.videoWidth}×${video.videoHeight}`); };
};

// Safari's own decoder often rejects iPhone .mov/.mp4 files, so read the audio track with Mediabunny first.
async function decodeFull(f: File): Promise<{ buf: AudioBuffer; how: string }> {
  const errs: string[] = [];
  try {
    const input = new Input({ source: new BlobSource(f), formats: ALL_FORMATS });
    const track = await input.getPrimaryAudioTrack();
    if (!track) throw new Error('no audio track in this file');
    if (!(await track.canDecode())) throw new Error(`this browser cannot decode the audio codec "${track.codec}"`);
    const sink = new AudioBufferSink(track);
    const chunks: AudioBuffer[] = [];
    let total = 0;
    for await (const w of sink.buffers()) { chunks.push(w.buffer); total += w.buffer.length; }
    if (!total) throw new Error('audio track was empty');
    const first = chunks[0];
    const buf = new AudioBuffer({ length: total, sampleRate: first.sampleRate, numberOfChannels: first.numberOfChannels });
    let off = 0;
    for (const c of chunks) { for (let k = 0; k < buf.numberOfChannels; k++) buf.copyToChannel(c.getChannelData(Math.min(k, c.numberOfChannels - 1)), k, off); off += c.length; }
    return { buf, how: `Mediabunny (${track.codec})` };
  } catch (e: any) { errs.push('Mediabunny: ' + (e?.message || e)); }
  try {
    const ctx = new AudioContext();
    const buf = await ctx.decodeAudioData(await f.arrayBuffer());
    ctx.close();
    return { buf, how: 'browser decoder' };
  } catch (e: any) { errs.push('Browser decoder: ' + (e?.message || e)); }
  throw new Error('Could not read the audio. ' + errs.join(' | '));
}

async function decodeAudio(f: File) {
  const t0 = performance.now();
  const { buf: full, how } = await decodeFull(f);
  const len = Math.ceil(full.duration * 16000);
  const off = new OfflineAudioContext(1, len, 16000);
  const src = off.createBufferSource(); src.buffer = full; src.connect(off.destination); src.start();
  const mono = (await off.startRendering()).getChannelData(0);
  setR('Audio decode', `${((performance.now() - t0) / 1000).toFixed(1)} s via ${how} · ${full.numberOfChannels} ch @ ${full.sampleRate} Hz`);
  return { full, mono: new Float32Array(mono) };
}

$('go').onclick = async () => {
  if (!file) return;
  const btn = $<HTMLButtonElement>('go'); btn.disabled = true;
  prog.hidden = false; prog.removeAttribute('value');
  try {
    stage('reading audio'); status('Reading the audio on this device…');
    const { full, mono } = await decodeAudio(file);
    fullAudio = full; duration = full.duration; en = energy(mono);
    stage('loading speech model'); const model = $<HTMLSelectElement>('model').value, device = $<HTMLSelectElement>('device').value as 'wasm' | 'webgpu';
    setR('Model / engine', `${model} / ${device}`);
    worker?.terminate();
    worker = new Worker(new URL('./whisper.worker.ts', import.meta.url), { type: 'module' });
    const t0 = performance.now();
    const hb = setInterval(() => { if (/Transcribing|Downloading/.test(statusEl.textContent || '')) statusEl.textContent = (statusEl.textContent || '').replace(/ \(\d+ s\)$/, '') + ` (${Math.round((performance.now() - t0) / 1000)} s)`; }, 1000);
    const res: any = await new Promise((resolve, reject) => {
      worker!.onmessage = (e) => {
        const d = e.data;
        if (d.type === 'download') { prog.max = d.total; prog.value = d.loaded; status(`Downloading speech model (once): ${(d.loaded / 1e6).toFixed(0)} / ${(d.total / 1e6).toFixed(0)} MB`); }
        else if (d.type === 'loaded') { stage('transcribing'); prog.removeAttribute('value'); status('On your device. Nothing uploaded. Transcribing…'); log(`model ready in ${(d.loadMs / 1000).toFixed(1)}s`); }
        else if (d.type === 'done') resolve(d);
        else if (d.type === 'error') reject(new Error(d.message));
      };
      worker!.onerror = (e) => reject(new Error(e.message));
      worker!.postMessage({ model, device, audio: mono });
    });
    clearInterval(hb);
    const words = (res.chunks as any[]).map((c) => ({ text: c.text as string, start: c.timestamp[0] as number, end: (c.timestamp[1] ?? c.timestamp[0] + 0.3) as number }));
    items = buildItems(words, en);
    setR('Model load (download + init)', `${(res.loadMs / 1000).toFixed(1)} s`);
    setR('Transcription', `${(res.transcribeMs / 1000).toFixed(1)} s for ${duration.toFixed(1)} s of video (${(res.transcribeMs / 1000 / duration).toFixed(2)}× real time)`);
    setR('Phone gate: transcribe ≤ 120 s per 60 s clip', res.transcribeMs / 1000 / duration * 60 <= 120 ? '<span class="good">pass (extrapolated)</span>' : '<span class="bad">FAIL (extrapolated)</span>');
    setR('Words / pauses / um? chips', `${words.length} / ${items.filter((i) => i.kind === 'pause').length} / ${items.filter((i) => i.kind === 'filler').length}`);
    log(`transcript: ${res.text}`);
    stageDone(); renderTranscript();
    ['rmPause', 'rmUm', 'restore', 'play', 'export'].forEach((id) => ($<HTMLButtonElement>(id).disabled = false));
    status(`Done in ${((performance.now() - t0) / 1000).toFixed(1)} s. Click words to cut them, then export.`);
  } catch (err: any) {
    stageDone(); status('Error: ' + err.message); log('ERROR ' + (err.stack || err.message));
    setR('Transcription', `<span class="bad">failed: ${err.message}</span>`); setR('File', `${file?.name} · ${file?.type || 'no type'} · ${((file?.size||0)/1e6).toFixed(1)} MB`);
  } finally { prog.hidden = true; btn.disabled = false; }
};

// ---- export ----
$('export').onclick = async () => {
  if (!file || !fullAudio) return;
  const btn = $<HTMLButtonElement>('export'); btn.disabled = true; stage('exporting');
  prog.hidden = false; prog.max = 1; prog.value = 0;
  const out = $('exportOut'); out.textContent = '';
  try {
    const r = await exportReel({
      file, audio: fullAudio, segments: segments(), items,
      transition: $<HTMLSelectElement>('trans').value as any,
      captions: $<HTMLSelectElement>('caps').value as any,
      hook: $<HTMLInputElement>('hook').value.trim(),
      onProgress: (f, m) => { prog.value = f; status(m); },
    });
    const secs = r.ms / 1000;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(r.blob); a.download = 'reel-rx-spike.mp4'; a.textContent = `Download reel-rx-spike.mp4 (${(r.blob.size / 1e6).toFixed(1)} MB)`;
    const v = document.createElement('video'); v.src = a.href; v.controls = true; v.style.cssText = 'max-height:480px;display:block;margin-top:8px;border-radius:8px';
    out.append(a, v);
    setR('Export', `${secs.toFixed(1)} s to render ${r.outSeconds.toFixed(1)} s (${(secs / r.outSeconds).toFixed(2)}× real time) · ${r.segments} clips, ${r.joins} joins · AAC ${r.aacNative ? 'native' : 'add-on'}`);
    setR('Phone gate: export ≤ 120 s per 60 s reel', secs / r.outSeconds * 60 <= 120 ? '<span class="good">pass (extrapolated)</span>' : '<span class="bad">FAIL (extrapolated)</span>');
    const mem = (performance as any).memory; if (mem) setR('JS heap (Chrome)', `${(mem.usedJSHeapSize / 1e6).toFixed(0)} MB used`);
    stageDone(); status('Export finished.');
  } catch (err: any) {
    stageDone(); status('Export error: ' + err.message); log('EXPORT ERROR ' + (err.stack || err.message));
    setR('Export', `<span class="bad">failed: ${err.message}</span>`);
  } finally { prog.hidden = true; btn.disabled = false; }
};

$('copy').onclick = async () => {
  const text = Object.entries(report).map(([k, v]) => `${k}: ${v.replace(/<[^>]+>/g, '')}`).join('\n');
  await navigator.clipboard.writeText(text); $('copy').textContent = 'Copied ✓';
  setTimeout(() => ($('copy').textContent = 'Copy report'), 1500);
};

environment();
(window as any).__spike = { get items() { return items; }, segments, report };
