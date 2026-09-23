/// Report sheet — single-tap report with reason picker + optional note.
/// On submit: POST /moderation/report (auto-evidence: last 3 frames + user meta)
/// If "Block this user" is checked: POST /moderation/block after submit.

import 'package:flutter/material.dart';
import '../../../core/network/api_client.dart';
import '../../../i18n/strings.dart';

class ReportSheet extends StatefulWidget {
  final String reportedUserId;
  final String? callId;
  final String reportedDisplayName;

  const ReportSheet({
    super.key,
    required this.reportedUserId,
    this.callId,
    required this.reportedDisplayName,
  });

  @override
  State<ReportSheet> createState() => _ReportSheetState();
}

class _ReportSheetState extends State<ReportSheet> {
  String? _reason;
  final _noteCtrl = TextEditingController();
  bool _blockAlso = false;
  bool _submitting = false;

  static const _reasons = <_ReportOption>[
    _ReportOption(value: 'INAPPROPRIATE', labelKey: 'nudity', icon: Icons.visibility_off),
    _ReportOption(value: 'HARASSMENT', labelKey: 'harassment', icon: Icons.sentiment_very_dissatisfied),
    _ReportOption(value: 'MINOR', labelKey: 'minor', icon: Icons.child_care),
    _ReportOption(value: 'SPAM', labelKey: 'spam', icon: Icons.block),
    _ReportOption(value: 'OTHER', labelKey: 'other', icon: Icons.more_horiz),
  ];

  @override
  void dispose() {
    _noteCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_reason == null) return;
    setState(() => _submitting = true);
    final i18n = t;
    try {
      await ApiClient.createReport(
        reportedId: widget.reportedUserId,
        callId: widget.callId,
        reason: _reason!,
        note: _noteCtrl.text.trim().isEmpty ? null : _noteCtrl.text.trim(),
      );
      if (_blockAlso) {
        await ApiClient.blockUser(widget.reportedUserId);
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(i18n.moderationSubmitted)),
      );
      Navigator.pop(context);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(i18n.moderationSubmitFailed(e.toString()))),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final i18n = t;
    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      minChildSize: 0.4,
      maxChildSize: 0.9,
      expand: false,
      builder: (context, scrollController) => Container(
        color: const Color(0xFF0B0B0B),
        child: ListView(
          controller: scrollController,
          padding: const EdgeInsets.all(24),
          children: [
            Text(
              i18n.moderationReportTitle,
              style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 4),
            Text(
              '${i18n.moderationReportSubtitle} — ${widget.reportedDisplayName}',
              style: const TextStyle(color: Colors.white54, fontSize: 13),
            ),
            const SizedBox(height: 24),
            // Reason grid.
            ..._reasons.map((r) {
              final label = _labelFor(r.labelKey);
              return RadioListTile<String>(
                value: r.value,
                groupValue: _reason,
                onChanged: (v) => setState(() => _reason = v),
                title: Row(
                  children: [
                    Icon(r.icon, color: _reason == r.value ? const Color(0xFFFF3B30) : Colors.white70),
                    const SizedBox(width: 12),
                    Text(label, style: const TextStyle(color: Colors.white)),
                  ],
                ),
                activeColor: const Color(0xFFFF3B30),
              );
            }),
            const SizedBox(height: 16),
            // Note.
            TextField(
              controller: _noteCtrl,
              maxLines: 3,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                labelText: i18n.moderationNoteLabel,
                labelStyle: const TextStyle(color: Colors.white54),
                hintText: i18n.moderationNoteHint,
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
            const SizedBox(height: 16),
            // Block also checkbox.
            CheckboxListTile(
              value: _blockAlso,
              onChanged: (v) => setState(() => _blockAlso = v ?? false),
              title: Text(i18n.moderationBlockAlso, style: const TextStyle(color: Colors.white)),
              subtitle: Text(i18n.moderationBlockAlsoBody, style: const TextStyle(color: Colors.white38, fontSize: 12)),
              activeColor: const Color(0xFFFF3B30),
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _submitting || _reason == null ? null : _submit,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFFF3B30),
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              child: _submitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : Text(i18n.moderationSubmit),
            ),
          ],
        ),
      ),
    );
  }

  String _labelFor(String key) {
    final i18n = t;
    switch (key) {
      case 'nudity':
        return i18n.moderationReasonNudity;
      case 'harassment':
        return i18n.moderationReasonHarassment;
      case 'minor':
        return i18n.moderationReasonMinor;
      case 'spam':
        return i18n.moderationReasonSpam;
      default:
        return i18n.moderationReasonOther;
    }
  }
}

class _ReportOption {
  final String value;
  final String labelKey;
  final IconData icon;
  const _ReportOption({required this.value, required this.labelKey, required this.icon});
}
