import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, findPath, getLevel, isWalkable, lineOfSight, worldToCell } from '../src/levels.js';
import { createRun, cycleView, interact, stepRun, summarize } from '../src/game.js';

const angleDelta = (from, to) => Math.abs(Math.atan2(Math.sin(to - from), Math.cos(to - from)));
const centre = (level, col, row) => ({ x: (col - level.width / 2 + .5) * level.cell, z: (row - level.height / 2 + .5) * level.cell });

function routeWitnesses(level, relic) {
  const witnesses = [];
  for (const guard of level.guards) for (let index = 0; index < guard.route.length; index += 1) {
    const from = guard.route[index], to = guard.route[(index + 1) % guard.route.length];
    const yaw = Math.atan2(to.x - from.x, -(to.z - from.z));
    for (let ratio = 0; ratio <= 1; ratio += .02) {
      const point = { x: from.x + (to.x - from.x) * ratio, z: from.z + (to.z - from.z) * ratio };
      const target = Math.atan2(relic.x - point.x, -(relic.z - point.z));
      if (Math.hypot(relic.x - point.x, relic.z - point.z) <= 16 && angleDelta(yaw, target) <= Math.PI * 35 / 180 && lineOfSight(level, point.x, point.z, relic.x, relic.z)) witnesses.push({ guardId: guard.id, point });
    }
  }
  return witnesses;
}

function nearestShadow(level, target) {
  if (level.id === 'foyer') return centre(level, 9, 6);
  // The archive blueprint is watched by the lower recordkeeper. Return through
  // the left refuge first so crossing the lower gallery never meets its patrol.
  if (level.id === 'archive' && target.id === 'archive-blueprint') return centre(level, 1, 6);
  let result = null;
  for (let row = 0; row < level.height; row += 1) for (let col = 0; col < level.width; col += 1) if (level.grid[row][col] === 's' || level.grid[row][col] === 'S') {
    const point = centre(level, col, row), score = Math.hypot(point.x - target.x, point.z - target.z);
    if (!result || score < result.score) result = { point, score };
  }
  return result.point;
}

function travel(run, level, target, crouch = true, maxSteps = 3000) {
  const path = findPath(level, { x: run.player.x, z: run.player.z }, target);
  assert.ok(path.length, `route exists to ${target.x},${target.z}`);
  for (const waypoint of path.slice(1)) {
    let steps = 0;
    while (Math.hypot(run.player.x - waypoint.x, run.player.z - waypoint.z) > .12 && steps < maxSteps) {
      const desired = Math.atan2(waypoint.x - run.player.x, -(waypoint.z - run.player.z));
      stepRun(run, { forward: 1, turn: 0, lookYaw: angleDeltaSigned(run.player.yaw, desired), crouch, watch: false }, 1 / 30);
      steps += 1;
      if (run.status !== 'playing') return false;
    }
    assert.ok(steps < maxSteps, 'movement reaches each path waypoint');
  }
  return run.status === 'playing';
}

