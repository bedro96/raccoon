'use client';

import { useState, useEffect } from 'react';

const overlayStyle = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  zIndex: 2,
  color: '#fff',
  fontFamily: 'monospace',
  backgroundColor: 'rgba(0, 0, 0, 0.75)',
};

/**
 * Shown at game-over.  Lets the player enter a name, submit their score,
 * and then displays the current top-10 leaderboard.
 *
 * Props:
 *   score        {number}        — final score from the game
 *   sessionToken {string|null}   — server-issued token; null means not yet fetched
 */
export default function LeaderboardOverlay({ score, sessionToken }) {
  const [playerName, setPlayerName] = useState('');
  const [status, setStatus] = useState('idle'); // idle | submitting | submitted | error
  const [errorMsg, setErrorMsg] = useState('');
  const [leaderboard, setLeaderboard] = useState([]);

  // Load the leaderboard after a successful submission.
  useEffect(() => {
    if (status !== 'submitted') return;
    fetch('/api/scores?top=10')
      .then((r) => r.json())
      .then((data) => setLeaderboard(data.scores ?? []))
      .catch(() => {});
  }, [status]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    setStatus('submitting');
    try {
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: playerName.trim(), score, sessionToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? 'submission_failed');
        setStatus('error');
      } else {
        setStatus('submitted');
      }
    } catch {
      setErrorMsg('network_error');
      setStatus('error');
    }
  };

  return (
    <div role="dialog" aria-label="Game Over" style={overlayStyle}>
      <span style={{ fontSize: 28 }}>Game Over</span>
      <span style={{ fontSize: 18 }}>Score: {score}</span>

      {(status === 'idle' || status === 'submitting' || status === 'error') && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 14 }}>
            Your name:&nbsp;
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={32}
              style={{ fontFamily: 'monospace', fontSize: 14, padding: '4px 6px' }}
              aria-label="Player name"
            />
          </label>
          {status === 'error' && (
            <span style={{ color: '#f88', fontSize: 12 }}>{errorMsg}</span>
          )}
          <button
            type="submit"
            disabled={status === 'submitting' || !playerName.trim()}
            style={{ fontFamily: 'monospace', fontSize: 14, padding: '6px 14px', cursor: 'pointer' }}
          >
            {status === 'submitting' ? 'Submitting…' : 'Submit Score'}
          </button>
        </form>
      )}

      {status === 'submitted' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14, color: '#8f8' }}>Score submitted!</span>
          <span style={{ fontSize: 16, marginTop: 8 }}>Top 10</span>
          <ol style={{ margin: 0, padding: '0 0 0 20px', fontSize: 14, lineHeight: 1.7 }}>
            {leaderboard.map((entry, i) => (
              <li key={entry.rowKey ?? i}>
                {entry.playerName} — {entry.score}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
