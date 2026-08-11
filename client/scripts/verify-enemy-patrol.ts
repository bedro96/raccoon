/**
 * Deterministic verification of enemy patrol math: bounded horizontal
 * oscillation around the spawn point at half of the player's move speed.
 *
 * Run with: npm run verify:enemy-patrol
 */
import { ENEMY_PATROL_SPEED, MOVE_STEP } from "../src/game/constants";
import { getEnemyPatrolX } from "../src/game/enemyPatrol";

const EPSILON = 0.001;
let failures = 0;

function assertClose(label: string, actual: number, expected: number, epsilon = EPSILON): void {
  const diff = Math.abs(actual - expected);
  const pass = diff <= epsilon;
  console.log(
    `[${pass ? "PASS" : "FAIL"}] ${label}: actual=${actual.toFixed(3)} expected=${expected.toFixed(3)} diff=${diff.toFixed(3)}`,
  );
  if (!pass) failures++;
}

function assertTrue(label: string, condition: boolean): void {
  console.log(`[${condition ? "PASS" : "FAIL"}] ${label}`);
  if (!condition) failures++;
}

const spawnX = 320;
const patrolRange = 150;
const expectedSpeed = (MOVE_STEP * 60) / 2;
const quarterCycle = patrolRange / ENEMY_PATROL_SPEED;
const cycleDuration = quarterCycle * 4;

assertClose("Enemy patrol speed is half of player move speed", ENEMY_PATROL_SPEED, expectedSpeed);
assertClose("Patrol starts at spawn X", getEnemyPatrolX(spawnX, patrolRange, 0), spawnX);
assertClose("Patrol reaches the right bound after one quarter-cycle", getEnemyPatrolX(spawnX, patrolRange, quarterCycle), spawnX + patrolRange);
assertClose("Patrol returns to spawn after half-cycle", getEnemyPatrolX(spawnX, patrolRange, quarterCycle * 2), spawnX);
assertClose("Patrol reaches the left bound after three quarter-cycles", getEnemyPatrolX(spawnX, patrolRange, quarterCycle * 3), spawnX - patrolRange);
assertClose("Patrol returns to spawn after a full cycle", getEnemyPatrolX(spawnX, patrolRange, cycleDuration), spawnX);

let minX = Number.POSITIVE_INFINITY;
let maxX = Number.NEGATIVE_INFINITY;
let maxStep = 0;
let previousX = getEnemyPatrolX(spawnX, patrolRange, 0);
const dt = 1 / 240;

for (let elapsed = dt; elapsed <= cycleDuration * 2; elapsed += dt) {
  const x = getEnemyPatrolX(spawnX, patrolRange, elapsed);
  minX = Math.min(minX, x);
  maxX = Math.max(maxX, x);
  maxStep = Math.max(maxStep, Math.abs(x - previousX));
  previousX = x;
}

assertTrue("Patrol never exceeds the left bound", minX >= spawnX - patrolRange - EPSILON);
assertTrue("Patrol never exceeds the right bound", maxX <= spawnX + patrolRange + EPSILON);
assertTrue("Patrol motion stays continuous between samples", maxStep <= ENEMY_PATROL_SPEED * dt + EPSILON);

console.log("");
if (failures > 0) {
  console.error(`${failures} enemy patrol check(s) FAILED.`);
  process.exit(1);
} else {
  console.log("All enemy patrol checks PASSED.");
}
