// Optional real-browser validation; no runtime dependency and no model calls.
const { chromium } = require(process.env.SOWERS_PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const sourceSnapshot = () => Object.fromEntries(['sowers/design/main.js', 'sowers/candy/mascot.js', 'sowers/candy/silhouettes.mjs', 'tools/sowers-candy-form.py'].map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, '..', file))).digest('hex')]));
const base = process.env.SOWERS_URL || 'http://127.0.0.1:5288';
const output = process.env.SOWERS_CANDY_OUTPUT || '.cache/sowers-candy-browser';
const duration = Number(process.env.SOWERS_STRESS_SECONDS ?? 900) * 1000;
fs.mkdirSync(output, { recursive: true });
let browser;
const result = { sourceAtStart: sourceSnapshot(), hmrBlocked: process.env.SOWERS_DISABLE_HMR === '1', requireStableSources: process.env.SOWERS_REQUIRE_STABLE === '1', startedAt: new Date().toISOString(), requestedStressSeconds: duration / 1000, checks: [], errors: [], samples: [], navigations: [] };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: process.env.SOWERS_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => {
    const counts = { buffers: 0, textures: 0, programs: 0, created: { buffers: 0, textures: 0, programs: 0 }, deleted: { buffers: 0, textures: 0, programs: 0 } };
    window.sowersGLResources = counts;
    for (const Type of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (!Type) continue;
      for (const [kind, noun] of [['buffers', 'Buffer'], ['textures', 'Texture'], ['programs', 'Program']]) {
        const create = Type.prototype[`create${noun}`], remove = Type.prototype[`delete${noun}`];
        const alive = new WeakSet();
        Type.prototype[`create${noun}`] = function (...args) { const resource = create.apply(this, args); if (resource) { alive.add(resource); counts[kind]++; counts.created[kind]++; } return resource; };
        Type.prototype[`delete${noun}`] = function (resource) { if (resource && alive.has(resource)) { alive.delete(resource); counts[kind]--; counts.deleted[kind]++; } return remove.call(this, resource); };
      }
    }
  });
  const page = await context.newPage();
  if (result.hmrBlocked) await page.routeWebSocket('**', ws => ws.close());
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) result.navigations.push({ at: new Date().toISOString(), url: frame.url() }); });
  page.on('pageerror', error => result.errors.push(error.message));
  page.setDefaultTimeout(20000);
  const ready = async variant => {
    await page.waitForFunction(id => { const d = window.sowersDesignReview; return d?.masterEvidence.status === 'ready' && (!id || d.masterEvidence.variant === id); }, variant);
    return page.evaluate(() => JSON.parse(JSON.stringify(window.sowersDesignReview.masterEvidence)));
  };
  await page.goto(`${base}/sowers/design/`);
  await ready('scout');
  assert.equal(await page.locator('canvas').count(), 1);
  const masters = [];
  for (const id of ['scout', 'seed', 'bud']) {
    await page.locator(`[data-quick-variant="${id}"]`).click();
    const evidence = await ready(id);
    assert.match(evidence.assetUrl, new RegExp(`${id}-positive-mm\\.stl\\?sha=[0-9a-f]{64}`));
    assert.ok(evidence.triangles > 100);
    assert.ok(Math.abs(evidence.boundsMm[1][1] - evidence.boundsMm[0][1] - 30) < .1);
    assert.ok(Math.abs(evidence.boundsMm[1][2] - evidence.boundsMm[0][2] - evidence.reportedDepthMm) < .002);
    evidence.boundsMm.forEach((point, row) => point.forEach((value, axis) => assert.ok(Math.abs(value - evidence.reportedBoundsMm[row][axis]) < .002)));
    const mesh = await page.evaluate(() => { const m = window.sowersDesignReview.getMascot(); return { type: m.type, meshes: m.children.length, singleMaterial: !Array.isArray(m.material), geometryTriangles: m.geometry.attributes.position.count / 3 }; });
    assert.deepEqual(mesh, { type: 'Mesh', meshes: 0, singleMaterial: true, geometryTriangles: evidence.triangles });
    assert.equal((await page.locator('#pack-selection').innerText()).toLowerCase(), id);
    assert.equal(await page.locator(`[data-variant="${id}"]`).getAttribute('aria-pressed'), 'true');
    masters.push(evidence);
  }
  await page.locator('[data-flavor="lime"]').click();
  await ready('bud');
  assert.equal(await page.evaluate(() => window.sowersDesignReview.getMascot().material.color.getHexString()), 'c7e45c');
  await page.locator('[data-flavor="citrus"]').click();
  await ready('bud');
  result.checks.push('Flavor tint, comparison cards and all packaging selections stay synchronized');
  result.mastersAtStart = masters;
  result.checks.push('Each exported STL is fetched, SHA-256 verified, 30 mm tall with bounds/depth matching the geometry report, and displayed as a single mesh/material');
  for (const view of ['front', 'side', 'back', 'three']) {
    await page.locator(`[data-camera="${view}"]`).click();
    await wait(350);
    await page.locator('.hero-panel').screenshot({ path: `${output}/master-${view}.png` });
  }
  await page.locator('[data-camera="front"]').click();
  await wait(1000);
  const before = await page.evaluate(() => window.sowersDesignReview.renderer.info.render.frame);
  await wait(800);
  assert.equal(await page.evaluate(() => window.sowersDesignReview.renderer.info.render.frame), before);
  result.checks.push('Paused master draws zero additional frames');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await wait(100);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `overflow at ${width}`);
  }
  await page.locator('canvas').focus();
  const cameraBefore = await page.evaluate(() => window.sowersDesignReview.camera.position.toArray());
  await page.keyboard.press('ArrowLeft');
  assert.notDeepEqual(await page.evaluate(() => window.sowersDesignReview.camera.position.toArray()), cameraBefore);
  await page.keyboard.press('r');
  await page.keyboard.press('1');
  await ready('scout');
  result.checks.push('320/390/768/1440 px layout and keyboard rotation/selection/reset');
  // Fail a real asset request. The hero must expose the failure and contain no substituted agent.
  await page.route('**/seed-positive-mm.stl*', route => route.fulfill({ status: 503, body: 'fixture missing STL' }));
  await page.locator('[data-quick-variant="seed"]').click();
  await page.locator('#master-error').waitFor({ state: 'visible' });
  assert.match(await page.locator('#master-error').innerText(), /STL HTTP 503/);
  assert.equal(await page.evaluate(() => window.sowersDesignReview.getMascot()), null);
  await page.unroute('**/seed-positive-mm.stl*');
  await page.locator('[data-quick-variant="scout"]').click();
  await ready('scout');
  result.checks.push('STL HTTP failure is visible; no silent digital substitute');
  await page.route('**/seed-positive-mm.stl*', async route => { await wait(600); await route.continue().catch(() => {}); });
  await page.locator('[data-quick-variant="seed"]').click();
  await wait(100);
  await page.locator('[data-quick-variant="bud"]').click();
  await ready('bud');
  await wait(800);
  assert.equal(await page.evaluate(() => window.sowersDesignReview.masterEvidence.variant), 'bud');
  await page.unroute('**/seed-positive-mm.stl*');
  result.checks.push('A delayed superseded STL cannot overwrite the current selection');
  const reduced = await browser.newContext({ reducedMotion: 'reduce' });
  const reducedPage = await reduced.newPage();
  reducedPage.on('pageerror', error => result.errors.push(error.message));
  await reducedPage.goto(`${base}/sowers/design/`);
  await reducedPage.locator('[data-source="agent"]').click();
  await reducedPage.locator('[data-pose="agent"]').click();
  assert.equal(await reducedPage.locator('#play').innerText(), 'Play');
  await reducedPage.locator('#play').click();
  assert.equal(await reducedPage.locator('#play').innerText(), 'Pause');
  await reduced.close();
  result.checks.push('Reduced motion starts paused and permits explicit Play');
  const fallbackContext = await browser.newContext();
  await fallbackContext.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) { return /webgl/.test(type) ? null : original.call(this, type, ...args); };
  });
  const fallback = await fallbackContext.newPage();
  await fallback.goto(`${base}/sowers/design/`);
  await fallback.locator('#render-fallback').waitFor({ state: 'visible' });
  assert.match(await fallback.locator('#master-status').innerText(), /not the exported master/);
  await fallback.locator('[data-source="agent"]').click();
  assert.equal(await fallback.locator('[data-source="agent"]').getAttribute('aria-pressed'), 'true');
  await fallback.locator('[data-quick-variant="bud"]').click();
  assert.equal(await fallback.locator('#pack-selection').innerText(), 'Bud');
  await fallbackContext.close();
  result.checks.push('WebGL fallback is explicitly an illustration and retains shape/pack selection');
  const sample = async (cycle, elapsed) => {
    const data = await page.evaluate(() => ({ resources: JSON.parse(JSON.stringify(window.sowersGLResources)), geometries: window.sowersDesignReview.renderer.info.memory.geometries, rendererTextures: window.sowersDesignReview.renderer.info.memory.textures, rendererPrograms: window.sowersDesignReview.renderer.info.programs.length, triangles: window.sowersDesignReview.renderer.info.render.triangles, source: window.sowersDesignReview.state.source, master: JSON.parse(JSON.stringify(window.sowersDesignReview.masterEvidence)) }));
    result.samples.push({ cycle, elapsedSeconds: Math.round(elapsed / 1000), ...data });
    fs.writeFileSync(`${output}/report.json`, JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ progressSeconds: Math.round(elapsed / 1000), cycle, resources: data.resources, geometries: data.geometries, programs: data.rendererPrograms, master: data.master.version, errors: result.errors.length }));
  };
  const start = Date.now();
  result.stressNavigationStart = result.navigations.length;
  let cycle = 0, lastLog = -60000;
  await sample(cycle, 0);
  while (Date.now() - start < duration) {
    const id = ['scout', 'seed', 'bud'][cycle % 3];
    await page.locator(`[data-quick-variant="${id}"]`).click();
    await ready(id);
    await page.locator('[data-source="agent"]').click();
    await page.locator(`[data-material="${cycle % 2 ? 'matte' : 'gummy'}"]`).click();
    await page.locator('#monochrome').click();
    await page.locator('[data-pose="agent"]').click();
    await page.locator('#status').selectOption(['idle', 'working', 'complete', 'waiting', 'error'][cycle % 5]);
    await wait(250);
    await page.locator('[data-pose="candy"]').click();
    await page.locator('[data-source="master"]').click();
    await ready(id);
    await page.locator(`[data-camera="${['front', 'three', 'side', 'back'][cycle % 4]}"]`).click();
    await wait(600);
    cycle++;
    if (Date.now() - start - lastLog >= 60000) { await sample(cycle, Date.now() - start); lastLog = Date.now() - start; }
    await wait(900);
  }
  await page.locator('[data-quick-variant="scout"]').click();
  await ready('scout');
  await page.locator('[data-material="matte"]').click();
  await ready('scout');
  if (await page.locator('#monochrome').getAttribute('aria-pressed') === 'true') { await page.locator('#monochrome').click(); await ready('scout'); }
  await page.locator('[data-camera="front"]').click();
  await wait(1300);
  await sample(cycle, Date.now() - start);
  result.stressElapsedSeconds = duration ? (Date.now() - start) / 1000 : 0;
  result.cycles = cycle;
  result.stressReloads = result.navigations.length - result.stressNavigationStart;
  const steady = result.samples.slice(1);
  for (const kind of ['buffers', 'textures', 'programs']) {
    const values = steady.map(s => s.resources[kind]);
    assert.ok(Math.max(...values) - Math.min(...values) <= 6, `Unbounded/unstable live ${kind}: ${values}`);
    if (kind !== 'textures') assert.ok(result.samples.at(-1).resources.deleted[kind] > 0 || !duration, `No disposed ${kind} observed`);
  }
  assert.deepEqual(result.errors, []);
  result.checks.push(duration ? `Sustained ${result.stressElapsedSeconds.toFixed(1)} second interaction run, ${cycle} cycles, live GL resources bounded within six objects across settled snapshots` : 'Initial functional checks only; sustained interaction validation not requested in this run');
  await page.evaluate(() => scrollTo(0, 0));
  await wait(200);
  await page.screenshot({ path: `${output}/final-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${output}/final-mobile.png`, fullPage: true });
  result.sourceAtEnd = sourceSnapshot();
  result.sourceChangedDuringRun = JSON.stringify(result.sourceAtStart) !== JSON.stringify(result.sourceAtEnd);
  if (result.requireStableSources) {
    assert.equal(result.sourceChangedDuringRun, false, 'Candidate source changed during final validation');
    assert.equal(result.stressReloads, 0, 'Candidate page reloaded during final validation');
    for (const master of masters) {
      assert.ok(master.sourceHashes, 'Candidate export lacks complete source provenance');
      for (const [file, hash] of Object.entries(master.sourceHashes)) assert.equal(result.sourceAtStart[file], hash, `Export/source mismatch: ${file}`);
    }
    for (const snapshot of result.samples) {
      const initial = masters.find(master => master.variant === snapshot.master.variant);
      assert.equal(snapshot.master.stlSha256, initial.stlSha256, 'Candidate STL changed during final validation');
      assert.equal(snapshot.master.parametersSha256, initial.parametersSha256, 'Candidate parameters changed during final validation');
    }
    result.checks.push('Source hashes, STL hashes and parameter hashes stayed fixed throughout final validation, without page reloads');
  }
  result.finishedAt = new Date().toISOString();
  result.status = 'passed';
  fs.writeFileSync(`${output}/report.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ status: result.status, checks: result.checks, cycles: cycle, elapsed: result.stressElapsedSeconds }));
})().catch(error => { result.status = 'failed'; result.failure = error.stack; fs.writeFileSync(`${output}/report.json`, JSON.stringify(result, null, 2)); console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); });
