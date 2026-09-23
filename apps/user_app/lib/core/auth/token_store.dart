/// JWT token store — flutter_secure_storage backed.
/// Keys: rc_access_token, rc_refresh_token, rc_refresh_token_id.
/// All values are opaque strings — no parsing on the client side beyond
/// expiry check (which we don't even do; the server is the source of truth).

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class TokenStore {
  TokenStore._();

  static const _accessKey = 'rc_access_token';
  static const _refreshKey = 'rc_refresh_token';
  static const _refreshIdKey = 'rc_refresh_token_id';

  static final FlutterSecureStorage _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  static Future<String?> get access => _storage.read(key: _accessKey);
  static Future<String?> get refresh => _storage.read(key: _refreshKey);
  static Future<String?> get refreshId => _storage.read(key: _refreshIdKey);

  static Future<void> save({
    required String accessToken,
    required String refreshToken,
    String? refreshTokenId,
  }) async {
    await _storage.write(key: _accessKey, value: accessToken);
    await _storage.write(key: _refreshKey, value: refreshToken);
    if (refreshTokenId != null) {
      await _storage.write(key: _refreshIdKey, value: refreshTokenId);
    }
  }

  static Future<void> clear() async {
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
    await _storage.delete(key: _refreshIdKey);
  }
}
