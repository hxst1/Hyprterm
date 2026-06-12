import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Identifica cada build: el server lo expone en /api/health y el cliente se
// recarga al detectar un build nuevo (las PWAs de iOS viven días en memoria
// y seguirían hablando un protocolo viejo con un server recién desplegado).
const buildId = Date.now().toString(36)

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  plugins: [
    react(),
    {
      name: 'write-build-id',
      apply: 'build',
      closeBundle() {
        writeFileSync(
          resolve(import.meta.dirname, 'dist', 'build-id.json'),
          JSON.stringify({ build: buildId }) + '\n'
        )
      }
    }
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:7705',
      '/ws': { target: 'ws://localhost:7705', ws: true }
    }
  }
})
