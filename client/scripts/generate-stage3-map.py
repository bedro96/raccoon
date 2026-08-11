from __future__ import annotations

import struct
from collections import defaultdict, deque
from pathlib import Path

ROW_YS = [270.0, 390.0, 510.0, 630.0]
FLOOR_Y = 750.0
FLOOR_LEFT = 20.0
FLOOR_RIGHT = 980.0
JUMP_DISTANCE = 80.0

ITEM_CODES = {"CARROT": 0, "CHERRY": 1, "BANANA": 2}

STAGE = 3
START = (80.0, FLOOR_Y)
PLATFORMS = [
    (270.0, 180.0, 500.0),
    (270.0, 580.0, 900.0),
    (390.0, 60.0, 260.0),
    (390.0, 340.0, 620.0),
    (390.0, 700.0, 900.0),
    (510.0, 120.0, 580.0),
    (510.0, 660.0, 920.0),
    (630.0, 40.0, 320.0),
    (630.0, 400.0, 700.0),
    (630.0, 780.0, 940.0),
]
LADDERS = [
    (140.0, 3),
    (620.0, 3),
    (260.0, 2),
    (860.0, 2),
    (460.0, 1),
    (820.0, 1),
    (380.0, 0),
    (740.0, 0),
]
SPIKES = [(540.0, 630.0)]
ITEMS = [
    (90.0, 630.0, "CARROT", 10),
    (275.0, 630.0, "CHERRY", 20),
    (470.0, 630.0, "CARROT", 10),
    (860.0, 630.0, "BANANA", 30),
    (210.0, 510.0, "CARROT", 10),
    (760.0, 510.0, "CHERRY", 20),
    (500.0, 390.0, "CHERRY", 20),
    (230.0, 270.0, "CHERRY", 20),
    (820.0, 270.0, "CARROT", 10),
]
ENEMIES = [
    (250.0, 510.0, 120.0),
    (800.0, 390.0, 80.0),
]


def row_index_for_y(y: float) -> int:
    try:
        return ROW_YS.index(y)
    except ValueError as exc:
        raise ValueError(f"Unsupported row y={y}") from exc


def platform_nodes():
    rows: dict[int, list[tuple[float, float]]] = defaultdict(list)
    for y, start_x, end_x in PLATFORMS:
        if start_x >= end_x:
            raise ValueError(f"Invalid platform range: {(y, start_x, end_x)}")
        rows[row_index_for_y(y)].append((start_x, end_x))

    for row in rows.values():
        row.sort()

    rows[4] = [(FLOOR_LEFT, FLOOR_RIGHT)]
    return rows


def containing_platform(row_platforms: list[tuple[float, float]], x: float) -> int | None:
    for idx, (start_x, end_x) in enumerate(row_platforms):
        if start_x <= x <= end_x:
            return idx
    return None


def validate_level() -> None:
    rows = platform_nodes()
    graph: dict[tuple[int, int], set[tuple[int, int]]] = defaultdict(set)

    for row_idx, intervals in rows.items():
        for idx, (start_a, end_a) in enumerate(intervals):
            graph[(row_idx, idx)]
            for other_idx, (start_b, end_b) in enumerate(intervals):
                if idx == other_idx:
                    continue
                gap = max(start_b - end_a, start_a - end_b, 0.0)
                if gap <= JUMP_DISTANCE:
                    graph[(row_idx, idx)].add((row_idx, other_idx))

    for ladder_x, floor in LADDERS:
        upper = rows[floor]
        lower = rows[floor + 1]
        upper_idx = containing_platform(upper, ladder_x)
        lower_idx = containing_platform(lower, ladder_x)
        if upper_idx is None or lower_idx is None:
            raise ValueError(f"Ladder {(ladder_x, floor)} is not supported by both adjacent rows")
        graph[(floor, upper_idx)].add((floor + 1, lower_idx))
        graph[(floor + 1, lower_idx)].add((floor, upper_idx))

    start_node = (4, containing_platform(rows[4], START[0]))
    if start_node[1] is None:
        raise ValueError("Start position is not on the floor")

    seen: set[tuple[int, int]] = set()
    queue = deque([start_node])
    while queue:
        node = queue.popleft()
        if node in seen:
            continue
        seen.add(node)
        queue.extend(graph[node] - seen)

    platform_count = sum(len(v) for v in rows.values())
    if len(seen) != platform_count:
        missing = sorted(set(graph) - seen)
        raise ValueError(f"Unreachable platform nodes: {missing}")

    for row_y, x, label in [(y, x, "spike") for x, y in SPIKES]:
        if containing_platform(rows[row_index_for_y(row_y)], x) is None:
            raise ValueError(f"{label} at {(x, row_y)} is not on a platform")

    for x, y, item_type, score in ITEMS:
        if containing_platform(rows[row_index_for_y(y)], x) is None:
            raise ValueError(f"Item at {(x, y)} is not on a platform")
        if item_type not in ITEM_CODES:
            raise ValueError(f"Unknown item type {item_type}")
        if score <= 0:
            raise ValueError(f"Invalid item score {score}")

    for x, y, patrol_range in ENEMIES:
        row_idx = row_index_for_y(y)
        platform_idx = containing_platform(rows[row_idx], x)
        if platform_idx is None:
            raise ValueError(f"Enemy at {(x, y)} is not on a platform")
        start_x, end_x = rows[row_idx][platform_idx]
        if x - patrol_range < start_x or x + patrol_range > end_x:
            raise ValueError(f"Enemy patrol exceeds platform bounds: {(x, y, patrol_range)}")


