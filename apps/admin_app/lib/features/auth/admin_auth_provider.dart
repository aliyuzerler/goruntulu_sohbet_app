/// Admin auth state — Riverpod StateNotifier.
/// Calls /api/auth/admin/login (email + password) → short-lived JWT.

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/dio_client.dart';
import '../../core/auth/token_store.dart';

sealed class AdminAuthState {
  const AdminAuthState();
}
class AdminAuthInitial extends AdminAuthState { const AdminAuthInitial(); }
class AdminAuthLoading extends AdminAuthState { const AdminAuthLoading(); }
class AdminAuthenticated extends AdminAuthState {
  final String id;
  final String role;
  final String email;
  const AdminAuthenticated({required this.id, required this.role, required this.email});
}
class AdminUnauthenticated extends AdminAuthState { const AdminUnauthenticated(); }
class AdminAuthError extends AdminAuthState {
  final String message;
  const AdminAuthError(this.message);
}

class AdminAuthNotifier extends StateNotifier<AdminAuthState> {
  AdminAuthNotifier() : super(const AdminAuthInitial());

  Future<void> bootstrap() async {
    final t = await AdminTokenStore.access;
    if (t == null || t.isEmpty) {
      state = const AdminUnauthenticated();
      return;
    }
    // We don't have a /me endpoint for admin yet (Phase 8 adds /admin/me).
    // For Phase 2 we just trust the token's presence — admin app is internal.
    state = const AdminAuthenticated(id: '', role: 'ADMIN', email: '');
  }

  Future<void> login({required String email, required String password}) async {
    state = const AdminAuthLoading();
    try {
      final res = await DioClient.instance.post<dynamic>(
        '/auth/admin/login',
        data: {'email': email, 'password': password},
      );
      final data = res.data as Map<String, dynamic>;
      final token = data['accessToken'] as String;
      await AdminTokenStore.save(token);
      final user = data['user'] as Map<String, dynamic>;
      state = AdminAuthenticated(
        id: user['id'] as String,
        role: user['role'] as String,
        email: user['email'] as String,
      );
    } on DioException catch (e) {
      final msg = (e.response?.data is Map)
          ? ((e.response?.data as Map)['message'] as String?) ?? e.message
          : e.message;
      state = AdminAuthError(msg ?? 'Login failed');
    } catch (e) {
      state = AdminAuthError(e.toString());
    }
  }

  Future<void> logout() async {
    await AdminTokenStore.clear();
    state = const AdminUnauthenticated();
  }
}

final adminAuthProvider =
    StateNotifierProvider<AdminAuthNotifier, AdminAuthState>((ref) {
  return AdminAuthNotifier();
});
