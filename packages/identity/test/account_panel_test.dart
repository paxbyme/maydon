import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:maydon_identity/identity.dart';
import 'package:maydon_localization/localization.dart';
import 'session_test.dart' show MemoryCredentials, controller, jsonBody, tokens;

Widget account(
  SessionController session, {
  Locale locale = const Locale('en'),
}) => ProviderScope(
  overrides: [sessionProvider.overrideWith((ref) => session)],
  child: MaterialApp(
    locale: locale,
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: const Scaffold(
      body: SingleChildScrollView(
        padding: EdgeInsets.all(24),
        child: AccountPanel(),
      ),
    ),
  ),
);
void main() {
  testWidgets(
    'invalid fields never submit and successful login shows verified account',
    (tester) async {
      var requests = 0;
      final session = controller(MemoryCredentials(), (request) async {
        requests++;
        return jsonBody(tokens());
      });
      await tester.pumpWidget(account(session));
      await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
      await tester.pumpAndSettle();
      expect(find.text('This field is required.'), findsNWidgets(2));
      expect(requests, 0);
      await tester.enterText(
        find.byType(TextFormField).at(0),
        'test@example.test',
      );
      await tester.enterText(
        find.byType(TextFormField).at(1),
        'long-test-password',
      );
      await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
      await tester.pumpAndSettle();
      expect(requests, 1);
      expect(find.text('Email verified'), findsOneWidget);
      expect(find.text('test@example.test'), findsOneWidget);
    },
  );
  testWidgets(
    'server errors remain visible and never imply successful sign-in',
    (tester) async {
      final session = controller(
        MemoryCredentials(),
        (_) async => jsonBody({'code': 'RATE_LIMITED'}, 429),
      );
      await tester.pumpWidget(account(session));
      await tester.enterText(
        find.byType(TextFormField).at(0),
        'test@example.test',
      );
      await tester.enterText(
        find.byType(TextFormField).at(1),
        'long-test-password',
      );
      await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
      await tester.pumpAndSettle();
      expect(
        find.text('Too many attempts. Please wait before trying again.'),
        findsOneWidget,
      );
      expect(session.user, null);
    },
  );
  testWidgets('all locales support narrow screens and doubled text', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 900);
    tester.platformDispatcher.textScaleFactorTestValue = 2;
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    for (final code in ['uz', 'ru', 'en']) {
      final session = controller(
        MemoryCredentials(),
        (_) async => jsonBody(tokens()),
      );
      await tester.pumpWidget(account(session, locale: Locale(code)));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    }
  });
  testWidgets(
    'sign-in controls have accessible labels, contrast and touch targets',
    (tester) async {
      final handle = tester.ensureSemantics();

      final session = controller(
        MemoryCredentials(),
        (_) async => jsonBody(tokens()),
      );
      await tester.pumpWidget(account(session));
      await tester.pumpAndSettle();
      await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
      await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
      await expectLater(tester, meetsGuideline(textContrastGuideline));
      handle.dispose();
    },
  );
}
