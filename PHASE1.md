# Phase 1 spike: results (2026-11-09, Sonnet)

Run: `npm run dev` → http://127.0.0.1:5173 (Chrome 156, Mac, 4 cores, 16 GB). Test clip: 17.7 s synthetic speech
(macOS `say`, 720×1280, with um/uh and two long pauses). Bare page: `index.html`, `src/{main,analysis,export}.ts`,
`src/whisper.worker.ts`.

## Done and working (laptop Chrome)
| Test | Result |
|---|---|
| Cross-origin isolation (COOP/COEP headers, threads) | works; HF model download not blocked |
| On-device transcription, word timestamps | tiny.en 3.7 s (0.21x real time), base.en 6.0 s (0.34x) for 17.7 s |
| Model download + init | base.en 26 s first time (cached after) |
| Pause detection | works after fix: word edges are trimmed to real sound (Whisper stretches them over silence). Found 0.4-1.9 s pauses |
| Cut by tapping words, shift-click range | works; kept segments computed, edges snapped to quietest point +/-150 ms |
| Export 1080x1920 H.264 + AAC MP4 | works; 1.4-1.6x real time on laptop Chrome; length matches the timeline math |
| Smart punch-in, crossfade (0.25 s), hard cuts | all render; crossfade shortens video as designed |
| Hook text, re-timed burned-in captions | rendered correctly (screenshot checked) |
| Native H.264 + AAC encode in Chrome | yes (AAC add-on not needed there; Safari still untested) |
| JS heap during export | 62 MB |

## NOT tested yet (needs Jocelyn)
1. **Real voice, real mic:** the synthetic "um"s were transcribed as words, so the `um?` chip path (audio-only
   filler detection) is unproven. Thresholds were tuned on synthetic audio.
2. **Listening test:** do cuts sound clean (no clipped syllables, no clicks)? Cannot be judged without ears.
3. **iPhone (the D3 gate):** 60 s clip, tiny + base, transcribe <= 2 min and export <= 2 min.
4. **Safari (Mac + iPhone) and Edge:** AAC add-on path, WebCodecs, memory.
5. **3-minute clip** memory; **Instagram upload** of the exported MP4.
6. GPU engine option exists in the page but was not tested.

## How to run the tests
`cd ~/Code/reel-rx-editor && npm run dev`, open the page, choose a real reel (no client footage!), Transcribe,
cut some words, Export, then "Copy report" and paste it back. For the phone: deploy a preview to Cloudflare Pages
(needs the `_headers` file, already in `public/`) and open it on the iPhone.

## Preview deploy (2026-11-09/10)
Live at **https://preview.reel-rx.pages.dev** (Cloudflare Pages project `reel-rx`, account jocelyn.m.wood@gmail.com).
Verified on the live URL: cross-origin isolated, COOP/COEP headers served, native H.264/AAC, jsdelivr wasm reachable.
NOT yet verified on the live URL: a full transcribe + export (done only on localhost).
Deploy: `export CLOUDFLARE_ACCOUNT_ID=8ecc2e71c03c9c95866527e50a0945b5; npm run build; npx wrangler pages deploy dist --project-name reel-rx --branch preview`
(project was created with `--force`; do not pass `--force` again). `npm run build` deletes the 25.6 MiB ONNX wasm from `dist`
(Pages caps files at 25 MiB); the page loads it from jsdelivr, so the first run needs internet.
The page is unlisted but public: it has no client data, but don't share the link widely.

## iPhone results (2026-11-10, Jocelyn's iPhone, Safari)
- Isolated: true. H.264 + AAC encode native. WebGPU present.
- First run: transcribe failed with 'decoding failed' (Safari's audio reader rejects the iPhone file) -> fixed by reading audio with Mediabunny.
- **tiny.en: transcribed in 8 s. PASS (gate: <= 120 s per 60 s).**
- **base.en: page restarted itself = out of memory. Phones are locked to tiny.**
- Export on iPhone: NOT yet tested.
