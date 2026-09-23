/// GDPR page — data export (JSON download) + data deletion request.
/// Accessible from Settings.

import 'dart:convert' show JsonEncoder;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/network/api_client.dart';
import '../../i18n/strings.dart';

class GdprPage extends ConsumerStatefulWidget {
  const GdprPage({super.key});

  @override
  ConsumerState<GdprPage> createState() => _GdprPageState();
}

class _GdprPageState extends ConsumerState<GdprPage> {
  bool _exporting = false;
  bool _deleting = false;
  String? _exportedJson;

  Future<void> _export() async {
    setState(() {
      _exporting = true;
      _exportedJson = null;
    });
    try {
      final data = await ApiClient.gdprExport();
      final pretty = const JsonEncoder.withIndent('  ).convert(data);
      setState(() {
        _exportedJson = pretty;
        _exporting = false;
      });
    } catch (e) {
      setState(() => _exporting = false);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Export failed: $e')),
      );
    }
  }

  Future<void> _delete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Confirm Data Deletion'),
        content: const Text(
          'Your data will be anonymized in 14 days. This action cannot be undone. '
          'Financial records will be kept for 7 years (legal requirement).',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            style: FilledButton.styleFrom(backgroundColor: Colors.redAccent),
            child: const Text('Delete My Data'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _deleting = true);
    try {
      await ApiClient.gdprDelete();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Deletion scheduled — 14 days until anonymization.')),
      );
      context.pop();
    } catch (e) {
      setState(() => _deleting = false);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Delete request failed: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final i18n = t;
    return Scaffold(
      backgroundColor: const Color(0xFF0B0B0B),
      appBar: AppBar(
        title: const Text('Data & Privacy'),
        backgroundColor: const Color(0xFF0B0B0B),
        foregroundColor: Colors.white,
      ),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          // Export section
          const Icon(Icons.download, size: 48, color: Colors.white54),
          const SizedBox(height: 8),
          const Text(
            'Export My Data',
            style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          const Text(
            'Download all your data as JSON. Includes profile, wallet, transactions, calls, reports, ratings, chat messages.',
            style: TextStyle(color: Colors.white54, fontSize: 13),
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: _exporting ? null : _export,
            icon: _exporting
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.download),
            label: const Text('Export JSON'),
          ),
          if (_exportedJson != null) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF1C1C1E),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            'Exported (${_exportedJson!.length} bytes)',
                            style: const TextStyle(color: Colors.white70, fontSize: 12),
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.copy, color: Colors.white54, size: 16),
                          onPressed: () {
                            // Phase 9 — copy to clipboard. Phase 10 may write to a file.
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Copy to clipboard — Phase 10')),
                            );
                          },
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    SizedBox(
                      height: 200,
                      child: SingleChildScrollView(
                        child: Text(
                          _exportedJson!,
                          style: const TextStyle(
                            color: Colors.green,
                            fontSize: 11,
                            fontFamily: 'monospace',
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          const SizedBox(height: 32),
          const Divider(color: Colors.white12),
          const SizedBox(height: 32),
          // Delete section
          const Icon(Icons.delete_forever, size: 48, color: Colors.redAccent),
          const SizedBox(height: 8),
          const Text(
            'Delete My Data (GDPR/KVKK)',
            style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          const Text(
            'Request anonymization of your data. 14-day grace period. '
            'Financial records kept 7 years (legal requirement). '
            'This is separate from Settings → Delete Account (same flow, different legal basis).',
            style: TextStyle(color: Colors.white54, fontSize: 13),
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: _deleting ? null : _delete,
            icon: _deleting
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.delete_forever),
            label: const Text('Request Data Deletion'),
            style: FilledButton.styleFrom(
              backgroundColor: Colors.redAccent,
            ),
          ),
          const SizedBox(height: 32),
          // Legal docs links
          const Divider(color: Colors.white12),
          const SizedBox(height: 16),
          const Text(
            'Legal Documents',
            style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          ListTile(
            leading: const Icon(Icons.description, color: Colors.white54),
            title: const Text('Terms of Service (TR)', style: TextStyle(color: Colors.white70, fontSize: 14)),
            trailing: const Icon(Icons.open_in_new, color: Colors.white54, size: 16),
            onTap: () => _openUrl('https://randchat.example/legal/terms-tr.md'),
          ),
          ListTile(
            leading: const Icon(Icons.description, color: Colors.white54),
            title: const Text('Terms of Service (EN)', style: TextStyle(color: Colors.white70, fontSize: 14)),
            trailing: const Icon(Icons.open_in_new, color: Colors.white54, size: 16),
            onTap: () => _openUrl('https://randchat.example/legal/terms-en.md'),
          ),
          ListTile(
            leading: const Icon(Icons.privacy_tip, color: Colors.white54),
            title: const Text('Privacy Policy (TR)', style: TextStyle(color: Colors.white70, fontSize: 14)),
            trailing: const Icon(Icons.open_in_new, color: Colors.white54, size: 16),
            onTap: () => _openUrl('https://randchat.example/legal/privacy-tr.md'),
          ),
          ListTile(
            leading: const Icon(Icons.privacy_tip, color: Colors.white54),
            title: const Text('Privacy Policy (EN)', style: TextStyle(color: Colors.white70, fontSize: 14)),
            trailing: const Icon(Icons.open_in_new, color: Colors.white54, size: 16),
            onTap: () => _openUrl('https://randchat.example/legal/privacy-en.md'),
          ),
          ListTile(
            leading: const Icon(Icons.policy, color: Colors.white54),
            title: const Text('UGC Policy', style: TextStyle(color: Colors.white70, fontSize: 14)),
            trailing: const Icon(Icons.open_in_new, color: Colors.white54, size: 16),
            onTap: () => _openUrl('https://randchat.example/legal/ugc-policy.md'),
          ),
        ],
      ),
    );
  }

  Future<void> _openUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}
