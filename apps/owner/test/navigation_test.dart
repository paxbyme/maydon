import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:maydon_owner/main.dart';

void main() {
  testWidgets('navigation adapts and every destination is reachable', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    final container = ProviderContainer();
    addTearDown(container.dispose);
    for (final width in [390.0, 900.0, 1400.0]) {
      tester.view.physicalSize = Size(width, 900);
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: const MaydonApp(),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        find.byType(width < 760 ? NavigationBar : NavigationRail),
        findsOneWidget,
      );
      for (var i = 0; i < paths.length; i++) {
        container.read(routerProvider).go(paths[i]);
        await tester.pumpAndSettle();
        expect(
          tester.widget<WorkspacePage>(find.byType(WorkspacePage)).index,
          i,
        );
        expect(tester.takeException(), isNull);
      }
    }
  });
  testWidgets('language picker updates all supported locales', (tester) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    await tester.pumpWidget(
      UncontrolledProviderScope(container: container, child: const MaydonApp()),
    );
    await tester.pumpAndSettle();
    for (final entry in {
      'uz': 'O‘zbekcha',
      'ru': 'Русский',
      'en': 'English',
    }.entries) {
      await tester.tap(find.byIcon(Icons.translate));
      await tester.pumpAndSettle();
      await tester.tap(find.text(entry.value));
      await tester.pumpAndSettle();
      expect(container.read(localeProvider)?.languageCode, entry.key);
      expect(tester.takeException(), isNull);
    }
  });
}
