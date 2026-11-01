import 'dart:js_interop';
import 'package:dio/dio.dart';
import 'package:dio/browser.dart';
import 'package:web/web.dart' as web;

void configureBrowser(Dio transport) {
  transport.httpClientAdapter = BrowserHttpClientAdapter(withCredentials: true);
}

String? readCsrfCookie() {
  final values = web.document.cookie
      .split(';')
      .map((part) => part.trim())
      .where((part) => part.startsWith('__Host-maydon-csrf='))
      .toList();
  if (values.length != 1) return null;
  return values.single.substring('__Host-maydon-csrf='.length);
}

// Serialize rotation across tabs on this origin as well as within one app.
Future<void> protectRefresh(Future<void> Function() action) async {
  Object? failure;
  StackTrace? trace;
  await web.window.navigator.locks
      .request(
        'maydon-session-refresh-v1',
        ((web.Lock lock) {
          return (() async {
            try {
              await action();
            } catch (error, stack) {
              failure = error;
              trace = stack;
            }
            return null as JSAny?;
          })().toJS;
        }).toJS,
      )
      .toDart;
  if (failure != null) Error.throwWithStackTrace(failure!, trace!);
}
