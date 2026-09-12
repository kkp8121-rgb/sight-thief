import * as THREE from 'three';

const palette = { ivory: 0xe9e0cf, charcoal: 0x171b24, ink: 0x0e1118, ruby: 0xb83e4b, brass: 0xc99a4b, red: 0x7e2638, blue: 0x5878a4, glass: 0x9ad5dc };
const mats = new Map();
const mat = (color, options = {}) => { const key = `${color}:${options.emissive || 0}:${options.emissiveIntensity || 0}:${options.metalness || 0}:${options.roughness ?? .7}:${options.transparent ? 1 : 0}`; if (!mats.has(key)) { const material = new THREE.MeshStandardMaterial({ color, emissive: options.emissive || 0, emissiveIntensity: options.emissiveIntensity || 0, metalness: options.metalness || 0, roughness: options.roughness ?? .7, transparent: !!options.transparent, opacity: options.opacity ?? 1 }); material.userData.sharedMaterial = true; mats.set(key, material); } return mats.get(key); };
const mesh = (geometry, material, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) => { const object = new THREE.Mesh(geometry, material); object.position.set(...position); object.rotation.set(...rotation); object.scale.set(...scale); return object; };
const box = (w, h, d, color, options) => mesh(new THREE.BoxGeometry(w, h, d), mat(color, options));
const cylinder = (radius, height, color, options, segments = 12) => mesh(new THREE.CylinderGeometry(radius, radius * 1.08, height, segments), mat(color, options));
const sphere = (radius, color, options, scale = [1, 1, 1]) => mesh(new THREE.SphereGeometry(radius, 16, 10), mat(color, options), [0, 0, 0], [0, 0, 0], scale);

function addLens(root) {
  root.add(mesh(new THREE.SphereGeometry(.24, 16, 10), mat(palette.ruby, { emissive: palette.ruby, emissiveIntensity: 1.5, metalness: .15, roughness: .25 }), [0, 1.78, -.46], [0, 0, 0], [1, .72, .35]));
  root.add(mesh(new THREE.TorusGeometry(.29, .045, 8, 18), mat(palette.brass, { metalness: .78, roughness: .24 }), [0, 1.78, -.47]));
}

export function createLenskeeper() {
  const root = new THREE.Group(); root.name = 'lenskeeper';
  root.add(cylinder(.42, .24, palette.charcoal, { metalness: .35, roughness: .46 }, 10));
  root.add(mesh(new THREE.ConeGeometry(.64, 1.25, 6), mat(palette.charcoal, { metalness: .12, roughness: .58 }), [0, .78, 0], [0, Math.PI / 6, 0]));
  root.add(mesh(new THREE.SphereGeometry(.48, 16, 12), mat(palette.ivory, { roughness: .5 }), [0, 1.65, 0], [0, 0, 0], [1, 1.14, .92]));
  addLens(root);
  const halo = mesh(new THREE.TorusGeometry(.66, .055, 8, 24), mat(palette.brass, { metalness: .8, roughness: .25 }), [0, 1.72, .08]); halo.name = 'brass-halo'; root.add(halo);
  for (const side of [-1, 1]) { const shoulder = box(.3, .24, .38, palette.charcoal, { metalness: .2, roughness: .52 }); shoulder.position.set(side * .55, 1.05, 0); shoulder.rotation.z = side * -.16; shoulder.name = 'shoulder'; root.add(shoulder); const arm = box(.18, .72, .2, palette.charcoal, { metalness: .2, roughness: .52 }); arm.position.set(side * .66, .66, -.03); arm.rotation.z = side * -.12; arm.name = 'articulated-arm'; root.add(arm); const gauntlet = cylinder(.13, .18, palette.brass, { metalness: .72, roughness: .3 }, 8); gauntlet.position.set(side * .7, .29, -.05); root.add(gauntlet); }
  root.userData.hover = 0; root.userData.gaze = [];
  return root;
}

