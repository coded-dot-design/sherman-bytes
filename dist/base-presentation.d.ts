import type { BoardTarget, GameContext } from './core/index.js';
import type { Structure } from './fortifications.js';
interface BaseView {
    target: BoardTarget;
    captured: boolean;
    capture: number;
    walls: Structure[];
}
/** Fortifications, state and capture progress belong to the actual base element. */
export declare class BasePresentation {
    private readonly views;
    private readonly api;
    constructor(api: GameContext);
    update(bases: Iterable<BaseView>): void;
}
export {};
