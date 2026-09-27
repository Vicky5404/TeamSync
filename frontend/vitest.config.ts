import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
    css: false,
    // Deterministic client configuration (real-time disabled unless a test opts in).
    env: {
      VITE_APP_NAME: 'FlowSync',
      VITE_API_BASE_URL: '/api/v1',
      VITE_API_TIMEOUT_MS: '15000',
      VITE_WS_URL: '',
      VITE_UPLOAD_MAX_FILE_SIZE_MB: '25',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/vite-env.d.ts'],
    },
  },
});
