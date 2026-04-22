# ai-bot load test kit

Two scripts for checking how `ai-bot` behaves under concurrent traffic.

## 1. `burst.py` — fire N simultaneous webhooks

Sends synthetic Chatwoot-style webhook payloads directly to the ai-bot
`/webhook` endpoint. Since the webhook returns only after the full hot
path finishes (parking, prompt fetch, OpenClaw, send_reply), the
HTTP round-trip time is an honest end-to-end measurement of ai-bot's
processing latency — no Telegram, no Chatwoot->ai-bot webhook hop in
the middle.

### Prerequisites

- Python 3.11+ and `pip install httpx` on the machine that runs the
  benchmark.
- Know the real `account_id`, `inbox_id` and a handful of real
  `conversation_id`s. Use a dedicated test inbox to avoid poisoning
  production dashboards.

### Example: 10 concurrent users, one burst

```bash
python3 burst.py \
  --url http://127.0.0.1:5005/webhook \
  --account 1 \
  --inbox 2 \
  --conversations 10,11,12,13,14,15,16,17,18,19 \
  --concurrency 10 \
  --message "не могу оплатить подписку"
```

Output:

```
  conv=10 http=200 reason=ok latency=3.421s
  conv=11 http=200 reason=ok latency=3.580s
  ...

total       : 10
ok          : 10
wall        : 4.12s
min         : 3.102s
p50         : 3.564s
p95         : 4.018s
p99         : 4.102s
max         : 4.102s
avg         : 3.601s
```

### Reading the result

- **p50 close to single-user latency** → the pipeline absorbs the load
  comfortably.
- **p95 much higher than p50** → contention downstream. Likely
  candidate is OpenClaw (batched LLM) or Chatwoot Puma.
- `wall ≈ max latency` is expected for a single burst; consistently
  large gaps suggest the runner machine is the bottleneck.

## 2. `hot_path_stats.py` — aggregate latencies from logs

Parses the structured `hot_path` line that ai-bot writes per handled
conversation and prints p50/p95/p99 for each subphase.

Example log line:

```
hot_path conv=30 t_parallel=0.157 t_llm=2.431 t_send=0.312 total=2.901
```

Meaning:
- `t_parallel` — wall-clock spent running park + prompt in parallel.
- `t_llm` — main OpenClaw chat call.
- `t_send` — outgoing message(s) + optional handoff.
- `total` — sum of the above, i.e. user-facing latency.

### Quick report from recent logs

```bash
docker compose logs --since=30m ai-bot \
  | python3 hot_path_stats.py
```

### Live rolling window during a stress test

```bash
docker compose logs -f ai-bot \
  | python3 hot_path_stats.py --live --window 50
```

The live mode re-prints stats every `window/5` samples so you can see
p95 in real time while firing `burst.py`.
