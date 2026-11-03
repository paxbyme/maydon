import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:maydon_api_client/api_client.dart';
import 'package:maydon_identity/identity.dart';
import 'package:maydon_localization/localization.dart';
import 'package:maydon_admin/sports_editor.dart';

class SportApi extends MaydonApi {
  SportApi() : super(createApiTransport('https://example.test'));
  SportResponse? saved;
  SportUpdateDto? updated;
  bool denied = false, stale = false;
  @override
  Future<SportPageResponse> sportsAdminList({
    String? cursor,
    Map<String, dynamic>? headers,
  }) async {
    if (denied) throw StateError('Denied');
    return SportPageResponse(
      items: saved == null ? [] : [saved!],
      nextCursor: null,
    );
  }

  @override
  Future<SportResponse> sportsAdminCreate({
    required SportCreateDto body,
    Map<String, dynamic>? headers,
  }) async => saved = SportResponse(
    id: 'sport',
    slug: body.slug,
    active: body.active,
    revision: 1,
    translations: body.translations,
  );
  @override
  Future<SportResponse> sportsAdminUpdate({
    required String id,
    required SportUpdateDto body,
    Map<String, dynamic>? headers,
  }) async {
    updated = body;
    if (stale) throw StateError('Conflict');
    return saved = SportResponse(
      id: id,
      slug: saved!.slug,
      active: body.active,
      revision: 2,
      translations: body.translations,
    );
  }
}

class SportSession extends SessionController {
  SportSession(MaydonApi api)
    : super(api: api, credentials: CookieCredentialStore(), web: true);
  @override
  Future<T> authorized<T>(Future<T> Function(Map<String, dynamic>) action) =>
      action({});
}

Widget app(SportApi api) => ProviderScope(
  overrides: [sessionProvider.overrideWith((ref) => SportSession(api))],
  child: const MaterialApp(
    locale: Locale('en'),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: Scaffold(body: SingleChildScrollView(child: SportsEditor())),
  ),
);
Future<void> save(WidgetTester tester) async {
  await tester.pumpAndSettle();
  await tester.ensureVisible(find.text('Save sport'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Save sport'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets(
    'admin requires translated names, preserves slug and submits the observed revision',
    (tester) async {
      final api = SportApi();
      await tester.pumpWidget(app(api));
      await tester.pumpAndSettle();
      await save(tester);
      expect(api.saved, null);
      for (final entry in [
        'basketball',
        'Basketbol',
        'Баскетбол',
        'Basketball',
      ].asMap().entries) {
        await tester.enterText(
          find.byType(TextFormField).at(entry.key),
          entry.value,
        );
      }
      await save(tester);
      expect(api.saved?.translations.length, 3);
      await tester.tap(find.widgetWithText(TextButton, 'Edit sport'));
      await tester.pumpAndSettle();
      expect(
        tester.widget<TextFormField>(find.byType(TextFormField).first).enabled,
        false,
      );
      await tester.ensureVisible(find.byType(SwitchListTile));
      await tester.tap(find.byType(SwitchListTile));
      await save(tester);
      expect(api.updated?.expectedRevision, 1);
      expect(api.saved?.active, false);
      await tester.tap(find.widgetWithText(TextButton, 'Edit sport'));
      await tester.pumpAndSettle();
      api.stale = true;
      await tester.enterText(find.byType(TextFormField).at(3), 'Unsaved name');
      await save(tester);
      expect(
        tester
            .widget<TextFormField>(find.byType(TextFormField).at(3))
            .controller!
            .text,
        'Unsaved name',
      );
      expect(api.saved?.translations.last.name, 'Basketball');
    },
  );
  testWidgets('failed administrative access never exposes a write form', (
    tester,
  ) async {
    final api = SportApi()..denied = true;
    await tester.pumpWidget(app(api));
    await tester.pumpAndSettle();
    expect(find.byType(TextFormField), findsNothing);
    expect(
      find.textContaining('Could not complete the request.'),
      findsOneWidget,
    );
  });
}
