# 0.3.1

## 0.4.0

- Independent touch D-pad and hold-to-fire controls, compact mobile scoreboard with expanded results, colored native bit highlights, and abstract site previews. Shared engine 0.9.0.

- Adopt engine 0.8.0: native target-attached beacons, quieter mobile fills, fewer board rescans and one reusable collision measurement Range.
- Preserve real text mutation and conditional Recall; pause/cancel native effects with the game lifecycle.

# 0.3.0

- Replace actual DOM text with literal 0/1 on every consumed letter; remove visual-only canvas substitution. Byte Runner leaves binary instead of erased spaces.
- Track original and latest owned Text values for Recall, preserving newer host updates and existing node identity.
- Adopt engine 0.7.0: fewer layout reads for spent text, no binary canvas, optional fading of real digits, and no CSS Highlights requirement.
- Update the integration guide and technical page to describe actual mutation and layout refresh.

# 0.2.0

- Add escalating siege squads, wave completion rewards and eight-second fortification breaks. Keep the original win condition as `mode: "conquest"`.
- Add destructible button walls, scrap, a construction engineer, buildable cover, leading pillboxes and proximity mines.
- Raise bounded pools to 32 tanks and 120 shells. Preserve player movement and turret controls.
- Adopt engine 0.6.0 optional action controls and shared wave scheduling. Add simulation regression coverage for construction, collisions and resource accounting.
- Refresh the shared Astro page with game-derived character art, neutral light surfaces and a distinct engineering section. Archive v0.1.0 for comparison.

# 0.1.0

- Original M4-inspired tank sprites, turret aiming, recoil and pooled combat.
- Destructible glyph terrain, optional hard cover, button capture and friendly repair/turrets.
- Three cannon tiers, bounded enemy waves, winning and losing conditions, Recall.
- Independent TypeScript/ESM/React package, Astro page, Vite proving ground and checked Pages workflow.
