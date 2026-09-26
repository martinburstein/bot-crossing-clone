import { LOOKS, NATIVE, STATES, frameForElapsed, lookForPointer, previewGeometry } from './playback.mjs';

const fish = document.querySelector('#fish');
const tank = document.querySelector('#tank');
const canvas = document.querySelector('#tank-canvas');
const buttons = document.querySelector('#state-buttons');
const stateLabel = document.querySelector('#state-label');
const frameLabel = document.querySelector('#frame-label');
const zoom = document.querySelector('#zoom');
let state = STATES[0];
let selectedLook = null;
let startedAt = performance.now();
let pausedAt = null;

function layoutPreview() {
  const scale = Number(zoom.value);
  fish.style.width = `${NATIVE.width * scale}px`;
  fish.style.height = `${NATIVE.height * scale}px`;
  fish.style.backgroundSize = `${NATIVE.columns * NATIVE.width * scale}px ${NATIVE.rows * NATIVE.height * scale}px`;
  const geometry = previewGeometry(tank.clientWidth, scale);
  canvas.style.width = `${geometry.canvasWidth}px`;
  canvas.style.height = `${geometry.canvasHeight}px`;
  tank.style.height = `${geometry.stageHeight}px`;
  tank.scrollLeft = Math.round((geometry.canvasWidth - tank.clientWidth) / 2);
}

function setCell(row, column) {
  const scale = Number(zoom.value);
  fish.style.backgroundPosition = `${-column * NATIVE.width * scale}px ${-row * NATIVE.height * scale}px`;
}

function setPressedState(activeState) {
  for (const button of buttons.children) button.setAttribute('aria-pressed', String(button.dataset.state === activeState));
}

function chooseState(next) {
  state = next;
  selectedLook = null;
  startedAt = performance.now();
  pausedAt = null;
  stateLabel.textContent = next.label;
  setPressedState(next.id);
}

for (const item of STATES) {
  const button = document.createElement('button');
  button.className = 'state-button';
  button.type = 'button';
  button.dataset.state = item.id;
  button.textContent = item.label;
  button.setAttribute('aria-pressed', String(item.id === state.id));
  button.addEventListener('click', () => chooseState(item));
  buttons.append(button);
}

function pointerLook(event) {
  const rect = fish.getBoundingClientRect();
  const scale = rect.width / NATIVE.width;
  const index = lookForPointer(
    { x: event.clientX, y: event.clientY },
    { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
    12 * scale,
  );
  if (index === null) {
    selectedLook = null;
    state = STATES[0];
    stateLabel.textContent = 'Idle · neutral';
    fish.setAttribute('aria-label', 'Goldfish facing left');
    setPressedState('idle');
  } else {
    selectedLook = LOOKS[index];
    stateLabel.textContent = `Look · ${String(selectedLook.degrees).padStart(3, '0')}°`;
    fish.setAttribute('aria-label', `Goldfish facing ${selectedLook.degrees} degrees`);
    setPressedState(null);
  }
}

tank.addEventListener('pointermove', pointerLook);
function returnToNeutral() {
  selectedLook = null;
  state = STATES[0];
  stateLabel.textContent = 'Idle · neutral';
  fish.setAttribute('aria-label', 'Goldfish facing left');
  setPressedState('idle');
}
tank.addEventListener('pointerleave', returnToNeutral);
zoom.addEventListener('change', layoutPreview);
window.addEventListener('resize', layoutPreview);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pausedAt = performance.now();
  else if (pausedAt !== null) {
    startedAt += performance.now() - pausedAt;
    pausedAt = null;
  }
});

function tick(now) {
  const elapsed = (pausedAt ?? now) - startedAt;
  if (selectedLook) {
    setCell(selectedLook.row, selectedLook.column);
    frameLabel.textContent = `direction ${selectedLook.index + 1} / 16`;
  } else {
    const frame = frameForElapsed(state.durations, elapsed);
    setCell(state.row, frame);
    frameLabel.textContent = `frame ${frame + 1} / ${state.durations.length}`;
  }
  requestAnimationFrame(tick);
}

layoutPreview();
setCell(0, 0);
requestAnimationFrame(tick);
