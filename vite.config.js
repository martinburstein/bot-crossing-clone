import { defineConfig } from 'vite'
import { cpSync, existsSync } from 'node:fs'
import path from 'node:path'
import { apiMiddleware } from './server/api.mjs'
import { artifactMiddleware, isPublicArtifact } from './server/dyson-artifacts.mjs'

/** Serves /api from inside the Vite dev server, so `npm run dev` is the whole game. */
const api = () => ({
  name: 'bot-crossing-api',
  configureServer(server) {
    server.middlewares.use(apiMiddleware)
  },
})

// Serve CAD JavaScript verbatim, instead of Vite treating it as a browser module.
const dysonArtifacts = () => ({
  name: 'dyson-artifacts',
  configureServer(server) {
    server.middlewares.use(artifactMiddleware())
  },
  closeBundle() {
    if (existsSync('artifacts/dyson')) cpSync('artifacts/dyson', 'dist/artifacts/dyson', {
      recursive: true,
      filter: source => isPublicArtifact(path.relative('artifacts/dyson', source)),
    })
  },
})

export default defineConfig({
  plugins: [api(), dysonArtifacts()],
  // PORT lets a second copy run alongside the first without a flag on the command line.
  server: { port: Number(process.env.PORT) || 5274, strictPort: false },
  build: { target: 'esnext', rollupOptions: { input: { main: 'index.html', dyson: 'dyson/index.html' } } },
})
