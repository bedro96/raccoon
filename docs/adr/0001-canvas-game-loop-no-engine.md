# Use a hand-rolled HTML5 Canvas game loop instead of a game engine

We considered Phaser and Kaboom.js for rendering the Ponpoko replica, but chose a hand-rolled Canvas
`requestAnimationFrame` game loop with no engine/library. This project's purpose is evaluating Claude
Sonnet's coding ability, so more of the game logic (collision, animation state, physics) should be
Sonnet-authored code rather than delegated to a library. Sprites are pre-made sprite-sheet PNGs
(not code-drawn), rendered onto a fixed low-resolution canvas scaled up with pixelated (nearest-neighbor)
scaling to preserve the original arcade's blocky look. The game lives in a dedicated `/play` route
in the Next.js app, as a Client Component (`"use client"`), with no server-side rendering of game state.

Rejecting an engine is a deliberate deviation from the obvious path (most web arcade clones reach
for Phaser) and would be expensive to reverse once the game loop, entity/animation code, and sprite
pipeline are built directly against the Canvas API rather than an engine's abstractions.

Decided in [Choosing the rendering approach for classic arcade fidelity](https://github.com/bedro96/raccoon/issues/2).
