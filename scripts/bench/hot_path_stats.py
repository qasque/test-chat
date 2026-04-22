#!/usr/bin/env python3
"""
Aggregate p50 / p95 / p99 latencies from ai-bot `hot_path` log lines.

The ai-bot emits one structured line per handled conversation, shaped as:

  hot_path conv=30 t_parallel=0.157 t_llm=2.431 t_send=0.312 total=2.901

Pipe logs in, or pass a log file as argument:

  # last 30 minutes of live logs
  docker compose logs --since=30m ai-bot | python3 hot_path_stats.py

  # saved log snapshot
  python3 hot_path_stats.py path/to/ai-bot.log

  # tail the running container and refresh every N messages
  docker compose logs -f ai-bot | python3 hot_path_stats.py --live --window 20
"""
from __future__ import annotations

import argparse
import re
import statistics
import sys
from collections import deque
from typing import Iterable


HOT_PATH_RE = re.compile(
    r"hot_path\s+conv=(\d+)\s+"
    r"t_parallel=([\d.]+)\s+"
    r"t_llm=([\d.]+)\s+"
    r"t_send=([\d.]+)\s+"
    r"total=([\d.]+)"
)


def quantile(sorted_values: list[float], q: float) -> float:
    if not sorted_values:
        return 0.0
    idx = max(0, min(len(sorted_values) - 1, int(q * len(sorted_values)) - 1))
    return sorted_values[idx]


def format_stats(label: str, values: list[float]) -> str:
    if not values:
        return f"{label:<10} (no samples)"
    s = sorted(values)
    return (
        f"{label:<10} n={len(s):<4} "
        f"min={s[0]:.3f}s "
        f"p50={statistics.median(s):.3f}s "
        f"p95={quantile(s, 0.95):.3f}s "
        f"p99={quantile(s, 0.99):.3f}s "
        f"max={s[-1]:.3f}s "
        f"avg={statistics.fmean(s):.3f}s"
    )


def iter_lines(source: Iterable[str]):
    for line in source:
        m = HOT_PATH_RE.search(line)
        if m:
            yield {
                "conv": int(m.group(1)),
                "t_parallel": float(m.group(2)),
                "t_llm": float(m.group(3)),
                "t_send": float(m.group(4)),
                "total": float(m.group(5)),
            }


def print_report(rows: list[dict]) -> None:
    print("-" * 78)
    for metric in ("t_parallel", "t_llm", "t_send", "total"):
        print(format_stats(metric, [r[metric] for r in rows]))
    print("-" * 78)


def main() -> None:
    ap = argparse.ArgumentParser(description="ai-bot hot_path statistics")
    ap.add_argument("path", nargs="?", help="Log file path (default: stdin)")
    ap.add_argument(
        "--live",
        action="store_true",
        help="Stream mode: re-print stats every --window samples",
    )
    ap.add_argument(
        "--window",
        type=int,
        default=20,
        help="With --live: number of most recent samples to aggregate",
    )
    args = ap.parse_args()

    source = open(args.path) if args.path else sys.stdin

    try:
        if args.live:
            window: deque[dict] = deque(maxlen=args.window)
            total = 0
            for row in iter_lines(source):
                window.append(row)
                total += 1
                if total % max(1, args.window // 5) == 0:
                    print(f"\n== rolling window over last {len(window)} samples "
                          f"(total seen={total}) ==")
                    print_report(list(window))
        else:
            rows = list(iter_lines(source))
            if not rows:
                print("no hot_path lines found", file=sys.stderr)
                sys.exit(1)
            print(f"samples: {len(rows)}")
            print_report(rows)
    finally:
        if source is not sys.stdin:
            source.close()


if __name__ == "__main__":
    main()
