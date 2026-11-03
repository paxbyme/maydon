// GENERATED from docs/openapi.json. Do not edit.
// Contract SHA-256: 9445f61d08beeaf1cdd4e9387cbd717f3827c1e8941419b6a8aba77139e5d4f0
// dart format off
import 'package:dio/dio.dart';

class HealthResponse {
  const HealthResponse({required this.status});
  final String status;
  factory HealthResponse.fromJson(Map<String, dynamic> json) => HealthResponse(
    status: json['status'] as String,
  );
  Map<String, dynamic> toJson() => {
    'status': status,
  };
}

class VersionResponse {
  const VersionResponse({required this.service, required this.version, required this.apiVersion});
  final String service;
  final String version;
  final String apiVersion;
  factory VersionResponse.fromJson(Map<String, dynamic> json) => VersionResponse(
    service: json['service'] as String,
    version: json['version'] as String,
    apiVersion: json['apiVersion'] as String,
  );
  Map<String, dynamic> toJson() => {
    'service': service,
    'version': version,
    'apiVersion': apiVersion,
  };
}

class RegisterDto {
  const RegisterDto({required this.email, required this.password, required this.displayName, this.locale});
  final String email;
  final String password;
  final String displayName;
  final String? locale;
  factory RegisterDto.fromJson(Map<String, dynamic> json) => RegisterDto(
    email: json['email'] as String,
    password: json['password'] as String,
    displayName: json['displayName'] as String,
    locale: json['locale'] == null ? null : json['locale'] as String,
  );
  Map<String, dynamic> toJson() => {
    'email': email,
    'password': password,
    'displayName': displayName,
    if (locale != null) 'locale': locale,
  };
}

class AcceptedResponse {
  const AcceptedResponse({required this.accepted});
  final bool accepted;
  factory AcceptedResponse.fromJson(Map<String, dynamic> json) => AcceptedResponse(
    accepted: json['accepted'] as bool,
  );
  Map<String, dynamic> toJson() => {
    'accepted': accepted,
  };
}

class EmailDto {
  const EmailDto({required this.email});
  final String email;
  factory EmailDto.fromJson(Map<String, dynamic> json) => EmailDto(
    email: json['email'] as String,
  );
  Map<String, dynamic> toJson() => {
    'email': email,
  };
}

class ChallengeDto {
  const ChallengeDto({required this.challengeId, required this.code});
  final String challengeId;
  final String code;
  factory ChallengeDto.fromJson(Map<String, dynamic> json) => ChallengeDto(
    challengeId: json['challengeId'] as String,
    code: json['code'] as String,
  );
  Map<String, dynamic> toJson() => {
    'challengeId': challengeId,
    'code': code,
  };
}

class VerifiedResponse {
  const VerifiedResponse({required this.verified});
  final bool verified;
  factory VerifiedResponse.fromJson(Map<String, dynamic> json) => VerifiedResponse(
    verified: json['verified'] as bool,
  );
  Map<String, dynamic> toJson() => {
    'verified': verified,
  };
}

class ResetPasswordDto {
  const ResetPasswordDto({required this.challengeId, required this.code, required this.password});
  final String challengeId;
  final String code;
  final String password;
  factory ResetPasswordDto.fromJson(Map<String, dynamic> json) => ResetPasswordDto(
    challengeId: json['challengeId'] as String,
    code: json['code'] as String,
    password: json['password'] as String,
  );
  Map<String, dynamic> toJson() => {
    'challengeId': challengeId,
    'code': code,
    'password': password,
  };
}

class LoginDto {
  const LoginDto({required this.email, required this.password, required this.client});
  final String email;
  final String password;
  final String client;
  factory LoginDto.fromJson(Map<String, dynamic> json) => LoginDto(
    email: json['email'] as String,
    password: json['password'] as String,
    client: json['client'] as String,
  );
  Map<String, dynamic> toJson() => {
    'email': email,
    'password': password,
    'client': client,
  };
}

