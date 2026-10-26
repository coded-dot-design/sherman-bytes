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

Open the URL Vite prints (normally **http://127.0.0.1:5173**) and start the game. The playground in `playground/` is a fictional test page; it does not ship in the package. It runs from a standalone clone; with a sibling `dom-virus` checkout, Vite uses the live engine source instead of the `shared/` snapshot.

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
  binaryOpacity: 0.32,
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

Strict TypeScript; one runtime frame loop; 32 pooled enemy tanks; 120 pooled shells; 100 runtime particle slots; 24 score popups. The board uses cached glyph geometry and a spatial grid. Tank movement subdivides into <=4 px steps; projectiles use swept collision rays. Up to 32 opted-in hard-cover elements are measured at 4 Hz. Tread sprites are cached and reused. No box shadows or game framework.

`dist/index.js` and `dist/react.js` are each budgeted at 28 KB gzip; `npm run size` (`scripts/size.mjs`) fails the build above that. The budget is a checked ceiling, not a promised FPS. Run `npm run size` for actual measurements. The shared wave director caps each wave at 40 enemies and active enemies at 32. Player construction is limited to 12 cover segments, four pillboxes and eight mines; button walls are bounded by the 32-base board cap. Construction and wave timing share the existing simulation clock and pause with the game. Three cannon tiers and original scout/heavy enemies remain. This is single-player; networking and base recapture are not implemented.

## Checks and releases

```sh
npm run check            # typecheck, unit tests, build, package types
npm run size             # gzip sizes against the budget
npm run playground:build
```

CI runs the same checks on every push and tags tested package versions as `vX.Y.Z`; existing tags are never moved. The DOM VIRUS hub pins those tags. Bump `package.json`, the lockfile version and `CHANGELOG.md` together for a release. The hub reads `site/game.json` from the pinned tag, or from a separately pinned content commit, so copy can change without a game release.

## Shared engine provenance

`shared/ORIGIN.json` records the built DOM VIRUS engine version and source fingerprint. Update through the hub’s selective synchronization scripts, then rebuild and test. Other game engines are unaffected by this repository.

## Inspiration

[Original Macintosh Bolo manual](https://dialup.party/~jolo/bolo/guides/bolomanual/), Stuart Cheshire. Sherman Bytes is an independent coded.design project.

Target beacons now attach to their actual elements. Native layout handles their scrolling, clipping and transforms. Mobile uses stationary rings and stable fills. See the [shared DOM ownership design](https://github.com/coded-dot-design/dom-virus/blob/main/docs/dom-ownership.md).

### Sound and controls

The scoreboard always keeps sound, pause/resume, minimize/expand and Recall in the same order. Sound uses quiet synthesized effects, starts after a real gesture and can be muted. Pause stops active voices; Recall closes audio and restores the page. Mobile movement and fire remain available while the scoreboard is minimized.
Cover (2 scrap), Pillbox (8) and Mine (3) buttons sit above Fire on mobile. The compact scoreboard keeps armor and scrap visible.
