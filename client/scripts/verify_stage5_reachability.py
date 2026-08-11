from __future__ import annotations

from pathlib import Path

from generate_stage5_map import build_reachability_graph, parse_map, validate

ITEM_ID_TO_TYPE = {0: "CARROT", 1: "CHERRY", 2: "BANANA"}


def main() -> None:
    level_path = Path("client/public/assets/levels/stage5.map")
    parsed = parse_map(level_path.read_bytes())
    if parsed["bytesRemaining"] != 0:
        raise ValueError(f"expected 0 leftover bytes, got {parsed['bytesRemaining']}")

    normalized = dict(parsed)
    normalized["items"] = [
        (x, y, ITEM_ID_TO_TYPE[item_type], score) for x, y, item_type, score in parsed["items"]
    ]

    edges = validate(normalized)
    _, graph_edges = build_reachability_graph(normalized)
    print(f"validated {level_path}")
    print(
        "counts p/l/s/i/e = "
        f"{len(parsed['platforms'])}/{len(parsed['ladders'])}/{len(parsed['spikes'])}/{len(parsed['items'])}/{len(parsed['enemies'])}"
    )
    print(f"reachable graph edges = {len(graph_edges)}")
    print(f"validated edges = {len(edges)}")


if __name__ == "__main__":
    main()
