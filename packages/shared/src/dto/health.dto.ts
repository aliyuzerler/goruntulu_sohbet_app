/**
 * Health endpoint response — shared between api and clients.
 * Used by user_app / admin_app to check server reachability.
 */
export interface HealthResponseDto {
  /** Server uptime in seconds */
  uptime: number;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Service name (always "randchat-api") */
  service: string;
  /** Semver version */
  version: string;
  /** Environment name (development / staging / production) */
  env: string;
  /** Component-level health (db, redis, storage) */
  components: {
    db: ComponentHealth;
    redis: ComponentHealth;
    storage: ComponentHealth;
  };
}

export interface ComponentHealth {
  status: 'up' | 'down' | 'degraded';
  latencyMs?: number;
  message?: string;
}

/**
 * Generic API error envelope.
 * Always returned with HTTP status code that matches `code`.
 */
export interface ApiErrorDto {
  code: string; // e.g. "AUTH_INVALID_OTP"
  message: string; // User-facing, localized on client
  details?: Record<string, unknown>;
  traceId?: string;
}

/**
 * Idempotency-aware envelope for coin operations.
 * Server checks `Idempotency-Key` header on POST /coin/* routes.
 */
export interface IdempotentResponseDto<T> {
  idempotencyKey: string;
  appliedAt: string; // ISO 8601
  data: T;
}
