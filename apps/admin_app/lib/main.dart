import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app/app.dart';
import 'core/config/env.dart';
import 'i18n/strings.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Env.load();
  T.setLocale(AppLocale.tr);
  runApp(
    const ProviderScope(
      child: RandChatAdminApp(),
    ),
  );
}
