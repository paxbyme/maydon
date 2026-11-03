import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:maydon_api_client/api_client.dart';
import 'package:maydon_identity/identity.dart';
import 'package:maydon_localization/localization.dart';

typedef SportsLoader = Future<SportPageResponse> Function(String? cursor);
final sportsLoaderProvider = Provider<SportsLoader>((ref) {
  final api = ref.watch(sessionProvider).api;
  return (cursor) => api.sportsList(cursor: cursor);
});

class SportsCatalog extends ConsumerStatefulWidget {
  const SportsCatalog({super.key});
  @override
  ConsumerState<SportsCatalog> createState() => _SportsCatalogState();
}

class _SportsCatalogState extends ConsumerState<SportsCatalog> {
  final _items = <SportResponse>[];
  String? _cursor;
  bool _busy = false;
  bool _failed = false;
  @override
  void initState() {
    super.initState();
    Future.microtask(_load);
  }

  Future<void> _load({bool more = false}) async {
    if (!mounted || _busy) return;
    setState(() {
      _busy = true;
      _failed = false;
    });
    try {
      final page = await ref.read(sportsLoaderProvider)(more ? _cursor : null);
      if (!mounted) return;
      setState(() {
        if (!more) _items.clear();
        _items.addAll(page.items);
        _cursor = page.nextCursor;
      });
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = AppLocalizations.of(context)!;
    final locale = Localizations.localeOf(context).languageCode;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(s.sportsCatalog, style: Theme.of(context).textTheme.headlineSmall),
        Text(s.sportsCatalogHelp),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton.icon(
            onPressed: _busy ? null : _load,
            icon: const Icon(Icons.refresh),
            label: Text(s.refreshList),
          ),
        ),
        if (_busy) const LinearProgressIndicator(),
        if (_failed)
          Semantics(liveRegion: true, child: Text(s.connectionError)),
        if (!_busy && !_failed && _items.isEmpty) Text(s.noSports),
        Wrap(
          spacing: 12,
          runSpacing: 8,
          children: [
            for (final sport in _items)
              Chip(
                label: Text(
                  sport.translations
                      .firstWhere(
                        (t) => t.locale == locale,
                        orElse: () => sport.translations.first,
                      )
                      .name,
                ),
              ),
          ],
        ),
        if (_cursor != null)
          TextButton(
            onPressed: _busy ? null : () => _load(more: true),
            child: Text(s.loadMore),
          ),
        const SizedBox(height: 24),
      ],
    );
  }
}
