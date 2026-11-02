import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'src/session.dart';
import 'src/storage.dart';
export 'src/session.dart';
export 'src/storage.dart';
export 'src/account_panel.dart';

final sessionProvider = ChangeNotifierProvider<SessionController>(
  (ref) => createSession(),
);
final localeStoreProvider = Provider<LocaleStore>((ref) => MemoryLocaleStore());
final initialLocaleProvider = Provider<Locale?>((ref) => null);
final localeProvider = StateNotifierProvider<LocaleController, Locale?>(
  (ref) => LocaleController(
    ref.watch(localeStoreProvider),
    ref.watch(initialLocaleProvider),
  ),
);

class LocaleController extends StateNotifier<Locale?> {
  LocaleController(this.store, Locale? initial) : super(initial);
  final LocaleStore store;
  Future<void> select(String code) async {
    if (!['uz', 'ru', 'en'].contains(code)) throw ArgumentError.value(code);
    await store.write(code);
    state = Locale(code);
  }
}

Future<void> runMaydonApp(Widget app) async {
  WidgetsFlutterBinding.ensureInitialized();
  final store = DeviceLocaleStore();
  String? code;
  try {
    code = await store.read();
  } catch (_) {
    /* Device defaults remain usable when preference storage is unavailable. */
  }
  final session = createSession();
  runApp(
    ProviderScope(
      overrides: [
        localeStoreProvider.overrideWithValue(store),
        initialLocaleProvider.overrideWithValue(
          ['uz', 'ru', 'en'].contains(code) ? Locale(code!) : null,
        ),
        sessionProvider.overrideWith((ref) => session),
      ],
      child: app,
    ),
  );
  unawaited(session.restore());
}
