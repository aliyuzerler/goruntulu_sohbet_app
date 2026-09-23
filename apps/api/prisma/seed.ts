import { PrismaClient, AgreementType } from '@prisma/client';
import { config } from 'dotenv';

config({ path: '.env' });

const prisma = new PrismaClient();

/**
 * Seed agreements — Terms v1.0.0 + Privacy v1.0.0.
 * Each is markdown content shown to the user before they can match.
 * Real text should be drafted by legal; this is dev placeholder.
 */
const TERMS_V1 = `# Terms of Service — RandChat v1.0.0

By using RandChat, you agree to:
- Be at least 18 years old.
- Not share explicit content (moderation is AI-enforced).
- Not use the service for harassment, fraud, or spam.
- Accept that accounts can be terminated for violations.

Last updated: 2024-01-01`;

const PRIVACY_V1 = `# Privacy Policy — RandChat v1.0.0

We collect:
- Phone number (for auth, hashed at rest)
- Profile information (nickname, avatar, gender, country)
- Device identifiers (Android ID, FCM token)
- Chat metadata (timestamps, durations — NOT content)

We do NOT collect:
- The content of your video calls (only AI moderation frames)
- Your location beyond what your SIM/locale tells us
- Your contacts

Last updated: 2024-01-01`;

async function main(): Promise<void> {
  await prisma.agreement.upsert({
    where: { type_version: { type: AgreementType.TERMS, version: '1.0.0' } },
    create: { type: AgreementType.TERMS, version: '1.0.0', bodyMd: TERMS_V1 },
    update: {},
  });
  await prisma.agreement.upsert({
    where: { type_version: { type: AgreementType.PRIVACY, version: '1.0.0' } },
    create: { type: AgreementType.PRIVACY, version: '1.0.0', bodyMd: PRIVACY_V1 },
    update: {},
  });
  console.log('✓ Agreements seeded (Terms v1.0.0, Privacy v1.0.0)');

  // Also keep the Phase 1 health-ping seed for CI smoke.
  await prisma.healthPing.create({ data: { source: 'ci' } }).catch(() => {
    // Already exists — fine.
  });
}

main()
  .catch((err) => {
    console.error('✗ Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
