export const CELL = 3;

const MAPS = {
  foyer: {
    title: '초대받지 않은 밤',
    intro: '문지기의 시선을 빌려 숨은 유물을 찾고, 들키지 않고 빠져나가십시오.',
    outro: '첫 번째 웃음이 박물관의 장부에서 빠져나왔습니다.',
    grid: [
      '#############',
      '#S....#....X#',
      '#.....#.....#',
      '#...........#',
      '###.#####.###',
      '#...........#',
      '#..s.....s..#',
      '#...........#',
      '#.....#.....#',
      '#..R..#.....#',
      '#############'
    ],
    patrols: [{ id: 'foyer-lenskeeper', name: '문지기', route: [[9, 7], [3, 7], [3, 3], [9, 3]] }],
    relics: [{ id: 'foyer-fragment', name: '첫 번째 웃음', cell: [3, 9] }]
  },
  archive: {
    title: '닫힌 편지의 수장고',
    intro: '감시자의 눈으로만 읽히는 두 기억이 벽 너머에서 기다립니다.',
    outro: '수장고가 간직할 수 없었던 두 이름을 돌려받았습니다.',
    grid: [
      '#################',
      '#S....#....#...X#',
      '#.....#....#....#',
      '#...............#',
      '#..##...##...#..#',
      '#...............#',
      '#s....#....#...s#',
      '#.....#....#....#',
      '#...............#',
      '#..##...##...#..#',
      '#...............#',
      '#..R.......R....#',
      '#################'
    ],
    patrols: [
      { id: 'archive-lenskeeper', name: '서고지기', route: [[1, 3], [15, 3], [15, 5], [1, 5]] },
      { id: 'archive-recordkeeper', name: '기록지기', route: [[14, 10], [2, 10], [2, 8], [14, 8]] }
    ],
    relics: [{ id: 'archive-unsent', name: '보내지 못한 안부', cell: [3, 11] }, { id: 'archive-blueprint', name: '비가 오던 창', cell: [11, 11] }]
  },
  vault: {
    title: '시선의 금고',
    intro: '세 조각이 남았습니다. 이제 모든 복도에 감시자가 있습니다.',
    outro: '박물관은 더 이상 이 삶들을 자신의 것이라 부를 수 없습니다.',
    grid: [
      '###################',
      '#S....#.....#....X#',
      '#.....#.....#.....#',
      '#.................#',
      '#..##....#....##..#',
      '#s....#.....#....s#',
      '#.....#.....#.....#',
      '#.................#',
      '#..##....#....##..#',
      '#.....#.....#.....#',
      '#s...............s#',
      '#..##....#....##..#',
      '#.................#',
      '#..R..s..R..s..R..#',
      '###################'
    ],
    patrols: [
      { id: 'vault-first', name: '첫째 감시자', route: [[2, 3], [16, 3], [16, 7], [2, 7]] },
      { id: 'vault-second', name: '둘째 감시자', route: [[1, 7], [17, 7], [17, 10], [1, 10]] },
      { id: 'vault-recordkeeper', name: '금고지기', route: [[17, 12], [2, 12], [2, 10], [17, 10]] }
    ],
    relics: [
      { id: 'vault-thread', name: '집으로 가는 노래', cell: [3, 13] },
      { id: 'vault-seal', name: '낡은 약속', cell: [9, 13] },
      { id: 'vault-mirror', name: '아무도 빼앗지 못할 내일', cell: [15, 13] }
    ]
  }
};

function centre(level, col, row) {
  return { x: (col - level.width / 2 + 0.5) * level.cell, z: (row - level.height / 2 + 0.5) * level.cell };
}

