# RandChat Admin App — Distribution Guide

## Overview

The RandChat admin app is distributed **APK-only** (never on Google Play). It's installed on authorized staff devices only (moderators + admins).

## Prerequisites

### Signing Setup

1. **Generate a keystore** (one-time):
   ```bash
   keytool -genkey -v -keystore randchat-admin.keystore \
     -alias randchat-admin \
     -keyalg RSA -keysize 4096 -validity 10000 \
     -storepass <your-keystore-password> \
     -keypass <your-key-password>
   ```

2. **Store the keystore** in a secure location:
   - Do NOT commit to git.
   - Store in a password manager or HSM.
   - Back up the keystore — if lost, you can't update the app on devices that have it installed.

3. **Configure signing in `android/key.properties`**:
   ```properties
   storePassword=<your-keystore-password>
   keyPassword=<your-key-password>
   keyAlias=randchat-admin
   storeFile=../randchat-admin.keystore
   ```

4. **Update `android/app/build.gradle.kts`** to read the keystore:
   ```kotlin
   val keystoreProperties = Properties()
   val keystoreFile = rootProject.file("key.properties")
   if (keystoreFile.exists()) {
       keystoreProperties.load(keystoreFile.inputStream())
   }

   android {
       signingConfigs {
           create("release") {
               storeFile = file(keystoreProperties["storeFile"] as String)
               storePassword = keystoreProperties["storePassword"] as String
               keyAlias = keystoreProperties["keyAlias"] as String
               keyPassword = keystoreProperties["keyPassword"] as String
           }
       }
       buildTypes {
           release {
               signingConfig = signingConfigs.getByName("release")
           }
       }
   }
   ```

## Build Process

```bash
# From repo root:
bash infra/scripts/build-admin-release.sh 0.1.0 1
# Output: apps/admin_app/build/app/outputs/flutter-apk/app-release.apk
```

## Distribution Channels

### Option A: Direct Download (S3 + signed URL)

1. Upload the APK to S3:
   ```bash
   aws s3 cp apps/admin_app/build/app/outputs/flutter-apk/app-release.apk \
     s3://randchat-admin-apks/admin-v0.1.0.apk
   ```

2. Generate a time-limited signed URL (expires in 24h):
   ```bash
   aws s3 presign s3://randchat-admin-apks/admin-v0.1.0.apk --expires-in 86400
   ```

3. Share the URL via secure email or internal Slack to authorized staff.

### Option B: Internal MDM (recommended for >5 devices)

- Upload the APK to your MDM provider (Intune, Kandji, Jamf, etc.)
- Enforce installation on managed devices.
- Remote wipe capability if a device is lost.

### Option C: Email Attachment (small teams only)

- Attach the APK to a secure email.
- Recipients install via "Settings → Security → Install unknown apps → Email app → Allow".

## Security Checklist

- [ ] Keystore generated + stored in password manager / HSM
- [ ] `android/key.properties` NOT in git (add to `.gitignore`)
- [ ] Admin app uses separate `com.randchat.admin` namespace (never overlaps with user app)
- [ ] TOTP 2FA is mandatory for admin login
- [ ] Admin JWT TTL is 15 minutes (no refresh token — re-login required)
- [ ] API `CORS_ORIGINS` does NOT include admin app (admin uses JWT only, no CORS)
- [ ] Admin app APK is obfuscated + minified (ProGuard/R8)
- [ ] Admin app is NOT published to Google Play
- [ ] Device pinning: only authorized device IDs can use the admin app (Phase 11)
- [ ] Remote revocation: if an admin leaves the company, their AdminUser row is deleted (tokens expire immediately)

## Admin User Setup

### Creating a new admin user

1. Connect to the database:
   ```bash
   docker exec -it randchat-pg psql -U randchat -d randchat
   ```

2. Generate a bcrypt password hash:
   ```sql
   -- In the SQL shell, use a temporary function or external tool:
   -- Node.js: node -e "console.log(require('bcrypt').hashSync('MyPassword123', 10))"
   ```

3. Insert the admin user:
   ```sql
   INSERT INTO admin_users (id, email, password_hash, role, created_at, updated_at)
   VALUES (
     gen_random_uuid(),
     'newmoderator@randchat.example',
     '$2b$10$...', -- bcrypt hash from step 2
     'MODERATOR',
     NOW(),
     NOW()
   );
   ```

4. On first login, the admin sets up TOTP:
   - App generates a QR code (otpauth:// URL).
   - Admin scans with Google Authenticator / Authy.
   - Admin enters the 6-digit code to confirm.
   - Secret is stored in `admin_users.totp_secret`.

### Roles

| Role | Permissions |
|---|---|
| `MODERATOR` | Dashboard, user search/view, report queue + resolve, audit log view |
| `ADMIN` | Everything MODERATOR + ban/unban, coin adjust, FCM broadcast, remote config |

Roles are **server-enforced** — the admin app's UI hides admin-only actions, but the API rejects them server-side via `RolesGuard`.

## Version Management

- Each release increments `versionCode` (integer) and `versionName` (semver).
- Old APKs are kept in S3 for rollback.
- Forced update via `RemoteConfig.min_app_version` applies to the admin app too.

## Incident Response

If an admin device is lost/stolen:
1. Delete the AdminUser row from the database → JWTs immediately invalid (15min max).
2. If TOTP secret was on the device, rotate it (generate new secret, update `admin_users.totp_secret`).
3. Review `AuditLog` for any suspicious actions from that admin.
4. If the admin had elevated access, rotate the API `JWT_ACCESS_SECRET` (forces all admins to re-login).
