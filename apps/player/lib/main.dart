import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:maydon_design_system/design_system.dart';
import 'package:maydon_localization/localization.dart';

void main() => runApp(const ProviderScope(child: MaydonApp()));
final localeProvider = StateProvider<Locale?>((ref) => null);
const paths = ['/', '/explore', '/games', '/bookings', '/profile'];
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
      MaydonDestination(strings.home, Icons.home_outlined),
      MaydonDestination(strings.explore, Icons.sports_soccer),
      MaydonDestination(strings.findPlayers, Icons.groups_outlined),
      MaydonDestination(strings.bookings, Icons.event_available),
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
          if (index == 0) ...[
            Row(
              children: [
                const Icon(Icons.location_on_outlined, size: 20),
                const SizedBox(width: 8),
                Text(strings.namangan),
              ],
            ),
            const SizedBox(height: 32),
            Semantics(
              header: true,
              child: Text(
                strings.homeHeadline,
                style: Theme.of(
                  context,
                ).textTheme.displaySmall?.copyWith(fontWeight: FontWeight.w700),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              strings.homeIntro,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 32),
            Wrap(
              spacing: 16,
              runSpacing: 16,
              children: [
                FilledButton.icon(
                  onPressed: () => context.go('/explore'),
                  icon: const Icon(Icons.search),
                  label: Text(strings.browseVenues),
                ),
                OutlinedButton.icon(
                  onPressed: () => context.go('/games'),
                  icon: const Icon(Icons.groups_outlined),
                  label: Text(strings.joinGame),
                ),
              ],
            ),
          ] else
            MaydonEmptyState(
              icon: destinations[index].icon,
              title: switch (index) {
                1 => strings.exploreEmpty,
                2 => strings.gamesEmpty,
                3 => strings.bookingsEmpty,
                _ => strings.profile,
              },
              message: switch (index) {
                1 => strings.exploreDetail,
                2 => strings.gamesDetail,
                3 => strings.bookingsDetail,
                _ => strings.profileDetail,
              },
            ),
        ],
      ),
    );
  }
}