function angleDeltaSigned(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function discoverAtShadow(run, level, target, seconds = 28) {
  const shadow = nearestShadow(level, target);
  const sprintToShadow = level.id === 'vault' && target.id === 'vault-mirror';
  assert.ok(travel(run, level, shadow, !sprintToShadow), `player can reach a shadow near ${target.id || 'relic'}`);
  const witnessIds = [...new Set(routeWitnesses(level, target).map((witness) => witness.guardId))];
  if (!witnessIds.length) witnessIds.push(run.guards[0]?.id);
  for (const desiredGuard of witnessIds) {
    stepRun(run, { crouch: true, watch: true }, 1 / 30);
    for (let cycle = 0; cycle < run.guards.length && run.watchGuardId !== desiredGuard; cycle += 1) cycleView(run);
    let found = false;
    const attemptSeconds = desiredGuard === 'vault-second' ? Math.min(seconds, 40) : seconds;
    for (let index = 0; index < attemptSeconds * 30 && run.status === 'playing'; index += 1) {
      stepRun(run, { crouch: true, watch: true }, 1 / 30);
      found = run.relics.find((relic) => relic.id === target.id)?.discovered || found;
    }
    if (found) return true;
  }
  return run.relics.find((relic) => relic.id === target.id)?.discovered || false;
}

test('compiled authored maps preserve dimensions, spawn/exit, refuges and walkable routes', () => {
  assert.deepEqual(LEVELS.map((level) => level.id), ['foyer', 'archive', 'vault']);
  assert.deepEqual(LEVELS.map((level) => [level.width, level.height]), [[13, 11], [17, 13], [19, 15]]);
  for (const level of LEVELS) {
    assert.equal(level.grid.every((row) => row.length === level.width), true);
    assert.equal(isWalkable(level, level.spawn.x, level.spawn.z), true);
    assert.equal(isWalkable(level, level.exit.x, level.exit.z), true);
    assert.ok(level.grid.reduce((count, row) => count + [...row].filter((cell) => cell === 's').length, 0) >= 2);
    for (const guard of level.guards) for (const waypoint of guard.route) assert.equal(isWalkable(level, waypoint.x, waypoint.z), true);
    for (const relic of level.relics) assert.equal(isWalkable(level, relic.x, relic.z), true);
  }
});

test('coordinate conversion, collision paths and LOS obey the grid without diagonal corner cutting', () => {
  const level = getLevel('archive');
  const cell = worldToCell(level, level.spawn.x, level.spawn.z);
  assert.deepEqual(cell, { col: 1, row: 1 });
  assert.equal(isWalkable(level, centre(level, 0, 0).x, centre(level, 0, 0).z), false);
  const path = findPath(level, level.spawn, level.exit);
  assert.ok(path.length > 10);
  for (const point of path) assert.equal(isWalkable(level, point.x, point.z), true);
  assert.equal(findPath(level, centre(level, 0, 0), level.exit).length, 0);
  assert.equal(lineOfSight(level, level.spawn.x, level.spawn.z, level.exit.x, level.exit.z), false);
  assert.equal(lineOfSight(level, centre(level, 1, 1).x, centre(level, 1, 1).z, centre(level, 5, 1).x, centre(level, 5, 1).z), true);
  // Both endpoints are floor cells; the segment only grazes this solid-cell corner.
  assert.equal(lineOfSight(level, centre(level, 1, 1).x, centre(level, 1, 1).z, centre(level, 7, 3).x, centre(level, 7, 3).z), false);
});

test('all six relics are observable from a natural moving patrol segment', () => {
  for (const level of LEVELS) for (const relic of level.relics) {
    const witnesses = routeWitnesses(level, relic);
    assert.ok(witnesses.length > 0, `${level.id}/${relic.id} has a distance, cone and LOS witness`);
  }
});

test('movement signs, collision radius, fixed stepping and one-shot look are deterministic', () => {
  const run = createRun('foyer');
  const start = { x: run.player.x, z: run.player.z, yaw: run.player.yaw };
  stepRun(run, { forward: 1, lookYaw: 0 }, .25);
  assert.ok(run.player.z > start.z, 'yaw π forward moves south (+Z)');
  const beforeWall = { x: run.player.x, z: run.player.z };
  stepRun(run, { strafe: -1, lookYaw: 0 }, 3);
  assert.ok(run.player.x > beforeWall.x, 'negative strafe moves left relative to south-facing body (+X)');
  const beforeLook = run.player.yaw;
  stepRun(run, { lookYaw: .7 }, .25);
  assert.ok(Math.abs(angleDelta(beforeLook, run.player.yaw) - .7) < 1e-6, 'look delta is consumed once per public step');
  const before = JSON.stringify(run);
  stepRun(run, { forward: 1, strafe: 1 }, .01);
  assert.notEqual(JSON.stringify(run), before);
  for (const guard of run.guards) assert.ok(isWalkable(getLevel(run.levelId), guard.x, guard.z));
});

test('watching freezes body and lets guards advance, cycle view changes only the watcher', () => {
  const run = createRun('archive');
  const level = getLevel('archive');
  travel(run, level, nearestShadow(level, level.relics[0]));
  const guardStart = run.guards.map((guard) => ({ x: guard.x, z: guard.z, routeIndex: guard.routeIndex }));
  stepRun(run, { crouch: true, watch: true, lookYaw: 1, forward: 1, turn: 1 }, 1 / 30);
  const body = { ...run.player };
  const selected = run.watchGuardId;
  for (let i = 0; i < 30; i += 1) stepRun(run, { crouch: true, watch: true, forward: 1, turn: 1, lookYaw: 1 }, 1 / 30);
  assert.deepEqual({ x: run.player.x, z: run.player.z, yaw: run.player.yaw, pitch: run.player.pitch }, { x: body.x, z: body.z, yaw: body.yaw, pitch: body.pitch });
  assert.ok(run.guards.some((guard, index) => guard.x !== guardStart[index].x || guard.z !== guardStart[index].z || guard.routeIndex !== guardStart[index].routeIndex));
  if (run.guards.length > 1) { cycleView(run); assert.notEqual(run.watchGuardId, selected); }
  stepRun(run, { crouch: true, watch: false }, 1 / 30);
  assert.equal(run.watching, false);
});

test('discovery is required before E collection and exit completion', () => {
  const level = getLevel('foyer');
  const run = createRun('foyer', 'gentle');
  const relic = run.relics[0];
  assert.equal(interact(run).some((entry) => entry.type === 'hint'), true);
  assert.equal(discoverAtShadow(run, level, relic, 24), true);
  const path = findPath(level, { x: run.player.x, z: run.player.z }, relic);
  travel(run, level, relic);
  assert.equal(interact(run).some((entry) => entry.type === 'collected'), true);
  assert.equal(run.stats.collected, 1);
  travel(run, level, level.exit, false);
  assert.equal(interact(run).some((entry) => entry.type === 'finish'), true);
  assert.equal(run.status, 'won');
  assert.ok(path.length > 0);
});

test('alert, hearing, gentle mode and end events are finite and loss is terminal', () => {
  const run = createRun('foyer');
  const level = getLevel('foyer');
  const guard = run.guards[0];
  run.player.x = guard.x - 2;
  run.player.z = guard.z;
  run.player.inShadow = false;
  for (let i = 0; i < 120 && run.status === 'playing'; i += 1) stepRun(run, { forward: 0 }, 1 / 30);
  assert.equal(run.status, 'lost');
  const eventCount = run.events.length;
  stepRun(run, { forward: 1 }, 2);
  assert.equal(run.status, 'lost');
  assert.deepEqual(run.events, []);
  assert.ok(eventCount >= 1);
  const gentle = createRun('foyer', 'gentle');
  assert.equal(gentle.mode, 'gentle');
  assert.ok(getLevel(gentle.levelId));
});

test('investigation returns through walkable patrol paths', () => {
  const level = getLevel('archive');
  const run = createRun('archive', 'gentle');
  const guard = run.guards[0];
  guard.mode = 'investigate';
  guard.target = { x: 12, z: -3 };
  guard._investigateRemaining = 4;
  guard._path = [];
  guard._pathIndex = 0;
  for (let index = 0; index < 300; index += 1) {
    stepRun(run, { crouch: true }, 1 / 30);
    assert.equal(isWalkable(level, guard.x, guard.z), true);
  }
  assert.equal(guard.mode, 'patrol');
  assert.equal(guard._path.length > 0, true);
});

test('legal deterministic controller discovers, collects and exits every wing', () => {
  for (const level of LEVELS) {
    const run = createRun(level.id, 'gentle');
    for (const relic of run.relics) {
      const watchSeconds = level.id === 'foyer' ? 24 : level.id === 'archive' && relic.id === 'archive-blueprint' ? 60 : level.id === 'vault' ? 100 : 34;
      assert.equal(discoverAtShadow(run, level, relic, watchSeconds), true, `${level.id}/${relic.id} discovery`);
      assert.equal(travel(run, level, relic), true, `${level.id}/${relic.id} approach`);
      assert.equal(interact(run).some((entry) => entry.type === 'collected'), true, `${level.id}/${relic.id} collection`);
    }
    assert.equal(run.stats.collected, level.relics.length);
    if (level.id === 'archive') {
      // Cross the lower gallery quickly, then use the right refuge to time the
      // final exposed sprint past the upper lenskeeper.
      assert.equal(travel(run, level, centre(level, 15, 6), false), true, 'archive exit refuge');
      for (let index = 0; index < 450 && run.status === 'playing'; index += 1) stepRun(run, { crouch: true }, 1 / 30);
    }
    if (level.id === 'vault') {
      assert.equal(travel(run, level, centre(level, 12, 13), false), true, 'vault exit refuge');
      for (let index = 0; index < 450 && run.status === 'playing'; index += 1) stepRun(run, { crouch: true }, 1 / 30);
    }
    assert.equal(travel(run, level, level.exit, false), true, `${level.id} exit approach`);
    assert.equal(interact(run).some((entry) => entry.type === 'finish'), true, `${level.id} exit interaction`);
    assert.equal(run.status, 'won');
    assert.equal(summarize(run).collected, level.relics.length);
  }
});
