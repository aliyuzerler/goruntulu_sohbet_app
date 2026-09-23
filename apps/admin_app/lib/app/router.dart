import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../features/home/admin_home_page.dart';
import '../features/login/login_page.dart';
import '../features/reports/report_queue_page.dart';

class AdminRouter {
  AdminRouter._();

  static final GlobalKey<NavigatorState> rootNav =
      GlobalKey<NavigatorState>(debugLabel: 'adminRoot');

  static final GoRouter router = GoRouter(
    navigatorKey: rootNav,
    initialLocation: '/login',
    routes: <RouteBase>[
      GoRoute(
        path: '/login',
        name: 'login',
        builder: (context, state) => const AdminLoginPage(),
      ),
      GoRoute(
        path: '/home',
        name: 'home',
        builder: (context, state) => const AdminHomePage(),
      ),
      GoRoute(
        path: '/reports',
        name: 'reports',
        builder: (context, state) => const ReportQueuePage(),
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      body: Center(child: Text('Route not found: ${state.uri}')),
    ),
  );
}
