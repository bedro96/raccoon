/**
 * Numeric jump-rotation verification: asserts the implemented PlayerController
 * exposes a smooth visual jump tilt that starts/ends upright, peaks around
 * 30 degrees, and mirrors by facing direction.
 *
 * Run with: npm run verify:jump-rotation
 */
import { PlayerController } from "../src/game/PlayerController";
import { FLOOR_Y, JUMP_DURATION } from "../src/game/constants";
import type { MapData } from "../src/game/types";

const EPSILON = 0.001;
const PEAK_ROTATION = (30 * Math.PI) / 180;

let failures = 0;

function assertClose(label: string, actual: number, expected: number, epsilon = EPSILON): void {
  const diff = Math.abs(actual - expected);
  const pass = diff <= epsilon;
  const status = pass ? "PASS" : "FAIL";
  console.log(`[${status}] ${label}: actual=${actual.toFixed(6)} expected=${expected.toFixed(6)} diff=${diff.toFixed(6)}`);
  if (!pass) failures++;
}

const map: MapData = {
  stageLevel: 0,
  startPos: { x: 80, y: FLOOR_Y },
  platforms: [{ y: FLOOR_Y, startX: 20, endX: 980 }],
  ladders: [],
  spikes: [],
  items: [],
  enemies: [],
};

// 1. Facing right: upright at jump start/end, peaks at +30deg mid-arc.
{
  const p = new PlayerController();
  p.reset(map.startPos, 4);
  assertClose("Right-facing jump rotation at rest", p.jumpRotation, 0);

  p.applyInput("Jump", map);
  assertClose("Right-facing jump rotation at jump start", p.jumpRotation, 0);

  p.update(JUMP_DURATION / 2, map);
  assertClose("Right-facing jump rotation at arc peak", p.jumpRotation, PEAK_ROTATION);

  p.update(JUMP_DURATION / 2, map);
  assertClose("Right-facing jump rotation at jump end", p.jumpRotation, 0);
}

// 2. Facing left: same magnitude, mirrored sign.
{
  const p = new PlayerController();
  p.reset(map.startPos, 4);
  p.applyInput("MoveLeft", map);
  p.applyInput("Jump", map);
  p.update(JUMP_DURATION / 2, map);
  assertClose("Left-facing jump rotation at arc peak", p.jumpRotation, -PEAK_ROTATION);
}

console.log("");
if (failures > 0) {
  console.error(`${failures} jump-rotation check(s) FAILED.`);
  process.exit(1);
} else {
  console.log("All jump-rotation checks PASSED.");
}
