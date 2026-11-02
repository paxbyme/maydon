import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:maydon_api_client/api_client.dart';
import 'package:maydon_localization/localization.dart';
import 'package:maydon_player/sports_catalog.dart';

const football = SportResponse(
  id: 'football',
  slug: 'football',
  active: true,
  revision: 1,
  translations: [
    SportTranslationDto(locale: 'en', name: 'Football'),
    SportTranslationDto(locale: 'ru', name: 'Футбол'),
    SportTranslationDto(locale: 'uz', name: 'Futbol'),
  ],
);
const tennis = SportResponse(
  id: 'tennis',
  slug: 'tennis',
  active: true,
  revision: 1,
  translations: [
    SportTranslationDto(locale: 'en', name: 'Tennis'),
    SportTranslationDto(locale: 'ru', name: 'Теннис'),
    SportTranslationDto(locale: 'uz', name: 'Tennis'),
  ],
);
Widget app(SportsLoader loader, {String locale = 'en'}) => ProviderScope(
  overrides: [sportsLoaderProvider.overrideWithValue(loader)],
  child: MaterialApp(
    locale: Locale(locale),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: const Scaffold(body: SingleChildScrollView(child: SportsCatalog())),
  ),
);
void main() {
  testWidgets(
    'public catalog paginates and retains loaded sports on a failed next page',
    (tester) async {
      var fail = true;
      await tester.pumpWidget(
        app((cursor) async {
          if (cursor == null) {
            return const SportPageResponse(
              items: [football],
              nextCursor: 'next',
            );
          }
          if (fail) throw StateError('Offline');
          return const SportPageResponse(items: [tennis], nextCursor: null);
        }),
      );
      await tester.pumpAndSettle();
      expect(find.text('Football'), findsOneWidget);
      await tester.tap(find.text('Load more'));
      await tester.pumpAndSettle();
      expect(find.text('Football'), findsOneWidget);
      expect(find.text('Tennis'), findsNothing);
      fail = false;
      await tester.tap(find.text('Load more'));
      await tester.pumpAndSettle();
      expect(find.text('Tennis'), findsOneWidget);
      expect(find.text('Load more'), findsNothing);
    },
  );
  testWidgets(
    'catalog uses all three locales and wraps at narrow width with large text',
    (tester) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1;
      tester.platformDispatcher.textScaleFactorTestValue = 2;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      for (final entry in {
        'en': 'Football',
        'ru': 'Футбол',
        'uz': 'Futbol',
      }.entries) {
        await tester.pumpWidget(
          app(
            (_) async =>
                const SportPageResponse(items: [football], nextCursor: null),
            locale: entry.key,
          ),
        );
        await tester.pumpAndSettle();
        expect(find.text(entry.value), findsOneWidget);
        expect(tester.takeException(), null);
        await tester.pumpWidget(const SizedBox());
      }
    },
  );
}
