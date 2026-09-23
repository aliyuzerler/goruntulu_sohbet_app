/// Settings screen — logout, delete account, edit profile, version.
/// Routes to /settings/delete-account when user taps Delete account.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../i18n/strings.dart';
import '../auth/auth_provider.dart';

class SettingsPage extends ConsumerWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context, ref) {
    final i18n = t;
    return Scaffold(
      backgroundColor: const Color(0xFF0B0B0B),
      appBar: AppBar(
        title: Text(i18n.settingsTitle),
        backgroundColor: const Color(0xFF0B0B0B),
        foregroundColor: Colors.white,
      ),
      body: SafeArea(
        child: ListView(
          children: [
            // Account section
            _SectionHeader(label: i18n.settingsAccount),
            ListTile(
              leading: const Icon(Icons.person_outline, color: Colors.white70),
              title: Text(i18n.settingsEditProfile, style: const TextStyle(color: Colors.white)),
              trailing: const Icon(Icons.chevron_right, color: Colors.white54),
              onTap: () => context.push('/profile-setup'),
            ),
            ListTile(
              leading: const Icon(Icons.delete_outline, color: Colors.redAccent),
              title: Text(i18n.settingsDeleteAccount, style: const TextStyle(color: Colors.redAccent)),
              trailing: const Icon(Icons.chevron_right, color: Colors.white54),
              onTap: () => context.push('/settings/delete-account'),
            ),
            ListTile(
              leading: const Icon(Icons.logout, color: Colors.white70),
              title: Text(i18n.settingsLogout, style: const TextStyle(color: Colors.white)),
              onTap: () async {
                await ref.read(authProvider.notifier).logout();
                if (!context.mounted) return;
                context.go('/login');
              },
            ),
            const Divider(color: Colors.white12),
            // About section
            _SectionHeader(label: i18n.settingsAbout),
            ListTile(
              leading: const Icon(Icons.info_outline, color: Colors.white70),
              title: Text(i18n.settingsVersion('0.1.0'), style: const TextStyle(color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String label;
  const _SectionHeader({required this.label});
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Text(
        label,
        style: const TextStyle(color: Colors.white54, fontSize: 12, fontWeight: FontWeight.w600),
      ),
    );
  }
}
