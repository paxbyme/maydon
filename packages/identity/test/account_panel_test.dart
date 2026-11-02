import 'package:maydon_design_system/design_system.dart';
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
    theme: maydonTheme(),
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
  testWidgets('registration and verification preserve email for sign-in', (
    tester,
  ) async {
    final paths = <String>[];
    final session = controller(MemoryCredentials(), (request) async {
      paths.add(request.path);
      if (request.path.endsWith('/login')) {
        expect(request.data['email'], 'test@example.test');
        expect(request.data['password'], 'long-test-password');
        return jsonBody(tokens());
      }
      return jsonBody({'accepted': true, 'verified': true});
    });
    await tester.pumpWidget(account(session));
    await tester.tap(find.text('Create account'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byType(TextFormField).at(0),
      'test@example.test',
    );
    await tester.enterText(find.byType(TextFormField).at(1), 'Test player');
    await tester.enterText(
      find.byType(TextFormField).at(2),
      'long-test-password',
    );
    await tester.ensureVisible(
      find.widgetWithText(FilledButton, 'Create account'),
    );
    await tester.tap(find.widgetWithText(FilledButton, 'Create account'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byType(TextFormField).at(1),
      '11111111-1111-4111-8111-111111111111',
    );
    await tester.enterText(find.byType(TextFormField).at(2), '123456');
    await tester.ensureVisible(find.widgetWithText(FilledButton, 'Confirm'));
    await tester.tap(find.widgetWithText(FilledButton, 'Confirm'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byType(TextFormField).at(1),
      'long-test-password',
    );
    await tester.ensureVisible(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.pumpAndSettle();
    expect(paths.length, 3);
    expect(find.text('Email verified'), findsOneWidget);
  });
  testWidgets(
    'session restoration disables sign-in including keyboard submission',
    (tester) async {
      var calls = 0;
      final session = controller(MemoryCredentials(), (_) async {
        calls++;
        return jsonBody(tokens());
      });
      session.restoring = true;
      await tester.pumpWidget(account(session));
      final button = tester.widget<FilledButton>(
        find.widgetWithText(FilledButton, 'Sign in'),
      );
      expect(button.onPressed, null);
      expect(
        tester.widget<TextFormField>(find.byType(TextFormField).first).enabled,
        false,
      );
      expect(calls, 0);
    },
  );
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
