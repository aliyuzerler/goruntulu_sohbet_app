// i18n completeness test — verifies TR and EN locale maps have the same keys.
// Run: cd apps/user_app && flutter test test/i18n_completeness_test.dart

import 'package:flutter_test/flutter_test.dart';
import 'package:randchat_user_app/i18n/tr.dart' as tr_map;
import 'package:randchat_user_app/i18n/en.dart' as en_map;

void main() {
  test('TR and EN locale maps have the same top-level keys', () {
    final trKeys = tr_map.tr.keys.toSet();
    final enKeys = en_map.en.keys.toSet();

    // Missing in EN (present in TR but not EN).
    final missingInEn = trKeys.difference(enKeys);
    expect(missingInEn, isEmpty, reason: 'Keys missing in EN: $missingInEn');

    // Missing in TR (present in EN but not TR).
    final missingInTr = enKeys.difference(trKeys);
    expect(missingInTr, isEmpty, reason: 'Keys missing in TR: $missingInTr');
  });

  test('critical keys exist in TR', () {
    final trKeys = tr_map.tr.keys.toSet();
    expect(trKeys, contains('app'));
    expect(trKeys, contains('splash'));
    expect(trKeys, contains('login'));
    expect(trKeys, contains('call'));
    expect(trKeys, contains('wallet'));
    expect(trKeys, contains('moderation'));
  });
}
