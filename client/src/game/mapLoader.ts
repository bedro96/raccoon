import type { EnemyData, ItemData, ItemType, Ladder, MapData, Platform, Spike } from "./types";
import { FLOOR_LEFT_BOUND, FLOOR_RIGHT_BOUND } from "./constants";

/**
 * Binary .map file loader/parser, matching the reverse-engineered format
 * exactly (see the "Reverse-engineer Ponpoko level map format & physics
 * constants" ticket -- SMapData::SaveMapData/LoadMapData in the original
 * PonpokoHelper.cpp). Little-endian, flat struct dump:
 *
 *   int    nStageLevel
 *   float  StartPos.x, float StartPos.y
 *   [int count][SPlatform x count]  -- float fY, float fStartX, float fEndX      (12 bytes each)
 *   [int count][SLadder x count]    -- float fX, int nFloor                       (8 bytes each)
 *   [int count][SSpike x count]     -- float x, float y                           (8 bytes each)
 *   [int count][SItemData x count]  -- float x, float y, int eType, int nScore    (16 bytes each)
 *   [int count][SEnemyData x count] -- float x, float y, float fPatrolRange       (12 bytes each)
 */

const ITEM_TYPES: ItemType[] = ["CARROT", "CHERRY", "BANANA"];

class BinaryReader {
  private offset = 0;
  private view: DataView;

  constructor(view: DataView) {
    this.view = view;
  }

  int32(): number {
    const v = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return v;
  }

  float32(): number {
    const v = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return v;
  }

  get bytesRemaining(): number {
    return this.view.byteLength - this.offset;
  }
}

function readPlatforms(r: BinaryReader): Platform[] {
  const count = r.int32();
  const out: Platform[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ y: r.float32(), startX: r.float32(), endX: r.float32() });
  }
  return out;
}

function readLadders(r: BinaryReader): Ladder[] {
  const count = r.int32();
  const out: Ladder[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ x: r.float32(), floor: r.int32() });
  }
  return out;
}

function readSpikes(r: BinaryReader): Spike[] {
  const count = r.int32();
  const out: Spike[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ x: r.float32(), y: r.float32() });
  }
  return out;
}

function readItems(r: BinaryReader): ItemData[] {
  const count = r.int32();
  const out: ItemData[] = [];
  for (let i = 0; i < count; i++) {
    const x = r.float32();
    const y = r.float32();
    const eType = r.int32();
    const score = r.int32();
    out.push({ x, y, type: ITEM_TYPES[eType] ?? "CARROT", score });
  }
  return out;
}

function readEnemies(r: BinaryReader): EnemyData[] {
  const count = r.int32();
  const out: EnemyData[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ x: r.float32(), y: r.float32(), patrolRange: r.float32() });
  }
  return out;
}

/** Parses raw .map file bytes into a MapData object. */
export function parseMapData(buffer: ArrayBuffer): MapData {
  const r = new BinaryReader(new DataView(buffer));

  const stageLevel = r.int32();
  let startX = r.float32();
  const startY = r.float32();

  // Known data quirk: stage1.map's StartPos is (0, 0) in the original asset --
  // the original game ignores StartPos.y for the row (always starts on the
  // floor row) but does use StartPos.x verbatim, which would place the player
  // left of the floor's own left bound (20px). We clamp to the floor bounds
  // rather than silently reproducing an off-playfield spawn.
  if (startX < FLOOR_LEFT_BOUND) startX = FLOOR_LEFT_BOUND;
  if (startX > FLOOR_RIGHT_BOUND) startX = FLOOR_RIGHT_BOUND;

  const platforms = readPlatforms(r);
  const ladders = readLadders(r);
  const spikes = readSpikes(r);
  const items = readItems(r);
  const enemies = readEnemies(r);

  if (r.bytesRemaining !== 0) {
    throw new Error(`Map parse error: ${r.bytesRemaining} bytes left over after parsing -- format mismatch`);
  }

  return {
    stageLevel,
    startPos: { x: startX, y: startY },
    platforms,
    ladders,
    spikes,
    items,
    enemies,
  };
}

/** Fetches and parses a .map file from the given URL (e.g. "/assets/levels/stage1.map"). */
export async function loadMapData(url: string): Promise<MapData> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch map data from ${url}: ${response.status} ${response.statusText}`);
  }
  const buffer = await response.arrayBuffer();
  return parseMapData(buffer);
}
