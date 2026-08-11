import { ENEMY_PATROL_SPEED } from "./constants";

/** Returns the enemy's live patrol X for the given elapsed time. */
export function getEnemyPatrolX(spawnX: number, patrolRange: number, elapsedSeconds: number): number {
  if (patrolRange <= 0) return spawnX;

  const totalDistance = elapsedSeconds * ENEMY_PATROL_SPEED;
  const loopDistance = patrolRange * 4;
  const phase = ((totalDistance % loopDistance) + loopDistance) % loopDistance;

  if (phase <= patrolRange) return spawnX + phase;
  if (phase <= patrolRange * 3) return spawnX + patrolRange * 2 - phase;
  return spawnX + phase - loopDistance;
}
