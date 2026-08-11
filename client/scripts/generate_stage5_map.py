from __future__ import annotations

import math
import struct
from collections import defaultdict, deque
from pathlib import Path

ROW_YS = (270.0, 390.0, 510.0, 630.0)
FLOOR_Y = 750.0
FLOOR_LEFT = 20.0
FLOOR_RIGHT = 980.0
JUMP_DISTANCE = 80.0

ITEM_TYPE_TO_ID = {"CARROT": 0, "CHERRY": 1, "BANANA": 2}

STAGE5 = {
    "stageLevel": 5,
    "startPos": (80.0, FLOOR_Y),
    "platforms": [
        (630.0, 40.0, 180.0),
        (630.0, 240.0, 500.0),
        (630.0, 600.0, 940.0),
        (510.0, 100.0, 340.0),
        (510.0, 400.0, 620.0),
        (510.0, 680.0, 900.0),
        (390.0, 40.0, 160.0),
        (390.0, 220.0, 480.0),
        (390.0, 540.0, 840.0),
        (270.0, 120.0, 420.0),
        (270.0, 480.0, 960.0),
    ],
    "ladders": [
        (120.0, 3),
        (420.0, 3),
        (780.0, 3),
        (300.0, 2),
        (460.0, 2),
        (820.0, 2),
        (140.0, 1),
        (460.0, 1),
        (780.0, 1),
        (360.0, 0),
        (620.0, 0),
    ],
    "spikes": [],
    "items": [
        (100.0, 630.0, "CARROT", 10),
        (380.0, 630.0, "CHERRY", 20),
        (860.0, 630.0, "BANANA", 30),
        (180.0, 510.0, "CHERRY", 20),
        (540.0, 510.0, "CARROT", 10),
        (820.0, 510.0, "CARROT", 10),
        (100.0, 390.0, "CARROT", 10),
        (320.0, 390.0, "CHERRY", 20),
        (760.0, 390.0, "CARROT", 10),
        (220.0, 270.0, "CHERRY", 20),
        (820.0, 270.0, "BANANA", 30),
    ],
    "enemies": [
        (720.0, 630.0, 40.0),
        (240.0, 270.0, 40.0),
    ],
}


def row_index_for_y(y: float) -> int:
    for index, row_y in enumerate(ROW_YS):
        if math.isclose(y, row_y):
            return index
    raise ValueError(f"invalid row y={y}")


def parse_map(data: bytes) -> dict[str, object]:
    offset = 0

    def unpack(fmt: str) -> tuple:
        nonlocal offset
        values = struct.unpack_from(fmt, data, offset)
        offset += struct.calcsize(fmt)
        return values

    parsed = {
        "stageLevel": unpack("<i")[0],
        "startPos": unpack("<ff"),
    }
    parsed["platforms"] = [unpack("<fff") for _ in range(unpack("<i")[0])]
    parsed["ladders"] = [unpack("<fi") for _ in range(unpack("<i")[0])]
    parsed["spikes"] = [unpack("<ff") for _ in range(unpack("<i")[0])]
    parsed["items"] = [unpack("<ffii") for _ in range(unpack("<i")[0])]
    parsed["enemies"] = [unpack("<fff") for _ in range(unpack("<i")[0])]
    parsed["bytesRemaining"] = len(data) - offset
    return parsed


def build_bytes(level: dict[str, object]) -> bytes:
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


def containing_segment(
    rows: dict[int, list[tuple[float, float]]],
    row_index: int,
    x: float,
) -> int | None:
    for segment_index, (start_x, end_x) in enumerate(rows[row_index]):
        if start_x <= x <= end_x:
            return segment_index
    return None


def build_rows(level: dict[str, object]) -> dict[int, list[tuple[float, float]]]:
    rows: dict[int, list[tuple[float, float]]] = defaultdict(list)
    for y, start_x, end_x in level["platforms"]:
        row_index = row_index_for_y(y)
        if start_x >= end_x:
            raise ValueError(f"invalid platform {(y, start_x, end_x)}")
        rows[row_index].append((start_x, end_x))

    for row_index in range(len(ROW_YS)):
        rows[row_index].sort()
    rows[len(ROW_YS)] = [(FLOOR_LEFT, FLOOR_RIGHT)]
    return rows


def build_reachability_graph(level: dict[str, object]) -> tuple[dict[tuple[int, int], set[tuple[int, int]]], list[str]]:
    rows = build_rows(level)
    graph: dict[tuple[int, int], set[tuple[int, int]]] = defaultdict(set)
    edges: list[str] = []

    for row_index, segments in rows.items():
        for segment_index, (start_a, end_a) in enumerate(segments):
            graph[(row_index, segment_index)]
            for other_index, (start_b, end_b) in enumerate(segments):
                if segment_index >= other_index:
                    continue
                gap = max(start_b - end_a, start_a - end_b, 0.0)
                if gap <= JUMP_DISTANCE:
                    a = (row_index, segment_index)
                    b = (row_index, other_index)
                    graph[a].add(b)
                    graph[b].add(a)
                    edges.append(
                        f"jump row={row_index} segment={segment_index}<->{other_index} gap={gap:.1f}"
                    )

    for ladder_x, floor in level["ladders"]:
        top = (floor, containing_segment(rows, floor, ladder_x))
        bottom = (floor + 1, containing_segment(rows, floor + 1, ladder_x))
        if top[1] is None or bottom[1] is None:
            raise ValueError(f"ladder {(ladder_x, floor)} is not supported by both rows")
        graph[top].add(bottom)
        graph[bottom].add(top)
        edges.append(f"ladder x={ladder_x:.1f} row={floor}<->{floor + 1}")

    return graph, edges


