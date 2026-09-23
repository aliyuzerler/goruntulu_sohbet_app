/// Shop page — Phase 6. Lists 4 coin pack cards; tapping buys via IAP.
/// On verify-purchase success → SnackBar → user goes back to /wallet or /home.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/billing/in_app_purchase_service.dart';
import '../../core/network/api_client.dart';
import '../../core/network/dto/billing_dto.dart';
import '../../i18n/strings.dart';
import 'widgets/coin_pack_card.dart';

class ShopPage extends ConsumerStatefulWidget {
  const ShopPage({super.key});

  @override
  ConsumerState<ShopPage> createState() => _ShopPageState();
}

class _ShopPageState extends ConsumerState<ShopPage> {
  List<CoinPackDto> _packs = [];
  bool _loading = true;
  String? _error;
  String? _processingId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadPacks());
  }

  @override
  void dispose() {
    super.dispose();
  }

  Future<void> _loadPacks() async {
    try {
      final products = await ApiClient.listProducts();
      setState(() {
        _packs = products.products;
        _loading = false;
      });
      await InAppPurchaseService.instance.initialize();
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  void _onBuy(CoinPackDto pack) async {
    setState(() => _processingId = pack.productId);
    await InAppPurchaseService.instance.buyPack(pack);
  }

  @override
  Widget build(BuildContext context) {
    final i18n = t;
    return Scaffold(
      backgroundColor: const Color(0xFF0B0B0B),
      appBar: AppBar(
        title: Text(i18n.shopTitle),
        backgroundColor: const Color(0xFF0B0B0B),
        foregroundColor: Colors.white,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Colors.white))
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(_error!, style: const TextStyle(color: Colors.redAccent)),
                      const SizedBox(height: 12),
                      OutlinedButton(
                        onPressed: _loadPacks,
                        child: Text(i18n.commonRetry),
                      ),
                    ],
                  ),
                )
              : ListView(
                  children: [
                    ..._packs.asMap().entries.map((entry) {
                      final idx = entry.key;
                      final pack = entry.value;
                      // Medium = "Popular" badge; Mega = "Best value" badge.
                      final badge = idx == 1
                          ? i18n.shopPopularBadge
                          : idx == 3
                              ? i18n.shopBestValueBadge
                              : null;
                      return CoinPackCard(
                        pack: pack,
                        badge: badge,
                        isProcessing: _processingId == pack.productId,
                        onBuy: () => _onBuy(pack),
                      );
                    }),
                    const SizedBox(height: 24),
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: OutlinedButton.icon(
                        onPressed: () async {
                          await InAppPurchase.instance.restorePurchases();
                        },
                        icon: const Icon(Icons.refresh, color: Colors.white54),
                        label: Text(i18n.shopRestorePurchases,
                            style: const TextStyle(color: Colors.white54)),
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: Colors.white12),
                        ),
                      ),
                    ),
                  ],
                ),
    );
  }
}
