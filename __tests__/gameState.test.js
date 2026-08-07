import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  update,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  INITIAL_LIVES,
} from '../lib/gameState.js';

const NO_INPUT = { left: false, right: false, up: false, down: false, jump: false };

describe('createInitialState', () => {
  it('places the player at the centre-bottom of the canvas', () => {
    const s = createInitialState();
    expect(s.x).toBe(CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2);
    expect(s.y).toBe(CANVAS_HEIGHT - PLAYER_HEIGHT);
    expect(s.onGround).toBe(true);
    expect(s.lives).toBe(INITIAL_LIVES);
    expect(s.score).toBe(0);
    expect(s.enemies).toHaveLength(1);
    expect(s.collectibles.length).toBeGreaterThan(0);
  });
});

describe('update — movement', () => {
  it('moves right when right input is active', () => {
    const s = createInitialState();
    const s2 = update(s, { ...NO_INPUT, right: true }, 1);
    expect(s2.x).toBeGreaterThan(s.x);
    expect(s2.facingLeft).toBe(false);
  });

  it('moves left when left input is active', () => {
    const s = createInitialState();
    const s2 = update(s, { ...NO_INPUT, left: true }, 1);
    expect(s2.x).toBeLessThan(s.x);
    expect(s2.facingLeft).toBe(true);
  });

  it('does not move horizontally when no left/right input', () => {
    const s = createInitialState();
    const s2 = update(s, NO_INPUT, 0.1);
    expect(s2.x).toBe(s.x);
  });

  it('moves up when up input is active while on ground', () => {
    const s = createInitialState();
    const s2 = update(s, { ...NO_INPUT, up: true }, 0.1);
    expect(s2.y).toBeLessThan(s.y);
    // Climbing lifts the player off the ground
    expect(s2.onGround).toBe(false);
    expect(s2.isClimbing).toBe(true);
  });

  it('moves down when down input is active while on ground', () => {
    // Start the player above the floor so there is room to move down
    const s = { ...createInitialState(), y: CANVAS_HEIGHT - PLAYER_HEIGHT - 20, onGround: true, isClimbing: false };
    const s2 = update(s, { ...NO_INPUT, down: true }, 0.1);
    expect(s2.y).toBeGreaterThan(s.y);
    expect(s2.isClimbing).toBe(true);
  });

  it('falls back to the ground after releasing Up while climbing mid-air', () => {
    let s = createInitialState();
    // Climb upward for a short time
    for (let i = 0; i < 10; i++) {
      s = update(s, { ...NO_INPUT, up: true }, 0.016);
    }
    expect(s.isClimbing).toBe(true);
    expect(s.onGround).toBe(false);
    // Release Up — player should fall due to gravity
    for (let i = 0; i < 200; i++) {
      s = update(s, NO_INPUT, 0.016);
    }
    expect(s.onGround).toBe(true);
    expect(s.y).toBe(CANVAS_HEIGHT - PLAYER_HEIGHT);
  });
});

describe('update — jump', () => {
  it('sets negative vy and leaves ground when jump is pressed from ground', () => {
    const s = createInitialState();
    const s2 = update(s, { ...NO_INPUT, jump: true }, 0.016);
    expect(s2.vy).toBeLessThan(0);
    expect(s2.onGround).toBe(false);
  });

  it('does not re-trigger jump while already airborne', () => {
    const s = createInitialState();
    const s2 = update(s, { ...NO_INPUT, jump: true }, 0.016);
    const vy2 = s2.vy;
    const s3 = update(s2, { ...NO_INPUT, jump: true }, 0.016);
    // vy should not reset to JUMP_VELOCITY again — gravity accelerates it downward
    expect(s3.vy).toBeGreaterThan(vy2);
  });

  it('lands back on the ground after sufficient time', () => {
    let s = createInitialState();
    s = update(s, { ...NO_INPUT, jump: true }, 0.016);
    // Simulate ~2 s of frames
    for (let i = 0; i < 125; i++) {
      s = update(s, NO_INPUT, 0.016);
    }
    expect(s.onGround).toBe(true);
    expect(s.y).toBe(CANVAS_HEIGHT - PLAYER_HEIGHT);
  });
});

