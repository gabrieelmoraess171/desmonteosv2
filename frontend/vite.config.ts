import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
