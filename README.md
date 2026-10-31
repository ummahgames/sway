# Sway — The Buried Kingdom

A 3D HTML, CSS, and JavaScript dungeon crawler rendered with WebGL 2 and a locally bundled Three.js library. The visual direction takes inspiration from classic overhead action RPGs such as FATE: rounded creature models, textured stone, warm torchlight, loot, and an ornamental combat interface. The desert setting, active hypnosis, and uncapped minion army remain Sway’s core. No installation, build, account, or runtime CDN is needed.

## Play

Serve this folder over HTTP. The new renderer uses JavaScript modules, so opening `index.html` as a `file://` URL is not supported:

```sh
cd sway
python3 -m http.server 8097 --bind 127.0.0.1
```

Then visit <http://localhost:8097>. Landscape is recommended on phones; the portrait layout also provides touch controls. Use a current browser with WebGL 2 and hardware acceleration available. Saves belong to the browser and origin where you play; `localhost` and `127.0.0.1` have separate expeditions. Existing v1 expedition saves remain compatible with the 3D renderer.

## The loop

Explore three connected chambers on each floor. Weaken a creature below 32% health, then activate **Sway**. Stay close and keep a clear tether for several seconds while the creature continues attacking. Move and dodge to survive. A successful recruit follows and fights with you, without a party-size limit.

Capturing stops fresh allied attacks against that target and pauses your own automatic strikes. Existing projectiles remain dangerous. Dodging pauses progress briefly; hits remove some progress, and broken range or sight gradually erodes it. **Strike** deliberately cancels the channel.

Resolve the floor's creatures by defeating or swaying them to open the eastern gate. Choose a gift, then descend with every surviving follower. Each floor has finite encounters, and floors continue without a final level. The five region palettes cycle as the descent deepens.

## Controls

| Action | Desktop | Touch |
| --- | --- | --- |
| Move | WASD / arrows; click a floor destination | Left virtual stick; tap a floor destination |
| Select / approach a creature | Click its model | Tap its model |
| Begin / cancel Sway | E; right-click a weakened creature to select and sway | Sway button, toggled rather than held |
| Dodge | Space | Dodge button |
| Strike / cancel channel | J | Strike button |
| Rally / release statues | R | Rally button |
| Shield line | 1, then drag a segment | Line, then drag a segment |
| Statue wall | 2, then drag a segment | Anchor, then drag a segment |
| Rush | 3, then choose a destination | Rush, then choose a destination |
| Spread | 4 | Spread button |
| Interact / descend | F | Contextual interaction button |
| Pause / cancel placement | Escape | Pause button |
| Camera zoom | Scroll; + / − | Camera + / − buttons |
| Camera turn | Q / C | Camera arrow buttons |
| Reset camera | Compass / crosshair button | Compass / crosshair button |

Basic strikes are automatic by default. Pause to switch to manual strikes, reduced effects, or the Balanced graphics preset. Balanced lowers rendering resolution and shadow resolution while preserving every follower and all combat rules. Touch devices default to Balanced. Sound is optional and synthesized locally. A full-screen control is available where the browser supports it.

## Formations and the sanctuary

Line and Anchor use nearby followers appropriate to the length you draw. The rest of the horde remains available. Statues last seven seconds initially, retain their health, reduce damage, block hostile ground movement, and intercept projectiles. Rally releases them early. Enemy warnings still need attention: lightning, flame cones, and other area attacks can bypass a defensive frontage.

The second chamber contains a diamond pressure seal and a sanctuary. Anchor a follower on the seal, then approach the sanctuary and interact. Its one-time gift heals the player and horde and grants sun shards. This is an optional advantage; it never blocks the route to the next floor.

## Included in the 3D edition

