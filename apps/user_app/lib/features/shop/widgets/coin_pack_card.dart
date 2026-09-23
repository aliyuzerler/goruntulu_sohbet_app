/// Coin pack card — single purchasable item in the shop.
/// Shows coins count, price label, optional "Popular"/"Best value" badge,
/// and a buy button (or spinner if currently purchasing).

import 'package:flutter/material.dart';
import '../../../core/network/dto/billing_dto.dart';
import '../../../i18n/strings.dart';

class CoinPackCard extends StatelessWidget {
  final CoinPackDto pack;
  final String? badge;
  final bool isProcessing;
  final VoidCallback onBuy;

  const CoinPackCard({
    super.key,
    required this.pack,
    this.badge,
    this.isProcessing = false,
    required this.onBuy,
  });

  @override
  Widget build(BuildContext context) {
    final i18n = t;
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1C1C1E),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: badge != null ? const Color(0xFFFFCC00) : Colors.white12,
          width: badge != null ? 1.5 : 1,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: const Color(0xFFFFCC00).withOpacity(0.15),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.monetization_on, color: Color(0xFFFFCC00), size: 28),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      '${pack.coins} ${pack.coins == 1 ? i18n.walletCoin : i18n.walletCoins}',
                      style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    if (badge != null) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFCC00),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          badge!,
                          style: const TextStyle(color: Colors.black, fontSize: 10, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  pack.displayPriceLabel,
                  style: const TextStyle(color: Colors.white54, fontSize: 13),
                ),
              ],
            ),
          ),
          FilledButton(
            onPressed: isProcessing ? null : onBuy,
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFFF3B30),
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            ),
            child: isProcessing
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : Text(i18n.shopBuy),
          ),
        ],
      ),
    );
  }
}
