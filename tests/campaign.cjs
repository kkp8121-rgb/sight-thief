const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const { setup, save, audioEvidence, artifacts } = require('./browser-tools.cjs');

(async () => {
  const { planRoute } = await import('./route-planner.mjs'), { LEVELS } = await import('../src/levels.js');
  const hardware = process.argv.includes('--hardware');
  const t = await setup({}, hardware ? { args: ['--use-angle=d3d11', '--enable-webgl', '--ignore-gpu-blocklist'] } : {}), page = t.page, evidence = { started: new Date().toISOString(), hardware, wings: [] };
  evidence.bundleSha256 = createHash('sha256').update(fs.readFileSync(path.join(__dirname, '..', 'game.js'))).digest('hex');
  const state = () => page.evaluate(() => window.__sight.run);
  const held = new Set();
  async function keys(wanted) {
    for (const key of held) if (!wanted.includes(key)) { await page.keyboard.up(key); held.delete(key); }
    for (const key of wanted) if (!held.has(key)) { await page.keyboard.down(key); held.add(key); }
  }
  async function follow(target) {
    await keys([]); await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => window.__sight.screen), 'pause');
    const frozen = await state(), plan = planRoute(frozen, target);
    console.log(JSON.stringify({ level: frozen.levelId, target, routeSeconds: plan.duration, explored: plan.explored }));
    await page.keyboard.press('Escape');
    for (const waypoint of plan.route.slice(1)) {
      const deadline = Date.now() + 12000;
      while (true) {
        const run = await state();
        assert.equal(run.status, 'playing', `Detected during ${run.levelId} navigation at ${run.player.x},${run.player.z}`);
        const dx = waypoint.x - run.player.x, dz = waypoint.z - run.player.z, moving = Math.hypot(dx, dz) > .16;
        if (!moving && run.time >= waypoint.at - .025) break;
        if (Date.now() > deadline) throw new Error(`Waypoint stuck: ${JSON.stringify({ waypoint, player: run.player, time: run.time })}`);
        // All campaign runs retain their south-facing initial yaw. A/D strafe,
        // and W/S move on the other world axis using genuine browser keys.
        const wanted = [];
        if (moving) { if (Math.abs(dx) > Math.abs(dz)) wanted.push(dx > 0 ? 'a' : 'd'); else wanted.push(dz > 0 ? 'w' : 's'); }
        await keys(wanted); await page.waitForTimeout(22);
      }
      await keys([]);
    }
    await keys([]); await page.keyboard.press('e'); await page.waitForTimeout(60);
  }
  try {
    await page.goto(t.url); await page.waitForFunction(() => window.__sight?.ready);
    await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__sight.screen === 'play');
    for (let index = 0; index < LEVELS.length; index++) {
      const level = LEVELS[index];
      await page.keyboard.press('q'); await page.waitForFunction(() => window.__sight.run.watching);
      for (let cycle = 0; cycle < level.guards.length && (await state()).watchGuardId !== level.guards.at(-1).id; cycle++) {
        const previous = (await state()).watchGuardId;
        await page.keyboard.press('Tab');
        await page.waitForFunction(id => window.__sight.run.watchGuardId !== id, previous);
      }
      const body = (await state()).player, scanStart = (await state()).time;
      await page.waitForFunction(() => window.__sight.run.relics.every(relic => relic.discovered), null, { timeout: 100000 });
      const scanned = await state(); assert.equal(scanned.status, 'playing'); assert.equal(scanned.player.x, body.x); assert.equal(scanned.player.z, body.z);
      await page.screenshot({ path: path.join(artifacts, `campaign-${level.id}-watch.png`) });
      evidence.wings.push({ level: level.id, scanSeconds: scanned.time - scanStart, scans: scanned.stats.scans, objectives: [] });
      await page.keyboard.press('q'); await page.waitForTimeout(50);
      for (const relic of level.relics) {
        await follow(relic);
        const current = await state(); assert.equal(current.relics.find(value => value.id === relic.id).collected, true);
        evidence.wings.at(-1).objectives.push({ id: relic.id, at: current.time, peakSuspicion: current.peakSuspicion });
      }
      await follow(level.exit); await keys([]);
      await page.waitForFunction(() => ['clear', 'ending'].includes(window.__sight.screen));
      const finished = await state(); assert.equal(finished.status, 'won');
      Object.assign(evidence.wings.at(-1), { time: finished.time, collected: finished.stats.collected, peakSuspicion: finished.peakSuspicion, steps: finished.stats.steps });
      await page.screenshot({ path: path.join(artifacts, `campaign-${level.id}-clear.png`) });
      save('campaign-progress.json', evidence);
      if (index < LEVELS.length - 1) { await page.keyboard.press('Enter'); await page.waitForFunction(() => window.__sight.screen === 'play'); }
    }
    evidence.records = await page.evaluate(() => window.__sight.records);
    evidence.scene = await page.evaluate(() => window.__sight.sceneStats);
    if (hardware) assert.equal(evidence.scene.software, false);
    evidence.audio = await audioEvidence(page);
    await page.reload(); await page.waitForFunction(() => window.__sight?.ready);
    assert.deepEqual(await page.evaluate(() => window.__sight.records), evidence.records);
    await page.locator('#continue-button').click();
    assert.equal(await page.locator('[data-level-id]:not([disabled])').count(), 3);
    assert.deepEqual(t.errors, []); assert.deepEqual(t.failed, []); assert.deepEqual(t.consoleErrors, []);
    save('campaign-report.json', evidence); console.log(JSON.stringify(evidence, null, 2));
  } catch (error) {
    save('campaign-failure.json', { message: error.message, state: await page.evaluate(() => window.__sight).catch(() => null), errors: t.errors, failed: t.failed });
    await page.screenshot({ path: path.join(artifacts, 'campaign-failure.png') }).catch(() => {}); throw error;
  } finally { await t.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
