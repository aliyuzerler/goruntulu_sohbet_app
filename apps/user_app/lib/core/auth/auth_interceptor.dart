/// Dio interceptor for JWT auth — adds Authorization header + auto-refresh
/// on 401. Refresh requests are queued so we don't fire N concurrent refreshes.
///
/// Flow:
///   1. Request goes out with `Authorization: Bearer <access>`.
///   2. If 401 → take refresh lock → POST /auth/refresh → save new tokens →
///      retry original request.
///   3. If refresh fails → clear tokens + route to /login.

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../config/env.dart';
import '../constants/app_constants.dart';
import 'token_store.dart';

class AuthInterceptor extends Interceptor {
  AuthInterceptor._();

  static bool _refreshing = false;
  static final List<void Function(String accessToken)> _queue = [];

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    // Skip auth header for /auth/* endpoints (login, refresh).
    if (options.path.startsWith('/auth/')) {
      return handler.next(options);
    }
    final access = await TokenStore.access;
    if (access != null && access.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $access';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    final req = err.requestOptions;
    final status = err.response?.statusCode;
    if (status != AppConstants.httpUnauthorized) {
      return handler.next(err);
    }
    // 401 → try refresh once.
    final refresh = await TokenStore.refresh;
    if (refresh == null || refresh.isEmpty) {
      await _clearAndRoute();
      return handler.next(err);
    }

    // If already refreshing, queue.
    if (_refreshing) {
      _queue.add((newAccess) {
        req.headers['Authorization'] = 'Bearer $newAccess';
        // Re-issue the original request via the dio instance.
        _retry(req).then((r) => handler.resolve(r)).catchError((e) {
          handler.next(e as DioException);
        });
      });
      return;
    }

    _refreshing = true;
    try {
      final dio = Dio(BaseOptions(baseUrl: Env.apiBaseUrl));
      final r = await dio.post<dynamic>(
        '/auth/refresh',
        data: {'refreshToken': refresh},
      );
      if (r.statusCode != 200) {
        await _clearAndRoute();
        return handler.next(err);
      }
      final data = r.data as Map<String, dynamic>;
      await TokenStore.save(
        accessToken: data['accessToken'] as String,
        refreshToken: data['refreshToken'] as String,
        refreshTokenId: data['refreshTokenId'] as String?,
      );
      // Retry the original request with the new token.
      req.headers['Authorization'] = 'Bearer ${data['accessToken']}';
      final retry = await _retry(req);
      // Drain the queue.
      _refreshing = false;
      final queued = List<void Function(String)>.from(_queue);
      _queue.clear();
      for (final cb in queued) {
        cb(data['accessToken'] as String);
      }
      return handler.resolve(retry);
    } catch (e) {
      debugPrint('Auth refresh failed: $e');
      await _clearAndRoute();
      return handler.next(err);
    } finally {
      _refreshing = false;
    }
  }

  /// Re-issue a request with the same options (used after token refresh).
  static Future<Response<dynamic>> _retry(RequestOptions req) async {
    final dio = Dio(BaseOptions(baseUrl: Env.apiBaseUrl));
    return dio.fetch<dynamic>(req);
  }

  static Future<void> _clearAndRoute() async {
    await TokenStore.clear();
    // The router listens to authProvider — when tokens clear, it routes to /login.
    // We don't navigate from here directly to keep concerns separated.
  }
}
