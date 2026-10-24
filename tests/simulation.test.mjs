import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { resolve } from "node:path";
import { segmentHit } from "../shared/core.js";
const bundled = await build({
  entryPoints: ["src/simulation.ts"],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  alias: { "@coded-design/dom-virus": resolve("shared/core.js") },
});
const { createGame } = await import(
  "data:text/javascript;base64," +
    Buffer.from(bundled.outputFiles[0].text).toString("base64")
);
const rect = (left, top, width, height) => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
  width,
  height,
});
const intersect = (p, r, radius = 0) =>
  p.x + radius >= r.left &&
  p.x - radius <= r.right &&
  p.y + radius >= r.top &&
  p.y - radius <= r.bottom;
function fixture({
  baseRect = rect(470, 360, 60, 30),
  walls = [],
  glyphs = [],
  battle = { mode: "conquest", fortifications: false },
} = {}) {
  const events = [];
  const base = {
    id: "outpost",
    health: 100,
    maxHealth: 100,
    visible: true,
    rect: baseRect,
  };
  const api = {
    width: 1000,
    height: 800,
    time: 0,
    options: {},
    reducedMotion: true,
    firing: false,
    input: {
      keys: new Set(),
      pointer: { x: 500, y: 375, active: false },
      mode: "keyboard",
      fire: false,
    },
    random: () => 0.5,
    burst() {},
    popup() {},
    emit: (type, data) => events.push({ type, ...data }),
    finish: (won) => (api.finished = won),
    board: {
      targets: [base],
      glyphs,
      resetTargets(n) {
        base.health = base.maxHealth = n;
      },
      near(x, y, radius) {
        return glyphs.filter(
          (g) => !g.spent && intersect({ x, y }, g.rect, radius),
        );
      },
      consume(g) {
        if (g.spent) return false;
        g.spent = true;
        return true;
      },
      damage(t, n) {
        t.health = Math.max(0, t.health - n);
        return true;
      },
      hitSegment(a, b) {
        let hit = null;
        for (const glyph of glyphs) {
          if (glyph.spent) continue;
          const t = segmentHit(a, b, glyph.rect);
          if (t !== null && (!hit || t < hit.t)) hit = { glyph, t };
        }
        return hit;
      },
    },
  };
  const terrain = { walls, refresh() {}, invalidate() {} };
  const game = createGame(api, terrain, battle);
  game.reset();
  const tick = (n = 1) => {
    for (let i = 0; i < n; i++) {
      api.time += 0.02;
      game.update(0.02);
    }
  };
  return { api, base, game, events, tick, terrain };
}
test("starting a round and resetting preserves bounded, empty state", () => {
  const { game, api, tick } = fixture();
  api.firing = true;
  tick(200);
  assert.ok(game.snapshot().shells <= 120);
  assert.ok(game.snapshot().alive <= 32);
  game.reset();
  assert.equal(game.snapshot().armor, 100);
  assert.equal(game.snapshot().captured, 0);
  assert.equal(game.snapshot().shells, 0);
  assert.equal(game.snapshot().cannon, 1);
});
test("shoot, disable, occupy, capture, and win without spawning from disabled bases", () => {
  const { api, base, game, events, tick } = fixture();
  api.firing = true;
  tick(70);
  assert.equal(base.health, 0);
  assert.equal(events.filter((e) => e.type === "base-disabled").length, 1);
  api.firing = false;
  api.input.keys.add("ArrowUp");
  tick(49);
  api.input.keys.clear();
  tick(40);
  assert.equal(game.snapshot().captured, 1);
  assert.equal(api.finished, true);
  assert.equal(events.filter((e) => e.type === "spawn").length, 0);
});
test("hard cover prevents shell damage and tank tunneling", () => {
  const { api, base, game, tick } = fixture({
    walls: [rect(0, 480, 1000, 10)],
  });
  api.firing = true;
  api.input.keys.add("ArrowUp");
  tick(100);
  assert.equal(base.health, 100);
  assert.ok(
    game.snapshot().player.y >= 500 - 0.01,
    "tank stops before the wall",
  );
});
test("letters block tanks until consumed; binary rubble is traversable", () => {
  const glyphs = [{ spent: false, rect: rect(0, 490, 1000, 10) }];
  const { api, game, tick } = fixture({ glyphs });
  api.input.keys.add("ArrowUp");
  tick(25);
  assert.ok(game.snapshot().player.y >= 510 - 0.01);
  api.board.consume(glyphs[0]);
  tick(20);
  assert.ok(game.snapshot().player.y < 490);
});
test("capture requires sustained occupation, not shell damage alone", () => {
  const { base, game, tick } = fixture();
  base.health = 0;
  tick(200);
  assert.equal(game.snapshot().captured, 0);
  assert.equal(game.snapshot().alive, 0);
});
test("removed bases are removed from the win condition", () => {
  const { api, game, tick } = fixture();
  api.board.targets = [];
  tick();
  assert.equal(game.snapshot().bases, 0);
  assert.equal(api.finished, undefined);
});
test("scrolling relocates player into visible free ground and shifts combat entities", () => {
  const { game, tick } = fixture();
  game.scroll(0, 900);
  tick();
  assert.ok(game.snapshot().player.y > 0);
  assert.ok(game.snapshot().player.y < 800);
});
test("shots cannot pass through nearer cover to hit a base", () => {
  const { api, base, tick } = fixture({ walls: [rect(480, 420, 40, 12)] });
  api.firing = true;
  tick(100);
  assert.equal(base.health, 100);
});
test("clear, empty pages remain playable without inventing hostile bases", () => {
  const { api, game, tick } = fixture();
  api.board.targets = [];
  game.reset();
  api.firing = true;
  tick(500);
  assert.equal(game.snapshot().alive, 0);
  assert.equal(game.snapshot().bases, 0);
  assert.ok(game.snapshot().shells <= 120);
});
test("enemy tanks spawn, shoot, damage armor, and end an undefended round", () => {
  const { game, api, events, tick } = fixture();
  tick(2000);
  assert.ok(events.some((e) => e.type === "spawn"));
  assert.equal(game.snapshot().armor, 0);
  assert.equal(api.finished, false);
  assert.ok(game.snapshot().alive <= 32);
  assert.ok(game.snapshot().shells <= 120);
});
test("a shell opens a crater, awards letters once, and advances the cannon", () => {
  const glyphs = Array.from({ length: 24 }, (_, i) => ({
    spent: false,
    rect: rect(488 + i, 460, 1, 12),
  }));
  const { api, game, events, tick } = fixture({ glyphs });
  api.board.targets = [];
  api.firing = true;
  tick(20);
  assert.equal(glyphs.filter((g) => g.spent).length, 24);
  assert.equal(game.snapshot().cannon, 2);
  assert.equal(events.filter((e) => e.type === "cannon-upgrade").length, 1);
  assert.ok(game.snapshot().score >= 120);
  const xp = game.snapshot().xp;
  api.firing = false;
  tick(10);
  assert.equal(game.snapshot().xp, xp);
});
test("captured bases repair armor and fire on remaining enemies", () => {
  const { api, base, game, tick } = fixture();
  tick(320);
  const injured = game.snapshot().armor;
  assert.ok(injured < 100);
  const p = game.snapshot().player;
  base.health = 0;
  base.rect = rect(p.x - 30, p.y - 15, 60, 30);
  api.board.targets.push({
    id: "other",
    health: 100,
    maxHealth: 100,
    visible: false,
    rect: rect(20, 20, 60, 30),
  });
  tick(100);
  assert.equal(game.snapshot().captured, 1);
  assert.ok(game.snapshot().armor > injured);
  tick(300);
  assert.ok(game.snapshot().kills > 0, "friendly base destroys an enemy");
});
test("shrinking the viewport redeploys the tank into visible terrain", () => {
  const { api, game, tick } = fixture();
  api.width = 360;
  api.height = 400;
  tick();
  const p = game.snapshot().player;
  assert.ok(p.x >= 14 && p.x <= 346);
  assert.ok(p.y >= 14 && p.y <= 386);
});

