// Manual i18n for Phase 1 — no codegen needed.
// tr.json and en.json live under lib/i18n/; resolved at compile time as
// Dart const Maps. Phase 7 may switch to slang if complexity grows.

import 'package:flutter/foundation.dart';

// Re-export the JSON literals as Dart const Maps so the app stays single-file
// (no async loading, no asset path issues during scaffold).
// In Phase 7 we may switch to slang + codegen, but the `t` API below stays.
import 'tr.dart' as tr_map;
import 'en.dart' as en_map;

/// Supported app locales.
enum AppLocale { tr, en }

/// Default locale per user choice: TR birincil.
const AppLocale kDefaultLocale = AppLocale.tr;

/// Marker interface for typed string keys — used to prevent typos.
class TranslationKeys {
  const TranslationKeys();
  // Splash
  String get splashCheckingServer => 'splash.checkingServer';
  String get splashStarting => 'splash.starting';
  String get splashRetry => 'splash.retry';
  String get splashServerUnreachable => 'splash.serverUnreachable';
  // Common
  String get commonOk => 'common.ok';
  String get commonCancel => 'common.cancel';
  String get commonRetry => 'common.retry';
  String get commonLoading => 'common.loading';
  String get commonError => 'common.error';
  // Errors
  String get errorNetwork => 'errors.network';
  String get errorInternal => 'errors.internal';
  String get errorUnknown => 'errors.unknown';
}

/// Translation accessor — use as `t.commonRetry` etc.
/// Looks up the dotted key in the active locale map and falls back to EN
/// if the key is missing, then to the key itself if both are missing
/// (so we can spot untranslated keys during dev).
class T {
  T._();

  static AppLocale _locale = kDefaultLocale;
  static AppLocale get locale => _locale;

  static void setLocale(AppLocale l) {
    _locale = l;
    debugPrint('i18n → locale set to $l');
  }

  /// Resolve a dotted key like "common.retry".
  static String tr(String key, [Map<String, String>? params]) {
    final map = _activeMap;
    var value = _resolve(map, key) ?? _resolve(en_map.en, key) ?? key;
    if (params == null) return value;
    for (final entry in params.entries) {
      value = value.replaceAll('\${${entry.key}}', entry.value);
    }
    return value;
  }

  static Map<String, dynamic> get _activeMap {
    switch (_locale) {
      case AppLocale.tr:
        return tr_map.tr;
      case AppLocale.en:
        return en_map.en;
    }
  }

  static String? _resolve(Map<String, dynamic> map, String dottedKey) {
    final parts = dottedKey.split('.');
    dynamic node = map;
    for (final p in parts) {
      if (node is! Map<String, dynamic>) return null;
      node = node[p];
      if (node == null) return null;
    }
    return node is String ? node : null;
  }
}

/// Global shortcut instance.
// ignore: non_constant_identifier_names
final t = _TInstance();

class _TInstance {
  // Splash
  String get splashCheckingServer => T.tr('splash.checkingServer');
  String get splashStarting => T.tr('splash.starting');
  String get splashRetry => T.tr('splash.retry');
  String get splashServerUnreachable => T.tr('splash.serverUnreachable');
  String splashRetryIn(int seconds) =>
      T.tr('splash.retryIn', {'seconds': seconds.toString()});

  // Onboarding
  String get onboardingPage1Title => T.tr('onboarding.page1Title');
  String get onboardingPage1Body => T.tr('onboarding.page1Body');
  String get onboardingPage2Title => T.tr('onboarding.page2Title');
  String get onboardingPage2Body => T.tr('onboarding.page2Body');
  String get onboardingPage3Title => T.tr('onboarding.page3Title');
  String get onboardingPage3Body => T.tr('onboarding.page3Body');
  String get onboardingSkip => T.tr('onboarding.skip');
  String get onboardingNext => T.tr('onboarding.next');
  String get onboardingDone => T.tr('onboarding.done');

  // Home
  String get homeTitle => T.tr('home.title');
  String get homeMatchButton => T.tr('home.matchButton');
  String get homeMatchButtonLoading => T.tr('home.matchButtonLoading');
  String homeWalletBalance(int count) =>
      T.tr('home.walletBalance', {'count': count.toString()});
  String get homeSettingsButton => T.tr('home.settingsButton');
  String get homeReportsButton => T.tr('home.reportsButton');
  String get homeProfileButton => T.tr('home.profileButton');

