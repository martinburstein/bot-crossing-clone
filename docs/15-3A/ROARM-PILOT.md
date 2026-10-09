Current campus profile: Melchior is the permanent blue pilot, Balthasar is the green rooted camper, and Casper alone runs one of fifteen executor roles. The pilot has a separate larger pod and instruction-download state; these do not alter controller authority. See ../../../swarm-protocol/docs/ROARM-CAMPUS.md. The legacy profile details below remain compatibility references.

# RoArm pilot and sensor mirror

The current `roarm-16` profile has one permanent Melchior captain, w00, and fifteen shared specialist roles. Balthasar and Casper each adopt any role, including the same one, in separate executor slots. Three actual sessions serve sixteen personas. The captain stays at the station between turns, wears a larger distinctive suit and helmet, and is excluded from vehicle rentals. A revisioned duty change allows a camp break only without an active pilot turn or unfinished pilot-dependent task. Station duty and model execution remain separate. Legacy 15/3A pilot handoffs remain supported in legacy runs.

`GET /api/roarm/observation` reads the existing controller's fixed loopback `/api/status` endpoint using the sibling robot checkout's private access file on the server. It never connects serial, arms, changes ownership, or sends movement. Only fresh measured hardware joints, or explicitly labelled simulator joints, are projected. Failed/stale feeds hold the last valid pose. Browser and API output contain no controller credentials or raw history. No webcam capture is involved.

The low-polygon model uses the local controller's June 30 EEMode-0 linkage dimensions and joint conventions. This is a geometric illustration, not installed-firmware attestation or calibrated visual control. The forklift-style cab sits at the motherboard/base with two excavator-style levers. It follows base yaw; shoulder, elbow and jaw motion do not move the seat. The jaw opening is illustrative, not a calibrated distance. No arm appears before the first valid sample; the captain waits nearby until then.

Checks: `node --test test/roarm-*.test.mjs`, `npm test`, `npm run build`. The isolated browser fixture `tools/check-roarm-pilot.cjs` verifies one seated pilot, moving attachment, stale freeze, and a key handoff without hardware commands or model calls. Screenshots are rendered application scenes only.

## Joint preview and earned wearables

Open the shared worksite board and choose **Simulate joints**. A fresh observation initializes the joint controls. **Preview** animates a cyan ghost; the solid arm continues to represent measured observations. **Reset preview** removes the ghost. Stale or unavailable observations disable a new preview. The preview is an illustrative geometric simulation, without collision checking or a hardware execution path.

The lead can call `window.roarmSimulation.preview(moves)` with one to ten full `{base, shoulder, elbow, gripper}` poses in raw radians; the starting pose comes from the latest read-only observation. `snapshot()` reports preview state and `clear()` removes it. Preview bounds do not authorize physical joint limits.

The canonical protocol awards a wearable only after independent review and acceptance of an eligible important RoArm contract. The browser renders safe primitive recipes attached to the animated head or back; the latest earned item is worn and the inspector retains the inventory. Recipe geometry must be distinct from existing awards and pending proposals; recoloring alone is not a new design. This is uniqueness within the saved ledger, not a claim about all hats ever made.

Accepted work also saves a predecessor-authored successor objective, acceptance criteria and evidence requirements. These are proposed future work, not automatic execution. Awards and contracts survive reopening the same canonical run. The RoArm16 protocol also supports an explicit pre-work import verified against a source checkpoint, preserving original records and attribution. New slot rewards retain the same slot as successor. The captain uniform is separate from earned items.

The 225 ordered pair skills and fifteen role files live in the sibling protocol checkout; see `../swarm-protocol/docs/ROARM16.md` from the Desktop workspace. `tools/check-roarm16.cjs` exercises sixteen bodies, two independent same-role slots, one base-mounted captain, and explicit rest/return using intercepted synthetic data. It saves application renders only.

`tools/check-roarm-contracts.cjs` uses committed synthetic fixtures, intercepts every API request, checks all three hats, fresh/stale preview behavior and measured/ghost separation, and saves only rendered application screenshots. Set `BOT_CROSSING_TEST_URL` to the running loopback viewer URL before executing it. No webcam images are captured or saved.
