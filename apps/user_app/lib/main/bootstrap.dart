/// Shared bootstrap — runs once before runApp() regardless of flavor.
/// Phase 2 will add: Sentry / Firebase init, secure storage check.
/// Phase 7 will add: FCM token registration.

import 'package:randchat_user_app/i18n/strings.dart';

Future<void> bootstrap() async {
  // Default locale TR birincil (per user choice).
  // Phase 7 will switch to device locale with TR as fallback.
  T.setLocale(AppLocale.tr);
}
