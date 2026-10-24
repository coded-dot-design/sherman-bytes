type TextNode = Pick<Text, "nodeValue">;
export declare class MutationLedger {
    private readonly text;
    private readonly styles;
    constructor();
    writeText(node: TextNode, value: string): boolean;
    writeStyle(el: HTMLElement | SVGElement, key: string, value: string, priority?: string): boolean;
    /** Observer filter: an unrelated host style change must still invalidate layout. */
    ownsStyleMutation(el: HTMLElement | SVGElement): boolean;
    restore(): void;
}
export {};
