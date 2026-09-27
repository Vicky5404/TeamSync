import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load all env vars (including non-VITE_ ones) for dev-server-only settings.
  // Only VITE_-prefixed variables are ever exposed to client code.
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.DEV_API_PROXY_TARGET;

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      strictPort: false,
      proxy: proxyTarget
        ? {
            '/api': { target: proxyTarget, changeOrigin: true },
            '/ws': { target: proxyTarget.replace(/^http/, 'ws'), ws: true },
          }
        : undefined,
    },
    preview: {
      port: 4173,
    },
    build: {
      target: 'es2022',
      sourcemap: mode !== 'production' ? true : 'hidden',
      chunkSizeWarningLimit: 700,
    },
  };
});