function compile(id, source) {
  const height = source.grid.length, width = source.grid[0].length;
  if (!source.grid.every((row) => row.length === width)) throw new Error(`inconsistent grid width in ${id}`);
  const spawnCell = source.grid.flatMap((row, rowIndex) => [...row].map((value, col) => value === 'S' ? [col, rowIndex] : null)).find(Boolean);
  const exitCell = source.grid.flatMap((row, rowIndex) => [...row].map((value, col) => value === 'X' ? [col, rowIndex] : null)).find(Boolean);
  const level = { id, title: source.title, intro: source.intro, outro: source.outro, grid: source.grid.slice(), width, height, cell: CELL, spawn: { ...centre({ width, height, cell: CELL }, ...spawnCell), y: 0, yaw: Math.PI }, exit: centre({ width, height, cell: CELL }, ...exitCell), relics: [], guards: [] };
  level.relics = source.relics.map((relic) => ({ id: relic.id, name: relic.name, ...centre(level, ...relic.cell) }));
  level.guards = source.patrols.map((guard) => ({ id: guard.id, name: guard.name, route: guard.route.map(([col, row]) => centre(level, col, row)) }));
  return Object.freeze(level);
}

export const LEVELS = Object.entries(MAPS).map(([id, source]) => compile(id, source));

export function getLevel(id) {
  return LEVELS.find((level) => level.id === id) || null;
}

export function worldToCell(level, x, z) {
  if (!level || !Number.isFinite(x) || !Number.isFinite(z)) return null;
  return { col: Math.floor(x / level.cell + level.width / 2), row: Math.floor(z / level.cell + level.height / 2) };
}

export function isWalkable(level, x, z) {
  const cell = typeof x === 'object' ? worldToCell(level, x.x, x.z) : worldToCell(level, x, z);
  return cellWalkable(level, cell);
}

function cellWalkable(level, cell) {
  return Boolean(level && cell && cell.row >= 0 && cell.row < level.height && cell.col >= 0 && cell.col < level.width && level.grid[cell.row][cell.col] !== '#');
}

export function cellToWorld(level, col, row) {
  return centre(level, col, row);
}

export function lineOfSight(level, ax, az, bx, bz) {
  if (!level || ![ax, az, bx, bz].every(Number.isFinite)) return false;
  const dx = bx - ax, dz = bz - az;
  const intersects = (min, max, origin, direction) => {
    if (Math.abs(direction) < 1e-12) return origin >= min && origin <= max ? [0, 1] : null;
    const a = (min - origin) / direction, b = (max - origin) / direction;
    return [Math.min(a, b), Math.max(a, b)];
  };
  for (let row = 0; row < level.height; row += 1) for (let col = 0; col < level.width; col += 1) {
    if (level.grid[row][col] !== '#') continue;
    const minX = (col - level.width / 2) * level.cell, maxX = minX + level.cell;
    const minZ = (row - level.height / 2) * level.cell, maxZ = minZ + level.cell;
    const xRange = intersects(minX, maxX, ax, dx), zRange = intersects(minZ, maxZ, az, dz);
    if (xRange && zRange && Math.max(xRange[0], zRange[0]) <= Math.min(xRange[1], zRange[1]) && Math.min(xRange[1], zRange[1]) >= 0 && Math.max(xRange[0], zRange[0]) <= 1) return false;
  }
  return true;
}

export function findPath(level, start, end) {
  if (!level || !start || !end) return [];
  const from = worldToCell(level, start.x, start.z), to = worldToCell(level, end.x, end.z);
  if (!from || !to || !cellWalkable(level, from) || !cellWalkable(level, to)) return [];
  const key = (col, row) => `${col},${row}`;
  const queue = [{ col: from.col, row: from.row }], previous = new Map([[key(from.col, from.row), null]]);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    if (current.col === to.col && current.row === to.row) break;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const col = current.col + dc, row = current.row + dr, nextKey = key(col, row);
      if (!previous.has(nextKey) && cellWalkable(level, { col, row })) { previous.set(nextKey, current); queue.push({ col, row }); }
    }
  }
  const targetKey = key(to.col, to.row);
  if (!previous.has(targetKey)) return [];
  const cells = [];
  for (let current = to; current; current = previous.get(key(current.col, current.row))) cells.push(current);
  cells.reverse();
  return cells.map((cell) => centre(level, cell.col, cell.row));
}
