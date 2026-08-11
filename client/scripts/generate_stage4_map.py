from __future__ import annotations

import math
import struct
from pathlib import Path

ROWS = (270.0, 390.0, 510.0, 630.0)
FLOOR_Y = 750.0
FLOOR_LEFT = 20.0
FLOOR_RIGHT = 980.0
ITEM_TYPE_TO_ID = {"CARROT": 0, "CHERRY": 1, "BANANA": 2}

STAGE4 = {
    "stageLevel": 4,
    "startPos": (80.0, FLOOR_Y),
    "platforms": [
        (630.0, 80.0, 340.0),
        (630.0, 480.0, 920.0),
        (510.0, 140.0, 420.0),
        (510.0, 600.0, 940.0),
        (390.0, 240.0, 520.0),
        (390.0, 560.0, 820.0),
        (270.0, 100.0, 360.0),
        (270.0, 520.0, 900.0),
    ],
    "ladders": [
        (180.0, 3),
        (700.0, 3),
        (300.0, 2),
        (760.0, 2),
        (380.0, 1),
        (680.0, 1),
        (320.0, 0),
        (620.0, 0),
    ],
    "spikes": [
        (250.0, 630.0),
        (650.0, 510.0),
    ],
    "items": [
        (130.0, 630.0, "CARROT", 10),
        (860.0, 630.0, "CHERRY", 20),
        (200.0, 510.0, "CARROT", 10),
        (890.0, 510.0, "CARROT", 10),
        (300.0, 390.0, "CHERRY", 20),
        (760.0, 390.0, "CARROT", 10),
        (160.0, 270.0, "CHERRY", 20),
        (780.0, 270.0, "BANANA", 30),
    ],
    "enemies": [
        (880.0, 630.0, 20.0),
        (250.0, 510.0, 50.0),
        (460.0, 390.0, 40.0),
    ],
}


def parse_map(data: bytes) -> dict:
    offset = 0

    def read_i() -> int:
        nonlocal offset
        value = struct.unpack_from("<i", data, offset)[0]
        offset += 4
        return value

    def read_f() -> float:
        nonlocal offset
        value = struct.unpack_from("<f", data, offset)[0]
        offset += 4
        return value

    parsed = {
        "stageLevel": read_i(),
        "startPos": (read_f(), read_f()),
    }

    count = read_i()
    parsed["platforms"] = [(read_f(), read_f(), read_f()) for _ in range(count)]
    count = read_i()
    parsed["ladders"] = [(read_f(), read_i()) for _ in range(count)]
    count = read_i()
    parsed["spikes"] = [(read_f(), read_f()) for _ in range(count)]
    count = read_i()
    parsed["items"] = [(read_f(), read_f(), read_i(), read_i()) for _ in range(count)]
    count = read_i()
    parsed["enemies"] = [(read_f(), read_f(), read_f()) for _ in range(count)]

    if offset != len(data):
        raise ValueError(f"{len(data) - offset} leftover bytes after parse")

    return parsed


def build_bytes(level: dict) -> bytes:
    chunks = [
        struct.pack("<i", level["stageLevel"]),
        struct.pack("<ff", *level["startPos"]),
    ]

    def write_counted(rows: list[tuple], fmt: str) -> None:
        chunks.append(struct.pack("<i", len(rows)))
        for row in rows:
            chunks.append(struct.pack(fmt, *row))

    write_counted(level["platforms"], "<fff")
    write_counted(level["ladders"], "<fi")
    write_counted(level["spikes"], "<ff")
    write_counted(
        [(x, y, ITEM_TYPE_TO_ID[item_type], score) for x, y, item_type, score in level["items"]],
        "<ffii",
    )
    write_counted(level["enemies"], "<fff")
    return b"".join(chunks)


def row_index_for_y(y: float) -> int:
    for index, row_y in enumerate(ROWS):
        if math.isclose(y, row_y):
            return index
    raise ValueError(f"invalid row y={y}")


