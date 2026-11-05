import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In development the API (port 5000) is proxied so the browser talks to one origin.
export default defineConfig({
  plugins: [react()],
  build: { chunkSizeWarningLimit: 800 },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
      '/socket.io': { target: 'http://localhost:5000', ws: true },
    },
  },
});
