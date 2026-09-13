# Controls and guidance revision — 2026-09-13

Q now toggles borrowed sight, normal movement is quiet crouched walking, and Shift hurries. Discovered goals follow visible corridor waypoints, with eight direction labels. The HUD presents one current action and collected/total memories. Mouse and touch drag use pointer capture; pause, blur and screen changes clear both held and toggled input.

The previous bundle failed the new real mouse-drag regression (`artifacts/v1-drag-reproduction.log`: rightward drag did not increase yaw). The revised bundle passes. Every browser harness denies native Pointer Lock before loading the game. Native pointer lock was deliberately not exercised because headless automation can affect the user's desktop cursor.

- Pure simulation/models: 12/12 pass; mechanics, patrols and maps are unchanged.
- Final file/subpath browser checks: discovery, body/guard camera correspondence, corridor guidance, keyboard turning, measurable audio, mute and pause; no runtime errors, missing assets or external requests.
- Final interaction checks: actual mouse drag and touch drag, Q tap/repeat, Shift hurry, multiple guards, portrait 390×844 and landscape 844×390, seven visible first-wing touch controls of at least 44px, pause/retry, corrupt storage, and denied pointer-lock/WebGL/audio fallbacks.
- Final public hardware browser campaign: all three wings, six memories and ending; reload restores completion records and unlocks. Wing times were 66.700 / 102.283 / 126.833 seconds, with peak suspicion 0 / 0 / 7.083%. No live game-state assignment; the test plans on detached snapshots and controls the browser with real keys.
- Public campaign audio: 1,083 sources, destination peak 0.011237. Hardware frame interval mean 17.008ms, p95 16.8ms over 17,448 frames. Optimized automated routes do not establish human difficulty or enjoyment.
- The public campaign, final browser/interaction/package checks and published asset comparison use bundle SHA-256 `42dad54feab58c2434b9395aee287a2c82796ed807d56d5f8587a2b12f59b05f`. The final campaign started at 2026-09-13T11:09:38Z; evidence is in `artifacts/root-final-public-campaign.log` and `campaign-report.json`.
- An earlier public attempt was detected near the second vault memory. The test planner now measures guard alert on a detached simulation and replans when the live guard sees the player (bounded to eight replans). The final public route required one replan. This changes only automated navigation, not game rules or difficulty.
- Final dedicated RTX 3060 Ti/D3D11 check: 1,296,000 pixels, 33 draw calls, mean 23.443ms, p95 50ms; run concurrently with other test work, not an isolated benchmark.
- Portable ZIP: all eight entries match final local files and use forward-slash relative paths. Fresh screenshots include `v1-spawn.png`, `v1-watch.png`, `subpath-route.png`, and `v2-mobile-390.png` / `v2-mobile-844.png` in ignored artifacts.

Published asset hashes and the actual Pages build are verified separately after push and saved to `artifacts/improvement-publication.json`.

---
# Original release verification — historical

All browser work used headless Chromium. No visible browser was opened. The original PROMPTRON project and the fifteen original cartridges were not modified.

## Complete playthrough

`node tests/campaign.cjs --hardware` completed all three wings through genuine keyboard inputs, recovered all six memories, used all exits, displayed the final ending, persisted the records across reload and unlocked all wings. The browser exposes only copied inspection state. The route planner forecasts a detached simulation while the actual game is paused; it never assigns the live run, teleports the player or injects victory.

| Wing | Natural observation time | Completion time | Relics | Peak suspicion | Grade |
| --- | ---: | ---: | ---: | ---: | --- |
| 초대받지 않은 밤 | 5.833 s | 66.633 s | 1 | 0% | S |
| 닫힌 편지의 수장고 | 12.300 s | 102.317 s | 2 | 0% | S |
| 시선의 금고 | 18.400 s | 126.817 s | 3 | 5.667% | S |

Total simulation play time was 295.767 seconds. Planning pauses are excluded. This is an optimized automated route, not a human completion-time estimate. A separate software-rendered full campaign also passed before the final visual pass.

