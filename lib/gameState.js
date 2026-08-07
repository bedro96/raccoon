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
export const ENEMY_WIDTH = 16;
export const ENEMY_HEIGHT = 16;
export const INITIAL_LIVES = 3;
export const COLLECTIBLE_SIZE = 8;
export const COLLECTIBLE_POINTS = 100;

const MOVE_SPEED = 80;   // px/s horizontal
const CLIMB_SPEED = 60;  // px/s vertical (up/down)
const JUMP_VELOCITY = -200; // px/s (negative = upward)
const GRAVITY = 500;     // px/s²
const ENEMY_SPEED = 40;  // px/s horizontal patrol
const RESPAWN_DURATION = 1; // s of brief recovery after a hit

function createHunter() {
  return {
    type: 'hunter',
    x: 32,
    y: CANVAS_HEIGHT - ENEMY_HEIGHT,
    vx: ENEMY_SPEED,
  };
}

function createCollectibles() {
  const floorY = CANVAS_HEIGHT - PLAYER_HEIGHT;
  return [
    { x: 24, y: floorY - 64 },
    { x: 88, y: floorY - 96 },
    { x: 152, y: floorY - 64 },
    { x: 216, y: floorY - 96 },
  ];
}

function intersects(a, aWidth, aHeight, b, bWidth, bHeight) {
  return (
    a.x < b.x + bWidth &&
    a.x + aWidth > b.x &&
    a.y < b.y + bHeight &&
    a.y + aHeight > b.y
  );
}

function updateEnemy(enemy, dt) {
  let x = enemy.x + enemy.vx * dt;
  let vx = enemy.vx;
  const maxX = CANVAS_WIDTH - ENEMY_WIDTH;

  if (x <= 0) {
    x = 0;
    vx = Math.abs(vx);
  } else if (x >= maxX) {
    x = maxX;
    vx = -Math.abs(vx);
  }

  return {
    ...enemy,
    x,
    y: CANVAS_HEIGHT - ENEMY_HEIGHT,
    vx,
  };
}

/**
 * Returns a fresh initial state.
 */
export function createInitialState() {
  const spawnX = CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2;
  const spawnY = CANVAS_HEIGHT - PLAYER_HEIGHT;

  return {
    x: spawnX,
    y: spawnY,
    vx: 0,
    vy: 0,
    onGround: true,
    isClimbing: false,
    facingLeft: false,
    lives: INITIAL_LIVES,
    score: 0,
    gameOver: false,
    respawnTimer: 0,
    spawnX,
    spawnY,
    enemies: [createHunter()],
    collectibles: createCollectibles(),
  };
}

/**
 * Advances the game state by dt seconds given current input.
 * Returns a new state object (the original is not mutated).
 */
export function update(state, input, dt) {
  if (state.gameOver) {
    return state;
  }

  let {
    x,
    y,
    vx,
    vy,
    onGround,
    isClimbing,
    facingLeft,
    lives,
    score,
    respawnTimer,
    spawnX,
    spawnY,
  } = state;
  const enemies = state.enemies.map((enemy) => updateEnemy(enemy, dt));
  let collectibles = state.collectibles;

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

  // Jump takes priority over climbing
  if (input.jump && onGround) {
    vy = JUMP_VELOCITY;
    onGround = false;
    isClimbing = false;
  } else if (input.up || input.down) {
    // Climbing: leave the ground so gravity can re-engage when released
    isClimbing = true;
    onGround = false;
    vy = input.up ? -CLIMB_SPEED : CLIMB_SPEED;
  } else {
    // No vertical input: stop climbing; gravity will pull the player down if airborne
    isClimbing = false;
  }

  // Apply gravity when airborne and not actively climbing
  if (!onGround && !isClimbing) {
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
    isClimbing = false;
  }

  // Ceiling
  if (y < 0) {
    y = 0;
    vy = 0;
  }

  respawnTimer = Math.max(0, respawnTimer - dt);

  const player = { x, y };
  const collectedCount = collectibles.reduce(
   (count, collectible) => count + (intersects(player, PLAYER_WIDTH, PLAYER_HEIGHT, collectible, COLLECTIBLE_SIZE, COLLECTIBLE_SIZE) ? 1 : 0),
   0
  );
  if (collectedCount > 0) {
   collectibles = collectibles.filter((collectible) =>
     !intersects(player, PLAYER_WIDTH, PLAYER_HEIGHT, collectible, COLLECTIBLE_SIZE, COLLECTIBLE_SIZE)
   );
   score += collectedCount * COLLECTIBLE_POINTS;
  }

  const collided = respawnTimer <= 0 && enemies.some((enemy) =>
   intersects(player, PLAYER_WIDTH, PLAYER_HEIGHT, enemy, ENEMY_WIDTH, ENEMY_HEIGHT)
  );

  let gameOver = false;
  if (collided) {
   lives -= 1;
   if (lives <= 0) {
     lives = 0;
     gameOver = true;
     vx = 0;
     vy = 0;
   } else {
     x = spawnX;
     y = spawnY;
     vx = 0;
     vy = 0;
     onGround = true;
     isClimbing = false;
     respawnTimer = RESPAWN_DURATION;
   }
  }

  return {
   ...state,
   x,
   y,
   vx,
   vy,
   onGround,
   isClimbing,
   facingLeft,
   lives,
   score,
   gameOver,
   respawnTimer,
   enemies,
   collectibles,
  };
}
