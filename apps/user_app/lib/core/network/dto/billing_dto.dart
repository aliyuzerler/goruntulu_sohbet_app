/// Phase 6: Billing DTOs — coin pack + verify-purchase response.

class CoinPackDto {
  final String productId;
  final int coins;
  final String displayPriceLabel;

  const CoinPackDto({
    required this.productId,
    required this.coins,
    required this.displayPriceLabel,
  });

  factory CoinPackDto.fromJson(Map<String, dynamic> json) {
    return CoinPackDto(
      productId: json['productId'] as String,
      coins: (json['coins'] as num).toInt(),
      displayPriceLabel: json['displayPriceLabel'] as String,
    );
  }
}

class ProductsListDto {
  final List<CoinPackDto> products;
  const ProductsListDto({required this.products});

  factory ProductsListDto.fromJson(Map<String, dynamic> json) {
    final list = (json['products'] as List?) ?? [];
    return ProductsListDto(
      products: list.map((e) => CoinPackDto.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }
}

class VerifyPurchaseResponseDto {
  final String orderId;
  final String productId;
  final int coinsCredited;
  final String status;
  final int newBalance;
  final bool alreadyProcessed;

  const VerifyPurchaseResponseDto({
    required this.orderId,
    required this.productId,
    required this.coinsCredited,
    required this.status,
    required this.newBalance,
    required this.alreadyProcessed,
  });

  factory VerifyPurchaseResponseDto.fromJson(Map<String, dynamic> json) {
    return VerifyPurchaseResponseDto(
      orderId: json['orderId'] as String,
      productId: json['productId'] as String,
      coinsCredited: (json['coinsCredited'] as num).toInt(),
      status: json['status'] as String,
      newBalance: (json['newBalance'] as num).toInt(),
      alreadyProcessed: json['alreadyProcessed'] as bool,
    );
  }
}
