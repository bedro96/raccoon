/**
 * Unit-level verification of pickup/hazard logic, ported from
 * CPlayerSession::CheckPickupAndHazards. Fast, deterministic checks
 * independent of any browser/Phaser runtime.
 */
import { PlayerController } from "../src/game/PlayerController";
import { FLOOR_Y, getRowY } from "../src/game/constants";
import type { MapData } from "../src/game/types";

let failures = 0;
function assertTrue(label: string, cond: boolean): void {
  console.log(`[${cond ? "PASS" : "FAIL"}] ${label}`);
  if (!cond) failures++;
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

// 2. Spike hazard: respawn + callback, item pickup logic doesn't also fire for the same tile incorrectly
{
  const map = baseMap();
  map.spikes.push({ x: 105, y: FLOOR_Y });
  const p = new PlayerController();
  p.reset(map.startPos, 4);
  let hazardFired = false;
  p.onHazardHit = () => (hazardFired = true);

  p.applyInput("MoveRight", map);

  assertTrue("Spike hazard triggers respawn (x back to start)", p.x === map.startPos.x);
  assertTrue("onHazardHit callback fired for spike", hazardFired);
}

// 3. Enemy hazard: uses spawn position, not any animated/tick-based position
// (replicates the original's confirmed CheckPickupAndHazards quirk -- see the
// map's "Not yet specified" resolution on this ticket).
{
  const map = baseMap();
  map.enemies.push({ x: 105, y: FLOOR_Y, patrolRange: 50 }); // patrolRange is irrelevant to collision, by design
  const p = new PlayerController();
  p.reset(map.startPos, 4);
  let hazardFired = false;
  p.onHazardHit = () => (hazardFired = true);

  p.applyInput("MoveRight", map);

  assertTrue("Enemy hazard (at spawn position) triggers respawn", p.x === map.startPos.x);
  assertTrue("onHazardHit callback fired for enemy", hazardFired);
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
