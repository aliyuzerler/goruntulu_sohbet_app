/// Default entry point — equivalent to `lib/main/main_dev.dart`.
/// Run with: `flutter run --flavor dev`
/// Other flavors: see lib/main/main_staging.dart, lib/main/main_prod.dart

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app/app.dart';
import 'core/config/env.dart';
import 'i18n/strings.dart';
import 'main/bootstrap.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Dev defaults — overridden by lib/main/main_dev.dart when used with -t flag.
  Env.apiBaseUrl = 'http://10.0.2.2:3000/api';
  Env.socketIoUrl = 'http://10.0.2.2:3000';
  Env.appEnv = 'dev';

  await bootstrap();
  runApp(
    const ProviderScope(
      child: RandChatApp(),
    ),
  );
}

// ignore: unused_element
final _unused = t;
