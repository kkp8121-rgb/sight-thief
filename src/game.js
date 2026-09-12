import { getLevel, findPath, isWalkable, lineOfSight } from './levels.js';

const WALK_SPEED = 3.2;
const CROUCH_SPEED = 1.6;
const TURN_SPEED = 1.7;
const BODY_RADIUS = 0.28;
const EYE_HEIGHT = 1.65;
const CROUCH_EYE_HEIGHT = 1.05;
const TAU = Math.PI * 2;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clone = (value) => JSON.parse(JSON.stringify(value));
const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
const deltaAngle = (from, to) => wrap(to - from);
const approachAngle = (from, to, amount) => from + clamp(deltaAngle(from, to), -amount, amount);
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const radians = (degrees) => degrees * Math.PI / 180;

function event(run, events, value) {
  events.push({ ...value });
}

function inputNumber(input, key, low = -1, high = 1) {
  return clamp(finite(Number(input?.[key]), 0), low, high);
}

function cellIsShadow(level, x, z) {
  const cell = level && level.grid ? level.grid[Math.floor(z / level.cell + level.height / 2)]?.[Math.floor(x / level.cell + level.width / 2)] : null;
  return cell === 's' || cell === 'S';
}

function canOccupy(level, x, z) {
  if (!isWalkable(level, x, z)) return false;
  for (let index = 0; index < 8; index += 1) {
    const angle = index * TAU / 8;
    if (!isWalkable(level, x + Math.cos(angle) * BODY_RADIUS, z + Math.sin(angle) * BODY_RADIUS)) return false;
  }
  return true;
}

function movePlayer(run, level, dx, dz) {
  const before = { x: run.player.x, z: run.player.z };
  const tryMove = (x, z) => { if (canOccupy(level, x, z)) { run.player.x = x; run.player.z = z; return true; } return false; };
  if (!tryMove(before.x + dx, before.z + dz)) {
    if (Math.abs(dx) > 0) tryMove(before.x + dx, before.z);
    if (Math.abs(dz) > 0) tryMove(run.player.x, before.z + dz);
  }
  return Math.hypot(run.player.x - before.x, run.player.z - before.z);
}

function guardPath(run, level, guard, destination) {
  const path = findPath(level, guard, destination);
  guard._path = path.length > 1 ? path : [];
  guard._pathIndex = guard._path.length > 1 ? 1 : 0;
  guard._pathTarget = destination ? { x: destination.x, z: destination.z } : null;
}

function patrolTarget(guard) {
  return guard.route[(guard.routeIndex + 1) % guard.route.length];
}

function updateGuard(run, level, guard, dt) {
  let target;
  let speed;
  if (guard.mode === 'investigate') {
    guard._investigateRemaining = Math.max(0, guard._investigateRemaining - dt);
    if (guard._investigateRemaining <= 0) {
      guard.mode = 'patrol'; guard.target = null; guard._path = []; guard._pathIndex = 0;
    }
  }
  if (guard.mode === 'investigate') {
    if (!guard._path?.length || guard._pathIndex >= guard._path.length) guardPath(run, level, guard, guard.target || guard);
    target = guard._path?.[guard._pathIndex] || guard.target;
    speed = 1.8;
  } else {
    const patrol = patrolTarget(guard);
    if (!guard._path?.length || !guard._pathTarget || Math.hypot(guard._pathTarget.x - patrol.x, guard._pathTarget.z - patrol.z) > .01) guardPath(run, level, guard, patrol);
    target = guard._path?.[guard._pathIndex] || patrol;
    speed = 1.45;
  }
  if (target) {
    const dx = target.x - guard.x, dz = target.z - guard.z, length = Math.hypot(dx, dz);
    if (length <= Math.max(.04, speed * dt)) {
      guard.x = target.x; guard.z = target.z;
      if (guard.mode === 'patrol') {
        if (guard._path?.length && guard._pathIndex < guard._path.length - 1) guard._pathIndex += 1;
        else { guard.routeIndex = (guard.routeIndex + 1) % guard.route.length; guard._path = []; guard._pathIndex = 0; guard._pathTarget = null; }
      } else guard._pathIndex += 1;
    } else {
      const desiredYaw = Math.atan2(dx, -dz);
      guard.yaw = approachAngle(guard.yaw, desiredYaw, TURN_SPEED * dt);
      guard.x += dx / length * speed * dt;
      guard.z += dz / length * speed * dt;
    }
  }
  if (guard.mode === 'patrol') {
    const next = patrolTarget(guard);
    if (next) guard.yaw = approachAngle(guard.yaw, Math.atan2(next.x - guard.x, -(next.z - guard.z)), TURN_SPEED * dt);
  }
}

