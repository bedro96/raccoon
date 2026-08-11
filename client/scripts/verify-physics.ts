/**
 * Numeric physics-feel verification: asserts the implemented PlayerController
 * matches the reverse-engineered original constants exactly (see the
 * "Reverse-engineer Ponpoko level map format & physics constants" and
 * "Tune player movement feel against reverse-engineered physics constants"
 * tickets). This is an AFK, numeric comparison against documented ground
 * truth -- not a subjective human playtest, per the map's explicit decision.
 *
 * Run with: npm run verify:physics
 */
import { PlayerController } from "../src/game/PlayerController";
import {
  CLIMB_DURATION,
  FALL_DURATION,
  FLOOR_Y,
  JUMP_DISTANCE,
  JUMP_DURATION,
  JUMP_HEIGHT,
  MOVE_STEP,
  getRowY,
} from "../src/game/constants";
import type { MapData } from "../src/game/types";

const EPSILON = 0.5; // px, allows for floating point + discrete-step accumulation error

let failures = 0;

function assertClose(label: string, actual: number, expected: number, epsilon = EPSILON): void {
  const diff = Math.abs(actual - expected);
  const pass = diff <= epsilon;
  const status = pass ? "PASS" : "FAIL";
  console.log(`[${status}] ${label}: actual=${actual.toFixed(3)} expected=${expected.toFixed(3)} diff=${diff.toFixed(3)}`);
  if (!pass) failures++;
}

const map: MapData = {
  stageLevel: 0,
  startPos: { x: 80, y: FLOOR_Y },
  platforms: [
    { y: getRowY(3), startX: 20, endX: 980 },
    { y: getRowY(2), startX: 20, endX: 980 },
  ],
  ladders: [{ x: 80, floor: 3 }],
  spikes: [],
  items: [],
  enemies: [],
};

const DT = 1 / 240; // fine-grained simulation step, independent of any real frame rate

// --- 1. Jump: peak height and horizontal distance ---
{
  const p = new PlayerController();
  p.reset(map.startPos, 4);
  p.applyInput("Jump", map);

  let maxOffset = 0;
  let elapsed = 0;
  while (elapsed < JUMP_DURATION + DT) {
    p.update(DT, map);
    maxOffset = Math.max(maxOffset, p.jumpOffsetY);
    elapsed += DT;
  }

  assertClose("Jump peak height (px)", maxOffset, JUMP_HEIGHT);
  assertClose("Jump horizontal distance (px)", p.x - map.startPos.x, JUMP_DISTANCE);
}

// --- 2. Fall: triggered by jumping off a platform edge, then falling one row ---
{
  const fallMap: MapData = {
    ...map,
    platforms: [
      { y: getRowY(2), startX: 20, endX: 200 }, // narrow platform on row 2
      { y: getRowY(3), startX: 20, endX: 980 }, // full platform one row down to land on
    ],
  };
  const p = new PlayerController();
  p.reset({ x: 180, y: getRowY(2) }, 2); // near the right edge of the narrow platform
  p.applyInput("Jump", fallMap); // jumps right, lands at x=180+80=260, which is off the row-2 platform

  let elapsed = 0;
  // Run through the jump (0.5s) then the resulting fall (0.15s), watching for the row to change.
  while (elapsed < JUMP_DURATION + FALL_DURATION + DT * 4 && p.row === 2) {
    p.update(DT, fallMap);
    elapsed += DT;
  }
  const fallOnlyDuration = elapsed - JUMP_DURATION;
  assertClose("Fall duration after jump-off-edge (s)", fallOnlyDuration, FALL_DURATION, 0.03);
  assertClose("Row after fall", p.row, 3, 0.01);
}

// --- 3. Ladder climb: one-row climb duration ---
{
  const p = new PlayerController();
  p.reset({ x: 80, y: getRowY(3) }, 3);
  p.applyInput("ClimbDown", map); // ladder at x=80, floor=3 connects row3<->row4

  let elapsed = 0;
  let rowChanged = false;
  while (elapsed < CLIMB_DURATION + DT * 2 && !rowChanged) {
    p.update(DT, map);
    elapsed += DT;
    if (p.row === 4) rowChanged = true;
  }
  assertClose("Climb duration (s)", elapsed, CLIMB_DURATION, 0.02);
}

// --- 4. Horizontal move speed (per-frame step) ---
{
  const p = new PlayerController();
  p.reset(map.startPos, 3);
  const frames = 10;
  for (let i = 0; i < frames; i++) {
    p.applyInput("MoveRight", map);
  }
  const displacement = p.x - map.startPos.x;
  assertClose("Move step over 10 discrete inputs (px)", displacement, MOVE_STEP * frames, 0.01);
}

console.log("");
if (failures > 0) {
  console.error(`${failures} physics check(s) FAILED.`);
  process.exit(1);
} else {
  console.log("All physics checks PASSED — implementation matches documented original constants.");
}
