# RandChat — Cost Estimates

## Infrastructure Components

| Component | Provider | Purpose | Billing Unit |
|---|---|---|---|
| API server (NestJS) | VPS (Hetzner/DigitalOcean) | REST + WebSocket API | Monthly fixed |
| PostgreSQL 16 | VPS (same server or managed RDS) | Database | Monthly fixed + storage |
| Redis 7 | VPS (same server or managed) | Queue + presence + rate limiting | Monthly fixed |
| S3-compatible storage | AWS S3 or MinIO (self-hosted) | Avatar + moderation frame storage | Per GB + per request |
| AWS Rekognition | AWS | NSFW detection (DetectModerationLabels) | Per image |
| Agora RTC | Agora | Video calling infrastructure | Per minute per user |
| Google Play | Google | IAP billing (30% fee on revenue) | Per transaction |
| Firebase | Google (free tier → Blaze) | Auth + Analytics + Crashlytics | Free → per auth + per event |

## Monthly Cost by User Tier

### Tier 1: 100 DAU (Early launch)

| Component | Usage | Cost |
|---|---|---|
| VPS (4 vCPU, 8GB RAM) | 1 instance | $20-40/mo |
| PostgreSQL | Same VPS | $0 (included) |
| Redis | Same VPS | $0 (included) |
| S3 storage | ~5 GB (avatars + frames) | $0.12/mo |
| AWS Rekognition | ~500 images/day × 30 = 15,000/mo | $15/mo ($0.001/image) |
| Agora | 100 users × 5 min × 1 call/day × 30 days = 15,000 min/mo | $15/mo ($1/1000 min) |
| Firebase | Free tier (10K auth, unlimited Analytics) | $0/mo |
| Google Play fee | 30% of revenue (~$50 IAP/month) | $15/mo (Google's cut) |
| **Total** | | **~$65-85/mo** |

### Tier 2: 1,000 DAU (Growth)

| Component | Usage | Cost |
|---|---|---|
| VPS (8 vCPU, 16GB RAM) | 1-2 instances (scale horizontal) | $80-120/mo |
| S3 storage | ~50 GB | $1.15/mo |
| AWS Rekognition | 5,000/day × 30 = 150,000/mo | $150/mo |
| Agora | 1,000 × 5 min × 30 = 150,000 min/mo | $150/mo |
| Firebase | Blaze (50K auth + 2M events) | $25/mo |
| Google Play fee | 30% of ~$500 IAP/month | $150/mo |
| **Total** | | **~$556-596/mo** |

### Tier 3: 10,000 DAU (Scale)

| Component | Usage | Cost |
|---|---|---|
| VPS (16 vCPU × 3 instances) | Horizontal scale | $400-600/mo |
| Managed PostgreSQL (RDS) | Read replica for dashboard | $100-200/mo |
| Managed Redis (ElastiCache) | 2-node cluster | $50-100/mo |
| S3 storage | ~500 GB | $11.50/mo |
| AWS Rekognition | 50,000/day × 30 = 1.5M/mo | $1,500/mo |
| Agora | 10,000 × 5 min × 30 = 1.5M min/mo | $1,500/mo |
| Firebase | Blaze (500K auth + 10M events) | $100/mo |
| Google Play fee | 30% of ~$5,000 IAP/month | $1,500/mo |
| Sentry (Team plan) | 3M errors/mo | $26/mo |
| **Total** | | **~$5,288-5,538/mo** |

### Tier 4: 50,000 DAU (Mature)

| Component | Usage | Cost |
|---|---|---|
| VPS (auto-scaling group, 6+ instances) | Horizontal scale + load balancer | $1,200-2,000/mo |
| Managed PostgreSQL (RDS, 2 replicas) | High availability | $300-500/mo |
| Managed Redis (cluster, 6 nodes) | Sharded + HA | $200-400/mo |
| S3 storage | ~2.5 TB | $57.50/mo |
| AWS Rekognition | 250,000/day × 30 = 7.5M/mo | $7,500/mo |
| Agora | 50,000 × 5 min × 30 = 7.5M min/mo | $7,500/mo (volume discount may apply) |
| Firebase | Blaze (2.5M auth + 50M events) | $500/mo |
| Google Play fee | 30% of ~$25,000 IAP/month | $7,500/mo |
| Sentry (Business plan) | 15M errors/mo | $80/mo |
| coturn server (dedicated) | TURN relay | $50/mo |
| **Total** | | **~$24,888-25,888/mo** |

## Revenue Model

| Metric | 100 DAU | 1,000 DAU | 10,000 DAU | 50,000 DAU |
|---|---|---|---|---|
| IAP conversion rate | 5% | 5% | 5% | 5% |
| Paying users | 5 | 50 | 500 | 2,500 |
| Avg spend / paying user / mo | $5 | $5 | $5 | $5 |
| Gross IAP revenue | $25 | $250 | $2,500 | $12,500 |
| VIP subscription (2%) | 2 users | 20 | 200 | 1,000 |
| VIP revenue ($10/mo) | $20 | $200 | $2,000 | $10,000 |
| Ad reward revenue (AdMob) | $2 | $20 | $200 | $1,000 |
| **Total revenue** | $47 | $470 | $4,700 | $23,500 |
| Google Play fee (30%) | $14 | $141 | $1,410 | $7,050 |
| **Net revenue** | $33 | $329 | $3,290 | $16,450 |
| **Costs** | $85 | $596 | $5,538 | $25,888 |
| **Profit/Loss** | -$52 | -$267 | -$2,248 | -$9,438 |

### Break-even Analysis

**Break-even**: ~25,000 DAU with 7% IAP conversion + 3% VIP rate.

| Lever | Impact |
|---|---|
| Increase IAP conversion 5% → 10% | Doubles IAP revenue → break-even at ~15K DAU |
| Increase avg spend $5 → $8 | +60% IAP revenue |
| Reduce Rekognition (15s → 30s interval) | Halves Rekognition cost |
| Reduce Agora (cap 5min → 3min calls) | -40% Agora cost |
| Add interstitial ads | New revenue stream ($0.5-2 CPM) |

## Cost Optimization Opportunities

1. **Rekognition**: increase frame interval from 15s to 30s → halves cost ($7,500 → $3,750 at 50K DAU).
2. **Agora**: negotiate volume discount at 1M+ minutes/month → ~20-30% off.
3. **S3**: use S3 Intelligent-Tiering for moderation frames (90-day retention → auto-move to Glacier).
4. **Self-host**: MinIO instead of S3 for storage → $0 (included in VPS cost).
5. **Agora fallback**: coturn for simple calls → Agora only for premium features (Phase 14 optimization).
