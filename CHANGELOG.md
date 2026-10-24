# Changelog

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
