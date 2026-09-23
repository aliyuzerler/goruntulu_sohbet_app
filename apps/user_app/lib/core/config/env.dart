/// Environment configuration — Phase 1.
/// Reads from .env file (loaded by Flutter's environment) or Platform.environment.
/// Phase 7 may switch to envied + obfuscation for release builds.

import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsModeDebug, kIsWeb;
import 'package:flutter/services.dart' show rootBundle;
import 'dart:convert' show utf8, json;

/// Resolved at first access (cached). Reads `.env` file from root bundle on
/// mobile (the file must be in `assets/` for that to work) — but for Phase 1
/// scaffold we just default to the literal constants below so the app boots
/// without a build step.
class Env {
  Env._();

  static Map<String, String>? _cached;

  static Future<void> load() async {
    if (_cached != null) return;
    // On non-web platforms we try to read the .env file; if it fails we fall
    // back to compile-time defaults so the app still boots.
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

  /// API base URL (e.g. http://10.0.2.2:3000/api).
  /// 10.0.2.2 is the host loopback from Android emulator.
  static String apiBaseUrl = 'http://10.0.2.2:3000/api';

  /// Socket.IO URL (no /api prefix).
  static String socketIoUrl = 'http://10.0.2.2:3000';

  /// Environment name (development / staging / production).
  static String appEnv = 'development';

  /// Sentry DSN — empty in Phase 1.
  static String sentryDsn = '';

  /// Agora App ID — empty in Phase 4 placeholder.
  static String agoraAppId = '';

  /// FCM VAPID key — empty in Phase 7 placeholder.
  static String fcmVapidKey = '';

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
    socketIoUrl = pick('SOCKET_IO_URL', socketIoUrl);
    appEnv = pick('APP_ENV', appEnv);
    sentryDsn = pick('SENTRY_DSN', sentryDsn);
    agoraAppId = pick('AGORA_APP_ID', agoraAppId);
    fcmVapidKey = pick('FCM_VAPID_KEY', fcmVapidKey);
  }
}
