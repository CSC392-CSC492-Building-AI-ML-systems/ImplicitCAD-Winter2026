import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:4000',
      '/render': 'http://localhost:8080',
    },
  },
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three/') || id.includes('node_modules/@react-three/')) {
            return 'three-vendor'
          }
          if (id.includes('node_modules/monaco-editor/')) {
            return 'monaco-vendor'
          }
        },
      },
    },
  },
})
