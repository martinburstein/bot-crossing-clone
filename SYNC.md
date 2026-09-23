# Updating this local copy

This clone tracks https://github.com/martinburstein/bot-crossing-clone on `origin/main`.
Run these commands in the project folder with Git and Node.js on PATH.

```powershell
# Fetch and report the latest updates, without changing project files:
.\sync.cmd

# Fetch and apply available fast-forward updates:
.\sync.cmd --apply
```

The portable equivalents are `node tools/sync.mjs --check` and
`node tools/sync.mjs --apply`. The script locates the project relative to itself,
so it also works when invoked from another directory. `--help` shows usage.

The check runs on demand. It fetches the current branch's configured remote tracking
branch (initially `origin/main`), shows incoming and local commit counts, and lists
up to ten incoming commits. It does not check the original project's upstream fork
or run a background schedule. Network or Git failures return a nonzero exit code.

Update mode only fast-forwards. It stops for divergent history, modified tracked
files, or an unfinished Git operation. It never pushes, resets, rebases, cleans,
or automatically stashes your work. Git refuses to overwrite untracked or ignored
files that collide with incoming files. Local colony data stays in `data/`.

These sync helpers are included in this fork.
Untracked additions do not block updates unless an incoming file has the same name.
If you later modify tracked files, commit or stash those changes yourself before
updating. Local commits can cause divergence and require a manual merge or rebase.

After an update, refresh dependencies and restart the app:

```powershell
npm ci
npm run dev
```

For the production build, use `npm start` instead. Stop any running app before
applying an update. No dependency installation or app restart happens automatically.

Run the sync safety tests with `node --test test/sync.test.mjs`, or all tests with
`npm test`. The safety tests use disposable local Git repositories and no network.