class ProfileResponse {
  const ProfileResponse({required this.id, required this.email, required this.displayName, required this.locale, required this.emailVerified, required this.phone, required this.phoneVerified, required this.mfaEnabled});
  final String id;
  final String email;
  final String displayName;
  final String locale;
  final bool emailVerified;
  final String? phone;
  final bool phoneVerified;
  final bool mfaEnabled;
  factory ProfileResponse.fromJson(Map<String, dynamic> json) => ProfileResponse(
    id: json['id'] as String,
    email: json['email'] as String,
    displayName: json['displayName'] as String,
    locale: json['locale'] as String,
    emailVerified: json['emailVerified'] as bool,
    phone: json['phone'] == null ? null : json['phone'] as String,
    phoneVerified: json['phoneVerified'] as bool,
    mfaEnabled: json['mfaEnabled'] as bool,
  );
  Map<String, dynamic> toJson() => {
    'id': id,
    'email': email,
    'displayName': displayName,
    'locale': locale,
    'emailVerified': emailVerified,
    'phone': phone,
    'phoneVerified': phoneVerified,
    'mfaEnabled': mfaEnabled,
  };
}

class TokensResponse {
  const TokensResponse({required this.accessToken, required this.expiresIn, required this.refreshExpiresAt, this.refreshToken, required this.mfaRequired, required this.user});
  final String accessToken;
  final num expiresIn;
  final String refreshExpiresAt;
  final String? refreshToken;
  final bool mfaRequired;
  final ProfileResponse user;
  factory TokensResponse.fromJson(Map<String, dynamic> json) => TokensResponse(
    accessToken: json['accessToken'] as String,
    expiresIn: json['expiresIn'] as num,
    refreshExpiresAt: json['refreshExpiresAt'] as String,
    refreshToken: json['refreshToken'] == null ? null : json['refreshToken'] as String,
    mfaRequired: json['mfaRequired'] as bool,
    user: ProfileResponse.fromJson(json['user'] as Map<String, dynamic>),
  );
  Map<String, dynamic> toJson() => {
    'accessToken': accessToken,
    'expiresIn': expiresIn,
    'refreshExpiresAt': refreshExpiresAt,
    if (refreshToken != null) 'refreshToken': refreshToken,
    'mfaRequired': mfaRequired,
    'user': user.toJson(),
  };
}

class RefreshDto {
  const RefreshDto({required this.client, this.refreshToken});
  final String client;
  final String? refreshToken;
  factory RefreshDto.fromJson(Map<String, dynamic> json) => RefreshDto(
    client: json['client'] as String,
    refreshToken: json['refreshToken'] == null ? null : json['refreshToken'] as String,
  );
  Map<String, dynamic> toJson() => {
    'client': client,
    if (refreshToken != null) 'refreshToken': refreshToken,
  };
}

class ProfileDto {
  const ProfileDto({this.displayName, this.locale});
  final String? displayName;
  final String? locale;
  factory ProfileDto.fromJson(Map<String, dynamic> json) => ProfileDto(
    displayName: json['displayName'] == null ? null : json['displayName'] as String,
    locale: json['locale'] == null ? null : json['locale'] as String,
  );
  Map<String, dynamic> toJson() => {
    if (displayName != null) 'displayName': displayName,
    if (locale != null) 'locale': locale,
  };
}

class PhoneDto {
  const PhoneDto({required this.phone});
  final String phone;
  factory PhoneDto.fromJson(Map<String, dynamic> json) => PhoneDto(
    phone: json['phone'] as String,
  );
  Map<String, dynamic> toJson() => {
    'phone': phone,
  };
}

class RevokedResponse {
  const RevokedResponse({required this.revoked});
  final bool revoked;
  factory RevokedResponse.fromJson(Map<String, dynamic> json) => RevokedResponse(
    revoked: json['revoked'] as bool,
  );
  Map<String, dynamic> toJson() => {
    'revoked': revoked,
  };
}

class MfaSetupDto {
  const MfaSetupDto({required this.password});
  final String password;
  factory MfaSetupDto.fromJson(Map<String, dynamic> json) => MfaSetupDto(
    password: json['password'] as String,
  );
  Map<String, dynamic> toJson() => {
    'password': password,
  };
}

