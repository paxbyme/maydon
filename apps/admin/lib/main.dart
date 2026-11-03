import 'sports_editor.dart';
import 'business_reviews.dart';
import 'package:maydon_identity/identity.dart';
export 'package:maydon_identity/identity.dart' show localeProvider;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:maydon_design_system/design_system.dart';
import 'package:maydon_localization/localization.dart';

Future<void> main() => runMaydonApp(const MaydonApp());
const paths = ['/', '/applications', '/publication', '/reports', '/audit'];
final routerProvider = Provider<GoRouter>((ref) {
  final router = GoRouter(
    routes: [
      GoRoute(
        path: '/sports',
        builder: (context, state) => const SportsAdminPage(),
      ),
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
      MaydonDestination(strings.applications, Icons.assignment_outlined),
      MaydonDestination(strings.publication, Icons.fact_check_outlined),
      MaydonDestination(strings.reports, Icons.flag_outlined),
      MaydonDestination(strings.audit, Icons.history),
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
          onSelected: (value) async {
            try {
              await ref.read(localeProvider.notifier).select(value);
              final session = ref.read(sessionProvider);
              if (session.user != null && !session.mfaRequired) {
                await session.updateLocale(value);
              }
            } catch (_) {
              if (context.mounted) {
                ScaffoldMessenger.of(
                  context,
                ).showSnackBar(SnackBar(content: Text(strings.storageError)));
              }
            }
          },
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
            strings.adminTitle,
            style: Theme.of(context).textTheme.headlineMedium,
          ),
          const SizedBox(height: 24),
          const AccountPanel(),
          const SizedBox(height: 24),
          if (index == 0 &&
              ref.watch(sessionProvider).user != null &&
              !ref.watch(sessionProvider).mfaRequired)
            Align(
              alignment: Alignment.centerLeft,
              child: FilledButton.icon(
                onPressed: () => context.push('/sports'),
                icon: const Icon(Icons.sports),
                label: Text(strings.manageSports),
              ),
            ),
          if (index == 1 &&
              ref.watch(sessionProvider).user != null &&
              !ref.watch(sessionProvider).mfaRequired)
            const BusinessReviews()
          else
            MaydonEmptyState(
              icon: destinations[index].icon,
              title: destinations[index].label,
              message: strings.adminDetail,
            ),
        ],
      ),
    );
  }
}