  // Login
  String get loginTitle => T.tr('login.title');
  String get loginSubtitle => T.tr('login.subtitle');
  String get loginPhone => T.tr('login.phone');
  String get loginPhoneHint => T.tr('login.phoneHint');
  String get loginSendCode => T.tr('login.sendCode');
  String get loginOtp => T.tr('login.otp');
  String get loginOtpHint => T.tr('login.otpHint');
  String get loginVerifyOtp => T.tr('login.verifyOtp');
  String get loginGoogleSignIn => T.tr('login.googleSignIn');
  String get loginOrDivider => T.tr('login.orDivider');
  String get loginInvalidPhone => T.tr('login.invalidPhone');
  String get loginInvalidOtp => T.tr('login.invalidOtp');
  String get loginOtpSent => T.tr('login.otpSent');
  String get loginWrongOtp => T.tr('login.wrongOtp');
  String get loginRateLimited => T.tr('login.rateLimited');

  // Profile setup
  String get profileSetupTitle => T.tr('profileSetup.title');
  String get profileSetupNickname => T.tr('profileSetup.nickname');
  String get profileSetupNicknameHint => T.tr('profileSetup.nicknameHint');
  String get profileSetupNicknameTaken => T.tr('profileSetup.nicknameTaken');
  String get profileSetupNicknameProfanity => T.tr('profileSetup.nicknameProfanity');
  String get profileSetupBirthYear => T.tr('profileSetup.birthYear');
  String get profileSetupBirthYearHint => T.tr('profileSetup.birthYearHint');
  String get profileSetupGender => T.tr('profileSetup.gender');
  String get profileSetupGenderMale => T.tr('profileSetup.genderMale');
  String get profileSetupGenderFemale => T.tr('profileSetup.genderFemale');
  String get profileSetupGenderOther => T.tr('profileSetup.genderOther');
  String get profileSetupGenderUnspecified => T.tr('profileSetup.genderUnspecified');
  String get profileSetupCountry => T.tr('profileSetup.country');
  String get profileSetupCountryHint => T.tr('profileSetup.countryHint');
  String get profileSetupAvatar => T.tr('profileSetup.avatar');
  String get profileSetupAvatarPickFromGallery => T.tr('profileSetup.avatarPickFromGallery');
  String get profileSetupAvatarRemove => T.tr('profileSetup.avatarRemove');
  String get profileSetupSave => T.tr('profileSetup.save');
  String get profileSetupSaving => T.tr('profileSetup.saving');
  String get profileSetupSaved => T.tr('profileSetup.saved');
  String get profileSetupUnderageBlocked => T.tr('profileSetup.underageBlocked');

  // Agreements
  String get agreementsTitle => T.tr('agreements.title');
  String get agreementsTermsOfService => T.tr('agreements.termsOfService');
  String get agreementsPrivacyPolicy => T.tr('agreements.privacyPolicy');
  String get agreementsAcceptAll => T.tr('agreements.acceptAll');
  String get agreementsAccept => T.tr('agreements.accept');
  String get agreementsAccepted => T.tr('agreements.accepted');
  String get agreementsMustAcceptAll => T.tr('agreements.mustAcceptAll');

  // Settings
  String get settingsTitle => T.tr('settings.title');
  String get settingsAccount => T.tr('settings.account');
  String get settingsEditProfile => T.tr('settings.editProfile');
  String get settingsDeleteAccount => T.tr('settings.deleteAccount');
  String get settingsLogout => T.tr('settings.logout');
  String get settingsAbout => T.tr('settings.about');
  String settingsVersion(String v) => T.tr('settings.version', {'version': v});
  String get settingsLanguage => T.tr('settings.language');

  // Delete account
  String get deleteAccountTitle => T.tr('deleteAccount.title');
  String get deleteAccountWarning => T.tr('deleteAccount.warning');
  String deleteAccountGracePeriodInfo(String date) =>
      T.tr('deleteAccount.gracePeriodInfo', {'date': date});
  String get deleteAccountReason => T.tr('deleteAccount.reason');
  String get deleteAccountReasonHint => T.tr('deleteAccount.reasonHint');
  String get deleteAccountConfirm => T.tr('deleteAccount.confirm');
  String get deleteAccountCancel => T.tr('deleteAccount.cancel');
  String get deleteAccountCancelDeletion => T.tr('deleteAccount.cancelDeletion');
  String get deleteAccountDeletionScheduled => T.tr('deleteAccount.deletionScheduled');
  String get deleteAccountDeletionCanceled => T.tr('deleteAccount.deletionCanceled');
  String get deleteAccountPlayStoreNote => T.tr('deleteAccount.playStoreNote');