class MfaSetupResponse {
  const MfaSetupResponse({required this.secret, required this.uri});
  final String secret;
  final String uri;
  factory MfaSetupResponse.fromJson(Map<String, dynamic> json) => MfaSetupResponse(
    secret: json['secret'] as String,
    uri: json['uri'] as String,
  );
  Map<String, dynamic> toJson() => {
    'secret': secret,
    'uri': uri,
  };
}

class MfaCodeDto {
  const MfaCodeDto({required this.code});
  final String code;
  factory MfaCodeDto.fromJson(Map<String, dynamic> json) => MfaCodeDto(
    code: json['code'] as String,
  );
  Map<String, dynamic> toJson() => {
    'code': code,
  };
}

class AssignmentDto {
  const AssignmentDto({required this.preset});
  final String preset;
  factory AssignmentDto.fromJson(Map<String, dynamic> json) => AssignmentDto(
    preset: json['preset'] as String,
  );
  Map<String, dynamic> toJson() => {
    'preset': preset,
  };
}

class BusinessResponse {
  const BusinessResponse({required this.id, required this.legalName, required this.status, required this.reviewReason, required this.createdAt});
  final String id;
  final String legalName;
  final String status;
  final String? reviewReason;
  final String createdAt;
  factory BusinessResponse.fromJson(Map<String, dynamic> json) => BusinessResponse(
    id: json['id'] as String,
    legalName: json['legalName'] as String,
    status: json['status'] as String,
    reviewReason: json['reviewReason'] == null ? null : json['reviewReason'] as String,
    createdAt: json['createdAt'] as String,
  );
  Map<String, dynamic> toJson() => {
    'id': id,
    'legalName': legalName,
    'status': status,
    'reviewReason': reviewReason,
    'createdAt': createdAt,
  };
}

class BusinessPageResponse {
  const BusinessPageResponse({required this.items, required this.nextCursor});
  final List<BusinessResponse> items;
  final String? nextCursor;
  factory BusinessPageResponse.fromJson(Map<String, dynamic> json) => BusinessPageResponse(
    items: (json['items'] as List<dynamic>).map((item) => BusinessResponse.fromJson(item as Map<String, dynamic>)).toList(),
    nextCursor: json['nextCursor'] == null ? null : json['nextCursor'] as String,
  );
  Map<String, dynamic> toJson() => {
    'items': items.map((item) => item.toJson()).toList(),
    'nextCursor': nextCursor,
  };
}

class BusinessSubmissionDto {
  const BusinessSubmissionDto({required this.legalName, required this.evidence});
  final String legalName;
  final String evidence;
  factory BusinessSubmissionDto.fromJson(Map<String, dynamic> json) => BusinessSubmissionDto(
    legalName: json['legalName'] as String,
    evidence: json['evidence'] as String,
  );
  Map<String, dynamic> toJson() => {
    'legalName': legalName,
    'evidence': evidence,
  };
}

class BusinessEvidenceResponse {
  const BusinessEvidenceResponse({required this.evidence});
  final String evidence;
  factory BusinessEvidenceResponse.fromJson(Map<String, dynamic> json) => BusinessEvidenceResponse(
    evidence: json['evidence'] as String,
  );
  Map<String, dynamic> toJson() => {
    'evidence': evidence,
  };
}

class BusinessReviewDto {
  const BusinessReviewDto({required this.decision, required this.reason});
  final String decision;
  final String reason;
  factory BusinessReviewDto.fromJson(Map<String, dynamic> json) => BusinessReviewDto(
    decision: json['decision'] as String,
    reason: json['reason'] as String,
  );
  Map<String, dynamic> toJson() => {
    'decision': decision,
    'reason': reason,
  };
}

