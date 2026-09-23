/// Agreements screen — show Terms + Privacy, require accept-all before
/// the user can proceed to /home.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../i18n/strings.dart';
import '../../core/network/api_client.dart';
import '../../core/network/dto/auth_dto.dart';

class AgreementsPage extends ConsumerStatefulWidget {
  const AgreementsPage({super.key});

  @override
  ConsumerState<AgreementsPage> createState() => _AgreementsPageState();
}

class _AgreementsPageState extends ConsumerState<AgreementsPage> {
  AgreementDto? _terms;
  AgreementDto? _privacy;
  bool _acceptedTerms = false;
  bool _acceptedPrivacy = false;
  bool _loading = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    try {
      final r = await ApiClient.getLatestAgreements();
      setState(() {
        _terms = r.terms;
        _privacy = r.privacy;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _acceptAll() async {
    if (_terms == null || _privacy == null) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ApiClient.acceptAgreement(_terms!.id);
      await ApiClient.acceptAgreement(_privacy!.id);
      if (!mounted) return;
      context.go('/home');
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final i18n = t;
    if (_loading) {
      return const Scaffold(
        backgroundColor: Color(0xFF0B0B0B),
        body: Center(child: CircularProgressIndicator(color: Colors.white)),
      );
    }
    return Scaffold(
      backgroundColor: const Color(0xFF0B0B0B),
      appBar: AppBar(
        title: Text(i18n.agreementsTitle),
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
                if (_terms != null) ...[
                  Text(
                    '${i18n.agreementsTermsOfService} (v${_terms!.version})',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1C1C1E),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: SingleChildScrollView(
                      scrollDirection: Axis.vertical,
                      child: Text(
                        _terms!.bodyMd,
                        style: const TextStyle(color: Colors.white70, fontSize: 13),
                      ),
                    ),
                  ),
                  CheckboxListTile(
                    value: _acceptedTerms,
                    onChanged: (v) => setState(() => _acceptedTerms = v ?? false),
                    title: Text(i18n.agreementsAccept, style: const TextStyle(color: Colors.white70)),
                  ),
                ],
                if (_privacy != null) ...[
                  const SizedBox(height: 24),
                  Text(
                    '${i18n.agreementsPrivacyPolicy} (v${_privacy!.version})',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1C1C1E),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      _privacy!.bodyMd,
                      style: const TextStyle(color: Colors.white70, fontSize: 13),
                    ),
                  ),
                  CheckboxListTile(
                    value: _acceptedPrivacy,
                    onChanged: (v) => setState(() => _acceptedPrivacy = v ?? false),
                    title: Text(i18n.agreementsAccept, style: const TextStyle(color: Colors.white70)),
                  ),
                ],
                const SizedBox(height: 32),
                if (_error != null) ...[
                  Text(_error!, style: const TextStyle(color: Colors.redAccent)),
                  const SizedBox(height: 12),
                ],
                FilledButton(
                  onPressed: (_acceptedTerms && _acceptedPrivacy && !_saving) ? _acceptAll : null,
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFFFF3B30),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  child: Text(i18n.agreementsAcceptAll),
                ),
                if (!(_acceptedTerms && _acceptedPrivacy)) ...[
                  const SizedBox(height: 12),
                  Text(
                    i18n.agreementsMustAcceptAll,
                    style: const TextStyle(color: Colors.white38, fontSize: 12),
                    textAlign: TextAlign.center,
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
