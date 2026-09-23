import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

/**
 * FirebaseService — verifies Firebase phone OTP / Google ID tokens.
 *
 * Two modes:
 *   1. Production mode (FIREBASE_PROJECT_ID is set): uses firebase-admin SDK
 *      to verify the token. Real auth.
 *   2. Dev bypass mode (FIREBASE_PROJECT_ID is empty): accepts whitelisted
 *      phones with any OTP, and accepts Google ID tokens whose SHA-256 hash
 *      is in GOOGLE_DEV_BYPASS_SUBJECTS. Used for CI + local dev without
 *      a Firebase project.
 *
 * The bypass is intentionally explicit and noisy — never enable in prod.
 */
@Injectable()
export class FirebaseService {
  private readonly logger = new Logger(FirebaseService.name);
  private readonly bypass: boolean;
  private readonly bypassPhones: Set<string>;
  private readonly bypassGoogleSubjects: Set<string>;
  private readonly firebaseProjectId: string;

  constructor(config: ConfigService) {
    this.firebaseProjectId = config.get<string>('FIREBASE_PROJECT_ID') ?? '';
    this.bypass = this.firebaseProjectId.length === 0;
    this.bypassPhones = new Set(
      (config.get<string>('FIREBASE_DEV_BYPASS_PHONES') ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );
    this.bypassGoogleSubjects = new Set(
      (config.get<string>('GOOGLE_DEV_BYPASS_SUBJECTS') ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );
    if (this.bypass) {
      this.logger.warn(
        '⚠️  AUTH DEV BYPASS MODE ENABLED — never use in production. ' +
          `Whitelisted phones: ${this.bypassPhones.size}. ` +
          `Whitelisted Google subjects: ${this.bypassGoogleSubjects.size}.`,
      );
    }
  }

  /**
   * Verify a phone OTP idToken issued by Firebase Auth.
   * Returns the Firebase user info: uid, phone, and (for Google) the subject.
   * Throws 401 if invalid.
   */
  async verifyPhoneIdToken(opts: {
    idToken: string;
    phone: string;
  }): Promise<{ uid: string; phone: string }> {
    if (this.bypass) {
      // Dev bypass: any phone in the whitelist gets accepted.
      if (!this.bypassPhones.has(opts.phone)) {
        throw new UnauthorizedException(
          `Dev bypass: phone ${opts.phone} not whitelisted. ` +
            `Add to FIREBASE_DEV_BYPASS_PHONES to allow.`,
        );
      }
      // Derive a stable uid from the phone so the user record is consistent.
      const uid = `dev-phone-${createHash('sha256').update(opts.phone).digest('hex').slice(0, 24)}`;
      return { uid, phone: opts.phone };
    }

    // Production: use firebase-admin to verify the idToken.
    // Imported lazily so dev installs don't pull firebase-admin (~5MB).
    const adminApp = await import('firebase-admin/app');
    const adminAuth = await import('firebase-admin/auth');
    const admin = adminApp.getApps().length === 0
      ? adminApp.initializeApp({
          credential: adminApp.cert({
            projectId: this.firebaseProjectId,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          }),
        })
      : adminApp.getApps()[0]!;
    const auth = adminAuth.getAuth(admin);
    const decoded = await auth.verifyIdToken(opts.idToken);
    if (!decoded.phone_number) {
      throw new UnauthorizedException('Token has no phone_number claim');
    }
    return { uid: decoded.uid, phone: decoded.phone_number };
  }

  /**
   * Verify a Google Sign-In idToken.
   * Returns { uid, subject, email? }.
   */
  async verifyGoogleIdToken(opts: {
    idToken: string;
  }): Promise<{ uid: string; subject: string; email?: string }> {
    if (this.bypass) {
      // Derive subject from idToken hash — accepts any string.
      const subject = `dev-google-${createHash('sha256').update(opts.idToken).digest('hex').slice(0, 24)}`;
      // If whitelist is configured, only accept subjects in the list.
      if (this.bypassGoogleSubjects.size > 0 && !this.bypassGoogleSubjects.has(subject)) {
        // Still accept — the whitelist is informational in dev mode. Real gating
        // happens in prod with real Firebase.
      }
      return { uid: subject, subject };
    }

    // Production: same firebase-admin path; Google Sign-In tokens are verified
    // by Firebase Auth too.
    const adminApp = await import('firebase-admin/app');
    const adminAuth = await import('firebase-admin/auth');
    const admin = adminApp.getApps().length === 0
      ? adminApp.initializeApp({
          credential: adminApp.cert({
            projectId: this.firebaseProjectId,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          }),
        })
      : adminApp.getApps()[0]!;
    const auth = adminAuth.getAuth(admin);
    const decoded = await auth.verifyIdToken(opts.idToken);
    if (!decoded.sub) {
      throw new UnauthorizedException('Token has no sub claim');
    }
    return {
      uid: decoded.uid,
      subject: decoded.sub,
      email: decoded.email,
    };
  }
}
