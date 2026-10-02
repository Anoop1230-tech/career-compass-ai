import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Where the FastAPI backend runs during development.
const API_TARGET = process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // IPv4 loopback so both http://localhost:5173 and http://127.0.0.1:5173 work.
    // Loopback only: the dev server is not exposed to your Wi-Fi network.
    host: '127.0.0.1',
    port: 5173,
    strictPort: true, // fail loudly instead of silently moving to 5174
    // Proxy: the browser calls /api/... on the SAME origin (5173) and Vite
    // forwards it to FastAPI. No CORS issues, no hardcoded backend URL.
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    include: ['src/**/*.test.{js,jsx}'],
    css: false,
    // vmThreads: one jsdom per worker instead of one per test file, with each file
    // still isolated in its own VM context
    pool: 'vmThreads',
    // the full profile-form test types into ~20 fields; allow for a busy machine
    testTimeout: 15000,
  },
})
