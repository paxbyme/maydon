import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:maydon_api_client/api_client.dart';
import 'package:maydon_identity/identity.dart';
import 'package:maydon_localization/localization.dart';
import 'package:maydon_owner/facilities.dart';

class FacilityApi extends MaydonApi {
  FacilityApi() : super(createApiTransport('https://example.test'));
  FacilityResponse? saved;
  FacilityUpdateDto? update;
  bool canEdit = true;
  bool stale = false;
  @override
  Future<FacilityPageResponse> facilitiesList({
    required String ownerId,
    String? cursor,
    Map<String, dynamic>? headers,
  }) async => FacilityPageResponse(
    items: saved == null ? [] : [saved!],
    nextCursor: null,
    canEdit: canEdit,
  );
  @override
  Future<FacilityResponse> facilitiesCreate({
    required String ownerId,
    required FacilityCreateDto body,
    Map<String, dynamic>? headers,
  }) async => saved = FacilityResponse(
    id: 'facility',
    ownerId: ownerId,
    address: body.address,
    latitude: body.latitude,
    longitude: body.longitude,
    city: 'Namangan',
    timezone: 'Asia/Tashkent',
    status: 'DRAFT',
    reviewReason: null,
    revision: 1,
    translations: body.translations,
  );
  @override
  Future<FacilityResponse> facilitiesUpdate({
    required String ownerId,
    required String id,
    required FacilityUpdateDto body,
    Map<String, dynamic>? headers,
  }) async {
    update = body;
    if (stale) throw StateError('Stale revision');
    return saved = FacilityResponse(
      id: id,
      ownerId: ownerId,
      address: body.address,
      latitude: body.latitude,
      longitude: body.longitude,
      city: 'Namangan',
      timezone: 'Asia/Tashkent',
      status: 'DRAFT',
      reviewReason: null,
      revision: 2,
      translations: body.translations,
    );
  }
}

class FacilitySession extends SessionController {
  FacilitySession(MaydonApi api)
    : super(api: api, credentials: CookieCredentialStore(), web: true);
  @override
  Future<T> authorized<T>(Future<T> Function(Map<String, dynamic>) action) =>
      action({});
}

Widget app(FacilityApi api, {String locale = 'en'}) => ProviderScope(
  overrides: [sessionProvider.overrideWith((ref) => FacilitySession(api))],
  child: MaterialApp(
    locale: Locale(locale),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: const Scaffold(
      body: SingleChildScrollView(child: FacilityWorkspace(ownerId: 'owner')),
    ),
  ),
);
Future<void> fill(WidgetTester tester) async {
  final fields = find.byType(TextFormField);
  await tester.enterText(fields.at(0), 'Namangan, Test street 12');
  await tester.enterText(fields.at(1), '40.9983');
  await tester.enterText(fields.at(2), '71.6726');
  await tester.enterText(fields.at(3), 'Namangan maydoni');
  await tester.enterText(fields.at(4), 'Namangandagi yopiq sport maydoni.');
}

Future<void> save(WidgetTester tester) async {
  // Finish the focused field's scroll before scrolling to the submit button.
  await tester.pumpAndSettle();
  await tester.ensureVisible(find.text('Save draft'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Save draft'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets(
    'owner saves a draft and edits the stored revision without losing loaded values',
    (tester) async {
      final api = FacilityApi();
      await tester.pumpWidget(app(api));
      await tester.pumpAndSettle();
      await fill(tester);
      await save(tester);
      expect(api.saved?.translations.single.locale, 'uz');
      expect(api.saved?.status, 'DRAFT');
      await tester.ensureVisible(find.text('Edit facility'));
      await tester.tap(find.text('Edit facility'));
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<TextFormField>(find.byType(TextFormField).at(0))
            .controller!
            .text,
        'Namangan, Test street 12',
      );
      expect(
        tester
            .widget<TextFormField>(find.byType(TextFormField).at(3))
            .controller!
            .text,
        'Namangan maydoni',
      );
      await tester.enterText(
        find.byType(TextFormField).at(0),
        'Namangan, Updated street 24',
      );
      await save(tester);
      expect(api.update?.expectedRevision, 1);
      expect(api.saved?.revision, 2);
      expect(api.saved?.address, 'Namangan, Updated street 24');
      expect(tester.takeException(), null);
    },
  );
  testWidgets(
    'invalid coordinates never submit and rejected edits keep user input',
    (tester) async {
      final api = FacilityApi();
      await tester.pumpWidget(app(api));
      await tester.pumpAndSettle();
      await fill(tester);
      await tester.enterText(find.byType(TextFormField).at(1), '91');
      await save(tester);
      expect(api.saved, null);
      await tester.enterText(find.byType(TextFormField).at(1), '40.9983');
      await save(tester);
      await tester.ensureVisible(find.text('Edit facility'));
      await tester.tap(find.text('Edit facility'));
      await tester.pumpAndSettle();
      api.stale = true;
      await tester.enterText(
        find.byType(TextFormField).at(0),
        'Unsaved address',
      );
      await save(tester);
      expect(
        tester
            .widget<TextFormField>(find.byType(TextFormField).at(0))
            .controller!
            .text,
        'Unsaved address',
      );
      expect(
        find.textContaining('Could not complete the request.'),
        findsOneWidget,
      );
    },
  );
  testWidgets(
    'read-only facility view has no write controls in all locales at large text',
    (tester) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1;
      tester.platformDispatcher.textScaleFactorTestValue = 2;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      for (final locale in ['uz', 'ru', 'en']) {
        final api = FacilityApi()..canEdit = false;
        await tester.pumpWidget(app(api, locale: locale));
        await tester.pumpAndSettle();
        expect(find.byType(TextFormField), findsNothing);
        expect(tester.takeException(), null);
        await tester.pumpWidget(const SizedBox());
      }
    },
  );
}
