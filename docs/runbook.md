# RandChat — Operations Runbook

## Incident Playbooks

### 1. NSFW Wave

**Symptom**: Spike in NSFW detections (>10 flags/hour). Users are bypassing AI moderation.

**Steps**:
1. Tighten the Rekognition threshold:
   ```bash
   # Via remote config (admin app → Config → Set key):
   redis-cli SET remote-config:nsfw_threshold 50
   # Default is 60 → 50 is stricter (catches more borderline content).
   ```
2. If wave continues > 30 min → enable emergency matching off:
   ```bash
   redis-cli SET remote-config:global_matching_off true
   ```
3. Notify on-call admin via PagerDuty.
4. Investigate: check `moderation_frames` table for common patterns (same user? same region? bot?).
5. If bot attack → ban user IDs + record BannedDevice (phone hash + androidId).
6. Resume matching once flag rate drops below 5/hour:
   ```bash
   redis-cli SET remote-config:global_matching_off false
   redis-cli SET remote-config:nsfw_threshold 60  # back to default
   ```
7. Post-incident: review auto-ban thresholds + consider adding new NSFW labels.

---

### 2. Refund Wave

**Symptom**: Spike in Google Play refunds (RTDN REFUNDED events > 50/day).

**Steps**:
1. Check RTDN webhook health:
   ```bash
   curl -sS http://localhost:3000/api/health | jq .components
   ```
2. If webhook failing → check `GOOGLE_PLAY_WEBHOOK_SECRET` matches Pub/Sub config.
3. Refunds auto-process: `BillingService.processRtdn` debits coins + sets `negativeBalance=true`.
4. If many users going negative → they can't match → check for fraud (same device creating multiple accounts).
5. If fraud → use `BanEvasionService.recordBannedUser` for flagged devices.
6. Post-incident: review refund rate with Google Play → if > 3% → app may get flagged by Play policy.

---

### 3. Server Scaling

#### Scale Up (Vertical)
When CPU > 80% or API p99 > 500ms:
1. Increase API instance count (horizontal):
   ```bash
   docker-compose up -d --scale api=3  # 3 instances behind Nginx
   ```
2. Verify Redis adapter: `tail -f /var/log/api.log | grep "Redis adapter attached"` on each instance.
3. Verify matchmaking works across instances: Lua script is Redis-side (instance-agnostic).

#### Scale Redis (Vertical)
When Redis memory > 70% or latency > 5ms:
1. Switch to Redis Cluster (minimum 3 master + 3 replica).
2. Update `REDIS_URL` to cluster URL.
3. Socket.IO Redis adapter supports cluster mode out of the box.

#### Scale PostgreSQL (Vertical)
When DB CPU > 80% or connection pool > 80%:
1. Increase `max_connections` in `postgresql.conf`.
2. Add read replica for analytics queries (admin dashboard KPIs).
3. If still slow → pgBouncer connection pooler in front.

#### Agora Minute Budget
Agora charges per minute per user for video calls.

| Users | Avg call duration | Minutes/user/day | Daily minutes | Monthly cost (est.) |
|---|---|---|---|---|
| 100 DAU | 5 min | 1 call | 500 | ~$5 |
| 1,000 DAU | 5 min | 1 call | 5,000 | ~$50 |
| 10,000 DAU | 5 min | 1 call | 50,000 | ~$500 |
| 50,000 DAU | 5 min | 1 call | 250,000 | ~$2,500 |

**Alert**: If Agora usage exceeds 120% of projected budget → investigate (bot calls? longer-than-expected durations?).

**Mitigation**:
- Cap max call duration to 10 min (remote config).
- After 5 min, show "call ending soon" prompt → encourage Next.
- VIP users get unlimited duration.

---

### 4. Database Down

**Symptom**: API 500 errors, Prisma connection failures.

**Steps**:
1. Check PostgreSQL container: `docker ps | grep postgres`.
2. If stopped: `docker-compose up -d postgres`.
3. If corrupted: restore from latest backup (see `docs/backup-restore.md`).
4. If disk full: `docker system prune -a` + check `infra/data/postgres` size.
5. Notify users: `redis-cli SET remote-config:global_matching_off true` (graceful degradation).

---

### 5. Redis Down

**Symptom**: Socket.IO disconnects, matchmaking fails, presence stale.

**Steps**:
1. Check Redis: `docker exec randchat-redis redis-cli ping`.
2. If no response: `docker-compose restart redis`.
3. If data corrupted: `docker-compose down redis && rm -rf infra/data/redis && docker-compose up -d redis`.
4. Matchmaking will auto-recover (Redis reconnect + Lua script re-defined).
5. Presence will rebuild from heartbeats (next 30s cycle).

---

### 6. Agora Outage

**Symptom**: Video calls fail to connect, black screen.

**Steps**:
1. Check Agora status: https://status.agora.io
2. If Agora down → fallback to coturn TURN server (see `docs/coturn-setup.md`).
3. Disable matching: `redis-cli SET remote-config:global_matching_off true`.
4. Notify users via FCM broadcast (admin app → Broadcast → "Video service temporarily unavailable").
5. Resume when Agora status returns to green.
