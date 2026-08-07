import { TableClient } from '@azure/data-tables';

/**
 * Storage abstraction for the Leaderboard table.
 *
 * The default export is a factory that returns a storage client object:
 *   { addScore(entry), getTopScores(n) }
 *
 * Selection order:
 *   1. AZURE_STORAGE_ACCOUNT_URL set -> Azure AD (managed identity / DefaultAzureCredential)
 *      auth against the real Table Storage account. Required when the storage account has
 *      shared-key access disabled (allowSharedKeyAccess: false), e.g. under an Azure Policy
 *      baseline that forbids connection-string/account-key auth.
 *   2. AZURE_STORAGE_CONNECTION_STRING set -> shared-key auth (e.g. Azurite for local dev).
 *   3. Otherwise -> in-memory implementation, also what tests inject directly.
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

function wrapTableClient(tableClient) {
  return {
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
}

// Singleton for the running server process.  Tests bypass this by importing
// createInMemoryStorage directly and injecting it into the route handlers.
let _client = null;

/**
 * Returns the process-level singleton storage client.
 * Falls back to in-memory when no Azure storage configuration is present.
 */
export async function getStorageClient() {
  if (_client) return _client;

  const accountUrl = process.env.AZURE_STORAGE_ACCOUNT_URL;
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

  if (accountUrl) {
    // Azure AD auth via the Container App's managed identity — required when the storage
    // account has shared-key access disabled.
    const { DefaultAzureCredential } = await import('@azure/identity');
    const tableClient = new TableClient(accountUrl, 'Leaderboard', new DefaultAzureCredential());
    try {
      await tableClient.createTable();
    } catch {
      // Table already exists — ignore the conflict error.
    }
    _client = wrapTableClient(tableClient);
  } else if (connectionString) {
    const tableClient = TableClient.fromConnectionString(connectionString, 'Leaderboard');
    try {
      await tableClient.createTable();
    } catch {
      // Table already exists — ignore the conflict error.
    }
    _client = wrapTableClient(tableClient);
  } else {
    _client = createInMemoryStorage();
  }

  return _client;
}

/** Replace the singleton (used in tests). */
export function setStorageClient(client) {
  _client = client;
}