test("siege prepares, then deploys squads instead of single tanks", () => {
  const { game, events, tick } = fixture({ battle: { fortifications: false } });
  tick(199);
  assert.equal(game.snapshot().phase, "prepare");
  assert.equal(game.snapshot().alive, 0);
  tick(20);
  assert.equal(game.snapshot().wave, 1);
  assert.ok(game.snapshot().alive >= 2);
  assert.ok(events.some((e) => e.type === "wave-start"));
});
test("walls absorb shells before the button and a breached wall stays destroyed", () => {
  const { api, base, game, tick } = fixture({ battle: { mode: "conquest" } });
  assert.equal(game.snapshot().barriers, 4);
  api.firing = true;
  tick(20);
  assert.equal(base.health, 100);
  tick(20);
  assert.equal(game.snapshot().barriers, 3);
  tick(60);
  assert.equal(base.health, 0);
  api.firing = false;
  tick(20);
  assert.equal(game.snapshot().barriers, 3);
});
test("construction reserves scrap, completes once, and blocks repeated commands", () => {
  const { game, tick, events } = fixture();
  game.action("cover");
  assert.equal(game.snapshot().scrap, 14);
  assert.equal(game.snapshot().building, "cover");
  game.action("pillbox");
  assert.equal(game.snapshot().scrap, 14);
  tick(34);
  assert.equal(game.snapshot().cover, 1);
  assert.equal(game.snapshot().building, null);
  assert.equal(events.filter((e) => e.type === "structure-built").length, 1);
});
test("blocked construction never spends scrap", () => {
  const { game, api, tick } = fixture({ walls: [rect(470, 495, 60, 20)] });
  game.action("cover");
  assert.equal(game.snapshot().scrap, 16);
  assert.equal(game.snapshot().building, null);
  api.board.targets = [];
  tick();
  game.reset();
  assert.equal(game.snapshot().cover, 0);
});
test("a moving obstacle cancels a pending build and refunds exactly its cost", () => {
  const { game, terrain, tick } = fixture();
  game.action("pillbox");
  assert.equal(game.snapshot().scrap, 8);
  terrain.walls.push(rect(480, 490, 40, 40));
  tick(34);
  assert.equal(game.snapshot().scrap, 16);
  assert.equal(game.snapshot().pillboxes, 0);
});
test("cover blocks tank movement and can be shot apart to reopen the path", () => {
  const { game, api, tick } = fixture();
  game.action("cover");
  tick(34);
  api.input.keys.add("ArrowUp");
  tick(20);
  assert.ok(game.snapshot().player.y >= 524);
  api.input.keys.clear();
  api.firing = true;
  tick(85);
  assert.equal(game.snapshot().cover, 0);
});
test("a pillbox leads moving enemies and earns salvage for its kills", () => {
  const { game, tick } = fixture();
  game.action("pillbox");
  tick(400);
  assert.ok(game.snapshot().kills > 0);
  assert.ok(game.snapshot().scrap >= 10);
});
test("mines trigger on hostile tanks and are removed after detonation", () => {
  const { game, tick, events } = fixture();
  game.action("mine");
  tick(600);
  assert.ok(events.some((e) => e.type === "mine-detonated"));
  assert.equal(game.snapshot().mines, 0);
  assert.ok(game.snapshot().kills > 0);
});
test("capturing the last base keeps siege alive and moves spawning to the page edges", () => {
  const { api, base, game, tick, events } = fixture({
    battle: { fortifications: false },
  });
  base.health = 0;
  api.input.keys.add("ArrowUp");
  tick(49);
  api.input.keys.clear();
  tick(40);
  assert.equal(game.snapshot().captured, 1);
  assert.equal(api.finished, undefined);
  tick(130);
  assert.ok(
    events.some((e) => e.type === "spawn" && e.base === "reinforcement"),
  );
});
test("Recall/reset state drops all player structures and restarts wave resources", () => {
  const { game, tick } = fixture({ battle: { fortifications: false } });
  game.action("cover");
  tick(34);
  assert.equal(game.snapshot().cover, 1);
  game.reset();
  assert.equal(game.snapshot().cover, 0);
  assert.equal(game.snapshot().scrap, 16);
  assert.equal(game.snapshot().phase, "prepare");
  assert.equal(game.snapshot().wave, 1);
});

