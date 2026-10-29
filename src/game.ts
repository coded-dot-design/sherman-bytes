// Sherman Bytes on Fizlet: a tank battle on the page. Its words are terrain (a shell blasts letters
// into 0s and 1s and opens a route), its buttons are enemy bases with walls, and [data-sherman-wall]
// elements are hard cover. Drive onto a disabled base to capture it; build cover, pillboxes and mines
// with scrap. Recall gives every letter and button back. The shell (engine per run, page, overlay,
// scoreboard, keys, touch pad, sound, sparks, popups, the controller the DOM VIRUS hub drives) is
// fizlet/arcade; the rules are ./world. This file is the game's definition: the read-phase page work
// (hard cover, bases), its scoreboard, how it reacts to what happens, and its art.
import { arcade, CALM, PON, PX, PY, TARGET_HP, VH, VW } from "../vendor/fizlet/arcade";
import type { BoardTarget } from "../vendor/fizlet/board-page";
import { BASE_HEALTH, COLORS, cannonName } from "./rules.js";
import { tankSprites } from "./sprites.js";
import * as Wd from "./world.js";

declare const __KIT_CSS__: string;

// The public types are written out here (the same shapes as fizlet/arcade's), so the package's
// declarations stand alone: a consumer type-checks without the vendored engine.
export type ShermanBytesStatus = "idle" | "running" | "paused" | "won" | "gameover" | "destroyed";
export interface ShermanBytesStats {
  score: number;
  /** Armor in quarters (ceil(armor / 25)). */
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
  player: { x: number; y: number; angle: number; turret: number };
  detail: string;
}
export interface BattleOptions {
  /** "siege" (default): waves against the bases; "conquest": capture every base to win. */
  mode?: "siege" | "conquest";
  /** Walls around each base (default true). */
  fortifications?: boolean;
}
export interface ShermanBytesOptions extends BattleOptions {
  /** The board: a selector or an element (default document.body). */
  root?: string | Element;
  /** Text that becomes terrain (default headings, paragraphs, list items, blockquotes). */
  textSelector?: string;
  /** Elements that become enemy bases (default buttons and button-like links). */
  targetSelector?: string;
  /** More of the page to leave alone (fields, editable text and dialogs always are). */
  excludeSelector?: string;
  /** Hard cover: shells and tanks never pass (default [data-sherman-wall]). */
  wallSelector?: string;
  /** "system" (default) follows the visitor's colour scheme. */
  theme?: "dark" | "light" | "system";
  /** Same seed, same run (spawns, heavies, enemy aim). */
  seed?: number;
  /** Calm effects (default: the visitor's prefers-reduced-motion). */
  reducedMotion?: boolean;
  /** Start with sound on (default true; it waits for a click or key to unlock). */
  sound?: boolean;
  /** "keyboard": the mouse never aims (default: the mouse aims the turret). */
  controls?: "mouse" | "keyboard";
  onState?: (state: ShermanBytesSnapshot) => void;
  onEvent?: (event: { type: string; game: string; [key: string]: unknown }) => void;
  onError?: (error: unknown) => void;
}
export type ShermanBytesSnapshot = Partial<ShermanBytesStats> & {
  id: string;
  status: ShermanBytesStatus;
  elapsed: number;
  frameMs: number;
  maxFrameMs: number;
  notice: string;
  /** Letters indexed, on screen and turned to bits, and the range reads the last measurement made. */
  board?: { indexed: number; visible: number; spent: number; measurements: number };
  /** Sparks alive (at most 100). */
  particles?: number;
};
export interface ShermanBytesController {
  start(): ShermanBytesSnapshot;
  pause(): void;
  resume(): void;
  stop(): void;
  destroy(): void;
  getSnapshot(): ShermanBytesSnapshot;
}

