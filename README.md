# Sherman Bytes

> **Play it and read about it on DOM Virus:** https://coded-dot-design.github.io/dom-virus/games/sherman-bytes/ — this README holds the full technical details.

**Every page is a battlefield.** Created by **Chris Cooley / coded.design**. MIT licensed.

An independent, original, single-player DOM tank game inspired by the terrain, base capture and resupply ideas of Stuart Cheshire’s Bolo. Original pixel art; no Bolo code or assets.

## Where the game lives

This repository is the game package. The game page lives on the DOM Virus hub at https://coded-dot-design.github.io/dom-virus/games/sherman-bytes/. This repository's Pages workflow only publishes a redirect to that page; there is no per-game site to build. The hub reads `site/game.json` (page copy) and `site/art.json` (tank art) from here and loads the tagged package.

## Run locally

Use Node 24 (see `.nvmrc`). From this repository:

```sh
npm ci
npm run dev:playground
```

Open the URL Vite prints (normally **http://127.0.0.1:5173**) and start the game. The playground in `playground/` is a fictional test page; it does not ship in the package. It runs from a standalone clone.

## Play

- WASD/arrows drive; mouse aims the turret. With keyboard-only controls, the turret follows the hull. On phones, an analog joystick drives and a round Fire button shoots.
- Click/Space fires. P pauses. G jumps to a hostile base. Esc/Recall restores game-owned effects.
- Letters block movement and shells. Blast gaps into faint binary rubble you can cross.
- Buttons spawn tanks. Shoot a base down, then occupy it for 0.7 seconds to capture it.
- Captured bases stop spawning, repair armor while occupied, and defend against nearby tanks.
- **B** builds cover (2 scrap), **T** a pillbox (8), **M** a mine (3). Aim at clear ground. The engineer takes 0.65 seconds; blocked jobs refund their cost.
- Earn scrap through combat, text clearing, captured bases and wave completion. Start with 16. Cover blocks friendly shots too: leave firing lanes.
- Siege waves arrive in squads, with an eight-second build break after you clear each wave. Capturing all bases moves reinforcements to the viewport edges. Zero armor ends the run.
- Set `mode: "conquest"` for the original capture-all victory condition. Set `fortifications: false` to omit the initial button walls.

## Embed

Registry publication is separate from GitHub releases. Build locally with `npm run build`, then `npm pack` to install the resulting tarball in another app. The standalone ESM entry contains the engine and game; React is an optional separate export.

```ts
import { createShermanBytes } from "@coded-design/sherman-bytes";
const game = createShermanBytes({
  root: "main",
  textSelector: "h1, h2, h3, p, li",
  targetSelector: "button, [data-base]",
  wallSelector: "[data-sherman-wall]",
  mode: "siege",
  fortifications: true,
});
game.start();
// At component teardown:
game.destroy();
```

```tsx
import { ShermanBytes } from "@coded-design/sherman-bytes/react";
<ShermanBytes active={playing} options={{ root: "main" }} />
```

Default targets include generic buttons/headings/paragraphs. Forms, editable content, live regions, dialogs and `data-virus-ignore` remain excluded. Hard cover is explicit: add `data-sherman-wall` to selected elements, or set `wallSelector`. Do not select full-page containers as walls.

Hits replace characters in the existing DOM Text nodes with literal 0 or 1. There are no canvas replacement letters, cloned text, or per-letter wrappers. The ownership ledger records the original and latest game-written value per node. Recall restores only still-owned values; newer host edits win. Changing a proportional-font letter into a digit can reflow text, so the bounded geometry cache is invalidated and refreshed.

## Performance and scope

Strict TypeScript; one Fizlet engine per run; the rules are one system on typed arrays (`src/world.ts`), so a step never allocates (tested: 20,000 busy steps, no minor GC) and the same seed with the same inputs replays the same run (tested); 32 pooled enemy tanks; 120 pooled shells; 100 runtime particle slots; 24 score popups. The board uses cached glyph geometry and a spatial grid. Tank movement subdivides into <=4 px steps; projectiles use swept collision rays. Up to 32 opted-in hard-cover elements are measured at 4 Hz. Tread sprites are cached and reused. No box shadows or game framework.

`dist/index.js` is **32,468 B gzip** and budgeted at 33,000 B (`npm run size`, `scripts/size.mjs`, fails the build above that); 0.5.2 on the DOM VIRUS core was 26,994 B. The Board UI kit's CSS (keys, readouts, toast, touch pad: the family's one button language) is 3,064 B of it; the same build without that CSS is 29,404 B. The budget is a checked ceiling, not a promised FPS. The wave clock (`fizlet/rules` waves) caps each wave at 40 enemies and active enemies at 32. Player construction is limited to 12 cover segments, four pillboxes and eight mines; button walls are bounded by the 32-base board cap. Construction and wave timing share the existing simulation clock and pause with the game. Three cannon tiers and original scout/heavy enemies remain. This is single-player; networking and base recapture are not implemented.

## Checks and releases

```sh
npm run check            # typecheck, unit tests, build, package types, vendor check
npm run size             # gzip sizes against the budget
npm run test:browser     # the built package in Chromium (CHROMIUM_PATH picks a binary)
npm run playground:build
```

CI runs the same checks on every push and tags tested package versions as `vX.Y.Z`; existing tags are never moved. The DOM VIRUS hub pins those tags. Bump `package.json`, the lockfile version and `CHANGELOG.md` together for a release. The hub reads `site/game.json` from the pinned tag, or from a separately pinned content commit, so copy can change without a game release.

## Engine

Sherman Bytes runs on [Fizlet](https://github.com/coded-dot-design/fizlet), the micro animation and game engine for the DOM. `src/world.ts` holds the rules; `src/game.ts` is the game's definition on `fizlet/arcade`, the shell shared with Null Invaders and Byte Runner (engine per run, page as the board, scoreboard, keys, touch pad, sound, sparks, popups and the controller). Waves, airdrops and score / XP are `fizlet/rules` bricks. `vendor/fizlet/` is a generated snapshot of Fizlet with its provenance in `vendor/fizlet/ORIGIN.json`; never edit it by hand: change Fizlet, then run `npm run sync` (from a sibling `fizlet` checkout) and rebuild.

## Inspiration

[Original Macintosh Bolo manual](https://dialup.party/~jolo/bolo/guides/bolomanual/), Stuart Cheshire. Sherman Bytes is an independent coded.design project.

A base's walls, its status and its capture progress are drawn in the button itself, and hard cover gets a dashed outline in place, so they follow the page's layout and scrolling natively. A base's health shows as a level inside the button and a beacon ring around it.

### Sound and controls

The scoreboard always keeps sound, pause/resume, minimize/expand and Recall in the same order. Sound uses quiet synthesized effects, starts after a real gesture and can be muted. Pause stops active voices; Recall closes audio and restores the page. Mobile movement and fire remain available while the scoreboard is minimized.
Cover (2 scrap), Pillbox (8) and Mine (3) buttons sit above Fire on mobile. The compact scoreboard keeps armor and scrap visible.
