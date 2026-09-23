/// Admin app root widget — Phase 1: dark theme (light for admin), go_router.
import 'package:flutter/material.dart';
import 'router.dart';

class RandChatAdminApp extends StatelessWidget {
  const RandChatAdminApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'RandChat Admin',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF1E88E5),
          brightness: Brightness.light,
        ),
      ),
      routerConfig: AdminRouter.router,
    );
  }
}