The hardware campaign bundle SHA-256 was `670f6c3b751779439bf2d344900a616041087b581e492d5b4f19b30e23c9f7e0`. Afterwards, the UI received touch-specific tutorial wording, explicit body-relative objective labels, reuse of the engine's exact LOS for nearby prompts, a visible WebGL failure banner and a compact landscape touch layout. Final browser and interaction checks passed on the release bundle. The simulation rules, maps, models and audio did not change after that complete campaign.

## Rules and geometry

`npm test`: **12/12 passed**. Coverage includes authored maps and connectivity, exact wall/corner LOS, all six relics naturally observable, movement/collision and one-shot look deltas, frozen body during borrowed vision, guard switching, discovery before collection, exit completion, detection/hearing and gentle mode, wall-safe investigation return, and input-driven deterministic completion of every wing. The latter is an isolated engine test, separate from the browser campaign.

Model checks verify six distinct collectible geometries with independent animated materials, standing/crouching body alignment to the floor, and the ruby eye's facing direction. Browser diagnostics verify the guard camera, body position, hidden selected guard, unknown-relic visibility and camera movement signs.

## Browser, input and failures

`npm run test:browser` passed under both `file://` and a served `/sight-thief/` subpath. Original art and embedded WebGL textures loaded without external runtime requests, page errors, console errors or failed assets. First discovery occurred at 5.983 seconds in the final smoke checks. Synthesized audio reached the output; measured mute peak was zero, and pause suspended the AudioContext and simulation.

`npm run test:interaction` passed: actual mouse capture and look signs, body look frozen while observing, no queued-look jump on release, Esc release/pause, pointer-lock-denied keyboard fallback, arrow turning versus A/D strafing, Shift release, guard cycling, visible HUD pause/resume, actual detection and Enter retry, corrupt storage, missing audio and missing WebGL. The WebGL explanation is hit-tested above the menu so a merely present but obscured message cannot pass.

Real touchscreen taps and CDP multitouch events tested the eight controls at **390×844 and 844×390**. Controls passed 44px minimum bounds, center hit-testing and horizontal-overflow checks. The landscape controls use a single row to preserve the first-person view. Title, body view, borrowed view, mobile layouts, failure banner and ending screenshots were inspected.

## Performance

The dedicated performance checks ran separately from the parallel browser suites, with real movement and observation. Their measured intervals are more useful than timings from overlapping test browsers.

| Renderer | CPU throttle | Render pixels | Mean frame interval | 95th percentile |
| --- | ---: | ---: | ---: | ---: |
| SwiftShader | 1× | 400,000 | 29.672 ms | 50.0 ms |
| SwiftShader | 4× | 400,000 | 36.206 ms | 50.0 ms |
| NVIDIA RTX 3060 Ti, ANGLE D3D11 | 1× | 1,296,000 | 16.666 ms | 16.7 ms |

The full hardware campaign averaged 16.714 ms across 17,748 frames. The renderer was verified as hardware rather than inferred from a launch flag. These measurements describe this machine and headless Chromium, not all devices. Audio peaks remained below .009; no clipping or runtime errors were observed.

## Release artifact

`npm run pack` and `npm run test:package` passed. `dist/sight-thief-web.zip` contains **8 files, 1,139,218 bytes**, with portable relative paths and every extracted file's SHA-256 matching the built source. The release `game.js` is **1,138,240 bytes**, SHA-256 `e7fbea0cb74994987933fee9a5975922dd1491018e420fc8115bb35f0ff3904c`.

Reports and screenshots are regenerated in the ignored `artifacts/` directory. Unit fixtures and saved-progress fixtures used for isolated input tests are not included in the browser game's release state.

The original prepublication checks above are historical. The current public game is https://kkp8121-rgb.github.io/sight-thief/; actual revision and asset verification are recorded separately in `artifacts/improvement-publication.json`.
