import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 3000,
      proxy: {
        '/api': env.VITE_API_URL || 'http://localhost:14000',
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
  }
})
