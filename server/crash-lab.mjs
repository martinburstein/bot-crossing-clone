import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../crypto-research-lab/projects/crypto-swarm-2026-10-15/office')
export async function readCrashLab({ officeRoot = process.env.BOT_CROSSING_OFFICE_ROOT ?? root } = {}) {
  try {
    const raw = await fs.readFile(path.join(officeRoot, 'crash-lab.json'), 'utf8')
    if (raw.length > 300000) throw Error('Paper crash study is too large')
    const data = JSON.parse(raw)
    if (data.schemaVersion !== 1 || data.paperOnly !== true || !Array.isArray(data.positions) || data.positions.length > 12)
      throw Error('Invalid paper crash study')
    return data
  } catch (e) {
    if (e.code === 'ENOENT') return { schemaVersion:1, paperOnly:true, positions:[], researchStatus:'No saved crash study' }
    throw e
  }
}
