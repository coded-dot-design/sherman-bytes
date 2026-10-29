// Sherman Bytes, the rules: your tank, the enemy tanks, the shells, the bases (the page's buttons),
// their walls, your cover / pillboxes / mines, the airdrops and the waves, as one Fizlet system.
// DOM-free: the page comes in through `Board` (fizlet/board-page in the game, a fake in tests), hard
// cover ([data-sherman-wall]) through `walls`, the controls through `ctl` and `input`. Every running
// number lives in a typed array, so a step never allocates. What happens goes on the engine's event
// ring; the game layer turns it into sound, sparks, popups and the HUD. The numbers are 0.x's (the
// DOM VIRUS core build), unchanged; waves, airdrops and score / XP are fizlet/rules bricks.
import type { Engine, System } from "../vendor/fizlet/kernel/engine";
import { drops, score, waves } from "../vendor/fizlet/rules";
import { BASE_HEALTH, CANNON_XP, MAX_SHELLS, MAX_TANKS, TANK_RADIUS } from "./rules.js";
import { BUILD_CAP, BUILD_COST } from "./fortifications.js";

/** A page target (a base): viewport rect (w = 0 while off screen); hp is the game's. */
export interface Target {
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
}
/** The page as the board (fizlet/board-page satisfies it). */
export interface Board {
  readonly targets: readonly Target[];
  readonly glyphs: { readonly x: ArrayLike<number>; readonly y: ArrayLike<number>; readonly w: ArrayLike<number>; readonly h: ArrayLike<number> };
  /** Unspent glyphs touching the circle p[i], p[i + 1], radius p[i + 2], into `out`; how many. */
  nearAt(p: Float64Array, i: number, out: Int32Array): number;
  /** First unspent glyph the segment p[i .. i + 3] touches, or -1; how far along it into p[i + 4]. */
  hitAt(p: Float64Array, i: number): number;
  consume(i: number, as?: "binary" | "erase"): boolean;
}
/** The intents a step reads (fizlet/input satisfies it). */
export interface Intents {
  hit(intent: string): boolean;
}

/** Controls (fizlet/arcade's slots). */
const PX = 1, PY = 2, PON = 3, KX = 4, KY = 5, FIRE = 6;
/** World state slots. The game writes W, H and REDUCED. */
export const W = 0, H = 1, REDUCED = 2, TIME = 3, OVER = 4, SCRAP = 5, SALVAGED = 6, SUPPLY_CLOCK = 7, KILLS = 8, SPAWN_IN = 9;
export const CURSOR = 10, SHIELD = 11, RELOCATE = 12, SUPPLY_IN = 13, SUPPLY_TURN = 14, REST = 15, CANNON = 16;
/** The job being built: kind + 1 (0: none), rect, where the engineer set off, progress, cost. */
export const BUILD = 17, BL = 18, BT = 19, BR = 20, BB = 21, BFX = 22, BFY = 23, BPROG = 24, BCOST = 25;
const SLOTS = 26;
/** Structure kinds, and the build kinds' names (index − 1). */
export const BARRIER = 0, COVER = 1, PILLBOX = 2, MINE = 3;
export const KINDS = ["barrier", "cover", "pillbox", "mine"] as const;
const BUILDS = ["cover", "pillbox", "mine"] as const;
export const MAX_BASES = 32;
export const MAX_STRUCTURES = MAX_BASES * 4 + BUILD_CAP.cover + BUILD_CAP.pillbox + BUILD_CAP.mine;
export const MAX_WALLS = 32;
/** The player's tank is tank slot P (after the enemy tanks). */
export const P = MAX_TANKS;
/** Text popups, by ring event `say` a (with b: a number or a build kind). Tone 1 good, 2 bad. */
export const SAYS = ["DRIVE ONTO BASE", "BASE CAPTURED", "ENGINEER BUSY", "NEED # SCRAP", "# LIMIT", "CLEAR THE BUILD SITE", "# READY", "BUILD BLOCKED / REFUNDED", "+25 ARMOR", "+6 SCRAP", "−# ARMOR"] as const;
export const SAY_TONE = [1, 1, 2, 2, 2, 2, 1, 2, 1, 1, 2] as const;
/** Spark colours (the game's `colors`): captured / player, enemy, heavy, shell. */
export const C_PLAYER = 0, C_ENEMY = 1, C_HEAVY = 2, C_SHELL = 3;
const OFFSETS = [0, 0.8, -0.8, 1.6, -1.6] as const;
const NONE = -1, K_WALL = 0, K_STRUCT = 1, K_GLYPH = 2, K_BASE = 3, K_TANK = 4, K_PLAYER = 5;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Does the circle (x, y, r) overlap the rect (strictly)? */
export function overlaps(x: number, y: number, l: number, t: number, r: number, b: number, radius: number) {
  const dx = x - Math.max(l, Math.min(x, r)), dy = y - Math.max(t, Math.min(y, b));
  return dx * dx + dy * dy < radius * radius;
}
/** Where segment (x0, y0) → (x1, y1) first enters the rect padded by `pad`, as 0..1, or 2 for a miss. */
export function segRect(x0: number, y0: number, x1: number, y1: number, l: number, t: number, r: number, b: number, pad: number) {
  let lo = 0, hi = 1;
  for (let axis = 0; axis < 2; axis++) {
    const p = axis ? y0 : x0, d = axis ? y1 - y0 : x1 - x0, min = (axis ? t : l) - pad, max = (axis ? b : r) + pad;
    if (d) {
      let u = (min - p) / d, v = (max - p) / d;
      if (u > v) {
        const swap = u;
        u = v;
        v = swap;
      }
      if (u > lo) lo = u;
      if (v < hi) hi = v;
    } else if (p < min || p > max) return 2;
  }
  return lo <= hi ? lo : 2;
}
const intersects = (al: number, at: number, ar: number, ab: number, bl: number, bt: number, br: number, bb: number) => al < br && ar > bl && at < bb && ab > bt;

