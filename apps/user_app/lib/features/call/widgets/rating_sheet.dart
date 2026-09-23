/// Rating sheet — post-call star rating (1-5).
/// Shown for 30s after call ends. On submit: POST /moderation/rate.
/// On skip: dismiss. Low-rated users get queue priority penalty (server-side).

import 'dart:async';
import 'package:flutter/material.dart';
import '../../../core/network/api_client.dart';
import '../../../i18n/strings.dart';

class RatingSheet extends StatefulWidget {
  final String callId;
  final String targetUserId;
  final String targetDisplayName;

  const RatingSheet({
    super.key,
    required this.callId,
    required this.targetUserId,
    required this.targetDisplayName,
  });

  @override
  State<RatingSheet> createState() => _RatingSheetState();
}

class _RatingSheetState extends State<RatingSheet> {
  int? _stars;
  bool _submitting = false;
  int _remainingSec = 30;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) {
        t.cancel();
        return;
      }
      setState(() => _remainingSec -= 1);
      if (_remainingSec <= 0) {
        t.cancel();
        Navigator.pop(context);
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_stars == null) return;
    setState(() => _submitting = true);
    final i18n = t;
    try {
      await ApiClient.rateCall(
        callId: widget.callId,
        targetUserId: widget.targetUserId,
        stars: _stars!,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(i18n.moderationRatingSubmitted)),
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
    return WillPopScope(
      onWillPop: () async {
        // Allow dismiss only via skip button (so we don't lose the timer).
        return false;
      },
      child: Container(
        padding: const EdgeInsets.all(24),
        decoration: const BoxDecoration(
          color: Color(0xFF0B0B0B),
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              i18n.moderationRatingTitle,
              style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 4),
            Text(
              '${i18n.moderationRatingSubtitle} — ${widget.targetDisplayName}',
              style: const TextStyle(color: Colors.white54, fontSize: 12),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            // Stars.
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(5, (i) {
                final starValue = i + 1;
                return IconButton(
                  onPressed: _submitting
                      ? null
                      : () => setState(() => _stars = starValue),
                  icon: Icon(
                    _stars != null && starValue <= _stars!
                        ? Icons.star
                        : Icons.star_border,
                    color: const Color(0xFFFFCC00),
                    size: 48,
                  ),
                );
              }),
            ),
            const SizedBox(height: 16),
            // Countdown + buttons.
            Text(
              '${_remainingSec}s',
              style: const TextStyle(color: Colors.white38, fontSize: 12),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _submitting ? null : () => Navigator.pop(context),
                    child: Text(i18n.moderationSkip, style: const TextStyle(color: Colors.white54)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton(
                    onPressed: _submitting || _stars == null ? null : _submit,
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFFFF3B30),
                    ),
                    child: _submitting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : Text(i18n.moderationSubmitRating),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
