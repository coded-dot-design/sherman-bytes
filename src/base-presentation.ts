import type { BoardTarget, GameContext } from "@coded-design/dom-virus";
import type { Structure } from "./fortifications.js";
interface BaseView {
  target: BoardTarget;
  captured: boolean;
  capture: number;
  walls: Structure[];
}
/** Fortifications, state and capture progress belong to the actual base element. */
export class BasePresentation {
  private readonly views = new Map<
    BoardTarget,
    {
      state: string;
      container: HTMLElement;
      walls: HTMLElement[];
      status: HTMLElement;
      label: HTMLElement;
      progress: HTMLElement;
    }
  >();
  private readonly api: GameContext;
  constructor(api: GameContext) {
    this.api = api;
  }
  update(bases: Iterable<BaseView>) {
    const seen = new Set<BoardTarget>();
    const doc = this.api.options.document ?? globalThis.document;
    for (const base of bases) {
      const target = base.target;
      seen.add(target);
      let view = this.views.get(target);
      if (!view) {
        const root = this.api.board.attach?.(target.element);
        if (!root) continue;
        const container = doc.createElement("div");
        container.setAttribute("data-sherman-base", "");
        container.innerHTML =
          '<style>.base{position:absolute;inset:0;pointer-events:none}.wall{position:absolute;background:#321126;border:1px solid #ff343b;box-sizing:border-box}.wall:nth-child(1){left:-12px;right:-12px;top:-17px;height:10px}.wall:nth-child(2){left:-12px;right:-12px;bottom:-17px;height:10px}.wall:nth-child(3){top:-7px;bottom:-7px;left:-17px;width:10px}.wall:nth-child(4){top:-7px;bottom:-7px;right:-17px;width:10px}.wall::after{content:"";position:absolute;left:0;bottom:-5px;width:100%;height:3px;background:#ff343b;transform:scaleX(var(--health,1));transform-origin:left}.status{position:absolute;inset:-4px;border:2px solid currentColor;color:#00e5ff}.status[data-captured=true]{color:#65ff00}.label{position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);white-space:nowrap;font:bold 10px monospace;background:#151020;padding:2px 4px;color:inherit}.progress{position:absolute;top:calc(100% + 5px);left:0;width:100%;height:3px;background:currentColor;transform-origin:left}.status[data-captured=true] .progress{left:calc(50% - 5px);width:10px;height:10px;clip-path:polygon(30% 0,70% 0,70% 30%,100% 30%,100% 70%,70% 70%,70% 100%,30% 100%,30% 70%,0 70%,0 30%,30% 30%)}</style><div class="base"><i class="wall"></i><i class="wall"></i><i class="wall"></i><i class="wall"></i><div class="status"><span class="label"></span><i class="progress"></i></div></div>';
        root.append(container);
        view = {
          state: "",
          container,
          walls: [...container.querySelectorAll<HTMLElement>(".wall")],
          status: container.querySelector<HTMLElement>(".status")!,
          label: container.querySelector<HTMLElement>(".label")!,
          progress: container.querySelector<HTMLElement>(".progress")!,
        };
        this.views.set(target, view);
      }
      const state = `${base.captured}|${target.health <= 0}|${Math.round(base.capture * 100)}|${base.walls.map((w) => w.hp).join(",")}`;
      if (view.state === state) continue;
      view.state = state;
      base.walls.forEach((wall, i) => {
        const el = view!.walls[i]!;
        el.hidden = wall.hp <= 0;
        el.style.display = wall.hp <= 0 ? "none" : "";
        el.style.setProperty("--health", String(wall.hp / wall.maxHp));
      });
      if (!base.walls.length)
        for (const wall of view.walls) wall.style.display = "none";
      view.status.style.display =
        base.captured || target.health <= 0 ? "" : "none";
      view.status.dataset.captured = String(base.captured);
      const label = base.captured ? "FRIENDLY / REPAIR" : "DRIVE ONTO BASE";
      if (view.label.textContent !== label) view.label.textContent = label;
      view.progress.style.transform = `scaleX(${base.captured ? 1 : Math.min(1, base.capture / 0.7)})`;
    }
    for (const [target, view] of this.views)
      if (!seen.has(target) || !target.element.isConnected) {
        view.container.remove();
        this.views.delete(target);
      }
  }
}
