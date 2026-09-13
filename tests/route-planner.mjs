// Test-only patrol forecast. Operates on a detached snapshot, never browser state.
import { getLevel, worldToCell, cellToWorld, lineOfSight } from '../src/levels.js';
import { stepRun } from '../src/game.js';

const TICK = .25, MOVE_TICKS = 8;
class Heap {
  values = [];
  push(value) { const a = this.values; a.push(value); let i = a.length - 1; while (i) { const p = (i - 1) >> 1; if (a[p].score <= value.score) break; a[i] = a[p]; i = p; } a[i] = value; }
  pop() { const a = this.values, first = a[0], last = a.pop(); if (a.length) { let i = 0; while (i * 2 + 1 < a.length) { let c = i * 2 + 1; if (c + 1 < a.length && a[c + 1].score < a[c].score) c++; if (last.score <= a[c].score) break; a[i] = a[c]; i = c; } a[i] = last; } return first; }
}

export function planRoute(snapshot, target, horizon = 150, margin = 1) {
  const level = getLevel(snapshot.levelId), start = worldToCell(level, snapshot.player.x, snapshot.player.z), end = worldToCell(level, target.x, target.z);
  const forecast = structuredClone(snapshot), frames = [structuredClone(forecast.guards)];
  // A stationary crouching body in the entry refuge does not alter patrols.
  Object.assign(forecast.player, level.spawn, { crouching: true, moving: false });
  forecast.watching = false; forecast.watchGuardId = null;
  const maxTick = Math.ceil(horizon / TICK);
  for (let tick = 1; tick <= maxTick; tick++) {
    for (let step = 0; step < 15; step++) stepRun(forecast, { crouch: true }, 1 / 60);
    frames.push(structuredClone(forecast.guards));
  }
  const angle = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  function safe(point, tick) {
    const cell = worldToCell(level, point.x, point.z), refuge = 'sS'.includes(level.grid[cell.row]?.[cell.col] || '#');
    for (const guard of frames[Math.min(maxTick, Math.max(0, tick))]) {
      const gap = Math.hypot(point.x - guard.x, point.z - guard.z);
      if (gap < 1.7 + .65 * margin) return false;
      if (refuge || gap > 14.02 + 1.38 * margin) continue;
      if (angle(Math.atan2(point.x - guard.x, -(point.z - guard.z)), guard.yaw) < Math.PI * (40.1 + 8.9 * margin) / 180 && lineOfSight(level, point.x, point.z, guard.x, guard.z)) return false;
    }
    return true;
  }
  const heap = new Heap(), visited = new Set(), key = (c, r, t) => (t * level.height + r) * level.width + c;
  heap.push({ ...start, tick: 0, parent: null, score: (Math.abs(start.col - end.col) + Math.abs(start.row - end.row)) * MOVE_TICKS });
  let explored = 0;
  while (heap.values.length) {
    const node = heap.pop(), id = key(node.col, node.row, node.tick);
    if (visited.has(id)) continue;
    visited.add(id); explored++;
    if (node.col === end.col && node.row === end.row && [0, 1, 2, 3, 4].every(offset => safe(cellToWorld(level, node.col, node.row), node.tick + offset))) {
      const route = []; for (let p = node; p; p = p.parent) route.push({ ...cellToWorld(level, p.col, p.row), at: snapshot.time + p.tick * TICK, tick: p.tick });
      return { route: route.reverse(), explored, duration: node.tick * TICK };
    }
    const from = node.parent ? cellToWorld(level, node.col, node.row) : snapshot.player;
    for (const [dc, dr] of [[0, 1], [1, 0], [-1, 0], [0, -1], [0, 0]]) {
      const col = node.col + dc, row = node.row + dr, cost = dc || dr ? MOVE_TICKS : 1, tick = node.tick + cost;
      if (tick > maxTick || !level.grid[row]?.[col] || level.grid[row][col] === '#' || visited.has(key(col, row, tick))) continue;
      const to = cellToWorld(level, col, row);
      let allowed = true;
      for (let offset = 1; offset <= cost; offset++) {
        const proportion = Math.min(1, offset * TICK / (3 / 1.6));
        const point = { x: from.x + (to.x - from.x) * proportion, z: from.z + (to.z - from.z) * proportion };
        if (!safe(point, node.tick + offset)) { allowed = false; break; }
      }
      if (allowed) heap.push({ col, row, tick, parent: node, score: tick + (Math.abs(col - end.col) + Math.abs(row - end.row)) * MOVE_TICKS });
    }
  }
  if (margin > 0) return planRoute(snapshot, target, horizon, 0);
  throw new Error(`No safe route in ${horizon}s: ${snapshot.levelId} ${JSON.stringify(start)} -> ${JSON.stringify(end)} (${explored} states)`);
}
