const assert = require('node:assert/strict');
const path = require('node:path');
const { setup, save, artifacts } = require('./browser-tools.cjs');

async function openGame(options = {}, init = null) {
  const env = await setup(options);
  if (init) await env.page.addInitScript(init);
  await env.page.goto(env.url, { waitUntil: 'load' });
  await env.page.waitForFunction(() => window.__sight?.ready === true);
  return env;
}

async function start(page) {
  await page.locator('[data-action="start"]').click();
  await page.locator('#select-screen [data-action="begin"]').click();
  await page.waitForFunction(() => window.__sight?.screen === 'play');
}

async function state(page) {
  return page.evaluate(() => window.__sight.run);
}

async function controlPoint(page, locator) {
  const box = await locator.boundingBox();
  assert(box, 'touch control must have a bounding box');
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const hit = await page.evaluate(({ x, y }) => {
    const node = document.elementFromPoint(x, y);
    return Boolean(node?.closest?.('[data-touch]'));
  }, point);
  assert.equal(hit, true, 'touch control center must be unobscured');
  return point;
}

async function dispatchTouch(client, type, points) {
  await client.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map((point) => ({ x: point.x, y: point.y, id: point.id, radiusX: 8, radiusY: 8, force: 1 })),
    modifiers: 0
  });
}

async function seedFoyer(page) {
  await page.evaluate(() => localStorage.setItem('sight-thief-records-v1', JSON.stringify({ standard: { foyer: { time: 10, peakSuspicion: .1, grade: 'S' } }, gentle: {} })));
}

async function testMouseDrag() {
  const env = await openGame();
  try {
    await start(env.page);
    const canvas = env.page.locator('#world-canvas'), box = await canvas.boundingBox();
    assert.ok(box);
    await env.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await env.page.mouse.down();
    const initial = await state(env.page);
    await env.page.mouse.move(box.x + box.width / 2 + 44, box.y + box.height / 2 + 24);
    await env.page.waitForTimeout(80);
    const moved = await state(env.page);
    const yawDelta = Math.atan2(Math.sin(moved.player.yaw - initial.player.yaw), Math.cos(moved.player.yaw - initial.player.yaw));
    assert(yawDelta > 0, 'mouse movement right must increase yaw');
    assert(moved.player.pitch < initial.player.pitch, 'mouse movement down must decrease pitch');

    await env.page.keyboard.press('q');
    await env.page.waitForTimeout(100);
    const watchStart = await state(env.page);
    await env.page.mouse.move(box.x + box.width / 2 - 40, box.y + box.height / 2 - 28);
    await env.page.waitForTimeout(80);
    const watchMoved = await state(env.page);
    assert.equal(watchMoved.watching, true, 'Q must remain active during mouse look');
    assert.equal(watchMoved.player.yaw, watchStart.player.yaw, 'mouse look must not rotate the body while watching');
    assert.equal(watchMoved.player.pitch, watchStart.player.pitch, 'mouse look must not tilt the body while watching');
    await env.page.keyboard.press('q');
    await env.page.waitForTimeout(80);
    const released = await state(env.page);
    assert.equal(released.player.yaw, watchStart.player.yaw, 'returning must not apply queued mouse movement');
    await env.page.mouse.up();
    await env.page.keyboard.press('Escape');
    await env.page.waitForTimeout(60);
    assert.equal(await env.page.evaluate(() => window.__sight.screen), 'pause', 'Escape must pause');
    assert.equal(await env.page.evaluate(() => document.pointerLockElement), null, 'native pointer lock is never used in automation');
    return { drag: true, nativePointerLock: false };
  } finally { await env.close(); }
}

async function testPointerLockDenied() {
  const env = await openGame({}, () => {
    HTMLCanvasElement.prototype.requestPointerLock = () => Promise.reject(new Error('pointer lock denied'));
  });
  try {
    await start(env.page);
    const canvas = env.page.locator('#world-canvas'), box = await canvas.boundingBox();
    await env.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await env.page.waitForTimeout(60);
    const initial = await state(env.page);
    await env.page.keyboard.down('ArrowLeft');
    await env.page.waitForTimeout(160);
    await env.page.keyboard.up('ArrowLeft');
    assert.notEqual((await state(env.page)).player.yaw, initial.player.yaw, 'keyboard fallback must work when pointer lock is denied');
    assert.deepEqual(env.errors, [], 'pointer lock denial must not create page errors');
    return { denied: true, keyboardFallback: true };
  } finally { await env.close(); }
}

