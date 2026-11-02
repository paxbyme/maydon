import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:maydon_api_client/api_client.dart';
import 'package:maydon_identity/identity.dart';

class MemoryCredentials implements CredentialStore {
  String? value;
  int writes = 0;
  bool failWrites = false;
  @override
  Future<String?> read() async => value;
  @override
  Future<void> write(String token) async {
    writes++;
    if (failWrites) throw StateError('Device unavailable');
    value = token;
  }

  @override
  Future<void> clear() async {
    value = null;
  }
}

class FakeAdapter implements HttpClientAdapter {
  FakeAdapter(this.handle);
  final Future<ResponseBody> Function(RequestOptions) handle;
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) => handle(options);
  @override
  void close({bool force = false}) {}
}

ResponseBody jsonBody(Object data, [int status = 200]) =>
    ResponseBody.fromString(
      jsonEncode(data),
      status,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );
final profile = {
  'id': '11111111-1111-4111-8111-111111111111',
  'email': 'test@example.test',
  'displayName': 'Test',
  'locale': 'uz',
  'emailVerified': true,
  'phone': null,
  'phoneVerified': false,
  'mfaEnabled': false,
};
Map<String, Object?> tokens({
  bool web = false,
  String token = 'new-credential',
}) => {
  'accessToken': 'test-access',
  'expiresIn': 900,
  'refreshExpiresAt': '2026-12-01T00:00:00Z',
  'mfaRequired': false,
  'user': profile,
  if (!web) 'refreshToken': token,
};
SessionController controller(
  MemoryCredentials store,
  Future<ResponseBody> Function(RequestOptions) handle, {
  bool web = false,
}) {
  final dio = createApiTransport('https://maydon.example');
  dio.httpClientAdapter = FakeAdapter(handle);
  return SessionController(
    api: MaydonApi(dio),
    credentials: store,
    web: web,
    csrf: () => 'test-csrf',
  );
}

void main() {
  test(
    'mobile login persists only refresh credentials; requests use memory access token',
    () async {
      final store = MemoryCredentials();
      final session = controller(store, (request) async {
        if (request.path.endsWith('/login')) {
          expect(request.data['client'], 'mobile');
          return jsonBody(tokens());
        }
        expect(request.headers['Authorization'], 'Bearer test-access');
        expect(request.headers.containsKey('X-CSRF-Token'), false);
        return jsonBody(profile);
      });
      addTearDown(session.dispose);
      await session.login('test@example.test', 'password');
      expect(store.value, 'new-credential');
      await session.loadProfile();
      expect(session.user?.email, 'test@example.test');
    },
  );
  test(
    'browser login never writes refresh or access credentials; rotation sends CSRF',
    () async {
      final store = MemoryCredentials()..failWrites = true;
      final session = controller(store, (request) async {
        expect(request.data['client'], 'web');
        expect(request.data.containsKey('refreshToken'), false);
        if (request.path.endsWith('/refresh')) {
          expect(request.headers['X-CSRF-Token'], 'test-csrf');
        }
        return jsonBody(tokens(web: true));
      }, web: true);
      addTearDown(session.dispose);
      await session.login('test@example.test', 'password');
      await session.refresh();
      expect(store.writes, 0);
      expect(store.value, null);
    },
  );
  test(
    'twenty concurrent refresh requests share one rotation and persist successor',
    () async {
      final store = MemoryCredentials()..value = 'old-credential';
      final gate = Completer<void>();
      var calls = 0;
      final session = controller(store, (request) async {
        calls++;
        expect(request.data['refreshToken'], 'old-credential');
        await gate.future;
        return jsonBody(tokens());
      });
      addTearDown(session.dispose);
      final pending = List.generate(20, (_) => session.refresh());
      await Future<void>.delayed(Duration.zero);
      gate.complete();
      await Future.wait(pending);
      expect(calls, 1);
      expect(store.value, 'new-credential');
    },
  );
  test(
    'revoked restore clears local credentials and exposes no signed-in profile',
    () async {
      final store = MemoryCredentials()..value = 'revoked';
      final session = controller(
        store,
        (_) async => jsonBody({'code': 'UNAUTHENTICATED'}, 401),
      );
      addTearDown(session.dispose);
      await session.restore();
      expect(store.value, null);
      expect(session.user, null);
      expect(session.restoring, false);
    },
  );
  test(
    'a rejected protected mutation is not replayed and revokes local state',
    () async {
      final store = MemoryCredentials();
      var mutations = 0;
      final session = controller(store, (request) async {
        if (request.path.endsWith('/login')) return jsonBody(tokens());
        mutations++;
        return jsonBody({'code': 'UNAUTHENTICATED'}, 401);
      });
      addTearDown(session.dispose);
      await session.login('test@example.test', 'password');
      await expectLater(
        session.updateLocale('ru'),
        throwsA(isA<DioException>()),
      );
      expect(mutations, 1);
      expect(session.user, null);
      expect(store.value, null);
    },
  );
  test(
    'failed secure storage rolls back new session before exposing user',
    () async {
      final store = MemoryCredentials()..failWrites = true;
      var revoked = 0;
      final session = controller(store, (request) async {
        if (request.path.endsWith('/login')) return jsonBody(tokens());
        expect(request.path, '/api/v1/auth/logout');
        revoked++;
        return jsonBody({'revoked': true});
      });
      addTearDown(session.dispose);
      await expectLater(
        session.login('test@example.test', 'password'),
        throwsStateError,
      );
      expect(revoked, 1);
      expect(session.user, null);
      expect(store.value, null);
    },
  );
  test(
    'failed logout remains signed in and can be retried; no false success',
    () async {
      final store = MemoryCredentials();
      var fail = true;
      final session = controller(store, (request) async {
        if (request.path.endsWith('/login')) return jsonBody(tokens());
        if (fail) return jsonBody({'code': 'SERVICE_UNAVAILABLE'}, 503);
        return jsonBody({'revoked': true});
      });
      addTearDown(session.dispose);
      await session.login('test@example.test', 'password');
      await expectLater(session.logout(), throwsA(isA<DioException>()));
      expect(session.user, isNotNull);
      fail = false;
      await session.logout();
      expect(session.user, null);
      expect(store.value, null);
    },
  );
  test(
    'locale choice survives a new controller and rejects unsupported codes',
    () async {
      final store = MemoryLocaleStore();
      final first = LocaleController(store, null);
      await first.select('ru');
      first.dispose();
      final second = LocaleController(store, null);
      await second.select((await store.read())!);
      expect(second.state?.languageCode, 'ru');
      await expectLater(second.select('xx'), throwsArgumentError);
      second.dispose();
    },
  );
}
