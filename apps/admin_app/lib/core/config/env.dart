/// Admin env — same shape as user_app but different default URL.
/// Admin panel is APK-only, never goes to Google Play.
/// Phase 2 will add admin-specific JWT refresh TTL.

import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/services.dart' show rootBundle;

class Env {
  Env._();

  static Map<String, String>? _cached;

  static Future<void> load() async {
    if (_cached != null) return;
    final map = <String, String>{};
    try {
      if (!kIsWeb) {
        final raw = await rootBundle.loadString('.env');
        for (final line in raw.split('\n')) {
          final t = line.trim();
          if (t.isEmpty || t.startsWith('#')) continue;
          final idx = t.indexOf('=');
          if (idx <= 0) continue;
          map[t.substring(0, idx).trim()] = t.substring(idx + 1).trim();
        }
      }
    } catch (_) {
      // Fall back to defaults below.
    }
    _cached = map;
    _populateFromMapOrEnv(map);
  }

  static String apiBaseUrl = 'http://10.0.2.2:3000/api';
  static String appEnv = 'development';
  static String sentryDsn = '';

  static void _populateFromMapOrEnv(Map<String, String> fileMap) {
    String pick(String key, String fallback) {
      final fromFile = fileMap[key];
      if (fromFile != null && fromFile.isNotEmpty) return fromFile;
      if (!kIsWeb) {
        final fromEnv = Platform.environment[key];
        if (fromEnv != null && fromEnv.isNotEmpty) return fromEnv;
      }
      return fallback;
    }

    apiBaseUrl = pick('API_BASE_URL', apiBaseUrl);
    appEnv = pick('APP_ENV', appEnv);
    sentryDsn = pick('SENTRY_DSN', sentryDsn);
  }
}
