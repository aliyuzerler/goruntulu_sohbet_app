/// AuthProvider — Riverpod StateNotifier.
/// Manages: login, refresh, logout, current user snapshot.
/// Persists tokens to flutter_secure_storage via TokenStore.
///
/// UI:
///   ref.watch(authProvider) → AuthState.unauthenticated / authenticated / loading
///   ref.read(authProvider.notifier).loginWithPhone(phone, otp)
///   ref.read(authProvider.notifier).loginWithGoogle(idToken)
///   ref.read(authProvider.notifier).logout()

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/api_client.dart';
import '../../core/network/dio_client.dart';
import '../../core/network/dto/auth_dto.dart';
import '../../core/auth/token_store.dart';

sealed class AuthState {
  const AuthState();
}
class AuthInitial extends AuthState { const AuthInitial(); }
class AuthLoading extends AuthState { const AuthLoading(); }
class Authenticated extends AuthState {
  final AuthUserDto user;
  const Authenticated(this.user);
}
class Unauthenticated extends AuthState { const Unauthenticated(); }
class AuthError extends AuthState {
  final String message;
  const AuthError(this.message);
}

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier() : super(const AuthInitial());

  /// Called on app start — checks if tokens are present.
  /// If yes, fetches /me to validate them. If 401, AuthInterceptor refreshes
  /// once and retries. If refresh fails too, falls back to Unauthenticated.
  Future<void> bootstrap() async {
    final access = await TokenStore.access;
    if (access == null || access.isEmpty) {
      state = const Unauthenticated();
      return;
    }
    state = const AuthLoading();
    try {
      final me = await ApiClient.getMe();
      state = Authenticated(AuthUserDto(
        id: me.id,
        role: me.role,
        profileCompleted: me.profileCompleted,
      ));
    } catch (e) {
      state = const Unauthenticated();
    }
  }

  /// Login with phone OTP — bypass mode sends any OTP for whitelisted phones.
  Future<void> loginWithPhone({required String phone, required String otp}) async {
    state = const AuthLoading();
    try {
      final res = await DioClient.instance.post<dynamic>(
        '/auth/verify-phone',
        data: {'idToken': otp, 'phone': phone},
      );
      final data = res.data as Map<String, dynamic>;
      final dto = AuthResponseDto.fromJson(data);
      await TokenStore.save(
        accessToken: dto.accessToken,
        refreshToken: dto.refreshToken,
        refreshTokenId: dto.refreshTokenId,
      );
      state = Authenticated(dto.user);
    } catch (e) {
      state = AuthError(e.toString());
    }
  }

  /// Login with Google Sign-In — bypass mode sends the idToken string as-is.
  Future<void> loginWithGoogle({required String idToken}) async {
    state = const AuthLoading();
    try {
      final res = await DioClient.instance.post<dynamic>(
        '/auth/verify-google',
        data: {'idToken': idToken},
      );
      final data = res.data as Map<String, dynamic>;
      final dto = AuthResponseDto.fromJson(data);
      await TokenStore.save(
        accessToken: dto.accessToken,
        refreshToken: dto.refreshToken,
        refreshTokenId: dto.refreshTokenId,
      );
      state = Authenticated(dto.user);
    } catch (e) {
      state = AuthError(e.toString());
    }
  }

  Future<void> logout() async {
    final refresh = await TokenStore.refresh;
    if (refresh != null) {
      try {
        await DioClient.instance.post<dynamic>('/auth/logout', data: {'refreshToken': refresh});
      } catch (_) {}
    }
    await TokenStore.clear();
    state = const Unauthenticated();
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier();
});

final meProvider = FutureProvider<MeDto>((ref) async {
  // Watch auth state so me is refetched when user logs in.
  ref.watch(authProvider);
  return ApiClient.getMe();
});
