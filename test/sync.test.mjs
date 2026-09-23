import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { syncProject } from '../tools/sync.mjs'

function git(cwd, ...args) {
  const result = spawnSync('git', ['-C', cwd, '-c', 'commit.gpgsign=false', ...args], {
    encoding: 'utf8', windowsHide: true,
  })
  assert.equal(result.status, 0, result.stderr || result.error?.message)
  return result.stdout.trim()
}

function fixture(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'bot-crossing-sync-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const remote = path.join(root, 'remote.git')
  const author = path.join(root, 'author')
  const local = path.join(root, 'local')
  mkdirSync(author)
  git(root, 'init', '--bare', '--initial-branch=main', remote)
  git(author, 'init', '--initial-branch=main')
  const commit = (cwd, name, content) => {
    writeFileSync(path.join(cwd, name), content)
    git(cwd, 'add', '--', name)
    git(cwd, '-c', 'user.name=Sync Test', '-c', 'user.email=sync@example.invalid', 'commit', '-m', name)
  }
  commit(author, 'app.txt', 'original\n')
  git(author, 'remote', 'add', 'origin', remote)
  git(author, 'push', '-u', 'origin', 'main')
  git(root, 'clone', remote, local)
  const publish = (name = 'app.txt', content = 'updated\n') => {
    commit(author, name, content)
    git(author, 'push', 'origin', 'main')
  }
  const sync = (apply = false) => syncProject({ cwd: local, apply, log: () => {} })
  return { root, remote, author, local, commit, publish, sync }
}

test('checking fetches new commits without changing HEAD or project files', (t) => {
  const f = fixture(t)
  const before = git(f.local, 'rev-parse', 'HEAD')
  const original = readFileSync(path.join(f.local, 'app.txt'), 'utf8')
  f.publish()
  const result = f.sync()
  assert.equal(result.status, 'behind')
  assert.equal(result.behind, 1)
  assert.equal(git(f.local, 'rev-parse', 'HEAD'), before)
  assert.equal(readFileSync(path.join(f.local, 'app.txt'), 'utf8'), original)
})

test('apply fast-forwards and preserves unrelated untracked helpers and ignored colony data', (t) => {
  const f = fixture(t)
  writeFileSync(path.join(f.local, 'sync-helper.txt'), 'local helper')
  writeFileSync(path.join(f.local, '.git/info/exclude'), 'data/\n')
  mkdirSync(path.join(f.local, 'data'))
  writeFileSync(path.join(f.local, 'data/colony.json'), '{"local":true}')
  f.publish()
  assert.equal(f.sync(true).status, 'updated')
  assert.equal(git(f.local, 'rev-parse', 'HEAD'), git(f.author, 'rev-parse', 'HEAD'))
  assert.equal(readFileSync(path.join(f.local, 'sync-helper.txt'), 'utf8'), 'local helper')
  assert.equal(readFileSync(path.join(f.local, 'data/colony.json'), 'utf8'), '{"local":true}')
  assert.equal(f.sync(true).status, 'current')
})

for (const staged of [false, true]) {
  test(`apply refuses ${staged ? 'staged' : 'unstaged'} tracked changes`, (t) => {
    const f = fixture(t)
    f.publish()
    writeFileSync(path.join(f.local, 'app.txt'), 'my work')
    if (staged) git(f.local, 'add', 'app.txt')
    const before = git(f.local, 'rev-parse', 'HEAD')
    assert.throws(() => f.sync(true), /local changes/)
    assert.equal(git(f.local, 'rev-parse', 'HEAD'), before)
    assert.equal(readFileSync(path.join(f.local, 'app.txt'), 'utf8'), 'my work')
  })
}

test('local-only commits are reported; divergent history is never merged', (t) => {
  const f = fixture(t)
  f.commit(f.local, 'local.txt', 'local commit')
  assert.equal(f.sync(true).status, 'ahead')
  const before = git(f.local, 'rev-parse', 'HEAD')
  f.publish()
  assert.equal(f.sync().status, 'diverged')
  assert.throws(() => f.sync(true), /diverged/)
  assert.equal(git(f.local, 'rev-parse', 'HEAD'), before)
})

for (const ignored of [false, true]) {
  test(`apply preserves a colliding ${ignored ? 'ignored' : 'untracked'} file`, (t) => {
    const f = fixture(t)
    if (ignored) writeFileSync(path.join(f.local, '.git/info/exclude'), 'new.txt\n')
    writeFileSync(path.join(f.local, 'new.txt'), 'precious local content')
    f.publish('new.txt', 'remote content')
    const before = git(f.local, 'rev-parse', 'HEAD')
    assert.throws(() => f.sync(true), /overwritten/)
    assert.equal(git(f.local, 'rev-parse', 'HEAD'), before)
    assert.equal(readFileSync(path.join(f.local, 'new.txt'), 'utf8'), 'precious local content')
  })
}

test('an unavailable remote fails without moving HEAD', (t) => {
  const f = fixture(t)
  const before = git(f.local, 'rev-parse', 'HEAD')
  git(f.local, 'remote', 'set-url', 'origin', path.join(f.root, 'missing.git'))
  assert.throws(() => f.sync(true), /repository/)
  assert.equal(git(f.local, 'rev-parse', 'HEAD'), before)
})

test('detached HEAD fails without changing files', (t) => {
  const f = fixture(t)
  const original = readFileSync(path.join(f.local, 'app.txt'), 'utf8')
  git(f.local, 'checkout', '--detach')
  assert.throws(() => f.sync(true))
  assert.equal(readFileSync(path.join(f.local, 'app.txt'), 'utf8'), original)
})

test('unfinished Git operation blocks application', (t) => {
  const f = fixture(t)
  f.publish()
  writeFileSync(path.join(f.local, '.git/CHERRY_PICK_HEAD'), git(f.local, 'rev-parse', 'HEAD'))
  assert.throws(() => f.sync(true), /existing Git operation/)
})
