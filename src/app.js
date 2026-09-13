import { LEVELS, getLevel, findPath, lineOfSight as hasSight } from './levels.js';
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
  const direction = ['앞', '오른쪽 앞', '오른쪽', '오른쪽 뒤', '뒤', '왼쪽 뒤', '왼쪽', '왼쪽 앞'][(Math.round(angle / (Math.PI / 4)) + 8) % 8];
  return `${direction} · ${distance.toFixed(1)}m`;
}
function guidancePoint(level, player, target) {
  if (!level || !player || !target) return null;
  if (lineOfSight(level, player, target)) return { point: target, through: false };
  const path = findPath(level, player, target);
  for (let index = path.length - 1; index >= 0; index -= 1) {
    if (lineOfSight(level, player, path[index])) return { point: path[index], through: true };
  }
  return path[1] ? { point: path[1], through: true } : null;
}

function boot() {
  const app = document.getElementById('app'), world = document.getElementById('world'), canvas = document.getElementById('world-canvas');
  const usesTouch = matchMedia('(pointer:coarse)').matches;
  let scene = null, sceneError = false, run = null, screen = 'title', selectedLevel = LEVELS?.[0]?.id || null, previousScreen = 'title', settings = loadSettings(), records = loadRecords();
  let accumulator = 0, lastFrame = performance.now(), mouseYaw = 0, mousePitch = 0, interactRequested = false, cycleRequested = false, dragPointer = null, dragPoint = null, lastMessage = '', lastMessageUntil = 0, watchToggle = false, hurryToggle = false, pointerLockFallback = false;
  const held = { forward: new Set(), back: new Set(), left: new Set(), right: new Set(), turnLeft: new Set(), turnRight: new Set(), hurry: new Set() };
  const audio = safeAudio(); audio.setVolume?.(settings.volume); audio.setMuted?.(settings.muted);
  try { scene = createScene(world); } catch (error) { sceneError = true; const fallback = document.getElementById('scene-fallback'); if (fallback) { fallback.textContent = '3D 장면을 사용할 수 없습니다. WebGL을 켠 뒤 새로고침해 주세요.'; fallback.classList.remove('hidden'); } console.error(error); }

  function safeAudio() { try { return createAudio?.() || {}; } catch (error) { console.error(error); return {}; } }
  function loadSettings() { try { const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); return { volume: Number.isFinite(raw?.volume) ? Math.max(0, Math.min(1, raw.volume)) : .24, muted: raw?.muted === true, mode: raw?.mode === 'gentle' ? 'gentle' : 'standard' }; } catch (_) { return { volume: .24, muted: false, mode: 'standard' }; } }
  function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (_) {} }
  function loadRecords() { try { const raw = JSON.parse(localStorage.getItem(RECORDS_KEY) || '{}'), clean = { standard: {}, gentle: {} }; for (const mode of ['standard', 'gentle']) for (const level of LEVELS || []) { const record = raw?.[mode]?.[level.id]; if (record && ['S', 'A', 'B'].includes(record.grade) && Number.isFinite(record.time) && record.time >= 0 && Number.isFinite(record.peakSuspicion) && record.peakSuspicion >= 0) clean[mode][level.id] = { time: record.time, peakSuspicion: record.peakSuspicion, grade: record.grade }; } return clean; } catch (_) { return { standard: {}, gentle: {} }; } }
  function saveRecords() { try { localStorage.setItem(RECORDS_KEY, JSON.stringify(records)); } catch (_) {} }
  function unlocked(index) { return index === 0 || !!records.standard?.[LEVELS[index - 1]?.id] || !!records.gentle?.[LEVELS[index - 1]?.id]; }
  function clearInputs() { const captured = dragPointer; dragPointer = null; dragPoint = null; if (captured !== null && canvas.hasPointerCapture(captured)) canvas.releasePointerCapture(captured); Object.values(held).forEach((sources) => sources.clear()); interactRequested = false; cycleRequested = false; mouseYaw = 0; mousePitch = 0; watchToggle = false; hurryToggle = false; lastMessage = ''; lastMessageUntil = 0; document.querySelectorAll('[data-touch]').forEach((button) => button.classList.remove('held')); }
  function setHeld(action, source, active) { const sources = held[action]; if (!sources) return; active ? sources.add(source) : sources.delete(source); }
  function playSound(name) { try { const result = audio.play?.(name); if (result?.catch) result.catch(() => {}); } catch (_) {} }
  function unlockAudio() { try { const result = audio.unlock?.(); if (result?.catch) result.catch(() => {}); } catch (_) {} }
  function show(next) { const leavingPlay = screen === 'play' && next !== 'play'; screen = next; clearInputs(); if (next === 'play' || next === 'pause') { accumulator = 0; lastFrame = performance.now(); } if (next !== 'play') { delete app.dataset.watching; app.style.setProperty('--suspicion', '0'); } app.dataset.screen = next; if (leavingPlay && document.pointerLockElement === canvas) document.exitPointerLock?.(); document.querySelectorAll('[data-screen]').forEach((node) => node.classList.toggle('hidden', node.dataset.screen !== next)); render(); }
  function showMessage(text) { if (text) { lastMessage = text; lastMessageUntil = performance.now() + 3000; } }
  function renderTitle() { const button = document.getElementById('continue-button'); const has = Object.values(records).some((mode) => Object.keys(mode).length); if (button) { button.disabled = !has; button.textContent = has ? '기록 이어하기' : '기록 없음'; } }
  function renderLevels() { const list = document.getElementById('level-list'); if (!list) return; list.innerHTML = ''; (LEVELS || []).forEach((level, index) => { const open = unlocked(index), record = records[settings.mode]?.[level.id], button = document.createElement('button'); button.className = `level-option ${level.id === selectedLevel ? 'selected' : ''} ${open ? '' : 'locked'}`; button.dataset.levelId = level.id; button.disabled = !open; const text = document.createElement('span'), title = document.createElement('b'), description = document.createElement('small'); title.textContent = `${index + 1}. ${level.title}`; description.textContent = level.intro || '감시자의 시선을 읽으세요.'; text.append(title, description); const stat = document.createElement('em'); stat.className = 'level-record'; stat.textContent = record ? `${record.grade} · ${record.time.toFixed(1)}초` : open ? '미기록' : '잠김'; button.append(text, stat); button.addEventListener('click', () => { selectedLevel = level.id; renderLevels(); }); list.appendChild(button); }); const mode = document.getElementById('mode-select'); if (mode) mode.value = settings.mode; }
  function currentLevel() { return getLevel(selectedLevel) || LEVELS?.[0] || null; }
  function startRun() { if (sceneError) return; const level = currentLevel(); if (!level) return; run = createRun(level.id, settings.mode); selectedLevel = level.id; accumulator = 0; lastFrame = performance.now(); pointerLockFallback = false; showMessage(''); unlockAudio(); try { scene?.setLevel?.(level); } catch (error) { sceneError = true; console.error(error); return; } try { audio.start?.(); } catch (_) {} playSound('select'); show('play'); }
  function continueRecords() { const index = (LEVELS || []).findIndex((level, position) => unlocked(position) && !records.standard?.[level.id] && !records.gentle?.[level.id]); const fallback = index >= 0 ? index : Math.max(0, (LEVELS || []).length - 1); selectedLevel = LEVELS?.[fallback]?.id || selectedLevel; show('select'); }
  function renderPlay() {
    if (!run) return;
    const { player, watching, guards, relics } = run, level = currentLevel();
    const watcher = guards.find(guard => guard.id === run.watchGuardId);
    const collected = relics.filter(relic => relic.collected).length;
    app.dataset.watching = String(watching);
    app.style.setProperty('--suspicion', String(run.suspicion));
    document.getElementById('wing-title').textContent = level.title;
    document.getElementById('wing-mode').textContent = run.mode === 'gentle' ? '느긋한 잠입' : '표준 잠입';
    document.getElementById('suspicion-value').textContent = Math.round(run.suspicion * 100) + '%';
    document.getElementById('suspicion-meter').style.width = run.suspicion * 100 + '%';
    document.getElementById('collected-value').textContent = collected;
    document.getElementById('total-value').textContent = relics.length;
    document.getElementById('watcher-label').textContent = watching ? '감시자의 눈 · ' + watcher.name : '내 눈';
    document.getElementById('body-state').textContent = player.crouching && player.inShadow ? '몸 · 피난처에 숨음' : watching ? '몸 · 그 자리에 멈춤 / 노출' : player.crouching ? '조용한 걸음' : '빠른 걸음 · 발소리 주의';
    const known = relics.filter(relic => relic.discovered && !relic.collected).sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z));
    const exiting = collected === relics.length, target = exiting ? level.exit : known[0];
    const guidance = target && !watching ? guidancePoint(level, player, target) : null;
    let objective;
    if (watching) objective = target ? (usesTouch ? '2 · 몸으로 복귀 버튼으로 돌아가기' : '2 · Q 다시 눌러 내 몸으로 돌아가기') : '1 · 순찰하는 눈으로 숨은 유물 찾기';
    else if (target) objective = (exiting ? '3 · 출구로 탈출' : '2 · ' + target.name + ' 회수') + (guidance ? (guidance.through ? ' · 통로' : '') + ' · ' + bearingLabel(player, guidance.point) : '');
    else objective = usesTouch ? '1 · 관찰 눌러 감시자의 눈 빌리기' : '1 · Q 눌러 감시자의 눈 빌리기';
    document.getElementById('objective-text').textContent = objective;
    const tutorial = document.getElementById('tutorial-copy');
    tutorial.textContent = watching
      ? (target ? '발견한 기억은 내 눈에도 보입니다. 직접 다가가 회수하세요.' : guards.length > 1 ? (usesTouch ? '다음 버튼으로 다른 감시자를 살펴보세요. 내 몸은 그 자리에 있습니다.' : 'Tab · 다른 감시자 / Q · 몸으로 복귀. 내 몸은 그 자리에 있습니다.') : '감시자는 계속 순찰합니다. 유물이 보이면 기억됩니다.')
      : target ? (exiting ? '모든 기억을 회수했습니다. 출구 가까이서 E를 누르세요.' : '통로를 따라 이동하고 유물 가까이서 E를 누르세요.')
      : usesTouch ? '관찰을 한 번 누르세요. 이동은 조용한 걸음, 오른쪽 화면을 밀면 시점이 돌아갑니다.' : 'WASD · 조용한 이동 / 마우스 · 시점 / Shift · 빠르게 걷기';
    const cycleButton = document.querySelector('[data-touch="cycle"]');
    cycleButton.classList.toggle('hidden', guards.length < 2 || !watching);
    const watchButton = document.querySelector('[data-touch="watch"]');
    watchButton.classList.toggle('held', watching); watchButton.textContent = watching ? '몸으로 복귀' : '관찰';
    const hurryButton = document.querySelector('[data-touch="hurry"]');
    hurryButton.classList.toggle('held', hurryToggle);
    const nearby = target && Math.hypot(target.x - player.x, target.z - player.z) <= 2.1 && lineOfSight(level, player, target);
    document.getElementById('interact-prompt').textContent = lastMessage && performance.now() < lastMessageUntil ? lastMessage : !watching && nearby ? (exiting ? 'E · 탈출' : 'E · ' + target.name + ' 회수') : '';
  }
  function renderClear() { const summary = summarize(run) || {}; document.getElementById('clear-title').textContent = `${currentLevel()?.title || ''} 통과`; document.getElementById('clear-copy').textContent = currentLevel()?.outro || '다음 전시관으로 이어집니다.'; document.getElementById('clear-stats').innerHTML = `<span><small>등급</small><b>${summary.grade || '—'}</b></span><span><small>시간</small><b>${Number(summary.time || 0).toFixed(1)}초</b></span><span><small>최고 의심</small><b>${Math.round((summary.peakSuspicion || 0) * 100)}%</b></span>`; }
  function renderEnding() { const summary = summarize(run) || {}; document.getElementById('ending-copy').textContent = `세 전시관의 시선이 끊긴 자리에서, 여섯 조각의 기억이 다시 주인을 찾습니다. 등급 ${summary.grade || '—'}.`; document.getElementById('ending-stats').innerHTML = `<span><small>회수</small><b>${summary.collected || 0} / ${summary.total || 0}</b></span><span><small>최고 의심</small><b>${Math.round((summary.peakSuspicion || 0) * 100)}%</b></span><span><small>시간</small><b>${Number(summary.time || 0).toFixed(1)}초</b></span>`; }
  function render() { if (screen === 'title') renderTitle(); else if (screen === 'select') renderLevels(); else if (screen === 'play') renderPlay(); else if (screen === 'clear') renderClear(); else if (screen === 'ending') renderEnding(); const mute = document.getElementById('mute-button'); if (mute) mute.textContent = settings.muted ? '음소거 해제' : '음소거'; const volume = document.getElementById('volume-range'); if (volume) volume.value = settings.volume; const mode = document.getElementById('mode-select'); if (mode) mode.value = settings.mode; }
  function finishRun() { if (!run) return; const summary = summarize(run) || {}; if (run.status === 'won') { records[run.mode] ||= {}; const old = records[run.mode][run.levelId]; if (!old || summary.time < old.time) { records[run.mode][run.levelId] = { time: summary.time, peakSuspicion: summary.peakSuspicion, grade: summary.grade }; saveRecords(); } const index = LEVELS.findIndex((level) => level.id === run.levelId); if (index === LEVELS.length - 1) { renderEnding(); show('ending'); playSound('win'); } else { renderClear(); show('clear'); playSound('win'); } } else { document.getElementById('defeat-copy').textContent = `의심이 ${Math.round((run.peakSuspicion || 0) * 100)}%까지 올랐습니다. 이 전시관을 다시 살펴보세요.`; show('defeat'); playSound('lose'); } clearInputs(); }
  function eventsFrom(events) { for (const event of events || []) { if (event.type === 'discovered' || event.type === 'collected') { const relic = run?.relics?.find((candidate) => candidate.id === event.relicId); showMessage(`${event.type === 'discovered' ? '기억 발견' : '기억 회수'} · ${relic?.name || '유물'}`); } else if (event.text) showMessage(event.text); if (event.type === 'watch') playSound('watch'); if (event.type === 'discovered') playSound('discovered'); if (event.type === 'collected') playSound('collected'); if (event.type === 'hint' || event.type === 'denied') playSound('denied'); } }
  function interactOnce() { if (!run || screen !== 'play') return []; try { return interact(run) || run.events || []; } catch (error) { console.error(error); return []; } }
  function inputFor(lookYaw = 0, lookPitch = 0) { return { forward: (held.forward.size ? 1 : 0) - (held.back.size ? 1 : 0), strafe: (held.right.size ? 1 : 0) - (held.left.size ? 1 : 0), turn: (held.turnRight.size ? 1 : 0) - (held.turnLeft.size ? 1 : 0), lookYaw, lookPitch, crouch: !hurryToggle && !held.hurry.size, watch: watchToggle }; }
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
      if (!first || run.watching || watchToggle) { mouseYaw = 0; mousePitch = 0; }
      try { scene?.update?.(run, elapsed); } catch (error) { console.error(error); }
      try { audio.update?.(run, elapsed); } catch (_) {}
      renderPlay();
      if (run.status !== 'playing') finishRun();
    }
    requestAnimationFrame(frame);
  }
  function pointerMove(event) {
    if (screen !== 'play') return;
    if (document.pointerLockElement === canvas) {
      mouseYaw += (event.movementX || 0) * .0024;
      mousePitch -= (event.movementY || 0) * .0024;
      return;
    }
    if (dragPointer !== event.pointerId || !dragPoint) return;
    mouseYaw += (event.clientX - dragPoint.x) * .0024;
    mousePitch -= (event.clientY - dragPoint.y) * .0024;
    dragPoint = { x: event.clientX, y: event.clientY };
  }
  function keydown(event) { if (['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target?.tagName)) return; const key = event.key.toLowerCase(); if (key === 'm' && !event.repeat) { settings.muted = !settings.muted; saveSettings(); audio.setMuted?.(settings.muted); render(); return; } if (key === 'escape' && !event.repeat) { if (screen === 'play') { previousScreen = 'play'; show('pause'); audio.pause?.(); } else if (screen === 'pause') { audio.resume?.(); show('play'); } else if (screen === 'guide' || screen === 'select') show(previousScreen); event.preventDefault(); return; } if (screen === 'title' && key === 'enter' && !event.repeat) { show('select'); event.preventDefault(); return; } if (screen === 'select' && key === 'enter' && !event.repeat) { startRun(); event.preventDefault(); return; } if (screen === 'clear' && key === 'enter' && !event.repeat) { const index = LEVELS.findIndex((level) => level.id === run?.levelId); selectedLevel = LEVELS[index + 1]?.id || selectedLevel; startRun(); event.preventDefault(); return; } if (screen === 'defeat' && (key === 'r' || key === 'enter') && !event.repeat) { startRun(); event.preventDefault(); return; } if (screen === 'ending' && key === 'enter' && !event.repeat) { show('select'); event.preventDefault(); return; } if (screen !== 'play') return; if (key === 'q' && !event.repeat) { watchToggle = !watchToggle; event.preventDefault(); } else if (key === 'shift') { setHeld('hurry', `key:${key}`, true); event.preventDefault(); } else if (key === 'w' || key === 'arrowup') { setHeld('forward', `key:${key}`, true); event.preventDefault(); } else if (key === 's' || key === 'arrowdown') { setHeld('back', `key:${key}`, true); event.preventDefault(); } else if (key === 'a') { setHeld('left', 'key:a', true); event.preventDefault(); } else if (key === 'd') { setHeld('right', 'key:d', true); event.preventDefault(); } else if (key === 'arrowleft') { setHeld('turnLeft', 'key:arrowleft', true); event.preventDefault(); } else if (key === 'arrowright') { setHeld('turnRight', 'key:arrowright', true); event.preventDefault(); } else if (key === 'e' && !event.repeat) { interactRequested = true; event.preventDefault(); } else if (key === 'tab') { if (!event.repeat && run?.watching && run.guards.length > 1) cycleRequested = true; event.preventDefault(); } }
  function keyup(event) {
    const key = event.key.toLowerCase();
    if (key === 'shift') setHeld('hurry', 'key:shift', false);
    else if (key === 'w' || key === 'arrowup') setHeld('forward', `key:${key}`, false);
    else if (key === 's' || key === 'arrowdown') setHeld('back', `key:${key}`, false);
    else if (key === 'a') setHeld('left', 'key:a', false);
    else if (key === 'd') setHeld('right', 'key:d', false);
    else if (key === 'arrowleft') setHeld('turnLeft', 'key:arrowleft', false);
    else if (key === 'arrowright') setHeld('turnRight', 'key:arrowright', false);
  }
  function touchSetup() {
    document.querySelectorAll('[data-touch]').forEach((button) => {
      const action = button.dataset.touch;
      const heldAction = action === 'left' ? 'turnLeft' : action === 'right' ? 'turnRight' : action;
      button.addEventListener('pointerdown', (event) => {
        if (screen !== 'play') return;
        event.preventDefault();
        if (action === 'interact' || action === 'cycle') {
          if (action === 'interact') interactRequested = true;
          else if (run?.watching && (run.guards || []).length > 1) cycleRequested = true;
          return;
        }
        if (action === 'watch') {
          watchToggle = !watchToggle;
          button.classList.toggle('held', watchToggle);
          return;
        }
        if (action === 'hurry') {
          hurryToggle = !hurryToggle;
          button.classList.toggle('held', hurryToggle);
          return;
        }
        setHeld(heldAction, `touch:${event.pointerId}`, true);
        button.classList.add('held');
        try { button.setPointerCapture(event.pointerId); } catch (_) {}
      });
      const release = (event) => {
        event.preventDefault();
        const source = `touch:${event.pointerId}`;
        if (['forward', 'back', 'left', 'right'].includes(action)) setHeld(heldAction, source, false);
        if (action !== 'watch' && action !== 'hurry') button.classList.remove('held');
      };
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
    });
  }
  app.addEventListener('click', (event) => { const levelButton = event.target.closest('[data-level-id]'); if (levelButton && !levelButton.disabled) { selectedLevel = levelButton.dataset.levelId; renderLevels(); return; } const button = event.target.closest('[data-action]'); if (!button || button.disabled) return; const action = button.dataset.action; if (action === 'start') show('select'); else if (action === 'begin') { if (screen === 'title') continueRecords(); else { unlockAudio(); startRun(); } } else if (action === 'continue') continueRecords(); else if (action === 'pause') { if (screen === 'play') { previousScreen = 'play'; show('pause'); audio.pause?.(); } } else if (action === 'resume') { unlockAudio(); audio.resume?.(); show('play'); } else if (action === 'guide') { previousScreen = screen; show('guide'); } else if (action === 'back') { if (screen === 'pause' || screen === 'clear' || screen === 'defeat') { run = null; show('select'); } else show(previousScreen); } else if (action === 'next') { unlockAudio(); const index = LEVELS.findIndex((level) => level.id === run?.levelId); selectedLevel = LEVELS[index + 1]?.id || selectedLevel; startRun(); } else if (action === 'retry') { unlockAudio(); startRun(); } else if (action === 'restart') { run = null; show('select'); } else if (action === 'mute') { settings.muted = !settings.muted; saveSettings(); audio.setMuted?.(settings.muted); render(); } });
  canvas.addEventListener('click', () => {
    if (screen !== 'play' || usesTouch || pointerLockFallback || !canvas.requestPointerLock) return;
    try {
      const result = canvas.requestPointerLock();
      if (result?.catch) result.catch(() => { pointerLockFallback = true; });
    } catch (_) { pointerLockFallback = true; }
  });
  canvas.addEventListener('pointermove', pointerMove, { passive: false });
  canvas.addEventListener('pointerdown', (event) => {
    if (screen !== 'play' || document.pointerLockElement === canvas) return;
    if (event.pointerType !== 'touch' || event.clientX > window.innerWidth * .45) {
      dragPointer = event.pointerId;
      dragPoint = { x: event.clientX, y: event.clientY };
      try { canvas.setPointerCapture(event.pointerId); } catch (_) {}
    }
  });
  const releaseCanvasPointer = (event) => {
    if (dragPointer === event.pointerId) { dragPointer = null; dragPoint = null; }
  };
  canvas.addEventListener('pointerup', releaseCanvasPointer);
  canvas.addEventListener('pointercancel', releaseCanvasPointer);
  canvas.addEventListener('lostpointercapture', releaseCanvasPointer);
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === canvas || screen !== 'play' || !run) return;
    audio.pause?.();
    show('pause');
  });
  window.addEventListener('blur', () => { clearInputs(); if (screen === 'play') { audio.pause?.(); show('pause'); } }); document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInputs(); if (screen === 'play') { audio.pause?.(); show('pause'); } } }); window.addEventListener('resize', () => scene?.resize?.()); document.getElementById('volume-range')?.addEventListener('input', (event) => { settings.volume = Math.max(0, Math.min(1, Number(event.target.value) || 0)); saveSettings(); audio.setVolume?.(settings.volume); }); document.getElementById('mode-select')?.addEventListener('change', (event) => { settings.mode = event.target.value === 'gentle' ? 'gentle' : 'standard'; saveSettings(); }); touchSetup(); document.addEventListener('keydown', keydown); document.addEventListener('keyup', keyup);
  Object.defineProperty(window, '__sight', { configurable: false, enumerable: true, get: () => ({ get ready() { return true; }, get screen() { return screen; }, get run() { return clone(run); }, get settings() { return clone(settings); }, get records() { return clone(records); }, get sceneStats() { return clone(scene?.stats || {}); } }) });
  scene?.resize?.(); render(); requestAnimationFrame(frame);
}

if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot(); }
