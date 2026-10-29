// What you can build, its scrap cost and how many at once (0.x's numbers). The geometry (where a
// build goes, a base's four walls) is in ./world.
export type BuildKind = "cover" | "pillbox" | "mine";
export const BUILD_COST: Record<BuildKind, number> = { cover: 2, pillbox: 8, mine: 3 };
export const BUILD_CAP: Record<BuildKind, number> = { cover: 12, pillbox: 4, mine: 8 };
