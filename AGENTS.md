# SIGHT THIEF

Standalone original first-person stealth heist. Do not modify PROMPTRON or sibling games.
Read docs/CONTRACT.md before implementation. Root owns game design, integration, verification and Git.
Workers have explicit file ownership; preserve other workers' edits. No descendants, commits, pushes, builds or visible browser launches unless root explicitly delegates that specific action.
Every Git push needs its own explicit user approval. Only public kkp8121-rgb repositories are valid publishing targets. Stage explicit paths only.
Never run start/open/xdg-open or launch a visible browser. Headless Playwright is allowed.
Runtime must work offline in file:// and Pages subpaths: classic IIFE and relative assets, no remote fonts or CDN.
Never print or commit credentials, image base64 or auth files. Quota helpers and test artifacts stay ignored.
Game inspection API returns copies only. Real play verification uses inputs, never state injection; label isolated unit fixtures honestly.
Verify first-person yaw, strafe and guard-facing signs through the actual camera, not formulas alone. Scene geometry must match physical walls.
Use apply_patch for Korean and nested quotes. Count exact PowerShell replacements with regex Matches/Escape, not String.Split.
Read GitHub account identity from gh api user; never guess numeric account ids.