function playerVisible(run, level, guard) {
  const player = run.player;
  const gap = distance(player, guard);
  const range = 14 * (run.mode === 'gentle' ? .9 : 1);
  const crouchHidden = player.crouching && player.inShadow && gap > 1.6;
  if (crouchHidden || gap > range || !lineOfSight(level, guard.x, guard.z, player.x, player.z)) return false;
  const targetYaw = Math.atan2(player.x - guard.x, -(player.z - guard.z));
  return Math.abs(deltaAngle(guard.yaw, targetYaw)) <= radians(40) || gap <= .65;
}

function hearPlayer(run, level, guard) {
  if (!run.player.moving) return false;
  const radius = run.player.crouching ? 1.25 : 5.5;
  return distance(run.player, guard) <= radius && lineOfSight(level, guard.x, guard.z, run.player.x, run.player.z);
}

function updateAwareness(run, level, guard, dt, events) {
  if (hearPlayer(run, level, guard) && guard.mode === 'patrol') {
    guard.mode = 'investigate';
    guard.target = { x: run.player.x, z: run.player.z };
    guard._investigateRemaining = 4;
    guard._path = [];
    guard._pathIndex = 0;
    event(run, events, { type: 'investigate', guardId: guard.id });
  }
  const visible = playerVisible(run, level, guard);
  const build = run.mode === 'gentle' ? .85 * .6 : .85;
  guard.alert = clamp(guard.alert + (visible ? build : -.45) * dt, 0, 1);
  if (visible && !guard._wasSeeing) event(run, events, { type: 'seen', guardId: guard.id });
  guard._wasSeeing = visible;
}

function selectNearestGuard(run) {
  let best = null, bestDistance = Infinity;
  for (const guard of run.guards) {
    const gap = distance(run.player, guard);
    if (gap < bestDistance) { best = guard; bestDistance = gap; }
  }
  return best?.id || null;
}

function selectedGuard(run) {
  return run.guards.find((guard) => guard.id === run.watchGuardId) || null;
}

function updateWatching(run, level, input, dt, events) {
  const wantsWatch = Boolean(input?.watch);
  if (wantsWatch && !run.watching) {
    run.watchGuardId = selectNearestGuard(run);
    run.watching = Boolean(run.watchGuardId);
    if (run.watching) event(run, events, { type: 'watch', guardId: run.watchGuardId });
  } else if (!wantsWatch) {
    run.watching = false;
    run.watchGuardId = null;
  }
  if (!run.watching) return;
  const guard = selectedGuard(run);
  if (!guard) { run.watching = false; run.watchGuardId = null; return; }
  for (const relic of run.relics) {
    if (relic.discovered || relic.collected) continue;
    const gap = Math.hypot(relic.x - guard.x, relic.z - guard.z);
    const targetYaw = Math.atan2(relic.x - guard.x, -(relic.z - guard.z));
    const visible = gap <= 16 && Math.abs(deltaAngle(guard.yaw, targetYaw)) <= radians(35) && lineOfSight(level, guard.x, guard.z, relic.x, relic.z);
    relic.scan = visible ? Math.min(.45, relic.scan + dt) : Math.max(0, relic.scan - dt * .8);
    if (relic.scan >= .45 - 1e-9) {
      relic.discovered = true;
      run.stats.scans += 1;
      event(run, events, { type: 'discovered', relicId: relic.id, guardId: guard.id });
    }
  }
}

function finish(run, events, status, reason) {
  if (run.status !== 'playing') return;
  run.status = status;
  run.watching = false;
  run.watchGuardId = null;
  event(run, events, { type: 'finish', status, reason });
}

function updateStep(run, level, input, dt, events) {
  const lookYaw = finite(Number(input?.lookYaw), 0), lookPitch = finite(Number(input?.lookPitch), 0);
  run.player.crouching = Boolean(input?.crouch);
  run.player.inShadow = cellIsShadow(level, run.player.x, run.player.z);
  updateWatching(run, level, input, 0, events);
  if (!run._lookConsumed && !run.watching) {
    run.player.yaw = wrap(run.player.yaw + lookYaw);
    run.player.pitch = clamp(run.player.pitch + lookPitch, -1.1, 1.1);
    run._lookConsumed = true;
  }
  const playerBefore = { x: run.player.x, z: run.player.z };
  if (!run.watching) {
    run.player.yaw = wrap(run.player.yaw + inputNumber(input, 'turn') * TURN_SPEED * dt);
    const forward = inputNumber(input, 'forward'), strafe = inputNumber(input, 'strafe');
    const magnitude = Math.hypot(forward, strafe);
    if (magnitude > 0) {
      const scale = (run.player.crouching ? CROUCH_SPEED : WALK_SPEED) * dt / Math.max(1, magnitude);
      const forwardX = Math.sin(run.player.yaw), forwardZ = -Math.cos(run.player.yaw);
      const rightX = Math.cos(run.player.yaw), rightZ = Math.sin(run.player.yaw);
      movePlayer(run, level, (forwardX * forward + rightX * strafe) * scale, (forwardZ * forward + rightZ * strafe) * scale);
    }
  }
  run.player.moving = Math.hypot(run.player.x - playerBefore.x, run.player.z - playerBefore.z) > 1e-5;
  run.player.inShadow = cellIsShadow(level, run.player.x, run.player.z);
  for (const guard of run.guards) updateGuard(run, level, guard, dt);
  for (const guard of run.guards) updateAwareness(run, level, guard, dt, events);
  run.suspicion = clamp(run.guards.reduce((max, guard) => Math.max(max, guard.alert), 0), 0, 1);
  run.peakSuspicion = Math.max(run.peakSuspicion, run.suspicion);
  run.time += dt;
  updateWatching(run, level, input, dt, events);
  if (run.suspicion >= 1 - 1e-9) finish(run, events, 'lost', 'detected');
  run.stats.steps += 1;
}

