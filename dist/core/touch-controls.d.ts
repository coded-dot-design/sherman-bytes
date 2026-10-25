/**
 * Shared mobile controls: an analog thumbstick, a round Fire button and
 * secondary ability buttons, styled after DOM Battlefield.
 *
 * Feel rules (keep them when editing):
 * - One layout read per touch start; pointermove only writes a transform.
 * - Pointer capture per control, keyed by pointerId, so the stick and Fire
 *   can be held at the same time by different fingers.
 * - touch-action:none and no text selection on every control.
 * - 3D press: rest shadow (S,S); fine-pointer hover lifts the top by (-h,-h)
 *   with shadow (S+h); pressed translates exactly (S,S) with shadow 0, so the
 *   top lands on the base. aria-pressed=true stays pressed. Transform and
 *   shadow share one duration and easing; no overshoot, no scale().
 */
export type StickMode = "8way" | "4way";
/** Battlefield's crosshair. */
export declare const fireIcon: string;
/** Thumbstick markup. `role=application` lets screen readers pass drags through. */
export declare function stickMarkup(label?: string): string;
/** Round Fire button. `data-k=Space` lets the runtime map it to the fire key. */
export declare function fireButtonMarkup(label?: string): string;
/** Large round button for a game's main action when it has no Fire (e.g. Jump). */
export declare function primaryButtonMarkup(text: string, label?: string): string;
/** Small arcade button for abilities and other secondary actions. */
export declare function secondaryButtonMarkup(text: string, label?: string): string;
export interface StickKeyOptions {
    /** Magnitude (0..1) needed before any key is held. Default 0.28. */
    deadzone?: number;
    /** Magnitude below the deadzone at which held keys release. Default 0.07. */
    release?: number;
    /** Extra angle, as a fraction of a sector, before switching sectors. Default 0.18. */
    hysteresis?: number;
}
export interface StickKeys {
    /** Feed a stick vector (x right, y down; magnitude 0..1). Returns true if keys changed. */
    update(x: number, y: number): boolean;
    /** Arrow keys currently held: one in 4-way, one or two in 8-way. */
    readonly keys: readonly string[];
    reset(): void;
}
/**
 * Maps a stick vector to arrow keys. 8-way by default; "4way" picks the
 * dominant axis for grid games. Both the deadzone and the sector borders have
 * hysteresis so a thumb resting near a diagonal never flickers.
 */
export declare function createStickKeys(mode?: StickMode, { deadzone, release, hysteresis }?: StickKeyOptions): StickKeys;
type Listen = (target: EventTarget, type: string, fn: (event: PointerEvent) => void) => void;
export interface StickOptions {
    /** Return false to ignore a touch (e.g. while paused). */
    canStart?(event: PointerEvent): boolean;
    /** Stick vector: x right, y down, clipped to the unit circle. */
    onMove(x: number, y: number): void;
    onEnd?(): void;
    /** Knob travel as a fraction of the stick width. Default 0.36 (Battlefield). */
    travel?: number;
    /** Supply the host's listener helper so its teardown removes these too. */
    listen?: Listen;
}
export interface StickControl {
    readonly active: boolean;
    /** Recentre the knob and end the drag without waiting for pointerup. */
    release(): void;
    destroy(): void;
}
/** Drives a `.tc-stick` element (see stickMarkup). */
export declare function bindStick(stick: HTMLElement, options: StickOptions): StickControl;
export interface PressOptions {
    canPress?(event: PointerEvent): boolean;
    onPress(event: PointerEvent): void;
    onRelease?(pointerId: number): void;
    listen?: Listen;
}
export interface PressControl {
    /** Lift the button and forget held pointers (onRelease is called for each). */
    release(): void;
    destroy(): void;
}
/**
 * Hold-to-act press with pointer capture and a `.down` class, because :active
 * is unreliable for touch. Several fingers may hold one button.
 */
export declare function bindPress(button: HTMLElement, options: PressOptions): PressControl;
/**
 * Battlefield's look. Scope: a `.touch` container. Colors are tokens so the
 * HUD's light theme (`.hud[data-theme=light]~.touch`) can retint them, and
 * `--accent` (the game color) tints the stick and primary action.
 * Set `data-motion="reduce"` on `.touch` to drop the knob's return glide.
 */
