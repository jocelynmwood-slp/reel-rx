// Runs Whisper in a background thread so the page doesn't freeze. Audio never leaves the device.
import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;
let asr: any = null;
let loadedKey = '';

self.onmessage = async (e: MessageEvent) => {
  const { model, device, audio } = e.data as { model: string; device: 'wasm' | 'webgpu'; audio: Float32Array };
  try {
    const key = model + '|' + device;
    const t0 = performance.now();
    if (loadedKey !== key) {
      const files: Record<string, { loaded: number; total: number }> = {};
      asr = await pipeline('automatic-speech-recognition', model, {
        device,
        dtype: device === 'webgpu'
          ? { encoder_model: 'fp32', decoder_model_merged: 'q4' }
          : { encoder_model: 'q8', decoder_model_merged: 'q8' },
        progress_callback: (p: any) => {
          if (p.status === 'progress' && p.file) {
            files[p.file] = { loaded: p.loaded, total: p.total };
            let l = 0, t = 0;
            for (const f of Object.values(files)) { l += f.loaded; t += f.total; }
            (self as any).postMessage({ type: 'download', loaded: l, total: t });
          }
        },
      });
      loadedKey = key;
    }
    const loadMs = performance.now() - t0;
    (self as any).postMessage({ type: 'loaded', loadMs });

    const t1 = performance.now();
    const out = await asr(audio, { return_timestamps: 'word', chunk_length_s: 30, stride_length_s: 5 });
    const transcribeMs = performance.now() - t1;
    (self as any).postMessage({ type: 'done', chunks: out.chunks, text: out.text, transcribeMs, loadMs });
  } catch (err: any) {
    (self as any).postMessage({ type: 'error', message: String(err?.message || err) });
  }
};