class FacilityTranslationDto {
  const FacilityTranslationDto({required this.locale, required this.name, required this.description});
  final String locale;
  final String name;
  final String description;
  factory FacilityTranslationDto.fromJson(Map<String, dynamic> json) => FacilityTranslationDto(
    locale: json['locale'] as String,
    name: json['name'] as String,
    description: json['description'] as String,
  );
  Map<String, dynamic> toJson() => {
    'locale': locale,
    'name': name,
    'description': description,
  };
}

class FacilityResponse {
  const FacilityResponse({required this.id, required this.ownerId, required this.city, required this.timezone, required this.address, required this.latitude, required this.longitude, required this.status, required this.reviewReason, required this.revision, required this.translations});
  final String id;
  final String ownerId;
  final String city;
  final String timezone;
  final String address;
  final num? latitude;
  final num? longitude;
  final String status;
  final String? reviewReason;
  final int revision;
  final List<FacilityTranslationDto> translations;
  factory FacilityResponse.fromJson(Map<String, dynamic> json) => FacilityResponse(
    id: json['id'] as String,
    ownerId: json['ownerId'] as String,
    city: json['city'] as String,
    timezone: json['timezone'] as String,
    address: json['address'] as String,
    latitude: json['latitude'] == null ? null : json['latitude'] as num,
    longitude: json['longitude'] == null ? null : json['longitude'] as num,
    status: json['status'] as String,
    reviewReason: json['reviewReason'] == null ? null : json['reviewReason'] as String,
    revision: json['revision'] as int,
    translations: (json['translations'] as List<dynamic>).map((item) => FacilityTranslationDto.fromJson(item as Map<String, dynamic>)).toList(),
  );
  Map<String, dynamic> toJson() => {
    'id': id,
    'ownerId': ownerId,
    'city': city,
    'timezone': timezone,
    'address': address,
    'latitude': latitude,
    'longitude': longitude,
    'status': status,
    'reviewReason': reviewReason,
    'revision': revision,
    'translations': translations.map((item) => item.toJson()).toList(),
  };
}

class FacilityPageResponse {
  const FacilityPageResponse({required this.canEdit, required this.items, required this.nextCursor});
  final bool canEdit;
  final List<FacilityResponse> items;
  final String? nextCursor;
  factory FacilityPageResponse.fromJson(Map<String, dynamic> json) => FacilityPageResponse(
    canEdit: json['canEdit'] as bool,
    items: (json['items'] as List<dynamic>).map((item) => FacilityResponse.fromJson(item as Map<String, dynamic>)).toList(),
    nextCursor: json['nextCursor'] == null ? null : json['nextCursor'] as String,
  );
  Map<String, dynamic> toJson() => {
    'canEdit': canEdit,
    'items': items.map((item) => item.toJson()).toList(),
    'nextCursor': nextCursor,
  };
}

class FacilityCreateDto {
  const FacilityCreateDto({required this.address, required this.latitude, required this.longitude, required this.translations});
  final String address;
  final num latitude;
  final num longitude;
  final List<FacilityTranslationDto> translations;
  factory FacilityCreateDto.fromJson(Map<String, dynamic> json) => FacilityCreateDto(
    address: json['address'] as String,
    latitude: json['latitude'] as num,
    longitude: json['longitude'] as num,
    translations: (json['translations'] as List<dynamic>).map((item) => FacilityTranslationDto.fromJson(item as Map<String, dynamic>)).toList(),
  );
  Map<String, dynamic> toJson() => {
    'address': address,
    'latitude': latitude,
    'longitude': longitude,
    'translations': translations.map((item) => item.toJson()).toList(),
  };
}

class FacilityUpdateDto {
  const FacilityUpdateDto({required this.address, required this.latitude, required this.longitude, required this.translations, required this.expectedRevision});
  final String address;
  final num latitude;
  final num longitude;
  final List<FacilityTranslationDto> translations;
  final int expectedRevision;
  factory FacilityUpdateDto.fromJson(Map<String, dynamic> json) => FacilityUpdateDto(
    address: json['address'] as String,
    latitude: json['latitude'] as num,
    longitude: json['longitude'] as num,
    translations: (json['translations'] as List<dynamic>).map((item) => FacilityTranslationDto.fromJson(item as Map<String, dynamic>)).toList(),
    expectedRevision: json['expectedRevision'] as int,
  );
  Map<String, dynamic> toJson() => {
    'address': address,
    'latitude': latitude,
    'longitude': longitude,
    'translations': translations.map((item) => item.toJson()).toList(),
    'expectedRevision': expectedRevision,
  };
}