  // Call
  String get callTitle => T.tr('call.title');
  String get callConnecting => T.tr('call.connecting');
  String get callConnected => T.tr('call.connected');
  String get callEnded => T.tr('call.ended');
  String get callPeerDisconnected => T.tr('call.peerDisconnected');
  String get callMatchTimeout => T.tr('call.matchTimeout');
  String get callEnd => T.tr('call.end');
  String get callNext => T.tr('call.next');
  String get callMute => T.tr('call.mute');
  String get callUnmute => T.tr('call.unmute');
  String get callCameraOn => T.tr('call.cameraOn');
  String get callCameraOff => T.tr('call.cameraOff');
  String get callSwitchCamera => T.tr('call.switchCamera');
  String get callReport => T.tr('call.report');
  String get callPermissionRequired => T.tr('call.permissionRequired');
  String get callPermissionDenied => T.tr('call.permissionDenied');
  String get callOpenSettings => T.tr('call.openSettings');
  String get callRetryPermissions => T.tr('call.retryPermissions');
  String get callNetworkPoor => T.tr('call.networkPoor');
  String get callNetworkGood => T.tr('call.networkGood');
  String get callNetworkDisconnected => T.tr('call.networkDisconnected');
  String get callReconnecting => T.tr('call.reconnecting');
  String get callRejoined => T.tr('call.rejoined');
  String get callRejoinFailed => T.tr('call.rejoinFailed');
  String get callAudioOnly => T.tr('call.audioOnly');

  // Wallet
  String get walletTitle => T.tr('wallet.title');
  String get walletBalance => T.tr('wallet.balance');
  String get walletCoin => T.tr('wallet.coin');
  String get walletCoins => T.tr('wallet.coins');
  String get walletTransactions => T.tr('wallet.transactions');
  String get walletNoTransactions => T.tr('wallet.noTransactions');
  String get walletLoadMore => T.tr('wallet.loadMore');
  String get walletTypePurchase => T.tr('wallet.typePurchase');
  String get walletTypeSpendMatch => T.tr('wallet.typeSpendMatch');
  String get walletTypeSpendGift => T.tr('wallet.typeSpendGift');
  String get walletTypeSpendFilter => T.tr('wallet.typeSpendFilter');
  String get walletTypeRefund => T.tr('wallet.typeRefund');
  String get walletTypeAdjustment => T.tr('wallet.typeAdjustment');
  String get walletLowBalance => T.tr('wallet.lowBalance');
  String walletLowBalanceNeeded(int needed) =>
      T.tr('wallet.lowBalanceNeeded', {'needed': needed.toString()});
  String get walletGoToShop => T.tr('wallet.goToShop');
  String walletDailyQuotaRemaining(int remaining) =>
      T.tr('wallet.dailyQuotaRemaining', {'remaining': remaining.toString()});
  String walletDailyQuotaExhausted(int cost) =>
      T.tr('wallet.dailyQuotaExhausted', {'cost': cost.toString()});

  // Shop
  String get shopTitle => T.tr('shop.title');
  String get shopBuy => T.tr('shop.buy');
  String get shopBuying => T.tr('shop.buying');
  String get shopPopularBadge => T.tr('shop.popularBadge');
  String get shopBestValueBadge => T.tr('shop.bestValueBadge');
  String get shopPerCoin => T.tr('shop.perCoin');
  String get shopSmall => T.tr('shop.small');
  String get shopMedium => T.tr('shop.medium');
  String get shopLarge => T.tr('shop.large');
  String get shopMega => T.tr('shop.mega');
  String get shopPurchasePending => T.tr('shop.purchasePending');
  String shopPurchaseSuccess(int coins) =>
      T.tr('shop.purchaseSuccess', {'coins': coins.toString()});
  String shopPurchaseFailed(String error) =>
      T.tr('shop.purchaseFailed', {'error': error});
  String get shopPurchaseCancelled => T.tr('shop.purchaseCancelled');
  String shopVerifyFailed(String error) =>
      T.tr('shop.verifyFailed', {'error': error});
  String get shopStoreNotAvailable => T.tr('shop.storeNotAvailable');
  String get shopRestorePurchases => T.tr('shop.restorePurchases');

