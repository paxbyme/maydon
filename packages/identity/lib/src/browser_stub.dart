import 'package:dio/dio.dart';

void configureBrowser(Dio transport) {}
String? readCsrfCookie() => null;
Future<void> protectRefresh(Future<void> Function() action) => action();
