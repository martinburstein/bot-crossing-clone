import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

if (!existsSync(fileURLToPath(new URL('../dist/sowers/index.html',import.meta.url)))) {
  console.error('Build Sowers first: npm ci && npm run build')
  process.exitCode=1
} else {
  process.env.PORT ||= '5286'
  process.env.BOT_CROSSING_INCLUDE_SUBAGENTS ||= '1'
  console.log(`Sowers mission watch → http://127.0.0.1:${process.env.PORT}/sowers/`)
  console.log(`Character studio → http://127.0.0.1:${process.env.PORT}/sowers/studio/`)
  await import('../server/serve.mjs')
}
