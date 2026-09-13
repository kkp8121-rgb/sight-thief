# Verification — 2026-09-13 KST

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

The public repository `kkp8121-rgb/sight-thief` was verified as empty before publication. **Push and GitHub Pages activation still require the user's per-push approval.** The local subpath checks do not claim that the expected Pages URL is live. After approval, verify the actual Pages URL with `SIGHT_URL` and the browser suite.
