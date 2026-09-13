const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { createServer } = require('../tools/server.cjs');
const root = path.resolve(__dirname, '..'), artifacts = path.join(root, 'artifacts');
fs.mkdirSync(artifacts, { recursive: true });

async function setup(options = {}, launchOptions = {}) {
  const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ ...launchOptions, headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options }), page = await context.newPage();
  const errors = [], failed = [], requests = [], consoleErrors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) failed.push([response.status(), response.url()]); });
  page.on('requestfailed', request => failed.push([request.failure()?.errorText, request.url()]));
  page.on('request', request => requests.push(request.url()));
  await page.addInitScript(() => {
    // Never capture the desktop cursor from Windows headless automation.
    Element.prototype.requestPointerLock = () => Promise.reject(new Error('Pointer lock disabled in automated tests'));
    const Native = window.AudioContext || window.webkitAudioContext;
    window.__audioEvidence = { contexts: [], sources: 0, peak: 0, energy: 0, samples: 0, frames: [] };
    let previous;
    function frame(time) { if (previous && window.__sight?.screen === 'play') window.__audioEvidence.frames.push(time - previous); previous = time; requestAnimationFrame(frame); }
    requestAnimationFrame(frame);
    if (Native) window.AudioContext = class extends Native {
      constructor(...args) {
        super(...args); window.__audioEvidence.contexts.push(this); this.__meter = this.createAnalyser(); this.__meter.fftSize = 512;
        const createGain = this.createGain.bind(this);
        this.createGain = () => { const gain = createGain(), connect = gain.connect.bind(gain); gain.connect = (destination, ...args) => { if (destination === this.destination) connect(this.__meter); return connect(destination, ...args); }; return gain; };
        for (const name of ['createOscillator', 'createBufferSource']) { const create = this[name].bind(this); this[name] = (...args) => { const source = create(...args), start = source.start.bind(source); source.start = (...args) => { window.__audioEvidence.sources++; return start(...args); }; return source; }; }
        const samples = new Float32Array(512);
        setInterval(() => { this.__meter.getFloatTimeDomainData(samples); const out = window.__audioEvidence; for (const value of samples) { out.peak = Math.max(out.peak, Math.abs(value)); out.energy += value * value; out.samples++; } }, 20);
      }
    };
  });
  return { page, context, browser, errors, failed, requests, consoleErrors, url: process.env.SIGHT_URL || `http://127.0.0.1:${server.address().port}/sight-thief/`, close: async () => { await browser.close(); await new Promise(resolve => server.close(resolve)); } };
}

async function audioEvidence(page) {
  return page.evaluate(() => { const out = window.__audioEvidence, frames = [...out.frames].sort((a, b) => a - b); return { states: out.contexts.map(context => context.state), sources: out.sources, peak: out.peak, rms: Math.sqrt(out.energy / Math.max(1, out.samples)), frames: frames.length, averageMs: frames.reduce((sum, value) => sum + value, 0) / Math.max(1, frames.length), p95Ms: frames[Math.floor(frames.length * .95)] || 0 }; });
}

function save(name, value) { fs.writeFileSync(path.join(artifacts, name), JSON.stringify(value, null, 2)); }
module.exports = { root, artifacts, setup, audioEvidence, save };
