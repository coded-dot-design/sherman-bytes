// The test page and helpers the world tests share: a Fizlet engine stepped by hand (0.02 s steps,
// as 0.x's tests), a fake page (letters, one base) and hard cover as rects.
import { createEngine } from "../vendor/fizlet/index.ts";
import * as W from "../src/world.ts";

const KX = 4, KY = 5, FIRE = 6;
export const rect = (left, top, width, height) => ({ left, top, width, height });
/** A page: letters (rects) and targets. nearAt / hitAt like fizlet/board-page (circle, 2 px pad). */
export function page(glyphRects, targets) {
  const n = glyphRects.length, x = new Float64Array(n), y = new Float64Array(n), w = new Float64Array(n), h = new Float64Array(n), spent = new Uint8Array(n);
  glyphRects.forEach((r, i) => ((x[i] = r.left), (y[i] = r.top), (w[i] = r.width), (h[i] = r.height)));
  return {
    targets,
    spent,
    glyphs: { x, y, w, h },
    nearAt(p, at, out) {
      const px = p[at], py = p[at + 1], r = p[at + 2];
      let m = 0;
      for (let i = 0; i < n && m < out.length; i++) {
        if (spent[i]) continue;
        const dx = px - Math.max(x[i], Math.min(px, x[i] + w[i])), dy = py - Math.max(y[i], Math.min(py, y[i] + h[i]));
        if (dx * dx + dy * dy <= r * r) out[m++] = i;
      }
      return m;
    },
    hitAt(p, at) {
      // The slab test inline (a helper call would box its number arguments).
      const x0 = p[at], y0 = p[at + 1], dx = p[at + 2] - x0, dy = p[at + 3] - y0;
      let best = -1;
      p[at + 4] = 2;
      for (let i = 0; i < n; i++) {
        if (spent[i]) continue;
        let lo = 0, hi = 1;
        for (let ax = 0; ax < 2; ax++) {
          const s0 = ax ? y0 : x0, d = ax ? dy : dx, min = (ax ? y[i] : x[i]) - 2, max = min + (ax ? h[i] : w[i]) + 4;
          if (d) {
            const u = (min - s0) / d, v = (max - s0) / d;
            lo = Math.max(lo, u < v ? u : v);
            hi = Math.min(hi, u < v ? v : u);
          } else if (s0 < min || s0 > max) lo = 2;
        }
        if (lo <= hi && lo < p[at + 4]) (p[at + 4] = lo), (best = i);
      }
      return best;
    },
    consume(i) {
      if (spent[i]) return false;
      return (spent[i] = 1), true;
    },
  };
}
export const target = (r, id = "outpost") => ({ x: r.left, y: r.top, w: r.width, h: r.height, hp: 100, el: { id } });
export function fixture({ baseRect = rect(470, 360, 60, 30), walls = [], glyphs = [], battle = { mode: "conquest", fortifications: false }, seed = 7, random = true } = {}) {
  const e = createEngine({ seed, step: 0.02, events: 512 });
  // 0.x's tests ran with random() = 0.5 (no heavies early, no aim spread).
  if (random) e.random = () => 0.5;
  const base = target(baseRect);
  const board = page(glyphs, [base]);
  const pressed = { cover: 0, pillbox: 0, mine: 0 };
  const input = { hit: (id) => (pressed[id] ? ((pressed[id] = 0), true) : false) };
  const w = W.createWorld(e, board, new Float64Array(11), input, battle);
  w.s[W.W] = 1000;
  w.s[W.H] = 800;
  const setWalls = (list) => {
    list.forEach((r, i) => w.walls.rects.set([r.left, r.top, r.left + r.width, r.top + r.height], i * 4));
    w.walls.set(list.length);
  };
  setWalls(walls);
  w.reset();
  const events = [];
  const tick = (count = 1, each) => {
    for (let i = 0; i < count; i++) {
      each?.(i);
      w.sync(board.targets); // the read phase
      e.advance(0.02);
      for (let k = 0; k < e.events.size; k++) {
        const ev = e.events.at(k);
        events.push({ type: ev.type, a: ev.a, b: ev.b });
      }
    }
  };
  /** B / T / M: pressed, read by the next step (here a zero-length one, as 0.x's synchronous action). */
  const act = (id) => ((pressed[id] = 1), w.step(0));
  const keys = (kx, ky) => ((w.ctl[KX] = kx), (w.ctl[KY] = ky));
  const fire = (on) => (w.ctl[FIRE] = on ? 1 : 0);
  return { e, w, board, base, events, tick, act, keys, fire, setWalls, walls };
}
/** The snapshot fields the tests read (game.ts stats() computes the same). */
export function snap(w) {
  const k = w.structures, B = w.bases;
  let captured = 0, barriers = 0, cover = 0, pillboxes = 0, mines = 0;
  for (let b = 0; b < B.count; b++) if (B.captured[b]) captured++;
  for (let i = 0; i < k.count; i++) {
    if (k.hp[i] <= 0) continue;
    if (k.base[i] >= 0) barriers++;
    if (k.kind[i] === W.COVER) cover++;
    if (k.kind[i] === W.PILLBOX) pillboxes++;
    if (k.kind[i] === W.MINE) mines++;
  }
  return {
    shells: w.shells.count, alive: w.tanks.count, armor: Math.ceil(w.tanks.hp[W.P]), captured, bases: B.count, cannon: w.s[W.CANNON], xp: w.points.xp, score: w.points.points,
    scrap: w.s[W.SCRAP], building: w.s[W.BUILD] ? W.KINDS[w.s[W.BUILD]] : null, barriers, cover, pillboxes, mines, kills: w.s[W.KILLS], supplies: w.supplies.count,
    phase: w.siege ? w.wave.phase : "conquest", wave: w.siege ? w.wave.wave : 1, player: { x: w.tanks.x[W.P], y: w.tanks.y[W.P] },
  };
}
/** A scripted fight: drive a square, aim with the hull, fire, build now and then. */
const BUILDS = ["cover", "pillbox", "mine"];
export function script(t) {
  return (k) => {
    const d = Math.floor(k / 60) % 4;
    t.keys(d === 0 ? 1 : d === 2 ? -1 : 0, d === 1 ? 1 : d === 3 ? -1 : 0);
    t.fire(k % 120 < 80);
    if (k % 300 === 0) t.act(BUILDS[(k / 300) % 3]);
    if (t.w.tanks.hp[W.P] < 40) t.w.tanks.hp[W.P] = 100;
  };
}
export const glyphRow = (n) => Array.from({ length: n }, (_, i) => rect(100 + (i % 40) * 20, 120 + Math.floor(i / 40) * 60, 12, 18));
