# Sowers assembly study

Open `/sowers/assembly/` on the existing viewer. This is explicitly a fictional DESIGN SANDBOX. It imports the original `createMissionBase`, `createCheckpointExpansion`, `createSower` and `createHelmet` modules without changing live telemetry or any worker/session state. It makes no API or model calls.

The layout seed deterministically changes the actual base roof variant, service-pod position and checkpoint hardware. Habitat, power and relay are passed directly to the shared model factory: relay changes tower dimensions and dish size; power changes the solar outrigger placement. Seed variation is intentionally limited by that original model, not advertised as arbitrary building generation.

Manual assembly fraction scrubs the shared five physical stages: footings (0–16%), frame (16–38%), shell (38–68%), systems (68–94%) and beacon (94–100%). Stage buttons inspect the end of each phase; descriptions identify hardware added. A partially assembled phase is labelled as such. No timer or synthetic progress animation runs.

In **Checkpoints only** mode, completion explicitly remains **Unknown · no denominator**. The full shell is labelled as a fixed design reference. Only fictional accepted checkpoints attach hardware; retraction removes the last checkpoint's extension. Twelve extensions are the study limit, matching the shared factory. Checkpoints and completion remain independent in both modes.

Drag or arrow keys on the focused canvas orbit; scroll zooms. Camera presets provide overview, airlock and above views. Keys 1–5 inspect stages; R resets the camera. Native range/select/input controls retain keyboard behavior. Reduced motion starts the scout and beacon paused and disables orbit damping; motion remains an explicit toggle. The mobile layout stacks the model and controls. A WebGL failure presents readable fallback information and disables model controls.

This page owns no protocol or backend files. Its only state is in the page and resets on reload.
