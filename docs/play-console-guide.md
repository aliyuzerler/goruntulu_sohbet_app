# RandChat — Google Play Console Launch Guide

## 1. Store Listing

### App Name (TR)
```
RandChat — Görüntülü Sohbet
```

### Short Description (TR, 80 char max)
```
Dünyanın her yerinden rastgele kullanıcılarla görüntülü sohbet et.
```

### Full Description (TR, 4000 char max)
```
RandChat ile gerçek insanlarla anlık görüntülü sohbet!

🎯 RASTGELE EŞLEŞME
Tek dokunuşla dünyanın her yerinden bir kullanıcıyla eşleş. 18+ yaş sınırlaması ile güvenli bir topluluk.

🛡️ GÜVENLİ ORTAM
AI destekli moderasyon (AWS Rekognition) her 15 saniyede bir kare tarar. Uygunsuz içerik otomatik engellenir. Tek tıkla raporlama + engelleme.

💎 JETON EKONOMİSİ
Her gün 10 ücretsiz eşleşme! Bittiğinde jeton satın al (10/60/150/400 jeton paketleri) veya VIP ol.

⭐ VIP ÜYELİK
- Cinsiyet filtresi (kadın/erkek seç)
- Ücretsiz ülke filtresi (24 saat)
- Profil rozeti
- Öncelikli eşleşme

🎁 BAĞLILIK ÖDÜLLERİ
- Günlük giriş: 7 gün seri → artan jeton (1-5)
- Davet kodu: arkadaşın satın alınca ikinize de bonus!
- Reklam izle → 1 jeton (günlük 3 kez)

📱 ÖZELLİKLER
- Tam ekran görüntülü sohbet + PIP yerel kamera
- Ağ kalitesi göstergesi + otomatik kalite düşürme
- Çağrı içi metin sohbeti (profanite filtreli)
- Çağrı sonrası yıldız değerlendirme
- KVKK/GDPR uyumlu veri indirme + silme

RandChat — gerçek insanlarla, anlık, güvenli.

Not: RandChat 18+ içerik derecelendirmesine sahiptir. 18 yaşından küçükler kullanamaz.
```

### App Name (EN)
```
RandChat — Video Chat
```

### Short Description (EN, 80 char max)
```
Random video chat with real people from around the world.
```

### Full Description (EN)
```
RandChat — instant video chat with real people!

🎯 RANDOM MATCHING
One tap to match with a user from anywhere in the world. 18+ only community.

🛡️ SAFE ENVIRONMENT
AI-powered moderation (AWS Rekognition) scans every 15 seconds. Inappropriate content is automatically blocked. One-tap reporting + blocking.

💎 COIN ECONOMY
10 free matches every day! When you run out, buy coins (10/60/150/400 packs) or get VIP.

⭐ VIP MEMBERSHIP
- Gender filter (male/female selection)
- Free country filter (24 hours)
- Profile badge
- Priority matching

🎁 RETENTION REWARDS
- Daily login: 7-day streak → increasing coins (1-5)
- Invite code: bonus coins when your friend makes a purchase!
- Watch ads → 1 coin (3x daily)

📱 FEATURES
- Full screen video chat + PIP local camera
- Network quality indicator + auto bitrate reduction
- In-call text chat (profanity-filtered)
- Post-call star rating
- GDPR/KVKK-compliant data export + deletion

RandChat — real people, instant, safe.

Note: RandChat is rated 18+. Users under 18 are not permitted.
```

### Graphics
- **App icon**: 512×512 PNG (RoundPlay branding: red gradient #FF3B30 + video camera icon)
- **Feature graphic**: 1024×500 PNG (lifestyle image with phone mockup)
- **Phone screenshots**: 2-8 screenshots (1080×1920 min), showing: splash, login, home (match button), call screen, wallet, shop, VIP page
- **Tablet screenshots**: optional

## 2. Content Rating

Complete the IARC questionnaire in Play Console:

| Question | Answer |
|---|---|
| Does your app contain violence? | No (user-generated, but we moderate) |
| Does your app contain sexual content? | Yes (user-generated video — we moderate) |
| Does your app contain profanity? | Yes (user-generated chat — we filter) |
| Does your app allow user-to-user communication? | Yes |
| Is user-generated content moderated? | Yes (AI + manual) |
| Is this app designed for children? | No |

**Result**: Mature 17+ (RATED_M)

See `docs/legal/content-rating.md` for the full justification.

## 3. Data Safety Form

See `docs/legal/data-safety-form.md` for the complete mapping table.

Key sections:
- **Data collected**: Personal info (phone), Financial (purchase history), Photos/videos (moderation frames), App activity (interactions), App info (crash logs)
- **Data encrypted**: Yes (TLS 1.2+ in transit, AES-256 at rest)
- **Data deletion**: Yes (Settings → Account Deletion, 14-day grace)
- **No ads**: No third-party ad SDKs (except rewarded AdMob, Phase 11)

## 4. IAP Products

Create these in-app products in Play Console → Monetize → Products:

| Product ID | Type | Description | Default Price (TR) | Default Price (US) |
|---|---|---|---|---|
| `coin_pack_small` | Consumable | 10 coins | 9.99 ₺ | $0.99 |
| `coin_pack_medium` | Consumable | 60 coins | 49.99 ₺ | $4.99 |
| `coin_pack_large` | Consumable | 150 coins | 99.99 ₺ | $9.99 |
| `coin_pack_mega` | Consumable | 400 coins | 249.99 ₺ | $24.99 |
| `vip_monthly` | Subscription | Monthly VIP | 79.99 ₺/month | $9.99/month |

### Subscription details for `vip_monthly`:
- **Billing period**: 1 month
- **Free trial**: None
- **Grace period**: 3 days (Google default)
- **Upgrade/downgrade**: Deferred (current period completes before switch)

## 5. Rollout Plan

### Phase 1: Internal Testing (Week 1)
- Upload AAB to Internal Testing track.
- Add 10-20 testers (team + beta users) by email.
- Verify: login, profile setup, agreements, matchmaking, video call, IAP purchase, VIP subscription, reporting, GDPR export.
- Duration: 3-5 days.

### Phase 2: Closed Testing (Week 2)
- Create a closed testing track with a Google Group (~100 users).
- Monitor: crash-free rate, API error rate, matchmaking p95.
- Duration: 5-7 days.

### Phase 3: Staged Rollout (Week 3-4)
- Promote to Production track with staged rollout:
  - Day 1: 10% rollout (monitor metrics)
  - Day 3: 50% rollout (if no critical issues)
  - Day 7: 100% rollout

### Rollback Plan
- If crash-free < 95% or API error > 5% → halt rollout → release hotfix.
- Play Console → Production → Halt rollout → Upload new AAB → Resume.

## 6. Privacy Policy URL
- Host the privacy policy at: `https://randchat.example/privacy`
- Content from: `docs/legal/privacy-tr.md` + `docs/legal/privacy-en.md`

## 7. Terms of Service URL
- Host at: `https://randchat.example/terms`
- Content from: `docs/legal/terms-tr.md` + `docs/legal/terms-en.md`