async function testKeyboardAndPause() {
  const env = await openGame();
  try {
    await start(env.page);
    const initial = await state(env.page);
    await env.page.keyboard.down('ArrowLeft');
    await env.page.waitForTimeout(180);
    await env.page.keyboard.up('ArrowLeft');
    const turned = await state(env.page);
    assert.notEqual(turned.player.yaw, initial.player.yaw, 'ArrowLeft must turn the player');

    const beforeStrafe = turned.player;
    await env.page.keyboard.down('a');
    await env.page.waitForTimeout(180);
    await env.page.keyboard.up('a');
    const strafed = await state(env.page);
    assert(Math.hypot(strafed.player.x - beforeStrafe.x, strafed.player.z - beforeStrafe.z) > .01, 'A must strafe');

    const beforeWatch = strafed.player;
    await env.page.keyboard.press('q');
    await env.page.waitForTimeout(180);
    const watching = await state(env.page);
    assert.equal(watching.watching, true, 'Q must enter sight possession');
    await env.page.keyboard.down('q');
    await env.page.keyboard.down('q');
    await env.page.waitForTimeout(80);
    assert.equal((await state(env.page)).watching, false, 'one new press returns; key repeat must not toggle again');
    await env.page.keyboard.up('q');
    await env.page.keyboard.press('q');
    await env.page.waitForTimeout(60);
    assert(Math.hypot(watching.player.x - beforeWatch.x, watching.player.z - beforeWatch.z) < .001, 'watching must freeze the body');
    await env.page.keyboard.press('q');
    await env.page.waitForTimeout(80);
    assert.equal((await state(env.page)).watching, false, 'second Q tap must return to the body');

    await env.page.keyboard.down('Shift');
    await env.page.waitForTimeout(60);
    assert.equal((await state(env.page)).player.crouching, false, 'Shift must hurry');
    await env.page.keyboard.up('Shift');
    await env.page.waitForTimeout(60);
    assert.equal((await state(env.page)).player.crouching, true, 'releasing Shift must return to quiet movement');

    await env.page.waitForTimeout(100);
    await env.page.locator('[data-action="pause"]').click();
    assert.equal((await env.page.evaluate(() => window.__sight.screen)), 'pause');
    const pausedAt = await state(env.page);
    await env.page.waitForTimeout(220);
    const paused = await state(env.page);
    assert.equal(paused.time, pausedAt.time, 'pause must freeze simulation time');
    await env.page.locator('[data-action="resume"]').click();
    await env.page.waitForTimeout(180);
    assert((await state(env.page)).time > paused.time, 'resume must advance simulation');
  } finally { await env.close(); }
}

