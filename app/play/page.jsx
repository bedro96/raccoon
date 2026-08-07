'use client';

import { useEffect, useRef } from 'react';
import { createInitialState, update, CANVAS_WIDTH, CANVAS_HEIGHT, PLAYER_WIDTH, PLAYER_HEIGHT } from '../../lib/gameState.js';

// Fixed virtual resolution (Ponpoko-style low-res, scaled up with nearest-neighbor)
const VIRTUAL_W = CANVAS_WIDTH;
const VIRTUAL_H = CANVAS_HEIGHT;

export default function PlayPage() {
  const canvasRef = useRef(null);

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

      // --- Render ---
      ctx.clearRect(0, 0, VIRTUAL_W, VIRTUAL_H);

      // Background
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);

      // Floor platform
      ctx.fillStyle = '#4a3728';
      ctx.fillRect(0, VIRTUAL_H - PLAYER_HEIGHT, VIRTUAL_W, PLAYER_HEIGHT);

      // Player sprite (flip horizontally when facing left)
      ctx.save();
      if (state.facingLeft) {
        ctx.scale(-1, 1);
        ctx.drawImage(sprite, -state.x - PLAYER_WIDTH, state.y, PLAYER_WIDTH, PLAYER_HEIGHT);
      } else {
        ctx.drawImage(sprite, state.x, state.y, PLAYER_WIDTH, PLAYER_HEIGHT);
      }
      ctx.restore();

      rafId = requestAnimationFrame(loop);
    };

    sprite.onload = () => { rafId = requestAnimationFrame(loop); };
    // If the image is already cached and decoded, onload won't fire — start immediately
    if (sprite.complete) rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        width: '100vw',
        height: '100vh',
        imageRendering: 'pixelated',
      }}
    />
  );
}
