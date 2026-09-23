/// API client — typed wrappers around DioClient.
/// Phase 2 adds: verify-phone, verify-google, refresh, logout, /me, /me/delete,
/// /agreements, /storage/presign-avatar.

import 'package:dio/dio.dart';
import '../config/env.dart';
import '../constants/app_constants.dart';
import '../network/dio_client.dart';
import '../network/dto/auth_dto.dart';
import '../network/dto/health_dto.dart';
import '../network/dto/call_dto.dart';
import '../network/dto/wallet_dto.dart';
import '../network/dto/billing_dto.dart';
import '../network/dto/vip_filter_dto.dart';
import '../network/dto/moderation_dto.dart';

class ApiClient {
  ApiClient._();

  // ─── Health ────────────────────────────────────────────────────────
  static Future<HealthResponseDto> checkHealth() async {
    final res = await DioClient.instance.get<dynamic>(
      AppConstants.healthEndpoint,
    );
    if (res.statusCode != AppConstants.httpOk) {
      throw DioException(
        requestOptions: res.requestOptions,
        response: res,
        type: DioExceptionType.badResponse,
        message: 'Health check failed: HTTP ${res.statusCode}',
      );
    }
    final data = res.data;
    if (data is! Map<String, dynamic>) {
      throw DioException(
        requestOptions: res.requestOptions,
        response: res,
        type: DioExceptionType.unknown,
        message: 'Health check response was not a JSON object',
      );
    }
    return HealthResponseDto.fromJson(data);
  }

  // ─── /me ─────────────────────────────────────────────────────────────
  static Future<MeDto> getMe() async {
    final res = await DioClient.instance.get<dynamic>('/me');
    return MeDto.fromJson(res.data as Map<String, dynamic>);
  }

  static Future<ProfileDto> updateProfile(Map<String, dynamic> patch) async {
    final res = await DioClient.instance.patch<dynamic>('/me', data: patch);
    return ProfileDto.fromJson(res.data as Map<String, dynamic>);
  }

  static Future<DeletionRequestDto> requestDeletion({String? reason}) async {
    final res = await DioClient.instance.post<dynamic>(
      '/me/delete',
      data: {'reason': reason},
    );
    // The deletion request endpoint returns the DeletionRequest shape directly,
    // but /me returns it nested under deletionRequest[]. We return just the
    // request object — caller decides.
    return DeletionRequestDto.fromJson(res.data as Map<String, dynamic>);
  }

  static Future<void> cancelDeletion() async {
    await DioClient.instance.post<dynamic>('/me/delete/cancel');
  }

  // ─── /agreements ─────────────────────────────────────────────────────
  static Future<AgreementsLatestDto> getLatestAgreements() async {
    final res = await DioClient.instance.get<dynamic>('/agreements/latest');
    return AgreementsLatestDto.fromJson(res.data as Map<String, dynamic>);
  }

  static Future<void> acceptAgreement(String agreementId) async {
    await DioClient.instance.post<dynamic>(
      '/agreements/accept',
      data: {'agreementId': agreementId},
    );
  }

  // ─── /storage ────────────────────────────────────────────────────────
  static Future<PresignAvatarDto> presignAvatar({
    required String contentType,
    required String ext,
    required int maxSizeBytes,
  }) async {
    final res = await DioClient.instance.post<dynamic>(
      '/storage/presign-avatar',
      data: {
        'contentType': contentType,
        'ext': ext,
        'maxSizeBytes': maxSizeBytes,
      },
    );
    return PresignAvatarDto.fromJson(res.data as Map<String, dynamic>);
  }

  /// Upload avatar bytes directly to S3 via presigned PUT URL.
  /// Phase 2: client uses image_picker to pick the file, we read bytes,
  /// request presign, PUT the bytes. No binary goes through our API.
  static Future<String> uploadAvatar({
    required List<int> bytes,
    required String contentType,
    required String ext,
  }) async {
    final p = await presignAvatar(
      contentType: contentType,
      ext: ext,
      maxSizeBytes: bytes.length,
    );
    final dio = Dio(BaseOptions(baseUrl: ''));
    await dio.put<dynamic>(
      p.uploadUrl,
      data: Stream<List<int>>.fromIterable([bytes]),
      options: Options(
        headers: {
          'Content-Type': contentType,
          'Content-Length': bytes.length,
        },
      ),
    );
    return p.publicUrl;
  }

  // ─── /calls (Phase 4) ───────────────────────────────────────────────
  static Future<AgoraTokenDto> getAgoraToken(String callId, {String role = 'publisher'}) async {
    final res = await DioClient.instance.post<dynamic>(
      '/calls/$callId/agora-token',
      data: {'role': role},
    );
    return AgoraTokenDto.fromJson(res.data as Map<String, dynamic>);
  }

  static Future<CallStatusDto> startCall(String callId) async {
    final res = await DioClient.instance.post<dynamic>('/calls/$callId/start');
    return CallStatusDto.fromJson(res.data as Map<String, dynamic>);
  }