async function testArchiveCycle() {
  const env = await openGame({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  try {
    await seedFoyer(env.page);
    await env.page.reload();
    await env.page.locator('[data-action="start"]').click();
    await env.page.locator('[data-level-id="archive"]').click();
    await env.page.locator('#select-screen [data-action="begin"]').click();
    await env.page.waitForFunction(() => window.__sight?.screen === 'play');
    await env.page.keyboard.press('q');
    await env.page.waitForTimeout(180);
    const first = await state(env.page);
    assert.equal(first.watching, true, 'archive Q must possess a guard');
    await env.page.keyboard.press('Tab');
    await env.page.waitForTimeout(60);
    const second = await state(env.page);
    assert.notEqual(second.watchGuardId, first.watchGuardId, 'Tab must cycle to another guard');
    await env.page.keyboard.press('q');
    await env.page.waitForFunction(() => !window.__sight.run.watching);
    const watch = env.page.locator('[data-touch="watch"]'), cycle = env.page.locator('[data-touch="cycle"]');
    const watchPoint = await controlPoint(env.page, watch);
    const client = await env.page.context().newCDPSession(env.page);
    await dispatchTouch(client, 'touchStart', [{ ...watchPoint, id: 30 }]);
    await env.page.waitForTimeout(100);
    const touchFirst = await state(env.page);
    const cyclePoint = await controlPoint(env.page, cycle);
    await dispatchTouch(client, 'touchStart', [{ ...watchPoint, id: 30 }, { ...cyclePoint, id: 31 }]);
    await env.page.waitForTimeout(60);
    const touchSecond = await state(env.page);
    assert.notEqual(touchSecond.watchGuardId, touchFirst.watchGuardId, 'touch cycle must change the possessed guard');
    await dispatchTouch(client, 'touchEnd', []);
  } finally { await env.close(); }
}

async function testMobileTouch() {
  const results = [];
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    const env = await openGame({ viewport, hasTouch: true, isMobile: true });
    try {
      await start(env.page);
      const layout = await env.page.evaluate(() => ({
        width: innerWidth,
        overflow: document.documentElement.scrollWidth > innerWidth + 1 || document.body.scrollWidth > innerWidth + 1,
        controls: [...document.querySelectorAll('[data-touch]')].filter(node => node.getBoundingClientRect().width > 0).map((node) => { const rect = node.getBoundingClientRect(), hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2); return { display: getComputedStyle(node).display, rect: rect.toJSON(), hit: hit?.closest?.('[data-touch]')?.dataset.touch === node.dataset.touch }; })
      }));
      assert.equal(layout.overflow, false, `mobile ${viewport.width}x${viewport.height} must not overflow horizontally`);
      assert.equal(layout.controls.length, 7, 'a single-guard wing needs no guard-switch button');
      for (const control of layout.controls) {
        assert.notEqual(control.display, 'none', 'touch controls must be visible on coarse pointers');
        assert(control.rect.width >= 44 && control.rect.height >= 44, 'touch controls must be at least 44px');
        assert.equal(control.hit, true, 'touch control center must be unobscured');
      }
      const crouch = env.page.locator('[data-touch="hurry"]');
      const crouchBox = await controlPoint(env.page, crouch);
      await env.page.touchscreen.tap(crouchBox.x, crouchBox.y);
      await env.page.waitForTimeout(80);
      assert.equal((await state(env.page)).player.crouching, false, 'touch hurry first tap must engage');
      assert.equal(await crouch.evaluate((node) => node.classList.contains('held')), true, 'touch hurry must stay visibly engaged');
      await env.page.touchscreen.tap(crouchBox.x, crouchBox.y);
      await env.page.waitForTimeout(80);
      assert.equal((await state(env.page)).player.crouching, true, 'touch hurry second tap must release');
      assert.equal(await crouch.evaluate((node) => node.classList.contains('held')), false, 'touch hurry release must clear styling');

      const watch = env.page.locator('[data-touch="watch"]');
      const watchPoint = await controlPoint(env.page, watch), client = await env.page.context().newCDPSession(env.page);
      await dispatchTouch(client, 'touchStart', [{ ...watchPoint, id: 20 }]);
      await env.page.waitForTimeout(120);
      assert.equal((await state(env.page)).watching, true, 'touch watch must engage while held');
      await dispatchTouch(client, 'touchEnd', []);
      await env.page.waitForTimeout(80);
      assert.equal((await state(env.page)).watching, true, 'touch watch persists after releasing the button');
      await env.page.touchscreen.tap(watchPoint.x, watchPoint.y);
      await env.page.waitForTimeout(80);
      assert.equal((await state(env.page)).watching, false, 'second touch returns to the body');
      const forward = env.page.locator('[data-touch="forward"]'), forwardPoint = await controlPoint(env.page, forward), beforeMove = await state(env.page);
      await dispatchTouch(client, 'touchStart', [{ ...forwardPoint, id: 21 }]);
      await env.page.waitForTimeout(180);
      await dispatchTouch(client, 'touchEnd', []);
      const afterMove = await state(env.page);
      assert(Math.hypot(afterMove.player.x - beforeMove.player.x, afterMove.player.z - beforeMove.player.z) > .01, 'touch forward must move the player');
      const bodyPoint = { x: viewport.width * .65, y: viewport.height * .50, id: 22 };
      await dispatchTouch(client, 'touchStart', [bodyPoint]);
      await dispatchTouch(client, 'touchMove', [{ ...bodyPoint, x: bodyPoint.x + 38, y: bodyPoint.y + 16 }]);
      await dispatchTouch(client, 'touchEnd', []);
      await env.page.waitForTimeout(90);
      const looked = await state(env.page);
      assert.ok(Math.atan2(Math.sin(looked.player.yaw - afterMove.player.yaw), Math.cos(looked.player.yaw - afterMove.player.yaw)) > .04, 'touch canvas drag turns the camera');
      await env.page.screenshot({ path: path.join(artifacts, `v2-mobile-${viewport.width}.png`) });
      results.push({ viewport, overflow: layout.overflow, controls: layout.controls.length });
    } finally { await env.close(); }
  }
  return results;
}

