# Native Codex public activity

The read-only Codex harness adds `activity` to its thread records. Its value is `null` when no supported public record was observed, or `{ kind, text, at }`:

| Field | Meaning |
| --- | --- |
| `kind` | `commentary` for an assistant commentary message, `message` for an assistant final message, or `tool` for a tool name |
| `text` | Whitespace-normalized public text, at most 480 JavaScript string characters; tool activity contains only a validated tool name, at most 96 characters |
| `at` | Source JSONL record timestamp as epoch milliseconds; `0` means unknown |

This is the latest supported record in transcript order, not a progress estimate. It remains historical after completion, abortion, or expiry of the running window. The lifecycle alone determines `running` and `hasError`; a public message or tool name cannot start a task. Consumers should display source age separately and keep unknown age unknown.

Only `response_item` records are supported. Assistant messages must explicitly declare `channel: "commentary"` or `channel: "final"`, and only content parts with `type: "output_text"` and string `text` are admitted. A `function_call` contributes only its `name`, validated against the ASCII identifier characters `[A-Za-z0-9_.:/-]` with a letter or underscore first. Arguments, call IDs, tool outputs, reasoning, analysis-channel messages, user messages, and unrecognized content shapes never contribute public activity. `event_msg.agent_message` is skipped because this implementation has no verified public-channel schema for it. Existing thread titles/previews retain their existing user-prompt behavior.

On a cold or replaced transcript, activity is found only in the final 128 KiB, independently of the existing backward lifecycle search. The first partial line and final unterminated line are excluded. A public message outside that window is unavailable until a supported new record is observed. This conservative bound also skips individual records exceeding 128 KiB. The existing lifecycle scanner may read farther back to find a genuine start or completion marker.

Unchanged transcripts incur no transcript reads. Appended bytes use the existing incremental lifecycle parser and its bounded partial-line buffer; supported activity updates share that pass. Previously observed public history survives appends even after it leaves the tail window. Replacement, truncation, or a detected rewrite invalidates that history. The existing prefix and checkpoint reads detect ordinary rewrites; arbitrary middle-only edits that preserve those checkpoints are outside the append-only cache contract. A transient read error preserves known public history while the existing conservative lifecycle handling reports no active work and retries on the next poll.

Validation: `node --test test/sowers-activity.test.mjs test/codex-subagents.test.mjs test/harness.test.mjs`. The focused performance fixture uses a 3 MiB rollout: an unchanged poll reads 0 transcript bytes, and five small public-message appends read 43,180 bytes total, including existing prefix/checkpoint validation. No full-history activity scan or endpoint changes were added. Non-Codex harnesses are unchanged.
