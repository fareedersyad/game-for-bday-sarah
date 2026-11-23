/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Base path resolution for GitHub Pages.
 *
 * - CI (deploy.yml) sets BASE_PATH to "/<repo-name>/" (or "/" for a <user>.github.io repo).
 * - Locally you can set VITE_BASE_PATH in .env.local.
 * - Fallback "./" produces a fully relative build that works from any sub-directory,
 *   which is safe because the app uses HashRouter and imports every asset through Vite.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = process.env.BASE_PATH || env.VITE_BASE_PATH || './';
  return {
    base,
    plugins: [react()],
    build: {
      target: ['es2020', 'safari14', 'chrome90', 'firefox90', 'edge90'],
      chunkSizeWarningLimit: 1600,
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            three: ['three'],
            r3f: ['@react-three/fiber', '@react-three/drei'],
            react: ['react', 'react-dom', 'react-router-dom'],
            motion: ['framer-motion'],
          },
        },
      },
    },
    server: { host: true, port: 5173 },
    preview: { host: true, port: 4173 },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  };
});
