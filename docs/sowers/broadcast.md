# Optional local broadcast observations

Sowers can read a snapshot published by an external agent or orchestrator. This is an observation interface, not a roster, scheduler, run store, or agent control API. The viewer never writes the snapshot, starts models, updates a harness, or changes protocol state. There are no network reads or POST operations in the adapter.

Native Codex agent broadcasts currently have no supported automatic export through this adapter. Installing the viewer does not make native broadcasts appear. A separately authorized external producer must explicitly publish this schema from records it can actually observe. Session logs alone do not prove checkpoint acceptance or task completion.

## Configuration and integration

Set `SOWERS_BROADCAST_FILE` to an absolute local JSON file path before starting the viewer. An unset or empty value disables the source gracefully. Relative paths are rejected. The file must be a regular file no larger than 1 MiB (1,048,576 bytes). Symlinks to regular files are read normally. Publish by writing a temporary file and atomically renaming it over the configured path; partial, changing, unreadable or invalid files produce warnings and no threads. The adapter does not cache prior valid observations or create sidecars.

`loadSowersBroadcast({ file = process.env.SOWERS_BROADCAST_FILE } = {})` in `server/sowers-broadcast.mjs` returns a promise of:

```js
{ threads: [], configured: false, observedAt: null, warnings: [] }
```

`configured` means a nonempty configuration was supplied, not that the source was usable. Invalid configured snapshots return `configured: true`, `observedAt: null`, an empty thread list and a warning. Valid snapshots return their original `observedAt` and normalized threads. The server exposes this result through the read-only `GET /api/sowers/broadcast` endpoint; the viewer polls it alongside sessions.

Thread IDs are preserved exactly. Use the existing session ID including its harness prefix, such as `codex:<session UUID>`, when enriching an existing session. Integrators must merge by that exact ID rather than spawning another Sower. A broadcast-only ID can represent an external agent. Unknown top-level and thread fields are discarded; they cannot overwrite viewer capability, file, URL, reference or open-action fields.

## Version 1 schema

The root is `{ "version": 1, "observedAt": <positive safe integer epoch milliseconds>, "threads": [...] }`. `threads` is required, and an empty list is valid. A malformed entry, duplicate thread ID, malformed nested list, or duplicate milestone ID rejects the entire snapshot so incomplete replacement lists cannot silently appear authoritative.

Each thread is an object with these fields:

| Field | Accepted value and default |
| --- | --- |
| `id` | Required nonempty string with no outer whitespace; preserved exactly. |
| `title`, `project`, `assignmentState` | Optional strings; default empty. Assignment state is a producer-reported label, never inferred from elapsed time. |
| `running`, `hasError`, `unread` | Optional booleans; default false. Strings and numbers are rejected. |
| `constructionProgress` | Optional finite numeric fraction in `[0, 1]`; strings, null and out-of-range values reject the snapshot. |
| `plan` | Optional object with required `steps` array. Each step is an object with optional string `title` and required `status`: `pending`, `in_progress`, or `completed`. Empty steps imply no completion denominator. |
| `milestones` | Optional array, default empty. Each entry has required unique string `id`, optional string `title`, optional string `level` (default `minor`), optional boolean `accepted` (default false), optional string `status` (default `accepted` when `accepted: true`, otherwise `pending`), and optional `retractedAt` (null or positive safe integer epoch milliseconds). Use `level: "minor"` or `"major"` for the construction renderer. |
| `shellName`, `agentPath`, `preview`, `projectLabel` | Optional display strings. |

Accepted checkpoint records must explicitly include `accepted: true`; an omitted status then defaults to `accepted`. An explicit contradictory status such as `pending` is preserved and prevents acceptance. Pending, unaccepted, rejected, explicitly unaccepted, and retracted records do not earn construction modules. Use a stable milestone ID across revisions; include retractions in later observations. The latest snapshot replaces the previous list rather than accumulating a second history.

The adapter adds `source: "broadcast"`, `broadcastObservedAt` and `broadcastStale` to each normalized thread. It accepts only the fields above. Token counts, elapsed time, transcript size, `runClosed` and arbitrary completion labels cannot become construction percentages. A valid explicit fraction takes precedence over the declared plan denominator; checkpoint counts remain independent and do not define remaining work.

## Freshness and evidence limits

The default maximum snapshot age is 30,000 ms. `SOWERS_BROADCAST_MAX_AGE_MS` can set a positive finite number up to 86,400,000 ms; invalid values warn and use the default. Any future `observedAt` is also stale; the producer and viewer need synchronized clocks. File modification time does not renew evidence. A producer should refresh `observedAt` only after a real new observation, not just to keep an old record looking active.

Old or future observations retain their checkpoint and explicit completion evidence but get `broadcastStale: true`, `running: false`, and a warning. They must be labeled historical by the UI and must not claim current activity. A stale snapshot is not proof that an agent stopped, succeeded, or failed. A fresh snapshot is only as trustworthy as its external producer, and this schema does not verify checkpoint acceptance itself.

`examples/sowers-broadcast.json` is fictional schema data. Its sentinel `observedAt: 1` deliberately makes it historical; it is never a live claim. Replace the example contents with actual observed records before using this source.

Run adapter checks with `node --test test/sowers-broadcast.test.mjs`.