def segment_for_position(platforms: list[tuple[float, float, float]], y: float, x: float) -> int | str | None:
    if math.isclose(y, FLOOR_Y):
        return "floor" if FLOOR_LEFT <= x <= FLOOR_RIGHT else None
    for index, (platform_y, start_x, end_x) in enumerate(platforms):
        if math.isclose(platform_y, y) and start_x <= x <= end_x:
            return index
    return None


def validate(level: dict) -> None:
    platforms = level["platforms"]
    ladders = level["ladders"]

    if level["stageLevel"] != 4:
        raise ValueError("stageLevel must be 4")
    if level["startPos"] != (80.0, FLOOR_Y):
        raise ValueError("unexpected start position")
    if not any(item[2] == "BANANA" for item in level["items"]):
        raise ValueError("stage4 must contain at least one banana")

    graph: dict[int | str, set[int | str]] = {"floor": set()}
    for index, platform in enumerate(platforms):
        y, start_x, end_x = platform
        row_index_for_y(y)
        if start_x >= end_x:
            raise ValueError(f"invalid platform {platform}")
        graph[index] = set()

    for x, floor in ladders:
        if floor < 0 or floor > 3:
            raise ValueError(f"invalid ladder floor={floor}")
        top_y = ROWS[floor]
        bottom_y = FLOOR_Y if floor == 3 else ROWS[floor + 1]
        top_segment = segment_for_position(platforms, top_y, x)
        bottom_segment = segment_for_position(platforms, bottom_y, x)
        if top_segment is None or bottom_segment is None:
            raise ValueError(f"ladder {(x, floor)} does not land on reachable geometry")
        graph[top_segment].add(bottom_segment)
        graph[bottom_segment].add(top_segment)

    for spike in level["spikes"]:
        if segment_for_position(platforms, spike[1], spike[0]) is None:
            raise ValueError(f"spike {spike} is off-platform")

    for x, y, item_type, score in level["items"]:
        if segment_for_position(platforms, y, x) is None:
            raise ValueError(f"item {(x, y, item_type, score)} is off-platform")
        if score <= 0:
            raise ValueError(f"item {(x, y, item_type, score)} must have a positive score")

    for x, y, patrol_range in level["enemies"]:
        segment = segment_for_position(platforms, y, x)
        if segment is None or segment == "floor":
            raise ValueError(f"enemy {(x, y, patrol_range)} is not on a platform row")
        _, start_x, end_x = platforms[segment]
        if x - patrol_range < start_x or x + patrol_range > end_x:
            raise ValueError(f"enemy {(x, y, patrol_range)} patrol exceeds platform bounds {(start_x, end_x)}")

    reachable = set()
    queue = ["floor"]
    while queue:
        node = queue.pop(0)
        if node in reachable:
            continue
        reachable.add(node)
        queue.extend(graph[node] - reachable)

    unreachable = [platform for index, platform in enumerate(platforms) if index not in reachable]
    if unreachable:
        raise ValueError(f"unreachable platforms detected: {unreachable}")


def round_trip_validate(level: dict, output_path: Path) -> None:
    expected = {
        "stageLevel": level["stageLevel"],
        "startPos": level["startPos"],
        "platforms": level["platforms"],
        "ladders": level["ladders"],
        "spikes": level["spikes"],
        "items": [(x, y, ITEM_TYPE_TO_ID[item_type], score) for x, y, item_type, score in level["items"]],
        "enemies": level["enemies"],
    }
    actual = parse_map(output_path.read_bytes())
    if actual != expected:
        raise ValueError(f"round-trip mismatch\nexpected={expected}\nactual={actual}")


def main() -> None:
    output_path = Path("client/public/assets/levels/stage4.map")
    validate(STAGE4)
    output_path.write_bytes(build_bytes(STAGE4))
    round_trip_validate(STAGE4, output_path)
    print(f"wrote {output_path} ({output_path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