export declare const touchControlStyles = "\n.touch{--tc-ink:#07060f;--tc-base:#07060f;--tc-stick:var(--accent,#19f0ff);--tc-fire:#ff2e88;--tc-alt:#19f0ff;--tc-focus:#ffe14d;--s:4px;--h:2px;--e:cubic-bezier(.25,.8,.25,1);--t:110ms;position:absolute;inset:auto max(16px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));display:none;justify-content:space-between;align-items:flex-end;gap:16px;margin:0;pointer-events:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;font:700 11px/1.1 ui-monospace,SFMono-Regular,Menlo,monospace}\n.hud[data-theme=light]~.touch{--tc-base:#eef0fb;--tc-fire:#e8177a;--tc-alt:#00a9d6;--tc-focus:#6f45e6}\n.tc-stick,.tc-btn{--c:var(--tc-stick);--sh:color-mix(in srgb,var(--c) 45%,#07060f);--gl:color-mix(in srgb,var(--c) 45%,transparent);touch-action:none;pointer-events:auto}\n.tc-stick{position:relative;flex:none;width:clamp(116px,33vw,148px);aspect-ratio:1;border-radius:50%;cursor:grab;background:radial-gradient(circle,#0000 34%,color-mix(in srgb,var(--c) 16%,#0000) 34% 35.5%,#0000 35.5%),color-mix(in srgb,var(--c) 9%,var(--tc-base));border:2px solid var(--c);box-shadow:var(--s) var(--s) 0 color-mix(in srgb,var(--c) 35%,#07060f),inset 0 0 18px color-mix(in srgb,var(--c) 16%,#0000)}\n.tc-marks{position:absolute;inset:0;width:100%!important;height:100%!important;fill:none;stroke:color-mix(in srgb,var(--c) 60%,#0000);stroke-width:3.4;stroke-linecap:round;stroke-linejoin:round}\n.tc-knob{position:absolute;inset:30%;border-radius:50%;background:var(--c);border:2px solid var(--tc-ink);box-shadow:3px 3px 0 var(--sh),0 0 14px var(--gl);transition:transform 160ms var(--e),box-shadow var(--t) var(--e);pointer-events:none;will-change:transform}\n.tc-stick.down{cursor:grabbing;--t:60ms;--gl:color-mix(in srgb,var(--c) 70%,#0000)}.down>.tc-knob{transition:box-shadow var(--t) var(--e);box-shadow:1px 1px 0 var(--sh),0 0 22px var(--gl)}\n.tc-side,.touch .abilities{display:flex;flex-direction:column;align-items:flex-end;gap:16px;margin:0;padding:0;pointer-events:none}.touch .abilities{align-items:stretch;gap:10px}\n.touch .tc-btn{--c:var(--tc-alt);font:inherit;letter-spacing:.06em;text-transform:uppercase;color:#07060f;background:var(--c);border:2px solid var(--tc-ink);border-radius:10px;min-width:48px;min-height:44px;margin:0;padding:8px 14px;display:grid;place-items:center;opacity:1;box-shadow:var(--s) var(--s) 0 var(--sh),0 0 14px var(--gl);transition:transform var(--t) var(--e),box-shadow var(--t) var(--e)}\n.touch .tc-btn svg{width:44%;height:44%;margin:0}\n.touch :is(.tc-fire,.tc-primary){--c:var(--tc-fire);width:clamp(80px,23vw,96px);aspect-ratio:1;padding:0;border-width:3px;border-radius:50%}.touch .tc-primary{--c:var(--tc-stick);font-size:12px;letter-spacing:.1em}\n.touch .tc-btn:focus-visible{outline:3px solid var(--tc-focus);outline-offset:3px}.touch .tc-btn:disabled{opacity:.45}\n@media (hover:hover) and (pointer:fine){.touch .tc-btn:not(:disabled):hover{transform:translate(calc(-1*var(--h)),calc(-1*var(--h)));box-shadow:calc(var(--s) + var(--h)) calc(var(--s) + var(--h)) 0 var(--sh),0 0 18px var(--gl)}}\n.touch .tc-btn:not(:disabled):is(:active,.down,[aria-pressed=true]){--t:60ms;--gl:color-mix(in srgb,var(--c) 70%,#0000);transform:translate(var(--s),var(--s));box-shadow:0 0 0 var(--sh),0 0 22px var(--gl)}\n.touch svg{pointer-events:none}.touch[data-motion=reduce] *{transition:none!important}\n";
export {};
