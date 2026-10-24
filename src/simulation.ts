import { BasePresentation } from "./base-presentation.js";
import {
  EntityPool,
  segmentHit,
  translateEntities,
  clamp,
  WaveDirector,
  SupplyDrops,
} from "@coded-design/dom-virus";
import type {
  GameContext,
  GameSimulation,
  GameStats,
  Point,
  BoardTarget,
  Glyph,
  Rect,
} from "@coded-design/dom-virus";
import type { Terrain } from "./terrain.js";
import {
  MAX_TANKS,
  MAX_SHELLS,
  TANK_RADIUS,
  BASE_HEALTH,
  COLORS,
  cannonTier,
  cannonName,
  overlapsCircle,
  center,
  turnToward,
} from "./rules.js";
import { tankSprites } from "./sprites.js";
import {
  BUILD_COST,
  BUILD_CAP,
  barrierRect,
  buildRect,
  intersects,
} from "./fortifications.js";
import type { BuildKind, Structure } from "./fortifications.js";
export interface BattleOptions {
  mode?: "siege" | "conquest";
  fortifications?: boolean;
}
interface Construction {
  kind: BuildKind;
  rect: Rect;
  from: Point;
  progress: number;
  cost: number;
}

interface Tank extends Point {
  vx: number;
  vy: number;
  angle: number;
  turret: number;
  hp: number;
  heavy: boolean;
  fireIn: number;
  tread: number;
  flash: number;
  recoil: number;
  age: number;
  flank: number;
}
interface Shell extends Point {
  vx: number;
  vy: number;
  life: number;
  friendly: boolean;
  player: boolean;
  power: number;
  source: Structure | null;
}
interface Base {
  target: BoardTarget;
  captured: boolean;
  capture: number;
  fireIn: number;
  walls: Structure[];
  wallRect: Rect | null;
}
export interface ShermanBytesStats extends GameStats {
  score: number;
  lives: number;
  wave: number;
  kills: number;
  alive: number;
  shells: number;
  supplies: number;
  armor: number;
  captured: number;
  bases: number;
  cannon: number;
  xp: number;
  scrap: number;
  phase: "prepare" | "assault" | "rebuild" | "conquest";
  incoming: number;
  countdown: number;
  barriers: number;
  cover: number;
  pillboxes: number;
  mines: number;
  building: string | null;
  player: Point & { angle: number; turret: number };
  detail: string;
}
type Hit =
  | { kind: "glyph"; glyph: Glyph }
  | { kind: "tank"; tank: Tank }
  | { kind: "base"; base: Base }
  | { kind: "wall" }
  | { kind: "player" }
  | { kind: "structure"; structure: Structure };

