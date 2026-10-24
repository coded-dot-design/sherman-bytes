import type { GameController, GameOptions, GameStats } from "./contracts.js";
export interface GameComponentProps<S extends GameStats = GameStats, O extends GameOptions<S> = GameOptions<S>> {
    active?: boolean;
    options?: O;
}
/** Memoize options. Each effect owns and recalls exactly the instance it starts. */
export declare function createGameComponent<S extends GameStats, O extends GameOptions<S> = GameOptions<S>>(create: (options?: O) => GameController<S>): (props: GameComponentProps<S, O>) => null;
