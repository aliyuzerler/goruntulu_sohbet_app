# RandChat — Launch Strategy

## 1. Single-Region Launch

### Target Region: Türkiye

Reasons:
- TR is the primary market (app language: TR birincil).
- KVKK compliance is critical → domestic legal framework.
- Phone OTP via Turkish numbers (+90) → Firebase Auth.
- Play Console pricing in TRY.

### Timeline
| Week | Phase | Users | Goal |
|---|---|---|---|
| 1 | Internal testing | 10-20 | E2E verification |
| 2 | Closed testing | ~100 | Metrics + crash-free |
| 3 | Staged 10% | ~500 | Real-world load |
| 4 | Staged 50% | ~2500 | Scale verification |
| 5 | Full 100% | ~5000+ | GA |

### Critical Mass
- Matchmaking needs ~100 concurrent users for sub-5s match times.
- Target: 5000 daily active users (DAU) by week 6.
- Marketing: TikTok/Instagram ads targeting 18-25 TR audience.

## 2. Moderation On-Call Plan

### Team
- 2 moderators (MODERATOR role) on rotation.
- 1 admin (ADMIN role) on standby for escalations.
- Shift coverage: 06:00-24:00 TR time (18h/day, first month).

### On-Call Schedule
| Time (TR) | Role | Coverage |
|---|---|---|
| 06:00-14:00 | Moderator A | Report queue + monitoring |
| 14:00-22:00 | Moderator B | Report queue + monitoring |
| 22:00-06:00 | Auto-mode | NSFW AI only (no human review) |

### Escalation
1. **NSFW auto-detection** → call ended + strike (automated).
2. **MINOR report** → instant ban + admin paged (24/7 PagerDuty).
3. **Strike level 3** → ban + admin notified for review.
4. **Crash spike** → admin paged → halt rollout if >5% crash rate.

### Monitoring Dashboard
- Admin app Dashboard: online users, active calls, daily matches/skips, pending reports, revenue.
- Alerts: pending reports > 50, NSFW flags per hour > 10, API error rate > 1%.

## 3. Hotfix Flow

### Trigger
- Crash-free < 95% (Crashlytics alert).
- API error rate > 5% (Sentry alert).
- Matchmaking p95 > 15s (monitoring).
- Security incident (ban evasion, data breach).

### Flow
1. **Detect** — Sentry/Crashlytics alert → on-call admin paged.
2. **Assess** — check dashboard KPIs + recent deployments.
3. **Mitigate**:
   - Remote config: `global_matching_off=true` (stops new matches).
   - Remote config: `min_app_version` bump (forces update).
   - Play Console: halt staged rollout.
4. **Fix** — branch off `main` → hotfix commit → review → merge.
5. **Build** — `bash infra/scripts/build-prod-aab.sh <version> <code+1>`.
6. **Upload** — Play Console → Production → Upload AAB → Resume rollout at previous %.
7. **Post-mortem** — within 48h, write incident report (root cause + prevention).

### Hotfix SLA
| Severity | Response time | Fix time |
|---|---|---|
| P0 (total outage) | 15 min | 2h |
| P1 (critical broken) | 30 min | 4h |
| P2 (degraded) | 2h | 24h |
