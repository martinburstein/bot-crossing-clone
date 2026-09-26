import test from 'node:test';
import assert from 'node:assert/strict';
import { LOOKS, NATIVE, STATES, frameForElapsed, lookForPointer, previewGeometry } from '../../public/pets/goldfish-preview/playback.mjs';

test('preview uses the native V2 cell size and complete accepted state/timing table', () => {
  assert.deepEqual(NATIVE, { width: 192, height: 208, columns: 8, rows: 11 });
  assert.deepEqual(STATES.map(({ id, durations }) => [id, durations.length, durations.reduce((a, b) => a + b, 0)]), [
    ['idle', 6, 1100], ['running-right', 8, 1060], ['running-left', 8, 1060],
    ['waving', 4, 700], ['jumping', 5, 840], ['failed', 8, 1220],
    ['waiting', 6, 1010], ['running', 6, 820], ['review', 6, 1030],
  ]);
  assert.equal(STATES.reduce((sum, row) => sum + row.durations.length, 0), 57);
});

test('frame clock respects duration boundaries and wraps the loop', () => {
  const durations = [280, 110, 110];
  assert.equal(frameForElapsed(durations, 0), 0);
  assert.equal(frameForElapsed(durations, 279), 0);
  assert.equal(frameForElapsed(durations, 280), 1);
  assert.equal(frameForElapsed(durations, 390), 2);
  assert.equal(frameForElapsed(durations, 500), 0);
  assert.equal(frameForElapsed(durations, -1), 2);
  assert.throws(() => frameForElapsed([0], 0), RangeError);
});

test('pointer center is neutral and native cardinal headings map clockwise', () => {
  const center = { x: 192, y: 208 };
  const point = (angle) => ({
    x: center.x + Math.sin(angle * Math.PI / 180) * 100,
    y: center.y - Math.cos(angle * Math.PI / 180) * 100,
  });
  assert.equal(lookForPointer(center, center, 12), null);
  assert.equal(lookForPointer({ x: center.x + 11, y: center.y }, center, 12), null);
  assert.deepEqual([0, 90, 180, 270].map((angle) => lookForPointer(point(angle), center)), [0, 4, 8, 12]);
  assert.equal(lookForPointer(point(337.5), center), 15);
});

test('look frames fill atlas rows 9–10 in clockwise 22.5 degree steps', () => {
  assert.equal(LOOKS.length, 16);
  assert.deepEqual(LOOKS.map(({ row, column }) => [row, column]), [
    ...Array.from({ length: 8 }, (_, column) => [9, column]),
    ...Array.from({ length: 8 }, (_, column) => [10, column]),
  ]);
  assert.deepEqual(LOOKS.map(({ degrees }) => degrees), Array.from({ length: 16 }, (_, i) => i * 22.5));
});

test('responsive tank canvas contains every zoom at narrow and wide viewport sizes', () => {
  for (const viewportWidth of [320, 390, 600, 1280]) {
    for (const zoom of [1, 2, 3]) {
      const layout = previewGeometry(viewportWidth, zoom);
      const fishWidth = NATIVE.width * zoom;
      const fishHeight = NATIVE.height * zoom;
      assert.ok(layout.canvasWidth >= fishWidth + 48, `${viewportWidth}px viewport at ${zoom}x fits fish width`);
      assert.ok(layout.canvasHeight >= fishHeight + 48, `${viewportWidth}px viewport at ${zoom}x fits fish height`);
      assert.equal(layout.stageHeight, layout.canvasHeight);
      if (viewportWidth < fishWidth + 48) assert.ok(layout.canvasWidth > viewportWidth, 'small screens get a horizontally scrollable canvas');
    }
  }
  assert.throws(() => previewGeometry(0, 1), RangeError);
});
