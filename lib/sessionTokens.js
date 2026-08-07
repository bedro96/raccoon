/**
 * Server-side session-token management.
 *
 * A session token is a random UUID issued to the client just before a game
 * starts.  It must be presented when submitting a score.  Each token is
 * single-use (consumed on first valid submission) and expires after
 * TOKEN_TTL_MS milliseconds.
 *
 * Rate limiting: the same session token cannot be used more than once, and
 * RATE_LIMIT_WINDOW_MS guards against a burst of re-issued tokens all being
 * submitted in quick succession by keying on the client IP (when available).
 */

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_WINDOW_MS = 10_000;  // 10 s between submissions per IP
const MAX_SCORE = 9_999;              // plausibility clamp

/**
 * @type {Map<string, number>} token -> issuedAt timestamp
 */
const _tokens = new Map();

/**
 * @type {Map<string, number>} ip -> lastSubmissionAt timestamp
 */
const _ipLastSubmit = new Map();

/** Issue a fresh session token and return it. */
export function issueToken() {
  const token = crypto.randomUUID();
  _tokens.set(token, Date.now());
  return token;
}

/**
 * Validate a session token and, if valid, consume it (single-use).
 *
 * @param {string} token
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function consumeToken(token) {
  if (!token || typeof token !== 'string') {
    return { ok: false, reason: 'missing_token' };
  }

  const issuedAt = _tokens.get(token);
  if (issuedAt === undefined) {
    return { ok: false, reason: 'invalid_token' };
  }

  if (Date.now() - issuedAt > TOKEN_TTL_MS) {
    _tokens.delete(token);
    return { ok: false, reason: 'expired_token' };
  }

  _tokens.delete(token); // single-use
  return { ok: true };
}

/**
 * Check per-IP rate limit.
 *
 * @param {string | null} ip
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function checkRateLimit(ip) {
  if (!ip) return { ok: true }; // no IP info — skip limiting
  const last = _ipLastSubmit.get(ip) ?? 0;
  if (Date.now() - last < RATE_LIMIT_WINDOW_MS) {
    return { ok: false, reason: 'rate_limited' };
  }
  _ipLastSubmit.set(ip, Date.now());
  return { ok: true };
}

/**
 * Clamp/validate a raw score value.
 *
 * @param {number} score
 * @returns {{ ok: true, score: number } | { ok: false, reason: string }}
 */
export function validateScore(score) {
  const n = Number(score);
  if (!Number.isFinite(n) || n < 0) {
    return { ok: false, reason: 'invalid_score' };
  }
  if (n > MAX_SCORE) {
    return { ok: false, reason: 'implausible_score' };
  }
  return { ok: true, score: Math.round(n) };
}

export { MAX_SCORE };

// ── test helpers ─────────────────────────────────────────────────────────────

/** Reset all in-process state (tokens + rate-limit map).  Tests only. */
export function _resetForTest() {
  _tokens.clear();
  _ipLastSubmit.clear();
}