export function createGame(
  api: GameContext,
  terrain: Terrain,
  options: BattleOptions = {},
): GameSimulation<ShermanBytesStats> {
  const player: Tank = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    turret: -Math.PI / 2,
    hp: 100,
    heavy: false,
    fireIn: 0,
    tread: 0,
    flash: 0,
    recoil: 0,
    age: 0,
    flank: 1,
  };
  const tankPool = new EntityPool<Tank>(MAX_TANKS, () => ({ ...player }));
  const shellPool = new EntityPool<Shell>(MAX_SHELLS, () => ({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    friendly: false,
    player: false,
    power: 0,
    source: null,
  }));
  const tanks = tankPool.active,
    shells = shellPool.active;
  const bases = new Map<BoardTarget, Base>();
  const structures: Structure[] = [];
  const waves = new WaveDirector(MAX_TANKS);
  const supplies = new SupplyDrops();
  let supplyIn = 8,
    supplyTurn = 0;
  const siege = options.mode !== "conquest";
  let scrap = 16,
    salvaged = 0,
    supplyClock = 0,
    construction: Construction | null = null;
  let score = 0,
    xp = 0,
    kills = 0,
    cannon = 1,
    spawnIn = 2.5,
    spawnCursor = 0,
    shield = 1.8,
    ended = false,
    relocate = false;
  let renderer: ReturnType<typeof tankSprites> | undefined;
  const basePresentation = new BasePresentation(api);
  const point: Point = { x: 0, y: 0 };
  const previous: Point = { x: 0, y: 0 };
  const next: Point = { x: 0, y: 0 };
  function syncBases() {
    for (const target of api.board.targets) {
      let base = bases.get(target);
      if (!base) {
        base = {
          target,
          captured: false,
          capture: 0,
          fireIn: 0.8,
          walls: [],
          wallRect: null,
        };
        bases.set(target, base);
      }
      const r = target.rect;
      if (
        options.fortifications !== false &&
        r &&
        target.visible &&
        (!base.wallRect ||
          r.left !== base.wallRect.left ||
          r.top !== base.wallRect.top ||
          r.width !== base.wallRect.width ||
          r.height !== base.wallRect.height)
      ) {
        if (!base.walls.length)
          for (let side = 0; side < 4; side++) {
            const wall: Structure = {
              kind: "barrier",
              rect: barrierRect(r, side),
              hp: 50,
              maxHp: 50,
              base: target,
              side,
              fireIn: 0,
              angle: 0,
            };
            base.walls.push(wall);
            structures.push(wall);
          }
        else
          for (const wall of base.walls) wall.rect = barrierRect(r, wall.side);
        base.wallRect = { ...r };
      }
    }
    for (const target of bases.keys())
      if (!api.board.targets.includes(target)) {
        bases.delete(target);
        for (let i = structures.length - 1; i >= 0; i--)
          if (structures[i]!.base === target) structures.splice(i, 1);
      }
  }
  const active = (item: Structure) =>
    item.hp > 0 && (!item.base || item.base.visible);
  const solid = (item: Structure) => active(item) && item.kind !== "mine";
  function salvage(amount: number) {
    scrap = Math.min(99, scrap + amount);
  }
  function consume(glyph: Glyph, credited: boolean) {
    if (!api.board.consume(glyph)) return;
    if (credited) {
      award(5, 1, glyph.rect?.left ?? player.x, glyph.rect?.top ?? player.y);
      if (++salvaged % 4 === 0) salvage(1);
    }
  }
  function blocked(x: number, y: number, ignore?: BoardTarget, text = true) {
    if (x < 14 || y < 14 || x > api.width - 14 || y > api.height - 14)
      return true;
    point.x = x;
    point.y = y;
    for (const wall of terrain.walls)
      if (overlapsCircle(point, wall)) return true;
    for (const item of structures)
      if (solid(item) && overlapsCircle(point, item.rect)) return true;
    for (const base of bases.values())
      if (
        base.target !== ignore &&
        base.target.health > 0 &&
        base.target.visible &&
        base.target.rect &&
        overlapsCircle(point, base.target.rect)
      )
        return true;
    return (
      text &&
      api.board
        .near(x, y, TANK_RADIUS)
        .some((g) => g.rect && overlapsCircle(point, g.rect))
    );
  }
  function freePosition(
    x: number,
    y: number,
    ignore?: BoardTarget,
  ): Point | null {
    for (let ring = 0; ring < 9; ring++)
      for (let i = 0; i < (ring ? 12 : 1); i++) {
        const angle = (i * Math.PI) / 6;
        const px = clamp(x + Math.cos(angle) * ring * 24, 16, api.width - 16);
        const py = clamp(y + Math.sin(angle) * ring * 24, 16, api.height - 16);
        if (
          !blocked(px, py, ignore) &&
          !tanks.some((t) => Math.hypot(t.x - px, t.y - py) < 24)
        )
          return { x: px, y: py };
      }
    return null;
  }
  function placePlayer() {
    const position = freePosition(api.width * 0.5, api.height * 0.7);
    if (position) Object.assign(player, position);
    else {
      // A densely typeset page still has a playable deployment area; hard cover remains solid.
      let found = false;
      for (let y = 40; y < api.height && !found; y += 32)
        for (let x = 40; x < api.width; x += 32) {
          if (blocked(x, y, undefined, false)) continue;
          player.x = x;
          player.y = y;
          for (const g of api.board.near(x, y, 24)) api.board.consume(g);
          found = true;
          break;
        }
      if (!found)
        throw new Error(
          "Sherman Bytes: no space to deploy. Choose a smaller wallSelector or a larger board.",
        );
    }
    shield = 1.8;
  }
  function award(n: number, experience: number, x: number, y: number) {
    score += n;
    xp += experience;
    api.popup(x, y, `+${n}`);
    const tier = cannonTier(xp);
    if (tier > cannon) {
      cannon = tier;
      player.fireIn = 0;
      api.popup(
        player.x,
        player.y - 28,
        `${cannonName(tier)} ONLINE`,
        "upgrade",
      );
      api.emit("cannon-upgrade", { cannon, xp });
    }
  }
  function breach(x: number, y: number, credited: boolean, radius: number) {
    for (const glyph of api.board.near(x, y, radius)) {
      consume(glyph, credited);
    }
  }
  function move(tank: Tank, dx: number, dy: number) {
    // Substeps plus axis sliding stop a fast tank crossing a thin glyph between frames.
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 4));
    let moved = false;
    for (let i = 0; i < steps; i++) {
      if (!blocked(tank.x + dx / steps, tank.y)) {
        tank.x += dx / steps;
        moved = moved || dx !== 0;
      }
      if (!blocked(tank.x, tank.y + dy / steps)) {
        tank.y += dy / steps;
        moved = moved || dy !== 0;
      }
    }
    if (moved) tank.tread += Math.hypot(dx, dy) / 6;
    return moved;
  }
  function shoot(
    origin: Point,
    angle: number,
    friendly: boolean,
    owned: boolean,
    power = 25,
    source: Structure | null = null,
  ) {
    const shell = shellPool.acquire();
    if (!shell) return;
    // Begin inside the tank radius: the swept ray also catches terrain touching the muzzle.
    Object.assign(shell, {
      x: origin.x,
      y: origin.y,
      vx: Math.cos(angle) * (friendly ? 510 : 260),
      vy: Math.sin(angle) * (friendly ? 510 : 260),
      life: friendly ? 1.3 : 2,
      friendly,
      player: owned,
      power,
      source,
    });
  }
  function spawn(): boolean {
    if (tankPool.size >= (siege ? waves.limit : MAX_TANKS)) return false;
    const available = [...bases.values()].filter(
      (b) =>
        !b.captured && b.target.health > 0 && b.target.visible && b.target.rect,
    );
    let location: Point | null = null;
    let base: Base | undefined;
    if (available.length) {
      base = available[spawnCursor++ % available.length]!;
      const r = base.target.rect!;
      location = freePosition((r.left + r.right) / 2, r.bottom + 42);
    } else if (siege && bases.size) {
      // Capturing the factories changes the front: reinforcements arrive at page edges.
      const edge = spawnCursor++ % 4;
      location = freePosition(
        edge === 0
          ? 22
          : edge === 1
            ? api.width - 22
            : api.width * (0.2 + api.random() * 0.6),
        edge === 2
          ? 22
          : edge === 3
            ? api.height - 22
            : api.height * (0.2 + api.random() * 0.6),
      );
    }
    if (
      !location ||
      Math.hypot(location.x - player.x, location.y - player.y) < 70
    )
      return false;
    const tank = tankPool.acquire();
    if (!tank) return false;
    const heavy =
      (siege ? waves.wave >= 2 : api.time > 24) && api.random() > 0.55;
    Object.assign(tank, {
      ...location,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      turret: -Math.PI / 2,
      hp: heavy ? 70 : 35,
      heavy,
      fireIn: 1.2,
      tread: 0,
      flash: 0,
      recoil: 0,
      age: 0,
      flank: spawnCursor % 2 ? 1 : -1,
    });
    api.emit("spawn", {
      base: base?.target.id ?? "reinforcement",
      heavy,
      wave: waves.wave,
    });
    api.burst(location.x, location.y, COLORS.enemy, 6);
    return true;
  }
  function hitTank(tank: Tank, power: number, credited: boolean) {
    tank.hp -= power;
    tank.flash = 0.13;
    if (tank.hp > 0) return;
    tankPool.release(tank);
    kills++;
    if (credited) {
      award(tank.heavy ? 150 : 100, tank.heavy ? 8 : 5, tank.x, tank.y);
      salvage(tank.heavy ? 4 : 2);
    }
    api.burst(tank.x, tank.y, tank.heavy ? COLORS.heavy : COLORS.enemy, 12);
    api.emit("tank-destroyed", { heavy: tank.heavy });
  }
  function hurt(power: number) {
    if (shield > 0) return;
    player.hp = Math.max(0, player.hp - power);
    shield = 0.6;
    player.flash = 0.2;
    api.emit("hurt", { armor: player.hp });
    api.popup(player.x, player.y, `−${power} ARMOR`, "hurt");
    api.burst(player.x, player.y, COLORS.enemy, 7);
    if (player.hp <= 0) {
      ended = true;
      api.finish(false);
    }
  }
  function updateShells(dt: number) {
    for (let i = shells.length - 1; i >= 0; i--) {
      const shell = shells[i]!;
      previous.x = shell.x;
      previous.y = shell.y;
      next.x = shell.x + shell.vx * dt;
      next.y = shell.y + shell.vy * dt;
      let closest = Infinity;
      let hit: Hit | null = null;
      const choose = (t: number | null, candidate: Hit) => {
        if (t !== null && t < closest) {
          closest = t;
          hit = candidate;
        }
      };
      for (const wall of terrain.walls)
        choose(segmentHit(previous, next, wall, 2), { kind: "wall" });
      for (const item of structures)
        if (active(item) && item !== shell.source)
          choose(segmentHit(previous, next, item.rect, 2), {
            kind: "structure",
            structure: item,
          });
      const glyph = api.board.hitSegment(previous, next);
      if (glyph) choose(glyph.t, { kind: "glyph", glyph: glyph.glyph });
      for (const base of bases.values())
        if (base.target.visible && base.target.health > 0 && base.target.rect)
          choose(segmentHit(previous, next, base.target.rect, 2), {
            kind: "base",
            base,
          });
      if (shell.friendly) {
        for (const tank of tanks)
          choose(
            segmentHit(
              previous,
              next,
              {
                left: tank.x - 11,
                right: tank.x + 11,
                top: tank.y - 11,
                bottom: tank.y + 11,
              },
              2,
            ),
            { kind: "tank", tank },
          );
      } else
        choose(
          segmentHit(
            previous,
            next,
            {
              left: player.x - 10,
              right: player.x + 10,
              top: player.y - 10,
              bottom: player.y + 10,
            },
            2,
          ),
          { kind: "player" },
        );
      shell.x = next.x;
      shell.y = next.y;
      shell.life -= dt;
      if (hit) {
        const collision = hit as Hit;
        const x = previous.x + (next.x - previous.x) * closest,
          y = previous.y + (next.y - previous.y) * closest;
        if (collision.kind === "glyph") {
          consume(collision.glyph, shell.player);
          // A crater is wider than the tank, so one hit opens a useful route.
          breach(x, y, shell.player, shell.player && cannon >= 2 ? 31 : 22);
        } else if (collision.kind === "structure") {
          const item = collision.structure;
          item.hp = Math.max(0, item.hp - shell.power);
          if (item.hp === 0) {
            if (item.kind === "mine") detonate(item);
            else if (item.base && shell.player) {
              award(20, 2, x, y);
              salvage(1);
            }
            api.emit("structure-destroyed", { kind: item.kind });
          }
        } else if (collision.kind === "tank")
          hitTank(collision.tank, shell.power, shell.player);
        else if (collision.kind === "player") hurt(shell.power);
        else if (collision.kind === "base" && shell.player) {
          api.board.damage(collision.base.target, shell.power, { x, y });
          award(10, 2, x, y);
          if (collision.base.target.health === 0) {
            api.popup(x, y, "DRIVE ONTO BASE", "upgrade");
            api.emit("base-disabled", { base: collision.base.target.id });
          }
        }
        api.burst(x, y, shell.friendly ? COLORS.shell : COLORS.enemy, 5);
        shellPool.releaseAt(i);
      } else if (
        shell.life <= 0 ||
        shell.x < -50 ||
        shell.x > api.width + 50 ||
        shell.y < -50 ||
        shell.y > api.height + 50
      )
        shellPool.releaseAt(i);
    }
  }
  function updateBases(dt: number) {
    for (const base of bases.values()) {
      const target = base.target;
      if (!target.visible || !target.rect) continue;
      const c = center(target.rect);
      const touching = overlapsCircle(player, target.rect, TANK_RADIUS + 2);
      if (!base.captured && target.health <= 0) {
        base.capture = touching
          ? Math.min(0.7, base.capture + dt)
          : Math.max(0, base.capture - dt);
        if (base.capture >= 0.7) {
          base.captured = true;
          salvage(8);
          award(300, 12, c.x, c.y);
          api.popup(c.x, c.y, "BASE CAPTURED", "upgrade");
          api.emit("base-captured", { base: target.id });
        }
      }
      if (base.captured) {
        if (touching) player.hp = Math.min(100, player.hp + 18 * dt);
        base.fireIn -= dt;
        if (base.fireIn <= 0) {
          let enemy: Tank | undefined,
            distance = 290;
          for (const tank of tanks) {
            const d = Math.hypot(c.x - tank.x, c.y - tank.y);
            if (d < distance) {
              distance = d;
              enemy = tank;
            }
          }
          if (enemy) {
            // Lead a moving tank; aiming at its current position misses orbiting scouts.
            const flight = distance / 510;
            shoot(
              c,
              Math.atan2(
                enemy.y + enemy.vy * flight - c.y,
                enemy.x + enemy.vx * flight - c.x,
              ),
              true,
              false,
              35,
            );
            base.fireIn = 0.95;
          }
        }
      }
    }
  }
  function clearBuildSite(rect: Rect) {
    if (
      rect.left < 14 ||
      rect.top < 14 ||
      rect.right > api.width - 14 ||
      rect.bottom > api.height - 14
    )
      return false;
    if (
      overlapsCircle(player, rect, 14) ||
      tanks.some((t) => overlapsCircle(t, rect, 14))
    )
      return false;
    if (terrain.walls.some((r) => intersects(rect, r))) return false;
    if (structures.some((item) => active(item) && intersects(rect, item.rect)))
      return false;
    for (const base of bases.values())
      if (
        base.target.visible &&
        base.target.rect &&
        intersects(rect, base.target.rect)
      )
        return false;
    const c = center(rect);
    return !api.board
      .near(c.x, c.y, Math.max(rect.width, rect.height) / 2 + 12)
      .some((g) => g.rect && intersects(rect, g.rect));
  }
  function action(id: string) {
    if (ended || !["cover", "pillbox", "mine"].includes(id)) return;
    if (construction) {
      api.popup(player.x, player.y - 28, "ENGINEER BUSY", "hurt");
      return;
    }
    const kind = id as BuildKind,
      rect = buildRect(player, kind),
      cost = BUILD_COST[kind];
    if (scrap < cost) {
      api.popup(player.x, player.y - 28, `NEED ${cost} SCRAP`, "hurt");
      return;
    }
    if (
      structures.filter((s) => s.kind === kind && s.hp > 0).length >=
      BUILD_CAP[kind]
    ) {
      api.popup(player.x, player.y - 28, `${kind.toUpperCase()} LIMIT`, "hurt");
      return;
    }
    if (!clearBuildSite(rect)) {
      api.popup(player.x, player.y - 28, "CLEAR THE BUILD SITE", "hurt");
      return;
    }
    scrap -= cost;
    construction = {
      kind,
      rect,
      from: { x: player.x, y: player.y },
      progress: 0,
      cost,
    };
    api.emit("build-start", { kind, cost });
  }
  function detonate(mine: Structure) {
    mine.hp = 0;
    const c = center(mine.rect);
    for (let i = tanks.length - 1; i >= 0; i--) {
      const t = tanks[i]!;
      if (Math.hypot(t.x - c.x, t.y - c.y) < 70) hitTank(t, 95, true);
    }
    breach(c.x, c.y, true, 38);
    api.burst(c.x, c.y, COLORS.shell, 18);
    api.emit("mine-detonated", {});
  }
  function updateFortifications(dt: number) {
    if (construction) {
      construction.progress += dt;
      if (construction.progress >= 0.65) {
        const job = construction;
        construction = null;
        if (clearBuildSite(job.rect)) {
          const hp =
            job.kind === "cover" ? 110 : job.kind === "pillbox" ? 100 : 1;
          structures.push({
            kind: job.kind,
            rect: job.rect,
            hp,
            maxHp: hp,
            base: null,
            side: 0,
            fireIn: 0.3,
            angle: player.turret,
          });
          const c = center(job.rect);
          api.popup(c.x, c.y, `${job.kind.toUpperCase()} READY`, "upgrade");
          api.emit("structure-built", { kind: job.kind, x: c.x, y: c.y });
        } else {
          salvage(job.cost);
          api.popup(
            player.x,
            player.y - 28,
            "BUILD BLOCKED / REFUNDED",
            "hurt",
          );
        }
      }
    }
    for (const item of structures) {
      if (!active(item) || item.base) continue;
      const c = center(item.rect);
      if (
        item.rect.right < 0 ||
        item.rect.bottom < 0 ||
        item.rect.left > api.width ||
        item.rect.top > api.height
      )
        continue;
      if (item.kind === "mine") {
        if (tanks.some((t) => Math.hypot(t.x - c.x, t.y - c.y) < 24))
          detonate(item);
      } else if (item.kind === "pillbox") {
        item.fireIn -= dt;
        let target: Tank | undefined,
          range = 330;
        for (const t of tanks) {
          const d = Math.hypot(t.x - c.x, t.y - c.y);
          if (d < range) {
            target = t;
            range = d;
          }
        }
        if (target) {
          const flight = range / 510;
          item.angle = Math.atan2(
            target.y + target.vy * flight - c.y,
            target.x + target.vx * flight - c.x,
          );
          if (item.fireIn <= 0) {
            shoot(c, item.angle, true, true, 35, item);
            item.fireIn = 0.65;
          }
        }
      }
    }
    for (let i = structures.length - 1; i >= 0; i--)
      if (!structures[i]!.base && structures[i]!.hp <= 0)
        structures.splice(i, 1);
    // Supplies are earned only while occupying a captured base; no hidden timer runs.
    const supplied = [...bases.values()].some(
      (b) =>
        b.captured &&
        b.target.visible &&
        b.target.rect &&
        overlapsCircle(player, b.target.rect, 12),
    );
    supplyClock = supplied ? supplyClock + dt : 0;
    if (supplyClock >= 2.5) {
      salvage(1);
      supplyClock -= 2.5;
    }
  }
  function drawFortifications(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.lineWidth = 1;
    for (const item of structures) {
      if (item.base || !active(item)) continue;
      const r = item.rect;
      if (
        r.right < 0 ||
        r.bottom < 0 ||
        r.left > api.width ||
        r.top > api.height
      )
        continue;
      const c = center(r),
        color = COLORS.captured;
      ctx.fillStyle = "#241a35";
      ctx.strokeStyle = color;
      if (item.kind === "mine") {
        ctx.fillRect(c.x - 6, c.y - 4, 12, 8);
        ctx.strokeRect(c.x - 7, c.y - 5, 14, 10);
        ctx.fillStyle = COLORS.shell;
        ctx.fillRect(c.x - 2, c.y - 2, 4, 4);
      } else if (item.kind === "pillbox") {
        ctx.fillRect(r.left, r.top, r.width, r.height);
        ctx.strokeRect(r.left, r.top, r.width, r.height);
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(item.angle);
        ctx.fillStyle = COLORS.captured;
        ctx.fillRect(-6, -6, 12, 12);
        ctx.fillRect(4, -2, 17, 4);
        ctx.restore();
      } else {
        ctx.fillRect(r.left, r.top, r.width, r.height);
        ctx.strokeRect(r.left, r.top, r.width, r.height);
        ctx.beginPath();
        if (r.width > r.height)
          for (let x = r.left + 12; x < r.right; x += 14) {
            ctx.moveTo(x, r.top + 2);
            ctx.lineTo(x, r.bottom - 2);
          }
        else
          for (let y = r.top + 12; y < r.bottom; y += 14) {
            ctx.moveTo(r.left + 2, y);
            ctx.lineTo(r.right - 2, y);
          }
        ctx.stroke();
      }
      if (item.hp < item.maxHp) {
        ctx.fillStyle = "#0c151a";
        ctx.fillRect(r.left, r.bottom + 3, r.width, 3);
        ctx.fillStyle = color;
        ctx.fillRect(r.left, r.bottom + 3, (r.width * item.hp) / item.maxHp, 3);
      }
    }
    if (construction) {
      const job = construction,
        c = center(job.rect),
        t = Math.min(1, job.progress / 0.65);
      ctx.strokeStyle = COLORS.captured;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(
        job.rect.left,
        job.rect.top,
        job.rect.width,
        job.rect.height,
      );
      ctx.setLineDash([]);
      const x = job.from.x + (c.x - job.from.x) * t,
        y = job.from.y + (c.y - job.from.y) * t;
      ctx.fillStyle = "#06c4ff";
      ctx.fillRect(x - 3, y - 5, 6, 4);
      ctx.fillStyle = "#f4457a";
      ctx.fillRect(x - 4, y - 1, 8, 6);
      ctx.fillRect(x - 4, y + 5, 3, 4);
      ctx.fillRect(x + 1, y + 5, 3, 4);
    }
    ctx.restore();
  }
  const reset = () => {
    tankPool.clear();
    shellPool.clear();
    bases.clear();
    structures.length = 0;
    construction = null;
    scrap = 16;
    salvaged = 0;
    supplyClock = 0;
    waves.reset();
    supplies.reset();
    supplyIn = 8;
    supplyTurn = 0;
    api.board.resetTargets(BASE_HEALTH);
    syncBases();
    score = xp = kills = 0;
    cannon = 1;
    spawnIn = 2.5;
    spawnCursor = 0;
    ended = false;
    relocate = false;
    Object.assign(player, {
      hp: 100,
      angle: -Math.PI / 2,
      turret: -Math.PI / 2,
      fireIn: 0,
      tread: 0,
      flash: 0,
      recoil: 0,
    });
    terrain.refresh(api.time, true);
    placePlayer();
  };
  function update(dt: number) {
    if (ended) return;
    syncBases();
    terrain.refresh(api.time);
    if (relocate || player.x > api.width - 14 || player.y > api.height - 14) {
      placePlayer();
      relocate = false;
    }
    shield = Math.max(0, shield - dt);
    player.flash = Math.max(0, player.flash - dt);
    player.recoil = Math.max(0, player.recoil - dt * 24);
    player.fireIn -= dt;
    const keys = api.input.keys;
    const dx =
      Number(keys.has("ArrowRight") || keys.has("KeyD")) -
      Number(keys.has("ArrowLeft") || keys.has("KeyA"));
    const dy =
      Number(keys.has("ArrowDown") || keys.has("KeyS")) -
      Number(keys.has("ArrowUp") || keys.has("KeyW"));
    if (dx || dy) {
      const goal = Math.atan2(dy, dx);
      player.angle = turnToward(player.angle, goal, 5 * dt);
      const speed = (175 * dt) / Math.hypot(dx, dy);
      move(player, dx * speed, dy * speed);
    }
    const aim = api.input.pointer;
    player.turret = aim.active
      ? Math.atan2(aim.y - player.y, aim.x - player.x)
      : player.angle;
    if (api.firing && player.fireIn <= 0) {
      shoot(player, player.turret, true, true, cannon === 1 ? 25 : 35);
      player.fireIn = cannon === 3 ? 0.16 : cannon === 2 ? 0.24 : 0.32;
      player.recoil = 4;
      api.emit("fire");
    }
    if (siege && bases.size) {
      const transition = waves.update(dt, tanks.length);
      if (transition === "start") {
        api.popup(
          player.x,
          player.y - 40,
          `WAVE ${waves.wave} / INCOMING`,
          "hurt",
        );
        api.emit("wave-start", { wave: waves.wave });
      }
      if (transition === "clear") {
        salvage(4);
        player.hp = Math.min(100, player.hp + 12);
        api.popup(player.x, player.y - 40, "WAVE CLEAR / FORTIFY", "upgrade");
        api.emit("wave-clear", { wave: waves.wave });
      }
      if (waves.ready) {
        const count = Math.min(3, waves.remaining);
        for (let n = 0; n < count; n++) if (spawn()) waves.spawned();
        waves.rest();
      }
    } else if (!siege) {
      spawnIn -= dt;
      if (spawnIn <= 0) {
        spawn();
        spawnIn = Math.max(0.85, 2.5 - api.time * 0.015);
      }
    }
    for (let i = tanks.length - 1; i >= 0; i--) {
      const tank = tanks[i]!;
      if (
        tank.x < -250 ||
        tank.y < -250 ||
        tank.x > api.width + 250 ||
        tank.y > api.height + 250
      ) {
        tankPool.releaseAt(i);
        continue;
      }
      tank.age += dt;
      tank.fireIn -= dt;
      tank.flash = Math.max(0, tank.flash - dt);
      tank.recoil = Math.max(0, tank.recoil - dt * 24);
      const distance = Math.hypot(player.x - tank.x, player.y - tank.y);
      tank.turret = Math.atan2(player.y - tank.y, player.x - tank.x);
      let movement = tank.turret;
      if (distance < 160)
        movement += distance < 75 ? Math.PI : (tank.flank * Math.PI) / 2;
      const speed = (tank.heavy ? 52 : 75) * dt;
      const oldX = tank.x,
        oldY = tank.y;
      let moved = false;
      for (const offset of [0, 0.8, -0.8, 1.6, -1.6]) {
        const angle = movement + offset;
        if (
          !blocked(tank.x + Math.cos(angle) * 18, tank.y + Math.sin(angle) * 18)
        ) {
          moved = move(tank, Math.cos(angle) * speed, Math.sin(angle) * speed);
          tank.angle = turnToward(tank.angle, angle, dt * 3);
          break;
        }
      }
      tank.vx = dt > 0 ? (tank.x - oldX) / dt : 0;
      tank.vy = dt > 0 ? (tank.y - oldY) / dt : 0;
      if (tank.fireIn <= 0 && (distance < 420 || !moved)) {
        shoot(
          tank,
          tank.turret + (api.random() - 0.5) * 0.12,
          false,
          false,
          tank.heavy ? 20 : 12,
        );
        tank.fireIn = tank.heavy ? 1.8 : 2.3;
        tank.recoil = 4;
      }
      if (distance < 21) hurt(8);
    }
    supplyIn -= dt;
    if (supplyIn <= 0) {
      supplyIn = 14;
      const location = freePosition(
        clamp(player.x + 100, 25, api.width - 25),
        clamp(player.y - 80, 90, api.height - 25),
      );
      const kind = supplyTurn++ % 2 ? "repair" : "scrap";
      if (location && supplies.spawn(location, kind))
        api.emit("supply-drop", { kind });
    }
    supplies.update(dt, player, (kind) => {
      if (kind === "repair") {
        player.hp = Math.min(100, player.hp + 25);
        api.popup(player.x, player.y - 28, "+25 ARMOR", "upgrade");
      } else {
        salvage(6);
        api.popup(player.x, player.y - 28, "+6 SCRAP", "upgrade");
      }
      api.emit("supply-collected", { kind });
    });
    updateFortifications(dt);
    updateShells(dt);
    if (ended) return;
    updateBases(dt);
    if (
      !siege &&
      bases.size > 0 &&
      [...bases.values()].every((b) => b.captured) &&
      !tanks.length
    ) {
      ended = true;
      api.finish(true);
    }
  }
  function draw(ctx: CanvasRenderingContext2D) {
    drawFortifications(ctx);
    supplies.draw(ctx);
    renderer ??= tankSprites(api.options.document ?? globalThis.document);
    ctx.save();
    ctx.lineWidth = 1;
    basePresentation.update(bases.values());
    for (const shell of shells) {
      ctx.fillStyle = shell.friendly ? COLORS.shell : COLORS.enemy;
      ctx.fillRect(Math.round(shell.x) - 3, Math.round(shell.y) - 3, 6, 6);
    }
    for (const tank of tanks)
      renderer(
        ctx,
        tank.x,
        tank.y,
        tank.angle,
        tank.turret,
        tank.heavy ? COLORS.heavy : COLORS.enemy,
        tank.tread,
        api.reducedMotion ? 0 : tank.recoil,
        tank.flash > 0,
        tank.heavy ? 1.12 : 0.9,
      );
    renderer(
      ctx,
      player.x,
      player.y,
      player.angle,
      player.turret,
      COLORS.player,
      player.tread,
      api.reducedMotion ? 0 : player.recoil,
      player.flash > 0,
    );
    if (shield > 0) {
      ctx.strokeStyle = COLORS.captured;
      ctx.lineWidth = 1;
      ctx.strokeRect(player.x - 20, player.y - 20, 40, 40);
    }
    if (api.input.pointer.active) {
      const { x, y } = api.input.pointer;
      ctx.strokeStyle = COLORS.shell;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 9, y);
      ctx.lineTo(x - 3, y);
      ctx.moveTo(x + 3, y);
      ctx.lineTo(x + 9, y);
      ctx.moveTo(x, y - 9);
      ctx.lineTo(x, y - 3);
      ctx.moveTo(x, y + 3);
      ctx.lineTo(x, y + 9);
      ctx.stroke();
    }
    ctx.restore();
  }
  function snapshot(): ShermanBytesStats {
    let captured = 0,
      barriers = 0,
      cover = 0,
      pillboxes = 0,
      mines = 0;
    for (const base of bases.values()) if (base.captured) captured++;
    for (const item of structures) {
      if (item.hp <= 0) continue;
      if (item.base) barriers++;
      if (item.kind === "cover") cover++;
      if (item.kind === "pillbox") pillboxes++;
      if (item.kind === "mine") mines++;
    }
    const nextXP = cannon === 1 ? 20 : 60;
    return {
      score,
      lives: Math.ceil(player.hp / 25),
      wave: siege ? waves.wave : 1,
      armor: Math.ceil(player.hp),
      kills,
      alive: tanks.length,
      shells: shells.length,
      supplies: supplies.size,
      captured,
      bases: bases.size,
      cannon,
      xp,
      scrap,
      phase: siege ? waves.phase : "conquest",
      incoming: siege ? waves.remaining : 0,
      countdown: Math.ceil(waves.countdown),
      barriers,
      cover,
      pillboxes,
      mines,
      building: construction?.kind ?? null,
      player: {
        x: player.x,
        y: player.y,
        angle: player.angle,
        turret: player.turret,
      },
      detail: `${Math.ceil(player.hp)}% ARMOR · ${scrap} SCRAP · ${captured}/${bases.size} BASES · ${!bases.size ? "No bases: practice mode" : siege ? (waves.phase === "assault" ? `${waves.remaining} INCOMING` : `${waves.phase === "prepare" ? "DEPLOY" : "FORTIFY"} ${Math.ceil(waves.countdown)}s`) : "CONQUEST"}`,
      hud: {
        resource: `${scrap} SCRAP`,
        health: `${Math.ceil(player.hp)}% ARMOR`,
        kills,
        alive: tanks.length,
        combo: 1,
        label: cannonName(cannon),
        progress: cannon === 3 ? 1 : xp / nextXP,
        progressText: cannon === 3 ? "FULL FIREPOWER" : `${xp}/${nextXP} XP`,
      },
    };
  }
  function scroll(dx: number, dy: number) {
    player.x -= dx;
    player.y -= dy;
    translateEntities(tanks, dx, dy);
    translateEntities(shells, dx, dy);
    supplies.scroll(dx, dy);
    terrain.invalidate();
    for (const item of structures)
      if (!item.base) {
        item.rect.left -= dx;
        item.rect.right -= dx;
        item.rect.top -= dy;
        item.rect.bottom -= dy;
      }
    if (construction) {
      construction.from.x -= dx;
      construction.from.y -= dy;
      construction.rect.left -= dx;
      construction.rect.right -= dx;
      construction.rect.top -= dy;
      construction.rect.bottom -= dy;
    }
    if (
      player.x < 14 ||
      player.x > api.width - 14 ||
      player.y < 14 ||
      player.y > api.height - 14
    )
      relocate = true;
  }
  return { reset, update, draw, snapshot, scroll, action };
}
