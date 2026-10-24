import type { GameContext, Rect } from "@coded-design/dom-virus";
export interface TerrainOptions {
  wallSelector?: string;
}
/** Opt-in hard cover. Only this adapter touches layout; simulation uses rectangles. */
export function createTerrain(api: GameContext, options: TerrainOptions) {
  const doc = api.options.document ?? globalThis.document;
  const selector = options.wallSelector ?? "[data-sherman-wall]";
  const root =
    typeof api.options.root === "string"
      ? doc.querySelector(api.options.root)
      : (api.options.root ?? doc.body);
  root?.querySelectorAll(selector); // Validate before gameplay starts.
  const exclude =
    "form,input,textarea,select,[contenteditable],[data-virus-ignore],[data-dom-virus-root],[data-swarm-ui]";
  let nextRead = -Infinity;
  let walls: Rect[] = [];
  const decorations = new Map<Element, HTMLElement>();
  return {
    get walls(): readonly Rect[] {
      return walls;
    },
    refresh(now: number, force = false) {
      if (!force && now < nextRead) return;
      nextRead = now + 0.25;
      walls = [];
      const seen = new Set<Element>();
      for (const element of [...(root?.querySelectorAll(selector) ?? [])].slice(
        0,
        32,
      )) {
        if (
          element.closest(exclude) ||
          (api.options.excludeSelector &&
            element.closest(api.options.excludeSelector))
        )
          continue;
        seen.add(element);
        if (!decorations.has(element)) {
          const host = api.board.attach?.(element);
          if (host) {
            const marker = doc.createElement('i');
            marker.setAttribute('data-sherman-cover', '');
            marker.style.cssText = 'position:absolute;inset:-2px;border:1px dashed #00e5ff;pointer-events:none;border-radius:inherit';
            host.append(marker); decorations.set(element, marker);
          }
        }
        const r = element.getBoundingClientRect();
        if (
          r.width <= 0 ||
          r.height <= 0 ||
          r.right <= 0 ||
          r.bottom <= 0 ||
          r.left >= api.width ||
          r.top >= api.height
        )
          continue;
        const style = doc.defaultView!.getComputedStyle(element);
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          style.opacity === "0"
        )
          continue;
        walls.push({
          left: r.left,
          right: r.right,
          top: r.top,
          bottom: r.bottom,
          width: r.width,
          height: r.height,
        });
      }
      for (const [element, marker] of decorations) if (!seen.has(element) || !element.isConnected) { marker.remove(); decorations.delete(element); }
    },
    invalidate() {
      nextRead = -Infinity;
    },
  };
}
export type Terrain = ReturnType<typeof createTerrain>;
