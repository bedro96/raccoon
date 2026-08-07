'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createInitialState,
  update,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  ENEMY_WIDTH,
  ENEMY_HEIGHT,
  INITIAL_LIVES,
} from '../../lib/gameState.js';

// Fixed virtual resolution (Ponpoko-style low-res, scaled up with nearest-neighbor)
const VIRTUAL_W = CANVAS_WIDTH;
const VIRTUAL_H = CANVAS_HEIGHT;

export default function PlayPage() {
  const canvasRef = useRef(null);
  const hudRef = useRef({ lives: INITIAL_LIVES, gameOver: false });
  const [hud, setHud] = useState(hudRef.current);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Fixed virtual resolution; CSS scales it to fill the viewport
    canvas.width = VIRTUAL_W;
    canvas.height = VIRTUAL_H;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    // --- Input state ---
    const keys = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false, Space: false };

    const onKeyDown = (e) => {
      if (e.code in keys) {
        keys[e.code] = true;
        e.preventDefault();
      }
    };
    const onKeyUp = (e) => {
      if (e.code in keys) {
        keys[e.code] = false;
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // --- Player sprite —- start loop only once image is loaded ---
    const sprite = new Image();
    sprite.src = '/player.png';

    // --- Game state ---
    let state = createInitialState();
    let lastTime = null;
    let rafId = null;

    // --- Game loop ---
    const loop = (timestamp) => {
      if (lastTime === null) lastTime = timestamp;
      const dt = Math.min((timestamp - lastTime) / 1000, 0.05); // cap at 50 ms
      lastTime = timestamp;

      const input = {
        left:  keys.ArrowLeft,
        right: keys.ArrowRight,
        up:    keys.ArrowUp,
        down:  keys.ArrowDown,
        jump:  keys.Space,
      };

      state = update(state, input, dt);
      if (state.lives !== hudRef.current.lives || state.gameOver !== hudRef.current.gameOver) {
        hudRef.current = { lives: state.lives, gameOver: state.gameOver };
        setHud(hudRef.current);
      }

      // --- Render ---
      ctx.clearRect(0, 0, VIRTUAL_W, VIRTUAL_H);

      // Background
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);

      // Floor platform
      ctx.fillStyle = '#4a3728';
      ctx.fillRect(0, VIRTUAL_H - PLAYER_HEIGHT, VIRTUAL_W, PLAYER_HEIGHT);

      for (const enemy of state.enemies) {
        ctx.fillStyle = '#c84b31';
        ctx.fillRect(enemy.x, enemy.y, ENEMY_WIDTH, ENEMY_HEIGHT);
      }

      const shouldDrawPlayer = state.respawnTimer === 0 || Math.floor(timestamp / 100) % 2 === 0;
      if (shouldDrawPlayer) {
        // Player sprite (flip horizontally when facing left)
        ctx.save();
        if (state.facingLeft) {
          ctx.scale(-1, 1);
          ctx.drawImage(sprite, -state.x - PLAYER_WIDTH, state.y, PLAYER_WIDTH, PLAYER_HEIGHT);
        } else {
          ctx.drawImage(sprite, state.x, state.y, PLAYER_WIDTH, PLAYER_HEIGHT);
        }
        ctx.restore();
      }

      rafId = requestAnimationFrame(loop);
    };

    // Guard against duplicate loops when onload fires for an already-cached image
    let started = false;
    const startLoop = () => {
      if (started) return;
      started = true;
      rafId = requestAnimationFrame(loop);
    };
    sprite.onload = startLoop;
    if (sprite.complete) startLoop();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
      }}
    >
      <div
        aria-live="polite"
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 1,
          color: '#fff',
          fontFamily: 'monospace',
          fontSize: 16,
          pointerEvents: 'none',
        }}
      >
        Lives: {hud.lives}
      </div>
      {hud.gameOver && (
        <div
          role="alert"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            zIndex: 1,
            color: '#fff',
            fontFamily: 'monospace',
            fontSize: 24,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            pointerEvents: 'none',
          }}
        >
          Game Over
        </div>
      )}
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100vw',
          height: '100vh',
          imageRendering: 'pixelated',
        }}
      />
    </div>
  );
}
