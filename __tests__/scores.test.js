import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../lib/scoresStorage.js';
import {
  issueToken,
  consumeToken,
  validateScore,
  checkRateLimit,
  MAX_SCORE,
  _resetForTest,
} from '../lib/sessionTokens.js';

// ── Storage ───────────────────────────────────────────────────────────────────

describe('createInMemoryStorage', () => {
  it('persists an entry and returns it from getTopScores', async () => {
    const storage = createInMemoryStorage();
    const entry = { rowKey: 'r1', playerName: 'Alice', score: 300, achievedAt: '2024-01-01T00:00:00.000Z' };
    await storage.addScore(entry);
    const top = await storage.getTopScores(10);
    expect(top).toHaveLength(1);
    expect(top[0]).toMatchObject({ playerName: 'Alice', score: 300 });
  });

  it('returns top-N scores in descending order', async () => {
    const storage = createInMemoryStorage();
    await storage.addScore({ rowKey: 'r1', playerName: 'Alice', score: 200, achievedAt: '' });
    await storage.addScore({ rowKey: 'r2', playerName: 'Bob',   score: 400, achievedAt: '' });
    await storage.addScore({ rowKey: 'r3', playerName: 'Carol', score: 100, achievedAt: '' });

    const top2 = await storage.getTopScores(2);
    expect(top2).toHaveLength(2);
    expect(top2[0].score).toBe(400);
    expect(top2[1].score).toBe(200);
  });
});

// ── Session tokens ─────────────────────────────────────────────────────────────

describe('sessionTokens', () => {
  beforeEach(() => _resetForTest());

  it('issues a valid token that can be consumed once', () => {
    const token = issueToken();
    expect(consumeToken(token)).toEqual({ ok: true });
  });

  it('rejects a token on the second use (single-use)', () => {
    const token = issueToken();
    consumeToken(token);
    expect(consumeToken(token).ok).toBe(false);
  });

  it('rejects an unknown token', () => {
    expect(consumeToken('not-a-real-token').ok).toBe(false);
  });

  it('rejects a missing/undefined token', () => {
    expect(consumeToken(undefined).ok).toBe(false);
    expect(consumeToken(null).ok).toBe(false);
    expect(consumeToken('').ok).toBe(false);
  });
});

// ── Score validation ──────────────────────────────────────────────────────────

describe('validateScore', () => {
  it('accepts a valid score', () => {
    const result = validateScore(300);
    expect(result).toEqual({ ok: true, score: 300 });
  });

  it('rejects a negative score', () => {
    expect(validateScore(-1).ok).toBe(false);
  });

  it('rejects a score above MAX_SCORE as implausible', () => {
    const result = validateScore(MAX_SCORE + 1);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('implausible_score');
  });

  it('accepts a score exactly at MAX_SCORE', () => {
    expect(validateScore(MAX_SCORE).ok).toBe(true);
  });

  it('rejects non-numeric values', () => {
    expect(validateScore('abc').ok).toBe(false);
    expect(validateScore(NaN).ok).toBe(false);
    expect(validateScore(Infinity).ok).toBe(false);
  });
});

// ── Rate limiting ─────────────────────────────────────────────────────────────

describe('checkRateLimit', () => {
  beforeEach(() => _resetForTest());

  it('allows the first submission from an IP', () => {
    expect(checkRateLimit('1.2.3.4').ok).toBe(true);
  });

  it('blocks a rapid second submission from the same IP', () => {
    checkRateLimit('1.2.3.4');
    expect(checkRateLimit('1.2.3.4').ok).toBe(false);
  });

  it('allows submission when no IP is provided', () => {
    expect(checkRateLimit(null).ok).toBe(true);
    expect(checkRateLimit(null).ok).toBe(true); // no state → always ok
  });
});

// ── Route handler integration (using injected in-memory storage) ──────────────

import { setStorageClient } from '../lib/scoresStorage.js';
import { POST, GET } from '../app/api/scores/route.js';

function makeRequest(body, url = 'http://localhost/api/scores') {
  return {
    json: async () => body,
    url,
    headers: { get: () => null },
  };
}

describe('POST /api/scores', () => {
  beforeEach(() => {
    _resetForTest();
    setStorageClient(createInMemoryStorage());
  });

  it('persists a valid submission and returns 201', async () => {
    const token = issueToken();
    const req = makeRequest({ playerName: 'Alice', score: 300, sessionToken: token });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.entry.playerName).toBe('Alice');
    expect(data.entry.score).toBe(300);
  });

  it('rejects a missing session token with 401', async () => {
    const req = makeRequest({ playerName: 'Alice', score: 300, sessionToken: null });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('rejects an invalid session token with 401', async () => {
    const req = makeRequest({ playerName: 'Alice', score: 300, sessionToken: 'bad-token' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('rejects an implausible score with 400', async () => {
    const token = issueToken();
    const req = makeRequest({ playerName: 'Alice', score: MAX_SCORE + 1, sessionToken: token });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('implausible_score');
  });
});

describe('GET /api/scores', () => {
  beforeEach(async () => {
    _resetForTest();
    const storage = createInMemoryStorage();
    setStorageClient(storage);
    await storage.addScore({ rowKey: 'r1', playerName: 'Alice', score: 200, achievedAt: '' });
    await storage.addScore({ rowKey: 'r2', playerName: 'Bob',   score: 400, achievedAt: '' });
    await storage.addScore({ rowKey: 'r3', playerName: 'Carol', score: 100, achievedAt: '' });
  });

  it('returns scores in descending order', async () => {
    const req = { url: 'http://localhost/api/scores?top=10', headers: { get: () => null } };
    const res = await GET(req);
    const data = await res.json();
    expect(data.scores[0].score).toBe(400);
    expect(data.scores[1].score).toBe(200);
    expect(data.scores[2].score).toBe(100);
  });

  it('respects the top=N query parameter', async () => {
    const req = { url: 'http://localhost/api/scores?top=2', headers: { get: () => null } };
    const res = await GET(req);
    const data = await res.json();
    expect(data.scores).toHaveLength(2);
  });
});