export function createRun(levelId = 'foyer', mode = 'standard') {
  const level = getLevel(levelId);
  if (!level) throw new RangeError(`unknown level: ${levelId}`);
  const guards = level.guards.map((definition) => {
    const first = definition.route[0], next = definition.route[1] || first;
    return { id: definition.id, name: definition.name, route: clone(definition.route), x: first.x, z: first.z, yaw: Math.atan2(next.x - first.x, -(next.z - first.z)), routeIndex: 0, mode: 'patrol', target: null, alert: 0, _path: [], _pathIndex: 0, _pathTarget: null, _investigateRemaining: 0, _wasSeeing: false };
  });
  return {
    levelId, mode: mode === 'gentle' ? 'gentle' : 'standard', status: 'playing', time: 0,
    player: { x: level.spawn.x, z: level.spawn.z, yaw: level.spawn.yaw, pitch: 0, crouching: false, inShadow: true, moving: false },
    guards, relics: level.relics.map((relic) => ({ ...relic, discovered: false, collected: false, scan: 0 })),
    watching: false, watchGuardId: null, suspicion: 0, peakSuspicion: 0, events: [], stats: { steps: 0, scans: 0, collected: 0 }
  };
}

export function stepRun(run, input = {}, dt = 0) {
  if (!run || run.status !== 'playing') { if (run) run.events = []; return []; }
  const duration = clamp(finite(Number(dt), 0), 0, 5);
  run.events = [];
  if (duration <= 0) return [];
  const level = getLevel(run.levelId);
  if (!level) return [];
  const events = [];
  run._lookConsumed = false;
  let remaining = duration;
  while (remaining > 1e-9 && run.status === 'playing') {
    const slice = Math.min(1 / 30, remaining);
    updateStep(run, level, input, slice, events);
    remaining -= slice;
  }
  delete run._lookConsumed;
  run.events = events;
  return events;
}

export function interact(run) {
  if (!run || run.status !== 'playing' || run.watching) return [];
  const level = getLevel(run.levelId);
  if (!level) return [];
  const events = [];
  const available = run.relics.filter((relic) => relic.discovered && !relic.collected).filter((relic) => distance(run.player, relic) <= 2.1 && lineOfSight(level, run.player.x, run.player.z, relic.x, relic.z)).sort((a, b) => distance(run.player, a) - distance(run.player, b));
  if (available.length) {
    const relic = available[0];
    relic.collected = true;
    run.stats.collected += 1;
    event(run, events, { type: 'collected', relicId: relic.id });
  } else if (run.relics.every((relic) => relic.collected) && distance(run.player, level.exit) <= 2.1 && lineOfSight(level, run.player.x, run.player.z, level.exit.x, level.exit.z)) {
    finish(run, events, 'won', 'exit');
  } else {
    event(run, events, { type: 'hint', text: run.relics.some((relic) => !relic.discovered) ? '감시자의 시선으로 먼저 유물을 발견하세요.' : '발견한 유물이나 출구 가까이 다가가세요.' });
  }
  run.events = events;
  return events;
}

export function cycleView(run) {
  if (!run || !run.watching || !run.guards.length) return [];
  const current = Math.max(0, run.guards.findIndex((guard) => guard.id === run.watchGuardId));
  run.watchGuardId = run.guards[(current + 1) % run.guards.length].id;
  run.events = [{ type: 'watch', guardId: run.watchGuardId }];
  return run.events;
}

export function summarize(run) {
  const won = run?.status === 'won';
  let grade = null;
  if (won) grade = run.peakSuspicion < .2 && run.time < 150 ? 'S' : run.peakSuspicion < .6 ? 'A' : 'B';
  return { status: run?.status, levelId: run?.levelId, mode: run?.mode, time: run?.time ?? 0, collected: run?.stats?.collected ?? 0, total: run?.relics?.length ?? 0, scans: run?.stats?.scans ?? 0, peakSuspicion: run?.peakSuspicion ?? 0, grade };
}
