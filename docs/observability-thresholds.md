# RandChat — Observability Thresholds + Alerting

## Monitoring Stack

| Component | Tool | Purpose |
|---|---|---|
| API errors + performance | Sentry (NestJS SDK) | Error capture + transaction traces |
| Flutter crashes | Firebase Crashlytics | Native crashes + non-fatal errors |
| App analytics | Firebase Analytics | Custom events (match_made, purchase_verified, etc.) |
| Structured logs | Pino (planned Phase 13) | JSON logs for production log aggregation |
| Infrastructure | Docker health checks + /health endpoint | Service liveness |

## Alert Thresholds

| Metric | Threshold | Action |
|---|---|---|
| **Crash-free rate** (Flutter) | ≥ 99% | Alert if < 99% for 1h → investigate top crash |
| **API error rate** | < 1% | Alert if > 1% for 5min → check Sentry for new errors |
| **API p99 latency** | < 500ms | Alert if > 500ms for 5min → check DB + Redis latency |
| **Socket.IO disconnect rate** | < 5% | Alert if > 5% → check Redis adapter health |
| **Matchmaking p95** | < 5s | Alert if > 5s → check Redis ZPOPMIN latency |
| **Rekognition failures** | < 5% | Alert if > 5% → check AWS service status |
| **Google Play webhook failures** | 0 | Alert on any 5xx from /billing/rtdn-webhook |
| **DB connection pool** | < 80% used | Alert if > 80% → increase pool size |
| **Redis memory** | < 70% used | Alert if > 70% → check for memory leaks |

## Sentry Configuration (API)

```typescript
// In main.ts (planned Phase 13):
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1, // 10% of transactions traced
  profilesSampleRate: 0.1,
});
```

## Crashlytics Configuration (Flutter)

```dart
// In main_dev.dart (planned Phase 13):
await Firebase.initializeApp();
FlutterError.onError = FirebaseCrashlytics.instance.recordFlutterError;
```

## Firebase Analytics Events

| Event Name | Trigger | Parameters |
|---|---|---|
| `match_made` | match:found received | callId, role |
| `call_started` | POST /calls/:id/start success | callId |
| `call_ended` | POST /calls/:id/end | callId, durationSec, endReason |
| `purchase_verified` | POST /billing/verify-purchase | productId, coinsCredited |
| `low_balance_triggered` | low_balance event received | needed, remainingFree |
| `daily_login_claimed` | POST /retention/claim-daily | streak, coinsEarned |
| `referral_completed` | processReferralOnPurchase | bonusCredited |
| `ad_reward_granted` | POST /retention/ad-reward | coinsEarned, remainingToday |
| `gift_sent` | POST /retention/gift | amount |
| `vip_subscribed` | POST /vip/verify-subscription | status |
| `report_submitted` | POST /moderation/report | reason |
| `nsfw_detected` | capture-frame flagged | callId |
| `force_update_shown` | minVersion > currentVersion | minVersion, currentVersion |

## Acceptance

- [ ] Crash-free rate ≥ 99% in production
- [ ] API error rate < 1% in production
- [ ] All analytics events fire correctly (verified in Firebase Analytics dashboard)
- [ ] Sentry alerts configured for all thresholds above
