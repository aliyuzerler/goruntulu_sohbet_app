# RandChat

Azar/OmeTV tarzı rastgele görüntülü sohbet platformu. Flutter (Android) kullanıcı + admin uygulamaları, NestJS API, monorepo.

## Mimari

```
randchat/
├── apps/
│   ├── api/            # NestJS 10 + Prisma + PostgreSQL + Redis
│   ├── user_app/       # Flutter 3.24+ — son kullanıcı
│   └── admin_app/      # Flutter — yönetim paneli (APK dağıtım)
├── packages/
│   └── shared/         # Ortak DTO'lar, enum'lar
└── infra/
    ├── docker-compose.yml
    └── scripts/
```

Detaylı mimari için: `docs/ARCHITECTURE.md` (Faz 2+).

## Geliştirme

### Önkoşullar
- Node 20+
- pnpm 9+
- Docker + Docker Compose
- Flutter 3.24+ (Android SDK 26+)

### İlk kurulum
```bash
# Repo kökünde
pnpm install
bash infra/scripts/dev-up.sh          # PG + Redis + MinIO + Socket.IO
pnpm db:migrate                       # Prisma migration
pnpm --filter @randchat/api dev       # API → http://localhost:3000
```

### Flutter uygulamaları
```bash
cd apps/user_app && flutter pub get && flutter run
cd apps/admin_app && flutter pub get && flutter run
```

### Test
```bash
pnpm test:api          # NestJS e2e (health)
cd apps/user_app && flutter test
```

## Faz Durumu
- [x] Faz 1 — Scaffold (bu repo)
- [ ] Faz 2 — Auth (Firebase phone OTP + Google + JWT rotation)
- [ ] Faz 3 — Matchmaking + Socket.IO signaling
- [ ] Faz 4 — Video (Agora) + moderation (Rekognition)
- [ ] Faz 5 — Ekonomi (jeton, bakiye, ledger)
- [ ] Faz 6 — Ödeme (Google Play Billing + RTDN refund)
- [ ] Faz 7 — Push (FCM) + observability (Crashlytics/Sentry)
- [ ] Faz 8 — Admin paneli + production hardening

## Lisans
Private — tüm hakları saklıdır.