def pack_map() -> bytes:
    parts = [
        struct.pack("<i", STAGE),
        struct.pack("<ff", *START),
        struct.pack("<i", len(PLATFORMS)),
        b"".join(struct.pack("<fff", *platform) for platform in PLATFORMS),
        struct.pack("<i", len(LADDERS)),
        b"".join(struct.pack("<fi", *ladder) for ladder in LADDERS),
        struct.pack("<i", len(SPIKES)),
        b"".join(struct.pack("<ff", *spike) for spike in SPIKES),
        struct.pack("<i", len(ITEMS)),
        b"".join(struct.pack("<ffii", x, y, ITEM_CODES[item_type], score) for x, y, item_type, score in ITEMS),
        struct.pack("<i", len(ENEMIES)),
        b"".join(struct.pack("<fff", *enemy) for enemy in ENEMIES),
    ]
    return b"".join(parts)


def parse_map(blob: bytes) -> dict[str, object]:
    offset = 0

    def unpack(fmt: str):
        nonlocal offset
        size = struct.calcsize(fmt)
        values = struct.unpack_from(fmt, blob, offset)
        offset += size
        return values

    stage_level = unpack("<i")[0]
    start_pos = unpack("<ff")

    platforms = [unpack("<fff") for _ in range(unpack("<i")[0])]
    ladders = [unpack("<fi") for _ in range(unpack("<i")[0])]
    spikes = [unpack("<ff") for _ in range(unpack("<i")[0])]
    items = [unpack("<ffii") for _ in range(unpack("<i")[0])]
    enemies = [unpack("<fff") for _ in range(unpack("<i")[0])]

    return {
        "stageLevel": stage_level,
        "startPos": start_pos,
        "platforms": platforms,
        "ladders": ladders,
        "spikes": spikes,
        "items": items,
        "enemies": enemies,
        "bytesRemaining": len(blob) - offset,
    }


def main() -> None:
    validate_level()
    payload = pack_map()
    parsed = parse_map(payload)

    expected = {
        "stageLevel": STAGE,
        "startPos": START,
        "platforms": PLATFORMS,
        "ladders": LADDERS,
        "spikes": SPIKES,
        "items": [(x, y, ITEM_CODES[item_type], score) for x, y, item_type, score in ITEMS],
        "enemies": ENEMIES,
        "bytesRemaining": 0,
    }
    if parsed != expected:
        raise ValueError(f"Round-trip mismatch:\nexpected={expected}\nparsed={parsed}")

    out_path = Path(__file__).resolve().parent.parent / "public" / "assets" / "levels" / "stage3.map"
    out_path.write_bytes(payload)
    print(f"Wrote {out_path} ({len(payload)} bytes)")
    print(
        "Platforms/Ladders/Spikes/Items/Enemies = "
        f"{len(PLATFORMS)}/{len(LADDERS)}/{len(SPIKES)}/{len(ITEMS)}/{len(ENEMIES)}"
    )


if __name__ == "__main__":
    main()
