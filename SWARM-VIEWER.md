# Swarm visual adapter

The protocol lives in ../Swarm. Read its README.md and AGENTS.md for task orchestration. This clone contains presentation code and a read-only bridge.

Install Swarm separately; it is not bundled with this viewer repository. The external lib/state.mjs must export loadSwarm(root), returning {roster, active, externalWorkers?, runtimeWarnings?}, and scrollFor(shellId, root), returning scroll text or null. Swarm owns schema validation and state changes. Without that installation, the ordinary colony still works and the API reports an integration warning. Adapter tests use a synthetic external provider and require no personal Swarm installation.

swarm.config.json selects a Swarm installation relative to this clone, independently of the current working directory. BOT_CROSSING_SWARM_ROOT overrides it with an absolute path or a path relative to the clone. Restart the server after changing the installation or its JavaScript modules; Node caches imports. Data files are read live.

server/swarm.mjs imports the selected installation's lib/state.mjs and converts its roster and assignments into stable colored hexagon records. Runtime status still comes from exact observed worker bindings. The protocol owns all mutations, state validation, task preparation, review gates and history.

tools/swarm.mjs is a compatibility launcher only. The canonical CLI and tests live in ../Swarm. No browser or HTTP route invokes protocol mutation functions.

Existing Dyson artifacts remain product deliverables served by the viewer; they are not Swarm infrastructure. Their historical workspace is recorded in ../Swarm/WORKSPACES.json. The old clone/swarm directory tree is empty after migration; it is neither read nor written by this application.

Local artifacts and machine-specific agent settings are ignored by Git. The optional artifact routes show files only when they exist in the local workspace. The preserved Dyson test package is in ../Swarm/examples/dyson; run npm run test:dyson from Swarm. That package and its engineering evidence stay outside this viewer repository.
