import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

class Element {
  constructor(id = '') {
    this.id = id;
    this.style = {};
    this.children = [];
    this.dataset = {};
    this.attrs = {};
    this.handlers = {};
    this.clientWidth = id === 'tank' ? 320 : 0;
    this.scrollLeft = 0;
    this.value = '3';
    this.textContent = '';
  }
  addEventListener(name, fn) { this.handlers[name] = fn; }
  append(child) { this.children.push(child); }
  setAttribute(key, value) { this.attrs[key] = value; }
  getBoundingClientRect() {
    const zoom = Number(elements.zoom.value);
    return { left: 0, top: 0, width: 192 * zoom, height: 208 * zoom };
  }
}

const elements = Object.fromEntries(
  ['fish', 'tank', 'tank-canvas', 'state-buttons', 'state-label', 'frame-label', 'zoom']
    .map((id) => [id, new Element(id)]),
);
const windowHandlers = {};
const animationFrames = [];
globalThis.document = {
  hidden: false,
  querySelector(selector) { return elements[selector.slice(1)]; },
  createElement() { return new Element(); },
  addEventListener() {},
};
globalThis.window = { addEventListener(name, fn) { windowHandlers[name] = fn; } };
globalThis.requestAnimationFrame = (fn) => animationFrames.push(fn);

const appPath = resolve('public/pets/goldfish-preview/app.mjs');
await import(`${pathToFileURL(appPath).href}?integration=scroll-persistence`);

function tick(timestamp) {
  const next = animationFrames.shift();
  assert.ok(next, 'app scheduled its next animation frame');
  next(timestamp);
}

test('real preview app preserves user pan through ticks and only recenters on layout changes', () => {
  const { tank, zoom } = elements;
  const canvas = elements['tank-canvas'];
  assert.equal(canvas.style.width, '624px');
  assert.equal(tank.scrollLeft, 152, 'initial 3x layout is centered');

  tank.scrollLeft = 9;
  tick(performance.now() + 16);
  tick(performance.now() + 32);
  assert.equal(tank.scrollLeft, 9, 'animation frames do not alter the pan position');

  zoom.value = '2';
  zoom.handlers.change();
  assert.equal(canvas.style.width, '432px');
  assert.equal(tank.scrollLeft, 56, 'zoom change centers the newly sized canvas');
  tank.scrollLeft = 20;
  tick(performance.now() + 48);
  assert.equal(tank.scrollLeft, 20, 'animation after zoom preserves a new user pan');

  tank.clientWidth = 500;
  windowHandlers.resize();
  assert.equal(canvas.style.width, '500px');
  assert.equal(tank.scrollLeft, 0, 'resize reflows and centers the canvas when scrolling is no longer needed');
  tank.scrollLeft = 13;
  tick(performance.now() + 64);
  assert.equal(tank.scrollLeft, 13, 'animation after resize still preserves user panning');
});
