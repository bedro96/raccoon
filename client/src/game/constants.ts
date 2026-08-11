/**
 * Physics/movement constants ported 1:1 from the original Ponpoko reference
 * game (C++/DirectX9). See the "Reverse-engineer Ponpoko level map format &
 * physics constants" ticket for the source citations these were taken from
 * (PlayerSession.h, PonpokoHelper.h).
 */

// Row layout (PonpokoHelper.h)
export const CEILING_Y = 150.0;
export const FLOOR_Y = 750.0;
export const PLATFORM_ROW_COUNT = 4;

/** Y pixel position of a given row index (0 = topmost row, PLATFORM_ROW_COUNT = floor). */
export function getRowY(rowIndex: number): number {
  const spacing = (FLOOR_Y - CEILING_Y) / (PLATFORM_ROW_COUNT + 1);
  return CEILING_Y + spacing * (rowIndex + 1);
}

// Player movement (PlayerSession.h)
export const MOVE_STEP = 4.32; // px per key-event; 10% slower than the original's 6.0px, then a further 20% slower on top, per explicit requests (deliberate deviation from exact-replica fidelity)
export const PLAYER_MOVE_SPEED = MOVE_STEP * 60; // px/s at Ponpoko's 60Hz update cadence
export const LADDER_TOLERANCE = 20.0; // px, max distance from ladder center to mount
export const PICKUP_RADIUS = 20.0; // px, item/spike/enemy hazard detection radius
export const FLOOR_LEFT_BOUND = 20.0;
export const FLOOR_RIGHT_BOUND = 980.0;

export const JUMP_DURATION = 0.5; // seconds, fixed-duration parabolic arc
export const JUMP_HEIGHT = 60.0; // px, peak visual offset
export const JUMP_DISTANCE = 80.0; // px, horizontal displacement over the jump

export const CLIMB_DURATION = 0.3; // seconds per row
export const FALL_DURATION = 0.15; // seconds per row, cascades if no platform found

// Enemy patrol (PonpokoHelper.h)
export const ENEMY_PATROL_SPEED = PLAYER_MOVE_SPEED / 2; // px/s, deliberately derived from the current player speed
export const ENEMY_SPEED = 40.0; // px/s
export const ENEMY_TICK_DURATION = 1.0 / 60.0;

// Window (main.cpp)
export const GAME_WIDTH = 1000;
export const GAME_HEIGHT = 800;
