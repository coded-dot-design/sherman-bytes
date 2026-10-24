export type WavePhase = "prepare" | "assault" | "rebuild";
/** A DOM-independent wave clock. Games decide where and what to spawn. */
export declare class WaveDirector {
    wave: number;
    phase: WavePhase;
    remaining: number;
    countdown: number;
    private spawnIn;
    readonly capacity: number;
    constructor(capacity?: number);
    get limit(): number;
    get ready(): boolean;
    reset(): void;
    update(dt: number, alive: number): "start" | "clear" | undefined;
    spawned(): void;
    rest(): void;
}
