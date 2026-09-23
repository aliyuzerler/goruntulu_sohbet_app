# RandChat — Load Test Report

## Test Environment

- **Infrastructure**: PostgreSQL 16, Redis 7, MinIO — all via docker-compose on a single machine.
- **API**: NestJS 10, single instance, Node 20, pnpm.
- **Test framework**: Jest + socket.io-client (50/500 virtual WS clients).
- **Machine**: (fill in production CI specs — typically 4 vCPU, 8GB RAM for staging).

## Methodology

### 500 Concurrent Users

1. **Login phase**: 500 sequential `/api/auth/verify-phone` (dev bypass) calls to get JWT tokens. Each user gets a unique phone number (`+905555550000` through `+905555550499`).
2. **Connect phase**: 500 socket.io-client connections opened simultaneously with `transports: ['websocket']` + `auth: { token }`.
3. **Queue phase**: On each socket's `connect` event, emit `queue:join` with `{ genderFilters: [], countryFilters: [] }`.
4. **Match phase**: Wait for `match:found` envelopes (30s timeout per socket).
5. **Verification**: Record match time per user. Verify every callId is unique (no double-loss).

### Metrics

| Metric | Target | How Measured |
|---|---|---|
| **p50 match time** | < 2s | Sort match times, take 50th percentile |
| **p95 match time** | < 5s | Sort match times, take 95th percentile |
| **Match rate** | 100% (for even N) | matched / N |
| **Double-loss** | 0 | unique callIds == total callIds |
| **API error rate** | < 1% | 5xx responses / total requests |
| **CPU usage** | < 80% | `docker stats` during test |
| **Redis latency** | < 5ms p99 | `redis-cli --latency` during test |

## Results

> Fill in after running `MATCHMAKING_LOAD_TEST_N=500 pnpm --filter @randchat/api exec jest --config ./test/jest-e2e.json -- matchmaking-load.e2e-spec`

| Metric | Result | Pass? |
|---|---|---|
| N | 500 | — |
| Matched | ___ | ___ |
| p50 | ___ ms | ___ |
| p95 | ___ ms | ___ |
| Double-loss | ___ | ___ |
| API errors | ___ | ___ |

## Lua Atomic Match Verification

The matchmaking worker uses a Redis Lua script (`match-atomic.lua.ts`) that:
1. Checks if userA is in the queue (ZSCORE).
2. Finds a partner (ZRANGE country queue → fallback global).
3. Atomically ZREMs both from both queues.

Redis executes Lua scripts single-threaded — two workers cannot see userA in the queue simultaneously. This guarantees **no double-loss** at the Redis level.

The test verifies this by checking that every `match:found` envelope has a unique `callId` — if two workers matched the same user, the same callId would appear twice.

## CI Integration

The load test runs in CI with N=10 (for speed). To run a full 500-user bench:

```bash
MATCHMAKING_LOAD_TEST_N=500 \
  pnpm --filter @randchat/api exec jest --config ./test/jest-e2e.json -- matchmaking-load.e2e-spec
```

The CI workflow (`.github/workflows/ci-api.yml`) runs the N=10 version as part of the standard e2e test suite.

## Failure Modes + Mitigations

| Failure | Symptom | Mitigation |
|---|---|---|
| Redis down | Lua script fails → no matches | Fail-open: users stay queued, retry on next tick |
| Postgres down | Call row creation fails | Match undone, users re-queued |
| Worker crash mid-match | One user removed from queue, other not | Lua atomicity prevents this — both ZREMs run in one script |
| Network partition (socket disconnect) | User left in queue | Heartbeat TTL (90s) + disconnect handler removes from queue |
