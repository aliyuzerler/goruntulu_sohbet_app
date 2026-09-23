/// Wallet-related DTOs — mirror the server's WalletService responses.

class WalletBalanceDto {
  final int balance;
  final String currency;
  const WalletBalanceDto({required this.balance, required this.currency});
  factory WalletBalanceDto.fromJson(Map<String, dynamic> json) =>
      WalletBalanceDto(balance: json['balance'] as int, currency: json['currency'] as String);
}

class TransactionItemDto {
  final String id;
  final String type;
  final int amount;
  final int balanceAfter;
  final String? reference;
  final DateTime createdAt;

  const TransactionItemDto({
    required this.id,
    required this.type,
    required this.amount,
    required this.balanceAfter,
    required this.reference,
    required this.createdAt,
  });

  factory TransactionItemDto.fromJson(Map<String, dynamic> json) {
    return TransactionItemDto(
      id: json['id'] as String,
      type: json['type'] as String,
      amount: (json['amount'] as num).toInt(),
      balanceAfter: (json['balanceAfter'] as num).toInt(),
      reference: json['reference'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}

class TransactionListDto {
  final List<TransactionItemDto> items;
  final String? nextCursor;
  const TransactionListDto({required this.items, required this.nextCursor});
  factory TransactionListDto.fromJson(Map<String, dynamic> json) {
    final list = (json['items'] as List?) ?? [];
    return TransactionListDto(
      items: list.map((e) => TransactionItemDto.fromJson(e as Map<String, dynamic>)).toList(),
      nextCursor: json['nextCursor'] as String?,
    );
  }
}

/// Phase 5: low_balance event payload from server.
class LowBalancePayload {
  final String? callId;
  final int needed;
  final int remainingFree;
  const LowBalancePayload({this.callId, required this.needed, required this.remainingFree});
  factory LowBalancePayload.fromJson(Map<String, dynamic> json) {
    return LowBalancePayload(
      callId: json['callId'] as String?,
      needed: (json['needed'] as num).toInt(),
      remainingFree: (json['remainingFree'] as num).toInt(),
    );
  }
}

/// Phase 5: queue:joined payload — includes position + charge + remainingFree.
class QueueJoinedPayload {
  final int position;
  final int charge;
  final int remainingFree;
  final String ts;
  const QueueJoinedPayload({
    required this.position,
    required this.charge,
    required this.remainingFree,
    required this.ts,
  });
  factory QueueJoinedPayload.fromJson(Map<String, dynamic> json) {
    return QueueJoinedPayload(
      position: (json['position'] as num).toInt(),
      charge: (json['charge'] as num).toInt(),
      remainingFree: (json['remainingFree'] as num).toInt(),
      ts: json['ts'] as String,
    );
  }
}
