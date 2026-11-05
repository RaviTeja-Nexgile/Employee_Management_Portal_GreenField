import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const port = Number(process.env.PORT ?? 5173)
const apiPort = Number(process.env.API_PORT ?? 8000)

// The Vite root is frontend/, which holds its own index.html. Vite serves that
// file for '/' and for every client-side route, so the app answers at the root.
export default defineConfig({
  plugins: [react()],
  root: 'frontend',
  publicDir: 'public',
  server: {
    host: '127.0.0.1',
    port,
    strictPort: true,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${apiPort}`,
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['../e2e/**', '**/node_modules/**'],
    css: false,
  },
})
