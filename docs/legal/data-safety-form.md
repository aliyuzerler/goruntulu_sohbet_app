# RandChat — Google Play Data Safety Form Mapping

Bu doküman, Google Play Console'daki Data Safety formu için veri toplama/d paylaşım haritalaması yapar.

## Data Types Collected

### 1. Personal identifiers
- **Phone number** (E.164): collected for authentication via Firebase phone OTP
- **Device ID** (Android ID): collected for device-based session management + ban evasion prevention
- **Account ID** (internal UUID): generated server-side

✅ Google Play: "Personal info" → "Phone number", "Device or other IDs"

### 2. Financial info
- **Purchase history**: Google Play Billing (orderId, productId, purchaseToken)
- **Subscription status**: VIP monthly entitlement

✅ Google Play: "Financial info" → "Purchase history"

### 3. Photos and videos
- **Captured video frames**: AWS Rekognition scans one frame every 15s during calls
- **Avatar**: user-uploaded profile picture (S3, presigned PUT)

✅ Google Play: "Photos and videos"

### 4. App activity
- **User actions**: matching, calling, skipping, reporting
- **In-app search history**: N/A (no search feature)
- **Other user-generated content**: in-call text chat messages (profanity-filtered, link-blocked)

✅ Google Play: "App activity" → "App interactions", "User-generated content"

### 5. App info and performance
- **Crash logs**: Firebase Crashlytics
- **Diagnostics**: Sentry (API), Firebase Analytics (app)
- **Performance data**: per-call RTT, network quality

✅ Google Play: "App info and performance" → "Crash logs", "Diagnostics"

## Data Sharing

All data shared with third parties:

| Third party | Data shared | Purpose |
|---|---|---|
| AWS | Video frames, profile avatar | Moderation (Rekognition), storage (S3) |
| Google | Phone number, purchase tokens, subscription tokens | Firebase Auth, Play Billing |
| Agora | Call signaling, RTC video stream | Video infrastructure |

## Data Encryption

- ✅ In transit: HTTPS/TLS 1.2+ for all API + WebSocket connections
- ✅ At rest: AES-256 on S3 (server-side encryption)
- ✅ Database: PostgreSQL 16 with at-rest encryption (RDS)
- ✅ Redis: in-memory, TLS for client connections

## Data Deletion

- Users can request data deletion via: Settings → Account Deletion (14-day grace)
- GDPR/KVKK right to erasure: Settings → GDPR → Delete My Data
- Financial records retained 7 years (tax compliance)
- Moderation evidence retained 90 days

## Independent Security Review

Security review date: (to be filled before production launch)
Reviewer: (TBD)

## Family Policy Compliance

- **Target audience**: 18+ (NOT family-friendly)
- **Content rating**: Mature 17+ ( violence, suggestive themes via user-generated content)
- **Ads**: None (no third-party ad SDKs)

## Government & Law Enforcement Requests

Lawful requests are fulfilled per applicable law. Contact: legal@randchat.example.
