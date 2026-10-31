import 'package:dio/dio.dart';

// M4 replaces feature transport calls with generated OpenAPI operations.
// No credentials are persisted by this foundation.
Dio createApiTransport(String baseUrl) {
  final uri = Uri.parse(baseUrl);
  if (!uri.hasAuthority || !['http', 'https'].contains(uri.scheme)) {
    throw ArgumentError.value(baseUrl, 'baseUrl', 'Expected an HTTP(S) URL');
  }
  return Dio(
    BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 15),
    ),
  );
}
