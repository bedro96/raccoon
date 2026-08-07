'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createInitialState,
  update,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  ENEMY_WIDTH,
  ENEMY_HEIGHT,
  COLLECTIBLE_SIZE,
  INITIAL_LIVES,
} from '../../lib/gameState.js';

// Fixed virtual resolution (Ponpoko-style low-res, scaled up with nearest-neighbor)
const VIRTUAL_W = CANVAS_WIDTH;
const VIRTUAL_H = CANVAS_HEIGHT;
const INITIAL_HUD = { lives: INITIAL_LIVES, score: 0, gameOver: false };

export default function PlayPage() {
  const canvasRef = useRef(null);
  const hudRef = useRef(INITIAL_HUD);
  const [hud, setHud] = useState(INITIAL_HUD);
  const audioRef = useRef({ ctx: null, masterGain: null, musicGain: null, musicTimer: null, melodyIndex: 0 });
  const mutedRef = useRef(false);
  const [muted, setMuted] = useState(false);

  const setAudioMuted = useCallback((nextMuted) => {
    mutedRef.current = nextMuted;
    setMuted(nextMuted);
    const audio = audioRef.current;
    if (audio.ctx && audio.masterGain) {
      audio.masterGain.gain.cancelScheduledValues(audio.ctx.currentTime);
      audio.masterGain.gain.setValueAtTime(nextMuted ? 0 : 0.2, audio.ctx.currentTime);
    }
  }, []);

  const playTone = useCallback((frequency, duration, type, gainNode, volume = 0.18) => {
    const audio = audioRef.current;
    if (!audio.ctx || !gainNode) return;
    const now = audio.ctx.currentTime;
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(gainNode);
    osc.start(now);
    osc.stop(now + duration);
  }, []);

  const startMelody = useCallback(() => {
    const audio = audioRef.current;
    if (!audio.ctx || !audio.musicGain || audio.musicTimer) return;
    const melody = [261.63, 329.63, 392, 329.63, 293.66, 349.23, 440, 349.23];
    audio.musicTimer = window.setInterval(() => {
      const current = audioRef.current;
      if (!current.ctx || !current.musicGain) return;
      const note = melody[current.melodyIndex % melody.length];
      current.melodyIndex += 1;
      playTone(note, 0.16, 'triangle', current.musicGain, 0.08);
    }, 220);
  }, [playTone]);

  const ensureAudio = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const audio = audioRef.current;
    if (!audio.ctx) {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) return;
      const ctx = new AudioContextCtor();
      const masterGain = ctx.createGain();
      masterGain.gain.value = mutedRef.current ? 0 : 0.2;
      masterGain.connect(ctx.destination);
      const musicGain = ctx.createGain();
      musicGain.gain.value = 1;
      musicGain.connect(masterGain);
      audio.ctx = ctx;
      audio.masterGain = masterGain;
      audio.musicGain = musicGain;
      startMelody();
    }
    if (audioRef.current.ctx?.state === 'suspended') {
      await audioRef.current.ctx.resume();
    }
  }, [startMelody]);

  const playSfx = useCallback((kind) => {
    const audio = audioRef.current;
    if (!audio.ctx || !audio.masterGain) return;
    if (kind === 'jump') {
      playTone(440, 0.12, 'square', audio.masterGain, 0.16);
    } else if (kind === 'climb') {
      playTone(620, 0.08, 'sawtooth', audio.masterGain, 0.1);
    } else if (kind === 'lose-life') {
      playTone(220, 0.2, 'square', audio.masterGain, 0.18);
    } else if (kind === 'game-over') {
      playTone(180, 0.28, 'triangle', audio.masterGain, 0.2);
      playTone(120, 0.36, 'triangle', audio.masterGain, 0.14);
    }
  }, [playTone]);

  const onToggleAudio = useCallback(() => {
    const nextMuted = !mutedRef.current;
    setAudioMuted(nextMuted);
    if (!nextMuted) {
      void ensureAudio();
    }
  }, [ensureAudio, setAudioMuted]);

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
        void ensureAudio();
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

      const previousState = state;
      state = update(previousState, input, dt);

      if (previousState.onGround && input.jump && !state.onGround) {
        playSfx('jump');
      }
      if (!previousState.isClimbing && state.isClimbing) {
        playSfx('climb');
      }
      if (state.gameOver && !previousState.gameOver) {
        playSfx('game-over');
      } else if (state.lives < previousState.lives) {
        playSfx('lose-life');
      }

      if (
        state.lives !== hudRef.current.lives ||
        state.score !== hudRef.current.score ||
        state.gameOver !== hudRef.current.gameOver
      ) {
        hudRef.current = { lives: state.lives, score: state.score, gameOver: state.gameOver };
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

      for (const collectible of state.collectibles) {
        ctx.fillStyle = '#f3c969';
        ctx.fillRect(collectible.x, collectible.y, COLLECTIBLE_SIZE, COLLECTIBLE_SIZE);
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
      const audio = audioRef.current;
      if (audio.musicTimer) {
        window.clearInterval(audio.musicTimer);
        audio.musicTimer = null;
      }
      if (audio.ctx) {
        void audio.ctx.close();
      }
      audioRef.current = { ctx: null, masterGain: null, musicGain: null, musicTimer: null, melodyIndex: 0 };
    };
  }, [ensureAudio, playSfx]);

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
        <span style={{ marginLeft: 12 }}>Score: {hud.score}</span>
      </div>
      <button
        type="button"
        onClick={onToggleAudio}
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 2,
          fontFamily: 'monospace',
          fontSize: 14,
          padding: '6px 10px',
          cursor: 'pointer',
        }}
      >
        {muted ? 'Unmute' : 'Mute'}
      </button>
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
