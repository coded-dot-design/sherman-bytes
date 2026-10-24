export declare const controlIcons: {
    pause: string;
    play: string;
    minimize: string;
    expand: string;
    close: string;
    sound: string;
    mute: string;
    up: string;
    left: string;
    right: string;
    down: string;
};
export declare const controlStyles = "\n.game-header{display:grid!important;grid-template-columns:1fr auto;align-items:center;gap:4px!important;padding:9px 12px!important}\n.game-header .game-title{grid-column:1/-1;font:500 10px/1.4 ui-monospace,monospace;letter-spacing:1.4px;color:inherit;text-shadow:none}\n.game-actions{grid-column:2;display:flex;gap:3px}\n.game-actions button{width:44px;min-width:44px;height:44px;min-height:44px;padding:8px!important;border:0;background:transparent;color:inherit;border-radius:7px;display:grid;place-items:center;cursor:pointer}\n.game-actions button:hover{background:color-mix(in srgb,currentColor 12%,transparent)}\n.game-actions svg,.touch svg{display:block;width:20px;height:20px;margin:auto}\n.game-actions button:focus-visible{outline:2px solid currentColor;outline-offset:1px}\n@media(pointer:coarse),(max-width:600px){.game-actions button{width:44px;min-width:44px;height:44px;min-height:44px}.game-header{padding:5px 10px!important}}\n";
export declare function gameHeader(title: string): string;
