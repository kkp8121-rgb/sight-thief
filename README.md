# SIGHT THIEF · 시선을 훔치는 자

**감시자의 눈으로만 보이는 보물을, 감시자의 사각에서 훔친다.**

Original first-person supernatural stealth heist. Lea enters a museum that has claimed six fragments of other people's lives. Borrow a moving Lenskeeper's vision to reveal a hidden memory; release the mirror, cross the gallery in your own body, recover it, and reach the exit.

Three authored wings increase from one guard and one relic to three guards and three relics. There is no combat or time limit. Full suspicion ends the current attempt. Retry the wing, try the gentler detection setting, or replay completed wings for a better grade.

## Play locally

Open `index.html` directly. All runtime dependencies, art and sound are bundled locally. No installation or internet connection is required to play.

| Input | Action |
| --- | --- |
| WASD | Move and strafe |
| Mouse, after clicking the game view | Look |
| ↑ / ↓, ← / → | Move forward/back, turn left/right |
| Hold Shift | Crouch; blue refuge rings conceal a crouching body |
| Hold Q | Borrow the nearest guard's eyes; your body stays put |
| Tab while holding Q | Select the next guard |
| E | Recover a discovered relic or use the exit |
| Esc | Pause and release the mouse |
| Enter | Start, next wing, retry |
| R on defeat | Retry the current wing |
| M | Mute |

Touch devices have movement, turning, crouch toggle, held observation, interaction and guard-switch controls. Crouching reduces footstep range; it does not make you invisible outside refuges. Guards can still detect you at very close range inside a refuge. Observation freezes your body, not the museum.

Only completed-wing records and sound/difficulty preferences are saved in this browser. An attempt in progress is not saved. Standard and gentle records are separate; either mode unlocks the next wing.

## Development

```sh
npm ci
npx playwright install chromium
npm run build
npm test
npm run test:browser
npm run test:interaction
npm run test:campaign
npm run pack
npm run test:package
```

`npm run serve` exposes `/sight-thief/` on localhost port 4178 without opening a browser. Set `SIGHT_URL` to test a deployed subpath. The portable itch.io archive is `dist/sight-thief-web.zip`.

Three.js geometry, pure simulation and the browser UI are separate modules. The release uses a classic IIFE rather than runtime ES modules. Museum painting textures are embedded as data URLs to allow WebGL texture loading under `file://`. Original Web Audio synthesis supplies all sound. Third-party license: `licenses/three.txt`.

Original image-generation prompts and preserved sources are documented in [docs/ART.md](docs/ART.md). Production decisions are recorded in [docs/PRODUCTION.md](docs/PRODUCTION.md). Verification evidence is documented in [docs/QA.md](docs/QA.md).

Public repository: https://github.com/kkp8121-rgb/sight-thief

GitHub Pages requires an explicitly approved push and deployment; an expected URL is not evidence of a live release.
