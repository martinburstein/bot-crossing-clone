// Compatibility launcher only. The independent Swarm owns all tactics and state.
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import {SWARM_ROOT} from '../server/swarm-location.mjs'
await import(pathToFileURL(path.join(SWARM_ROOT,'tools','swarm.mjs')).href)
