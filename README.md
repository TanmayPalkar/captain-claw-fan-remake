# Captain Claw — The Curse of Pirate Isle

A fan-made, 1997-style 2D side-scrolling pirate platformer built with HTML5 Canvas and vanilla JavaScript. Every visual is drawn procedurally at runtime and every sound is synthesized with the Web Audio API — no copyrighted game assets are used.

Storm the coast as Captain Claw, fight through four connected sections, recover treasure, and defeat Ironjaw at the stronghold gate to finish Level 1.

## Run it

ES modules must be served over HTTP, so `file://` will not work.

```bash
npm start
```

Then open **http://127.0.0.1:5173** in a modern browser (Chrome, Edge, Firefox, or Safari).

No dependencies are required. You can also use any static file server, for example:

```bash
python3 -m http.server 5173
```

## Controls

| Action | Keys |
| --- | --- |
| Move | `A` / `D` or `←` / `→` |
| Jump (hold for height) | `Space` / `W` / `↑` |
| Cutlass combo | `X` |
| Throw knife | `C` |
| Crouch | `S` / `↓` |
| Sprint | `Shift` |
| Pause / resume | `Esc` / `P` |
| Confirm menu | `Enter` |

## What is in Level 1

- **Coastal Arrival** — beaches, palm trees, a pirate ship offshore, and the first mutineers.
- **Pirate Outpost** — docks, shacks, powder pirates, moving platforms, and hidden chests.
- **Jungle Ruins** — spike pits, temple platforms, a waterfall, and heavy iron guards.
- **Pirate Stronghold** — torch-lit fortress, elite guards, a locked portcullis, and the Ironjaw boss fight.

Collect coins for score, and gems, chests, and cat idols for loot. Checkpoints heal you and become your respawn point. Defeating Ironjaw opens the portcullis; reach the treasure vault beyond it to complete the level.

## Project structure

```
index.html          Page shell, HUD, and menus
styles.css          Retro UI, HUD, and responsive 16:9 presentation
server.js           Zero-dependency static server
src/main.js         Fixed-timestep game loop
src/game.js         Game state machine, combat, scoring, progression
src/level.js        Level 1 layout, checkpoints, enemies, and loot
src/player.js       Captain Claw movement, combat, and animation
src/enemies.js      Pirate, ranged, heavy, and boss AI and art
src/world.js        Terrain, decorations, hazards, and gate rendering
src/background.js   Parallax coastal/outpost/jungle/fortress scenery
src/collectibles.js Coins, gems, chests, food, and idols
src/projectiles.js  Knives, powder shots, cannonballs, and shockwaves
src/particles.js    Effects and floating combat text
src/audio.js        Synthesized sound effects and looping pirate music
src/ui.js           HUD and menu wiring
src/physics.js      Shared AABB movement and moving-platform logic
src/config.js       Tuning constants and theme colors
```

## Notes

- The game renders at an internal 1280×720 (16:9) resolution and scales to the window while preserving aspect ratio.
- Progress, score, and loot reset when you restart the level or return to the main menu.
- Sound can be toggled from the main menu or pause screen; the preference is stored locally.
