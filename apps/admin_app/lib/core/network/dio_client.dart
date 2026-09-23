import 'package:dio/dio.dart';
import '../config/env.dart';

class DioClient {
  DioClient._();

  static Dio? _instance;
  static Dio get instance {
    if (_instance != null) return _instance!;
    final d = Dio(
      BaseOptions(
        baseUrl: Env.apiBaseUrl,
        connectTimeout: const Duration(seconds: 8),
        receiveTimeout: const Duration(seconds: 10),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Client-Name': 'randchat-admin-app',
          'X-Client-Version': '0.1.0',
        },
        validateStatus: (status) => status != null && status >= 200 && status < 400,
      ),
    );
    // Admin app — also log in dev/staging.
    if (Env.appEnv == 'dev' || Env.appEnv == 'staging') {
      d.interceptors.add(LogInterceptor(requestBody: true, responseBody: true));
    }
    _instance = d;
    return d;
  }
}
