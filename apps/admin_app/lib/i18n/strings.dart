/// Admin i18n — Phase 1 has only TR strings for the splash + login shell.
/// Phase 2+ will add full EN coverage.

enum AppLocale { tr, en }
const AppLocale kDefaultLocale = AppLocale.tr;

class T {
  T._();
  static AppLocale _locale = kDefaultLocale;
  static AppLocale get locale => _locale;
  static void setLocale(AppLocale l) {
    _locale = l;
  }

  static String get splashChecking => _locale == AppLocale.tr
      ? 'Sunucu kontrol ediliyor…'
      : 'Checking server…';
  static String get splashStarting => _locale == AppLocale.tr
      ? 'Başlatılıyor…'
      : 'Starting…';
  static String get loginTitle => _locale == AppLocale.tr
      ? 'Yönetici Girişi'
      : 'Admin Login';
  static String get loginUsername => _locale == AppLocale.tr
      ? 'Kullanıcı adı'
      : 'Username';
  static String get loginPassword => _locale == AppLocale.tr
      ? 'Şifre'
      : 'Password';
  static String get loginSubmit => _locale == AppLocale.tr
      ? 'Giriş'
      : 'Sign in';
  static String get retry => _locale == AppLocale.tr ? 'Tekrar dene' : 'Retry';
  static String get serverUnreachable => _locale == AppLocale.tr
      ? 'Sunucuya ulaşılamadı.'
      : 'Could not reach the server.';
}

final t = T();
