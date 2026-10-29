// Sherman Bytes' numbers (0.x's, unchanged).
export const MAX_TANKS = 32;
export const MAX_SHELLS = 120;
export const TANK_RADIUS = 10;
export const BASE_HEALTH = 100;
export const COLORS = {
  player: "#4bce82",
  enemy: "#ee6875",
  heavy: "#f4457a",
  shell: "#06c4ff",
  captured: "#4bce82",
};
/** The cannon tiers: 76MM, BREACHER from 20 XP, OVERDRIVE from 60 (fizlet/rules score levels). */
export const CANNON_XP = [20, 60] as const;
export const cannonName = (tier: number) => ["76MM", "BREACHER", "OVERDRIVE"][tier - 1]!;
