/** Reversible mobile gesture policy. Native scrolling remains browser-owned. */
export declare function createMobileZoomLock(doc: Document, enabled?: boolean): {
    setActive(active: boolean): void;
};