class SportTranslationDto {
  const SportTranslationDto({required this.locale, required this.name});
  final String locale;
  final String name;
  factory SportTranslationDto.fromJson(Map<String, dynamic> json) => SportTranslationDto(
    locale: json['locale'] as String,
    name: json['name'] as String,
  );
  Map<String, dynamic> toJson() => {
    'locale': locale,
    'name': name,
  };
}

class SportResponse {
  const SportResponse({required this.id, required this.slug, required this.active, required this.revision, required this.translations});
  final String id;
  final String slug;
  final bool active;
  final int revision;
  final List<SportTranslationDto> translations;
  factory SportResponse.fromJson(Map<String, dynamic> json) => SportResponse(
    id: json['id'] as String,
    slug: json['slug'] as String,
    active: json['active'] as bool,
    revision: json['revision'] as int,
    translations: (json['translations'] as List<dynamic>).map((item) => SportTranslationDto.fromJson(item as Map<String, dynamic>)).toList(),
  );
  Map<String, dynamic> toJson() => {
    'id': id,
    'slug': slug,
    'active': active,
    'revision': revision,
    'translations': translations.map((item) => item.toJson()).toList(),
  };
}

class SportPageResponse {
  const SportPageResponse({required this.items, required this.nextCursor});
  final List<SportResponse> items;
  final String? nextCursor;
  factory SportPageResponse.fromJson(Map<String, dynamic> json) => SportPageResponse(
    items: (json['items'] as List<dynamic>).map((item) => SportResponse.fromJson(item as Map<String, dynamic>)).toList(),
    nextCursor: json['nextCursor'] == null ? null : json['nextCursor'] as String,
  );
  Map<String, dynamic> toJson() => {
    'items': items.map((item) => item.toJson()).toList(),
    'nextCursor': nextCursor,
  };
}

class SportCreateDto {
  const SportCreateDto({required this.active, required this.translations, required this.slug});
  final bool active;
  final List<SportTranslationDto> translations;
  final String slug;
  factory SportCreateDto.fromJson(Map<String, dynamic> json) => SportCreateDto(
    active: json['active'] as bool,
    translations: (json['translations'] as List<dynamic>).map((item) => SportTranslationDto.fromJson(item as Map<String, dynamic>)).toList(),
    slug: json['slug'] as String,
  );
  Map<String, dynamic> toJson() => {
    'active': active,
    'translations': translations.map((item) => item.toJson()).toList(),
    'slug': slug,
  };
}

class SportUpdateDto {
  const SportUpdateDto({required this.active, required this.translations, required this.expectedRevision});
  final bool active;
  final List<SportTranslationDto> translations;
  final int expectedRevision;
  factory SportUpdateDto.fromJson(Map<String, dynamic> json) => SportUpdateDto(
    active: json['active'] as bool,
    translations: (json['translations'] as List<dynamic>).map((item) => SportTranslationDto.fromJson(item as Map<String, dynamic>)).toList(),
    expectedRevision: json['expectedRevision'] as int,
  );
  Map<String, dynamic> toJson() => {
    'active': active,
    'translations': translations.map((item) => item.toJson()).toList(),
    'expectedRevision': expectedRevision,
  };
}

