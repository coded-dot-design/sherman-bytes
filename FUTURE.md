# Sherman Bytes: Future phases

Repo-specific items. The shared roadmap (controls layer, hub performance, hardening, platform) is
the hub [FUTURE.md](https://github.com/coded-dot-design/dom-virus/blob/main/FUTURE.md). Phase 1
state is in [HANDOFF.md](HANDOFF.md). Move items to `CHANGELOG.md` when they ship.

## Phase 2

### Controls layer (shared, top priority)

- Drop the per-game control wiring. Declare an intent map instead: `move` (8-way analog),
  `fire`, `secondary: [cover, pillbox, mine]`, plus the mouse-aim pointer intent, and let the
  shared controls layer render keyboard, gamepad and touch for each device.
- Keep B/T/M and P/G/Esc as keyboard defaults from the base layer rather than in `hint` strings.
- Pass analog stick magnitude through once the layer supports it (creep vs full throttle, as
  Battlefield already does), instead of arrow-key emulation.
- Consider a touch aim option (auto-aim nearest enemy, like Battlefield) since mobile aiming
  currently follows the hull.

### Gameplay

- Base recapture by enemies (the README lists it as not implemented).
- More enemy roles beyond scout and heavy (for example an engineer that repairs bases).
- Better feedback for blocked construction (show why a build was refunded).

### Performance and size

- Re-tighten the 28 KB gzip budget after the controls layer lands (the touch kit added ~2 KB).
- Profile `src/simulation.ts` (about 1,200 lines) on a low-end Android device during late waves
  with 32 tanks; consider splitting enemy behaviour and construction into modules for readability.

### Tests

- Add a browser smoke test in this repo (start, drive, fire, build, Recall) instead of relying
  only on the hub's engine browser tests.
- Cover the touch actions (Cover, Pillbox, Mine on press) and stick + Fire multi-touch.

### Accessibility

- Screen-reader announcements for capture, wave start and build results.
- A reduced-motion check for recoil, craters and liquid fills.

### Docs and content cleanup

- `README.md` still documents `npm run site:build` / `site:preview` and Astro Pages hosting, and
  quotes a 26 kB budget; the site was retired and the budget is now 28 KB.
- `site/game.json` controls and the "Your Sherman" character still say "arrows + fire" / "D-pad";
  mobile now uses the analog stick.

## Phase 3

- Shared entity adapter with DOM Battlefield, so Sherman squads, structures and scrap can appear
  on the Battlefield map without copying assets.
- Co-op or versus play (needs an authoritative transport; nothing is implemented today).
- Engine API docs and a worked "build a tank game" example using this repo as the reference.
