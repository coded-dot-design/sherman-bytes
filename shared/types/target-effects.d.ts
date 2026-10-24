import type { BoardTarget, Point } from "./contracts.js";
export declare function targetSignal(health: number, color?: string): {
    fill: number;
    color: string;
    period: number;
};
export declare function liquidFill(fill: number, color: string, energy?: number, time?: number, impact?: number): string;
export declare class TargetEffects {
    private readonly surfaces;
    private time;
    private running;
    private readonly quiet;
    private readonly win;
    constructor(win: Window);
    hit(target: BoardTarget, impact?: Point): void;
    private surface;
    draw(_ctx: CanvasRenderingContext2D, targets: readonly BoardTarget[], time: number, reduced: boolean): void;
    private motion;
    setActive(active: boolean): void;
    ownsStyleMutation(target: BoardTarget): boolean;
    private release;
    sync(targets: readonly BoardTarget[]): void;
    destroy(): void;
}