  static Future<CallStatusDto> endCall(String callId, {String? reason}) async {
    final res = await DioClient.instance.post<dynamic>(
      '/calls/$callId/end',
      data: reason != null ? {'reason': reason} : null,
    );
    return CallStatusDto.fromJson(res.data as Map<String, dynamic>);
  }

  // ─── /wallet (Phase 5) ────────────────────────────────────────────────
  static Future<WalletBalanceDto> getWalletBalance() async {
    final res = await DioClient.instance.get<dynamic>('/wallet');
    return WalletBalanceDto.fromJson(res.data as Map<String, dynamic>);
  }

  static Future<TransactionListDto> getTransactions({String? cursor, int take = 20}) async {
    final res = await DioClient.instance.get<dynamic>(
      '/wallet/transactions',
      queryParameters: {
        if (cursor != null) 'cursor': cursor,
        'take': take,
      },
    );
    return TransactionListDto.fromJson(res.data as Map<String, dynamic>);
  }

  // ─── /billing (Phase 6) ────────────────────────────────────────────────
  static Future<ProductsListDto> listProducts() async {
    final res = await DioClient.instance.get<dynamic>('/billing/products');
    return ProductsListDto.fromJson(res.data as Map<String, dynamic>);
  }

  static Future<VerifyPurchaseResponseDto> verifyPurchase({
    required String productId,
    required String purchaseToken,
  }) async {
    final res = await DioClient.instance.post<dynamic>(
      '/billing/verify-purchase',
      data: {
        'productId': productId,
        'purchaseToken': purchaseToken,
      },
    );
    return VerifyPurchaseResponseDto.fromJson(res.data as Map<String, dynamic>);
  }

  // ─── /vip (Phase 7) ────────────────────────────────────────────────────
  static Future<VerifySubscriptionResponseDto> verifySubscription({
    required String purchaseToken,
  }) async {
    final res = await DioClient.instance.post<dynamic>(
      '/vip/verify-subscription',
      data: {'purchaseToken': purchaseToken},
    );
    return VerifySubscriptionResponseDto.fromJson(res.data as Map<String, dynamic>);
  }

  static Future<EntitlementStatusDto> getVipStatus() async {
    final res = await DioClient.instance.get<dynamic>('/vip/status');
    return EntitlementStatusDto.fromJson(res.data as Map<String, dynamic>);
  }

  // ─── /filters (Phase 7) ────────────────────────────────────────────────
  static Future<ActivateCountryFilterResponseDto> activateCountryFilter({
    required String countryCode,
  }) async {
    final res = await DioClient.instance.post<dynamic>(
      '/filters/activate-country',
      data: {'countryCode': countryCode},
    );
    return ActivateCountryFilterResponseDto.fromJson(res.data as Map<String, dynamic>);
  }

  static Future<ActiveFiltersDto> getActiveFilters() async {
    final res = await DioClient.instance.get<dynamic>('/filters/active');
    return ActiveFiltersDto.fromJson(res.data as Map<String, dynamic>);
  }

  // ─── /moderation (Phase 8) ────────────────────────────────────────────
  static Future<CreateReportResponseDto> createReport({
    required String reportedId,
    String? callId,
    required String reason,
    String? note,
  }) async {
    final res = await DioClient.instance.post<dynamic>(
      '/moderation/report',
      data: {
        'reportedId': reportedId,
        if (callId != null) 'callId': callId,
        'reason': reason,
        if (note != null) 'note': note,
      },
    );
    return CreateReportResponseDto.fromJson(res.data as Map<String, dynamic>);
  }

  static Future<void> blockUser(String blockedId) async {
    await DioClient.instance.post<dynamic>('/moderation/block', data: {'blockedId': blockedId});
  }

  static Future<CaptureFrameResponseDto> captureFrame({
    required String callId,
    required String frameBase64,
  }) async {
    final res = await DioClient.instance.post<dynamic>(
      '/moderation/capture-frame',
      data: {'callId': callId, 'frameBase64': frameBase64},
    );
    return CaptureFrameResponseDto.fromJson(res.data as Map<String, dynamic>);
  }

  static Future<RateCallResponseDto> rateCall({
    required String callId,
    required String targetUserId,
    required int stars,
  }) async {
    final res = await DioClient.instance.post<dynamic>(
      '/moderation/rate',
      data: {
        'callId': callId,
        'targetUserId': targetUserId,
        'stars': stars,
      },
    );
    return RateCallResponseDto.fromJson(res.data as Map<String, dynamic>);
  }

  static Future<ChatMessageResponseDto> postChatMessage({
    required String callId,
    required String content,
  }) async {
    final res = await DioClient.instance.post<dynamic>(
      '/moderation/chat',
      data: {'callId': callId, 'content': content},
    );
    return ChatMessageResponseDto.fromJson(res.data as Map<String, dynamic>);
  }

  // ─── /gdpr (Phase 9) ────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> gdprExport() async {
    final res = await DioClient.instance.get<dynamic>('/gdpr/export');
    return res.data as Map<String, dynamic>;
  }

  static Future<void> gdprDelete() async {
    await DioClient.instance.post<dynamic>('/gdpr/delete');
  }

  static String get baseUrl => Env.apiBaseUrl;
}
