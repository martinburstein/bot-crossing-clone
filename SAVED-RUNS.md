# Saved worlds

Bot Crossing can display a frozen 15/3A world alongside the live world. Choose a registered run in the Saved runs selector, or add `&run=Run-1` to the MAGI URL. The replay shows earned construction and parked workers, with an explicit replay label. It cannot resume execution or write the live colony, settings, or projection cache.

Register an archive directory locally by writing `run-archives.json` in the configured `BOT_CROSSING_DATA` directory: `{ "root": "absolute archive directory" }`. Each `Run-N` directory contains a `snapshot.json` with format `bot-crossing-run`, version 1, a world projection, and colony settings/layout, plus `snapshot.sha256`. Evidence data belongs in the research repository, never in the public viewer source. The API rejects modified snapshots, active workers, invalid identifiers, and paths outside the registered root.