/** `ctl`: the controls array to read (fizlet/arcade's, in the game); a fresh one by default (tests). */
export function createWorld(e: Engine, board: Board, ctl: Float64Array = new Float64Array(11), input: Intents = { hit: () => false }, options: { mode?: "siege" | "conquest"; fortifications?: boolean } = {}) {
  const s = new Float64Array(SLOTS);
  const siege = options.mode !== "conquest", forts = options.fortifications !== false;
  // Tanks 0 … n − 1 and yours at P: position, velocity, hull and turret angles, armor, heavy, reload,
  // tread phase, hit flash, recoil, age, which way it flanks.
  const T = MAX_TANKS + 1;
  const tx = new Float64Array(T), ty = new Float64Array(T), tvx = new Float64Array(T), tvy = new Float64Array(T), tang = new Float64Array(T), ttur = new Float64Array(T);
  const thp = new Float64Array(T), theavy = new Uint8Array(T), tfire = new Float64Array(T), ttread = new Float64Array(T), tflash = new Float64Array(T), trecoil = new Float64Array(T), tage = new Float64Array(T), tflank = new Int8Array(T);
  // Shells: position, velocity, life, friendly, yours, power, the structure that fired it (−1).
  const sx = new Float64Array(MAX_SHELLS), sy = new Float64Array(MAX_SHELLS), svx = new Float64Array(MAX_SHELLS), svy = new Float64Array(MAX_SHELLS), slife = new Float64Array(MAX_SHELLS);
  const sfriend = new Uint8Array(MAX_SHELLS), smine = new Uint8Array(MAX_SHELLS), spow = new Float64Array(MAX_SHELLS), ssrc = new Int16Array(MAX_SHELLS);
  // Bases, in the order they appeared: the page target, captured, capture progress, reload, the wall
  // rect they were last fitted to (x, y, w, h; NaN: none) and their four walls (structure indices).
  const bt: (Target | null)[] = new Array(MAX_BASES).fill(null);
  const bcap = new Uint8Array(MAX_BASES), bprog = new Float64Array(MAX_BASES), bfire = new Float64Array(MAX_BASES);
  const bwx = new Float64Array(MAX_BASES).fill(NaN), bwy = new Float64Array(MAX_BASES), bww = new Float64Array(MAX_BASES), bwh = new Float64Array(MAX_BASES), bwall = new Int16Array(MAX_BASES * 4).fill(NONE);
  // Structures (base walls and your builds), in the order they were made: kind, rect, armor, full
  // armor, base (−1: yours), side, reload, aim.
  const S = MAX_STRUCTURES;
  const kk = new Uint8Array(S), kl = new Float64Array(S), kt = new Float64Array(S), kr = new Float64Array(S), kb = new Float64Array(S), khp = new Float64Array(S), kmax = new Float64Array(S);
  const kbase = new Int16Array(S), kside = new Uint8Array(S), kfire = new Float64Array(S), kang = new Float64Array(S);
  // Hard cover: [data-sherman-wall] rects (l, t, r, b), measured by the game in the read phase.
  const walls = new Float64Array(MAX_WALLS * 4);
  // Counts: tanks, shells, bases, structures, walls.
  const n = new Int32Array(5), TN = 0, SN = 1, BN = 2, KN = 3, WN = 4;
  const out = new Int32Array(256), fp = new Float64Array(2), rect = new Float64Array(4), q = new Float64Array(8), pt = new Float64Array(3), mv = new Float64Array(4);

  // Waves (siege) and airdrops are fizlet/rules bricks; score / XP / cannon too (cannon 2 at 20 XP,
  // 3 at 60). The waves clock steps only in siege with bases on the page, as before.
  const wave = waves(e, { alive: () => n[TN]!, cap: MAX_TANKS });
  e.remove(wave.system);
  const supplies = drops(e, { kinds: ["scrap", "repair"] as const });
  const points = score(e, { combo: false, levels: CANNON_XP });

  // ---------- Geometry ----------
  const visible = (b: number) => bt[b]!.w > 0;
  /** Live, and its base (if any) is on screen. */
  const active = (k: number) => khp[k]! > 0 && (kbase[k]! < 0 || visible(kbase[k]!));
  const solid = (k: number) => active(k) && kk[k] !== MINE;
  // Hot helpers read their point from `pt` (x, y; a query radius in pt[2]) and their rect by index: numbers passed to a
  // helper V8 doesn't inline box (one allocation each), and the step is too big to inline them all.
  const near2 = (x: number, y: number, radius: number) => x * x + y * y < radius * radius;
  /** Does the circle at pt (radius) overlap rect i of `r` (l, t, r, b)? */
  const ovR = (r: Float64Array, i: number, radius: number) => near2(pt[0]! - Math.max(r[i]!, Math.min(pt[0]!, r[i + 2]!)), pt[1]! - Math.max(r[i + 1]!, Math.min(pt[1]!, r[i + 3]!)), radius);
  /** … structure k's rect? */
  const ovK = (k: number, radius: number) => near2(pt[0]! - Math.max(kl[k]!, Math.min(pt[0]!, kr[k]!)), pt[1]! - Math.max(kt[k]!, Math.min(pt[1]!, kb[k]!)), radius);
  /** … a base's rect? */
  const ovT = (t: Target, radius: number) => near2(pt[0]! - Math.max(t.x, Math.min(pt[0]!, t.x + t.w)), pt[1]! - Math.max(t.y, Math.min(pt[1]!, t.y + t.h)), radius);
  /** Is a tank at pt blocked (page edge, hard cover, walls and builds, live bases, letters)? */
  function blocked(text = true) {
    const x = pt[0]!, y = pt[1]!;
    if (x < 14 || y < 14 || x > s[W]! - 14 || y > s[H]! - 14) return true;
    for (let i = 0, m = n[WN]! * 4; i < m; i += 4) if (ovR(walls, i, TANK_RADIUS)) return true;
    for (let k = 0; k < n[KN]!; k++) if (solid(k) && ovK(k, TANK_RADIUS)) return true;
    for (let b = 0; b < n[BN]!; b++) {
      const t = bt[b]!;
      if (t.hp > 0 && t.w > 0 && ovT(t, TANK_RADIUS)) return true;
    }
    if (!text) return false;
    pt[2] = TANK_RADIUS;
    return board.nearAt(pt, 0, out) > 0;
  }
  /** The nearest free ground to (x, y), in rings of 24 px: into `fp`. */
  function freePosition(x: number, y: number) {
    for (let ring = 0; ring < 9; ring++)
      for (let i = 0; i < (ring ? 12 : 1); i++) {
        const a = (i * Math.PI) / 6, px = clamp(x + Math.cos(a) * ring * 24, 16, s[W]! - 16), py = clamp(y + Math.sin(a) * ring * 24, 16, s[H]! - 16);
        pt[0] = px;
        pt[1] = py;
        if (blocked()) continue;
        let free = true;
        for (let j = 0; j < n[TN]! && free; j++) if (Math.sqrt((tx[j]! - px) ** 2 + (ty[j]! - py) ** 2) < 24) free = false;
        if (free) return (fp[0] = px), (fp[1] = py), true;
      }
    return false;
  }
  function placePlayer() {
    if (freePosition(s[W]! * 0.5, s[H]! * 0.7)) (tx[P] = fp[0]!), (ty[P] = fp[1]!);
    else {
      // A densely typeset page still has a playable deployment area; hard cover stays solid.
      let found = false;
      for (let y = 40; y < s[H]! && !found; y += 32)
        for (let x = 40; x < s[W]!; x += 32) {
          pt[0] = x;
          pt[1] = y;
          if (blocked(false)) continue;
          tx[P] = x;
          ty[P] = y;
          pt[2] = 24;
          for (let k = 0, m = board.nearAt(pt, 0, out); k < m; k++) board.consume(out[k]!, "binary");
          found = true;
          break;
        }
      if (!found) throw new Error("Sherman Bytes: no space to deploy. Choose a smaller wallSelector or a larger board.");
    }
    s[SHIELD] = 1.8;
  }

  // ---------- Score ----------
  const salvage = (amount: number) => void (s[SCRAP] = Math.min(99, s[SCRAP]! + amount));
  function award(p: number, xp: number, x: number, y: number) {
    const before = points.level;
    points.add(p, xp, x, y);
    if (points.level > before) (s[CANNON] = points.level + 1), (tfire[P] = 0);
  }
  function consume(g: number, credited: boolean) {
    const x = board.glyphs.x[g]!, y = board.glyphs.y[g]!;
    if (!board.consume(g, "binary") || !credited) return;
    award(5, 1, x, y);
    if (++s[SALVAGED]! % 4 === 0) salvage(1);
  }
  function breach(x: number, y: number, credited: boolean, radius: number) {
    pt[0] = x;
    pt[1] = y;
    pt[2] = radius;
    for (let k = 0, m = board.nearAt(pt, 0, out); k < m; k++) consume(out[k]!, credited);
  }
  const say = (code: number, x: number, y: number, b = 0) => e.events.emit("say", code, b, x, y);
  const burst = (x: number, y: number, c: number, count: number) => e.events.emit("burst", c, count, x, y);

  // ---------- Tanks and shells ----------
  /** Substeps plus axis sliding stop a fast tank crossing a thin glyph between frames. */
  /** Move tank i by (mv[0], mv[1]). */
  function move(i: number) {
    const dx = mv[0]!, dy = mv[1]!, len = Math.sqrt(dx * dx + dy * dy), steps = Math.max(1, Math.ceil(len / 4));
    let moved = false;
    for (let k = 0; k < steps; k++) {
      pt[0] = tx[i]! + dx / steps;
      pt[1] = ty[i]!;
      if (!blocked()) (tx[i]! += dx / steps), (moved = moved || dx !== 0);
      pt[0] = tx[i]!;
      pt[1] = ty[i]! + dy / steps;
      if (!blocked()) (ty[i]! += dy / steps), (moved = moved || dy !== 0);
    }
    if (moved) ttread[i]! += len / 6;
    return moved;
  }
  /** Turn hull i toward mv[2] by at most mv[3] radians, the short way round. */
  function turn(i: number) {
    const d = Math.atan2(Math.sin(mv[2]! - tang[i]!), Math.cos(mv[2]! - tang[i]!));
    tang[i]! += Math.max(-mv[3]!, Math.min(mv[3]!, d));
  }
  /** A shell from (x, y): friendly ones are fast; it starts inside the tank, so the swept ray also
   *  catches terrain touching the muzzle. */
  function shoot(x: number, y: number, angle: number, friendly: boolean, owned: boolean, power = 25, source = NONE) {
    if (n[SN]! >= MAX_SHELLS) return;
    const i = n[SN]!++, v = friendly ? 510 : 260;
    sx[i] = x; sy[i] = y; svx[i] = Math.cos(angle) * v; svy[i] = Math.sin(angle) * v; slife[i] = friendly ? 1.3 : 2;
    sfriend[i] = friendly ? 1 : 0; smine[i] = owned ? 1 : 0; spow[i] = power; ssrc[i] = source;
  }
  function removeShell(i: number) {
    const j = --n[SN]!;
    sx[i] = sx[j]!; sy[i] = sy[j]!; svx[i] = svx[j]!; svy[i] = svy[j]!; slife[i] = slife[j]!;
    sfriend[i] = sfriend[j]!; smine[i] = smine[j]!; spow[i] = spow[j]!; ssrc[i] = ssrc[j]!;
  }
  function removeTank(i: number) {
    const j = --n[TN]!;
    tx[i] = tx[j]!; ty[i] = ty[j]!; tvx[i] = tvx[j]!; tvy[i] = tvy[j]!; tang[i] = tang[j]!; ttur[i] = ttur[j]!; thp[i] = thp[j]!; theavy[i] = theavy[j]!;
    tfire[i] = tfire[j]!; ttread[i] = ttread[j]!; tflash[i] = tflash[j]!; trecoil[i] = trecoil[j]!; tage[i] = tage[j]!; tflank[i] = tflank[j]!;
  }
  /** An enemy tank from the next live base on screen (in turn), or from a page edge once every base
   *  is captured (siege). Never within 70 px of you. */
  function spawn() {
    if (n[TN]! >= (siege ? wave.limit : MAX_TANKS)) return false;
    let live = 0, from = NONE, ok = false;
    for (let b = 0; b < n[BN]!; b++) if (!bcap[b] && bt[b]!.hp > 0 && visible(b)) live++;
    if (live) {
      let pick = s[CURSOR]!++ % live;
      for (let b = 0; b < n[BN]! && from < 0; b++) if (!bcap[b] && bt[b]!.hp > 0 && visible(b) && pick-- === 0) from = b;
      const t = bt[from]!;
      ok = freePosition(t.x + t.w / 2, t.y + t.h + 42);
    } else if (siege && n[BN]!) {
      // Capturing the bases changes the front: reinforcements arrive at the page edges.
      const edge = s[CURSOR]!++ % 4;
      const x = edge === 0 ? 22 : edge === 1 ? s[W]! - 22 : s[W]! * (0.2 + e.random() * 0.6);
      ok = freePosition(x, edge === 2 ? 22 : edge === 3 ? s[H]! - 22 : s[H]! * (0.2 + e.random() * 0.6));
    }
    if (!ok || Math.sqrt((fp[0]! - tx[P]!) ** 2 + (fp[1]! - ty[P]!) ** 2) < 70 || n[TN]! >= MAX_TANKS) return false;
    const heavy = (siege ? wave.wave >= 2 : s[TIME]! > 24) && e.random() > 0.55;
    const i = n[TN]!++;
    tx[i] = fp[0]!; ty[i] = fp[1]!; tvx[i] = tvy[i] = 0; tang[i] = ttur[i] = -Math.PI / 2; thp[i] = heavy ? 70 : 35; theavy[i] = heavy ? 1 : 0;
    tfire[i] = 1.2; ttread[i] = tflash[i] = trecoil[i] = tage[i] = 0; tflank[i] = s[CURSOR]! % 2 ? 1 : -1;
    e.events.emit("spawn", from, heavy ? 1 : 0, tx[i], ty[i], siege ? wave.wave : 1);
    burst(tx[i]!, ty[i]!, C_ENEMY, 6);
    return true;
  }
  function hitTank(i: number, power: number, credited: boolean) {
    thp[i]! -= power;
    tflash[i] = 0.13;
    if (thp[i]! > 0) return;
    const x = tx[i]!, y = ty[i]!, heavy = theavy[i] === 1;
    removeTank(i);
    s[KILLS]!++;
    if (credited) award(heavy ? 150 : 100, heavy ? 8 : 5, x, y), salvage(heavy ? 4 : 2);
    burst(x, y, heavy ? C_HEAVY : C_ENEMY, 12);
    e.events.emit("tank-destroyed", heavy ? 1 : 0, 0, x, y);
  }
  function hurt(power: number) {
    if (s[SHIELD]! > 0) return;
    thp[P] = Math.max(0, thp[P]! - power);
    s[SHIELD] = 0.6;
    tflash[P] = 0.2;
    e.events.emit("hurt", thp[P], power, tx[P], ty[P]);
    say(10, tx[P]!, ty[P]!, power);
    burst(tx[P]!, ty[P]!, C_ENEMY, 7);
    if (thp[P]! <= 0) s[OVER] = 1;
  }

  // ---------- Structures ----------
  function removeStructure(k: number) {
    const last = --n[KN]!;
    for (let j = k; j < last; j++) {
      kk[j] = kk[j + 1]!; kl[j] = kl[j + 1]!; kt[j] = kt[j + 1]!; kr[j] = kr[j + 1]!; kb[j] = kb[j + 1]!; khp[j] = khp[j + 1]!; kmax[j] = kmax[j + 1]!;
      kbase[j] = kbase[j + 1]!; kside[j] = kside[j + 1]!; kfire[j] = kfire[j + 1]!; kang[j] = kang[j + 1]!;
    }
    // Indices after it moved down one: keep the walls and the shells' sources pointing right.
    for (let i = 0; i < MAX_BASES * 4; i++) if (bwall[i]! > k) bwall[i]!--; else if (bwall[i] === k) bwall[i] = NONE;
    for (let i = 0; i < n[SN]!; i++) if (ssrc[i]! > k) ssrc[i]!--; else if (ssrc[i] === k) ssrc[i] = NONE;
  }
  function addStructure(kind: number, l: number, t: number, r: number, b: number, hp: number, base: number, side: number, fire: number, angle: number) {
    if (n[KN]! >= S) return NONE;
    const k = n[KN]!++;
    kk[k] = kind; kl[k] = l; kt[k] = t; kr[k] = r; kb[k] = b; khp[k] = kmax[k] = hp; kbase[k] = base; kside[k] = side; kfire[k] = fire; kang[k] = angle;
    return k;
  }
  /** A base's wall on `side` (0 top, 1 bottom, 2 left, 3 right), fitted to its rect: into `rect`. */
  function barrierRect(x: number, y: number, w: number, h: number, side: number) {
    const cx = x + w / 2, cy = y + h / 2;
    if (side < 2) box(cx, cy + (side === 0 ? -1 : 1) * (h / 2 + 12), w + 24, 10);
    else box(cx + (side === 2 ? -1 : 1) * (w / 2 + 12), cy, 10, h + 14);
  }
  function box(x: number, y: number, w: number, h: number) {
    rect[0] = x - w / 2; rect[1] = y - h / 2; rect[2] = x + w / 2; rect[3] = y + h / 2;
  }
  /** Where a build of `kind` (1 cover, 2 pillbox, 3 mine) goes: ahead of your turret. Into `rect`. */
  function buildRect(kind: number) {
    const a = ttur[P]!, reach = kind === MINE ? 120 : 52, horizontal = Math.abs(Math.sin(a)) > Math.abs(Math.cos(a));
    box(tx[P]! + Math.cos(a) * reach, ty[P]! + Math.sin(a) * reach, kind === COVER ? (horizontal ? 42 : 12) : kind === MINE ? 14 : 24, kind === COVER ? (horizontal ? 12 : 42) : kind === MINE ? 14 : 24);
  }
  function clearBuildSite(l: number, t: number, r: number, b: number) {
    if (l < 14 || t < 14 || r > s[W]! - 14 || b > s[H]! - 14) return false;
    box4(l, t, r, b);
    for (let i = 0; i <= n[TN]!; i++) {
      const j = i === n[TN]! ? P : i;
      pt[0] = tx[j]!;
      pt[1] = ty[j]!;
      if (ovR(rect, 0, 14)) return false;
    }
    for (let i = 0, m = n[WN]! * 4; i < m; i += 4) if (intersects(l, t, r, b, walls[i]!, walls[i + 1]!, walls[i + 2]!, walls[i + 3]!)) return false;
    for (let k = 0; k < n[KN]!; k++) if (active(k) && intersects(l, t, r, b, kl[k]!, kt[k]!, kr[k]!, kb[k]!)) return false;
    for (let i = 0; i < n[BN]!; i++) {
      const q = bt[i]!;
      if (q.w > 0 && intersects(l, t, r, b, q.x, q.y, q.x + q.w, q.y + q.h)) return false;
    }
    const g = board.glyphs;
    pt[0] = (l + r) / 2;
    pt[1] = (t + b) / 2;
    pt[2] = Math.max(r - l, b - t) / 2 + 12;
    for (let k = 0, m = board.nearAt(pt, 0, out); k < m; k++) {
      const i = out[k]!;
      if (intersects(l, t, r, b, g.x[i]!, g.y[i]!, g.x[i]! + g.w[i]!, g.y[i]! + g.h[i]!)) return false;
    }
    return true;
  }
  /** B / T / M: start building (cover 2, pillbox 8, mine 3 scrap; one job at a time; caps). */
  function build(kind: number) {
    const x = tx[P]!, y = ty[P]! - 28;
    if (s[BUILD]) return say(2, x, y);
    const cost = BUILD_COST[BUILDS[kind - 1]!];
    if (s[SCRAP]! < cost) return say(3, x, y, cost);
    let count = 0;
    for (let k = 0; k < n[KN]!; k++) if (kk[k] === kind && khp[k]! > 0) count++;
    if (count >= BUILD_CAP[BUILDS[kind - 1]!]) return say(4, x, y, kind);
    buildRect(kind);
    if (!clearBuildSite(rect[0]!, rect[1]!, rect[2]!, rect[3]!)) return say(5, x, y);
    s[SCRAP]! -= cost;
    s[BUILD] = kind; s[BL] = rect[0]!; s[BT] = rect[1]!; s[BR] = rect[2]!; s[BB] = rect[3]!; s[BFX] = tx[P]!; s[BFY] = ty[P]!; s[BPROG] = 0; s[BCOST] = cost;
    e.events.emit("build-start", kind, cost);
  }
  function detonate(k: number) {
    khp[k] = 0;
    const cx = (kl[k]! + kr[k]!) / 2, cy = (kt[k]! + kb[k]!) / 2;
    for (let i = n[TN]! - 1; i >= 0; i--) if (i < n[TN]! && Math.sqrt((tx[i]! - cx) ** 2 + (ty[i]! - cy) ** 2) < 70) hitTank(i, 95, true);
    breach(cx, cy, true, 38);
    burst(cx, cy, C_SHELL, 18);
    e.events.emit("mine-detonated", 0, 0, cx, cy);
  }
  function fortifications(dt: number) {
    if (s[BUILD] && (s[BPROG]! += dt) >= 0.65) {
      const kind = s[BUILD]!;
      s[BUILD] = 0;
      const l = s[BL]!, t = s[BT]!, r = s[BR]!, b = s[BB]!;
      if (clearBuildSite(l, t, r, b)) {
        addStructure(kind, l, t, r, b, kind === COVER ? 110 : kind === PILLBOX ? 100 : 1, NONE, 0, 0.3, ttur[P]!);
        say(6, (l + r) / 2, (t + b) / 2, kind);
        e.events.emit("structure-built", kind, 0, (l + r) / 2, (t + b) / 2);
      } else salvage(s[BCOST]!), say(7, tx[P]!, ty[P]! - 28);
    }
    for (let k = 0; k < n[KN]!; k++) {
      if (!active(k) || kbase[k]! >= 0 || kr[k]! < 0 || kb[k]! < 0 || kl[k]! > s[W]! || kt[k]! > s[H]!) continue;
      const cx = (kl[k]! + kr[k]!) / 2, cy = (kt[k]! + kb[k]!) / 2;
      if (kk[k] === MINE) {
        for (let i = 0; i < n[TN]!; i++)
          if (Math.sqrt((tx[i]! - cx) ** 2 + (ty[i]! - cy) ** 2) < 24) {
            detonate(k);
            break;
          }
      } else if (kk[k] === PILLBOX) {
        kfire[k]! -= dt;
        let target = NONE, range = 330;
        for (let i = 0; i < n[TN]!; i++) {
          const d = Math.sqrt((tx[i]! - cx) ** 2 + (ty[i]! - cy) ** 2);
          if (d < range) (target = i), (range = d);
        }
        if (target >= 0) {
          // Lead a moving tank: aiming at where it is misses an orbiting scout.
          const flight = range / 510;
          kang[k] = Math.atan2(ty[target]! + tvy[target]! * flight - cy, tx[target]! + tvx[target]! * flight - cx);
          if (kfire[k]! <= 0) shoot(cx, cy, kang[k]!, true, true, 35, k), (kfire[k] = 0.65);
        }
      }
    }
    for (let k = n[KN]! - 1; k >= 0; k--) if (kbase[k]! < 0 && khp[k]! <= 0) removeStructure(k);
    // Scrap comes in only while you sit on a captured base: no hidden timer.
    let supplied = false;
    pt[0] = tx[P]!;
    pt[1] = ty[P]!;
    for (let b = 0; b < n[BN]! && !supplied; b++) if (bcap[b] && bt[b]!.w > 0 && ovT(bt[b]!, 12)) supplied = true;
    s[SUPPLY_CLOCK] = supplied ? s[SUPPLY_CLOCK]! + dt : 0;
    if (s[SUPPLY_CLOCK]! >= 2.5) salvage(1), (s[SUPPLY_CLOCK]! -= 2.5);
  }

  // ---------- Shells ----------
  const box4 = (l: number, t: number, r: number, b: number) => void ((rect[0] = l), (rect[1] = t), (rect[2] = r), (rect[3] = b));
  /** Does the segment in q[0..3] hit the rect at r[i..i+3] (2 px pad) before q[6] (the best so far)? Then q[6] is where. */
  const sweep = (r: Float64Array, i: number) => sweepIn(r[i]!, r[i + 1]!, r[i + 2]!, r[i + 3]!);
  const sweepK = (k: number) => (box4(kl[k]!, kt[k]!, kr[k]!, kb[k]!), sweepIn(0, 0, 0, 0, true));
  const sweepT = (t: Target) => (box4(t.x, t.y, t.x + t.w, t.y + t.h), sweepIn(0, 0, 0, 0, true));
  const sweepTank = (j: number, half: number) => (box4(tx[j]! - half, ty[j]! - half, tx[j]! + half, ty[j]! + half), sweepIn(0, 0, 0, 0, true));
  function sweepIn(l: number, t: number, r: number, b: number, fromRect = false) {
    if (fromRect) (l = rect[0]!), (t = rect[1]!), (r = rect[2]!), (b = rect[3]!);
    let lo = 0, hi = 1;
    for (let axis = 0; axis < 2; axis++) {
      const p = q[axis]!, d = q[axis + 2]! - p, min = (axis ? t : l) - 2, max = (axis ? b : r) + 2;
      if (d) {
        let u = (min - p) / d, v = (max - p) / d;
        if (u > v) {
          const swap = u;
          u = v;
          v = swap;
        }
        if (u > lo) lo = u;
        if (v < hi) hi = v;
      } else if (p < min || p > max) return false;
    }
    if (lo > hi || lo >= q[6]!) return false;
    q[6] = lo;
    return true;
  }
  function shells(dt: number) {
    for (let i = n[SN]! - 1; i >= 0; i--) {
      const x0 = sx[i]!, y0 = sy[i]!, x1 = x0 + svx[i]! * dt, y1 = y0 + svy[i]! * dt;
      // The swept segment and the best hit so far live in `q` (numbers passed to a helper V8 doesn't
      // inline would box: one allocation each).
      q[0] = x0; q[1] = y0; q[2] = x1; q[3] = y1; q[6] = Infinity;
      let kind = NONE, which = NONE;
      for (let w = 0, m = n[WN]! * 4; w < m; w += 4) if (sweep(walls, w)) kind = K_WALL;
      for (let k = 0; k < n[KN]!; k++)
        if (active(k) && k !== ssrc[i] && sweepK(k)) (kind = K_STRUCT), (which = k);
      // The page's letters: its hot-path form reads the segment from q and writes how far into q[4].
      const g = board.hitAt(q, 0);
      if (g >= 0 && q[4]! < q[6]!) (q[6] = q[4]!), (kind = K_GLYPH), (which = g);
      for (let b = 0; b < n[BN]!; b++) {
        const t = bt[b]!;
        if (t.w > 0 && t.hp > 0 && sweepT(t)) (kind = K_BASE), (which = b);
      }
      if (sfriend[i]) {
        for (let j = 0; j < n[TN]!; j++) if (sweepTank(j, 11)) (kind = K_TANK), (which = j);
      } else if (sweepTank(P, 10)) kind = K_PLAYER;
      const best = q[6]!;
      sx[i] = x1;
      sy[i] = y1;
      slife[i]! -= dt;
      if (kind !== NONE) {
        const x = x0 + (x1 - x0) * best, y = y0 + (y1 - y0) * best, yours = smine[i] === 1, power = spow[i]!;
        if (kind === K_GLYPH) {
          consume(which, yours);
          // A crater is wider than the tank, so one hit opens a useful route.
          breach(x, y, yours, yours && s[CANNON]! >= 2 ? 31 : 22);
        } else if (kind === K_STRUCT) {
          khp[which] = Math.max(0, khp[which]! - power);
          if (khp[which] === 0) {
            if (kk[which] === MINE) detonate(which);
            else if (kbase[which]! >= 0 && yours) award(20, 2, x, y), salvage(1);
            e.events.emit("structure-destroyed", kk[which], 0, x, y);
          }
        } else if (kind === K_TANK) hitTank(which, power, yours);
        else if (kind === K_PLAYER) hurt(power);
        else if (kind === K_BASE && yours) {
          const t = bt[which]!;
          t.hp = Math.max(0, t.hp - power);
          award(10, 2, x, y);
          if (t.hp === 0) say(0, x, y), e.events.emit("base-disabled", which, 0, x, y);
        }
        burst(x, y, sfriend[i] ? C_SHELL : C_ENEMY, 5);
        // A mine's blast may have removed shells: this one is still at i only if i is still live.
        if (i < n[SN]!) removeShell(i);
      } else if (slife[i]! <= 0 || x1 < -50 || x1 > s[W]! + 50 || y1 < -50 || y1 > s[H]! + 50) removeShell(i);
    }
  }

  // ---------- Bases ----------
  function bases(dt: number) {
    for (let b = 0; b < n[BN]!; b++) {
      const t = bt[b]!;
      if (!(t.w > 0)) continue;
      pt[0] = tx[P]!;
      pt[1] = ty[P]!;
      const cx = t.x + t.w / 2, cy = t.y + t.h / 2, touching = ovT(t, TANK_RADIUS + 2);
      if (!bcap[b] && t.hp <= 0) {
        bprog[b] = touching ? Math.min(0.7, bprog[b]! + dt) : Math.max(0, bprog[b]! - dt);
        if (bprog[b]! >= 0.7) {
          bcap[b] = 1;
          salvage(8);
          award(300, 12, cx, cy);
          say(1, cx, cy);
          e.events.emit("base-captured", b, 0, cx, cy);
        }
      }
      if (!bcap[b]) continue;
      if (touching) thp[P] = Math.min(100, thp[P]! + 18 * dt);
      if ((bfire[b]! -= dt) > 0) continue;
      let enemy = NONE, d = 290;
      for (let i = 0; i < n[TN]!; i++) {
        const dd = Math.sqrt((cx - tx[i]!) ** 2 + (cy - ty[i]!) ** 2);
        if (dd < d) (d = dd), (enemy = i);
      }
      if (enemy >= 0) {
        const flight = d / 510;
        shoot(cx, cy, Math.atan2(ty[enemy]! + tvy[enemy]! * flight - cy, tx[enemy]! + tvx[enemy]! * flight - cx), true, false, 35);
        bfire[b] = 0.95;
      }
    }
  }
  /**
   * The page's targets are the bases (read phase, after the board measured them): new ones get their
   * four walls, moved ones refit them, and bases gone from the page take their walls with them.
   */
  function sync(targets: readonly Target[]) {
    for (let b = n[BN]! - 1; b >= 0; b--) {
      if (targets.includes(bt[b]!)) continue;
      for (let k = n[KN]! - 1; k >= 0; k--) if (kbase[k] === b) removeStructure(k);
      for (let k = 0; k < n[KN]!; k++) if (kbase[k]! > b) kbase[k]!--;
      const last = --n[BN]!;
      for (let j = b; j < last; j++) {
        bt[j] = bt[j + 1]!; bcap[j] = bcap[j + 1]!; bprog[j] = bprog[j + 1]!; bfire[j] = bfire[j + 1]!;
        bwx[j] = bwx[j + 1]!; bwy[j] = bwy[j + 1]!; bww[j] = bww[j + 1]!; bwh[j] = bwh[j + 1]!;
        for (let q = 0; q < 4; q++) bwall[j * 4 + q] = bwall[(j + 1) * 4 + q]!;
      }
      bt[last] = null;
      bwx[last] = NaN;
      bwall.fill(NONE, last * 4, last * 4 + 4);
    }
    for (const t of targets) {
      let b = bt.indexOf(t);
      if (b < 0 || b >= n[BN]!) {
        if (n[BN]! >= MAX_BASES) continue;
        b = n[BN]!++;
        bt[b] = t; bcap[b] = 0; bprog[b] = 0; bfire[b] = 0.8; bwx[b] = NaN;
        bwall.fill(NONE, b * 4, b * 4 + 4);
      }
      if (!forts || !(t.w > 0) || (t.x === bwx[b] && t.y === bwy[b] && t.w === bww[b] && t.h === bwh[b])) continue;
      for (let side = 0; side < 4; side++) {
        barrierRect(t.x, t.y, t.w, t.h, side);
        const k = bwall[b * 4 + side]!;
        if (k >= 0) (kl[k] = rect[0]!), (kt[k] = rect[1]!), (kr[k] = rect[2]!), (kb[k] = rect[3]!);
        else if (bwx[b] !== bwx[b]) bwall[b * 4 + side] = addStructure(BARRIER, rect[0]!, rect[1]!, rect[2]!, rect[3]!, 50, b, side, 0, 0);
      }
      bwx[b] = t.x; bwy[b] = t.y; bww[b] = t.w; bwh[b] = t.h;
    }
  }

  // ---------- Runs ----------
  function reset() {
    const w = s[W]!, h = s[H]!, calm = s[REDUCED]!;
    s.fill(0);
    s[W] = w; s[H] = h; s[REDUCED] = calm;
    s[SCRAP] = 16; s[CANNON] = 1; s[SPAWN_IN] = 2.5; s[SUPPLY_IN] = 8;
    n[TN] = n[SN] = n[BN] = n[KN] = 0;
    bt.fill(null);
    bwx.fill(NaN);
    bwall.fill(NONE);
    wave.reset();
    supplies.reset();
    points.reset();
    for (const t of board.targets) t.hp = BASE_HEALTH;
    sync(board.targets);
    thp[P] = 100; tang[P] = ttur[P] = -Math.PI / 2; tfire[P] = ttread[P] = tflash[P] = trecoil[P] = 0;
    placePlayer();
  }
  /** The page scrolled by (dx, dy): everything in page space moves with it (read phase). */
  function scroll(dx: number, dy: number) {
    tx[P]! -= dx;
    ty[P]! -= dy;
    for (let i = 0; i < n[TN]!; i++) (tx[i]! -= dx), (ty[i]! -= dy);
    for (let i = 0; i < n[SN]!; i++) (sx[i]! -= dx), (sy[i]! -= dy);
    supplies.scroll(dx, dy);
    for (let k = 0; k < n[KN]!; k++) if (kbase[k]! < 0) (kl[k]! -= dx), (kr[k]! -= dx), (kt[k]! -= dy), (kb[k]! -= dy);
    if (s[BUILD]) (s[BFX]! -= dx), (s[BFY]! -= dy), (s[BL]! -= dx), (s[BR]! -= dx), (s[BT]! -= dy), (s[BB]! -= dy);
    if (tx[P]! < 14 || tx[P]! > s[W]! - 14 || ty[P]! < 14 || ty[P]! > s[H]! - 14) s[RELOCATE] = 1;
  }

  function step(dt: number) {
    if (s[OVER]) return;
    s[TIME]! += dt;
    for (let k = 1; k <= 3; k++) if (input.hit(BUILDS[k - 1]!)) build(k);
    if (s[RELOCATE] || tx[P]! > s[W]! - 14 || ty[P]! > s[H]! - 14) placePlayer(), (s[RELOCATE] = 0);
    s[SHIELD] = Math.max(0, s[SHIELD]! - dt);
    tflash[P] = Math.max(0, tflash[P]! - dt);
    trecoil[P] = Math.max(0, trecoil[P]! - dt * 24);
    tfire[P]! -= dt;
    // Drive: WASD / arrows / the stick, full speed whatever the stick's tilt; the hull turns.
    const dx = ctl[KX]!, dy = ctl[KY]!;
    if (dx || dy) {
      mv[2] = Math.atan2(dy, dx);
      mv[3] = 5 * dt;
      turn(P);
      const speed = (175 * dt) / Math.sqrt(dx * dx + dy * dy);
      mv[0] = dx * speed;
      mv[1] = dy * speed;
      move(P);
    }
    ttur[P] = ctl[PON] ? Math.atan2(ctl[PY]! - ty[P]!, ctl[PX]! - tx[P]!) : tang[P]!;
    if (ctl[FIRE] && tfire[P]! <= 0) {
      const c = s[CANNON]!;
      shoot(tx[P]!, ty[P]!, ttur[P]!, true, true, c === 1 ? 25 : 35);
      tfire[P] = c === 3 ? 0.16 : c === 2 ? 0.24 : 0.32;
      trecoil[P] = 4;
      e.events.emit("fire");
    }
    if (siege && n[BN]!) {
      // The wave clock (fizlet/rules waves): prepare 4 s, then squads of up to three, a rest
      // between squads, a rebuild of 8 s after each wave.
      const was = wave.phase;
      wave.system.step!(e, dt);
      if (was === "assault" && wave.phase === "rebuild") salvage(4), (thp[P] = Math.min(100, thp[P]! + 12));
      if (was !== "assault" && wave.phase === "assault") s[REST] = 0; // a new wave's first squad comes at once
      if (wave.phase === "assault" && wave.left > 0 && (s[REST]! -= dt) <= 0) {
        for (let k = 0, count = Math.min(3, wave.left); k < count; k++) if (spawn()) wave.spawned();
        s[REST] = Math.max(0.7, 2.1 - wave.wave * 0.12);
      }
    } else if (!siege && (s[SPAWN_IN]! -= dt) <= 0) spawn(), (s[SPAWN_IN] = Math.max(0.85, 2.5 - s[TIME]! * 0.015));
    for (let i = n[TN]! - 1; i >= 0; i--) {
      if (tx[i]! < -250 || ty[i]! < -250 || tx[i]! > s[W]! + 250 || ty[i]! > s[H]! + 250) {
        removeTank(i);
        continue;
      }
      tage[i]! += dt;
      tfire[i]! -= dt;
      tflash[i] = Math.max(0, tflash[i]! - dt);
      trecoil[i] = Math.max(0, trecoil[i]! - dt * 24);
      const d = Math.sqrt((tx[P]! - tx[i]!) ** 2 + (ty[P]! - ty[i]!) ** 2);
      ttur[i] = Math.atan2(ty[P]! - ty[i]!, tx[P]! - tx[i]!);
      // Close in, flank at 160 px, back off inside 75 px; steer round what's in the way.
      let heading = ttur[i]!;
      if (d < 160) heading += d < 75 ? Math.PI : (tflank[i]! * Math.PI) / 2;
      const speed = (theavy[i] ? 52 : 75) * dt, ox = tx[i]!, oy = ty[i]!;
      let moved = false;
      for (let k = 0; k < OFFSETS.length; k++) {
        const a = heading + OFFSETS[k]!;
        pt[0] = tx[i]! + Math.cos(a) * 18;
        pt[1] = ty[i]! + Math.sin(a) * 18;
        if (blocked()) continue;
        mv[0] = Math.cos(a) * speed;
        mv[1] = Math.sin(a) * speed;
        moved = move(i);
        mv[2] = a;
        mv[3] = dt * 3;
        turn(i);
        break;
      }
      tvx[i] = dt > 0 ? (tx[i]! - ox) / dt : 0;
      tvy[i] = dt > 0 ? (ty[i]! - oy) / dt : 0;
      if (tfire[i]! <= 0 && (d < 420 || !moved)) {
        shoot(tx[i]!, ty[i]!, ttur[i]! + (e.random() - 0.5) * 0.12, false, false, theavy[i] ? 20 : 12);
        tfire[i] = theavy[i] ? 1.8 : 2.3;
        trecoil[i] = 4;
      }
      if (d < 21) hurt(8);
    }
    // Airdrops: every 14 s, scrap then repair in turn, near you; drive over one that has landed.
    if ((s[SUPPLY_IN]! -= dt) <= 0) {
      s[SUPPLY_IN] = 14;
      const ok = freePosition(clamp(tx[P]! + 100, 25, s[W]! - 25), clamp(ty[P]! - 80, 90, s[H]! - 25));
      const kind = s[SUPPLY_TURN]!++ % 2 ? 1 : 0;
      if (ok) supplies.spawn(fp[0]!, fp[1]!, kind);
    }
    for (let got = supplies.collect(tx[P]!, ty[P]!, 24); got !== null; got = supplies.collect(tx[P]!, ty[P]!, 24))
      if (got === "repair") (thp[P] = Math.min(100, thp[P]! + 25)), say(8, tx[P]!, ty[P]! - 28);
      else salvage(6), say(9, tx[P]!, ty[P]! - 28);
    fortifications(dt);
    shells(dt);
    if (s[OVER]) return;
    bases(dt);
    if (!siege && n[BN]! > 0 && !n[TN]) {
      let all = true;
      for (let b = 0; b < n[BN]! && all; b++) if (!bcap[b]) all = false;
      if (all) s[OVER] = 2;
    }
  }
  const system: System = { step: (_e, dt) => step(dt) };
  e.add(system);

  return {
    s,
    ctl,
    siege,
    wave,
    supplies,
    points,
    tanks: { get count() { return n[TN]!; }, x: tx, y: ty, angle: tang, turret: ttur, hp: thp, heavy: theavy, tread: ttread, flash: tflash, recoil: trecoil },
    shells: { get count() { return n[SN]!; }, x: sx, y: sy, friendly: sfriend },
    bases: { get count() { return n[BN]!; }, target: bt as readonly (Target | null)[], captured: bcap, progress: bprog, walls: bwall },
    structures: { get count() { return n[KN]!; }, kind: kk, l: kl, t: kt, r: kr, b: kb, hp: khp, max: kmax, base: kbase, angle: kang, active },
    /** Hard cover rects (l, t, r, b), written by the game in the read phase; `set(count)` after. */
    walls: { rects: walls, get count() { return n[WN]!; }, set(count: number) { n[WN] = Math.min(MAX_WALLS, count); } },
    reset,
    sync,
    scroll,
    step,
    system,
  };
}
export type World = ReturnType<typeof createWorld>;
