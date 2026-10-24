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
    private readonly win;
    constructor(win: Window);
    hit(target: BoardTarget, impact?: Point): void;
    private surface;
    draw(ctx: CanvasRenderingContext2D, targets: readonly BoardTarget[], time: number, reduced: boolean): void;
    sync(targets: readonly BoardTarget[]): void;
    destroy(): void;
}
