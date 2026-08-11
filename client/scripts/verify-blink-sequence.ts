import {
  buildRespawnBlinkSequence,
  getRespawnBlinkDuration,
  RESPAWN_BLINK_COUNT,
  RESPAWN_BLINK_INTERVAL_MS,
} from "../src/game/respawnBlink";

let failures = 0;

function assertTrue(label: string, cond: boolean): void {
  console.log(`[${cond ? "PASS" : "FAIL"}] ${label}`);
  if (!cond) failures++;
}

{
  const steps = buildRespawnBlinkSequence(RESPAWN_BLINK_COUNT, RESPAWN_BLINK_INTERVAL_MS);
  const expected = [
    { delayMs: 120, visible: false },
    { delayMs: 240, visible: true },
    { delayMs: 360, visible: false },
    { delayMs: 480, visible: true },
    { delayMs: 600, visible: false },
    { delayMs: 720, visible: true },
  ];

  assertTrue("Respawn blink sequence has six scheduled toggles for three blinks", steps.length === expected.length);
  assertTrue(
    "Respawn blink sequence matches the expected visible/invisible cadence",
    JSON.stringify(steps) === JSON.stringify(expected),
  );
  assertTrue("Respawn blink sequence ends visible", steps.at(-1)?.visible === true);
  assertTrue(
    "Respawn blink duration lands on the last visibility restore",
    getRespawnBlinkDuration(RESPAWN_BLINK_COUNT, RESPAWN_BLINK_INTERVAL_MS) === expected.at(-1)?.delayMs,
  );
}

{
  const steps = buildRespawnBlinkSequence(1, 90);
  assertTrue("Single blink schedules one hide and one restore", steps.length === 2);
  assertTrue(
    "Single blink uses the provided interval for hide and restore",
    JSON.stringify(steps) === JSON.stringify([
      { delayMs: 90, visible: false },
      { delayMs: 180, visible: true },
    ]),
  );
  assertTrue("Single blink duration matches the restore delay", getRespawnBlinkDuration(1, 90) === 180);
}

{
  const steps = buildRespawnBlinkSequence(0, 120);
  assertTrue("Zero requested blinks yields no scheduled toggles", steps.length === 0);
  assertTrue("Zero requested blinks has zero duration", getRespawnBlinkDuration(0, 120) === 0);
}

console.log("");
if (failures > 0) {
  console.error(`${failures} blink-sequence check(s) FAILED.`);
  process.exit(1);
} else {
  console.log("All blink-sequence checks PASSED.");
}
