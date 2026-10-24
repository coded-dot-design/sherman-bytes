import {
  EntityPool,
  segmentHit,
  translateEntities,
  clamp,
} from "@coded-design/dom-virus";
import type {
  GameContext,
  GameSimulation,
  GameStats,
  Point,
  BoardTarget,
  Glyph,
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
}
interface Shell extends Point {
  vx: number;
  vy: number;
  life: number;
  friendly: boolean;
  player: boolean;
  power: number;
}
interface Base {
  target: BoardTarget;
  captured: boolean;
  capture: number;
  fireIn: number;
}
export interface ShermanBytesStats extends GameStats {
  score: number;
  lives: number;
  wave: number;
  kills: number;
  alive: number;
  shells: number;
  armor: number;
  captured: number;
  bases: number;
  cannon: number;
  xp: number;
  player: Point & { angle: number; turret: number };
  detail: string;
}
type Hit =
  | { kind: "glyph"; glyph: Glyph }
  | { kind: "tank"; tank: Tank }
  | { kind: "base"; base: Base }
  | { kind: "wall" }
  | { kind: "player" };

export function createGame(
  api: GameContext,
  terrain: Terrain,
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
  }));
  const tanks = tankPool.active,
    shells = shellPool.active;
  const bases = new Map<BoardTarget, Base>();
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
  const point: Point = { x: 0, y: 0 };
  const previous: Point = { x: 0, y: 0 };
  const next: Point = { x: 0, y: 0 };
  function syncBases() {
    for (const target of api.board.targets)
      if (!bases.has(target))
        bases.set(target, { target, captured: false, capture: 0, fireIn: 0.8 });
    for (const target of bases.keys())
      if (!api.board.targets.includes(target)) bases.delete(target);
  }
  function blocked(x: number, y: number, ignore?: BoardTarget, text = true) {
    if (x < 14 || y < 14 || x > api.width - 14 || y > api.height - 14)
      return true;
    point.x = x;
    point.y = y;
    for (const wall of terrain.walls)
      if (overlapsCircle(point, wall)) return true;
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
        if (!blocked(px, py, ignore)) return { x: px, y: py };
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
      if (api.board.consume(glyph) && credited) award(5, 1, x, y);
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
    });
  }
  function spawn() {
    const available = [...bases.values()].filter(
      (b) =>
        !b.captured && b.target.health > 0 && b.target.visible && b.target.rect,
    );
    if (!available.length || tankPool.size >= MAX_TANKS) return;
    const base = available[spawnCursor++ % available.length]!;
    const rect = base.target.rect!;
    const c = center(rect);
    // Exit beside a base, never from inside its collision rectangle.
    const location = freePosition(c.x, rect.bottom + 24);
    if (
      !location ||
      Math.hypot(location.x - player.x, location.y - player.y) < 65
    )
      return;
    const tank = tankPool.acquire();
    if (!tank) return;
    const heavy = api.time > 24 && api.random() > 0.65;
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
    });
    api.emit("spawn", { base: base.target.id, heavy });
    api.burst(location.x, location.y, COLORS.enemy, 6);
  }
  function hitTank(tank: Tank, power: number, credited: boolean) {
    tank.hp -= power;
    tank.flash = 0.13;
    if (tank.hp > 0) return;
    tankPool.release(tank);
    kills++;
    if (credited)
      award(tank.heavy ? 150 : 100, tank.heavy ? 8 : 5, tank.x, tank.y);
    api.burst(tank.x, tank.y, tank.heavy ? COLORS.heavy : COLORS.enemy, 12);
    api.emit("tank-destroyed", { heavy: tank.heavy });
  }
  function hurt(power: number) {
    if (shield > 0) return;
    player.hp = Math.max(0, player.hp - power);
    shield = 0.6;
    player.flash = 0.2;
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
          if (api.board.consume(collision.glyph) && shell.player)
            award(5, 1, x, y);
          // A crater is wider than the tank, so one hit opens a useful route.
          breach(x, y, shell.player, shell.player && cannon >= 2 ? 31 : 22);
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
  const reset = () => {
    tankPool.clear();
    shellPool.clear();
    bases.clear();
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
    }
    spawnIn -= dt;
    if (spawnIn <= 0) {
      spawn();
      spawnIn = Math.max(0.85, 2.5 - api.time * 0.015);
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
      if (distance < 160) movement += distance < 75 ? Math.PI : Math.PI / 2;
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
    updateShells(dt);
    if (ended) return;
    updateBases(dt);
    if (
      bases.size > 0 &&
      [...bases.values()].every((b) => b.captured) &&
      !tanks.length
    ) {
      ended = true;
      api.finish(true);
    }
  }
  function draw(ctx: CanvasRenderingContext2D) {
    renderer ??= tankSprites(api.options.document ?? globalThis.document);
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#f9bf62";
    for (const wall of terrain.walls) {
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(
        wall.left - 2,
        wall.top - 2,
        wall.width + 4,
        wall.height + 4,
      );
    }
    ctx.setLineDash([]);
    for (const base of bases.values()) {
      const r = base.target.rect;
      if (!base.target.visible || !r) continue;
      const c = center(r);
      if (base.captured || base.target.health <= 0) {
        ctx.strokeStyle = base.captured ? COLORS.captured : COLORS.shell;
        ctx.lineWidth = 2;
        ctx.strokeRect(r.left - 4, r.top - 4, r.width + 8, r.height + 8);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(
          base.captured ? "FRIENDLY / REPAIR" : "DRIVE ONTO BASE",
          c.x,
          r.top - 9,
        );
        if (!base.captured)
          ctx.fillRect(r.left, r.bottom + 5, (r.width * base.capture) / 0.7, 3);
        else {
          ctx.fillRect(c.x - 2, r.bottom + 5, 4, 10);
          ctx.fillRect(c.x - 5, r.bottom + 8, 10, 4);
        }
      }
    }
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
    const captured = [...bases.values()].filter((b) => b.captured).length;
    const nextXP = cannon === 1 ? 20 : 60;
    return {
      score,
      lives: Math.ceil(player.hp / 25),
      wave: 1,
      armor: Math.ceil(player.hp),
      kills,
      alive: tanks.length,
      shells: shells.length,
      captured,
      bases: bases.size,
      cannon,
      xp,
      player: {
        x: player.x,
        y: player.y,
        angle: player.angle,
        turret: player.turret,
      },
      detail: `${Math.ceil(player.hp)}% ARMOR · ${captured}/${bases.size} BASES · ${bases.size ? "WASD drive · Mouse aim · Space fire" : "No bases found: adjust targetSelector"}`,
      hud: {
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
    terrain.invalidate();
    if (
      player.x < 14 ||
      player.x > api.width - 14 ||
      player.y < 14 ||
      player.y > api.height - 14
    )
      relocate = true;
  }
  return { reset, update, draw, snapshot, scroll };
}
