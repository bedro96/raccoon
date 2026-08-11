export type RespawnBlinkStep = {
  delayMs: number;
  visible: boolean;
};

export const RESPAWN_BLINK_COUNT = 3;
export const RESPAWN_BLINK_INTERVAL_MS = 120;

/** Builds the visibility toggles for a respawn blink sequence at the death location. */
export function buildRespawnBlinkSequence(blinks: number, intervalMs: number): RespawnBlinkStep[] {
  if (blinks < 1) return [];

  const steps: RespawnBlinkStep[] = [];
  for (let blinkIndex = 0; blinkIndex < blinks; blinkIndex++) {
    steps.push({
      delayMs: blinkIndex * intervalMs * 2 + intervalMs,
      visible: false,
    });

    steps.push({
      delayMs: (blinkIndex + 1) * intervalMs * 2,
      visible: true,
    });
  }

  return steps;
}

export function getRespawnBlinkDuration(blinks: number, intervalMs: number): number {
  return blinks < 1 ? 0 : blinks * intervalMs * 2;
}
