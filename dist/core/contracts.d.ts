export interface Point {
    x: number;
    y: number;
}
export interface Player extends Point {
    angle: number;
}
export interface Bounds {
    left: number;
    right: number;
    top: number;
    bottom: number;
}
export interface Rect extends Bounds {
    width: number;
    height: number;
}
export interface BoardOptions {
    root?: Element | string;
    textSelector?: string;
    targetSelector?: string;
    excludeSelector?: string;
    /** Text is always mutated. Kept for existing direct-text integrations. */
    domMode?: "text";
    /** @deprecated Actual text always inherits its native page typography. */
    binaryStyle?: "native";
    /** Optional fade of actual binary text via CSS Highlights; full opacity without that API. */
    binaryOpacity?: number;
    targetEffects?: "liquid" | "fade";
}
export interface RuntimeOptions extends BoardOptions {
    document?: Document;
    theme?: "system" | "dark" | "light";
    controls?: "mouse" | "keyboard";
    reducedMotion?: boolean;
    seed?: number;
}
export interface BoardStats {
    indexed: number;
    visible: number;
    spent: number;
    measurements: number;
}
export interface GameStats {
    score?: number;
    lives?: number;
    wave?: number;
    detail?: string;
    hud?: ArcadeHud;
}
export interface ArcadeHud {
    kills: number;
    alive: number;
    combo: number;
    label: string;
    progress: number;
    progressText: string;
}
export type GameStatus = "idle" | "running" | "paused" | "gameover" | "won" | "destroyed";
export type GameSnapshot<S extends GameStats = GameStats> = Partial<S> & {
    id: string;
    status: GameStatus;
    elapsed: number;
    board: BoardStats;
    particles: number;
    frameMs: number;
    maxFrameMs: number;
    notice: string;
};
/** Custom event payloads remain unknown until consumers narrow them. */
export interface GameEvent {
    type: string;
    game: string;
    [key: string]: unknown;
}
export interface GameOptions<S extends GameStats = GameStats> extends RuntimeOptions {
    onState?: (state: GameSnapshot<S>) => void;
    onEvent?: (event: GameEvent) => void;
    onError?: (error: unknown) => void;
}
export interface GameController<S extends GameStats = GameStats> {
    start(): GameSnapshot<S>;
    pause(): void;
    resume(): void;
    stop(): void;
    destroy(): void;
    getSnapshot(): GameSnapshot<S>;
}
export interface TextRecord {
    node: Text;
    latest: string;
    original: string;
    glyphs: Glyph[];
}
export interface Glyph {
    record: TextRecord;
    offset: number;
    length: number;
    char: string;
    spent: boolean;
    rect: Rect | null;
    range: Range | null;
    bit: "0" | "1";
    effect?: "binary" | "erase";
}
export interface BoardTarget {
    element: HTMLElement | SVGElement;
    id: string;
    label: string;
    health: number;
    maxHealth: number;
    rect: Rect | null;
    visible: boolean;
}
export interface Board {
    readonly targets: readonly BoardTarget[];
    readonly glyphs: readonly Glyph[];
    readonly stats: BoardStats;
    measure(now: number, force?: boolean): void;
    consume(glyph: Glyph | undefined | null, effect?: "binary" | "erase"): boolean;
    hitSegment(a: Point, b: Point): {
        glyph: Glyph;
        t: number;
    } | null;
    near(x: number, y: number, radius?: number): Glyph[];
    damage(target: BoardTarget, amount: number, impact?: Point): boolean;
    resetTargets(health?: number): void;
    draw(context: CanvasRenderingContext2D, time?: number, reducedMotion?: boolean): void;
    invalidate(): void;
    /** Pause owned native animations with the simulation. */
    setActive?(active: boolean): void;
    destroy(): void;
}
export interface InputState {
    keys: Set<string>;
    pointer: Point & {
        active: boolean;
    };
    fire: boolean;
    mode: "mouse" | "keyboard";
}
/** The engine owns browser state; simulations own only their gameplay state. */
export interface GameContext {
    readonly board: Board;
    readonly input: InputState;
    readonly options: Readonly<RuntimeOptions>;
    readonly width: number;
    readonly height: number;
    readonly time: number;
    readonly firing: boolean;
    readonly reducedMotion: boolean;
    random(): number;
    emit(type: string, data?: Record<string, unknown>): void;
    move(player: Player, dt: number, speed?: number, cardinal?: boolean): void;
    burst(x: number, y: number, color: string, count?: number): void;
    popup(x: number, y: number, text: string, tone?: "score" | "upgrade" | "hurt"): void;
    finish(won?: boolean): void;
}
export interface GameSimulation<S extends GameStats = GameStats> {
    reset(): void;
    update(dt: number): void;
    draw(context: CanvasRenderingContext2D): void;
    scroll?(dx: number, dy: number): void;
    /** Optional discrete commands; the runtime owns protected input and cleanup. */
    action?(id: string): void;
    snapshot(): S;
}
export interface GameDefinition<S extends GameStats = GameStats> {
    id: string;
    title: string;
    color: string;
    hint: string;
    capabilities?: {
        fire?: boolean;
    };
    actions?: readonly {
        id: string;
        key: string;
        label: string;
    }[];
    hud?: "arcade";
    create(context: GameContext): GameSimulation<S>;
}
