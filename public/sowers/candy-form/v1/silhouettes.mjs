/** Original control polygons. X/Y are fractions of total height; feet sit at Y=0.
 * No Three.js dependency: these contours also drive small flat silhouette studies.
 * The rounded corners deliberately leave broad, attached arms and boot bridges.
 */
const freezePoints = points => Object.freeze(points.map(point => Object.freeze(point)));
export const CANDY_VARIANTS = Object.freeze({
  scout: Object.freeze({
    name: 'Scout / Seed Packet',
    character: 'A clipped rectangular seed packet with a single folded leaf crown and mitten tabs.',
    cornerRadius: .022,
    depth: .20,
    face: Object.freeze({ x: 0, y: .674, width: .46, height: .235, radius: .065 }),
    points: freezePoints([
      [-.29,0],[-.055,0],[-.045,.115],[.045,.115],[.055,0],[.29,0],
      [.315,.065],[.275,.235],[.285,.36],[.365,.325],[.41,.365],[.405,.49],
      [.285,.565],[.285,.825],[.215,.915],[.015,.915],[.115,1],[-.035,.985],
      [-.135,.915],[-.215,.915],[-.285,.825],[-.285,.565],[-.405,.49],
      [-.41,.365],[-.365,.325],[-.285,.36],[-.275,.235],[-.315,.065],
    ]),
  }),
  seed: Object.freeze({
    name: 'Seed / Little Voyager',
    character: 'A tilted seed tip, full triangular shoulders, a tapered waist and two broad boots.',
    cornerRadius: .026,
    depth: .20,
    face: Object.freeze({ x: -.012, y: .63, width: .46, height: .215, radius: .065 }),
    points: freezePoints([
      [-.265,0],[-.055,0],[-.045,.105],[.045,.105],[.055,0],[.265,0],
      [.29,.055],[.235,.215],[.26,.325],[.365,.31],[.395,.365],[.355,.49],
      [.30,.52],[.31,.65],[.255,.79],[.13,.91],[-.055,1],[-.14,.865],
      [-.265,.76],[-.315,.63],[-.30,.52],[-.355,.49],[-.395,.365],
      [-.365,.31],[-.26,.325],[-.235,.215],[-.29,.055],
    ]),
  }),
  bud: Object.freeze({
    name: 'Bud / Leaf Ranger',
    character: 'Two broad leaf peaks, a clear crown valley and a compact shield body with little fins.',
    cornerRadius: .023,
    depth: .20,
    face: Object.freeze({ x: 0, y: .60, width: .445, height: .205, radius: .06 }),
    points: freezePoints([
      [-.265,0],[-.055,0],[-.045,.105],[.045,.105],[.055,0],[.265,0],
      [.285,.06],[.24,.20],[.27,.325],[.375,.35],[.40,.415],[.34,.50],
      [.285,.505],[.285,.69],[.35,.835],[.315,1],[.14,.965],[0,.835],
      [-.14,.965],[-.315,1],[-.35,.835],[-.285,.69],[-.285,.505],
      [-.34,.50],[-.40,.415],[-.375,.35],[-.27,.325],[-.24,.20],[-.285,.06],
    ]),
  }),
});

export function describeCandyOutline(variant = 'scout') {
  return CANDY_VARIANTS[variant] || CANDY_VARIANTS.scout;
}

export function getCandyOutline(variant = 'scout', { height = 1 } = {}) {
  const scale = Number.isFinite(height) && height > 0 ? height : 1;
  return describeCandyOutline(variant).points.map(([x,y]) => [x * scale,y * scale]);
}

/** The same quadratic corner cuts used by the Three.js extrusion. */
export function getCandyRoundedSegments(variant = 'scout') {
  const { points, cornerRadius } = describeCandyOutline(variant);
  return points.map((point, index) => {
    const before = points[(index + points.length - 1) % points.length];
    const after = points[(index + 1) % points.length];
    const cut = other => {
      const length = Math.hypot(other[0] - point[0],other[1] - point[1]);
      const fraction = Math.min(.36,cornerRadius / length);
      return [point[0] + (other[0] - point[0]) * fraction,point[1] + (other[1] - point[1]) * fraction];
    };
    return { before: cut(before), corner: [...point], after: cut(after) };
  });
}

/** SVG path in mathematical XY. Flip Y in the consumer to display upright. */
export function getCandyContour(variant = 'scout') {
  const segments = getCandyRoundedSegments(variant);
  const pair = point => point.map(value => Number(value.toFixed(6))).join(' ');
  return `M ${pair(segments[0].before)} ` + segments.map(({ before,corner,after },index) =>
    `${index ? `L ${pair(before)} ` : ''}Q ${pair(corner)} ${pair(after)}`,
  ).join(' ') + ' Z';
}
