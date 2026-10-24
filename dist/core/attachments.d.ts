/** Empty owned children follow layout, transforms and nested scrolling natively. */
export declare class ElementAttachments {
    private readonly hosts;
    private readonly doc;
    private readonly writeStyle;
    constructor(doc: Document, writeStyle: (element: HTMLElement, property: string, value: string, priority?: string) => void);
    attach(element: Element): ShadowRoot | null;
    remove(element: Element): void;
    clear(): void;
}
