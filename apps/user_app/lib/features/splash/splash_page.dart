/// Splash page — Phase 2: boots the app by hitting /api/health + auth bootstrap.
/// On success: routes to either /login (no tokens) or /home (authenticated user
/// with completed profile) or /profile-setup (authenticated, profile incomplete).
/// On failure: shows retry countdown.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../i18n/strings.dart';
import '../app/app_providers.dart';
import '../auth/auth_provider.dart';
import '../core/constants/app_constants.dart';

class SplashPage extends ConsumerStatefulWidget {
  const SplashPage({super.key});

  @override
  ConsumerState<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends ConsumerState<SplashPage> {
  int _retryIn = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _kick());
  }

  Future<void> _kick() async {
    setState(() => _retryIn = 0);
    await ref.read(healthCheckProvider.notifier).check();
    if (!mounted) return;
    final state = ref.read(healthCheckProvider);
    if (state is HealthCheckOk) {
      // Bootstrap auth — check tokens, fetch /me.
      await ref.read(authProvider.notifier).bootstrap();
      final auth = ref.read(authProvider);
      // Wait a moment for the splash to be visible.
      await Future<void>.delayed(AppConstants.splashMinDuration);
      if (!mounted) return;
      if (auth is Authenticated) {
        if (auth.user.profileCompleted) {
          context.go('/home');
        } else {
          context.go('/profile-setup');
        }
      } else if (auth is Unauthenticated) {
        // First time? Show onboarding. Phase 8 will add a SharedPreferences
        // "onboardingSeen" check — for Phase 2 we always show it.
        context.go('/onboarding');
      } else if (auth is AuthError) {
        context.go('/login');
      }
    } else if (state is HealthCheckError) {
      _scheduleCountdown();
    }
  }

  void _scheduleCountdown() {
    final wait = AppConstants.splashRetryBackoffSeconds.first;
    setState(() => _retryIn = wait);
    Future.doWhile(() async {
      await Future<void>.delayed(const Duration(seconds: 1));
      if (!mounted) return false;
      setState(() => _retryIn -= 1);
      if (_retryIn <= 0) {
        _kick();
        return false;
      }
      return true;
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(healthCheckProvider);
    return Scaffold(
      backgroundColor: const Color(0xFF0B0B0B),
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Container(
                  width: 120,
                  height: 120,
                  decoration: BoxDecoration(
                    color: const Color(0xFFFF3B30),
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: const Icon(
                    Icons.videocam,
                    color: Colors.white,
                    size: 56,
                  ),
                ),
                const SizedBox(height: 24),
                Text(
                  'RandChat',
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                      ),
                ),
                const SizedBox(height: 40),
                _buildStateView(state),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStateView(HealthCheckResult state) {
    if (state is HealthCheckLoading) {
      return Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircularProgressIndicator(color: Colors.white),
          const SizedBox(height: 16),
          Text(
            t.splashCheckingServer,
            style: const TextStyle(color: Colors.white70),
          ),
        ],
      );
    }
    if (state is HealthCheckOk) {
      return Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.check_circle, color: Colors.green, size: 40),
          const SizedBox(height: 16),
          Text(
            t.splashStarting,
            style: const TextStyle(color: Colors.white70),
          ),
        ],
      );
    }
    if (state is HealthCheckError) {
      return Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline, color: Colors.redAccent, size: 40),
          const SizedBox(height: 16),
          Text(
            t.splashServerUnreachable,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white70),
          ),
          if (_retryIn > 0) ...[
            const SizedBox(height: 8),
            Text(
              t.splashRetryIn(_retryIn),
              style: const TextStyle(color: Colors.white38, fontSize: 12),
            ),
          ] else
            Padding(
              padding: const EdgeInsets.only(top: 16),
              child: OutlinedButton(
                onPressed: _kick,
                child: Text(t.splashRetry),
              ),
            ),
        ],
      );
    }
    return const SizedBox.shrink();
  }
}
