/// Admin home — Phase 2 placeholder. Phase 8 will add: user list, reports, audits.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../features/auth/admin_auth_provider.dart';

class AdminHomePage extends ConsumerWidget {
  const AdminHomePage({super.key});

  @override
  Widget build(BuildContext context, ref) {
    final auth = ref.watch(adminAuthProvider);
    final adminEmail = auth is AdminAuthenticated ? auth.email : '';
    return Scaffold(
      appBar: AppBar(
        title: const Text('RandChat Admin'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () async {
              await ref.read(adminAuthProvider.notifier).logout();
              if (!context.mounted) return;
              context.go('/login');
            },
          ),
        ],
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.admin_panel_settings, size: 80),
            const SizedBox(height: 16),
            Text('Welcome, $adminEmail'),
            const SizedBox(height: 24),
            const Text(
              'Phase 2 placeholder — Phase 8 will add:',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            const Text('• User list (search + ban)\n• Reports queue\n• Coin adjustments\n• Audit log viewer'),
          ],
        ),
      ),
    );
  }
}
