import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build output goes to client/dist, which Express serves in production.
// In development, /api and /health are forwarded to the Express server on port 3000.
export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
    },
  },
});
