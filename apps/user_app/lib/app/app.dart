/// App root widget — wires MaterialApp.router with go_router.
/// Phase 1: dark theme, no theme provider yet; Phase 8 will add theming.

import 'package:flutter/material.dart';
import 'router.dart';

class RandChatApp extends StatelessWidget {
  const RandChatApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'RandChat',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFFFF3B30),
          brightness: Brightness.dark,
        ),
      ),
      routerConfig: AppRouter.router,
    );
  }
}
