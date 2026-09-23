/// Shared app-level constants — Phase 1.
class AppConstants {
  AppConstants._();

  /// HTTP status codes used in code paths.
  static const int httpOk = 200;
  static const int httpUnauthorized = 401;
  static const int httpForbidden = 403;
  static const int httpNotFound = 404;
  static const int httpTooManyRequests = 429;
  static const int httpInternal = 500;

  /// Splash screen — min display duration so even fast boots show the logo.
  static const Duration splashMinDuration = Duration(seconds: 1);

  /// Splash retry backoff (seconds). 2,4,8,16,30 max.
  static const List<int> splashRetryBackoffSeconds = [2, 4, 8, 16, 30];

  /// Health endpoint path.
  static const String healthEndpoint = '/health';
}
