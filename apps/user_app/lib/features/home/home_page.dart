/// Home page — Phase 4: shows match button (queue:join), wallet balance,
/// latency indicator, online counter. On match:found → push to /call.
/// Listens to socket envelopes via SocketClient.

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../i18n/strings.dart';
import '../../core/socket/socket_client.dart';
import '../../core/socket/socket_provider.dart';
import '../../core/network/dto/call_dto.dart';
import '../../core/network/dto/wallet_dto.dart';
import '../filters/filter_selection_sheet.dart';
import 'widgets/latency_indicator.dart';
import 'widgets/online_counter.dart';

/// Local providers — Phase 5 will replace with real wallet/coin providers.
final walletBalanceProvider = StateProvider<int>((ref) => 0);
final matchLoadingProvider = StateProvider<bool>((ref) => false);

class HomePage extends ConsumerStatefulWidget {
  const HomePage({super.key});

  @override
  ConsumerState<HomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<HomePage> {
  StreamSubscription<Envelope>? _envelopeSub;
  Timer? _matchSpinnerTimer;
  // Phase 5: queue position + daily quota info from queue:joined event.
  int? _queuePosition;
  int? _remainingFree;
  int? _charge;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(socketConnectProvider.future);
      _envelopeSub = SocketClient.envelopes.listen(_handleEnvelope);
    });
  }

  @override
  void dispose() {
    _envelopeSub?.cancel();
    _matchSpinnerTimer?.cancel();
    super.dispose();
  }

  void _handleEnvelope(Envelope env) {
    final i18n = t;
    if (env.type == 'match:found') {
      final match = MatchFoundPayload.fromJson(env.payload);
      ref.read(matchLoadingProvider.notifier).state = false;
      context.go('/call', extra: {
        'callId': match.callId,
        'agoraChannel': match.agoraChannel,
        'agoraToken': match.agoraToken,
        'uid': 0,
        'peerId': match.peer.id,
        'peerDisplayName': match.peer.displayName,
      });
    } else if (env.type == 'queue:joined') {
      // Phase 5: server confirms queue position + quota info.
      final p = QueueJoinedPayload.fromJson(env.payload);
      setState(() {
        _queuePosition = p.position;
        _remainingFree = p.remainingFree;
        _charge = p.charge;
      });
    } else if (env.type == 'low_balance') {
      // Phase 5: free quota exhausted + insufficient coins → route to /wallet.
      ref.read(matchLoadingProvider.notifier).state = false;
      final p = LowBalancePayload.fromJson(env.payload);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(i18n.walletLowBalanceNeeded(p.needed)),
          action: SnackBarAction(label: i18n.walletGoToShop, onPressed: () => context.push('/wallet')),
        ),
      );
    }
  }

  void _onMatch() {
    final i18n = t;
    ref.read(matchLoadingProvider.notifier).state = true;
    // Emit queue:join — server matches + emits match:found.
    SocketClient.send('queue:join', {
      'genderFilters': const <String>[],
      'countryFilters': const <String>[],
    });
    // Spinner timeout — if no match in 60s, give up.
    _matchSpinnerTimer?.cancel();
    _matchSpinnerTimer = Timer(const Duration(seconds: 60), () {
      if (!mounted) return;
      ref.read(matchLoadingProvider.notifier).state = false;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(i18n.callMatchTimeout)),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final balance = ref.watch(walletBalanceProvider);
    final matching = ref.watch(matchLoadingProvider);
    final i18n = t;

    return Scaffold(
      backgroundColor: const Color(0xFF0B0B0B),
      appBar: AppBar(
        title: Text(i18n.homeTitle),
        backgroundColor: const Color(0xFF0B0B0B),
        foregroundColor: Colors.white,
        elevation: 0,
        actions: [
          const OnlineCounter(),
          const SizedBox(width: 8),
          const LatencyIndicator(),
          const SizedBox(width: 8),
          IconButton(
            icon: const Icon(Icons.person_outline, color: Colors.white),
            tooltip: i18n.homeProfileButton,
            onPressed: () {
              // Phase 5: route to /profile
            },
          ),
          IconButton(
            icon: const Icon(Icons.tune, color: Colors.white),
            tooltip: i18n.filtersTitle,
            onPressed: () {
              showModalBottomSheet(
                context: context,
                isScrollControlled: true,
                backgroundColor: const Color(0xFF0B0B0B),
                builder: (_) => const FilterSelectionSheet(),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.report_gmailerrorred_outlined, color: Colors.white),
            tooltip: i18n.homeReportsButton,
            onPressed: () {
              // Phase 8: route to /reports
            },
          ),
          IconButton(
            icon: const Icon(Icons.settings_outlined, color: Colors.white),
            tooltip: i18n.homeSettingsButton,
            onPressed: () {
              context.push('/settings');
            },
          ),
        ],
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // Phase 5: wallet balance button — taps to /wallet.
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: InkWell(
                onTap: () => context.push('/wallet'),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1C1C1E),
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.monetization_on, color: Color(0xFFFFCC00)),
                      const SizedBox(width: 8),
                      Text(
                        i18n.homeWalletBalance(balance),
                        style: const TextStyle(color: Colors.white, fontSize: 16),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            // Phase 5: daily quota info.
            if (_remainingFree != null && !matching)
              Padding(
                padding: const EdgeInsets.only(bottom: 32),
                child: Text(
                  _remainingFree! > 0
                      ? i18n.walletDailyQuotaRemaining(_remainingFree!)
                      : i18n.walletDailyQuotaExhausted(_charge ?? 0),
                  style: const TextStyle(color: Colors.white54, fontSize: 12),
                ),
              )
            else
              const SizedBox(height: 32),
            if (_queuePosition != null && matching)
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Text(
                  'Sırada $_queuePosition',
                  style: const TextStyle(color: Colors.white70, fontSize: 14),
                ),
              ),
            SizedBox(
              width: 200,
              height: 64,
              child: FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFFFF3B30),
                  shape: const StadiumBorder(),
                ),
                onPressed: matching ? null : _onMatch,
                child: matching
                    ? Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Text(i18n.homeMatchButtonLoading),
                        ],
                      )
                    : Text(
                        i18n.homeMatchButton,
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                      ),
              ),
            ),
            const SizedBox(height: 24),
            Text(
              matching ? 'Eşleştiriliyor…' : 'Phase 5 — match yap → çağrıya gir',
              style: const TextStyle(color: Colors.white38, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
}
