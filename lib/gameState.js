/**
 * Pure game-state module — no DOM or Canvas dependency.
 * All physics constants assume a 256×240 virtual canvas (Ponpoko-style).
 *
 * update(state, input, dt) -> newState
 *   state  – current GameState object
 *   input  – { left, right, up, down, jump } booleans
 *   dt     – elapsed seconds since last frame
 */

export const CANVAS_WIDTH = 256;
export const CANVAS_HEIGHT = 240;

export const PLAYER_WIDTH = 16;
export const PLAYER_HEIGHT = 16;

const MOVE_SPEED = 80;   // px/s horizontal
const CLIMB_SPEED = 60;  // px/s vertical (up/down)
const JUMP_VELOCITY = -200; // px/s (negative = upward)
const GRAVITY = 500;     // px/s²

/**
 * Returns a fresh initial state.
 */
export function createInitialState() {
  return {
    x: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2,
    y: CANVAS_HEIGHT - PLAYER_HEIGHT,
    vx: 0,
    vy: 0,
    onGround: true,
    facingLeft: false,
  };
}

/**
 * Advances the game state by dt seconds given current input.
 * Returns a new state object (the original is not mutated).
 */
export function update(state, input, dt) {
  let { x, y, vx, vy, onGround, facingLeft } = state;

  // Horizontal movement
  if (input.left) {
    vx = -MOVE_SPEED;
    facingLeft = true;
  } else if (input.right) {
    vx = MOVE_SPEED;
    facingLeft = false;
  } else {
    vx = 0;
  }

  // Jump takes priority over climbing (both checked only from ground)
  if (input.jump && onGround) {
    vy = JUMP_VELOCITY;
    onGround = false;
  } else if (onGround) {
    // Vertical movement / climbing when not jumping
    if (input.up) {
      vy = -CLIMB_SPEED;
    } else if (input.down) {
      vy = CLIMB_SPEED;
    } else {
      vy = 0;
    }
  }

  // Apply gravity when airborne
  if (!onGround) {
    vy += GRAVITY * dt;
  }

  // Integrate positions
  x += vx * dt;
  y += vy * dt;

  // --- Boundary clamping ---

  // Horizontal wrapping (Ponpoko lets the player wrap left/right)
  if (x + PLAYER_WIDTH < 0) x = CANVAS_WIDTH;
  if (x > CANVAS_WIDTH) x = -PLAYER_WIDTH;

  // Floor
  const floorY = CANVAS_HEIGHT - PLAYER_HEIGHT;
  if (y >= floorY) {
    y = floorY;
    vy = 0;
    onGround = true;
  }

  // Ceiling
  if (y < 0) {
    y = 0;
    vy = 0;
  }

  return { x, y, vx, vy, onGround, facingLeft };
}
