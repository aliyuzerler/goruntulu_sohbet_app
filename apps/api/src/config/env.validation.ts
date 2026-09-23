import * as Joi from 'joi';

/**
 * Environment validation — startup fails fast if any required var is missing.
 * This is the single source of truth for what env vars the API expects.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'staging', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(3000),
  SERVICE_NAME: Joi.string().default('randchat-api'),
  SERVICE_VERSION: Joi.string().default('0.1.0'),

  // Database
  DATABASE_URL: Joi.string().uri().required(),

  // Redis
  REDIS_URL: Joi.string().uri().required(),

  // S3 / MinIO
  S3_ENDPOINT: Joi.string().uri().required(),
  S3_REGION: Joi.string().required(),
  S3_ACCESS_KEY: Joi.string().required(),
  S3_SECRET_KEY: Joi.string().required(),
  S3_BUCKET: Joi.string().required(),
  S3_FORCE_PATH_STYLE: Joi.boolean().default(true),
  S3_PUBLIC_BASE_URL: Joi.string().uri().required(),

  // Auth (Phase 2)
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TTL: Joi.number().default(900),
  JWT_REFRESH_TTL: Joi.number().default(2592000),
  FIREBASE_PROJECT_ID: Joi.string().allow('').default(''),
  FIREBASE_CLIENT_EMAIL: Joi.string().allow('').default(''),
  FIREBASE_PRIVATE_KEY: Joi.string().allow('').default(''),
  // Dev bypass — when FIREBASE_PROJECT_ID is empty, only whitelisted phones
  // and Google subjects are accepted. Comma-separated.
  FIREBASE_DEV_BYPASS_PHONES: Joi.string().allow('').default(''),
  GOOGLE_DEV_BYPASS_SUBJECTS: Joi.string().allow('').default(''),

  // Agora (Phase 4) — placeholders for now
  AGORA_APP_ID: Joi.string().allow('').default(''),
  AGORA_APP_CERTIFICATE: Joi.string().allow('').default(''),

  // AWS Rekognition (Phase 4)
  AWS_REGION: Joi.string().allow('').default(''),
  AWS_ACCESS_KEY_ID: Joi.string().allow('').default(''),
  AWS_SECRET_ACCESS_KEY: Joi.string().allow('').default(''),
  REKOGNITION_MIN_CONFIDENCE: Joi.number().default(60),
  REKOGNITION_FRAME_INTERVAL_SECONDS: Joi.number().default(15),

  // Google Play Billing (Phase 6)
  GOOGLE_PLAY_PACKAGE_NAME: Joi.string().allow('').default(''),
  GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: Joi.string().allow('').default(''),
  // RTDN webhook bearer token — empty disables verification (dev only).
  RTDN_BEARER_TOKEN: Joi.string().allow('').default(''),

  // FCM (Phase 7)
  FCM_SERVER_KEY: Joi.string().allow('').default(''),

  // Observability
  SENTRY_DSN: Joi.string().allow('').default(''),
  LOG_LEVEL: Joi.string().valid('trace', 'debug', 'info', 'warn', 'error', 'fatal').default('info'),

  // CORS
  CORS_ORIGINS: Joi.string().default(''),
  SOCKET_IO_CORS_ORIGINS: Joi.string().default('*'),

  // Socket.IO (Phase 3)
  HEARTBEAT_INTERVAL_SEC: Joi.number().default(30),
  HEARTBEAT_TTL_SEC: Joi.number().default(90),
  LATENCY_PING_INTERVAL_SEC: Joi.number().default(15),
  SOCKET_IO_ADAPTER_CHANNEL_PREFIX: Joi.string().default('socket.io'),
  LATENCY_GOOD_MS: Joi.number().default(200),
  LATENCY_FAIR_MS: Joi.number().default(500),

  // Matchmaking + economy (Phase 5)
  DAILY_FREE_MATCH_QUOTA: Joi.number().default(10),
  COIN_COST_PER_MATCH: Joi.number().default(2),
  MATCH_COOLDOWN_SEC: Joi.number().default(3),
  MAX_CONSECUTIVE_SKIPS: Joi.number().default(5),
  SKIP_TIMEOUT_SEC: Joi.number().default(30),
  COUNTRY_PRIORITY_TTL_SEC: Joi.number().default(45),

  // IAP — Phase 6 coin packs (server-authoritative).
  COIN_PACK_SMALL_ID: Joi.string().default('coin_pack_small'),
  COIN_PACK_SMALL_AMOUNT: Joi.number().default(10),
  COIN_PACK_SMALL_PRICE: Joi.string().default('$0.99'),
  COIN_PACK_MEDIUM_ID: Joi.string().default('coin_pack_medium'),
  COIN_PACK_MEDIUM_AMOUNT: Joi.number().default(60),
  COIN_PACK_MEDIUM_PRICE: Joi.string().default('$4.99'),
  COIN_PACK_LARGE_ID: Joi.string().default('coin_pack_large'),
  COIN_PACK_LARGE_AMOUNT: Joi.number().default(150),
  COIN_PACK_LARGE_PRICE: Joi.string().default('$9.99'),
  COIN_PACK_MEGA_ID: Joi.string().default('coin_pack_mega'),
  COIN_PACK_MEGA_AMOUNT: Joi.number().default(400),
  COIN_PACK_MEGA_PRICE: Joi.string().default('$24.99'),
  // Phase 6: RTDN webhook shared secret for HMAC verification.
  GOOGLE_PLAY_WEBHOOK_SECRET: Joi.string().allow('').default(''),

  // Phase 7: VIP + filters.
  VIP_PRODUCT_ID: Joi.string().default('vip_monthly'),
  COIN_COST_COUNTRY_FILTER: Joi.number().default(20),
  COUNTRY_FILTER_DURATION_HOURS: Joi.number().default(24),
  FAIRNESS_RELAX_COUNTRY_SEC: Joi.number().default(15),
  FAIRNESS_RELAX_GENDER_SEC: Joi.number().default(30),

  // Phase 8: Moderation.
  STRIKE_COOLDOWN_HOURS: Joi.number().default(24),
  STRIKE_BAN_LEVEL: Joi.number().default(3),
  NSFW_LABELS: Joi.string().default('Explicit Nudity,Suggestive,Explicit Bikini,Adult,Drugs'),
  CHAT_PROFANITY_ENABLED: Joi.boolean().default(true),
  CHAT_LINK_BLOCK_ENABLED: Joi.boolean().default(true),

  // Phase 9: Security hardening + Play Integrity + ban evasion + GDPR.
  BAN_EVASION_ENABLED: Joi.boolean().default(true),
  REPORT_WEIGHT_DECAY_THRESHOLD: Joi.number().default(5),
  REPORT_DECAYED_WEIGHT: Joi.number().default(0.1),
  WS_MSG_LIMIT_PER_10S: Joi.number().default(30),
  MIN_APP_VERSION: Joi.string().default('0.0.0'),

  // Phase 11: Retention + monetization extras.
  DAILY_LOGIN_REWARDS: Joi.string().default('1,2,3,4,5,5,5'),
  AD_REWARD_COINS: Joi.number().default(1),
  AD_REWARD_DAILY_LIMIT: Joi.number().default(3),
  REFERRAL_BONUS_COINS: Joi.number().default(10),
  RECONNECT_COST_COINS: Joi.number().default(5),
});
