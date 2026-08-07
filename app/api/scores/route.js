import { NextResponse } from 'next/server';
import { consumeToken, checkRateLimit, validateScore } from '../../../lib/sessionTokens.js';
import { getStorageClient } from '../../../lib/scoresStorage.js';

/**
 * POST /api/scores
 * Body: { playerName: string, score: number, sessionToken: string }
 *
 * Validates the session token, clamps/rejects implausible scores, and
 * persists the entry to the Leaderboard table.
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { playerName, score, sessionToken } = body ?? {};

  // Validate player name and score BEFORE consuming the single-use token so
  // that a bad payload does not burn the token.
  if (!playerName || typeof playerName !== 'string' || playerName.trim().length === 0) {
    return NextResponse.json({ error: 'invalid_player_name' }, { status: 400 });
  }
  const name = playerName.trim().slice(0, 32);

  const scoreResult = validateScore(score);
  if (!scoreResult.ok) {
    return NextResponse.json({ error: scoreResult.reason }, { status: 400 });
  }

  // Validate session token (single-use — consumed here)
  const tokenResult = consumeToken(sessionToken);
  if (!tokenResult.ok) {
    return NextResponse.json({ error: tokenResult.reason }, { status: 401 });
  }

  // Rate limiting by IP
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    null;
  const rateResult = checkRateLimit(ip);
  if (!rateResult.ok) {
    return NextResponse.json({ error: rateResult.reason }, { status: 429 });
  }

  const entry = {
    rowKey: crypto.randomUUID(),
    playerName: name,
    score: scoreResult.score,
    achievedAt: new Date().toISOString(),
  };

  const storage = await getStorageClient();
  await storage.addScore(entry);

  return NextResponse.json({ ok: true, entry }, { status: 201 });
}

/**
 * GET /api/scores?top=10
 * Returns the top N scores (default 10) in descending order.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const top = Math.min(Math.max(parseInt(searchParams.get('top') ?? '10', 10), 1), 100);

  const storage = await getStorageClient();
  const scores = await storage.getTopScores(top);

  return NextResponse.json({ scores });
}
