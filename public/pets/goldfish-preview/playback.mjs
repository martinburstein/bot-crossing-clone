export const NATIVE = Object.freeze({ width: 192, height: 208, columns: 8, rows: 11 });

export const STATES = Object.freeze([
  { id: 'idle', label: 'Idle', row: 0, durations: [280, 110, 110, 140, 140, 320] },
  { id: 'running-right', label: 'Swim right', row: 1, durations: [120, 120, 120, 120, 120, 120, 120, 220] },
  { id: 'running-left', label: 'Swim left', row: 2, durations: [120, 120, 120, 120, 120, 120, 120, 220] },
  { id: 'waving', label: 'Wave', row: 3, durations: [140, 140, 140, 280] },
  { id: 'jumping', label: 'Jump', row: 4, durations: [140, 140, 140, 140, 280] },
  { id: 'failed', label: 'Failed', row: 5, durations: [140, 140, 140, 140, 140, 140, 140, 240] },
  { id: 'waiting', label: 'Waiting', row: 6, durations: [150, 150, 150, 150, 150, 260] },
  { id: 'running', label: 'Working', row: 7, durations: [120, 120, 120, 120, 120, 220] },
  { id: 'review', label: 'Review', row: 8, durations: [150, 150, 150, 150, 150, 280] },
]);

export const LOOKS = Object.freeze(Array.from({ length: 16 }, (_, index) => ({
  index,
  degrees: index * 22.5,
  row: 9 + Math.floor(index / 8),
  column: index % 8,
})));

/** Geometry for the scrollable tank canvas; never crop the native cell at any zoom. */
export function previewGeometry(viewportWidth, zoom, { gutter = 48, wideMinHeight = 315, compactMinHeight = 280, compactBreakpoint = 600 } = {}) {
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0 || ![1, 2, 3].includes(zoom)) {
    throw new RangeError('Preview geometry needs a positive viewport width and a supported zoom.');
  }
  const canvasWidth = Math.max(viewportWidth, NATIVE.width * zoom + gutter);
  const canvasHeight = Math.max(NATIVE.height * zoom + gutter, viewportWidth <= compactBreakpoint ? compactMinHeight : wideMinHeight);
  return Object.freeze({ viewportWidth, canvasWidth, canvasHeight, stageHeight: canvasHeight });
}

/** Select the nearest clockwise look; the centered deadzone remains neutral. */
export function lookForPointer(point, center, deadzone = 12) {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  if (Math.hypot(dx, dy) < deadzone) return null;
  const degrees = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
  return Math.round(degrees / 22.5) % 16;
}

/** Return the atlas frame at elapsed loop time, honoring each exact duration. */
export function frameForElapsed(durations, elapsedMs) {
  const total = durations.reduce((sum, duration) => sum + duration, 0);
  if (!durations.length || durations.some((duration) => !Number.isFinite(duration) || duration <= 0)) {
    throw new RangeError('Frame durations must be positive finite values.');
  }
  let time = ((elapsedMs % total) + total) % total;
  for (let frame = 0; frame < durations.length; frame += 1) {
    if (time < durations[frame]) return frame;
    time -= durations[frame];
  }
  return durations.length - 1;
}
