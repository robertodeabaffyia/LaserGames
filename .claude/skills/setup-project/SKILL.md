---
name: setup-project
description: Scaffold the initial LaserGames project structure for a chosen web game toolchain (Vite+TS, Phaser.js, Three.js, etc.)
disable-model-invocation: false
---

When the user invokes `/setup-project [toolchain]`:

1. If no toolchain is specified in $ARGUMENTS, ask the user to pick one: Vite+TypeScript (vanilla canvas/WebGL), Vite+Phaser.js, or Three.js+Vite.
2. Propose the scaffold plan (directory structure, key files, dependencies) in 2–3 sentences before writing anything.
3. After approval:
   - Run `npm create vite@latest . -- --template vanilla-ts` (or the appropriate init command for the chosen toolchain).
   - Install game-specific dependencies (e.g., `npm install phaser` or `npm install three`).
   - Add a `.gitignore` with `node_modules/`, `dist/`.
   - Initialize git if not already done: `git init`.
4. Update CLAUDE.md with the actual build, dev, test, and lint commands once the scaffold is in place.
5. Report what was created in one sentence.
