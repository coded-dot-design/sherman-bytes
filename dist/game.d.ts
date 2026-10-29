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
    player: {
        x: number;
        y: number;
        angle: number;
        turret: number;
    };
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
    onEvent?: (event: {
        type: string;
        game: string;
        [key: string]: unknown;
    }) => void;
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
    board?: {
        indexed: number;
        visible: number;
        spent: number;
        measurements: number;
    };
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
export declare function createShermanBytes(options?: ShermanBytesOptions): ShermanBytesController;
