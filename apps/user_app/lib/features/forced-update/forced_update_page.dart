/// ForcedUpdatePage — full screen shown when the app version is below minAppVersion.
/// Single CTA: "Update" → opens Google Play Store page for RandChat.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../i18n/strings.dart';

class ForcedUpdatePage extends ConsumerWidget {
  final String minVersion;
  const ForcedUpdatePage({super.key, required this.minVersion});

  @override
  Widget build(BuildContext context, ref) {
    final i18n = t;
    return Scaffold(
      backgroundColor: const Color(0xFF0B0B0B),
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(
                  Icons.system_update,
                  size: 80,
                  color: Color(0xFFFF3B30),
                ),
                const SizedBox(height: 24),
                Text(
                  'Update Required',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                      ),
                ),
                const SizedBox(height: 12),
                Text(
                  'RandChat requires version $minVersion or higher. Please update to continue.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white70),
                ),
                const SizedBox(height: 32),
                FilledButton.icon(
                  onPressed: () async {
                    final url = Uri.parse(
                      'https://play.google.com/store/apps/details?id=com.randchat.app',
                    );
                    if (await canLaunchUrl(url)) {
                      await launchUrl(url, mode: LaunchMode.externalApplication);
                    }
                  },
                  icon: const Icon(Icons.download),
                  label: const Text(
                    'Update Now',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFFFF3B30),
                    padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
