// Smoke test — verifies i18n key resolution + health DTO fromJson.
// Run: flutter test test/smoke_test.dart

import 'package:flutter_test/flutter_test.dart';
import 'package:randchat_user_app/core/network/dto/health_dto.dart';
import 'package:randchat_user_app/i18n/strings.dart';

void main() {
  group('i18n — TR birincil', () {
    setUp(() {
      T.setLocale(AppLocale.tr);
    });

    test('resolves splash keys to TR', () {
      expect(t.splashCheckingServer, 'Sunucu kontrol ediliyor…');
      expect(t.splashStarting, 'Başlatılıyor…');
      expect(t.splashRetry, 'Tekrar dene');
      expect(t.splashRetryIn(5), '5 sn sonra tekrar denenecek');
    });

    test('resolves onboarding keys to TR', () {
      expect(t.onboardingPage1Title, 'Gerçek insanlarla tanış');
      expect(t.onboardingPage2Title, 'Güvende ol');
      expect(t.onboardingPage3Title, 'Jetonlarla daha fazlası');
      expect(t.onboardingSkip, 'Atla');
      expect(t.onboardingNext, 'İleri');
      expect(t.onboardingDone, 'Bitir');
    });

    test('resolves home keys to TR', () {
      expect(t.homeTitle, 'RandChat');
      expect(t.homeMatchButton, 'Eşleş');
      expect(t.homeMatchButtonLoading, 'Eşleştiriliyor…');
      expect(t.homeWalletBalance(42), '42 jeton bakiye');
    });

    test('falls back to EN when key is missing in TR', () {
      // Common.loading exists in both — verify the TR string wins.
      expect(t.commonLoading, 'Yükleniyor…');
    });
  });

  group('i18n — EN fallback', () {
    setUp(() {
      T.setLocale(AppLocale.en);
    });

    test('resolves splash keys to EN', () {
      expect(t.splashCheckingServer, 'Checking server…');
      expect(t.splashRetryIn(5), 'Retrying in 5 seconds');
    });

    test('resolves onboarding keys to EN', () {
      expect(t.onboardingPage1Title, 'Meet real people');
      expect(t.onboardingDone, 'Done');
    });

    test('resolves home keys to EN', () {
      expect(t.homeMatchButton, 'Match');
      expect(t.homeWalletBalance(42), 'Balance: 42 coins');
    });
  });

  group('HealthResponseDto.fromJson', () {
    test('parses healthy response', () {
      const payload = {
        'uptime': 42,
        'timestamp': '2024-01-01T00:00:00.000Z',
        'service': 'randchat-api',
        'version': '0.1.0',
        'env': 'development',
        'components': {
          'db': {'status': 'up', 'latencyMs': 12},
          'redis': {'status': 'up', 'latencyMs': 3},
          'storage': {'status': 'up', 'latencyMs': 24},
        },
      };

      final dto = HealthResponseDto.fromJson(payload);
      expect(dto.service, 'randchat-api');
      expect(dto.uptime, 42);
      expect(dto.components.allUp, isTrue);
      expect(dto.components.db.latencyMs, 12);
    });

    test('allUp is false when any component is down', () {
      const payload = {
        'uptime': 1,
        'timestamp': '2024-01-01T00:00:00.000Z',
        'service': 'randchat-api',
        'version': '0.1.0',
        'env': 'development',
        'components': {
          'db': {'status': 'up'},
          'redis': {'status': 'down', 'message': 'connection refused'},
          'storage': {'status': 'up'},
        },
      };
      final dto = HealthResponseDto.fromJson(payload);
      expect(dto.components.allUp, isFalse);
      expect(dto.components.redis.status, 'down');
    });
  });
}
