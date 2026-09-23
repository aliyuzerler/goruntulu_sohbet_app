/// Dio-based HTTP client — single shared instance for the user app.
/// Phase 2: JWT interceptor with refresh rotation + auto-retry on 401.

import 'package:dio/dio.dart';
import '../config/env.dart';
import '../auth/auth_interceptor.dart';

class DioClient {
  DioClient._();

  /// Singleton Dio — built lazily on first access.
  static Dio? _instance;
  static Dio get instance {
    if (_instance != null) return _instance!;
    final d = Dio(
      BaseOptions(
        baseUrl: Env.apiBaseUrl,
        connectTimeout: const Duration(seconds: 8),
        receiveTimeout: const Duration(seconds: 10),
        sendTimeout: const Duration(seconds: 8),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Client-Name': 'randchat-user-app',
          'X-Client-Version': '0.1.0',
        },
        validateStatus: (status) => status != null && status >= 200 && status < 400,
      ),
    );

    d.interceptors.add(AuthInterceptor());
    // Dev logging — verbose but useful.
    if (Env.appEnv == 'dev' || Env.appEnv == 'staging') {
      d.interceptors.add(LogInterceptor(requestBody: true, responseBody: true));
    }

    _instance = d;
    return d;
  }
}
