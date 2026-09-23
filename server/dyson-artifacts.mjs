import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const artifactRoot = fileURLToPath(new URL('../artifacts/dyson/', import.meta.url))
export const isPublicArtifact = relative => !relative.split(/[\\/]/).some(part => part.startsWith('.') || ['build','__pycache__'].includes(part))

// Both dev and production read the current mission files, so long runs need no rebuild.
export function artifactMiddleware(root = artifactRoot) {
  root = path.resolve(root)
  return async (req, res, next) => {
    let pathname
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname) } catch { return next() }
    if (!pathname.startsWith('/artifacts/dyson/')) return next()
    const relative = pathname.slice('/artifacts/dyson/'.length)
    if (!isPublicArtifact(relative)) { res.writeHead(404).end('Artifact not found'); return }
    const file = path.resolve(root, relative)
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end('Forbidden'); return }
    try {
      const body = await readFile(file)
      const types = { '.md':'text/plain; charset=utf-8', '.json':'application/json', '.js':'text/plain; charset=utf-8', '.mjs':'text/plain; charset=utf-8', '.csv':'text/csv; charset=utf-8', '.png':'image/png' }
      res.writeHead(200, { 'Content-Type':types[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store' })
      res.end(body)
    } catch { res.writeHead(404).end('Artifact not found') }
  }
}