  // VIP
  String get vipTitle => T.tr('vip.title');
  String get vipBadge => T.tr('vip.badge');
  String get vipSubtitle => T.tr('vip.subtitle');
  String vipSubscribeCta(String price) =>
      T.tr('vip.subscribeCta', {'price': price});
  String get vipSubscribeSuccess => T.tr('vip.subscribeSuccess');
  String vipSubscribeFailed(String error) =>
      T.tr('vip.subscribeFailed', {'error': error});
  String get vipActive => T.tr('vip.active');
  String vipExpiresOn(String date) => T.tr('vip.expiresOn', {'date': date});
  String get vipManageSubscription => T.tr('vip.manageSubscription');
  String get vipBenefit1Title => T.tr('vip.benefit1Title');
  String get vipBenefit1Body => T.tr('vip.benefit1Body');
  String get vipBenefit2Title => T.tr('vip.benefit2Title');
  String get vipBenefit2Body => T.tr('vip.benefit2Body');
  String get vipBenefit3Title => T.tr('vip.benefit3Title');
  String get vipBenefit3Body => T.tr('vip.benefit3Body');
  String get vipBenefit4Title => T.tr('vip.benefit4Title');
  String get vipBenefit4Body => T.tr('vip.benefit4Body');
  String get vipPaywallTitle => T.tr('vip.paywallTitle');
  String get vipPaywallBody => T.tr('vip.paywallBody');
  String get vipGoVip => T.tr('vip.goVip');

  // Filters
  String get filtersTitle => T.tr('filters.title');
  String get filtersGenderTitle => T.tr('filters.genderTitle');
  String get filtersCountryTitle => T.tr('filters.countryTitle');
  String get filtersAny => T.tr('filters.any');
  String get filtersMale => T.tr('filters.male');
  String get filtersFemale => T.tr('filters.female');
  String get filtersOther => T.tr('filters.other');
  String filtersCountryActivate(int cost) =>
      T.tr('filters.countryActivate', {'cost': cost.toString()});
  String get filtersCountryActivateVip => T.tr('filters.countryActivateVip');
  String filtersCountryActive(String date) =>
      T.tr('filters.countryActive', {'date': date});
  String get filtersGenderPaywallBody => T.tr('filters.genderPaywallBody');
  String filtersCountryPaywallBody(int cost) =>
      T.tr('filters.countryPaywallBody', {'cost': cost.toString()});
  String get filtersCancel => T.tr('filters.cancel');
  String get filtersActivated => T.tr('filters.activated');
  String filtersActivateFailed(String error) =>
      T.tr('filters.activateFailed', {'error': error});

  // Moderation
  String get moderationReportTitle => T.tr('moderation.reportTitle');
  String get moderationReportSubtitle => T.tr('moderation.reportSubtitle');
  String get moderationReasonNudity => T.tr('moderation.reasonNudity');
  String get moderationReasonHarassment => T.tr('moderation.reasonHarassment');
  String get moderationReasonMinor => T.tr('moderation.reasonMinor');
  String get moderationReasonSpam => T.tr('moderation.reasonSpam');
  String get moderationReasonOther => T.tr('moderation.reasonOther');
  String get moderationNoteLabel => T.tr('moderation.noteLabel');
  String get moderationNoteHint => T.tr('moderation.noteHint');
  String get moderationSubmit => T.tr('moderation.submit');
  String get moderationSubmitting => T.tr('moderation.submitting');
  String get moderationSubmitted => T.tr('moderation.submitted');
  String moderationSubmitFailed(String error) =>
      T.tr('moderation.submitFailed', {'error': error});
  String get moderationBlockAlso => T.tr('moderation.blockAlso');
  String get moderationBlockAlsoBody => T.tr('moderation.blockAlsoBody');
  String get moderationRatingTitle => T.tr('moderation.ratingTitle');
  String get moderationRatingSubtitle => T.tr('moderation.ratingSubtitle');
  String get moderationStar => T.tr('moderation.star');
  String get moderationStars => T.tr('moderation.stars');
  String get moderationSubmitRating => T.tr('moderation.submitRating');
  String get moderationSkip => T.tr('moderation.skip');
  String get moderationRatingSubmitted => T.tr('moderation.ratingSubmitted');
  String get moderationRatingSkipped => T.tr('moderation.ratingSkipped');
  String get moderationCallEndedModeration => T.tr('moderation.callEndedModeration');
  String get moderationBlocked => T.tr('moderation.blocked');

  // Common
  String get commonOk => T.tr('common.ok');
  String get commonCancel => T.tr('common.cancel');
  String get commonRetry => T.tr('common.retry');
  String get commonLoading => T.tr('common.loading');
  String get commonError => T.tr('common.error');

  // Errors
  String get errorNetwork => T.tr('errors.network');
  String get errorInternal => T.tr('errors.internal');
  String get errorUnknown => T.tr('errors.unknown');
}
