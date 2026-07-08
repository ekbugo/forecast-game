import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves this project under /forecast-game/ (repo name). Set
// GITHUB_PAGES=true at build time for that base; use a custom domain with
// VITE_CUSTOM_DOMAIN=true to serve from the root.
export default defineConfig({
  plugins: [react()],
  base:
    process.env.VITE_CUSTOM_DOMAIN === 'true'
      ? '/'
      : process.env.GITHUB_PAGES === 'true'
        ? '/forecast-game/'
        : '/',
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