- A real perspective WebGL world, rotatable camera, raycast targeting, textured floors and walls, soft shadows, warm torchlights, mist, and ground markings.
- Original articulated 3D models for the wanderer and all seven creature types, including walking, flight, casting, and statue appearances.
- 3D arches, pillars, banners, urns, crates, braziers, loot, a sanctuary, and a shader-animated gate.
- Instanced floor/wall geometry, batched architecture, baked model surface colors, reused effect pools, and cleanup when creatures or floors leave the scene.
- Classic dungeon-crawler health and Sway orbs, framed hotkeys, a compact map, and camera-relative controls.
- Seven distinct creatures: Dune Jackal, Cinderback, Stormwisp, Basalt Horn, Veiled Djinn, Sun Phoenix, and Dune Drake.
- Creature-specific melee, charge, fire, lightning, and projectile attacks with visible warnings.
- Active Sway, capture targeting, dodging, automatic or manual basic attacks, and creature allegiance changes.
- Uncapped follower recruitment, shared navigation through corridors, five horde commands, and health persistence between floors.
- Procedural enemy compositions, elite creatures every third depth, five region themes, and three upgrade choices between floors.
- An optional sanctuary mechanism, loot, local autosave, pause, suspend/resume, and expedition defeat/restart.
- Responsive controls, a minimap, horde summary, field guide, reduced effects, and generated sound effects.

This is the 3D visual rebuild of the first playable edition of the [formal proposal](SWAY_GAME_PROPOSAL.md). Giant multi-stage boss recruitment, a complete mythology codex, additional regional creatures, and elaborate elemental mechanisms remain future content. Levels currently combine the same connected three-chamber layout with changing creatures, decoration, difficulty, and region palettes. There is no authored campaign or claim of infinitely unique room geometry.

The world uses 3D meshes with depth, perspective, lighting, shadows, and animations. A small 2D overlay draws readable health bars and damage numbers. Every follower remains a simulated creature. There is no gameplay cap, but very large hordes eventually encounter the memory and performance limits of the device. Physical phone performance has not yet been measured.

## Saves and defeat

The game saves locally every few seconds and at important events. Pause, hiding the tab, or leaving the page saves the expedition. Combat pauses while the page is hidden or its window loses focus. Resume restores creatures, health, active formations, hazards, projectiles, and an ongoing Sway attempt. Closing the browser is not defeat.

Player defeat ends the active expedition and begins the next at the surface. Deepest depth and recruitment records remain on that browser. There is no tracking, backend, or activity while you are away. If browser storage is unavailable or full, the game reports that saving is unavailable; play can continue in the current tab.

## Source and checks

- `engine.js`: deterministic world, navigation, combat, formations, floor progression, and save format; usable without the DOM.
- `game.js`: controller, touch/keyboard/pointer input, interface, audio, and browser persistence.
- `renderer3d.js`: Three.js scene, textures, lighting, architecture, camera, raycasting, effects, and world labels.
- `models3d.js`: original creature geometry, articulation, animation, surface batching, and statue transformation.
- `vendor/`: Three.js 0.180.0 modules and its MIT license, bundled locally.
- `test-models.mjs`: geometry and animation checks without a graphics context.
- `style.css`: responsive interface and touch layouts.
- `test.cjs`: gameplay regression checks using Node's built-in assertions.

Run:

```sh
node --check sway/engine.js
node --check sway/game.js
node --check sway/renderer3d.js
node --check sway/models3d.js
node sway/test.cjs
node sway/test-models.mjs
```

The checks cover active hostile recruitment, dodge continuity, tether interruption, capture targeting and existing shots, statue collision and damage reduction, sanctuary rewards, a 240-creature floor transition, corridor navigation, deterministic save restoration, connected routes, corrupt-save rejection, and single-use floor upgrades. The 3D asset checks validate all eight character models, finite geometry, their animated rigs, statue material changes, and allegiance feedback. Browser checks exercise the WebGL renderer separately: recruitment while dodging, reload and follower recovery, formation placement, camera controls, and responsive layouts. Physical phone frame rates and extreme WebGL horde sizes have not been benchmarked.

## Visual reference and dependencies

The [original FATE on Steam](https://store.steampowered.com/app/246840/FATE/) and [WildTangent’s FATE screenshots](https://www.wildtangent.com/p/action/fate/) informed the overhead dungeon-crawler direction. Sway’s models, textures, UI, and effects are generated from its own source. Three.js 0.180.0 was obtained from the official npm package; its license is preserved in `vendor/THREE-LICENSE.txt`.