describe('update — boundary conditions', () => {
  it('wraps player to the right side when crossing the left edge', () => {
    const s = { ...createInitialState(), x: -PLAYER_WIDTH - 1, onGround: true };
    const s2 = update(s, NO_INPUT, 0.001);
    expect(s2.x).toBe(CANVAS_WIDTH);
  });

  it('wraps player to the left side when crossing the right edge', () => {
    const s = { ...createInitialState(), x: CANVAS_WIDTH + 1, onGround: true };
    const s2 = update(s, NO_INPUT, 0.001);
    expect(s2.x).toBe(-PLAYER_WIDTH);
  });

  it('clamps to the floor', () => {
    const s = { ...createInitialState(), y: CANVAS_HEIGHT + 10, vy: 50, onGround: false };
    const s2 = update(s, NO_INPUT, 0.016);
    expect(s2.y).toBe(CANVAS_HEIGHT - PLAYER_HEIGHT);
    expect(s2.onGround).toBe(true);
  });

  it('clamps to the ceiling', () => {
    const s = { ...createInitialState(), y: 0, vy: -300, onGround: false };
    const s2 = update(s, NO_INPUT, 0.016);
    expect(s2.y).toBe(0);
    expect(s2.vy).toBe(0);
  });
});

describe('update — enemies and lives', () => {
  it('reduces lives by 1 and enters respawn recovery after a genuine collision', () => {
    const s = createInitialState();
    const s2 = update(s, NO_INPUT, 0.016);
    const s3 = update(
      {
        ...s2,
        x: s2.enemies[0].x,
        y: s2.enemies[0].y,
        enemies: [{ ...s2.enemies[0], vx: 0 }],
      },
      NO_INPUT,
      0.016
    );

    expect(s3.lives).toBe(INITIAL_LIVES - 1);
    expect(s3.respawnTimer).toBeGreaterThan(0);
    expect(s3.x).toBe(s3.spawnX);
    expect(s3.y).toBe(s3.spawnY);
    expect(s3.gameOver).toBe(false);
  });

  it('sets game over when a collision drops lives to zero', () => {
    const s = createInitialState();
    const s2 = update(
      {
        ...s,
        lives: 1,
        x: s.enemies[0].x,
        y: s.enemies[0].y,
        enemies: [{ ...s.enemies[0], vx: 0 }],
      },
      NO_INPUT,
      0.016
    );

    expect(s2.lives).toBe(0);
    expect(s2.gameOver).toBe(true);
  });

  it('does not reduce lives when rectangles only touch edges without overlapping', () => {
    const s = createInitialState();
    const s2 = update(
      {
        ...s,
        y: s.enemies[0].y,
        enemies: [{ ...s.enemies[0], x: s.x + PLAYER_WIDTH, y: s.y, vx: 0 }],
      },
      NO_INPUT,
      0.016
    );

    expect(s2.lives).toBe(INITIAL_LIVES);
    expect(s2.gameOver).toBe(false);
  });
});

describe('update — collectibles and score', () => {
  it('increases score by the collectible value and removes the collected item', () => {
    const s = createInitialState();
    const collectible = s.collectibles[0];
    const s2 = update(
      {
        ...s,
        x: collectible.x,
        y: collectible.y,
        enemies: [{ ...s.enemies[0], x: 0, y: 0, vx: 0 }],
      },
      NO_INPUT,
      0.016
    );

    expect(s2.score).toBe(100);
    expect(s2.collectibles).toHaveLength(s.collectibles.length - 1);
  });

  it('does not change score without a genuine collection event', () => {
    const s = createInitialState();
    const collectible = s.collectibles[0];
    const s2 = update(
      {
        ...s,
        x: collectible.x - PLAYER_WIDTH,
        y: collectible.y,
        enemies: [{ ...s.enemies[0], x: 0, y: 0, vx: 0 }],
      },
      NO_INPUT,
      0.016
    );

    expect(s2.score).toBe(0);
    expect(s2.collectibles).toHaveLength(s.collectibles.length);
  });
});
