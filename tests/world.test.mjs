// The rules, headless: 0.x's simulation tests, ported to the world, plus determinism.
import test from "node:test";
import assert from "node:assert/strict";
import * as W from "../src/world.ts";
import { fixture, glyphRow, rect, script, snap, target } from "./fixture.mjs";

const count = (events, type) => events.filter((e) => e.type === type).length;

test("starting a round and resetting preserves bounded, empty state", () => {
  const { w, tick, fire } = fixture();
  fire(true);
  tick(200);
  assert.ok(snap(w).shells <= 120);
  assert.ok(snap(w).alive <= 32);
  w.reset();
  const s = snap(w);
  assert.equal(s.armor, 100);
  assert.equal(s.captured, 0);
  assert.equal(s.shells, 0);
  assert.equal(s.cannon, 1);
});
test("shoot, disable, occupy, capture, and win without spawning from disabled bases", () => {
  const { w, base, events, tick, keys, fire } = fixture();
  fire(true);
  tick(70);
  assert.equal(base.hp, 0);
  assert.equal(count(events, "base-disabled"), 1);
  fire(false);
  keys(0, -1);
  tick(49);
  keys(0, 0);
  tick(40);
  assert.equal(snap(w).captured, 1);
  assert.equal(w.s[W.OVER], 2, "won");
  assert.equal(count(events, "spawn"), 0);
});
test("hard cover prevents shell damage and tank tunneling", () => {
  const { w, base, tick, keys, fire } = fixture({ walls: [rect(0, 480, 1000, 10)] });
  fire(true);
  keys(0, -1);
  tick(100);
  assert.equal(base.hp, 100);
  assert.ok(snap(w).player.y >= 500 - 0.01, "tank stops before the wall");
});
test("letters block tanks until consumed; binary rubble is traversable", () => {
  const { w, board, tick, keys } = fixture({ glyphs: [rect(0, 490, 1000, 10)] });
  keys(0, -1);
  tick(25);
  assert.ok(snap(w).player.y >= 510 - 0.01);
  board.consume(0);
  tick(20);
  assert.ok(snap(w).player.y < 490);
});
test("capture requires sustained occupation, not shell damage alone", () => {
  const { w, base, tick } = fixture();
  base.hp = 0;
  tick(200);
  assert.equal(snap(w).captured, 0);
  assert.equal(snap(w).alive, 0);
});
test("removed bases are removed from the win condition", () => {
  const { w, board, tick } = fixture();
  board.targets = [];
  tick();
  assert.equal(snap(w).bases, 0);
  assert.equal(w.s[W.OVER], 0);
});
test("scrolling relocates player into visible free ground and shifts combat entities", () => {
  const { w, tick } = fixture();
  w.scroll(0, 900);
  tick();
  assert.ok(snap(w).player.y > 0);
  assert.ok(snap(w).player.y < 800);
});
test("shots cannot pass through nearer cover to hit a base", () => {
  const { base, tick, fire } = fixture({ walls: [rect(480, 420, 40, 12)] });
  fire(true);
  tick(100);
  assert.equal(base.hp, 100);
});
test("clear, empty pages remain playable without inventing hostile bases", () => {
  const { w, board, tick, fire } = fixture();
  board.targets = [];
  w.sync(board.targets);
  w.reset();
  fire(true);
  tick(500);
  assert.equal(snap(w).alive, 0);
  assert.equal(snap(w).bases, 0);
  assert.ok(snap(w).shells <= 120);
});
test("enemy tanks spawn, shoot, damage armor, and end an undefended round", () => {
  const { w, events, tick } = fixture();
  tick(2000);
  assert.ok(count(events, "spawn") > 0);
  assert.equal(snap(w).armor, 0);
  assert.equal(w.s[W.OVER], 1, "lost");
  assert.ok(snap(w).alive <= 32);
  assert.ok(snap(w).shells <= 120);
});
test("a shell opens a crater, awards letters once, and advances the cannon", () => {
  const glyphs = Array.from({ length: 24 }, (_, i) => rect(488 + i, 460, 1, 12));
  const { w, board, events, tick, fire } = fixture({ glyphs });
  board.targets = [];
  fire(true);
  tick(20);
  assert.equal(board.spent.reduce((a, b) => a + b, 0), 24);
  assert.equal(snap(w).cannon, 2);
  assert.equal(count(events, "level"), 1, "one cannon upgrade");
  assert.ok(snap(w).score >= 120);
  const xp = snap(w).xp;
  fire(false);
  tick(10);
  assert.equal(snap(w).xp, xp);
});
test("captured bases repair armor and fire on remaining enemies", () => {
  const { w, base, board, tick } = fixture();
  tick(320);
  const injured = snap(w).armor;
  assert.ok(injured < 100);
  const p = snap(w).player;
  base.hp = 0;
  Object.assign(base, { x: p.x - 30, y: p.y - 15, w: 60, h: 30 });
  board.targets.push({ ...target(rect(20, 20, 60, 30), "other"), w: 0, h: 0 });
  tick(100);
  assert.equal(snap(w).captured, 1);
  assert.ok(snap(w).armor > injured);
  tick(300);
  assert.ok(snap(w).kills > 0, "friendly base destroys an enemy");
});
test("shrinking the viewport redeploys the tank into visible terrain", () => {
  const { w, tick } = fixture();
  w.s[W.W] = 360;
  w.s[W.H] = 400;
  tick();
  const p = snap(w).player;
  assert.ok(p.x >= 14 && p.x <= 346);
  assert.ok(p.y >= 14 && p.y <= 386);
});
test("siege prepares, then deploys squads instead of single tanks", () => {
  const { w, events, tick } = fixture({ battle: { fortifications: false } });
  tick(199);
  assert.equal(snap(w).phase, "prepare");
  assert.equal(snap(w).alive, 0);
  tick(20);
  assert.equal(snap(w).wave, 1);
  assert.ok(snap(w).alive >= 2);
  assert.ok(count(events, "wave:start") > 0);
});
test("walls absorb shells before the button and a breached wall stays destroyed", () => {
  const { w, base, tick, fire } = fixture({ battle: { mode: "conquest" } });
  assert.equal(snap(w).barriers, 4);
  fire(true);
  tick(20);
  assert.equal(base.hp, 100);
  tick(20);
  assert.equal(snap(w).barriers, 3);
  tick(60);
  assert.equal(base.hp, 0);
  fire(false);
  tick(20);
  assert.equal(snap(w).barriers, 3);
});
test("construction reserves scrap, completes once, and blocks repeated commands", () => {
  const { w, tick, act, events } = fixture();
  act("cover");
  assert.equal(snap(w).scrap, 14);
  assert.equal(snap(w).building, "cover");
  act("pillbox");
  assert.equal(snap(w).scrap, 14);
  tick(34);
  assert.equal(snap(w).cover, 1);
  assert.equal(snap(w).building, null);
  assert.equal(count(events, "structure-built"), 1);
});
test("blocked construction never spends scrap", () => {
  const { w, board, tick, act } = fixture({ walls: [rect(470, 495, 60, 20)] });
  act("cover");
  assert.equal(snap(w).scrap, 16);
  assert.equal(snap(w).building, null);
  board.targets = [];
  tick();
  w.reset();
  assert.equal(snap(w).cover, 0);
});
test("a moving obstacle cancels a pending build and refunds exactly its cost", () => {
  const { w, tick, act, setWalls } = fixture();
  act("pillbox");
  assert.equal(snap(w).scrap, 8);
  setWalls([rect(480, 490, 40, 40)]);
  tick(34);
  assert.equal(snap(w).scrap, 16);
  assert.equal(snap(w).pillboxes, 0);
});
test("cover blocks tank movement and can be shot apart to reopen the path", () => {
  const { w, tick, act, keys, fire } = fixture();
  act("cover");
  tick(34);
  keys(0, -1);
  tick(20);
  assert.ok(snap(w).player.y >= 524);
  keys(0, 0);
  fire(true);
  tick(85);
  assert.equal(snap(w).cover, 0);
});
test("a pillbox leads moving enemies and earns salvage for its kills", () => {
  const { w, tick, act } = fixture();
  act("pillbox");
  tick(400);
  assert.ok(snap(w).kills > 0);
  assert.ok(snap(w).scrap >= 10);
});
test("mines trigger on hostile tanks and are removed after detonation", () => {
  const { w, tick, act, events } = fixture();
  act("mine");
  tick(600);
  assert.ok(count(events, "mine-detonated") > 0);
  assert.equal(snap(w).mines, 0);
  assert.ok(snap(w).kills > 0);
});
test("capturing the last base keeps siege alive and moves spawning to the page edges", () => {
  const { w, base, tick, keys, events } = fixture({ battle: { fortifications: false } });
  base.hp = 0;
  keys(0, -1);
  tick(49);
  keys(0, 0);
  tick(40);
  assert.equal(snap(w).captured, 1);
  assert.equal(w.s[W.OVER], 0);
  tick(130);
  assert.ok(events.some((e) => e.type === "spawn" && e.a === -1), "a reinforcement from the edge");
});
test("Recall/reset state drops all player structures and restarts wave resources", () => {
  const { w, tick, act } = fixture({ battle: { fortifications: false } });
  act("cover");
  tick(34);
  assert.equal(snap(w).cover, 1);
  w.reset();
  assert.equal(snap(w).cover, 0);
  assert.equal(snap(w).scrap, 16);
  assert.equal(snap(w).phase, "prepare");
  assert.equal(snap(w).wave, 1);
});
test("unaffordable construction cannot overdraw scrap", () => {
  const { w, board, tick, act, keys } = fixture();
  board.targets = [];
  tick();
  act("pillbox");
  tick(34);
  keys(1, 0);
  tick(32);
  keys(0, 0);
  tick();
  act("pillbox");
  tick(34);
  assert.equal(snap(w).scrap, 0);
  act("cover");
  assert.equal(snap(w).building, null);
  assert.equal(snap(w).scrap, 0);
  assert.equal(snap(w).cover, 0);
});
test("scrap airdrops can be collected by driving over their landing site", () => {
  const { w, board, tick, keys, events } = fixture();
  board.targets = [];
  tick(450);
  assert.equal(snap(w).supplies, 1);
  assert.equal(snap(w).scrap, 16);
  keys(1, 0);
  tick(29);
  keys(0, -1);
  tick(23);
  keys(0, 0);
  assert.equal(snap(w).scrap, 22);
  assert.equal(snap(w).supplies, 0);
  assert.equal(count(events, "drop:collect"), 1);
  w.reset();
  assert.equal(snap(w).supplies, 0);
});

test("same seed, same inputs: the same run (multiplayer-ready)", () => {
  const trace = () => {
    const t = fixture({ battle: { fortifications: true }, glyphs: glyphRow(200), random: false, seed: 21 });
    const each = script(t), out = [];
    t.tick(1500, (k) => (each(k), k % 100 === 0 && out.push(snap(t.w).score, t.w.tanks.x[W.P], t.w.tanks.count, t.w.shells.count)));
    return out;
  };
  const a = trace();
  assert.deepEqual(trace(), a);
  assert.ok(a.some((v, i) => i % 4 === 2 && v > 0), "tanks came");
});
