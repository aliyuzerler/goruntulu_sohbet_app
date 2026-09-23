/// Delete account screen — shows grace period warning, accepts optional reason,
/// POSTs /me/delete to schedule anonymization in 14 days.
///
/// Also supports the inverse: if there's already a pending deletion request,
/// show "Cancel deletion" button instead.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../i18n/strings.dart';
import '../../core/network/api_client.dart';
import '../../core/network/dto/auth_dto.dart';
import '../auth/auth_provider.dart';

class DeleteAccountPage extends ConsumerStatefulWidget {
  const DeleteAccountPage({super.key});

  @override
  ConsumerState<DeleteAccountPage> createState() => _DeleteAccountPageState();
}

class _DeleteAccountPageState extends ConsumerState<DeleteAccountPage> {
  final _reasonCtrl = TextEditingController();
  bool _busy = false;
  String? _error;
  DeletionRequestDto? _pending;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadPending());
  }

  @override
  void dispose() {
    _reasonCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadPending() async {
    try {
      final me = await ApiClient.getMe();
      if (me.deletionRequest != null && mounted) {
        setState(() => _pending = me.deletionRequest);
      }
    } catch (_) {
      // ignore — fresh page; user can still try to delete.
    }
  }

  Future<void> _confirmDelete() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final r = await ApiClient.requestDeletion(reason: _reasonCtrl.text.trim().isEmpty ? null : _reasonCtrl.text.trim());
      setState(() => _pending = r);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(t.deleteAccountDeletionScheduled)),
      );
      context.pop();
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _cancelDeletion() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ApiClient.cancelDeletion();
      setState(() => _pending = null);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(t.deleteAccountDeletionCanceled)),
      );
      context.pop();
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _hardLogout() async {
    // User confirmed deletion AND wants to immediately log out (account still
    // active during grace period — they can re-login to cancel if they want).
    await ref.read(authProvider.notifier).logout();
    if (!mounted) return;
    context.go('/login');
  }

  @override
  Widget build(BuildContext context) {
    final i18n = t;
    return Scaffold(
      backgroundColor: const Color(0xFF0B0B0B),
      appBar: AppBar(
        title: Text(i18n.deleteAccountTitle),
        backgroundColor: const Color(0xFF0B0B0B),
        foregroundColor: Colors.white,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 500),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Google Play policy notice
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1C1C1E),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.info_outline, color: Colors.white54, size: 16),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          i18n.deleteAccountPlayStoreNote,
                          style: const TextStyle(color: Colors.white54, fontSize: 12),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                if (_pending != null) ...[
                  // Pending state — show countdown + cancel button.
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF3A1C1C),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.redAccent),
                    ),
                    child: Column(
                      children: [
                        const Icon(Icons.warning_amber_rounded, color: Colors.redAccent, size: 36),
                        const SizedBox(height: 8),
                        Text(
                          i18n.deleteAccountGracePeriodInfo(
                            DateFormat('yyyy-MM-dd HH:mm').format(_pending!.scheduledAt.toLocal()),
                          ),
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: Colors.white),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  OutlinedButton.icon(
                    onPressed: _busy ? null : _cancelDeletion,
                    icon: const Icon(Icons.cancel_outlined, color: Colors.white),
                    label: Text(i18n.deleteAccountCancelDeletion),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      side: const BorderSide(color: Colors.white24),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextButton(
                    onPressed: _busy ? null : _hardLogout,
                    child: Text(i18n.settingsLogout, style: const TextStyle(color: Colors.white70)),
                  ),
                ] else ...[
                  // Initial confirm state.
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF3A1C1C),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.redAccent),
                    ),
                    child: Column(
                      children: [
                        const Icon(Icons.warning_amber_rounded, color: Colors.redAccent, size: 36),
                        const SizedBox(height: 8),
                        Text(
                          i18n.deleteAccountWarning,
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: Colors.white),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  TextField(
                    controller: _reasonCtrl,
                    maxLines: 3,
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      labelText: i18n.deleteAccountReason,
                      labelStyle: const TextStyle(color: Colors.white54),
                      hintText: i18n.deleteAccountReasonHint,
                      hintStyle: const TextStyle(color: Colors.white30),
                      enabledBorder: OutlineInputBorder(
                        borderSide: const BorderSide(color: Colors.white24),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderSide: const BorderSide(color: Color(0xFFFF3B30)),
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  if (_error != null) ...[
                    Text(_error!, style: const TextStyle(color: Colors.redAccent)),
                    const SizedBox(height: 12),
                  ],
                  FilledButton(
                    onPressed: _busy ? null : _confirmDelete,
                    style: FilledButton.styleFrom(
                      backgroundColor: Colors.redAccent,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                    child: _busy
                        ? const SizedBox(
                            height: 18,
                            width: 18,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                          )
                        : Text(i18n.deleteAccountConfirm),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
