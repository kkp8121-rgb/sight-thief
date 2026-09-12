import * as THREE from 'three';
import { lineOfSight } from './levels.js';
import { createLenskeeper, createRelic, createThief } from './models.js';
import paintingsUrl from '../assets/paintings.webp';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const CELL_FALLBACK = 3;
const SEA = 0;
const shades = { floor: 0x282b34, floorLight: 0x55545a, ivory: 0xdcd2be, trim: 0xb89559, ruby: 0x9d293e, blue: 0x496b88, shadow: 0x152a3c };
let paintingsTexture;

function galleryTexture() { if (!paintingsTexture) { paintingsTexture = new THREE.TextureLoader().load(paintingsUrl); paintingsTexture.colorSpace = THREE.SRGBColorSpace; paintingsTexture.flipY = true; paintingsTexture.minFilter = THREE.LinearFilter; paintingsTexture.magFilter = THREE.LinearFilter; paintingsTexture.generateMipmaps = false; } return paintingsTexture; }

function addGalleryPaintings(course, faces) {
  if (!faces.length) return 0;
  const positions = [], normals = [], uvs = [], indices = [], framePositions = [], artworkWidth = 1.45, artworkHeight = 1.45;
  const pushVertex = (point, normal, uv) => { positions.push(point[0], point[1], point[2]); normals.push(normal[0], normal[1], normal[2]); uvs.push(uv[0], uv[1]); };
  faces.forEach((face, imageIndex) => {
    const { point, horizontal, outward } = face, normal = horizontal ? [0, 0, outward] : [outward, 0, 0];
    const center = [point.x + (horizontal ? 0 : outward * (face.offset + .045)), 1.58, point.z + (horizontal ? outward * (face.offset + .045) : 0)];
    const corners = horizontal ? [[center[0] - artworkWidth / 2, center[1] - artworkHeight / 2, center[2]], [center[0] + artworkWidth / 2, center[1] - artworkHeight / 2, center[2]], [center[0] + artworkWidth / 2, center[1] + artworkHeight / 2, center[2]], [center[0] - artworkWidth / 2, center[1] + artworkHeight / 2, center[2]]] : [[center[0], center[1] - artworkHeight / 2, center[2] - artworkWidth / 2], [center[0], center[1] - artworkHeight / 2, center[2] + artworkWidth / 2], [center[0], center[1] + artworkHeight / 2, center[2] + artworkWidth / 2], [center[0], center[1] + artworkHeight / 2, center[2] - artworkWidth / 2]];
    const artworkIndex = imageIndex % 6, col = artworkIndex % 3, row = Math.floor(artworkIndex / 3), u0 = col / 3, u1 = (col + 1) / 3, v0 = 1 - (row + 1) / 2, v1 = 1 - row / 2, base = positions.length / 3, reverseU = (horizontal && outward < 0) || (!horizontal && outward > 0), uvCorners = reverseU ? [[u1, v0], [u0, v0], [u0, v1], [u1, v1]] : [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    corners.forEach((corner, index) => pushVertex(corner, normal, uvCorners[index]));
    const ab = new THREE.Vector3().subVectors(new THREE.Vector3(...corners[1]), new THREE.Vector3(...corners[0])); const bc = new THREE.Vector3().subVectors(new THREE.Vector3(...corners[2]), new THREE.Vector3(...corners[1])); const front = ab.cross(bc).dot(new THREE.Vector3(...normal)) > 0; if (front) indices.push(base, base + 1, base + 2, base, base + 2, base + 3); else indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
    const frameInset = .06, fw = artworkWidth + frameInset, fh = artworkHeight + frameInset, frameCorners = horizontal ? [[center[0] - fw / 2, center[1] - fh / 2, center[2] + outward * .006], [center[0] + fw / 2, center[1] - fh / 2, center[2] + outward * .006], [center[0] + fw / 2, center[1] + fh / 2, center[2] + outward * .006], [center[0] - fw / 2, center[1] + fh / 2, center[2] + outward * .006]] : [[center[0] + outward * .006, center[1] - fh / 2, center[2] - fw / 2], [center[0] + outward * .006, center[1] - fh / 2, center[2] + fw / 2], [center[0] + outward * .006, center[1] + fh / 2, center[2] + fw / 2], [center[0] + outward * .006, center[1] + fh / 2, center[2] - fw / 2]];
    for (let side = 0; side < 4; side++) { const a = frameCorners[side], b = frameCorners[(side + 1) % 4]; framePositions.push(...a, ...b); }
  });
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); geometry.computeBoundingSphere(); const artwork = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: galleryTexture(), color: 0xffffff, toneMapped: false, side: THREE.DoubleSide })); artwork.name = 'gallery-paintings'; course.add(artwork);
  const frameGeometry = new THREE.BufferGeometry(); frameGeometry.setAttribute('position', new THREE.Float32BufferAttribute(framePositions, 3)); const frames = new THREE.LineSegments(frameGeometry, new THREE.LineBasicMaterial({ color: shades.trim, transparent: true, opacity: .9, toneMapped: false })); frames.name = 'gallery-painting-frames'; course.add(frames); return faces.length;
}

