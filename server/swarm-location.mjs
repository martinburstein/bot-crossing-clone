import {readFileSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const viewerRoot=fileURLToPath(new URL('../',import.meta.url))
// Local installation configuration; never taken from HTTP request parameters.
export function resolveSwarmRoot({env=process.env,base=viewerRoot,config}={}) {
  const value=env.BOT_CROSSING_SWARM_ROOT || (config ?? JSON.parse(readFileSync(path.join(base,'swarm.config.json'),'utf8'))).root
  if(typeof value!=='string' || !value.trim()) throw Error('Configure a Swarm root directory')
  return path.resolve(base,value)
}
export const SWARM_ROOT=resolveSwarmRoot()
