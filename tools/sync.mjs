import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))

// Keep this utility independent of npm dependencies so it also works before installation.
export function syncProject({ cwd = projectRoot, apply = false, log = console.log } = {}) {
  const git = (...args) => {
    const result = spawnSync('git', ['-C', cwd, ...args], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120_000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    })
    if (result.error) throw new Error(`Git failed: ${result.error.message}`)
    if (result.status !== 0) {
      throw new Error(result.stderr.trim() || result.stdout.trim() || 'Git failed')
    }
    return result.stdout.trim()
  }

  const branch = git('symbolic-ref', '--quiet', '--short', 'HEAD')
  const remote = git('config', '--get', `branch.${branch}.remote`)
  const remoteBranch = git('config', '--get', `branch.${branch}.merge`)
  const upstream = git('rev-parse', '--symbolic-full-name', '@{upstream}')
  if (remote === '.' || !upstream.startsWith('refs/remotes/') || !remoteBranch.startsWith('refs/heads/')) {
    throw new Error('The current branch must track a branch on a remote repository.')
  }

  log(`Checking ${remote}/${remoteBranch.slice('refs/heads/'.length)} for updates...`)
  // An explicit refspec fails if the remote branch was deleted, instead of trusting stale refs.
  git('fetch', '--no-tags', remote, `+${remoteBranch}:${upstream}`)
  const target = git('rev-parse', upstream)
  const [ahead, behind] = git('rev-list', '--left-right', '--count', `HEAD...${target}`)
    .split(/\s+/).map(Number)
  const status = ahead && behind ? 'diverged' : behind ? 'behind' : ahead ? 'ahead' : 'current'
  log(`${branch}: ${behind} incoming commit(s), ${ahead} local commit(s).`)

  if (status === 'diverged') {
    const message = 'Local and remote history have diverged. Resolve the history manually before syncing.'
    if (apply) throw new Error(message)
    log(message)
  } else if (!behind) {
    log('No incoming updates. Your local copy contains the latest remote commits.')
  } else {
    log(git('log', '--oneline', '-10', `HEAD..${target}`))
    if (apply) {
      for (const marker of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply', 'sequencer']) {
        const markerPath = git('rev-parse', '--git-path', marker)
        if (existsSync(path.resolve(cwd, markerPath))) {
          throw new Error('Finish or abort the existing Git operation before syncing.')
        }
      }
      if (git('status', '--porcelain', '--untracked-files=no')) {
        throw new Error('Tracked files have local changes. Commit or stash them yourself before syncing.')
      }
      // Git also refuses collisions with untracked files; protect ignored files explicitly.
      // Disable autostash even if enabled in the user's global Git configuration.
      git('merge', '--ff-only', '--no-autostash', '--no-overwrite-ignore', target)
      log('Updated successfully. Run npm ci, then restart the app (npm run dev or npm start).')
      return { status: 'updated', ahead, behind, target }
    }
    log('To apply these updates, run: node tools/sync.mjs --apply')
  }
  return { status, ahead, behind, target }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  if (args.includes('--help')) {
    console.log('Usage: node tools/sync.mjs [--check | --apply]\nDefault: check for updates without changing project files.')
  } else if (args.length > 1 || args.some((arg) => !['--check', '--apply'].includes(arg))) {
    console.error('Usage: node tools/sync.mjs [--check | --apply]')
    process.exitCode = 1
  } else {
    try {
      syncProject({ apply: args.includes('--apply') })
    } catch (error) {
      console.error(`Sync failed: ${error.message}`)
      process.exitCode = 1
    }
  }
}
