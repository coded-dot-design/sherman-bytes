# Changelog

## 1.0.0: on Fizlet

The engine cut (DOM VIRUS ENGINE.md E3): Sherman Bytes runs on Fizlet 0.13.0 instead of the DOM VIRUS core snapshot. Same game, same numbers; the controller API (`createShermanBytes`, start/pause/resume/stop/destroy/getSnapshot) and the snapshot fields are unchanged.

- **The rules are one Fizlet system** (`src/world.ts`), DOM-free, on typed arrays: tanks (yours is the last slot), shells, bases, walls and builds, hard cover. A step never allocates (tested: 20,000 busy steps with waves, builds, mines and pillboxes, no minor GC) and the same seed with the same inputs replays the same run (tested). The step queries the page through board-page's typed forms (`hitAt`, `nearAt`, new in Fizlet 0.13.0), because a number passed to a call V8 doesn't inline boxes.
- **Bricks:** the wave clock and the airdrops are `fizlet/rules` `waves` and `drops` (the core's WaveDirector and SupplyDrops numbers; the wave clock still steps only in siege with bases on the page, and squads of up to three still rest between spawns); score, XP and the cannon tiers are `score` (levels at 20 and 60 XP).
- **The shell is `fizlet/arcade`**, shared with Null Invaders and Byte Runner. Base walls, status and capture progress are drawn in the buttons and hard cover is outlined in place through the arcade's `attach` (ledger-owned: Recall removes them and puts the elements' style back). `src/game.ts` is only the game's definition.
- **Scoreboard in the Board UI kit:** score, wave, armor and scrap (folded: score, armor, scrap), the cannon meter, the Cover / Pillbox / Mine keys and a comms toast for waves. The phone stick, Fire and build keys are the kit's pad.
- **Tests:** 0.5.2's 25 simulation tests, ported to the world unchanged in what they check, plus determinism and zero allocation in Node; the built package in Chromium (bases and their walls, hard cover, firing into the page, driving, building, links and fields, pause, Recall restores the page byte for byte, frame time, game over, failed start, phone stick). CI runs on ubuntu-24.04.
- **Removed:** `shared/` (the core snapshot), `src/simulation.ts`, `src/terrain.ts` and `src/base-presentation.ts` (now in `src/world.ts` and `src/game.ts`), and the `binaryStyle`, `binaryOpacity`, `targetEffects` and `document` options. Bases show their health as a level inside the button (the shell's paint: a full green button at full health) and a beacon ring.
- **Size:** `dist/index.js` is 32,468 B gzip (budget 33,000 B); 0.5.2 was 26,994 B. The Board UI kit's CSS is 3,064 B of it: without it the build is 29,404 B (+2,410 B over 0.5.2: the typed-array rules are longer source than the object version, and the shared shell is general).

## 0.5.2

Mobile: the arrow D-pad becomes the shared analog thumbstick (8-way drive, deadzone + hysteresis); Fire is Battlefield's round crosshair button and Cover, Pillbox and Mine are 3D arcade buttons that act on press. Drive and Fire can be held together. Uses the dom-virus engine 0.21.0 snapshot; the gzip budget grows by 2 KB for the shared controls.

## 0.5.0

Add mobile Cover, Pillbox and Mine controls beside movement/fire. Add synthesized battle cues and shared scoreboard controls; count structures without temporary snapshot arrays.

## 0.4.4

- Keep native 0/1 highlight text bright with a transparent background, so light page surfaces show through.

## 0.4.3

- Use a balanced flat palette for tanks, shells, native base effects, binary text and the site. Retain raised buttons and native scrolling behavior.

## 0.4.2

- Native base walls, capture labels and cover outlines follow their real elements. Brighter tank graphics, green binary highlights and corrected keyboard ownership.
- Native element-owned fortifications add about 1.2 kB gzip; the distribution ceiling is now 24 kB (the complete ESM and React builds measure about 23 kB).

## 0.4.1

- Reversible mobile pinch/double-tap zoom lock while playing; native scrolling remains available. Pause and Recall restore the host policy. Set `lockZoom: false` to opt out.

## 0.4.0

- Independent touch D-pad and hold-to-fire controls, compact mobile scoreboard with expanded results, colored native bit highlights, and abstract site previews. Shared engine 0.9.0.

- Adopt engine 0.8.0: native target-attached beacons, quieter mobile fills, fewer board rescans and one reusable collision measurement Range.
- Preserve real text mutation and conditional Recall; pause/cancel native effects with the game lifecycle.

## 0.3.0

- Replace actual DOM text with literal 0/1 on every consumed letter; remove visual-only canvas substitution. Byte Runner leaves binary instead of erased spaces.
- Track original and latest owned Text values for Recall, preserving newer host updates and existing node identity.
- Adopt engine 0.7.0: fewer layout reads for spent text, no binary canvas, optional fading of real digits, and no CSS Highlights requirement.
- Update the integration guide and technical page to describe actual mutation and layout refresh.

## 0.2.0

- Add escalating siege squads, wave completion rewards and eight-second fortification breaks. Keep the original win condition as `mode: "conquest"`.
- Add destructible button walls, scrap, a construction engineer, buildable cover, leading pillboxes and proximity mines.
- Raise bounded pools to 32 tanks and 120 shells. Preserve player movement and turret controls.
- Adopt engine 0.6.0 optional action controls and shared wave scheduling. Add simulation regression coverage for construction, collisions and resource accounting.
- Refresh the shared Astro page with game-derived character art, neutral light surfaces and a distinct engineering section. Archive v0.1.0 for comparison.

## 0.1.0

- Original M4-inspired tank sprites, turret aiming, recoil and pooled combat.
- Destructible glyph terrain, optional hard cover, button capture and friendly repair/turrets.
- Three cannon tiers, bounded enemy waves, winning and losing conditions, Recall.
- Independent TypeScript/ESM/React package, Astro page, Vite proving ground and checked Pages workflow.
