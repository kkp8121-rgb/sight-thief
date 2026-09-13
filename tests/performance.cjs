const assert = require('node:assert/strict');
const path = require('node:path');
const { setup, audioEvidence, save, artifacts } = require('./browser-tools.cjs');

(async () => {
  const hardware = process.argv.includes('--hardware'), report = [];
  for (const rate of hardware ? [1] : [1, 4]) {
    const t = await setup({}, hardware ? { args: ['--use-angle=d3d11', '--enable-webgl', '--ignore-gpu-blocklist'] } : {});
    try {
      const cdp = await t.context.newCDPSession(t.page); await cdp.send('Emulation.setCPUThrottlingRate', { rate });
      await t.page.goto(t.url); await t.page.waitForFunction(() => window.__sight?.ready);
      await t.page.keyboard.press('Enter'); await t.page.keyboard.press('Enter');
      await t.page.keyboard.press('q');
      await t.page.waitForFunction(() => window.__sight.run.relics[0].discovered, null, { timeout: 30000 });
      await t.page.keyboard.press('q'); await t.page.waitForTimeout(80);
      const before = await t.page.evaluate(() => window.__sight.run.player);
      await t.page.evaluate(() => { window.__audioEvidence.frames = []; });
      await t.page.keyboard.down('a'); await t.page.waitForTimeout(1100); await t.page.keyboard.up('a');
      const after = await t.page.evaluate(() => window.__sight.run.player); assert.ok(after.x > before.x + .5, 'real strafe input works under load');
      await t.page.keyboard.press('q'); await t.page.waitForTimeout(5000); await t.page.keyboard.press('q');
      const audio = await audioEvidence(t.page), stats = await t.page.evaluate(() => window.__sight.sceneStats);
      const renderer = await t.page.evaluate(() => { const gl = document.querySelector('canvas').getContext('webgl2'); const ext = gl.getExtension('WEBGL_debug_renderer_info'); return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); });
      assert.ok(audio.averageMs < 50, `mean frame interval under ${rate}x CPU throttle: ${audio.averageMs}`);
      assert.ok(audio.peak > .0001 && audio.peak < .95);
      assert.ok(stats.pixels <= (stats.software ? 401000 : 2001000));
      assert.ok(stats.galleryPaintings >= 6, 'gallery art is present during measurement');
      if (hardware) assert.equal(stats.software, false);
      await t.page.screenshot({ path: path.join(artifacts, hardware ? 'performance-hardware.png' : `performance-software-${rate}.png`) });
      assert.deepEqual(t.errors, []); assert.deepEqual(t.failed, []); assert.deepEqual(t.consoleErrors, []);
      report.push({ hardware, rate, renderer, stats, audio }); console.log(JSON.stringify(report.at(-1)));
    } finally { await t.close(); }
  }
  save(hardware ? 'hardware-report.json' : 'performance-report.json', report);
})().catch(error => { console.error(error); process.exitCode = 1; });
