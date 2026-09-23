/// RemoteConfigService — fetches remote config from /api/remote-config on app boot.
/// Used for:
///   1. Forced update gate (compare minAppVersion with current app version)
///   2. Global matching kill switch (show banner if globalMatchingOff=true)
///   3. Economy knobs (dailyFreeQuota, coinCostPerMatch — override server defaults)

import 'package:dio/dio.dart';
import '../config/env.dart';
import '../network/dio_client.dart';

class RemoteConfigDto {
  final String minAppVersion;
  final bool globalMatchingOff;
  final int dailyFreeQuota;
  final int coinCostPerMatch;

  const RemoteConfigDto({
    required this.minAppVersion,
    required this.globalMatchingOff,
    required this.dailyFreeQuota,
    required this.coinCostPerMatch,
  });

  factory RemoteConfigDto.fromJson(Map<String, dynamic> json) {
    return RemoteConfigDto(
      minAppVersion: json['minAppVersion'] as String,
      globalMatchingOff: json['globalMatchingOff'] as bool,
      dailyFreeQuota: (json['dailyFreeQuota'] as num).toInt(),
      coinCostPerMatch: (json['coinCostPerMatch'] as num).toInt(),
    );
  }
}

class RemoteConfigService {
  RemoteConfigService._();

  static RemoteConfigDto? _cached;

  /// Fetch the public config subset. No JWT needed — public endpoint.
  static Future<RemoteConfigDto> fetch() async {
    // Use a fresh Dio (no auth interceptor needed — public endpoint).
    final dio = Dio(BaseOptions(
      baseUrl: Env.apiBaseUrl,
      connectTimeout: const Duration(seconds: 5),
      receiveTimeout: const Duration(seconds: 5),
    ));
    final res = await dio.get<dynamic>('/remote-config');
    _cached = RemoteConfigDto.fromJson(res.data as Map<String, dynamic>);
    return _cached!;
  }

  static RemoteConfigDto? get cached => _cached;

  /// Compare semantic version strings.
  /// Returns true if `current` is below `minimum` → forced update required.
  static bool isVersionBelow(String current, String minimum) {
    final curParts = current.split('.').map((p) => int.tryParse(p) ?? 0).toList();
    final minParts = minimum.split('.').map((p) => int.tryParse(p) ?? 0).toList();
    for (var i = 0; i < minParts.length; i++) {
      final c = i < curParts.length ? curParts[i] : 0;
      if (c < minParts[i]) return true;
      if (c > minParts[i]) return false;
    }
    return false;
  }
}
