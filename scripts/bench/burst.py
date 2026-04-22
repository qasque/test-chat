#!/usr/bin/env python3
"""
Synthetic load test for ai-bot.

Fires N concurrent Chatwoot-style webhook payloads at the ai-bot /webhook
endpoint, and measures wall-clock latency of each request.

The ai-bot webhook only returns AFTER the full hot path completes
(parking, prompt lookup, OpenClaw chat, send_reply). So the HTTP
round-trip time here is a faithful approximation of user-facing latency
(Telegram delivery aside).

Usage:
  python3 burst.py \
      --url http://127.0.0.1:5005/webhook \
      --account 1 \
      --conversations 10,11,12,13,14,15,16,17,18,19 \
      --inbox 2 \
      --concurrency 10 \
      --repeats 1 \
      --message "не работает VPN на айфоне"

Notes:
  * Supply real account_id / inbox_id / conversation_id values. If the ids are
    fake, send_reply/park will 404 inside ai-bot but the LLM call still
    executes and the timing remains representative of the hot path.
  * Add unique message ids per call so the webhook deduplication does not
    silently drop duplicates on retry.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import statistics
import time
import uuid
from typing import Iterable

import httpx


def build_payload(
    account_id: int,
    conversation_id: int,
    inbox_id: int,
    message: str,
) -> dict:
    msg_id = int(time.time() * 1000) + uuid.uuid4().int % 1_000_000
    return {
        "event": "message_created",
        "id": msg_id,
        "message_type": "incoming",
        "content": message,
        "created_at": int(time.time()),
        "conversation": {
            "id": conversation_id,
            "display_id": conversation_id,
            "status": "open",
            "inbox_id": inbox_id,
            "channel": "Channel::Api",
            "custom_attributes": {},
        },
        "account": {"id": account_id},
        "inbox": {"id": inbox_id},
        "sender": {"id": 999000 + (conversation_id % 1000), "type": "contact"},
    }


async def one_request(
    client: httpx.AsyncClient, url: str, payload: dict
) -> tuple[float, int, str]:
    t0 = time.perf_counter()
    status = 0
    reason = "ok"
    try:
        resp = await client.post(url, json=payload, timeout=180.0)
        status = resp.status_code
        if resp.is_error:
            reason = f"http_{status}"
        else:
            try:
                body = resp.json()
                if isinstance(body, dict) and body.get("status") != "ok":
                    reason = f"status_{body.get('status')}_{body.get('reason', '')}"
            except Exception:
                pass
    except Exception as e:
        reason = f"exc_{type(e).__name__}"
    return time.perf_counter() - t0, status, reason


async def run(
    url: str,
    account_id: int,
    inbox_id: int,
    conversations: list[int],
    concurrency: int,
    repeats: int,
    message: str,
) -> None:
    sem = asyncio.Semaphore(concurrency)
    results: list[tuple[float, int, str]] = []

    async with httpx.AsyncClient() as client:
        async def go(conv_id: int) -> None:
            async with sem:
                payload = build_payload(account_id, conv_id, inbox_id, message)
                latency, status, reason = await one_request(client, url, payload)
                results.append((latency, status, reason))
                print(
                    f"  conv={conv_id} http={status} reason={reason} "
                    f"latency={latency:.3f}s"
                )

        tasks: list[asyncio.Task] = []
        for _ in range(repeats):
            for conv_id in conversations:
                tasks.append(asyncio.create_task(go(conv_id)))

        wall = time.perf_counter()
        await asyncio.gather(*tasks)
        wall = time.perf_counter() - wall

    print_stats(results, wall)


def print_stats(results: Iterable[tuple[float, int, str]], wall: float) -> None:
    latencies = [r[0] for r in results]
    if not latencies:
        print("no results")
        return
    latencies.sort()
    n = len(latencies)
    ok = sum(1 for r in results if r[1] == 200 and r[2] == "ok")
    print()
    print(f"total       : {n}")
    print(f"ok          : {ok}")
    print(f"wall        : {wall:.2f}s")
    print(f"min         : {latencies[0]:.3f}s")
    print(f"p50         : {statistics.median(latencies):.3f}s")
    print(f"p95         : {latencies[max(0, int(0.95 * n) - 1)]:.3f}s")
    print(f"p99         : {latencies[max(0, int(0.99 * n) - 1)]:.3f}s")
    print(f"max         : {latencies[-1]:.3f}s")
    print(f"avg         : {statistics.fmean(latencies):.3f}s")


def parse_int_list(raw: str) -> list[int]:
    return [int(x.strip()) for x in raw.split(",") if x.strip()]


def main() -> None:
    ap = argparse.ArgumentParser(description="ai-bot /webhook load tester")
    ap.add_argument("--url", default="http://127.0.0.1:5005/webhook")
    ap.add_argument("--account", type=int, required=True, help="Chatwoot account_id")
    ap.add_argument("--inbox", type=int, required=True, help="Chatwoot inbox_id")
    ap.add_argument(
        "--conversations",
        required=True,
        help="Comma-separated conversation display_ids, one per virtual user",
    )
    ap.add_argument(
        "--concurrency",
        type=int,
        default=10,
        help="Max in-flight requests (default: 10)",
    )
    ap.add_argument(
        "--repeats",
        type=int,
        default=1,
        help="Repeat the full burst N times (default: 1)",
    )
    ap.add_argument(
        "--message",
        default="не работает VPN, помоги",
        help="Message body used in every synthetic webhook",
    )
    args = ap.parse_args()

    conversations = parse_int_list(args.conversations)
    if not conversations:
        raise SystemExit("--conversations must contain at least one id")

    asyncio.run(
        run(
            url=args.url,
            account_id=args.account,
            inbox_id=args.inbox,
            conversations=conversations,
            concurrency=args.concurrency,
            repeats=args.repeats,
            message=args.message,
        )
    )


if __name__ == "__main__":
    main()
