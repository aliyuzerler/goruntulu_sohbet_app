import 'package:dio/dio.dart';
import '../config/env.dart';
import '../dto/health_dto.dart';
import '../network/dio_client.dart';

class ApiClient {
  ApiClient._();

  static Future<HealthResponseDto> checkHealth() async {
    final res = await DioClient.instance.get<dynamic>('/health');
    if (res.statusCode != 200) {
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

  static String get baseUrl => Env.apiBaseUrl;
}
