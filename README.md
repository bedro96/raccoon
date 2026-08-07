# Ponpoko

A web-based recreation of the classic 1982 *Ponpoko* arcade game, built with **Next.js 16** (JavaScript)
and a hand-rolled HTML5 Canvas game loop. This is a **private evaluation project** assessing an AI
coding agent's (Claude Sonnet / GitHub Copilot coding agent) end-to-end software delivery ability —
from planning through implementation, testing, containerization, and production deployment on
**Azure Container Apps**. It is not released publicly or commercially.

## Gameplay

- **Controls**: Arrow keys to move/climb, `Space` to jump.
- **Lives**: 3 lives; colliding with an enemy costs a life and triggers a brief recovery/respawn window.
- **Scoring**: collect items scattered around the level for points.
- **Audio**: background music and sound effects are synthesized in real time via the Web Audio API
  (no external audio files) — a mute/audio-toggle control is available in-game.
- **Leaderboard**: scores persist to a global leaderboard backed by Azure Table Storage.

## Project structure

```
app/            Next.js App Router routes (/, /play)
lib/            Pure game-state module (no DOM/Canvas dependency) — the core testing seam
__tests__/      Unit tests (Vitest)
public/         Static assets (sprites, etc.)
docs/adr/       Architectural Decision Records
```

## Local development

```bash
npm install
npm run dev     # start the dev server (http://localhost:3000/play)
npm run lint    # ESLint
npm test        # run the Vitest unit test suite
npm run build   # production build (Next.js standalone output)
```

## Container

Build the production image from the repo root:

```bash
docker build -t ponpoko .
```

Run it locally on port 3000 with the default in-memory leaderboard:

```bash
docker run --rm -p 3000:3000 ponpoko
```

To use Azure Table Storage, either:

- **In production (Azure Container Apps)**: set `AZURE_STORAGE_ACCOUNT_URL` (the table endpoint, e.g.
  `https://<account>.table.core.windows.net`) and `AZURE_CLIENT_ID` (the user-assigned managed identity's
  client ID). The app authenticates via Azure AD (`DefaultAzureCredential`) — no connection string or
  account key is used, since the storage account has shared-key access disabled.
- **Locally or against another storage account that allows shared-key auth** (e.g. Azurite): pass a
  connection string instead:

```bash
docker run --rm -p 3000:3000 \
  -e AZURE_STORAGE_CONNECTION_STRING="<your-connection-string>" \
  ponpoko
```

The image runs the Next.js standalone server as a non-root user and reads all runtime configuration from
environment variables passed to `docker run` rather than baking them into the image. If neither
`AZURE_STORAGE_ACCOUNT_URL` nor `AZURE_STORAGE_CONNECTION_STRING` is set, the leaderboard falls back to
the in-memory development storage implementation.

## Architecture & decisions

This project's planning and architecture decisions were driven through a structured "Wayfinder" map
and are recorded as ADRs for durability:

- [ADR-0001](docs/adr/0001-canvas-game-loop-no-engine.md) — hand-rolled Canvas game loop, no game engine
- [ADR-0002](docs/adr/0002-table-storage-leaderboard.md) — Azure Table Storage for the leaderboard
- [ADR-0003](docs/adr/0003-acr-azd-github-actions-deployment.md) — ACR + `azd`/Bicep + GitHub Actions (OIDC) for deployment

See the full spec at [issue #7](https://github.com/bedro96/raccoon/issues/7) and the original planning
map at [issue #1](https://github.com/bedro96/raccoon/issues/1).

## Deployment

The app is containerized with a multi-stage Dockerfile (Next.js `output: 'standalone'`) and deployed to
**Azure Container Apps** via Azure Container Registry and a GitHub Actions CI/CD pipeline authenticated
with OIDC federated credentials. See `docs/adr/0003-acr-azd-github-actions-deployment.md` for details.
For one-time Azure/GitHub setup steps, see `docs/deployment/azure-oidc-setup.md`.

## Status

This project was built as a sequence of tracer-bullet tickets (see issues #8–#15), each implemented by
the GitHub Copilot coding agent and reviewed by a human/AI supervisory loop (automated tests + a
rubber-duck logic review) before merging. Check the linked issues for current progress.