class MaydonApi {
  MaydonApi(this.transport);
  final Dio transport;
  Future<HealthResponse> getHealth({Map<String, dynamic>? headers}) async {
    final response = await transport.request<Map<String, dynamic>>(
      '/api/v1/health',
      options: Options(method: 'GET', headers: headers),
    );
    return HealthResponse.fromJson(response.data!);
  }
  Future<VersionResponse> getVersion({Map<String, dynamic>? headers}) async {
    final response = await transport.request<Map<String, dynamic>>(
      '/api/v1/version',
      options: Options(method: 'GET', headers: headers),
    );
    return VersionResponse.fromJson(response.data!);
  }
  Future<AcceptedResponse> authRegister({required RegisterDto body, Map<String, dynamic>? headers}) async {
    final response = await transport.request<Map<String, dynamic>>(
      '/api/v1/auth/register',
      data: body.toJson(),
      options: Options(method: 'POST', headers: headers),
    );
    return AcceptedResponse.fromJson(response.data!);
  }
  Future<AcceptedResponse> authResend({required EmailDto body, Map<String, dynamic>? headers}) async {
    final response = await transport.request<Map<String, dynamic>>(
      '/api/v1/auth/email/resend',
      data: body.toJson(),
      options: Options(method: 'POST', headers: headers),
    );
    return AcceptedResponse.fromJson(response.data!);
  }
  Future<VerifiedResponse> authVerifyEmail({required ChallengeDto body, Map<String, dynamic>? headers}) async {
    final response = await transport.request<Map<String, dynamic>>(
      '/api/v1/auth/email/verify',
      data: body.toJson(),
      options: Options(method: 'POST', headers: headers),
    );
    return VerifiedResponse.fromJson(response.data!);
  }
  Future<AcceptedResponse> authForgot({required EmailDto body, Map<String, dynamic>? headers}) async {
    final response = await transport.request<Map<String, dynamic>>(
      '/api/v1/auth/password/forgot',
      data: body.toJson(),
      options: Options(method: 'POST', headers: headers),
    );
    return AcceptedResponse.fromJson(response.data!);
  }
  Future<VerifiedResponse> authReset({required ResetPasswordDto body, Map<String, dynamic>? headers}) async {
    final response = await transport.request<Map<String, dynamic>>(
      '/api/v1/auth/password/reset',
      data: body.toJson(),
      options: Options(method: 'POST', headers: headers),
    );
    return VerifiedResponse.fromJson(response.data!);
  }
  Future<TokensResponse> authLogin({required LoginDto body, Map<String, dynamic>? headers}) async {
    final response = await transport.request<Map<String, dynamic>>(
      '/api/v1/auth/login',
      data: body.toJson(),
      options: Options(method: 'POST', headers: headers),
    );
    return TokensResponse.fromJson(response.data!);
  }
  Future<TokensResponse> authRefresh({required RefreshDto body, Map<String, dynamic>? headers}) async {
    final response = await transport.request<Map<String, dynamic>>(
      '/api/v1/auth/refresh',
      data: body.toJson(),
      options: Options(method: 'POST', headers: headers),
    );
    return TokensResponse.fromJson(response.data!);
  }
  Future<ProfileResponse> authMe({Map<String, dynamic>? headers}) async {
    final response = await transport.request<Map<String, dynamic>>(
      '/api/v1/auth/me',
      options: Options(method: 'GET', headers: headers),
    );
    return ProfileResponse.fromJson(response.data!);
  }
  Future<ProfileResponse> authProfile({required ProfileDto body, Map<String, dynamic>? headers}) async {
    final response = await transport.request<Map<String, dynamic>>(
      '/api/v1/auth/me',
      data: body.toJson(),
      options: Options(method: 'PATCH', headers: headers),
    );
    return ProfileResponse.fromJson(response.data!);
  }
  Future<AcceptedResponse> authPhone({required PhoneDto body, Map<String, dynamic>? headers}) async {
    final response = await transport.request<Map<String, dynamic>>(
      '/api/v1/auth/phone/request',
      data: body.toJson(),
      options: Options(method: 'POST', headers: headers),
    );
    return AcceptedResponse.fromJson(response.data!);
  }
  Future<VerifiedResponse> authVerifyPhone({required ChallengeDto body, Map<String, dynamic>? headers}) async {
    final response = await transport.request<Map<String, dynamic>>(
      '/api/v1/auth/phone/verify',
      data: body.toJson(),
      options: Options(method: 'POST', headers: headers),
    );
    return VerifiedResponse.fromJson(response.data!);
  }
  Future<RevokedResponse> authLogout({Map<String, dynamic>? headers}) async {
    final response = await transport.request<Map<String, dynamic>>(
      '/api/v1/auth/logout',
      options: Options(method: 'POST', headers: headers),
    );
    return RevokedResponse.fromJson(response.data!);
  }
  Future<RevokedResponse> authRevoke({Map<String, dynamic>? headers}) async {
    final response = await transport.request<Map<String, dynamic>>(
      '/api/v1/auth/sessions/revoke',
      options: Options(method: 'POST', headers: headers),
    );
    return RevokedResponse.fromJson(response.data!);
  }
  Future<MfaSetupResponse> authSetup({required MfaSetupDto body, Map<String, dynamic>? headers}) async {
    final response = await transport.request<Map<String, dynamic>>(
      '/api/v1/auth/mfa/setup',
      data: body.toJson(),
      options: Options(method: 'POST', headers: headers),
    );
    return MfaSetupResponse.fromJson(response.data!);
  }
  Future<VerifiedResponse> authConfirm({required MfaCodeDto body, Map<String, dynamic>? headers}) async {
    final response = await transport.request<Map<String, dynamic>>(
      '/api/v1/auth/mfa/confirm',
      data: body.toJson(),
      options: Options(method: 'POST', headers: headers),
    );
    return VerifiedResponse.fromJson(response.data!);
  }
  Future<VerifiedResponse> authVerify({required MfaCodeDto body, Map<String, dynamic>? headers}) async {
    final response = await transport.request<Map<String, dynamic>>(
      '/api/v1/auth/mfa/verify',
      data: body.toJson(),
      options: Options(method: 'POST', headers: headers),
    );
    return VerifiedResponse.fromJson(response.data!);
  }
  Future<Map<String, dynamic>> staffAssign({required String resourceId, required String userId, required AssignmentDto body, Map<String, dynamic>? headers}) async {
    final response = await transport.request<Map<String, dynamic>>(
      '/api/v1/resources/${Uri.encodeComponent(resourceId)}/staff/${Uri.encodeComponent(userId)}',
      data: body.toJson(),
      options: Options(method: 'PUT', headers: headers),
    );
    return response.data!;
  }
  Future<Map<String, dynamic>> staffRevoke({required String resourceId, required String userId, Map<String, dynamic>? headers}) async {
    final response = await transport.request<Map<String, dynamic>>(
      '/api/v1/resources/${Uri.encodeComponent(resourceId)}/staff/${Uri.encodeComponent(userId)}',
      options: Options(method: 'DELETE', headers: headers),
    );
    return response.data!;
  }
  Future<BusinessPageResponse> businessesList({String? cursor, Map<String, dynamic>? headers}) async {
    final response = await transport.request<Map<String, dynamic>>(
      '/api/v1/businesses',
      queryParameters: {if (cursor != null) 'cursor': cursor},
      options: Options(method: 'GET', headers: headers),
    );
    return BusinessPageResponse.fromJson(response.data!);
  }
  Future<BusinessResponse> businessesSubmit({required BusinessSubmissionDto body, Map<String, dynamic>? headers}) async {
    final response = await transport.request<Map<String, dynamic>>(
      '/api/v1/businesses',
      data: body.toJson(),
      options: Options(method: 'POST', headers: headers),
    );
    return BusinessResponse.fromJson(response.data!);
  }
  Future<BusinessResponse> businessesResubmit({required String id, required BusinessSubmissionDto body, Map<String, dynamic>? headers}) async {
    final response = await transport.request<Map<String, dynamic>>(
      '/api/v1/businesses/${Uri.encodeComponent(id)}/submission',
      data: body.toJson(),
      options: Options(method: 'PUT', headers: headers),
    );
    return BusinessResponse.fromJson(response.data!);
  }
  Future<BusinessPageResponse> businessReviewQueue({String? cursor, Map<String, dynamic>? headers}) async {
    final response = await transport.request<Map<String, dynamic>>(
      '/api/v1/admin/businesses',
      queryParameters: {if (cursor != null) 'cursor': cursor},
      options: Options(method: 'GET', headers: headers),
    );
    return BusinessPageResponse.fromJson(response.data!);
  }
  Future<BusinessEvidenceResponse> businessReviewEvidence({required String id, Map<String, dynamic>? headers}) async {
    final response = await transport.request<Map<String, dynamic>>(
      '/api/v1/admin/businesses/${Uri.encodeComponent(id)}/evidence',
      options: Options(method: 'GET', headers: headers),
    );
    return BusinessEvidenceResponse.fromJson(response.data!);
  }
  Future<BusinessResponse> businessReviewReview({required String id, required BusinessReviewDto body, Map<String, dynamic>? headers}) async {
    final response = await transport.request<Map<String, dynamic>>(
      '/api/v1/admin/businesses/${Uri.encodeComponent(id)}/review',
      data: body.toJson(),
      options: Options(method: 'PUT', headers: headers),
    );
    return BusinessResponse.fromJson(response.data!);
  }
  Future<FacilityPageResponse> facilitiesList({required String ownerId, String? cursor, Map<String, dynamic>? headers}) async {
    final response = await transport.request<Map<String, dynamic>>(
      '/api/v1/businesses/${Uri.encodeComponent(ownerId)}/facilities',
      queryParameters: {if (cursor != null) 'cursor': cursor},
      options: Options(method: 'GET', headers: headers),
    );
    return FacilityPageResponse.fromJson(response.data!);
  }
  Future<FacilityResponse> facilitiesCreate({required String ownerId, required FacilityCreateDto body, Map<String, dynamic>? headers}) async {
    final response = await transport.request<Map<String, dynamic>>(
      '/api/v1/businesses/${Uri.encodeComponent(ownerId)}/facilities',
      data: body.toJson(),
      options: Options(method: 'POST', headers: headers),
    );
    return FacilityResponse.fromJson(response.data!);
  }
  Future<FacilityResponse> facilitiesUpdate({required String ownerId, required String id, required FacilityUpdateDto body, Map<String, dynamic>? headers}) async {
    final response = await transport.request<Map<String, dynamic>>(
      '/api/v1/businesses/${Uri.encodeComponent(ownerId)}/facilities/${Uri.encodeComponent(id)}',
      data: body.toJson(),
      options: Options(method: 'PUT', headers: headers),
    );
    return FacilityResponse.fromJson(response.data!);
  }
  Future<SportPageResponse> sportsList({String? cursor, Map<String, dynamic>? headers}) async {
    final response = await transport.request<Map<String, dynamic>>(
      '/api/v1/sports',
      queryParameters: {if (cursor != null) 'cursor': cursor},
      options: Options(method: 'GET', headers: headers),
    );
    return SportPageResponse.fromJson(response.data!);
  }
  Future<SportPageResponse> sportsAdminList({String? cursor, Map<String, dynamic>? headers}) async {
    final response = await transport.request<Map<String, dynamic>>(
      '/api/v1/admin/sports',
      queryParameters: {if (cursor != null) 'cursor': cursor},
      options: Options(method: 'GET', headers: headers),
    );
    return SportPageResponse.fromJson(response.data!);
  }
  Future<SportResponse> sportsAdminCreate({required SportCreateDto body, Map<String, dynamic>? headers}) async {
    final response = await transport.request<Map<String, dynamic>>(
      '/api/v1/admin/sports',
      data: body.toJson(),
      options: Options(method: 'POST', headers: headers),
    );
    return SportResponse.fromJson(response.data!);
  }
  Future<SportResponse> sportsAdminUpdate({required String id, required SportUpdateDto body, Map<String, dynamic>? headers}) async {
    final response = await transport.request<Map<String, dynamic>>(
      '/api/v1/admin/sports/${Uri.encodeComponent(id)}',
      data: body.toJson(),
      options: Options(method: 'PUT', headers: headers),
    );
    return SportResponse.fromJson(response.data!);
  }
}
// dart format on
