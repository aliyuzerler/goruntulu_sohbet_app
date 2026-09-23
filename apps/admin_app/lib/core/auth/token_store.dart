/// JWT token store for admin app — only stores the access token since
/// admin login returns no refresh token (admin tokens are short-lived 15 min).

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AdminTokenStore {
  AdminTokenStore._();
  static const _accessKey = 'rc_admin_access';
  static final _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  static Future<String?> get access => _storage.read(key: _accessKey);
  static Future<void> save(String token) => _storage.write(key: _accessKey, value: token);
  static Future<void> clear() => _storage.delete(key: _accessKey);
}
