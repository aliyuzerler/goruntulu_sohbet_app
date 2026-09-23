/// Wallet page — shows balance, daily quota info, transaction history.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/api_client.dart';
import '../../core/network/dto/wallet_dto.dart';
import '../../i18n/strings.dart';
import 'widgets/transaction_tile.dart';

class WalletPage extends ConsumerStatefulWidget {
  const WalletPage({super.key});

  @override
  ConsumerState<WalletPage> createState() => _WalletPageState();
}

class _WalletPageState extends ConsumerState<WalletPage> {
  WalletBalanceDto? _balance;
  final List<TransactionItemDto> _items = [];
  String? _cursor;
  bool _loading = true;
  bool _loadingMore = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final bal = await ApiClient.getWalletBalance();
      final txs = await ApiClient.getTransactions();
      setState(() {
        _balance = bal;
        _items
          ..clear()
          ..addAll(txs.items);
        _cursor = txs.nextCursor;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _loadMore() async {
    if (_cursor == null || _loadingMore) return;
    setState(() => _loadingMore = true);
    try {
      final r = await ApiClient.getTransactions(cursor: _cursor);
      setState(() {
        _items.addAll(r.items);
        _cursor = r.nextCursor;
        _loadingMore = false;
      });
    } catch (_) {
      setState(() => _loadingMore = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final i18n = t;
    return Scaffold(
      backgroundColor: const Color(0xFF0B0B0B),
      appBar: AppBar(
        title: Text(i18n.walletTitle),
        backgroundColor: const Color(0xFF0B0B0B),
        foregroundColor: Colors.white,
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator(color: Colors.white))
            : _error != null
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(_error!, style: const TextStyle(color: Colors.redAccent)),
                        const SizedBox(height: 12),
                        OutlinedButton(
                          onPressed: _load,
                          child: Text(i18n.commonRetry),
                        ),
                      ],
                    ),
                  )
                : ListView(
                    children: [
                      _buildBalanceCard(i18n),
                      const SizedBox(height: 24),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Text(
                          i18n.walletTransactions,
                          style: const TextStyle(color: Colors.white70, fontSize: 14, fontWeight: FontWeight.w600),
                        ),
                      ),
                      const SizedBox(height: 8),
                      if (_items.isEmpty)
                        Padding(
                          padding: const EdgeInsets.all(24),
                          child: Center(
                            child: Text(i18n.walletNoTransactions, style: const TextStyle(color: Colors.white38)),
                          ),
                        )
                      else
                        ..._items.map((tx) => TransactionTile(tx: tx)),
                      if (_cursor != null)
                        Padding(
                          padding: const EdgeInsets.all(16),
                          child: OutlinedButton(
                            onPressed: _loadMore,
                            child: _loadingMore
                                ? const SizedBox(
                                    height: 16,
                                    width: 16,
                                    child: CircularProgressIndicator(strokeWidth: 2),
                                  )
                                : Text(i18n.walletLoadMore),
                          ),
                        ),
                    ],
                  ),
      ),
    );
  }

  Widget _buildBalanceCard(i18n) {
    final balance = _balance?.balance ?? 0;
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFFFCC00), Color(0xFFFF9500)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            i18n.walletBalance,
            style: const TextStyle(color: Colors.white70, fontSize: 12),
          ),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '$balance',
                style: const TextStyle(color: Colors.white, fontSize: 40, fontWeight: FontWeight.bold),
              ),
              const SizedBox(width: 6),
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  balance == 1 ? i18n.walletCoin : i18n.walletCoins,
                  style: const TextStyle(color: Colors.white70, fontSize: 14),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          // Phase 6: "Buy coins" routes to /shop (Google Play IAP).
          OutlinedButton(
            onPressed: () => context.push('/shop'),
            style: OutlinedButton.styleFrom(
              foregroundColor: Colors.white,
              side: const BorderSide(color: Colors.white70),
            ),
            child: Text(i18n.walletGoToShop),
          ),
        ],
      ),
    );
  }
}
