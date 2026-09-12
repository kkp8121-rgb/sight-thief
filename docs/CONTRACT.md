# SIGHT THIEF · 시선을 훔치는 자

## Design decision

Alternatives compared: first-person photograph-freeze physics rooms (framing moving platforms, short spatial puzzles), sound-recording stealth (capture and replay footsteps, patrol evasion), and possession-of-sight heist (borrow a moving guard's camera, discover otherwise invisible treasures, then infiltrate with your own body). Choose only the sight heist. Its perception rule is stronger than a generic stealth reskin and changes how the player gathers information and plans movement. The previous racer used stored energy; do not add another store-and-release resource loop here.

Hook: treasures are visible only through their watchers' eyes; discover them through a guard, then steal them from the guard's blind spot. Theme: surveillance becomes the thief's tool. Fantasy: Lea, a clearly adult 29-year-old former archivist, retrieves six stolen fragments of people's lives from a museum that claims ownership by watching. Three authored wings, first-person movement, observation and patient route planning; no combat or arena waves.

Goal per wing: witness each relic through a guard's view, physically reach it and press E, then reach the exit and press E. Three wings contain 1, 2 and 3 relics. Final ending after all six. No deadline; stealth grade uses time and peak suspicion. Being fully detected loses the attempt; retry resets that wing, completed wings stay unlocked/saved. Intended several-minute complete journey with increasing patrol overlap.

## World and coordinates

CELL=3 metres. ASCII '#' solid wall, '.' floor, 's' shadow refuge, 'S' spawn and shadow refuge, 'X' exit, 'R' relic. Grid cell centres: x=(column-width/2+.5)*CELL, z=(row-height/2+.5)*CELL, floor y=0. World directions: right +X, down +Z. Yaw0 faces -Z; positive yaw turns right, forward=(sin(yaw),-cos(yaw)), strafe-right=(cos(yaw),sin(yaw)). Three camera must use lookAt(x+sin(yaw)*cos(pitch),eyeY+sin(pitch),z-cos(yaw)*cos(pitch)); positive pitch looks UP. Guard/player models face local -Z and world rotation.y=-yaw. Do not mirror geometry or minimaps to compensate for a sign error.

Maps, patrols and narrative are authored in src/levels.js. Patrol waypoints below are [column,row]; use collision-aware grid paths for patrol/investigation, not direct motion through walls. All relics and exits must be reachable on foot and observable from at least one actual guard patrol segment. Root may adjust geometry only after evidence.

All spawns face south (yaw=Math.PI) into the room, not the north boundary wall. Wing1 id='foyer', title='초대받지 않은 밤', one relic '첫 번째 웃음'. One guard '문지기', route [[9,7],[3,7],[3,3],[9,3]], starting toward [3,7] so the opening scan becomes useful within seconds.

```text
#############
#S....#....X#
#.....#.....#
#...........#
###.#####.###
#...........#
#..s.....s..#
#...........#
#.....#.....#
#..R..#.....#
#############
```

Wing2 id='archive', title='닫힌 편지의 수장고', relics '보내지 못한 안부' and '비가 오던 창'. Guards '서고지기' route [[1,3],[15,3],[15,5],[1,5]] and '기록지기' route [[14,10],[2,10],[2,8],[14,8]].

```text
#################
#S....#....#...X#
#.....#....#....#
#...............#
#..##...##...#..#
#...............#
#s....#....#...s#
#.....#....#....#
#...............#
#..##...##...#..#
#...............#
#..R.......R....#
#################
```

Wing3 id='vault', title='시선의 금고', relics '집으로 가는 노래', '낡은 약속', '아무도 빼앗지 못할 내일'. Guards '첫째 감시자' route [[2,3],[16,3],[16,7],[2,7]], '둘째 감시자' route [[1,7],[17,7],[17,10],[1,10]], '금고지기' route [[17,12],[2,12],[2,10],[17,10]]. The lower guard starts two columns east of the rightmost relic, so the 35-degree view cone has a comfortable discovery window.

```text
###################
#S....#.....#....X#
#.....#.....#.....#
#.................#
#..##....#....##..#
#s....#.....#....s#
#.....#.....#.....#
#.................#
#..##....#....##..#
#.....#.....#.....#
#s...............s#
#..##....#....##..#
#.................#
#..R..s..R..s..R..#
###################
```

## Pure game engine — core ownership

Own src/levels.js, src/game.js, tests/game.test.mjs. No Three/DOM/audio. Export LEVELS compiled array (id,title,intro,outro,grid,width,height,cell,spawn:{x,z,yaw},exit:{x,z},relics:[{id,name,x,z}],guards:[{id,name,route:[{x,z}]}]), getLevel(id), worldToCell(level,x,z), isWalkable(level,x,z), lineOfSight(level,ax,az,bx,bz), findPath(level,start:{x,z},end:{x,z}) -> world-centre array. Diagonal corner cutting forbidden. Scene reads exact compiled cells.

Export createRun(levelId='foyer',mode='standard'), stepRun(run,input,dt), interact(run), cycleView(run), summarize(run). Mutating simulation state is allowed for efficient fixed stepping; root/browser inspection copies it. createRun state fields: levelId,mode,status ('playing'|'won'|'lost'),time,player:{x,z,yaw,pitch,crouching,inShadow,moving},guards:[{id,name,x,z,yaw,routeIndex,mode:'patrol'|'investigate',target,alert,...internal navigation}],relics:[{id,name,x,z,discovered:false,collected:false,scan:0}],watching:false,watchGuardId:null,suspicion:0,peakSuspicion:0,events:[],stats:{steps,scans,collected}. events is replaced on each step/action, not an ever-growing log. All numeric values finite.

Input: forward/strafe/turn in -1..1, lookYaw/lookPitch instantaneous radians (mouse deltas applied ONCE, not repeated per fixed substep), crouch boolean, watch boolean. stepRun accepts dt seconds capped/substepped at <=1/30; player movement collision radius .28, normalize diagonal speed, walk3.2m/s, crouch1.6m/s, turn1.7rad/s, eye heights standing1.65/crouch1.05, pitch clamp±1.1. Forward/strafe are body-relative. Collision-aware circles cannot cross walls or bounds.

Watching: rising watch chooses nearest guard unless previous valid selection retained. Hold Q/watch to put camera at chosen moving guard's eyes; player BODY does not move or rotate, but time and every guard continue. cycleView changes to next guard only while watching. Release restores body's unchanged viewpoint. Unlimited watching has positional risk, not an energy meter. Guard camera yaw comes from actual current patrol facing; body mouse look is ignored while watching. No movement through the possessed view.

Relic discovery: while watching, only the selected guard can witness a relic, requiring distance<=16m, horizontal angular difference<=35 degrees and exact wall line of sight. Accumulate visible scan for .45sec; once discovered it stays known this attempt, emits discovered and increments scans once. Undiscovered relics have no normal-view geometry/marker and cannot be collected by blind E. Discovered relics appear as faint remembered outlines in own view; in guard view visible witnessed relics glow strongly. E within2.1m and wall LOS while NOT watching collects nearest discovered uncollected relic; emits collected. Exit E within2.1m only after all wing relics collected sets won and emits finish. Invalid E emits a concise hint but consumes nothing.

Guards: patrol1.45m/s, investigate1.8m/s. Routes loop, yaw points along current movement; turn smoothly at corners but scan/detection uses the same yaw as renderer. Walking creates a5.5m hearing radius when moving, crouching1.25m. Hearing through walls is blocked by LOS for this small game. A guard hearing the player investigates that last heard point for up to4sec then returns to its patrol through pathfinding. Guard seeing the player requires range14m, FOV80deg and LOS; crouching in an S/s refuge hides the player unless within1.6m. Contact within.65m also detects. Each guard alert builds from0 to1 at .85/sec when seeing the player, decays .45/sec otherwise. Run suspicion is max guard alert; at1 status lost, emits finish. Gentle mode detection range*.9 and alert build*.6. All guards keep patrolling during observation. Avoid locking guards indefinitely to obsolete investigation targets or instant unpredictable snaps.

summarize returns {status,levelId,mode,time,collected,total,scans,peakSuspicion,grade}; grade S for peak<.2 and time<150, A for peak<.6, else B on win, null if not won. Narrative and tuning values centralized. Tests: map widths/reachability, routes/path collision, ray wall occlusion, heading/strafe signs, all relics observable via natural patrol, no movement during Q, guard progress while Q, discovery required, exact collection/exit conditions, suspicion/loss/retry, gentle tuning and no repeated events.

## 3D scene, models and sound — presentation ownership

Own src/models.js, src/scene.js, src/audio.js. createScene(container) -> {setLevel(level),update(run,dt),resize(),dispose(),get stats()}; scene receives the SAME world coordinates with no mutations. get stats includes drawCalls,triangles,pixels,software,frame count. Root supplies assets/key-art.webp; do not overwrite it. No runtime network.

Genuine Three.js 3D museum: dark polished stone, ivory art-deco walls/arches, deep red exhibit frames, brass details, high windows and subtle cool ambient light. Visible wall meshes exactly occupy # cells, height3.4m, floor checker/marble variation, shadow refuge floor motifs and low blue light. Decorations stay inside wall/niche bounds and never obstruct walkable space without matching collision. Readable architecture, not a flat maze map. Use instancing/merged boxes where helpful, software pixel cap~400k and no shadows; hardware cap~2M and restrained shadow use. Correct sky/ceiling/background, no void glimpses or z-fighting.

Model the 'Lenskeeper': adult-height porcelain oval head with single inset ruby lens on front -Z, brass halo, angular black sculptural coat and articulated shoulders/arms, gliding pedestal lower body; direction immediately legible. Animate small gaze/arm/hover motion. Own-body first-person hands hold an octagonal brass/black mirror low in frame; while watching, own body becomes a visible modestly clothed adult thief model (ivory high-collar coat, black trousers, red scarf, short dark hair). Genuine meshes, no billboard substitutes for guards or architecture. Retain one reusable mesh per actor and dispose resources on level changes.

Relics: six distinct geometric vessels/symbols on small plinths, luminous glass/ivory/ruby accents. Use discovered/collected flags and watch guard LOS to show the correct visibility. Do not accidentally reveal unknown relics via marker or plinth glow in normal view. Safe refuges and exit consistently signposted. Suspicion direction feedback, subtle footsteps bob, observation transition and collected motes; no bob in watch camera and no camera shake that prevents aiming. Only camera position changes while viewing a guard; don't move player model to guard location.

createAudio() -> {unlock,setVolume,setMuted,start,pause,resume,stop,play,update,dispose}; update(run,dt) controls actual moving-footstep cadence, nearby guard footfalls and rising suspicion; no events repeated every animation frame. play(name) supports select,watch,discovered,collected,denied,win,lose. Original restrained museum ambience, glass tones, mirror hum and alert pulses via Web Audio; master default.24, smooth mute, all nodes/timers cleanup, graceful AudioContext absence. No copied melodies, no external sound files. User gesture unlock.

## App and input — app ownership

Own index.html,style.css,src/app.js. Build an offline classic IIFE with Three included. Screens title, wing selection, gameplay, pause/guide/settings, wing-clear/next, defeat/retry, final ending. Root owns build/server/pack/test tooling. Korean UI, readable system fonts, original key art on title. Colors charcoal/ivory/ruby/brass; distinguish from previous cream shop and blue racer.

First30seconds: explicit one-sentence hook and controls, first wing starts in a refuge; tell player to crouch and hold Q, then Tab to another guard in later wings. Show active body vs watcher identity, suspicion bar, refuge/crouch status, found vs collected counts, nearby E prompt and exit objective. A small compass/objective label can point to DISCOVERED relics only; never reveal unknown positions in normal play. Do not drown first-person view in dashboard cards.

Desktop: WASD movement/strafe, mouse look when canvas clicked/pointer locked, ←/→ turn and ↑/↓ forward/back as keyboard-only alternative; Shift hold crouch; Q hold watch; Tab cycle guard while Q held; E interact; R retry from defeat; Esc pause/release pointer lock; Enter start/next/retry; M mute. Pointer lock request only on explicit canvas click, never on title load. Catch unsupported/denied pointer lock without blocking keyboard play. Pause/blur/hidden clears input; simulation time freezes. Mouse deltas consumed once per frame; use fixed1/60 simulation. Avoid hold-repeating discrete E/Tab actions.

Touch: explicit visible forward/back and turn-left/right holds, crouch toggle, hold-eye, interact and next-watcher buttons; optional drag right side of world to look. Genuine simultaneous touch controls via independent pointer IDs; no losing a held action when another pointer is released. Targets>=44px, unobscured at390×844 and844×390. Keep view above controls and keyboard help concise.

Save only completed-wing records and settings in sight-thief-records-v1 and sight-thief-settings-v1. Records keyed mode then levelId; validate known IDs, finite nonnegative times/peakSuspicion, grade whitelist. Unlock next wing when previous completed in either mode; modes keep separate bests. Defaults volume.24,muted false,mode standard; preserve zero. Current attempt need not autosave, state it in guide. No storage corruption can inject HTML. A run's mode remains unchanged if new-game preference changes. No runtime account/login.

Selectors: [data-action='start'|'begin'|'resume'|'next'|'retry'|'guide'|'back'], [data-level-id], [data-touch='forward'|'back'|'left'|'right'|'crouch'|'watch'|'interact'|'cycle'], canvas inside #world. Settings #volume-range/#mode-select. Read-only window.__sight getters ready,screen,run(deep clone),settings(copy),records(copy),sceneStats. Never expose live run or direct progress mutators.

Root acceptance: actual input-driven completion of all3 wings and6 relics, discovery through moving guards, exits, save/unlock, genuine defeat/retry, keyboard/mouse/touch, file/subpath loading/audio/errors, screenshots and portable ZIP. Unit simulated fixtures are separate from real campaign evidence. No visible browser and no unapproved push.
