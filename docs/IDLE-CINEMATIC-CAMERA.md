# Idle cinematic camera

After 30 seconds without pointer, wheel, or keyboard input, the camera gently tours the scene. It alternates wide establishing views, resident tracking, and closer portraits. The financial office includes the desks, bank, campfire, and coffee/library area. Transitions are continuous glides; scenes and residents keep their normal presentation behavior.

Any input hands the camera back immediately. Picking a bot, resetting the view, or choosing a focus point starts a fresh delay. Explicit orbit mode takes precedence. Hidden tabs, replay mode, form editing, reduced motion, and a disabled camera suppress the director. The bottom-right Cinematic button toggles it, starting immediately when enabled; I toggles the saved preference. This is a viewer feature, not an operating-system screensaver or worker execution. The existing C shortcut for a new conversation is preserved.

For diagnostics, `window.idleCamera.snapshot()` reports the delay, current shot, subject, and count; `start()`, `stop()`, and `enable()` affect presentation only.
