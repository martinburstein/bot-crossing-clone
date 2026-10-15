import fs from 'node:fs/promises'
import path from 'node:path'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let controller, initializing, selectedId, idleTimer
const unknown = () => ({tokens:null,remaining:null,tokenStatus:'unavailable',accountStatus:'unavailable'})

// Allowlist the two readouts. Never expose session contents, paths, or task lists.
export function projectTokenHud(value) {
  return Object.fromEntries(['taskId','taskTitle','tokens','tokenStatus','tokenAt','accountStatus','accountAt','remaining','windowMinutes','resetsAt'].map(key => [key,value[key] ?? null]))
}
export function closeTokenHud() {
  clearTimeout(idleTimer); controller?.close(); controller = null; selectedId = null
}
async function initialize(config) {
  const counterRoot = path.resolve(config.counterRoot || path.join(root, '..', 'Token Counter'))
  const {CodexMonitor} = require(path.join(counterRoot,'src/codex-monitor.cjs'))
  const {UsageClient} = require(path.join(counterRoot,'src/usage-client.cjs'))
  const {TokenCounterController} = require(path.join(counterRoot,'src/controller.cjs'))
  controller = new TokenCounterController({monitor:new CodexMonitor({pollMs:2000}),usage:new UsageClient(),selectedId:config.chatId})
  selectedId = config.chatId
  await controller.start()
}
export async function readTokenHud() {
  try {
    const config = JSON.parse(await fs.readFile(path.join(root,'data/dual-view.json'),'utf8'))
    if (!/^[a-f0-9-]{36}$/i.test(config.chatId)) return unknown()
    if (!controller) {
      initializing ??= initialize(config).catch(error => {closeTokenHud();throw error}).finally(() => {initializing = null})
      await initializing
    } else if (selectedId !== config.chatId) {controller.select(config.chatId);selectedId = config.chatId}
    clearTimeout(idleTimer); idleTimer = setTimeout(closeTokenHud,60000); idleTimer.unref()
    return projectTokenHud(controller.snapshot())
  } catch {return unknown()}
}
