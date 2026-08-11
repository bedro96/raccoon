/**
 * Unit-level verification of pickup/hazard logic, ported from
 * CPlayerSession::CheckPickupAndHazards. Fast, deterministic checks
 * independent of any browser/Phaser runtime.
 */
import { PlayerController } from "../src/game/PlayerController";
import { FLOOR_Y, MOVE_STEP, getRowY } from "../src/game/constants";
import type { MapData } from "../src/game/types";

let failures = 0;
function assertTrue(label: string, cond: boolean): void {
  console.log(`[${cond ? "PASS" : "FAIL"}] ${label}`);
  if (!cond) failures++;
}

function assertClose(label: string, actual: number, expected: number, epsilon = 0.001): void {
  assertTrue(label, Math.abs(actual - expected) <= epsilon);
}

function baseMap(): MapData {
  return {
    stageLevel: 0,
    startPos: { x: 100, y: FLOOR_Y },
    platforms: [{ y: FLOOR_Y, startX: 20, endX: 980 }],
    ladders: [],
    spikes: [],
    items: [],
    enemies: [],
  };
}

// 1. Item pickup: score increases, item removed, callback fires
{
  const map = baseMap();
  map.items.push({ x: 105, y: FLOOR_Y, type: "CARROT", score: 10 });
  const p = new PlayerController();
  p.reset(map.startPos, 4);
  let pickedUp: unknown = null;
  p.onItemPickup = (item) => (pickedUp = item);

  p.applyInput("MoveRight", map); // triggers checkPickupAndHazards after the move

  assertTrue("Item removed from map.items after pickup", map.items.length === 0);
  assertTrue("Score increased by item's score value", p.score === 10);
  assertTrue("onItemPickup callback fired", pickedUp !== null);
}

// 2. Spike hazard: callback fires at the death location, movement freezes, and
// explicit respawn is required to return to the start position.
{
  const map = baseMap();
  map.spikes.push({ x: 105, y: FLOOR_Y });
  const p = new PlayerController();
  p.reset(map.startPos, 4);
  let hazardFired = 0;
  let hazardX = -1;
  p.onHazardHit = () => hazardFired++;

  p.applyInput("MoveRight", map);
  hazardX = p.x;
  p.checkHazards(map);

  p.applyInput("MoveLeft", map);

  assertClose("Spike hazard leaves the player at the hit location until respawn", hazardX, map.startPos.x + MOVE_STEP);
  assertTrue("onHazardHit callback fires once for spike death", hazardFired === 1);
  assertClose("Dead players ignore movement input while blinking", p.x, hazardX);

  p.respawn();
  assertClose("Explicit respawn returns the player to the start position", p.x, map.startPos.x);
}

// 3. Enemy hazard: follows the enemy's live/current position, even when the
// player is standing still and the enemy moves onto them.
{
  const map = baseMap();
  map.enemies.push({ x: 300, y: FLOOR_Y, patrolRange: 50, currentX: 110, currentY: FLOOR_Y });
  const p = new PlayerController();
  p.reset(map.startPos, 4);
  p.x = 110;
  let hazardFired = false;
  p.onHazardHit = () => (hazardFired = true);

  p.checkHazards(map);

  assertTrue("Enemy hazard (at live/current position) leaves the player at the hit location", p.x === 110);
  assertTrue("onHazardHit callback fired for enemy", hazardFired);

  p.respawn();
  assertTrue("Enemy hazard can be followed by an explicit respawn", p.x === map.startPos.x);
}

// 4. No false-positive pickup/hazard when nothing is within range
{
  const map = baseMap();
  map.items.push({ x: 500, y: FLOOR_Y, type: "CARROT", score: 10 }); // far away
  const p = new PlayerController();
  p.reset(map.startPos, 4);
  let pickedUp = false;
  p.onItemPickup = () => (pickedUp = true);

  p.applyInput("MoveRight", map);

  assertTrue("Distant item is not picked up", !pickedUp && map.items.length === 1);
}

// 5. Row must match: an item one row away is not collected even if X aligns
{
  const map = baseMap();
  map.platforms.push({ y: getRowY(3), startX: 20, endX: 980 });
  map.items.push({ x: 105, y: getRowY(3), type: "CARROT", score: 10 }); // different row than the player
  const p = new PlayerController();
  p.reset(map.startPos, 4); // player on the floor row, not row 3
  let pickedUp = false;
  p.onItemPickup = () => (pickedUp = true);

  p.applyInput("MoveRight", map);

  assertTrue("Item on a different row is not collected", !pickedUp && map.items.length === 1);
}

console.log("");
if (failures > 0) {
  console.error(`${failures} gameplay check(s) FAILED.`);
  process.exit(1);
} else {
  console.log("All gameplay checks PASSED.");
}
