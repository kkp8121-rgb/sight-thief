import { LEVELS, getLevel, lineOfSight as hasSight } from './levels.js';
import { createRun, stepRun, interact, cycleView, summarize } from './game.js';
import { createScene } from './scene.js';
import { createAudio } from './audio.js';

const RECORDS_KEY = 'sight-thief-records-v1', SETTINGS_KEY = 'sight-thief-settings-v1', FIXED = 1 / 60;
const clone = (value, fallback = null) => { try { return JSON.parse(JSON.stringify(value)); } catch (_) { return fallback; } };
const wrapAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
function lineOfSight(level, from, to) {
  return Boolean(level && from && to && hasSight(level, from.x, from.z, to.x, to.z));
}
function bearingLabel(player, target) {
  const distance = Math.hypot(target.x - player.x, target.z - player.z), angle = wrapAngle(Math.atan2(target.x - player.x, -(target.z - player.z)) - (player.yaw || 0));
  const direction = Math.abs(angle) < Math.PI / 4 ? '앞' : Math.abs(angle) > Math.PI * .75 ? '뒤' : angle < 0 ? '왼쪽' : '오른쪽';
  return `${direction} · ${distance.toFixed(1)}m`;
}

function boot() {
  const app = document.getElementById('app'), world = document.getElementById('world'), canvas = document.getElementById('world-canvas');
  const usesTouch = matchMedia('(pointer:coarse)').matches;
  let scene = null, sceneError = false, run = null, screen = 'title', selectedLevel = LEVELS?.[0]?.id || null, previousScreen = 'title', settings = loadSettings(), records = loadRecords();
  let accumulator = 0, lastFrame = performance.now(), mouseYaw = 0, mousePitch = 0, interactRequested = false, cycleRequested = false, dragPointer = null, lastMessage = '', lastMessageUntil = 0;
  const held = { forward: new Set(), back: new Set(), left: new Set(), right: new Set(), turnLeft: new Set(), turnRight: new Set(), crouch: new Set(), watch: new Set() };
  const audio = safeAudio(); audio.setVolume?.(settings.volume); audio.setMuted?.(settings.muted);
  try { scene = createScene(world); } catch (error) { sceneError = true; const fallback = document.getElementById('scene-fallback'); if (fallback) { fallback.textContent = '3D 장면을 사용할 수 없습니다. WebGL을 켠 뒤 새로고침해 주세요.'; fallback.classList.remove('hidden'); } console.error(error); }

  function safeAudio() { try { return createAudio?.() || {}; } catch (error) { console.error(error); return {}; } }
  function loadSettings() { try { const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); return { volume: Number.isFinite(raw?.volume) ? Math.max(0, Math.min(1, raw.volume)) : .24, muted: raw?.muted === true, mode: raw?.mode === 'gentle' ? 'gentle' : 'standard' }; } catch (_) { return { volume: .24, muted: false, mode: 'standard' }; } }
  function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (_) {} }
  function loadRecords() { try { const raw = JSON.parse(localStorage.getItem(RECORDS_KEY) || '{}'), clean = { standard: {}, gentle: {} }; for (const mode of ['standard', 'gentle']) for (const level of LEVELS || []) { const record = raw?.[mode]?.[level.id]; if (record && ['S', 'A', 'B'].includes(record.grade) && Number.isFinite(record.time) && record.time >= 0 && Number.isFinite(record.peakSuspicion) && record.peakSuspicion >= 0) clean[mode][level.id] = { time: record.time, peakSuspicion: record.peakSuspicion, grade: record.grade }; } return clean; } catch (_) { return { standard: {}, gentle: {} }; } }
  function saveRecords() { try { localStorage.setItem(RECORDS_KEY, JSON.stringify(records)); } catch (_) {} }
  function unlocked(index) { return index === 0 || !!records.standard?.[LEVELS[index - 1]?.id] || !!records.gentle?.[LEVELS[index - 1]?.id]; }
  function clearInputs() { Object.values(held).forEach((sources) => sources.clear()); interactRequested = false; cycleRequested = false; mouseYaw = 0; mousePitch = 0; lastMessage = ''; lastMessageUntil = 0; document.querySelectorAll('[data-touch]').forEach((button) => button.classList.remove('held')); }
  function setHeld(action, source, active) { const sources = held[action]; if (!sources) return; active ? sources.add(source) : sources.delete(source); }
  function playSound(name) { try { const result = audio.play?.(name); if (result?.catch) result.catch(() => {}); } catch (_) {} }
  function unlockAudio() { try { const result = audio.unlock?.(); if (result?.catch) result.catch(() => {}); } catch (_) {} }
  function show(next) { clearInputs(); if (next === 'play' || next === 'pause') { accumulator = 0; lastFrame = performance.now(); } if (next !== 'play') { delete app.dataset.watching; app.style.setProperty('--suspicion', '0'); } screen = next; app.dataset.screen = next; document.querySelectorAll('[data-screen]').forEach((node) => node.classList.toggle('hidden', node.dataset.screen !== next)); render(); }
  function showMessage(text) { if (text) { lastMessage = text; lastMessageUntil = performance.now() + 3000; } }
  function renderTitle() { const button = document.getElementById('continue-button'); const has = Object.values(records).some((mode) => Object.keys(mode).length); if (button) { button.disabled = !has; button.textContent = has ? '기록 이어하기' : '기록 없음'; } }
  function renderLevels() { const list = document.getElementById('level-list'); if (!list) return; list.innerHTML = ''; (LEVELS || []).forEach((level, index) => { const open = unlocked(index), record = records[settings.mode]?.[level.id], button = document.createElement('button'); button.className = `level-option ${level.id === selectedLevel ? 'selected' : ''} ${open ? '' : 'locked'}`; button.dataset.levelId = level.id; button.disabled = !open; const text = document.createElement('span'), title = document.createElement('b'), description = document.createElement('small'); title.textContent = `${index + 1}. ${level.title}`; description.textContent = level.intro || '감시자의 시선을 읽으세요.'; text.append(title, description); const stat = document.createElement('em'); stat.className = 'level-record'; stat.textContent = record ? `${record.grade} · ${record.time.toFixed(1)}초` : open ? '미기록' : '잠김'; button.append(text, stat); button.addEventListener('click', () => { selectedLevel = level.id; renderLevels(); }); list.appendChild(button); }); const mode = document.getElementById('mode-select'); if (mode) mode.value = settings.mode; }
  function currentLevel() { return getLevel(selectedLevel) || LEVELS?.[0] || null; }
  function startRun() { if (sceneError) return; const level = currentLevel(); if (!level) return; run = createRun(level.id, settings.mode); selectedLevel = level.id; accumulator = 0; lastFrame = performance.now(); showMessage(''); unlockAudio(); try { scene?.setLevel?.(level); } catch (error) { sceneError = true; console.error(error); return; } try { audio.start?.(); } catch (_) {} playSound('select'); show('play'); }
  function continueRecords() { const index = (LEVELS || []).findIndex((level, position) => unlocked(position) && !records.standard?.[level.id] && !records.gentle?.[level.id]); const fallback = index >= 0 ? index : Math.max(0, (LEVELS || []).length - 1); selectedLevel = LEVELS?.[fallback]?.id || selectedLevel; show('select'); }
  function renderPlay() {
    if (!run) return;
    const player = run.player || {}, watching = run.watching ?? player.watching;
    app.dataset.watching = watching ? 'true' : 'false';
    app.style.setProperty('--suspicion', String(Math.max(0, Math.min(1, run.suspicion || 0))));
    const guards = run.guards || [], watcher = guards.find((guard) => guard.id === run.watchGuardId);
    const level = currentLevel(), relics = run.relics || [];
    const found = relics.filter((relic) => relic.discovered).length, collected = relics.filter((relic) => relic.collected).length;
    document.getElementById('wing-title').textContent = level?.title || run.levelId;
    document.getElementById('wing-mode').textContent = run.mode === 'gentle' ? '\uB290\uAE0B\uD55C \uC7A0\uC785' : '\uD45C\uC900 \uC7A0\uC785';
    document.getElementById('suspicion-value').textContent = Math.round((run.suspicion || 0) * 100) + '%';
    document.getElementById('suspicion-meter').style.width = Math.max(0, Math.min(100, (run.suspicion || 0) * 100)) + '%';
    document.getElementById('found-value').textContent = found;
    document.getElementById('collected-value').textContent = collected;
    document.getElementById('watcher-label').textContent = watching ? '\uC2DC\uC120: ' + (watcher?.name || '\uAC10\uC2DC\uC790') : '\uC2DC\uC120: \uB0B4 \uB208';
    document.getElementById('body-state').textContent = watching ? '\uBAB8: \uADF8 \uC790\uB9AC\uC5D0 \uBA48\uCDA4' : player.crouching ? player.inShadow ? '\uBAB8: \uC740\uC2E0 \uC911' : '\uBAB8: \uC6C5\uD06C\uB9BC - \uB178\uCD9C' : '\uBAB8: \uC774\uB3D9 \uAC00\uB2A5';
    const known = relics.filter((relic) => relic.discovered && !relic.collected).map((relic) => ({ target: relic, distance: Math.hypot(relic.x - player.x, relic.z - player.z) })).sort((a, b) => a.distance - b.distance);
    const nearest = known[0], exit = level?.exit ? { target: level.exit, distance: Math.hypot(level.exit.x - player.x, level.exit.z - player.z) } : null;
    const objective = nearest ? '\uBAA9\uD45C: ' + nearest.target.name + ' \uD68C\uC218 - ' + bearingLabel(player, nearest.target) : collected === relics.length && exit ? '\uCD9C\uAD6C - ' + bearingLabel(player, exit.target) : '\uAC10\uC2DC\uC790\uC758 \uC2DC\uC120\uC73C\uB85C \uC720\uBB3C\uC744 \uBC1C\uACAC\uD558\uC138\uC694.';
    document.getElementById('objective-text').textContent = watching && (nearest || collected === relics.length) ? '내 몸 기준 · ' + objective : objective;
    const tutorial = document.getElementById('tutorial-copy');
    const firstTip = usesTouch ? '웅크림을 켜고 Q 보기를 길게 누르세요. 몸은 멈추지만 감시자의 눈으로 유물이 드러납니다.' : 'Shift로 웅크린 채 Q를 누르고 계세요. 몸은 멈추지만 감시자의 눈으로 유물이 드러납니다.';
    if (tutorial) tutorial.textContent = run.time < 30 && found === 0 ? firstTip : watching ? '관찰 중입니다. Tab으로 다른 감시자를 살펴볼 수 있습니다.' : collected < relics.length ? '발견한 유물의 희미한 윤곽을 따라 E로 회수하세요.' : '모든 유물을 회수했습니다. 출구에서 E를 누르세요.';
    const prompt = document.getElementById('interact-prompt'), messageActive = lastMessage && performance.now() < lastMessageUntil;
    const nearbyRelic = nearest && nearest.distance <= 2.1 && lineOfSight(level, player, nearest.target), nearbyExit = exit && collected === relics.length && exit.distance <= 2.1 && lineOfSight(level, player, exit.target);
    prompt.textContent = messageActive ? lastMessage : watching ? '\uAD00\uCC30\uC790\uB97C \uBC14\uAFB8\uB824\uBA74 Tab, Q\uB97C \uB193\uC73C\uBA74 \uBAB8\uC73C\uB85C \uB3CC\uC544\uC635\uB2C8\uB2E4.' : nearbyRelic ? 'E - ' + nearest.target.name + ' \uD68C\uC218' : nearbyExit ? 'E - \uCD9C\uAD6C\uB85C \uB098\uAC00\uAE30' : '';
  }
  function renderClear() { const summary = summarize(run) || {}; document.getElementById('clear-title').textContent = `${currentLevel()?.title || ''} 통과`; document.getElementById('clear-copy').textContent = currentLevel()?.outro || '다음 전시관으로 이어집니다.'; document.getElementById('clear-stats').innerHTML = `<span><small>등급</small><b>${summary.grade || '—'}</b></span><span><small>시간</small><b>${Number(summary.time || 0).toFixed(1)}초</b></span><span><small>최고 의심</small><b>${Math.round((summary.peakSuspicion || 0) * 100)}%</b></span>`; }
  function renderEnding() { const summary = summarize(run) || {}; document.getElementById('ending-copy').textContent = `세 전시관의 시선이 끊긴 자리에서, 여섯 조각의 기억이 다시 주인을 찾습니다. 등급 ${summary.grade || '—'}.`; document.getElementById('ending-stats').innerHTML = `<span><small>회수</small><b>${summary.collected || 0} / ${summary.total || 0}</b></span><span><small>최고 의심</small><b>${Math.round((summary.peakSuspicion || 0) * 100)}%</b></span><span><small>시간</small><b>${Number(summary.time || 0).toFixed(1)}초</b></span>`; }
  function render() { if (screen === 'title') renderTitle(); else if (screen === 'select') renderLevels(); else if (screen === 'play') renderPlay(); else if (screen === 'clear') renderClear(); else if (screen === 'ending') renderEnding(); const mute = document.getElementById('mute-button'); if (mute) mute.textContent = settings.muted ? '음소거 해제' : '음소거'; const volume = document.getElementById('volume-range'); if (volume) volume.value = settings.volume; const mode = document.getElementById('mode-select'); if (mode) mode.value = settings.mode; }
  function finishRun() { if (!run) return; const summary = summarize(run) || {}; if (run.status === 'won') { records[run.mode] ||= {}; const old = records[run.mode][run.levelId]; if (!old || summary.time < old.time) { records[run.mode][run.levelId] = { time: summary.time, peakSuspicion: summary.peakSuspicion, grade: summary.grade }; saveRecords(); } const index = LEVELS.findIndex((level) => level.id === run.levelId); if (index === LEVELS.length - 1) { renderEnding(); show('ending'); playSound('win'); } else { renderClear(); show('clear'); playSound('win'); } } else { document.getElementById('defeat-copy').textContent = `의심이 ${Math.round((run.peakSuspicion || 0) * 100)}%까지 올랐습니다. 이 전시관을 다시 살펴보세요.`; show('defeat'); playSound('lose'); } clearInputs(); }
  function eventsFrom(events) { for (const event of events || []) { if (event.type === 'discovered' || event.type === 'collected') { const relic = run?.relics?.find((candidate) => candidate.id === event.relicId); showMessage(`${event.type === 'discovered' ? '기억 발견' : '기억 회수'} · ${relic?.name || '유물'}`); } else if (event.text) showMessage(event.text); if (event.type === 'watch') playSound('watch'); if (event.type === 'discovered') playSound('discovered'); if (event.type === 'collected') playSound('collected'); if (event.type === 'hint' || event.type === 'denied') playSound('denied'); } }
  function interactOnce() { if (!run || screen !== 'play') return []; try { return interact(run) || run.events || []; } catch (error) { console.error(error); return []; } }
  function inputFor(lookYaw = 0, lookPitch = 0) { return { forward: (held.forward.size ? 1 : 0) - (held.back.size ? 1 : 0), strafe: (held.right.size ? 1 : 0) - (held.left.size ? 1 : 0), turn: (held.turnRight.size ? 1 : 0) - (held.turnLeft.size ? 1 : 0), lookYaw, lookPitch, crouch: held.crouch.size > 0, watch: held.watch.size > 0 }; }
  function frame(now) {
    const elapsed = Math.min(.1, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    if (screen === 'play' && run) {
      accumulator += elapsed;
      let count = 0, first = true;
      const frameEvents = [];
      if (cycleRequested) {
        if (run.watching) {
          const events = cycleView(run) || [];
          frameEvents.push(...events);
          eventsFrom(events);
        }
        cycleRequested = false;
      }
      if (interactRequested) {
        const events = interactOnce();
        frameEvents.push(...events);
        eventsFrom(events);
        interactRequested = false;
      }
      while (accumulator >= FIXED && count++ < 8) {
        const input = inputFor(first ? mouseYaw : 0, first ? mousePitch : 0);
        const events = stepRun(run, input, FIXED) || [];
        frameEvents.push(...events);
        eventsFrom(events);
        accumulator -= FIXED;
        first = false;
      }
      run.events = frameEvents;
      if (!first || run.watching || held.watch.size) { mouseYaw = 0; mousePitch = 0; }
      try { scene?.update?.(run, elapsed); } catch (error) { console.error(error); }
      try { audio.update?.(run, elapsed); } catch (_) {}
      renderPlay();
      if (run.status !== 'playing') finishRun();
    }
    requestAnimationFrame(frame);
  }
  function pointerMove(event) { if (screen !== 'play') return; if (document.pointerLockElement === canvas || dragPointer === event.pointerId) { mouseYaw += event.movementX * .0024; mousePitch -= event.movementY * .0024; } }
  function keydown(event) { if (['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target?.tagName)) return; const key = event.key.toLowerCase(); if (key === 'm' && !event.repeat) { settings.muted = !settings.muted; saveSettings(); audio.setMuted?.(settings.muted); render(); return; } if (key === 'escape' && !event.repeat) { if (screen === 'play') { previousScreen = 'play'; clearInputs(); audio.pause?.(); document.exitPointerLock?.(); show('pause'); } else if (screen === 'pause') { audio.resume?.(); show('play'); } else if (screen === 'guide' || screen === 'select') show(previousScreen); event.preventDefault(); return; } if (screen === 'title' && key === 'enter') { show('select'); event.preventDefault(); return; } if (screen === 'select' && key === 'enter') { startRun(); event.preventDefault(); return; } if (screen === 'clear' && key === 'enter') { const index = LEVELS.findIndex((level) => level.id === run?.levelId); selectedLevel = LEVELS[index + 1]?.id || selectedLevel; startRun(); event.preventDefault(); return; } if (screen === 'defeat' && (key === 'r' || key === 'enter')) { startRun(); event.preventDefault(); return; } if (screen === 'ending' && key === 'enter') { show('select'); event.preventDefault(); return; } if (screen !== 'play') return; if (key === 'q') { setHeld('watch', 'key:q', true); event.preventDefault(); } else if (key === 'shift') { setHeld('crouch', 'key:shift', true); event.preventDefault(); } else if (key === 'w' || key === 'arrowup') { setHeld('forward', `key:${key}`, true); event.preventDefault(); } else if (key === 's' || key === 'arrowdown') { setHeld('back', `key:${key}`, true); event.preventDefault(); } else if (key === 'a') { setHeld('left', 'key:a', true); event.preventDefault(); } else if (key === 'd') { setHeld('right', 'key:d', true); event.preventDefault(); } else if (key === 'arrowleft') { setHeld('turnLeft', 'key:arrowleft', true); event.preventDefault(); } else if (key === 'arrowright') { setHeld('turnRight', 'key:arrowright', true); event.preventDefault(); } else if (key === 'e' && !event.repeat) { interactRequested = true; event.preventDefault(); } else if (key === 'tab' && !event.repeat) { cycleRequested = true; event.preventDefault(); } }
  function keyup(event) { const key = event.key.toLowerCase(); if (key === 'q') setHeld('watch', 'key:q', false); else if (key === 'shift') setHeld('crouch', 'key:shift', false); else if (key === 'w' || key === 'arrowup') setHeld('forward', `key:${key}`, false); else if (key === 's' || key === 'arrowdown') setHeld('back', `key:${key}`, false); else if (key === 'a') setHeld('left', 'key:a', false); else if (key === 'd') setHeld('right', 'key:d', false); else if (key === 'arrowleft') setHeld('turnLeft', 'key:arrowleft', false); else if (key === 'arrowright') setHeld('turnRight', 'key:arrowright', false); }
  function touchSetup() { document.querySelectorAll('[data-touch]').forEach((button) => { const action = button.dataset.touch; const heldAction = action === 'left' ? 'turnLeft' : action === 'right' ? 'turnRight' : action; button.addEventListener('pointerdown', (event) => { if (screen !== 'play') return; event.preventDefault(); if (['interact', 'cycle'].includes(action)) { if (action === 'interact') interactRequested = true; else cycleRequested = true; return; } if (action === 'crouch') { const source = 'touch:crouch'; if (held.crouch.has(source)) held.crouch.delete(source); else held.crouch.add(source); button.classList.toggle('held', held.crouch.has(source)); return; } setHeld(heldAction, `touch:${event.pointerId}`, true); button.classList.add('held'); try { button.setPointerCapture(event.pointerId); } catch (_) {} }); const release = (event) => { const source = `touch:${event.pointerId}`; if (['forward', 'back', 'left', 'right', 'watch'].includes(action)) setHeld(heldAction, source, false); if (action !== 'crouch' || !held.crouch.has('touch:crouch')) button.classList.remove('held'); }; button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release); }); }
  app.addEventListener('click', (event) => { const levelButton = event.target.closest('[data-level-id]'); if (levelButton && !levelButton.disabled) { selectedLevel = levelButton.dataset.levelId; renderLevels(); return; } const button = event.target.closest('[data-action]'); if (!button || button.disabled) return; unlockAudio(); const action = button.dataset.action; if (action === 'start') show('select'); else if (action === 'begin') { if (screen === 'title') continueRecords(); else startRun(); } else if (action === 'continue') continueRecords(); else if (action === 'pause') { if (screen === 'play') { previousScreen = 'play'; clearInputs(); audio.pause?.(); document.exitPointerLock?.(); show('pause'); } } else if (action === 'resume') { audio.resume?.(); show('play'); } else if (action === 'guide') { previousScreen = screen; show('guide'); } else if (action === 'back') { if (screen === 'pause' || screen === 'clear' || screen === 'defeat') { run = null; show('select'); } else show(previousScreen); } else if (action === 'next') { const index = LEVELS.findIndex((level) => level.id === run?.levelId); selectedLevel = LEVELS[index + 1]?.id || selectedLevel; startRun(); } else if (action === 'retry') startRun(); else if (action === 'restart') { run = null; show('select'); } else if (action === 'mute') { settings.muted = !settings.muted; saveSettings(); audio.setMuted?.(settings.muted); render(); } });
  canvas.addEventListener('click', () => { if (screen === 'play' && canvas.requestPointerLock) { try { const result = canvas.requestPointerLock(); if (result?.catch) result.catch(() => {}); } catch (_) {} } }); canvas.addEventListener('mousemove', pointerMove); canvas.addEventListener('pointerdown', (event) => { if (screen === 'play' && event.pointerType !== 'touch') dragPointer = event.pointerId; }); canvas.addEventListener('pointerup', () => { dragPointer = null; }); canvas.addEventListener('pointercancel', () => { dragPointer = null; });
  window.addEventListener('blur', () => { clearInputs(); if (screen === 'play') { audio.pause?.(); show('pause'); } }); document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInputs(); if (screen === 'play') { audio.pause?.(); show('pause'); } } }); window.addEventListener('resize', () => scene?.resize?.()); document.getElementById('volume-range')?.addEventListener('input', (event) => { settings.volume = Math.max(0, Math.min(1, Number(event.target.value) || 0)); saveSettings(); audio.setVolume?.(settings.volume); }); document.getElementById('mode-select')?.addEventListener('change', (event) => { settings.mode = event.target.value === 'gentle' ? 'gentle' : 'standard'; saveSettings(); }); touchSetup(); document.addEventListener('keydown', keydown); document.addEventListener('keyup', keyup);
  Object.defineProperty(window, '__sight', { configurable: false, enumerable: true, get: () => ({ get ready() { return true; }, get screen() { return screen; }, get run() { return clone(run); }, get settings() { return clone(settings); }, get records() { return clone(records); }, get sceneStats() { return clone(scene?.stats || {}); } }) });
  scene?.resize?.(); render(); requestAnimationFrame(frame);
}

if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot(); }
