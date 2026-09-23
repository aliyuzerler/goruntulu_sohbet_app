import 'package:flutter_test/flutter_test.dart';
import 'package:randchat_admin_app/core/dto/health_dto.dart';

void main() {
  test('HealthResponseDto parses healthy response', () {
    const payload = {
      'uptime': 1,
      'timestamp': '2024-01-01T00:00:00.000Z',
      'service': 'randchat-api',
      'version': '0.1.0',
      'env': 'development',
      'components': {
        'db': {'status': 'up'},
        'redis': {'status': 'up'},
        'storage': {'status': 'up'},
      },
    };
    final dto = HealthResponseDto.fromJson(payload);
    expect(dto.components.allUp, isTrue);
  });
}
