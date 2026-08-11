import type { ItemData } from "./types";

/**
 * Pure sprite-selection logic, extracted for testability (matching the
 * enemyPatrol.ts/respawnBlink.ts convention already used in this codebase).
 *
 * Wolf vs. the original enemy sprite is selected by level index rather than
 * per-enemy data, since the original binary .map format has no per-enemy
 * "kind" field. Levels 1-2 (index 0-1) keep the original enemy sprite;
 * Levels 3-4 (index 2-3) render the new wolf sprite for all their enemies.
 */
export function getEnemyTextureKey(levelIndex: number): "enemy" | "wolf" {
  return levelIndex >= 2 ? "wolf" : "enemy";
}

export type ItemTextureKey = "item1" | "item2" | "item3";

export interface ItemRenderConfig {
  key: ItemTextureKey;
  size: number;
}

export interface ItemDisplaySizes {
  carrot: number;
  cherry: number;
  banana: number;
}

/**
 * Maps an item's type to its texture key and display size. The switch has
 * no default case, so TypeScript will flag this function at compile time if
 * ItemType ever gains a value this doesn't handle.
 */
export function getItemRenderConfig(item: Pick<ItemData, "type">, sizes: ItemDisplaySizes): ItemRenderConfig {
  switch (item.type) {
    case "CARROT":
      return { key: "item1", size: sizes.carrot };
    case "CHERRY":
      return { key: "item2", size: sizes.cherry };
    case "BANANA":
      return { key: "item3", size: sizes.banana };
  }
}
