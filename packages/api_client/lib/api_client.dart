export 'generated/api.g.dart';

import 'package:dio/dio.dart';

// Transport owns no persistent credentials; session storage belongs to the client.
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
