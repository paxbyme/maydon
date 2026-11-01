import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:maydon_design_system/design_system.dart';
import 'package:maydon_localization/localization.dart';

void main() => runApp(const ProviderScope(child: MaydonApp()));
final localeProvider = StateProvider<Locale?>((ref) => null);
const paths = ['/', '/calendar', '/facilities', '/staff', '/profile'];
final routerProvider = Provider<GoRouter>((ref) {
  final router = GoRouter(
    routes: [
      for (var i = 0; i < paths.length; i++)
        GoRoute(
          path: paths[i],
          builder: (context, state) => WorkspacePage(index: i),
        ),
    ],
  );
  ref.onDispose(router.dispose);
  return router;
});

class MaydonApp extends ConsumerWidget {
  const MaydonApp({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => MaterialApp.router(
    debugShowCheckedModeBanner: false,
    onGenerateTitle: (context) => AppLocalizations.of(context)!.appName,
    theme: maydonTheme(),
    locale: ref.watch(localeProvider),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    routerConfig: ref.watch(routerProvider),
  );
}

class WorkspacePage extends ConsumerWidget {
  const WorkspacePage({super.key, required this.index});
  final int index;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final strings = AppLocalizations.of(context)!;
    final destinations = [
      MaydonDestination(strings.overview, Icons.dashboard_outlined),
      MaydonDestination(strings.calendar, Icons.calendar_month_outlined),
      MaydonDestination(strings.facilities, Icons.stadium_outlined),
      MaydonDestination(strings.staff, Icons.badge_outlined),
      MaydonDestination(strings.profile, Icons.person_outline),
    ];
    return MaydonShell(
      title: strings.appName,
      destinations: destinations,
      selectedIndex: index,
      onSelect: (value) => context.go(paths[value]),
      actions: [
        PopupMenuButton<String>(
          tooltip: strings.language,
          icon: const Icon(Icons.translate),
          initialValue: Localizations.localeOf(context).languageCode,
          onSelected: (value) =>
              ref.read(localeProvider.notifier).state = Locale(value),
          itemBuilder: (context) => const [
            PopupMenuItem(value: 'uz', child: Text('O‘zbekcha')),
            PopupMenuItem(value: 'ru', child: Text('Русский')),
            PopupMenuItem(value: 'en', child: Text('English')),
          ],
        ),
        const SizedBox(width: 12),
      ],
      child: ListView(
        padding: EdgeInsets.all(
          MediaQuery.sizeOf(context).width < 600 ? 20 : 40,
        ),
        children: [
          Text(
            strings.ownerTitle,
            style: Theme.of(context).textTheme.headlineMedium,
          ),
          const SizedBox(height: 24),
          MaydonEmptyState(
            icon: destinations[index].icon,
            title: destinations[index].label,
            message: strings.workspaceDetail,
          ),
        ],
      ),
    );
  }
}
