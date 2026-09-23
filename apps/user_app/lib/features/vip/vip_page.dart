/// VIP page — Phase 7. Shows VIP benefits + subscribe button (Play subscription).
/// On subscribe success → verify-subscription → EntitlementService creates row.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import '../../core/billing/in_app_purchase_service.dart';
import '../../core/network/api_client.dart';
import '../../core/network/dto/vip_filter_dto.dart';
import '../../i18n/strings.dart';

class VipPage extends ConsumerStatefulWidget {
  const VipPage({super.key});

  @override
  ConsumerState<VipPage> createState() => _VipPageState();
}

class _VipPageState extends ConsumerState<VipPage> {
  EntitlementStatusDto? _status;
  bool _loading = true;
  bool _subscribing = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    try {
      final s = await ApiClient.getVipStatus();
      setState(() {
        _status = s;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _onSubscribe() async {
    setState(() {
      _subscribing = true;
      _error = null;
    });
    final ok = await InAppPurchase.instance.isAvailable();
    if (!ok) {
      // Dev bypass — synthesize a fake subscription token.
      try {
        final res = await ApiClient.verifySubscription(
          purchaseToken: 'dev_sub_token_${DateTime.now().millisecondsSinceEpoch}',
        );
        setState(() => _subscribing = false);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(t.vipSubscribeSuccess)),
          );
          _load();
        }
      } catch (e) {
        setState(() {
          _subscribing = false;
          _error = e.toString();
        });
      }
      return;
    }
    // Query the vip_monthly product + buy.
    const productId = 'vip_monthly';
    final res = await InAppPurchase.instance.queryProductDetails({productId});
    if (res.productDetails.isEmpty) {
      setState(() {
        _subscribing = false;
        _error = 'VIP product not found in store';
      });
      return;
    }
    final pd = res.productDetails.first;
    final param = PurchaseParam(productDetails: pd);
    await InAppPurchase.instance.buyNonConsumable(purchaseParam: param);
    // The purchaseStream listener (initialized by ShopPage or here) handles
    // the verification. For Phase 7 we just listen once.
    InAppPurchaseService.instance.initialize();
    setState(() => _subscribing = false);
  }

  @override
  Widget build(BuildContext context) {
    final i18n = t;
    final isActive = _status?.isActive ?? false;
    return Scaffold(
      backgroundColor: const Color(0xFF0B0B0B),
      appBar: AppBar(
        title: Text(i18n.vipTitle),
        backgroundColor: const Color(0xFF0B0B0B),
        foregroundColor: Colors.white,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Colors.white))
          : ListView(
              children: [
                // Header
                Container(
                  padding: const EdgeInsets.all(32),
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      colors: [Color(0xFFFFCC00), Color(0xFFFF9500)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                  child: Column(
                    children: [
                      const Icon(Icons.star, color: Colors.white, size: 56),
                      const SizedBox(height: 12),
                      Text(
                        i18n.vipTitle,
                        style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        i18n.vipSubtitle,
                        style: const TextStyle(color: Colors.white70, fontSize: 14),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
                if (isActive && _status?.expiresAt != null)
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1C1C1E),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFF34C759)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.check_circle, color: Color(0xFF34C759)),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              '${i18n.vipActive} — ${i18n.vipExpiresOn(
                                '${_status!.expiresAt!.day}.${_status!.expiresAt!.month}.${_status!.expiresAt!.year}',
                              )}',
                              style: const TextStyle(color: Colors.white),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                // Benefits
                _BenefitTile(
                  icon: Icons.person_search,
                  title: i18n.vipBenefit1Title,
                  body: i18n.vipBenefit1Body,
                ),
                _BenefitTile(
                  icon: Icons.public,
                  title: i18n.vipBenefit2Title,
                  body: i18n.vipBenefit2Body,
                ),
                _BenefitTile(
                  icon: Icons.verified,
                  title: i18n.vipBenefit3Title,
                  body: i18n.vipBenefit3Body,
                ),
                _BenefitTile(
                  icon: Icons.priority_high,
                  title: i18n.vipBenefit4Title,
                  body: i18n.vipBenefit4Body,
                ),
                const SizedBox(height: 24),
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Text(_error!, style: const TextStyle(color: Colors.redAccent)),
                  ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: FilledButton(
                    onPressed: _subscribing
                        ? null
                        : isActive
                            ? null
                            : _onSubscribe,
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFFFFCC00),
                      foregroundColor: Colors.black,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                    child: _subscribing
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                          )
                        : Text(
                            isActive ? i18n.vipActive : i18n.vipSubscribeCta('\$9.99/ay'),
                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                          ),
                  ),
                ),
                if (isActive)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: OutlinedButton(
                      onPressed: () {
                        // Phase 7: open Play Store subscription management.
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Open Play Store → Subscriptions to manage')),
                        );
                      },
                      child: Text(i18n.vipManageSubscription, style: const TextStyle(color: Colors.white54)),
                    ),
                  ),
              ],
            ),
    );
  }
}

class _BenefitTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String body;
  const _BenefitTile({required this.icon, required this.title, required this.body});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Container(
        width: 40,
        height: 40,
        decoration: const BoxDecoration(
          color: Color(0xFFFFCC00),
          shape: BoxShape.circle,
        ),
        child: Icon(icon, color: Colors.black, size: 20),
      ),
      title: Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
      subtitle: Text(body, style: const TextStyle(color: Colors.white54, fontSize: 13)),
    );
  }
}
