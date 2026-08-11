import {
  buildRespawnBlinkSequence,
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
    { delayMs: 120, visible: true },
    { delayMs: 240, visible: false },
    { delayMs: 360, visible: true },
    { delayMs: 480, visible: false },
    { delayMs: 600, visible: true },
  ];

  assertTrue("Respawn blink sequence has five scheduled toggles for three blinks", steps.length === expected.length);
  assertTrue(
    "Respawn blink sequence matches the expected visible/invisible cadence",
    JSON.stringify(steps) === JSON.stringify(expected),
  );
  assertTrue("Respawn blink sequence ends visible", steps.at(-1)?.visible === true);
}

{
  const steps = buildRespawnBlinkSequence(1, 90);
  assertTrue("Single blink schedules one visible restore", steps.length === 1);
  assertTrue("Single blink restore uses the provided interval", steps[0]?.delayMs === 90 && steps[0]?.visible === true);
}

{
  const steps = buildRespawnBlinkSequence(0, 120);
  assertTrue("Zero requested blinks yields no scheduled toggles", steps.length === 0);
}

console.log("");
if (failures > 0) {
  console.error(`${failures} blink-sequence check(s) FAILED.`);
  process.exit(1);
} else {
  console.log("All blink-sequence checks PASSED.");
}
