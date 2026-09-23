/// Auth response DTO — mirrors the API's `{ accessToken, refreshToken, refreshTokenId, user }`.
class AuthResponseDto {
  final String accessToken;
  final String refreshToken;
  final String refreshTokenId;
  final AuthUserDto user;

  const AuthResponseDto({
    required this.accessToken,
    required this.refreshToken,
    required this.refreshTokenId,
    required this.user,
  });

  factory AuthResponseDto.fromJson(Map<String, dynamic> json) {
    return AuthResponseDto(
      accessToken: json['accessToken'] as String,
      refreshToken: json['refreshToken'] as String,
      refreshTokenId: json['refreshTokenId'] as String,
      user: AuthUserDto.fromJson(json['user'] as Map<String, dynamic>),
    );
  }
}

class AuthUserDto {
  final String id;
  final String role;
  final bool profileCompleted;

  const AuthUserDto({
    required this.id,
    required this.role,
    required this.profileCompleted,
  });

  factory AuthUserDto.fromJson(Map<String, dynamic> json) {
    return AuthUserDto(
      id: json['id'] as String,
      role: json['role'] as String,
      profileCompleted: (json['profileCompleted'] as bool?) ?? false,
    );
  }
}

/// GET /me response — user + profile + wallet + deletionRequest.
class MeDto {
  final String id;
  final String? firebasePhone;
  final String role;
  final String status;
  final bool profileCompleted;
  final DateTime? lastSeenAt;
  final DateTime createdAt;
  final ProfileDto? profile;
  final WalletDto? wallet;
  final DeletionRequestDto? deletionRequest;

  const MeDto({
    required this.id,
    required this.firebasePhone,
    required this.role,
    required this.status,
    required this.profileCompleted,
    required this.lastSeenAt,
    required this.createdAt,
    required this.profile,
    required this.wallet,
    required this.deletionRequest,
  });

  factory MeDto.fromJson(Map<String, dynamic> json) {
    return MeDto(
      id: json['id'] as String,
      firebasePhone: json['firebasePhone'] as String?,
      role: json['role'] as String,
      status: json['status'] as String,
      profileCompleted: (json['profileCompleted'] as bool?) ?? false,
      lastSeenAt: json['lastSeenAt'] != null ? DateTime.parse(json['lastSeenAt'] as String) : null,
      createdAt: DateTime.parse(json['createdAt'] as String),
      profile: json['profile'] != null ? ProfileDto.fromJson(json['profile'] as Map<String, dynamic>) : null,
      wallet: json['wallet'] != null ? WalletDto.fromJson(json['wallet'] as Map<String, dynamic>) : null,
      deletionRequest: json['deletionRequest'] != null && (json['deletionRequest'] as List).isNotEmpty
          ? DeletionRequestDto.fromJson((json['deletionRequest'] as List).first as Map<String, dynamic>)
          : null,
    );
  }
}

class ProfileDto {
  final String? displayName;
  final String? avatarUrl;
  final String? bio;
  final String? gender;
  final String? country;
  final int? birthYear;

  const ProfileDto({
    required this.displayName,
    required this.avatarUrl,
    required this.bio,
    required this.gender,
    required this.country,
    required this.birthYear,
  });

  factory ProfileDto.fromJson(Map<String, dynamic> json) {
    return ProfileDto(
      displayName: json['displayName'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      bio: json['bio'] as String?,
      gender: json['gender'] as String?,
      country: json['country'] as String?,
      birthYear: json['birthYear'] as int?,
    );
  }
}

class WalletDto {
  final int balance;
  const WalletDto({required this.balance});
  factory WalletDto.fromJson(Map<String, dynamic> json) =>
      WalletDto(balance: json['balance'] as int);
}

class DeletionRequestDto {
  final String id;
  final DateTime scheduledAt;
  final DateTime requestedAt;
  const DeletionRequestDto({required this.id, required this.scheduledAt, required this.requestedAt});

  factory DeletionRequestDto.fromJson(Map<String, dynamic> json) {
    return DeletionRequestDto(
      id: json['id'] as String,
      scheduledAt: DateTime.parse(json['scheduledAt'] as String),
      requestedAt: DateTime.parse(json['requestedAt'] as String),
    );
  }
}

/// POST /storage/presign-avatar response.
class PresignAvatarDto {
  final String uploadUrl;
  final String publicUrl;
  final String objectKey;

  const PresignAvatarDto({
    required this.uploadUrl,
    required this.publicUrl,
    required this.objectKey,
  });

  factory PresignAvatarDto.fromJson(Map<String, dynamic> json) {
    return PresignAvatarDto(
      uploadUrl: json['uploadUrl'] as String,
      publicUrl: json['publicUrl'] as String,
      objectKey: json['objectKey'] as String,
    );
  }
}

/// GET /agreements/latest response.
class AgreementsLatestDto {
  final AgreementDto? terms;
  final AgreementDto? privacy;

  const AgreementsLatestDto({required this.terms, required this.privacy});

  factory AgreementsLatestDto.fromJson(Map<String, dynamic> json) {
    return AgreementsLatestDto(
      terms: json['terms'] != null ? AgreementDto.fromJson(json['terms'] as Map<String, dynamic>) : null,
      privacy: json['privacy'] != null ? AgreementDto.fromJson(json['privacy'] as Map<String, dynamic>) : null,
    );
  }
}

class AgreementDto {
  final String id;
  final String type;
  final String version;
  final String bodyMd;
  final DateTime publishedAt;

  const AgreementDto({
    required this.id,
    required this.type,
    required this.version,
    required this.bodyMd,
    required this.publishedAt,
  });

  factory AgreementDto.fromJson(Map<String, dynamic> json) {
    return AgreementDto(
      id: json['id'] as String,
      type: json['type'] as String,
      version: json['version'] as String,
      bodyMd: json['bodyMd'] as String,
      publishedAt: DateTime.parse(json['publishedAt'] as String),
    );
  }
}
