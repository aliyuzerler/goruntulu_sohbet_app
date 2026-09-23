/// Health DTO — same shape as user_app's, kept duplicated to avoid
/// a shared Dart package (Phase 8 may extract `packages/dart_shared`
/// if duplication grows beyond 2-3 files).

class HealthResponseDto {
  final int uptime;
  final String timestamp;
  final String service;
  final String version;
  final String env;
  final Components components;

  const HealthResponseDto({
    required this.uptime,
    required this.timestamp,
    required this.service,
    required this.version,
    required this.env,
    required this.components,
  });

  factory HealthResponseDto.fromJson(Map<String, dynamic> json) {
    final c = json['components'] as Map<String, dynamic>;
    return HealthResponseDto(
      uptime: (json['uptime'] as num).toInt(),
      timestamp: json['timestamp'] as String,
      service: json['service'] as String,
      version: json['version'] as String,
      env: json['env'] as String,
      components: Components.fromJson(c),
    );
  }
}

class Components {
  final ComponentHealth db;
  final ComponentHealth redis;
  final ComponentHealth storage;

  const Components({
    required this.db,
    required this.redis,
    required this.storage,
  });

  factory Components.fromJson(Map<String, dynamic> json) {
    return Components(
      db: ComponentHealth.fromJson(json['db'] as Map<String, dynamic>),
      redis: ComponentHealth.fromJson(json['redis'] as Map<String, dynamic>),
      storage: ComponentHealth.fromJson(json['storage'] as Map<String, dynamic>),
    );
  }

  bool get allUp => db.status == 'up' && redis.status == 'up' && storage.status == 'up';
}

class ComponentHealth {
  final String status;
  final int? latencyMs;
  final String? message;

  const ComponentHealth({
    required this.status,
    this.latencyMs,
    this.message,
  });

  factory ComponentHealth.fromJson(Map<String, dynamic> json) {
    return ComponentHealth(
      status: json['status'] as String,
      latencyMs: json['latencyMs'] is num ? (json['latencyMs'] as num).toInt() : null,
      message: json['message'] as String?,
    );
  }
}
