# Production decisions

## Candidate selection

The preceding projects explored rewind platforming, a narrative 3D party RPG, rhythm cooking, a brake-powered 3D racer, and a memory-pawning deck/shop game. Another click-led management game or chase-camera action game would repeat those play structures.

Candidates considered for this production were a gravity-rotating physics rescue puzzle, a first-person museum infiltration using borrowed eyesight, and a turn-based disaster-logistics strategy game. The museum concept was selected for its stronger immediate contradiction: the player needs the very surveillance system they must avoid. First-person embodiment, keyboard movement, stationary-body observation and patrol timing give it a distinct camera, control scheme, objective and pacing.

## Final rules

The museum owns the right to see its exhibits. A thief's eyes see nothing until a Lenskeeper has witnessed the relic through the borrowed mirror. Watching for .45 seconds discovers it for the current attempt. Discovery is only information: the thief must still cross the physical space, recover the relic and leave.

Watching does not consume mana, stop time or teleport the body. That makes choosing the observation position the main risk. Crouching reduces noise; marked refuges conceal a crouched body except at close range. Walls block both vision and hearing. Investigating guards pathfind back to their patrol.

Three wings build from a single readable patrol to overlapping routes and six total relics. The standard and gentle settings change detection, not content. Records encourage cleaner replays without imposing a countdown on first attempts.

## Presentation and scope

Lea is an original adult former archivist; Lenskeepers are sculptural guards with porcelain heads, ruby lenses and brass halos. Both use authored Three.js meshes. Original key art establishes the character fantasy; six generated paintings give the physical museum thematic landmarks. All motion, relics, architecture and collision remain actual 3D geometry.

The palette is charcoal, ivory, ruby and brass. A restrained HUD distinguishes the stationary body from the borrowed viewpoint. Only discovered relics receive objective guidance. Ambient chords, glass cues, footsteps and suspicion pulses use original Web Audio synthesis. No runtime CDN, fonts, external images or audio files are required.

## Iteration

Headless real-input testing found missing keyboard event registration, an unclickable pause control, touch toggle feedback that cleared on release, and lost effects from fixed-step event overwrites. These were addressed in the app layer.

Visual inspection found an oversized first-person mirror, a camera-attached body during observation, buried wall trim, scaled refuge rings, rear-facing mirror glass and shared relic material state. Geometry and material ownership were corrected before final verification. The final QA document records only completed checks and measured outcomes.
