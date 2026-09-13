const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { setup, audioEvidence, save, root, artifacts } = require('./browser-tools.cjs');

(async () => {
  const report = [];
  for (const location of ['subpath', 'file']) {
    const t = await setup(), page = t.page;
    try {
      const url = location === 'file' ? pathToFileURL(path.join(root, 'index.html')).href : t.url;
      await page.goto(url); await page.waitForFunction(() => window.__sight?.ready);
      assert.equal(await page.title(), 'SIGHT THIEF · 시선을 훔치는 자');
      assert.equal(await page.evaluate(() => document.pointerLockElement), null);
      await page.screenshot({ path: path.join(artifacts, `${location}-title.png`) });
      await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
      await page.waitForFunction(() => window.__sight.screen === 'play');
      await page.waitForTimeout(100);
      const before = await page.evaluate(() => window.__sight);
      assert.equal(before.run.player.inShadow, true);
      assert.equal(before.run.player.crouching, true, 'quiet movement is the default');
      assert.equal(before.run.relics.some(relic => relic.discovered), false);
      if (before.sceneStats.visibleRelicIds) assert.deepEqual(before.sceneStats.visibleRelicIds, []);
      await page.screenshot({ path: path.join(artifacts, `${location}-spawn.png`) });
      await page.keyboard.press('q');
      await page.waitForFunction(() => window.__sight.run.relics[0].discovered, null, { timeout: 25000 });
      const observed = await page.evaluate(() => window.__sight);
      assert.equal(observed.run.player.x, before.run.player.x); assert.equal(observed.run.player.z, before.run.player.z);
      assert.equal(observed.run.peakSuspicion, 0); assert.equal(observed.run.stats.scans, 1);
      assert.ok(observed.run.time < 15, 'first supernatural discovery lands within first 15 seconds');
      const guard = observed.run.guards.find(guard => guard.id === observed.run.watchGuardId);
      if (observed.sceneStats.camera) {
        assert.ok(Math.abs(observed.sceneStats.camera.x - guard.x) < .001);
        assert.ok(Math.abs(observed.sceneStats.camera.z - guard.z) < .001);
        assert.equal(observed.sceneStats.playerBody.x, before.run.player.x);
        assert.equal(observed.sceneStats.playerBody.z, before.run.player.z);
        assert.equal(observed.sceneStats.playerBody.visible, true);
        assert.equal(observed.sceneStats.mirrorVisible, false);
        assert.ok(!observed.sceneStats.visibleGuardIds.includes(guard.id));
      }
      await page.screenshot({ path: path.join(artifacts, `${location}-watch.png`) });
      await page.keyboard.press('q'); await page.waitForTimeout(100);
      assert.equal((await page.evaluate(() => window.__sight.run)).watching, false);
      assert.match(await page.locator('#objective-text').textContent(), /통로/, 'the first remembered relic is guided through the wall opening');
      await page.screenshot({ path: path.join(artifacts, `${location}-route.png`) });
      const turnStart = await page.evaluate(() => window.__sight.run.player.yaw);
      await page.keyboard.down('ArrowRight'); await page.waitForTimeout(220); await page.keyboard.up('ArrowRight');
      const turned = await page.evaluate(() => window.__sight);
      const angle = Math.atan2(Math.sin(turned.run.player.yaw - turnStart), Math.cos(turned.run.player.yaw - turnStart));
      assert.ok(angle > .1, 'right arrow actually turns right');
      if (turned.sceneStats.camera?.direction) {
        const direction = turned.sceneStats.camera.direction;
        assert.ok(Math.abs(direction.x - Math.sin(turned.run.player.yaw)) < .03);
        assert.ok(Math.abs(direction.z + Math.cos(turned.run.player.yaw)) < .03);
      }
      const audible = await audioEvidence(page); assert.ok(audible.sources > 3 && audible.peak > .0001, 'original synthesized audio reaches destination');
      await page.keyboard.press('m'); await page.waitForTimeout(250);
      await page.evaluate(() => { window.__audioEvidence.peak = 0; window.__audioEvidence.energy = 0; window.__audioEvidence.samples = 0; });
      await page.waitForTimeout(400); const muted = await audioEvidence(page); assert.ok(muted.peak < .00002);
      await page.keyboard.press('Escape');
      const paused = await page.evaluate(() => window.__sight.run.time);
      await page.waitForTimeout(300); assert.equal(await page.evaluate(() => window.__sight.run.time), paused);
      assert.ok((await audioEvidence(page)).states.every(state => state === 'suspended'));
      assert.deepEqual(t.errors, []); assert.deepEqual(t.failed, []); assert.deepEqual(t.consoleErrors, []);
      assert.ok(t.requests.every(request => !/^https?:/.test(request) || request.startsWith(new URL(url).origin)), 'no external runtime dependencies');
      report.push({ location, url, firstScanSeconds: observed.run.time, audio: audible, mutedPeak: muted.peak, scene: observed.sceneStats, errors: t.errors, failed: t.failed });
    } finally { await t.close(); }
  }
  save('browser-report.json', report); console.log(JSON.stringify(report, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
