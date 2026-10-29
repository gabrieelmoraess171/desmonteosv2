import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: ['desmonteos.onrender.com']
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'https://desmonteos-backend.onrender.com',
        changeOrigin: true
      },
      '/uploads': {
        target: 'https://desmonteos-backend.onrender.com',
        changeOrigin: true
      }
    }
  }
})
