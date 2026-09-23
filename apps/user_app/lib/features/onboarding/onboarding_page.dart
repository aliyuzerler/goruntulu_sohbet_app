/// Onboarding page — 3-page swipeable intro shown to first-time users.
/// "Skip" and "Done" both persist onboarding completion via SharedPreferences
/// (Phase 2 will wire that; for Phase 1 it just navigates to /home).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../i18n/strings.dart';

class OnboardingPage extends ConsumerStatefulWidget {
  const OnboardingPage({super.key});

  @override
  ConsumerState<OnboardingPage> createState() => _OnboardingPageState();
}

class _OnboardingPageState extends ConsumerState<OnboardingPage> {
  final _controller = PageController();
  int _page = 0;

  static const _pages = <_OnboardingSlide>[
    _OnboardingSlide(
      icon: Icons.people_outline,
      color: Color(0xFFFF3B30),
      titleKey: 'onboardingPage1Title',
      bodyKey: 'onboardingPage1Body',
    ),
    _OnboardingSlide(
      icon: Icons.shield_outlined,
      color: Color(0xFF34C759),
      titleKey: 'onboardingPage2Title',
      bodyKey: 'onboardingPage2Body',
    ),
    _OnboardingSlide(
      icon: Icons.monetization_on_outlined,
      color: Color(0xFFFFCC00),
      titleKey: 'onboardingPage3Title',
      bodyKey: 'onboardingPage3Body',
    ),
  ];

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _next() {
    if (_page < _pages.length - 1) {
      _controller.nextPage(
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    } else {
      _done();
    }
  }

  void _done() {
    // Phase 2: persist "onboardingSeen=true" in SharedPreferences here.
    context.go('/home');
  }

  @override
  Widget build(BuildContext context) {
    final i18n = t;
    return Scaffold(
      backgroundColor: const Color(0xFF0B0B0B),
      body: SafeArea(
        child: Column(
          children: [
            Align(
              alignment: Alignment.topRight,
              child: TextButton(
                onPressed: _done,
                child: Text(
                  i18n.onboardingSkip,
                  style: const TextStyle(color: Colors.white70),
                ),
              ),
            ),
            Expanded(
              child: PageView.builder(
                controller: _controller,
                itemCount: _pages.length,
                onPageChanged: (i) => setState(() => _page = i),
                itemBuilder: (_, i) => _OnboardingView(_pages[i]),
              ),
            ),
            // Dot indicator + bottom action
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: List.generate(
                      _pages.length,
                      (i) => Container(
                        margin: const EdgeInsets.only(right: 8),
                        width: _page == i ? 24 : 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: _page == i
                              ? const Color(0xFFFF3B30)
                              : Colors.white24,
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                    ),
                  ),
                  FilledButton(
                    onPressed: _next,
                    child: Text(
                      _page == _pages.length - 1
                          ? i18n.onboardingDone
                          : i18n.onboardingNext,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OnboardingSlide {
  final IconData icon;
  final Color color;
  final String titleKey;
  final String bodyKey;

  const _OnboardingSlide({
    required this.icon,
    required this.color,
    required this.titleKey,
    required this.bodyKey,
  });
}

class _OnboardingView extends StatelessWidget {
  final _OnboardingSlide slide;
  const _OnboardingView(this.slide);

  @override
  Widget build(BuildContext context) {
    // Pull localized title/body via the t instance.
    final i18n = t;
    final title = titleKey == 'onboardingPage1Title'
        ? i18n.onboardingPage1Title
        : titleKey == 'onboardingPage2Title'
            ? i18n.onboardingPage2Title
            : i18n.onboardingPage3Title;
    final body = bodyKey == 'onboardingPage1Body'
        ? i18n.onboardingPage1Body
        : bodyKey == 'onboardingPage2Body'
            ? i18n.onboardingPage2Body
            : i18n.onboardingPage3Body;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 160,
            height: 160,
            decoration: BoxDecoration(
              color: slide.color.withOpacity(0.15),
              shape: BoxShape.circle,
            ),
            child: Icon(slide.icon, size: 80, color: slide.color),
          ),
          const SizedBox(height: 32),
          Text(
            title,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
          ),
          const SizedBox(height: 16),
          Text(
            body,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white70, fontSize: 16, height: 1.5),
          ),
        ],
      ),
    );
  }
}