const pad = (n: number, k: number) => String(n).padStart(k, "0");
/** Never hard cover: fields, opted-out parts and the game's own overlay. */
const NOT_COVER = "form,input,textarea,select,[contenteditable],[data-virus-ignore],[data-fizlet-ignore],[data-fizlet-host],[data-dom-virus-root],[data-swarm-ui]";
const BASE_CSS =
  '.base{position:absolute;inset:0;pointer-events:none}.wall{position:absolute;background:#321126;border:1px solid #ee6875;box-sizing:border-box}.wall:nth-child(1){left:-12px;right:-12px;top:-17px;height:10px}.wall:nth-child(2){left:-12px;right:-12px;bottom:-17px;height:10px}.wall:nth-child(3){top:-7px;bottom:-7px;left:-17px;width:10px}.wall:nth-child(4){top:-7px;bottom:-7px;right:-17px;width:10px}.wall::after{content:"";position:absolute;left:0;bottom:-5px;width:100%;height:3px;background:#ee6875;transform:scaleX(var(--health,1));transform-origin:left}.status{position:absolute;inset:-4px;border:2px solid currentColor;color:#06c4ff}.status[data-captured=true]{color:#4bce82}.label{position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);white-space:nowrap;font:bold 10px monospace;background:#151020;padding:2px 4px;color:inherit}.progress{position:absolute;top:calc(100% + 5px);left:0;width:100%;height:3px;background:currentColor;transform-origin:left}.status[data-captured=true] .progress{left:calc(50% - 5px);width:10px;height:10px;clip-path:polygon(30% 0,70% 0,70% 30%,100% 30%,100% 70%,70% 70%,70% 100%,30% 100%,30% 70%,0 70%,0 30%,30% 30%)}';

