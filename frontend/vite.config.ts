import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['myapp.local'],
    watch: {
      usePolling: true, // Forces Vite to check for file changes in Docker on Windows
    },
    hmr: {
      clientPort: 80, // Routes the WebSocket through your Ingress instead of port 5173
      host: 'myapp.local'
    }
  }
})