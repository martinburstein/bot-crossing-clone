import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

if (!existsSync(fileURLToPath(new URL('../dist/sowers/index.html',import.meta.url)))) {
  console.error('Build Sowers first: npm ci && npm run build')
  process.exitCode=1
} else {
  process.env.PORT ||= '5286'
  process.env.BOT_CROSSING_INCLUDE_SUBAGENTS ||= '1'
  const localObservation=fileURLToPath(new URL('../data/sowers-broadcast.json',import.meta.url))
  if(existsSync(localObservation)) {
    process.env.SOWERS_BROADCAST_FILE ||= localObservation
    process.env.SOWERS_BROADCAST_MAX_AGE_MS ||= '300000'
  }
  const localMonitor=fileURLToPath(new URL('../.codex/usage-monitor/token-monitor.cjs',import.meta.url))
  if(existsSync(localMonitor))process.env.SOWERS_USAGE_MONITOR ||= localMonitor
  console.log(`Sowers mission watch → http://127.0.0.1:${process.env.PORT}/sowers/`)
  console.log(`Character studio → http://127.0.0.1:${process.env.PORT}/sowers/studio/`)
  await import('../server/serve.mjs')
}
