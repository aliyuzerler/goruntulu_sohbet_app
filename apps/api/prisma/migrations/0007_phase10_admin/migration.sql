-- Phase 10: AdminUser.totpSecret — mandatory TOTP 2FA for admin login.
ALTER TABLE "admin_users" ADD COLUMN "totp_secret" VARCHAR(64);
