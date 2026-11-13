import { defineConfig } from 'vite';

// COOP/COEP make the page "cross-origin isolated" so the in-browser engines can use several threads.
const isolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  server: { headers: isolation, host: '127.0.0.1', port: 5173 },
  preview: { headers: isolation, host: '127.0.0.1', port: 4173 },
  worker: { format: 'es' },
  build: { target: 'es2022' },
});
