# RandChat — Privacy Policy v1.0.0

Last updated: 2024-01-01

## 1. Data We Collect

### Account information
- Phone number (E.164, stored as SHA-256 hash — GDPR Art. 4(5))
- Google subject ID (for Google Sign-In users)
- Profile: nickname, avatar, gender, country, birth year (for 18+ verification)

### Device information
- Android ID (for single active session per device)
- FCM token (for push notifications)
- App version, platform

### Call metadata
- Call start/end time, duration, end reason (user_left/report/moderation/timeout/low_balance)
- Average network quality (ms RTT)
- In-call chat messages (profanity-filtered, link-blocked)

### Moderation data
- Frames captured by AWS Rekognition (stored in S3, one every 15 seconds)
- Reports (reason, note, evidence package: last 3 frames + user meta)
- Strike history (level, last strike time)

### Financial data
- Coin transactions (append-only ledger, with idempotency key)
- Google Play purchases (orderId, purchaseToken, productId)
- VIP subscription status (entitlement: ACTIVE/CANCELED/EXPIRED/GRACE)

## 2. Data We Do NOT Collect

- **Video call content**: No video stream is recorded outside AI moderation. Moderation frames are deleted after 90 days.
- **Location**: No GPS data — country is inferred from SIM/locale only.
- **Contacts**: We do not access your address book.

## 3. Data Usage

Data is used for:

- Running the service (matchmaking, calling, chat)
- Security and moderation (NSFW detection, bans, strike system)
- Billing (Google Play purchases)
- Legal obligations (KVKK/GDPR compliance, financial records kept 7 years)

## 4. Data Sharing

Third-party sharing:

- **AWS**: Rekognition (NSFW detection), S3 (frame storage)
- **Google**: Play Billing (purchases + subscriptions), Firebase Auth (phone OTP + Google Sign-In)
- **Agora**: RTC video infrastructure (data flows through their network but is not stored)

Legal obligations: data may be shared with authorities upon court order.

## 5. Data Retention

| Data type | Retention period | Justification |
|---|---|---|
| Account information | Until account deletion | GDPR Art. 5 |
| Call metadata | 2 years | Legal obligation (5651) |
| Moderation frames | 90 days | Security + audit |
| Financial records | 7 years | Tax regulations |
| Strike history | 5 years | Repeat abuse detection |

## 6. GDPR/KVKK Rights

Under GDPR Art. 15-17 / KVKK Madde 14-17:

- **Data export**: Settings → Data Export → JSON export (all your data in one file)
- **Data deletion**: Settings → Account Deletion → anonymization after 14 days
- **Correction**: Profile editing screen
- **Objection**: legal@randchat.example

## 7. Cookies and Tracking

- No ads — no third-party ad SDKs.
- Firebase Analytics: anonymous event tracking (Crashlytics + non-fatal error capture).
- IDFA/AAID: not used for advertising; Android ID is used for device identification only.

## 8. Children's Privacy

Use by users under 18 is prohibited. Birth year is checked; if under 18 is detected, account is auto-banned + reported to moderator.

## 9. Changes

If the policy changes, notification will be shown in-app and changes take effect 30 days later.

## 10. Contact

- Data Controller: RandChat
- DPO: legal@randchat.example
- KVKK application form: https://randchat.example/kvkk-application
