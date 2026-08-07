/**
 * Storage abstraction for the Leaderboard table.
 *
 * The default export is a factory that returns a storage client object:
 *   { addScore(entry), getTopScores(n) }
 *
 * In production (when AZURE_STORAGE_CONNECTION_STRING is set) the real
 * Azure Table Storage client is used.  In all other environments an
 * in-memory implementation is returned, which is also what tests inject.
 *
 * Consumers should call createStorageClient() once and reuse the result.
 */

/** @typedef {{ playerName: string, score: number, achievedAt: string, rowKey: string }} ScoreEntry */

/**
 * Creates an in-memory storage client suitable for local development and
 * unit tests.  Scores are kept in a plain array for the lifetime of the
 * module (or until the array is externally replaced in tests).
 *
 * @returns {{ addScore: (entry: ScoreEntry) => Promise<void>, getTopScores: (n: number) => Promise<ScoreEntry[]> }}
 */
export function createInMemoryStorage() {
  /** @type {ScoreEntry[]} */
  const rows = [];

  return {
    async addScore(entry) {
      rows.push({ ...entry });
    },

    async getTopScores(n = 10) {
      return [...rows]
        .sort((a, b) => b.score - a.score)
        .slice(0, n);
    },
  };
}

// Singleton for the running server process.  Tests bypass this by importing
// createInMemoryStorage directly and injecting it into the route handlers.
let _client = null;

/**
 * Returns the process-level singleton storage client.
 * Falls back to in-memory when no Azure connection string is present.
 */
export async function getStorageClient() {
  if (_client) return _client;

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

  if (connectionString) {
    // Lazy-import with a literal specifier so Next's output:standalone file
    // tracer can include the SDK in the deployable bundle.
    const { TableClient } = await import('@azure/data-tables');
    const tableClient = TableClient.fromConnectionString(connectionString, 'Leaderboard');
    try {
      await tableClient.createTable();
    } catch {
      // Table already exists — ignore the conflict error.
    }

    _client = {
      async addScore(entry) {
        await tableClient.createEntity({
          partitionKey: 'global',
          rowKey: entry.rowKey,
          PlayerName: entry.playerName,
          Score: entry.score,
          AchievedAt: entry.achievedAt,
        });
      },

      async getTopScores(n = 10) {
        const results = [];
        for await (const entity of tableClient.listEntities()) {
          results.push({
            rowKey: entity.rowKey,
            playerName: entity.PlayerName,
            score: entity.Score,
            achievedAt: entity.AchievedAt,
          });
        }
        return results
          .sort((a, b) => b.score - a.score)
          .slice(0, n);
      },
    };
  } else {
    _client = createInMemoryStorage();
  }

  return _client;
}

/** Replace the singleton (used in tests). */
export function setStorageClient(client) {
  _client = client;
}
