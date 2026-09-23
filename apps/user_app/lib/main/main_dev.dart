/// Per-flavor entry points. Use with:
///   flutter run --flavor dev      -t lib/main/main_dev.dart
///   flutter run --flavor staging  -t lib/main/main_staging.dart
///   flutter run --flavor prod     -t lib/main/main_prod.dart
///
/// Each main_*.dart sets Env.* fields before booting the shared bootstrap().
/// This avoids needing --dart-define and keeps flavor config in code.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../app/app.dart';
import '../core/config/env.dart';
import '../core/remote-config/remote_config_service.dart';
import '../features/forced-update/forced_update_page.dart';
import '../i18n/strings.dart';
import 'bootstrap.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Dev flavor — points at the host loopback (10.0.2.2 from Android emulator).
  Env.apiBaseUrl = 'http://10.0.2.2:3000/api';
  Env.socketIoUrl = 'http://10.0.2.2:3000';
  Env.appEnv = 'dev';

  await bootstrap();

  // Phase 9: forced update gate — fetch remote config + compare with current app version.
  const currentVersion = '0.1.0';
  try {
    final config = await RemoteConfigService.fetch();
    if (RemoteConfigService.isVersionBelow(currentVersion, config.minAppVersion)) {
      runApp(
        ProviderScope(
          child: MaterialApp(
            debugShowCheckedModeBanner: false,
            home: ForcedUpdatePage(minVersion: config.minAppVersion),
          ),
        ),
      );
      return;
    }
  } catch (_) {
    // Remote config fetch failed (offline / API down) — proceed with normal boot.
  }

  runApp(
    const ProviderScope(
      child: RandChatApp(),
    ),
  );
}

// Re-export so analysis finds T usage.
// ignore: unused_element
final _unused = t;