async function testCorruptStorage() {
  const env = await openGame();
  try {
    await env.page.evaluate(() => {
      localStorage.setItem('sight-thief-records-v1', '{broken');
      localStorage.setItem('sight-thief-settings-v1', JSON.stringify({ muted: 'yes', volume: null, mode: 'impossible' }));
    });
    await env.page.reload();
    await env.page.waitForFunction(() => window.__sight?.screen === 'title');
    await start(env.page);
    const settings = await env.page.evaluate(() => window.__sight.settings);
    assert.equal(settings.muted, false, 'malformed mute value must sanitize');
    assert.equal(settings.mode, 'standard', 'malformed mode must sanitize');
  } finally { await env.close(); }
}

async function testUnavailableFallbacks() {
  const webgl = await openGame({}, () => {
    HTMLCanvasElement.prototype.getContext = () => null;
  });
  try {
    await webgl.page.waitForFunction(() => !document.getElementById('scene-fallback').classList.contains('hidden'));
    await webgl.page.locator('[data-action="start"]').click();
    await webgl.page.locator('#select-screen [data-action="begin"]').click();
    assert.equal(await webgl.page.evaluate(() => window.__sight.screen), 'select', 'WebGL failure must block entering gameplay');
    assert.equal(await webgl.page.locator('#scene-fallback').evaluate(node => { const rect = node.getBoundingClientRect(); return document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) === node; }), true, 'the failure explanation is above the menu, not hidden behind it');
  } finally { await webgl.close(); }

  const audio = await openGame({}, () => {
    window.AudioContext = undefined;
    window.webkitAudioContext = undefined;
  });
  try {
    await start(audio.page);
    assert.equal(await audio.page.evaluate(() => window.__sight.screen), 'play', 'audio failure must remain nonfatal');
    assert.deepEqual(audio.errors, [], 'audio failure must not create page errors');
  } finally { await audio.close(); }
}

async function testDefeatAndRetry() {
  const env = await openGame();
  let defeated = false;
  try {
    await start(env.page);
    await env.page.keyboard.down('Shift');
    await env.page.keyboard.down('a');
    await env.page.waitForTimeout(1500);
    await env.page.keyboard.up('a');
    await env.page.keyboard.down('w');
    await env.page.waitForTimeout(5000);
    await env.page.keyboard.up('w');
    await env.page.waitForTimeout(1200);
    defeated = await env.page.evaluate(() => window.__sight.screen === 'defeat');
    assert.equal(defeated, true, 'walking into the patrol must eventually produce the defeat screen');
    await env.page.keyboard.press('Enter');
    await env.page.waitForFunction(() => window.__sight.screen === 'play');
    assert((await state(env.page)).time < 1, 'retry must create a fresh run');
  } finally { await env.close(); }
  return defeated;
}

(async () => {
  const report = { mouse: await testMouseDrag(), pointerLockDenied: await testPointerLockDenied(), keyboardPause: true, archiveCycle: true, mobile: await testMobileTouch(), corruptStorage: true, fallbacks: true, defeatRetry: await testDefeatAndRetry() };
  await testKeyboardAndPause();
  await testArchiveCycle();
  await testCorruptStorage();
  await testUnavailableFallbacks();
  save('interaction-report.json', report);
  console.log(JSON.stringify(report));
})().catch((error) => { console.error(error); process.exitCode = 1; });
