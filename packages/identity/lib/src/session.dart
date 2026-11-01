import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:maydon_api_client/api_client.dart';
import 'storage.dart';
import 'browser_stub.dart' if (dart.library.js_interop) 'browser_web.dart';

class SessionController extends ChangeNotifier {
  SessionController({
    required this.api,
    required this.credentials,
    required this.web,
    String? Function()? csrf,
  }) : csrf = csrf ?? readCsrfCookie;
  final MaydonApi api;
  final CredentialStore credentials;
  final bool web;
  final String? Function() csrf;
  ProfileResponse? user;
  bool mfaRequired = false;
  bool restoring = false;
  String? restoreError;
  String? _access;
  DateTime? _expires;
  Future<void>? _rotation;
  bool _disposed = false;
  void _notify() {
    if (!_disposed) notifyListeners();
  }

  Map<String, dynamic> get _headers => {
    if (_access != null) 'Authorization': 'Bearer $_access',
    if (web && csrf() != null) 'X-CSRF-Token': csrf(),
  };
  Future<void> _accept(TokensResponse response) async {
    if (!web) {
      final token = response.refreshToken;
      if (token == null) throw StateError('Missing mobile refresh credential');
      try {
        await credentials.write(token);
      } catch (_) {
        // Do not leave an untracked authenticated session after storage failure.
        await api
            .authLogout(
              headers: {'Authorization': 'Bearer ${response.accessToken}'},
            )
            .catchError((_) => const RevokedResponse(revoked: false));
        _access = null;
        _expires = null;
        user = null;
        mfaRequired = false;
        try {
          await credentials.clear();
        } catch (_) {
          /* Report the original secure-storage failure. */
        }
        _notify();
        rethrow;
      }
    }
    _access = response.accessToken;
    _expires = DateTime.now().add(
      Duration(seconds: response.expiresIn.toInt() - 30),
    );
    user = response.user;
    mfaRequired = response.mfaRequired;
    restoreError = null;
    _notify();
  }

  Future<void> login(String email, String password) async {
    await _rotation;
    await _accept(
      await api.authLogin(
        body: LoginDto(
          email: email.trim(),
          password: password,
          client: web ? 'web' : 'mobile',
        ),
      ),
    );
  }

  Future<void> restore() async {
    restoring = true;
    restoreError = null;
    _notify();
    try {
      if (web ? csrf() != null : await credentials.read() != null) {
        await refresh();
      }
    } on DioException catch (error) {
      if (error.response?.statusCode == 401) {
        await _forget();
      } else {
        restoreError = 'CONNECTION';
      }
    } catch (_) {
      restoreError = 'STORAGE';
    } finally {
      restoring = false;
      _notify();
    }
  }

  // All in-flight calls share one rotation. Never retry an uncertain refresh:
  // the server may already have consumed it; reuse would revoke the session.
  Future<void> refresh() =>
      _rotation ??= protectRefresh(_refresh).whenComplete(() {
        _rotation = null;
      });
  Future<void> _refresh() async {
    final token = web ? null : await credentials.read();
    if (!web && token == null) throw StateError('No session');
    try {
      await _accept(
        await api.authRefresh(
          body: RefreshDto(client: web ? 'web' : 'mobile', refreshToken: token),
          headers: _headers,
        ),
      );
    } on DioException catch (error) {
      if (error.response?.statusCode == 401) await _forget();
      rethrow;
    }
  }

  Future<T> authorized<T>(
    Future<T> Function(Map<String, dynamic>) action,
  ) async {
    if (_access == null ||
        _expires == null ||
        DateTime.now().isAfter(_expires!)) {
      await refresh();
    }
    try {
      return await action(_headers);
    } on DioException catch (error) {
      if (error.response?.statusCode == 401) await _forget();
      // Mutations are never replayed automatically.
      rethrow;
    }
  }

  Future<void> loadProfile() async {
    user = await authorized((headers) => api.authMe(headers: headers));
    _notify();
  }

  Future<void> updateLocale(String locale) async {
    user = await authorized(
      (headers) => api.authProfile(
        body: ProfileDto(locale: locale),
        headers: headers,
      ),
    );
    _notify();
  }

  Future<void> logout({bool all = false}) async {
    await _rotation;
    await authorized(
      (headers) => all
          ? api.authRevoke(headers: headers)
          : api.authLogout(headers: headers),
    );
    await _forget();
  }

  Future<void> _forget() async {
    _access = null;
    _expires = null;
    user = null;
    mfaRequired = false;
    try {
      await credentials.clear();
    } finally {
      _notify();
    }
  }

  Future<void> verifyMfa(String code, {bool enrollment = false}) async {
    await authorized(
      (headers) => enrollment
          ? api.authConfirm(
              body: MfaCodeDto(code: code),
              headers: headers,
            )
          : api.authVerify(
              body: MfaCodeDto(code: code),
              headers: headers,
            ),
    );
    mfaRequired = false;
    await loadProfile();
  }

  @override
  void dispose() {
    _disposed = true;
    api.transport.close();
    super.dispose();
  }
}

SessionController createSession() {
  const configured = String.fromEnvironment('MAYDON_API_URL');
  final url = configured.isNotEmpty
      ? configured
      : (!kIsWeb && defaultTargetPlatform == TargetPlatform.android
            ? 'http://10.0.2.2:3000'
            : 'http://localhost:3000');
  final transport = createApiTransport(url);
  configureBrowser(transport);
  return SessionController(
    api: MaydonApi(transport),
    credentials: kIsWeb ? CookieCredentialStore() : NativeCredentialStore(),
    web: kIsWeb,
  );
}
