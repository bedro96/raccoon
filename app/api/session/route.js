import { NextResponse } from 'next/server';
import { issueToken } from '../../../lib/sessionTokens.js';

/**
 * GET /api/session
 * Issues a short-lived play-session token to the client.
 * The client must present this token when submitting a score.
 */
export function GET() {
  const token = issueToken();
  return NextResponse.json({ sessionToken: token });
}
