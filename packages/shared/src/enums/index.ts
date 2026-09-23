/**
 * User role — server-enforced only.
 * Never trust a client-supplied role; always read from JWT or DB.
 */
export enum UserRole {
  USER = 'USER',
  MODERATOR = 'MODERATOR',
  ADMIN = 'ADMIN',
}

/**
 * Account status lifecycle.
 * ACTIVE  → user can use the app normally
 * SHADOW  → user can use app but actions are silently flagged (soft-ban)
 * BANNED  → user cannot authenticate
 */
export enum UserStatus {
  ACTIVE = 'ACTIVE',
  SHADOW = 'SHADOW',
  BANNED = 'BANNED',
}

/**
 * Coin transaction type — append-only ledger entries.
 * Positive (CREDIT) increases balance, negative (DEBIT) decreases.
 */
export enum CoinTxType {
  PURCHASE = 'PURCHASE', // Google Play → user buys coins
  SPEND_MATCH = 'SPEND_MATCH', // Random match fee
  SPEND_GIFT = 'SPEND_GIFT', // Gift to other user
  SPEND_FILTER = 'SPEND_FILTER', // Gender/region filter
  REFUND = 'REFUND', // Refund from dispute or system error
  ADJUSTMENT = 'ADJUSTMENT', // Manual admin adjustment
}

/**
 * Video call session lifecycle.
 */
export enum CallStatus {
  WAITING = 'WAITING', // In matchmaking queue
  MATCHED = 'MATCHED', // Paired but not connected
  ACTIVE = 'ACTIVE', // Video stream up
  ENDED = 'ENDED', // Normally ended
  REPORTED = 'REPORTED', // Flagged for moderation review
}
