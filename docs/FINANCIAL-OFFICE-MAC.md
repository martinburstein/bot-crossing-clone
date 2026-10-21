# Financial office on macOS

The named presentation launcher supports Windows and macOS:

```sh
node tools/named-dual-view.mjs big-crypto-short
```

Keep the private research checkout named `crypto-research-lab` beside this viewer.
Build this viewer with Node 22.13 or newer, `npm ci --ignore-scripts --no-audit --no-fund`,
then `npm run build`. Generated GLB assets are committed; raw art packs are optional.
The private research repository supplies the project history, paper ledger and restore
instructions. No private research or saved colony state belongs in this public viewer.

The office no longer requires a sibling `swarm-protocol` checkout. An already configured
protocol can provide optional read-only telemetry; launching the office does not start it.
Missing Token Counter telemetry remains unavailable rather than being fabricated.

On Mac, the launcher opens the office in Google Chrome by default, reuses or opens a
Chrome office window on the right, and positions the
already open caller app on the left. The caller defaults to `Codex`; set
`BOT_CROSSING_CALLER_APP` only when the visible caller has a different process name.
The OS may require Automation and Accessibility permission for the invoking app.
The office opens in Chrome before positioning is attempted, so it remains available
if window positioning times out or permissions are missing.
The launcher reads window positions/sizes back and reports `layout.verified`; minimum
window sizes or a small screen can prevent equal halves. This Mac UI path must be checked
on the target Mac; Windows tests cannot establish that its OS permissions are granted.

`--no-open` starts/verifies the loopback viewer without changing windows. Optional
`BOT_CROSSING_OFFICE_ROOT` and `BOT_CROSSING_OFFICE_PORT` select a project/port. A server
from a different checkout or project is refused. The launcher never stops an unknown
Mac process to claim a port. The original Waveshare canon and its Windows launcher are
preserved; this Mac port is specifically the financial office.

Apple's UI scripting permission reference:
https://developer.apple.com/library/archive/documentation/LanguagesUtilities/Conceptual/MacAutomationScriptingGuide/AutomatetheUserInterface.html
