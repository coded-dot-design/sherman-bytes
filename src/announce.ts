// Screen-reader announcements through one shared polite live region, rate-limited. The same
// contract as Fizlet's `fizlet/announce` brick (proposed), kept local because the vendored Fizlet
// predates it: a later `npm run sync` swaps this import for the brick's.
export interface Announcer {
  /** Queue `text` under `key`; a newer text for the same key replaces the pending one. */
  say(key: string, text: string): void;
  /** Write what is pending now. */
  flush(): void;
  /** Clear timers; remove the region if this announcer created it. */
  destroy(): void;
}

export function announcer({ gap = 1, doc = document }: { gap?: number; doc?: Document } = {}): Announcer {
  const pending = new Map<string, string>();
  let el: HTMLElement | null = null, mine = false, timer: ReturnType<typeof setTimeout> | undefined, next = 0;
  function region() {
    if (el?.isConnected) return el;
    el = doc.querySelector<HTMLElement>("[data-fz-announce]");
    if (!el) {
      el = doc.createElement("div");
      el.setAttribute("data-fz-announce", "");
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      el.setAttribute("aria-atomic", "true");
      // Visually hidden, still read (never display:none).
      el.style.cssText = "position:fixed;clip-path:inset(50%);white-space:nowrap";
      doc.body.append(el);
      mine = true;
    }
    return el;
  }
  function flush() {
    clearTimeout(timer);
    timer = undefined;
    if (!pending.size) return;
    let text = [...pending.values()].join(". ");
    pending.clear();
    const r = region();
    if (r.textContent === text) text += " "; // the same words again still get read
    r.textContent = text;
    next = Date.now() + gap * 1000;
  }
  return {
    say(key, text) {
      pending.set(key, text);
      if (timer !== undefined) return;
      const wait = next - Date.now();
      if (wait <= 0) flush();
      else timer = setTimeout(flush, wait);
    },
    flush,
    destroy() {
      clearTimeout(timer);
      timer = undefined;
      pending.clear();
      if (mine) el?.remove();
      el = null;
      mine = false;
    },
  };
}
