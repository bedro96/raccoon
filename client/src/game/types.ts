/**
 * Level data shapes, matching the reverse-engineered .map file format
 * (see the "Reverse-engineer Ponpoko level map format & physics constants" ticket).
 * The level-loader ticket will produce real instances of this shape from the
 * original stage1.map/stage2.map files; this file just defines the contract.
 */

export interface Platform {
  y: number;
  startX: number;
  endX: number;
}

export interface Ladder {
  x: number;
  /** 0-based index of the row ABOVE this ladder; it connects floor and floor+1. */
  floor: number;
}

export interface Spike {
  x: number;
  y: number;
}

export type ItemType = "CARROT" | "CHERRY";

export interface ItemData {
  x: number;
  y: number;
  type: ItemType;
  score: number;
}

export interface EnemyData {
  x: number;
  y: number;
  patrolRange: number;
}

export interface MapData {
  stageLevel: number;
  startPos: { x: number; y: number };
  platforms: Platform[];
  ladders: Ladder[];
  spikes: Spike[];
  items: ItemData[];
  enemies: EnemyData[];
}