def validate(level: dict[str, object]) -> list[str]:
    if level["stageLevel"] != 5:
        raise ValueError("stageLevel must be 5")
    if level["startPos"] != (80.0, FLOOR_Y):
        raise ValueError("unexpected start position")

    rows = build_rows(level)
    graph, edges = build_reachability_graph(level)

    start_segment = containing_segment(rows, len(ROW_YS), level["startPos"][0])
    if start_segment is None:
        raise ValueError("start position is not on the floor")

    seen: set[tuple[int, int]] = set()
    queue = deque([(len(ROW_YS), start_segment)])
    while queue:
        node = queue.popleft()
        if node in seen:
            continue
        seen.add(node)
        queue.extend(graph[node] - seen)

    expected_nodes = {(row_index, segment_index) for row_index, segments in rows.items() for segment_index in range(len(segments))}
    if seen != expected_nodes:
        raise ValueError(f"unreachable segments: {sorted(expected_nodes - seen)}")

    def require_on_reachable_segment(x: float, y: float, label: str) -> None:
        if math.isclose(y, FLOOR_Y):
            row_index = len(ROW_YS)
        else:
            row_index = row_index_for_y(y)
        segment_index = containing_segment(rows, row_index, x)
        if segment_index is None:
            raise ValueError(f"{label} at {(x, y)} is not on geometry")
        if (row_index, segment_index) not in seen:
            raise ValueError(f"{label} at {(x, y)} is on an unreachable segment")

    for spike_x, spike_y in level["spikes"]:
        require_on_reachable_segment(spike_x, spike_y, "spike")

    item_types = {item_type for _, _, item_type, _ in level["items"]}
    if not {"CARROT", "CHERRY", "BANANA"}.issubset(item_types):
        raise ValueError("level must contain carrot, cherry, and banana items")

    for item_x, item_y, item_type, score in level["items"]:
        require_on_reachable_segment(item_x, item_y, "item")
        if item_type not in ITEM_TYPE_TO_ID:
            raise ValueError(f"unknown item type {item_type}")
        expected_score = {"CARROT": 10, "CHERRY": 20, "BANANA": 30}[item_type]
        if score != expected_score:
            raise ValueError(f"{item_type} at {(item_x, item_y)} must score {expected_score}, got {score}")

    if len(level["enemies"]) < 2:
        raise ValueError("stage5 should contain at least two enemies")

    for enemy_x, enemy_y, patrol_range in level["enemies"]:
        require_on_reachable_segment(enemy_x, enemy_y, "enemy")
        row_index = row_index_for_y(enemy_y)
        segment_index = containing_segment(rows, row_index, enemy_x)
        start_x, end_x = rows[row_index][segment_index]
        if enemy_x - patrol_range < start_x or enemy_x + patrol_range > end_x:
            raise ValueError(
                f"enemy {(enemy_x, enemy_y, patrol_range)} patrol exceeds bounds {(start_x, end_x)}"
            )

    return sorted(edges)


def round_trip_validate(level: dict[str, object], output_path: Path) -> None:
    expected = {
        "stageLevel": level["stageLevel"],
        "startPos": level["startPos"],
        "platforms": level["platforms"],
        "ladders": level["ladders"],
        "spikes": level["spikes"],
        "items": [(x, y, ITEM_TYPE_TO_ID[item_type], score) for x, y, item_type, score in level["items"]],
        "enemies": level["enemies"],
        "bytesRemaining": 0,
    }
    actual = parse_map(output_path.read_bytes())
    if actual != expected:
        raise ValueError(f"round-trip mismatch\nexpected={expected}\nactual={actual}")


def main() -> None:
    output_path = Path("client/public/assets/levels/stage5.map")
    edges = validate(STAGE5)
    output_path.write_bytes(build_bytes(STAGE5))
    round_trip_validate(STAGE5, output_path)

    print(f"wrote {output_path} ({output_path.stat().st_size} bytes)")
    print(
        "counts p/l/s/i/e = "
        f"{len(STAGE5['platforms'])}/{len(STAGE5['ladders'])}/{len(STAGE5['spikes'])}/{len(STAGE5['items'])}/{len(STAGE5['enemies'])}"
    )
    print("reachability edges:")
    for edge in edges:
        print(f"  {edge}")


if __name__ == "__main__":
    main()
