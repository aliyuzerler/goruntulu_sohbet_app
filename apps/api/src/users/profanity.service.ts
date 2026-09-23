import { Injectable } from '@nestjs/common';

/**
 * ProfanityService — basic Turkish + English profanity filter for nicknames.
 * Real apps would use a third-party list (e.g. `bad-words` npm + a curated list).
 * Phase 1 keeps a hand-curated small list — Phase 8 may switch to a managed list.
 *
 * Note: this is intentionally naive. We're not fighting motivated adversaries —
 * just catching accidental use. AI moderation (Phase 4) handles real attempts.
 */
@Injectable()
export class ProfanityService {
  // Lowercased substrings to reject if found inside nickname.
  private readonly blocked: string[] = [
    // English
    'fuck', 'shit', 'bitch', 'asshole', 'dick', 'pussy', 'cunt', 'nigger', 'fag', 'slut',
    // Turkish
    'amk', 'aq', 'sik', 'orosbu', 'piç', 'yarrak', 'göt', 'amcık', 'oç', 'puşt',
    // Common substitutions
    'fck', 'sh1t', 'b1tch',
  ];

  /** Returns true if nickname contains profanity. */
  containsProfanity(nickname: string): boolean {
    const n = nickname.toLowerCase().replace(/\s+/g, '');
    return this.blocked.some((w) => n.includes(w));
  }
}
