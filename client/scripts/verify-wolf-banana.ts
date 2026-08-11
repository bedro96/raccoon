/**
 * Deterministic verification for issue #46's map-loader extension:
 * eType=2 must decode to BANANA while preserving the item's score payload.
 * Also covers the pure sprite-selection helpers used by LevelScene to pick
 * the enemy (enemy vs. wolf vs. hunter, by level index) and item
 * (carrot/cherry/banana) texture keys.
 *
 * Run with: npx tsx scripts/verify-wolf-banana.ts
 */
import { FLOOR_LEFT_BOUND, FLOOR_Y } from "../src/game/constants";
import { parseMapData } from "../src/game/mapLoader";
import { getEnemyTextureKey, getItemRenderConfig } from "../src/game/spriteSelection";

let failures = 0;

function assertTrue(label: string, condition: boolean): void {
  console.log(`[${condition ? "PASS" : "FAIL"}] ${label}`);
  if (!condition) failures++;
}

function pushInt32(bytes: number[], value: number): void {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setInt32(0, value, true);
  bytes.push(...new Uint8Array(buffer));
}

function pushFloat32(bytes: number[], value: number): void {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setFloat32(0, value, true);
  bytes.push(...new Uint8Array(buffer));
}

const bytes: number[] = [];
pushInt32(bytes, 3); // stageLevel
pushFloat32(bytes, 0); // startPos.x, intentionally clamped by parser
pushFloat32(bytes, FLOOR_Y); // startPos.y

pushInt32(bytes, 0); // platforms
pushInt32(bytes, 0); // ladders
pushInt32(bytes, 0); // spikes

pushInt32(bytes, 1); // items
pushFloat32(bytes, 420);
pushFloat32(bytes, FLOOR_Y);
pushInt32(bytes, 2); // BANANA
pushInt32(bytes, 30); // score should be preserved from the file payload

pushInt32(bytes, 0); // enemies

const map = parseMapData(Uint8Array.from(bytes).buffer);

assertTrue("Parser keeps exactly one item", map.items.length === 1);
assertTrue("eType=2 decodes to BANANA", map.items[0]?.type === "BANANA");
assertTrue("BANANA score is preserved from nScore", map.items[0]?.score === 30);
assertTrue("Out-of-bounds spawn X still uses the existing clamp", map.startPos.x === FLOOR_LEFT_BOUND);

// --- Enemy sprite selection (level-based, not per-enemy) ---
assertTrue("Level 1 (index 0) uses the original enemy sprite", getEnemyTextureKey(0) === "enemy");
assertTrue("Level 2 (index 1) uses the original enemy sprite", getEnemyTextureKey(1) === "enemy");
assertTrue("Level 3 (index 2) uses the wolf sprite", getEnemyTextureKey(2) === "wolf");
assertTrue("Level 4 (index 3) uses the wolf sprite", getEnemyTextureKey(3) === "wolf");
assertTrue("Level 5 (index 4) uses the hunter sprite", getEnemyTextureKey(4) === "hunter");
assertTrue("Level 6+ (index 5) keeps using the hunter sprite", getEnemyTextureKey(5) === "hunter");

// --- Item sprite/size selection ---
const sizes = { carrot: 36, cherry: 24, banana: 36 };
const carrotConfig = getItemRenderConfig({ type: "CARROT" }, sizes);
const cherryConfig = getItemRenderConfig({ type: "CHERRY" }, sizes);
const bananaConfig = getItemRenderConfig({ type: "BANANA" }, sizes);
assertTrue("CARROT renders as item1", carrotConfig.key === "item1" && carrotConfig.size === 36);
assertTrue("CHERRY renders as item2", cherryConfig.key === "item2" && cherryConfig.size === 24);
assertTrue("BANANA renders as item3", bananaConfig.key === "item3" && bananaConfig.size === 36);

console.log("");
if (failures > 0) {
  console.error(`${failures} wolf/banana check(s) FAILED.`);
  process.exit(1);
} else {
  console.log("All wolf/banana checks PASSED.");
}