test("unaffordable construction cannot overdraw scrap", () => {
  const { game, api, tick } = fixture();
  api.board.targets = [];
  tick();
  game.action("pillbox");
  tick(34);
  api.input.keys.add("ArrowRight");
  tick(32);
  api.input.keys.clear();
  tick();
  game.action("pillbox");
  tick(34);
  assert.equal(game.snapshot().scrap, 0);
  game.action("cover");
  assert.equal(game.snapshot().building, null);
  assert.equal(game.snapshot().scrap, 0);
  assert.equal(game.snapshot().cover, 0);
});

test("scrap airdrops can be collected by driving over their landing site", () => {
  const { api, game, tick, events } = fixture();
  api.board.targets = [];
  tick(450);
  assert.equal(game.snapshot().supplies, 1);
  assert.equal(game.snapshot().scrap, 16);
  api.input.keys.add("ArrowRight");
  tick(29);
  api.input.keys.clear();
  api.input.keys.add("ArrowUp");
  tick(23);
  api.input.keys.clear();
  assert.equal(game.snapshot().scrap, 22);
  assert.equal(game.snapshot().supplies, 0);
  assert.equal(events.filter((e) => e.type === "supply-collected").length, 1);
  game.reset();
  assert.equal(game.snapshot().supplies, 0);
});
