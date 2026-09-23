/// App-level Riverpod providers — Phase 1: only health check + retry state.
/// Phase 2 will add auth providers, JWT token store, etc.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/network/api_client.dart';
import '../core/network/dto/health_dto.dart';
import '../core/constants/app_constants.dart';

/// Result wrapper for splash's health check UI.
sealed class HealthCheckResult {
  const HealthCheckResult();
}

class HealthCheckLoading extends HealthCheckResult {
  const HealthCheckLoading();
}

class HealthCheckOk extends HealthCheckResult {
  final HealthResponseDto health;
  const HealthCheckOk(this.health);
}

class HealthCheckError extends HealthCheckResult {
  final String message;
  const HealthCheckError(this.message);
}

/// StateNotifier that drives the splash screen's retry loop.
class HealthCheckNotifier extends StateNotifier<HealthCheckResult> {
  int _attempt = 0;

  HealthCheckNotifier() : super(const HealthCheckLoading());

  Future<void> check() async {
    state = const HealthCheckLoading();
    try {
      final h = await ApiClient.checkHealth();
      if (h.components.allUp) {
        state = HealthCheckOk(h);
      } else {
        state = HealthCheckError('Components not all up');
      }
    } catch (e) {
      final backoffList = AppConstants.splashRetryBackoffSeconds;
      final wait = backoffList[_attempt.clamp(0, backoffList.length - 1)];
      _attempt += 1;
      state = HealthCheckError(e.toString());
      // Retry backoff is handled by the UI via a delayed re-check call.
      // We don't auto-retry from here to keep the notifier simple and testable.
      await Future<void>.delayed(Duration(seconds: wait));
      // After delay, the UI will trigger another check() which flips state back to Loading.
    }
  }

  Future<void> retry() async {
    _attempt = 0;
    await check();
  }
}

final healthCheckProvider =
    StateNotifierProvider<HealthCheckNotifier, HealthCheckResult>(
  (ref) => HealthCheckNotifier(),
);