export function createShermanBytes(options: ShermanBytesOptions = {}): ShermanBytesController {
  return arcade<ShermanBytesStats>(
    {
      id: "sherman-bytes",
      title: "Sherman Bytes",
      color: COLORS.player,
      hint: "WASD / arrows: drive · Mouse: aim · Space: fire · B: cover · T: pillbox · M: mine",
      touchHint: "Drag the stick to drive · hold the target key to fire",
      css: __KIT_CSS__,
      fire: true,
      actions: [
        { id: "cover", key: "KeyB", label: "B · Cover 2" },
        { id: "pillbox", key: "KeyT", label: "T · Pillbox 8" },
        { id: "mine", key: "KeyM", label: "M · Mine 3" },
      ],
      // Folded (phones), the scoreboard keeps score, armor and scrap.
      readouts: [["Score", "team", (v) => pad(v, 6)], ["Wave", undefined, (v) => pad(v, 2), true], ["Armor", undefined, (v) => `${v}%`], ["Scrap"]],
      meter: { label: "Cannon upgrade progress" },
      colors: [COLORS.player, COLORS.enemy, COLORS.heavy, COLORS.shell],
      cues: { fire: "fire", "tank-destroyed": "boom", "mine-detonated": "boom", "base-disabled": "hit", hurt: "hurt", "wave:start": "ready", "wave:clear": "win", "drop:collect": "power", "base-captured": "power", level: "power", "build-start": "click", "structure-built": "click" },
      create(ctx) {
        const doc = document;
        const rootOption = options.root;
        const root = (typeof rootOption === "string" ? doc.querySelector(rootOption) : rootOption) ?? doc.body;
        const wallSelector = options.wallSelector ?? "[data-sherman-wall]";
        root.querySelectorAll(wallSelector); // a bad selector throws now, before the run starts
        const world = Wd.createWorld(ctx.engine, ctx.board, ctx.ctl, ctx.input, options);
        const { s, ctl } = world;
        const targets = ctx.board.targets;
        // Hard cover: measured every 0.25 s (at once after a scroll), each wall marked once.
        let coverAt = -1;
        const cover: Element[] = [], marked = new Set<Element>();
        function measureCover() {
          coverAt = ctx.engine.time + 0.25;
          cover.length = 0;
          const rects = world.walls.rects;
          let count = 0;
          for (const el of [...root.querySelectorAll(wallSelector)].slice(0, Wd.MAX_WALLS)) {
            if (el.closest(NOT_COVER) || (options.excludeSelector && el.closest(options.excludeSelector))) continue;
            cover.push(el);
            const r = el.getBoundingClientRect();
            if (r.width <= 0 || r.height <= 0 || r.right <= 0 || r.bottom <= 0 || r.left >= s[Wd.W]! || r.top >= s[Wd.H]!) continue;
            const st = getComputedStyle(el);
            if (st.display === "none" || st.visibility === "hidden" || st.opacity === "0") continue;
            rects[count * 4] = r.left; rects[count * 4 + 1] = r.top; rects[count * 4 + 2] = r.right; rects[count * 4 + 3] = r.bottom;
            count++;
          }
          world.walls.set(count);
        }
        const sync = () => ((s[Wd.W] = ctl[VW]!), (s[Wd.H] = ctl[VH]!), (s[Wd.REDUCED] = ctl[CALM]!), (ctl[TARGET_HP] = BASE_HEALTH));
        ctx.engine.add({
          read(e) {
            sync();
            if (e.time >= coverAt) measureCover();
            world.sync(targets);
          },
        });

        // ---------- Art ----------
        const sprite = tankSprites(doc);
        const kindName = (k: number) => Wd.KINDS[k]!.toUpperCase();
        const views = new Map<Element, { state: string; walls: HTMLElement[]; status: HTMLElement; label: HTMLElement; progress: HTMLElement }>();
        /** A base's walls, status and capture progress belong to the button itself (in-page art). */
        function drawBases() {
          const B = world.bases;
          for (let b = 0; b < B.count; b++) {
            const t = B.target[b] as BoardTarget | null;
            if (!t) continue;
            let view = views.get(t.el);
            if (!view) {
              const shadow = ctx.attach(t.el);
              if (!shadow) continue;
              const box = doc.createElement("div");
              box.setAttribute("data-sherman-base", "");
              box.innerHTML = `<style>${BASE_CSS}</style><div class="base"><i class="wall"></i><i class="wall"></i><i class="wall"></i><i class="wall"></i><div class="status"><span class="label"></span><i class="progress"></i></div></div>`;
              shadow.append(box);
              view = { state: "", walls: [...box.querySelectorAll<HTMLElement>(".wall")], status: box.querySelector(".status")!, label: box.querySelector(".label")!, progress: box.querySelector(".progress")! };
              views.set(t.el, view);
            }
            const st = world.structures;
            let state = `${B.captured[b]}|${t.hp <= 0}|${Math.round(B.progress[b]! * 100)}`;
            for (let side = 0; side < 4; side++) state += `|${B.walls[b * 4 + side]! >= 0 ? st.hp[B.walls[b * 4 + side]!] : -1}`;
            if (view.state === state) continue;
            view.state = state;
            for (let side = 0; side < 4; side++) {
              const k = B.walls[b * 4 + side]!, el = view.walls[side]!, hp = k >= 0 ? st.hp[k]! : 0;
              el.style.display = hp <= 0 ? "none" : "";
              if (k >= 0) el.style.setProperty("--health", String(hp / st.max[k]!));
            }
            view.status.style.display = B.captured[b] || t.hp <= 0 ? "" : "none";
            view.status.dataset.captured = String(!!B.captured[b]);
            const label = B.captured[b] ? "FRIENDLY / REPAIR" : "DRIVE ONTO BASE";
            if (view.label.textContent !== label) view.label.textContent = label;
            view.progress.style.transform = `scaleX(${B.captured[b] ? 1 : Math.min(1, B.progress[b]! / 0.7)})`;
          }
        }
        /** Hard cover gets a dashed outline, in the element itself. */
        function markCover() {
          for (const el of cover) {
            if (marked.has(el)) continue;
            marked.add(el);
            const shadow = ctx.attach(el);
            if (!shadow) continue;
            const marker = doc.createElement("i");
            marker.setAttribute("data-sherman-cover", "");
            marker.style.cssText = "position:absolute;inset:-2px;border:1px dashed #06c4ff;pointer-events:none;border-radius:inherit";
            shadow.append(marker);
          }
        }
        function drawStructures(g: CanvasRenderingContext2D) {
          const k = world.structures, W = s[Wd.W]!, H = s[Wd.H]!;
          g.save();
          g.lineWidth = 1;
          for (let i = 0; i < k.count; i++) {
            if (k.base[i]! >= 0 || !k.active(i)) continue;
            const l = k.l[i]!, t = k.t[i]!, r = k.r[i]!, b = k.b[i]!, w = r - l, h = b - t;
            if (r < 0 || b < 0 || l > W || t > H) continue;
            const cx = (l + r) / 2, cy = (t + b) / 2;
            g.fillStyle = "#241a35";
            g.strokeStyle = COLORS.captured;
            if (k.kind[i] === Wd.MINE) {
              g.fillRect(cx - 6, cy - 4, 12, 8);
              g.strokeRect(cx - 7, cy - 5, 14, 10);
              g.fillStyle = COLORS.shell;
              g.fillRect(cx - 2, cy - 2, 4, 4);
            } else if (k.kind[i] === Wd.PILLBOX) {
              g.fillRect(l, t, w, h);
              g.strokeRect(l, t, w, h);
              g.save();
              g.translate(cx, cy);
              g.rotate(k.angle[i]!);
              g.fillStyle = COLORS.captured;
              g.fillRect(-6, -6, 12, 12);
              g.fillRect(4, -2, 17, 4);
              g.restore();
            } else {
              g.fillRect(l, t, w, h);
              g.strokeRect(l, t, w, h);
              g.beginPath();
              if (w > h)
                for (let x = l + 12; x < r; x += 14) g.moveTo(x, t + 2), g.lineTo(x, b - 2);
              else for (let y = t + 12; y < b; y += 14) g.moveTo(l + 2, y), g.lineTo(r - 2, y);
              g.stroke();
            }
            if (k.hp[i]! < k.max[i]!) {
              g.fillStyle = "#0c151a";
              g.fillRect(l, b + 3, w, 3);
              g.fillStyle = COLORS.captured;
              g.fillRect(l, b + 3, (w * k.hp[i]!) / k.max[i]!, 3);
            }
          }
          if (s[Wd.BUILD]) {
            // The engineer walks out to the site.
            const l = s[Wd.BL]!, t = s[Wd.BT]!, r = s[Wd.BR]!, b = s[Wd.BB]!, p = Math.min(1, s[Wd.BPROG]! / 0.65);
            g.strokeStyle = COLORS.captured;
            g.setLineDash([3, 3]);
            g.strokeRect(l, t, r - l, b - t);
            g.setLineDash([]);
            const x = s[Wd.BFX]! + ((l + r) / 2 - s[Wd.BFX]!) * p, y = s[Wd.BFY]! + ((t + b) / 2 - s[Wd.BFY]!) * p;
            g.fillStyle = "#06c4ff";
            g.fillRect(x - 3, y - 5, 6, 4);
            g.fillStyle = "#f4457a";
            g.fillRect(x - 4, y - 1, 8, 6);
            g.fillRect(x - 4, y + 5, 3, 4);
            g.fillRect(x + 1, y + 5, 3, 4);
          }
          g.restore();
        }
        function drawSupplies(g: CanvasRenderingContext2D) {
          const d = world.supplies;
          g.save();
          g.lineWidth = 2;
          for (let i = 0; i < d.count; i++) {
            const x = d.x[i]!, y = d.y[i]!, repair = d.kind[i] === 1;
            g.strokeStyle = repair ? "#4bce82" : "#cdde00";
            g.fillStyle = "#14232c";
            g.fillRect(x - 10, y - 9, 20, 18);
            g.strokeRect(x - 10, y - 9, 20, 18);
            g.fillStyle = g.strokeStyle;
            if (repair) g.fillRect(x - 2, y - 6, 4, 12), g.fillRect(x - 6, y - 2, 12, 4);
            else g.fillRect(x - 6, y - 5, 5, 4), g.fillRect(x + 1, y - 1, 5, 4), g.fillRect(x - 6, y + 3, 5, 4);
            if (!d.landed(i)) {
              // The parachute.
              g.beginPath();
              g.moveTo(x - 10, y - 9);
              g.lineTo(x - 15, y - 24);
              g.lineTo(x, y - 30);
              g.lineTo(x + 15, y - 24);
              g.lineTo(x + 10, y - 9);
              g.stroke();
            }
          }
          g.restore();
        }
        const baseId = (b: number) => {
          const t = b >= 0 ? (world.bases.target[b] as BoardTarget | null) : null;
          return t ? t.el.id || `base-${b + 1}` : "reinforcement";
        };

        return {
          reset() {
            sync();
            measureCover();
            world.reset();
          },
          over: () => s[Wd.OVER]!,
          scroll(dx, dy) {
            world.scroll(dx, dy);
            coverAt = -1;
          },
          react(ev) {
            const T = world.tanks, x = T.x[Wd.P]!, y = T.y[Wd.P]!;
            switch (ev.type) {
              case "score": ctx.popup(ev.x, ev.y, ev.a, null, 0); break;
              case "level": ctx.popup(x, y - 28, 0, `${cannonName(ev.a + 1)} ONLINE`, 1); ctx.emit("cannon-upgrade", { cannon: ev.a + 1, xp: world.points.xp }); break;
              case "say": {
                const text = Wd.SAYS[ev.a]!.replace("#", ev.a === 4 || ev.a === 6 ? kindName(ev.b) : String(ev.b));
                ctx.popup(ev.x, ev.y, 0, text, Wd.SAY_TONE[ev.a]! as 1 | 2);
                break;
              }
              case "burst": ctx.spark(ev.x, ev.y, ev.b, ev.a); break;
              case "spawn": ctx.emit("spawn", { base: baseId(ev.a), heavy: !!ev.b, wave: ev.v }); break;
              case "tank-destroyed": ctx.emit("tank-destroyed", { heavy: !!ev.a }); break;
              case "hurt": ctx.emit("hurt", { armor: ev.a }); break;
              case "structure-destroyed": ctx.emit("structure-destroyed", { kind: Wd.KINDS[ev.a] }); break;
              case "base-disabled": ctx.emit("base-disabled", { base: baseId(ev.a) }); break;
              case "base-captured": ctx.emit("base-captured", { base: baseId(ev.a) }); break;
              case "build-start": ctx.emit("build-start", { kind: Wd.KINDS[ev.a], cost: ev.b }); break;
              case "structure-built": ctx.emit("structure-built", { kind: Wd.KINDS[ev.a], x: ev.x, y: ev.y }); break;
              case "mine-detonated": ctx.emit("mine-detonated", {}); break;
              case "fire": ctx.emit("fire"); break;
              case "wave:start": ctx.popup(x, y - 40, 0, `WAVE ${ev.a} / INCOMING`, 2); ctx.say(`WAVE ${ev.a} · ${ev.b} tanks incoming`); ctx.emit("wave-start", { wave: ev.a }); break;
              case "wave:clear": ctx.popup(x, y - 40, 0, "WAVE CLEAR / FORTIFY", 1); ctx.say("Wave clear · +4 scrap, +12 armor · fortify"); ctx.emit("wave-clear", { wave: ev.a }); break;
              case "drop:spawn": ctx.emit("supply-drop", { kind: ev.a ? "repair" : "scrap" }); break;
              case "drop:collect": ctx.emit("supply-collected", { kind: ev.a ? "repair" : "scrap" }); break;
            }
          },
          draw(g) {
            const T = world.tanks, r = ctx.reduced();
            markCover();
            drawBases();
            drawStructures(g);
            drawSupplies(g);
            g.save();
            g.lineWidth = 1;
            const sh = world.shells;
            for (let i = 0; i < sh.count; i++) {
              g.fillStyle = sh.friendly[i] ? COLORS.shell : COLORS.enemy;
              g.fillRect(Math.round(sh.x[i]!) - 3, Math.round(sh.y[i]!) - 3, 6, 6);
            }
            for (let i = 0; i < T.count; i++) {
              const heavy = T.heavy[i] === 1;
              sprite(g, T.x[i]!, T.y[i]!, T.angle[i]!, T.turret[i]!, heavy ? COLORS.heavy : COLORS.enemy, T.tread[i]!, r ? 0 : T.recoil[i]!, T.flash[i]! > 0, heavy ? 1.12 : 0.9);
            }
            const p = Wd.P;
            sprite(g, T.x[p]!, T.y[p]!, T.angle[p]!, T.turret[p]!, COLORS.player, T.tread[p]!, r ? 0 : T.recoil[p]!, T.flash[p]! > 0);
            if (s[Wd.SHIELD]! > 0) (g.strokeStyle = COLORS.captured), (g.lineWidth = 1), g.strokeRect(T.x[p]! - 20, T.y[p]! - 20, 40, 40);
            if (ctl[PON]) {
              // The crosshair at the pointer.
              const x = ctl[PX]!, y = ctl[PY]!;
              g.strokeStyle = COLORS.shell;
              g.lineWidth = 1;
              g.beginPath();
              g.moveTo(x - 9, y); g.lineTo(x - 3, y); g.moveTo(x + 3, y); g.lineTo(x + 9, y);
              g.moveTo(x, y - 9); g.lineTo(x, y - 3); g.moveTo(x, y + 3); g.lineTo(x, y + 9);
              g.stroke();
            }
            g.restore();
          },
          hud(out) {
            out[0] = world.points.points;
            out[1] = world.siege ? world.wave.wave : 1;
            out[2] = Math.ceil(world.tanks.hp[Wd.P]!);
            out[3] = s[Wd.SCRAP]!;
            out[4] = world.points.xp * 4 + s[Wd.CANNON]!; // the meter's change key
          },
          meter() {
            const c = s[Wd.CANNON]!, xp = world.points.xp, next = c === 1 ? 20 : 60;
            return [cannonName(c), c === 3 ? "FULL FIREPOWER" : `${xp}/${next} XP`, c === 3 ? 1 : xp / next] as const;
          },
          stats() {
            const T = world.tanks, k = world.structures, B = world.bases, hp = T.hp[Wd.P]!, w = world.wave;
            let captured = 0, barriers = 0, cover = 0, pillboxes = 0, mines = 0;
            for (let b = 0; b < B.count; b++) if (B.captured[b]) captured++;
            for (let i = 0; i < k.count; i++) {
              if (k.hp[i]! <= 0) continue;
              if (k.base[i]! >= 0) barriers++;
              if (k.kind[i] === Wd.COVER) cover++;
              if (k.kind[i] === Wd.PILLBOX) pillboxes++;
              if (k.kind[i] === Wd.MINE) mines++;
            }
            const scrap = s[Wd.SCRAP]!, phase = world.siege ? w.phase : "conquest";
            return {
              score: world.points.points, lives: Math.ceil(hp / 25), wave: world.siege ? w.wave : 1, armor: Math.ceil(hp), kills: s[Wd.KILLS]!, alive: T.count, shells: world.shells.count,
              supplies: world.supplies.count, captured, bases: B.count, cannon: s[Wd.CANNON]!, xp: world.points.xp, scrap, phase, incoming: world.siege ? w.left : 0, countdown: Math.ceil(w.countdown),
              barriers, cover, pillboxes, mines, building: s[Wd.BUILD] ? Wd.KINDS[s[Wd.BUILD]!]! : null,
              player: { x: T.x[Wd.P]!, y: T.y[Wd.P]!, angle: T.angle[Wd.P]!, turret: T.turret[Wd.P]! },
              detail: `${Math.ceil(hp)}% ARMOR · ${scrap} SCRAP · ${captured}/${B.count} BASES · ${!B.count ? "No bases: practice mode" : world.siege ? (phase === "assault" ? `${w.left} INCOMING` : `${phase === "prepare" ? "DEPLOY" : "FORTIFY"} ${Math.ceil(w.countdown)}s`) : "CONQUEST"}`,
            };
          },
        };
      },
    },
    options,
  );
}
