# Sherman Bytes: Phase 1 handoff

## Start here (for agents)

Sherman Bytes (`@coded-design/sherman-bytes`, `0.5.2`, MIT) is a Bolo-inspired tank game that
plays on a live web page: letters are terrain, buttons are fortified bases. It is an engine game
built on a DOM VIRUS engine snapshot (`0.21.0`) and is cartridge 01 on the hub. Its sprites are
also the owning source for DOM Battlefield's tanks. Ecosystem context is in the hub
[HANDOFF.md](https://github.com/coded-dot-design/dom-virus/blob/main/HANDOFF.md); next steps are in
[FUTURE.md](FUTURE.md). Play: https://coded-dot-design.github.io/dom-virus/games/sherman-bytes/

| Task | Where |
|---|---|
| Gameplay, enemy behaviour, waves, construction, scoring | `src/simulation.ts` |
| Caps, colours, cannon tiers | `src/rules.ts`; build costs/caps in `src/fortifications.ts` |
| Hard cover (`[data-sherman-wall]`) | `src/terrain.ts` (the only module that measures layout) |
| Base walls/capture UI on the real button | `src/base-presentation.ts` |
| Tank art (also reaches Battlefield) | `src/sprites.ts` |
| Keys, actions, hint, defaults | `src/index.ts` |
| Hub page copy, controls list, facts | `site/game.json` |
| Engine, touch kit, HUD, audio | not here: `dom-virus/src`, then `npm run sync:games` |
| Size budget | `scripts/size.mjs` |

**Invariants**

- Never edit `shared/` by hand. Change `dom-virus/src`, run `npm run sync:games` there, rebuild.
  CI fails on any drift in `dist/` or `shared/`.
- A release bumps `package.json`, both top-level version fields in `package-lock.json` and
  `CHANGELOG.md` together, with the rebuilt `dist/`. CI tags `v<version>`; update the hub pin in
  `dom-virus/games.json` only after the tag exists.
- Any button you add follows the 3D press rule (top over a hard base; hover lifts the top, press
  lands exactly on the base, selected stays pressed, no overshoot, no `scale()`).
- Hot paths move only transforms and opacity; no layout reads per frame or per `pointermove`.
  Simulation works on cached rectangles.
- Respect reduced motion (recoil is already zeroed under `api.reducedMotion`).
- Mobile must stay smooth: keep pools bounded and test late waves on a phone profile.
- After changing `src/sprites.ts`, Battlefield needs `node scripts/sync-shared.mjs` and a release.

**Verify before you push**

```sh
npm ci                  # Node 24 (.nvmrc); engines >= 22.23.4
npm run check           # typecheck, unit tests, build, package types
npm run size            # fails above 28,000 B gzip per file
npm run playground:build
git status              # dist/ must be committed and match the build
# Browser/touch tests live in the hub and use this sibling checkout:
cd ../dom-virus && CHROMIUM_PATH=/path/to/chrome npm run test:browser
```

## 1. The game

You drive an M4-inspired pixel tank, aim with the mouse, and fight enemy squads. Default
`mode: "siege"`: breach a base's walls, occupy it to capture (0.7 s), resupply scrap, build cover
(2), pillboxes (8) or mines (3), hold the next wave. `mode: "conquest"` keeps the capture-every-base
win. 32 pooled tanks, 120 shells, cannon tiers at 20/60 XP, build caps 12/4/8.

## 2. How it uses the DOM

- **Letters are terrain.** Hits write literal `0`/`1` into existing Text nodes (no spans or canvas
  letters); binary rubble is traversable. Recall restores still-owned text via the engine ledger.
- **Buttons and `[data-base]` are bases**, each with four destructible wall segments.
- **Hard cover is opt-in:** up to 32 `[data-sherman-wall]` elements, re-measured at 4 Hz, each
  outlined by a marker attached to the real element.
- Forms, editable content, dialogs and `[data-virus-ignore]` are excluded.

## 3. Architecture

`src/index.ts` calls the engine's `createArcade` with `capabilities.fire`, the B/T/M actions,
`binaryStyle: "native"` and `targetEffects: "liquid"`. `src/react.ts` wraps it with
`createGameComponent`. `shared/` (`core.js`, `react.js`, `types/`, `build-game.mjs`, `ORIGIN.json`
with version and SHA-256) is the engine snapshot; `scripts/build.mjs` just runs
`shared/build-game.mjs`. The repo hosts no site: `pages.yml` deploys a redirect to the hub page.

## 4. Controls

- **Keyboard/mouse:** WASD/arrows drive, mouse aims, click/Space fires; B/T/M build; P pause,
  G next hostile base, Esc Recall.
- **Mobile:** the shared engine touch kit: 8-way analog stick (deadzone, sector hysteresis), round
  Fire, and Cover/Pillbox/Mine as secondary arcade buttons that act on press. Drive and Fire can be
  held together; controls stay visible when the scoreboard is minimized.

## 5. Performance

One engine frame loop; bounded `EntityPool`s; swept shell rays; tank movement in ≤4 px substeps
with axis sliding; cached glyph geometry and spatial grid; tread frames cached per colour; waves
from the engine's shared director (≤40 per wave, ≤32 alive).

## 6. Size

Budget 28,000 B gzip each for `dist/index.js` and `dist/react.js`. At 0.5.2: 26,994 B and
27,084 B gzip (71,386 / 71,571 B raw). Raised from 26 KB in 0.5.2 for the touch kit.

## 7. Release

CI (`check.yml`): typecheck, test, build, test:package, size, playground:build,
`git diff --exit-code -- dist shared`; then `tag-version` tags `v<package.version>` on `main` once
and never moves a tag. Release steps are in the invariants above. The hub's hourly build already
follows the newest tag in the pinned major line; the pin is the reproducible record.

## 8. On the hub

Cartridge **01**, accent amber, "DOM TANK TACTICS". One action: PRESS START, then the screen morphs
into `/games/sherman-bytes/`. That page has "Swap to Battlefield" (`swapHref`: eject Sherman, plug
in Battlefield, press its A); Battlefield's info page swaps back. "TEST A RELEASE" offers `v0.1.0`.

## 9. Lessons and pitfalls

- Never select full-page containers as walls; they swallow the board.
- A digit replacing a proportional letter can reflow text; the geometry cache is invalidated after
  each mutation, so do not keep glyph rects across hits.
- Shells start inside the tank radius so the ray catches terrain touching the muzzle.
- Pillboxes lead moving targets; aiming at the current position misses orbiting scouts.
- Blocked or interrupted construction refunds exactly its cost (covered by tests).
- `tests/simulation.test.mjs` is the safety net for capture, cover, craters, scrolling, siege,
  construction, mines and Recall; extend it with any rule change.

## Keeping this file current

Update HANDOFF.md and FUTURE.md as part of any change that alters behaviour, architecture or
workflow. Every repo in the ecosystem keeps both files.
