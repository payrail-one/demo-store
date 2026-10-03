import { defineConfig } from 'vite';

export default defineConfig({
  root: new URL('.', import.meta.url).pathname,
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    host: '127.0.0.1',
    port: 4193,
    strictPort: true,
    proxy: {
      '/store': {
        target: process.env.STORE_API_PROXY ?? 'http://127.0.0.1:18082',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/store/, ''),
      },
      '/api': {
        target: process.env.DEVNET_API_PROXY ?? 'http://127.0.0.1:18080',
        changeOrigin: true,
      },
    },
  },
});
