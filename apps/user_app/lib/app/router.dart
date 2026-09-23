/// go_router config — Phase 2.
/// Routes:
///   /                  → splash (health check + auth bootstrap)
///   /login             → login (phone OTP + Google)
///   /onboarding        → 3-page intro (only shown once)
///   /profile-setup     → first-time profile completion
///   /agreements        → accept Terms + Privacy
///   /home              → main feed (match button)
///   /settings          → settings
///   /settings/delete-account → delete account flow

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../features/agreements/agreements_page.dart';
import '../features/auth/login/login_page.dart';
import '../features/call/call_page.dart';
import '../features/delete_account/delete_account_page.dart';
import '../features/forced-update/forced_update_page.dart';
import '../features/gdpr/gdpr_page.dart';
import '../features/home/home_page.dart';
import '../features/onboarding/onboarding_page.dart';
import '../features/profile_setup/profile_setup_page.dart';
import '../features/settings/settings_page.dart';
import '../features/shop/shop_page.dart';
import '../features/splash/splash_page.dart';
import '../features/vip/vip_page.dart';
import '../features/wallet/wallet_page.dart';

class AppRouter {
  AppRouter._();

  static final GlobalKey<NavigatorState> rootNav =
      GlobalKey<NavigatorState>(debugLabel: 'rootNav');

  static final GoRouter router = GoRouter(
    navigatorKey: rootNav,
    initialLocation: '/',
    routes: <RouteBase>[
      GoRoute(
        path: '/',
        name: 'splash',
        builder: (context, state) => const SplashPage(),
      ),
      GoRoute(
        path: '/login',
        name: 'login',
        builder: (context, state) => const LoginPage(),
      ),
      GoRoute(
        path: '/onboarding',
        name: 'onboarding',
        builder: (context, state) => const OnboardingPage(),
      ),
      GoRoute(
        path: '/profile-setup',
        name: 'profile-setup',
        builder: (context, state) => const ProfileSetupPage(),
      ),
      GoRoute(
        path: '/agreements',
        name: 'agreements',
        builder: (context, state) => const AgreementsPage(),
      ),
      GoRoute(
        path: '/home',
        name: 'home',
        builder: (context, state) => const HomePage(),
      ),
      GoRoute(
        path: '/wallet',
        name: 'wallet',
        builder: (context, state) => const WalletPage(),
      ),
      GoRoute(
        path: '/shop',
        name: 'shop',
        builder: (context, state) => const ShopPage(),
      ),
      GoRoute(
        path: '/vip',
        name: 'vip',
        builder: (context, state) => const VipPage(),
      ),
      GoRoute(
        path: '/gdpr',
        name: 'gdpr',
        builder: (context, state) => const GdprPage(),
      ),
      GoRoute(
        path: '/forced-update',
        name: 'forced-update',
        builder: (context, state) => ForcedUpdatePage(
          minVersion: state.extra as String? ?? '0.0.0',
        ),
      ),
      GoRoute(
        path: '/call',
        name: 'call',
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>? ?? const {};
          return CallPage(
            callId: extra['callId'] as String,
            agoraChannel: extra['agoraChannel'] as String,
            initialAgoraToken: extra['agoraToken'] as String?,
            initialUid: extra['uid'] as int?,
            peerId: extra['peerId'] as String? ?? '',
            peerDisplayName: extra['peerDisplayName'] as String? ?? 'Anonymous',
          );
        },
      ),
      GoRoute(
        path: '/settings',
        name: 'settings',
        builder: (context, state) => const SettingsPage(),
      ),
      GoRoute(
        path: '/settings/delete-account',
        name: 'settings/delete-account',
        builder: (context, state) => const DeleteAccountPage(),
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      body: Center(
        child: Text('Route not found: ${state.uri}'),
      ),
    ),
  );
}
