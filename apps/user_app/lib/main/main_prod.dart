/// Production entry point. Points at the prod API host.
/// Phase 8 will add obfuscated envied + Sentry init.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../app/app.dart';
import '../core/config/env.dart';
import '../i18n/strings.dart';
import 'bootstrap.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  Env.apiBaseUrl = 'https://api.randchat.example.com/api';
  Env.socketIoUrl = 'https://api.randchat.example.com';
  Env.appEnv = 'prod';

  await bootstrap();
  runApp(
    const ProviderScope(
      child: RandChatApp(),
    ),
  );
}

// ignore: unused_element
final _unused = t;