export function createThief() {
  const root = new THREE.Group(); root.name = 'thief-first-person';
  const body = new THREE.Group(); body.name = 'body'; body.visible = false; root.add(body);
  body.add(mesh(new THREE.CylinderGeometry(.27, .4, .78, 8), mat(palette.ivory, { roughness: .65 }), [0, -.46, 0]));
  body.add(mesh(new THREE.CylinderGeometry(.17, .23, .62, 8), mat(palette.ink, { roughness: .62 }), [-.2, -1.12, 0])); body.add(mesh(new THREE.CylinderGeometry(.17, .23, .62, 8), mat(palette.ink, { roughness: .62 }), [.2, -1.12, 0]));
  const scarf = box(.52, .08, .11, palette.ruby); scarf.position.set(0, -.27, -.24); scarf.rotation.z = .12; body.add(scarf);
  const head = sphere(.23, palette.ivory, { roughness: .58 }, [.95, 1, .86]); head.position.set(0, .16, -.02); body.add(head);
  const hair = sphere(.255, palette.ink, { roughness: .58 }, [1.04, .62, .9]); hair.position.set(0, .3, .045); body.add(hair);
  const fringe = box(.3, .12, .08, palette.ink, { roughness: .58 }); fringe.position.set(-.1, .2, -.205); fringe.rotation.z = -.14; body.add(fringe);
  for (const side of [-1, 1]) {
    const sleeve = cylinder(.105, .5, palette.ivory, { roughness: .66 }, 8); sleeve.position.set(side * .36, -.47, -.01); sleeve.rotation.z = side * -.18; body.add(sleeve);
    const hand = sphere(.075, palette.ivory, { roughness: .72 }, [.95, .85, 1]); hand.position.set(side * .42, -.75, -.13); body.add(hand);
  }
  const rightArm = cylinder(.065, .34, palette.ivory, { roughness: .7 }, 10); rightArm.position.set(.23, -.3, -.49); rightArm.rotation.x = .12; rightArm.rotation.z = -.2; rightArm.name = 'hand-arm'; rightArm.visible = false; root.add(rightArm); const rightHand = sphere(.085, palette.ivory, { roughness: .72 }, [1, .85, 1]); rightHand.position.set(.25, -.49, -.66); rightHand.name = 'hand'; rightHand.visible = false; root.add(rightHand);
  const leftHand = sphere(.065, palette.ivory, { roughness: .72 }, [1, .85, 1]); leftHand.position.set(-.3, -.5, -.62); leftHand.name = 'hand'; leftHand.visible = false; root.add(leftHand);
  const mirror = new THREE.Group(); mirror.name = 'octagonal-mirror'; mirror.position.set(.3, -.52, -.76); mirror.rotation.x = -.13; mirror.add(mesh(new THREE.CylinderGeometry(.17, .17, .06, 8), mat(palette.charcoal, { metalness: .6, roughness: .25 }), [0, 0, 0], [Math.PI / 2, 0, 0])); mirror.add(mesh(new THREE.CircleGeometry(.125, 8), mat(0x243341, { emissive: 0x294154, emissiveIntensity: .16, metalness: .2, roughness: .16 }), [0, 0, .038])); mirror.add(mesh(new THREE.TorusGeometry(.14, .022, 6, 8), mat(palette.brass, { metalness: .76, roughness: .24 }), [0, 0, .046])); root.add(mirror);
  mirror.add(mesh(new THREE.SphereGeometry(.046, 12, 8), mat(palette.ruby, { emissive: palette.ruby, emissiveIntensity: 1.2, roughness: .2 }), [0, .012, .057], [0, 0, 0], [1, .8, .25]));
  const sleeve = cylinder(.062, .16, palette.ivory, { roughness: .7 }, 8); sleeve.position.set(-.085, -.255, .035); sleeve.rotation.z = -.22; sleeve.name = 'mirror-sleeve'; mirror.add(sleeve);
  const glove = sphere(.068, palette.charcoal, { roughness: .66, metalness: .12 }, [1.05, .72, .85]); glove.position.set(-.105, -.14, .075); glove.name = 'mirror-glove'; mirror.add(glove);
  for (let finger = 0; finger < 3; finger++) { const tip = box(.032, .09, .045, palette.charcoal, { roughness: .62, metalness: .12 }); tip.position.set(-.145 + finger * .045, -.17 - (finger === 1 ? .012 : 0), .085); tip.rotation.z = (finger - 1) * .14; tip.name = 'mirror-finger'; mirror.add(tip); }
  root.userData.body = body; root.userData.mirror = mirror; root.userData.hands = root.children.filter((child) => child.name === 'hand'); return root;
}

export function createRelic(index = 0) {
  const root = new THREE.Group(); root.name = `relic-${index}`;
  const plinth = mesh(new THREE.CylinderGeometry(.48, .58, .16, 10), mat(palette.ivory, { metalness: .18, roughness: .48 }), [0, .08, 0]); root.add(plinth);
  const glow = mat(palette.glass, { emissive: palette.glass, emissiveIntensity: .18, transparent: true, opacity: .45, roughness: .2 });
  let object;
  if (index % 6 === 0) object = mesh(new THREE.TorusKnotGeometry(.22, .06, 48, 8), glow, [0, .48, 0], [Math.PI / 2, 0, 0]);
  else if (index % 6 === 1) object = mesh(new THREE.OctahedronGeometry(.3, 1), mat(palette.ruby, { emissive: palette.ruby, emissiveIntensity: .7, roughness: .25 }), [0, .48, 0]);
  else if (index % 6 === 2) object = mesh(new THREE.ConeGeometry(.28, .6, 6), glow, [0, .48, 0]);
  else if (index % 6 === 3) object = mesh(new THREE.TorusGeometry(.24, .075, 8, 16), mat(palette.brass, { emissive: palette.brass, emissiveIntensity: .5, metalness: .7, roughness: .25 }), [0, .48, 0], [Math.PI / 2, 0, 0]);
  else if (index % 6 === 4) object = mesh(new THREE.DodecahedronGeometry(.3, 0), mat(palette.ivory, { emissive: palette.ivory, emissiveIntensity: .42, roughness: .35 }), [0, .48, 0]);
  else object = mesh(new THREE.SphereGeometry(.26, 12, 8), mat(palette.ruby, { emissive: palette.ruby, emissiveIntensity: .85, roughness: .22 }), [0, .48, 0], [1, 1.45, 1]);
  object.name = 'relic-core'; object.material = object.material.clone(); object.material.userData = { ...object.material.userData, sharedMaterial: false }; root.add(object); root.userData.core = object; root.userData.plinth = plinth; root.userData.discovered = false; return root;
}

export function createArtDecoLamp() { const root = new THREE.Group(); root.add(cylinder(.08, 1.8, palette.brass, { metalness: .7, roughness: .26 }, 8)); const bulb = sphere(.2, palette.ruby, { emissive: palette.ruby, emissiveIntensity: .45, roughness: .25 }); bulb.position.y = 1; root.add(bulb); return root; }
