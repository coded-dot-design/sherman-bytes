# Sherman Bytes

**Every page is a battlefield.** Created by **Chris Cooley / coded.design**. MIT licensed.

An independent, original, single-player DOM tank game inspired by the terrain, base capture and resupply ideas of Stuart Cheshire’s Bolo. Original pixel art; no Bolo code or assets.

## Run locally

Use Node 24 (also recorded in `.nvmrc`). From this repository:

```sh
npm ci
npm run dev
```

Open the exact URL printed by Astro. Press **Play Sherman Bytes**. `npm run dev:playground` opens the smaller Vite proving ground. Both run from a standalone clone; sibling repositories are optional.

## Play

- WASD/arrows drive; mouse aims the turret. With keyboard-only controls, the turret follows the hull.
- Click/Space fires. P pauses. G jumps to a hostile base. Esc/Recall restores game-owned effects.
- Letters block movement and shells. Blast gaps into faint binary rubble you can cross.
- Buttons spawn tanks. Shoot a base down, then occupy it for 0.7 seconds to capture it.
- Captured bases stop spawning, repair armor while occupied, and defend against nearby tanks.
- Capture every base and destroy the remaining enemies to win. Zero armor ends the run.

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

Visual mode uses CSS Custom Highlights to conceal spent glyphs and paints binary in their original geometry with reduced opacity. Original text nodes remain intact. CSS Highlights are required in this mode. `domMode: "text"` is an explicit alternative for static content; it writes literal binary and does not fade individual letters. Recall restores still-owned writes and preserves newer host application changes.

## Performance and scope

Strict TypeScript; one runtime frame loop; 18 pooled enemy tanks; 80 pooled shells; 100 runtime particle slots; 24 score popups. The board uses cached glyph geometry and a spatial grid. Tank movement subdivides into <=4 px steps; projectiles use swept collision rays. Up to 32 opted-in hard-cover elements are measured at 4 Hz. Tread sprites are cached and reused. No box shadows or game framework.

The 22 kB gzip distribution budget is a checked ceiling, not a promised FPS. Run `npm run size` for actual measurements. This first release has three cannon tiers and original scout/heavy enemies. Multiplayer, mines and a construction drone are future features.

## Checks and hosting

```sh
npm run check
npm run size
npm run site:build
npm run site:preview
```

Astro renders the shared product page and measured technical notes. Enable **Settings → Pages → Source: GitHub Actions** once. Main pushes run checks before deploying `artifacts/site`. The default base path is `/sherman-bytes/`. `SITE_BASE=/` is for a root-mounted preview only.

CI tags tested package versions as `vX.Y.Z`; existing tags are never moved. The DOM VIRUS hub can pin those distributions and archive compatible older releases. Bump package and lockfile versions for runtime releases. Website-only changes do not require an npm release.

## Shared engine provenance

`shared/ORIGIN.json` records the built DOM VIRUS engine version and source fingerprint. Update through the hub’s selective synchronization scripts, then rebuild and test. Other game engines are unaffected by this repository.

## Inspiration

[Original Macintosh Bolo manual](https://web.archive.org/web/20070518053532/http://bishop.mc.duke.edu/bolo/guides/bolomanual/), Stuart Cheshire. Sherman Bytes is an independent coded.design project.
