/// Phase 7: VIP + Filter DTOs — mirror the server's API responses.

class VerifySubscriptionResponseDto {
  final String status;
  final DateTime? expiresAt;
  final String? productId;
  final bool alreadyProcessed;

  const VerifySubscriptionResponseDto({
    required this.status,
    required this.expiresAt,
    required this.productId,
    required this.alreadyProcessed,
  });

  factory VerifySubscriptionResponseDto.fromJson(Map<String, dynamic> json) {
    return VerifySubscriptionResponseDto(
      status: json['status'] as String,
      expiresAt: json['expiresAt'] != null ? DateTime.parse(json['expiresAt'] as String) : null,
      productId: json['productId'] as String?,
      alreadyProcessed: json['alreadyProcessed'] as bool,
    );
  }
}

class EntitlementStatusDto {
  final String? status;
  final DateTime? expiresAt;
  final bool isActive;

  const EntitlementStatusDto({
    required this.status,
    required this.expiresAt,
    required this.isActive,
  });

  factory EntitlementStatusDto.fromJson(Map<String, dynamic> json) {
    return EntitlementStatusDto(
      status: json['status'] as String?,
      expiresAt: json['expiresAt'] != null ? DateTime.parse(json['expiresAt'] as String) : null,
      isActive: json['isActive'] as bool,
    );
  }
}

class ActivateCountryFilterResponseDto {
  final String type;
  final String value;
  final DateTime expiresAt;
  final int coinsSpent;
  final bool isVipGrant;
  final int newBalance;

  const ActivateCountryFilterResponseDto({
    required this.type,
    required this.value,
    required this.expiresAt,
    required this.coinsSpent,
    required this.isVipGrant,
    required this.newBalance,
  });

  factory ActivateCountryFilterResponseDto.fromJson(Map<String, dynamic> json) {
    return ActivateCountryFilterResponseDto(
      type: json['type'] as String,
      value: json['value'] as String,
      expiresAt: DateTime.parse(json['expiresAt'] as String),
      coinsSpent: (json['coinsSpent'] as num).toInt(),
      isVipGrant: json['isVipGrant'] as bool,
      newBalance: (json['newBalance'] as num).toInt(),
    );
  }
}

class ActiveFiltersDto {
  final String? country;
  final bool genderAllowed;
  final bool vipActive;
  final DateTime? vipExpiresAt;

  const ActiveFiltersDto({
    required this.country,
    required this.genderAllowed,
    required this.vipActive,
    required this.vipExpiresAt,
  });

  factory ActiveFiltersDto.fromJson(Map<String, dynamic> json) {
    final vip = json['vip'] as Map<String, dynamic>?;
    return ActiveFiltersDto(
      country: json['country'] as String?,
      genderAllowed: json['genderAllowed'] as bool,
      vipActive: vip?['isActive'] as bool? ?? false,
      vipExpiresAt: vip?['expiresAt'] != null
          ? DateTime.parse(vip!['expiresAt'] as String)
          : null,
    );
  }
}
