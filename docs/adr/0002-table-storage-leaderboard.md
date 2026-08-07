# Use Azure Table Storage for the leaderboard

We considered Cosmos DB, Azure Database for PostgreSQL, and Redis for the persistent single-player
leaderboard, and chose Azure Table Storage. The access pattern is simple — append a score, read the
top N — and Table Storage is the cheapest, simplest option with no server to manage, avoiding the
cost and operational surface of a full document/relational database for a single small table.

Schema: a single `Leaderboard` table, `PartitionKey` fixed to a constant (one global leaderboard),
`RowKey` a GUID (or a sortable key encoding score for native top-N ordering), columns `PlayerName`,
`Score`, `AchievedAt`. Exposed via a Next.js API route `/api/scores`: `POST` to submit a score
(validated against a short-lived server-issued play-session token and a plausibility clamp against
the theoretical max score, plus basic rate limiting), `GET ?top=10` to read the leaderboard. Full
server-authoritative anti-cheat is explicitly out of scope — acceptable given this is a private,
non-distributed evaluation project, not a live competitive product.

This is hard to reverse once the API and schema are built against Table Storage's partition/row-key
model, and a reasonable reader might expect Cosmos DB or Postgres by default for a "leaderboard" —
hence recording the rejection here.

Decided in [Choosing leaderboard storage & persistence approach on Azure](https://github.com/bedro96/raccoon/issues/3).