function disposeGroup(group) { if (!group) return; group.traverse((object) => { object.geometry?.dispose(); const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : []; materials.forEach((material) => { if (!material.userData?.sharedMaterial) material.dispose(); }); }); group.clear(); }
function cellCenter(level, col, row) { const cell = level.cell || CELL_FALLBACK, width = level.width || level.grid?.[0]?.length || 1, height = level.height || level.grid?.length || 1; return { x: (col - width / 2 + .5) * cell, z: (row - height / 2 + .5) * cell }; }
function angleDelta(a, b) { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); }
function actorFacing(group, yaw) { group.rotation.y = -yaw; }

class MuseumScene {
  constructor(container) {
    this.host = container; this.canvas = container?.tagName === 'CANVAS' ? container : container?.querySelector?.('canvas') || (typeof document !== 'undefined' ? document.createElement('canvas') : null); if (!this.canvas) throw new Error('Sight Thief requires a canvas'); if (container?.tagName !== 'CANVAS' && this.canvas.parentElement !== container && container?.appendChild) container.appendChild(this.canvas);
    this.frame = 0; this.elapsed = 0; this.level = null; this.course = null; this.effects = []; this.lastEventKey = ''; this.guardActors = []; this.relicActors = []; this.galleryPaintingsCount = 0;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance' }); this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = .84;
    const gl = this.renderer.getContext(); let rendererName = ''; try { const ext = gl.getExtension('WEBGL_debug_renderer_info'); rendererName = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); } catch (_) {} this.software = /swiftshader|llvmpipe|software|mesa/i.test(`${rendererName} ${globalThis.navigator?.userAgent || ''}`); this.pixelBudget = this.software ? 400000 : 2000000; this.renderer.shadowMap.enabled = !this.software; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x202431); this.scene.fog = new THREE.Fog(0x202431, 25, 90); this.world = new THREE.Group(); this.scene.add(this.world); this.camera = new THREE.PerspectiveCamera(66, 16 / 9, .05, 120); this.camera.position.set(0, 1.65, 8); this.addLighting(); this.thief = createThief(); this.thiefBody = this.thief.userData.body; this.thief.remove(this.thiefBody); this.world.add(this.thiefBody); this.camera.add(this.thief); this.scene.add(this.camera); this.resize();
  }
  addLighting() { this.scene.add(new THREE.HemisphereLight(0xc5d3da, 0x202331, 1.8)); const key = new THREE.DirectionalLight(0xffdfb1, 2.25); key.position.set(-12, 18, 10); key.castShadow = !this.software; key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -24; key.shadow.camera.right = 24; key.shadow.camera.top = 24; key.shadow.camera.bottom = -24; this.scene.add(key); this.keyLight = key; }
  clearCourse() { if (this.course) { this.world.remove(this.course); disposeGroup(this.course); } this.course = new THREE.Group(); this.course.name = 'museum-wing'; this.world.add(this.course); this.guardActors = []; this.relicActors = []; this.galleryPaintingsCount = 0; this.effects.forEach((effect) => { this.world.remove(effect); effect.geometry?.dispose(); if (!effect.material?.userData?.sharedMaterial) effect.material?.dispose?.(); }); this.effects.length = 0; }
  setLevel(level) { this.level = level || null; this.clearCourse(); this.elapsed = 0; this.lastEventKey = ''; if (!this.level) return; this.buildArchitecture(this.level); this.buildActors(this.level); this.buildLighting(this.level); const spawn = this.level.spawn || { x: 0, z: 0, yaw: Math.PI }; this.camera.position.set(spawn.x, 1.65, spawn.z); this.camera.rotation.set(0, 0, 0); }
  buildArchitecture(level) {
    const rows = level.grid || [], width = level.width || rows[0]?.length || 1, height = level.height || rows.length, cell = level.cell || CELL_FALLBACK, walls = [], floors = [], refuges = [], exitCells = [];
    for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) { const mark = rows[row]?.[col] || '#', point = cellCenter(level, col, row); if (mark === '#') walls.push(point); else { floors.push({ ...point, shade: (col + row) % 2 }); if (mark === 's' || mark === 'S') refuges.push(point); if (mark === 'X') exitCells.push(point); } }
    const wallMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(cell, 3.4, cell), this.material(shades.ivory, .76), Math.max(1, walls.length)); const dummy = new THREE.Object3D(); walls.forEach((point, index) => { dummy.position.set(point.x, 1.7, point.z); dummy.updateMatrix(); wallMesh.setMatrixAt(index, dummy.matrix); }); wallMesh.instanceMatrix.needsUpdate = true; wallMesh.castShadow = !this.software; wallMesh.receiveShadow = true; this.course.add(wallMesh);
    const floorDark = new THREE.InstancedMesh(new THREE.PlaneGeometry(cell * .98, cell * .98), this.material(shades.floor, .9), Math.max(1, floors.filter((floor) => !floor.shade).length)); const floorLight = new THREE.InstancedMesh(new THREE.PlaneGeometry(cell * .98, cell * .98), this.material(shades.floorLight, .92), Math.max(1, floors.filter((floor) => floor.shade).length)); let dark = 0, light = 0; floors.forEach((floor) => { dummy.position.set(floor.x, .01, floor.z); dummy.rotation.x = -Math.PI / 2; dummy.updateMatrix(); (floor.shade ? floorLight : floorDark).setMatrixAt(floor.shade ? light++ : dark++, dummy.matrix); }); floorDark.instanceMatrix.needsUpdate = true; floorLight.instanceMatrix.needsUpdate = true; this.course.add(floorDark, floorLight);
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(width * cell, height * cell), this.material(0x303341, .94, { emissive: 0x101521, emissiveIntensity: .2 })); ceiling.rotation.x = Math.PI / 2; ceiling.position.y = 3.45; this.course.add(ceiling);

    // Architectural faces are placed only on corridor-facing sides, just beyond the wall
    // boundary. This keeps the trim readable without changing the collision footprint.
    const wallAt = (col, row) => rows[row]?.[col] === '#';
    const panels = [], accents = [], galleryFaces = [];
    const faceOffset = cell / 2 + .025 + .065 / 2;
    const addFace = (point, horizontal, outward, edge) => {
      const panelScale = horizontal ? [cell * .56, 2.05, .055] : [.055, 2.05, cell * .56];
      const accentScale = horizontal ? [cell * .84, .075, .065] : [.065, .075, cell * .84];
      const postScale = horizontal ? [.07, 2.35, .06] : [.06, 2.35, .07];
      panels.push({ position: [point.x + (horizontal ? 0 : outward * faceOffset), 1.55, point.z + (horizontal ? outward * faceOffset : 0)], scale: panelScale });
      accents.push({ position: [point.x + (horizontal ? 0 : outward * faceOffset), .24, point.z + (horizontal ? outward * faceOffset : 0)], scale: accentScale });
      accents.push({ position: [point.x + (horizontal ? 0 : outward * faceOffset), 3.08, point.z + (horizontal ? outward * faceOffset : 0)], scale: accentScale });
      const sideOffset = cell * .28;
      accents.push({ position: [point.x + (horizontal ? edge * sideOffset : outward * faceOffset), 1.55, point.z + (horizontal ? outward * faceOffset : edge * sideOffset)], scale: postScale });
      accents.push({ position: [point.x + (horizontal ? -edge * sideOffset : outward * faceOffset), 1.55, point.z + (horizontal ? outward * faceOffset : -edge * sideOffset)], scale: postScale });
      galleryFaces.push({ point, horizontal, outward, offset: faceOffset });
    };
    walls.forEach((point) => {
      const col = Math.round(point.x / cell + width / 2 - .5), row = Math.round(point.z / cell + height / 2 - .5);
      if (!wallAt(col, row - 1)) addFace(point, true, -1, 1);
      if (!wallAt(col, row + 1)) addFace(point, true, 1, 1);
      if (!wallAt(col - 1, row)) addFace(point, false, -1, 1);
      if (!wallAt(col + 1, row)) addFace(point, false, 1, 1);
    });
    const panelMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.material(0x454551, .82, { metalness: .12 }), Math.max(1, panels.length));
    const accentMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.material(shades.trim, .58, { metalness: .72 }), Math.max(1, accents.length));
    panels.forEach((item, index) => { dummy.position.set(...item.position); dummy.scale.set(...item.scale); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); panelMesh.setMatrixAt(index, dummy.matrix); });
    accents.forEach((item, index) => { dummy.position.set(...item.position); dummy.scale.set(...item.scale); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); accentMesh.setMatrixAt(index, dummy.matrix); });
    panelMesh.count = panels.length; accentMesh.count = accents.length; panelMesh.instanceMatrix.needsUpdate = true; accentMesh.instanceMatrix.needsUpdate = true; if (panels.length) this.course.add(panelMesh); if (accents.length) this.course.add(accentMesh);
    const selectedGallery = galleryFaces.filter((face, index) => index % 3 === 0); for (const face of galleryFaces) { if (selectedGallery.length >= 6) break; if (!selectedGallery.includes(face)) selectedGallery.push(face); } this.galleryPaintingsCount = addGalleryPaintings(this.course, selectedGallery);
    dummy.scale.set(1, 1, 1); dummy.rotation.set(0, 0, 0);
    const refugeMesh = new THREE.InstancedMesh(new THREE.TorusGeometry(.82, .045, 8, 20), this.material(shades.blue, .35, { emissive: shades.blue, emissiveIntensity: .5, transparent: true, opacity: .8 }), Math.max(1, refuges.length)); refuges.forEach((point, index) => { dummy.position.set(point.x, .045, point.z); dummy.rotation.x = Math.PI / 2; dummy.updateMatrix(); refugeMesh.setMatrixAt(index, dummy.matrix); }); refugeMesh.count = refuges.length; refugeMesh.instanceMatrix.needsUpdate = true; if (refuges.length) this.course.add(refugeMesh);
    for (const point of refuges) { const light = new THREE.PointLight(shades.blue, .32, 5.5, 2); light.position.set(point.x, 2.3, point.z); this.course.add(light); }
    for (const point of exitCells) {
      const gate = new THREE.Group(); gate.position.set(point.x, 0, point.z);
      const postMaterial = this.material(shades.trim, .6, { metalness: .7 });
      const post = new THREE.Mesh(new THREE.BoxGeometry(.12, 2.8, .12), postMaterial); post.position.set(-1.05, 1.4, 0); gate.add(post); const right = post.clone(); right.position.x = 1.05; gate.add(right);
      const header = new THREE.Mesh(new THREE.BoxGeometry(2.3, .14, .16), this.material(shades.ruby, .52, { emissive: shades.ruby, emissiveIntensity: .3 })); header.position.y = 2.75; gate.add(header);
      const sign = new THREE.Mesh(new THREE.BoxGeometry(.82, .42, .07), this.material(0x1d403e, .55, { emissive: 0x12312f, emissiveIntensity: .35 })); sign.position.set(0, 2.25, .1); gate.add(sign);
      const glyphMaterial = this.material(shades.trim, .48, { metalness: .65, emissive: shades.trim, emissiveIntensity: .2 });
      const glyphStem = new THREE.Mesh(new THREE.BoxGeometry(.08, .23, .075), glyphMaterial); glyphStem.position.set(0, 2.26, .145); gate.add(glyphStem);
      const glyphBar = new THREE.Mesh(new THREE.BoxGeometry(.3, .07, .075), glyphMaterial); glyphBar.position.set(0, 2.34, .145); gate.add(glyphBar);
      const col = Math.round(point.x / cell + width / 2 - .5), row = Math.round(point.z / cell + height / 2 - .5);
      const neighbors = [[col, row + 1, 0, -1], [col, row - 1, 0, 1], [col + 1, row, -1, 0], [col - 1, row, 1, 0]];
      const approach = neighbors.find(([nc, nr]) => rows[nr]?.[nc] && rows[nr][nc] !== '#');
      if (approach) {
        const neighbor = cellCenter(level, approach[0], approach[1]); const direction = new THREE.Vector3(point.x - neighbor.x, 0, point.z - neighbor.z).normalize();
        const arrow = new THREE.Group(); arrow.position.set(neighbor.x + direction.x * cell * .25, .055, neighbor.z + direction.z * cell * .25); arrow.rotation.y = Math.atan2(direction.x, direction.z);
        const shaft = new THREE.Mesh(new THREE.BoxGeometry(.12, .035, .6), glyphMaterial); arrow.add(shaft);
        for (const side of [-1, 1]) { const wing = new THREE.Mesh(new THREE.BoxGeometry(.12, .035, .25), glyphMaterial); wing.position.set(side * .16, 0, .24); wing.rotation.y = side * -.72; arrow.add(wing); }
        this.course.add(arrow);
      }
      this.course.add(gate);
    }
  }
  buildActors(level) { (level.guards || []).forEach((guard, index) => { const actor = createLenskeeper(); actor.userData.guardId = guard.id; actor.userData.index = index; this.course.add(actor); this.guardActors.push(actor); }); const shapeOffset = level.id === 'foyer' ? 0 : level.id === 'archive' ? 1 : 3; (level.relics || []).forEach((relic, index) => { const actor = createRelic(index + shapeOffset); actor.userData.relicId = relic.id; actor.position.set(relic.x, 0, relic.z); actor.visible = false; this.course.add(actor); this.relicActors.push(actor); }); }
  buildLighting(level) { const accent = new THREE.PointLight(0x8eb7d1, .85, 22, 2); const spawn = level.spawn || { x: 0, z: 0 }; accent.position.set(spawn.x, 2.6, spawn.z); this.course.add(accent); }
  material(color, roughness = .7, options = {}) { return new THREE.MeshStandardMaterial({ color, roughness, metalness: options.metalness || 0, emissive: options.emissive || 0, emissiveIntensity: options.emissiveIntensity || 0, transparent: !!options.transparent, opacity: options.opacity ?? 1 }); }
  relicVisible(run, relic, index) { const state = run.relics?.[index]; if (!state || state.collected) return false; if (state.discovered) return true; if (!run.watching || !run.watchGuardId) return false; const guard = run.guards?.find((candidate) => candidate.id === run.watchGuardId); if (!guard) return false; const dx = relic.x - guard.x, dz = relic.z - guard.z, distance = Math.hypot(dx, dz), facing = Math.atan2(dx, -dz); return distance <= 16 && Math.abs(angleDelta(facing, guard.yaw)) <= Math.PI * 35 / 180 && lineOfSight?.(this.level, guard.x, guard.z, relic.x, relic.z) !== false; }
  updateRelics(run) { (this.level.relics || []).forEach((relic, index) => { const actor = this.relicActors[index]; if (!actor) return; const state = run.relics?.[index]; actor.visible = this.relicVisible(run, relic, index); actor.userData.discovered = !!state?.discovered; const core = actor.userData.core; const material = core?.material; if (material) { material.emissiveIntensity = run.watching && !state?.discovered ? .95 : state?.discovered ? .38 : .0; material.opacity = run.watching && !state?.discovered ? .92 : .52; } }); }
  updateGuards(run) { this.guardActors.forEach((actor, index) => { const guard = run.guards?.[index]; if (!guard) { actor.visible = false; return; } actor.visible = !(run.watching && guard.id === run.watchGuardId); actor.position.set(guard.x, .05 + Math.sin(this.elapsed * 2 + index) * .035, guard.z); actorFacing(actor, guard.yaw); const halo = actor.getObjectByName('brass-halo'); if (halo) halo.rotation.z = Math.sin(this.elapsed * 1.8 + index) * .05; actor.traverse((part) => { if (part.name === 'articulated-arm') part.rotation.x = Math.sin(this.elapsed * 2.3 + index) * .04; }); }); }
  updateCamera(run) { const watching = !!run.watching, guard = watching ? run.guards?.find((candidate) => candidate.id === run.watchGuardId) : null, player = run.player || { x: 0, z: 0, yaw: Math.PI, pitch: 0, crouching: false, moving: false }; const yaw = guard ? guard.yaw : player.yaw, pitch = guard ? 0 : clamp(player.pitch || 0, -1.1, 1.1), x = guard ? guard.x : player.x, z = guard ? guard.z : player.z, eyeY = guard ? 1.65 : (player.crouching ? 1.05 : 1.65); this.camera.position.set(x, eyeY, z); const bob = !watching && player.moving ? Math.sin(this.elapsed * 11) * .018 : 0; this.camera.position.y += bob; const horizontal = Math.cos(pitch), target = new THREE.Vector3(x + Math.sin(yaw) * horizontal, eyeY + Math.sin(pitch), z - Math.cos(yaw) * horizontal); this.camera.lookAt(target); this.thief.visible = !watching; this.thiefBody.visible = watching; this.thiefBody.scale.set(1, player.crouching ? .72 : 1, 1); if (watching) { this.thiefBody.position.set(player.x, player.crouching ? 1.03 : 1.43, player.z); actorFacing(this.thiefBody, player.yaw); } const mirror = this.thief.userData.mirror; if (mirror) { const halfHeight = .76 * Math.tan(33 * Math.PI / 180), halfWidth = halfHeight * Math.max(.1, this.camera.aspect); mirror.position.set(halfWidth * .70, -halfHeight * .68 + .06, -.76); mirror.scale.setScalar(Math.min(.66, this.camera.aspect * .50)); } const horizontalFov = 76 * Math.PI / 180, wantedFov = guard ? 2 * Math.atan(Math.tan(horizontalFov / 2) / Math.max(.1, this.camera.aspect)) * 180 / Math.PI : 66; if (Math.abs(this.camera.fov - wantedFov) > .01) { this.camera.fov = wantedFov; this.camera.updateProjectionMatrix(); } }
  processEvents(run) { const events = run.events || [], key = `${run.stats?.steps || 0}:${events.map((event) => event.type).join(',')}`; if (key === this.lastEventKey) return; this.lastEventKey = key; for (const event of events) { const relic = event.relicId && this.level.relics?.find((candidate) => candidate.id === event.relicId), x = relic?.x ?? event.x, z = relic?.z ?? event.z; if (event.type === 'discovered') this.spawnMotes(x, z, shades.trim); if (event.type === 'collected') this.spawnMotes(x, z, shades.ruby); if (event.type === 'finish') this.spawnMotes(run.player?.x, run.player?.z, shades.trim); } }
  spawnMotes(x = 0, z = 0, color = shades.trim) { for (let i = 0; i < 8 && this.effects.length < 60; i++) { const mote = new THREE.Mesh(new THREE.SphereGeometry(.035, 6, 5), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9 })); mote.position.set(x + (i - 4) * .08, .7 + (i % 3) * .12, z); mote.userData.effect = { life: .55 + i * .03, velocity: new THREE.Vector3((i - 4) * .18, .35 + i * .04, (i % 2 ? 1 : -1) * .12) }; this.world.add(mote); this.effects.push(mote); } }
  updateEffects(dt) { for (let i = this.effects.length - 1; i >= 0; i--) { const effect = this.effects[i], data = effect.userData.effect; data.life -= dt; effect.position.addScaledVector(data.velocity, dt); data.velocity.y -= .5 * dt; effect.material.opacity = clamp(data.life / .65, 0, 1); if (data.life <= 0) { this.world.remove(effect); effect.geometry.dispose(); effect.material.dispose(); this.effects.splice(i, 1); } } }
  update(run, dt = 1 / 60) { if (!this.level) return; const delta = clamp(Number(dt) || 0, 0, .1); this.elapsed += delta; this.updateCamera(run); this.updateGuards(run); this.updateRelics(run); this.processEvents(run); this.updateEffects(delta); this.render(); }
  render() { this.renderer.render(this.scene, this.camera); this.frame++; }
  resize() { const width = this.canvas.clientWidth || this.host?.clientWidth || 960, height = this.canvas.clientHeight || this.host?.clientHeight || 540, ratio = Math.min(2, globalThis.devicePixelRatio || 1, Math.sqrt(this.pixelBudget / Math.max(1, width * height))); this.renderer.setPixelRatio(ratio); this.renderer.setSize(width, height, false); this.camera.aspect = width / Math.max(1, height); this.camera.updateProjectionMatrix(); }
  get stats() { const render = this.renderer.info.render, memory = this.renderer.info.memory, direction = new THREE.Vector3(); this.camera.getWorldDirection(direction); const plain = (vector) => ({ x: vector.x, y: vector.y, z: vector.z }); return { drawCalls: render.calls, triangles: render.triangles, pixels: (this.canvas.width || 0) * (this.canvas.height || 0), software: this.software, frames: this.frame, effects: this.effects.length, geometries: memory.geometries, textures: memory.textures, galleryPaintings: this.galleryPaintingsCount, camera: { ...plain(this.camera.position), x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z, fov: this.camera.fov, aspect: this.camera.aspect, direction: plain(direction) }, playerBody: { ...plain(this.thiefBody.position), x: this.thiefBody.position.x, y: this.thiefBody.position.y, z: this.thiefBody.position.z, visible: !!this.thiefBody.visible }, mirrorVisible: !!(this.thief.visible && this.thief.userData.mirror?.visible), visibleGuardIds: this.guardActors.filter((actor) => actor.visible).map((actor) => actor.userData.guardId), visibleRelicIds: this.relicActors.filter((actor) => actor.visible).map((actor) => actor.userData.relicId) }; }
  dispose() { disposeGroup(this.world); disposeGroup(this.thief); this.renderer.dispose(); this.effects.length = 0; }
}

export function createScene(container) { return new MuseumScene(container); }
export default createScene;
