/** Small event-driven synthesizer: no assets, timers, animation loops or queued cues. */
export declare function createGameAudio(doc: Document, game: string, initial?: boolean): {
    readonly enabled: boolean;
    readonly available: boolean;
    unlock: (event?: Event) => void;
    play: (event: string) => void;
    silence: () => void;
    close: () => void;
    toggle(): void;
};
