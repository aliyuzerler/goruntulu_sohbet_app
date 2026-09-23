/// Transaction tile — single row in the wallet history list.

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/network/dto/wallet_dto.dart';
import '../../../i18n/strings.dart';

class TransactionTile extends StatelessWidget {
  final TransactionItemDto tx;
  const TransactionTile({super.key, required this.tx});

  @override
  Widget build(BuildContext context) {
    final isCredit = tx.amount > 0;
    final typeLabel = _typeLabel(tx.type);
    return ListTile(
      leading: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: isCredit ? const Color(0xFF34C759) : const Color(0xFFFF3B30),
          shape: BoxShape.circle,
        ),
        child: Icon(
          isCredit ? Icons.add : Icons.remove,
          color: Colors.white,
          size: 20,
        ),
      ),
      title: Text(
        typeLabel,
        style: const TextStyle(color: Colors.white, fontSize: 14),
      ),
      subtitle: Text(
        DateFormat('yyyy-MM-dd HH:mm').format(tx.createdAt.toLocal()),
        style: const TextStyle(color: Colors.white38, fontSize: 12),
      ),
      trailing: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(
            '${isCredit ? '+' : ''}${tx.amount}',
            style: TextStyle(
              color: isCredit ? const Color(0xFF34C759) : const Color(0xFFFF3B30),
              fontWeight: FontWeight.bold,
              fontSize: 16,
            ),
          ),
          Text(
            '→ ${tx.balanceAfter}',
            style: const TextStyle(color: Colors.white38, fontSize: 11),
          ),
        ],
      ),
    );
  }

  String _typeLabel(String type) {
    final i18n = t;
    switch (type) {
      case 'PURCHASE':
        return i18n.walletTypePurchase;
      case 'SPEND_MATCH':
        return i18n.walletTypeSpendMatch;
      case 'SPEND_GIFT':
        return i18n.walletTypeSpendGift;
      case 'SPEND_FILTER':
        return i18n.walletTypeSpendFilter;
      case 'REFUND':
        return i18n.walletTypeRefund;
      case 'ADJUSTMENT':
        return i18n.walletTypeAdjustment;
      default:
        return type;
    }
  }
}
