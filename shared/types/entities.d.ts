import type { BoardTarget, Point } from "./contracts.js";
/** Bounded, lazily allocated entities. Removal swaps with the last active item. */
export declare class EntityPool<T extends object> {
    private readonly items;
    private readonly free;
    private readonly create;
    readonly capacity: number;
    constructor(capacity: number, create: () => T);
    get active(): readonly T[];
    get size(): number;
    acquire(): T | undefined;
    releaseAt(index: number): boolean;
    release(item: T): boolean;
    clear(): void;
}
export interface SpawnPoint extends Point {
    target: BoardTarget | undefined;
}
/** Pick a live visible factory without allocating a filtered target array. */
export declare function chooseSpawn(targets: readonly BoardTarget[], random: () => number, width: number, edgeY?: number): SpawnPoint | null;
export declare function translateEntities(items: readonly Point[], dx: number, dy: number): void;
