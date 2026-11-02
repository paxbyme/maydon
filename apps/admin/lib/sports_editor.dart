import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:maydon_api_client/api_client.dart';
import 'package:maydon_identity/identity.dart';
import 'package:maydon_localization/localization.dart';

class SportsAdminPage extends ConsumerWidget {
  const SportsAdminPage({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    return Scaffold(
      appBar: AppBar(title: Text(AppLocalizations.of(context)!.manageSports)),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 900),
            child: session.user == null || session.mfaRequired
                ? const AccountPanel()
                : SportsEditor(key: ValueKey(session.user!.id)),
          ),
        ),
      ),
    );
  }
}

class SportsEditor extends ConsumerStatefulWidget {
  const SportsEditor({super.key});
  @override
  ConsumerState<SportsEditor> createState() => _SportsEditorState();
}

class _SportsEditorState extends ConsumerState<SportsEditor> {
  final _form = GlobalKey<FormState>();
  final _top = GlobalKey();
  final _slug = TextEditingController();
  final _names = {
    for (final code in ['uz', 'ru', 'en']) code: TextEditingController(),
  };
  final _items = <SportResponse>[];
  SportResponse? _editing;
  String? _cursor;
  bool _busy = false, _failed = false, _loaded = false, _active = true;
  @override
  void initState() {
    super.initState();
    Future.microtask(_load);
  }

  @override
  void dispose() {
    _slug.dispose();
    for (final c in _names.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load({bool more = false}) async {
    if (!mounted || _busy) return;
    setState(() {
      _busy = true;
      _failed = false;
    });
    try {
      final session = ref.read(sessionProvider);
      final page = await session.authorized(
        (headers) => session.api.sportsAdminList(
          cursor: more ? _cursor : null,
          headers: headers,
        ),
      );
      if (!mounted) return;
      setState(() {
        if (!more) _items.clear();
        _items.addAll(page.items);
        _cursor = page.nextCursor;
        _loaded = true;
      });
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _show(GlobalKey key) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final target = key.currentContext;
      if (!mounted || target == null) return;
      Scrollable.ensureVisible(
        target,
        duration: MediaQuery.disableAnimationsOf(context)
            ? Duration.zero
            : const Duration(milliseconds: 200),
      );
    });
  }

  void _edit(SportResponse? sport) {
    _form.currentState?.reset();
    setState(() {
      _editing = sport;
      _slug.text = sport?.slug ?? '';
      _active = sport?.active ?? true;
      for (final c in _names.values) {
        c.clear();
      }
      for (final t in sport?.translations ?? <SportTranslationDto>[]) {
        _names[t.locale]?.text = t.name;
      }
    });
    if (sport != null) _show(_form);
  }

  Future<void> _save() async {
    if (_busy || !_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _failed = false;
    });
    try {
      final session = ref.read(sessionProvider);
      final translations = [
        for (final entry in _names.entries)
          SportTranslationDto(locale: entry.key, name: entry.value.text.trim()),
      ];
      await session.authorized(
        (headers) => _editing == null
            ? session.api.sportsAdminCreate(
                body: SportCreateDto(
                  slug: _slug.text.trim(),
                  active: _active,
                  translations: translations,
                ),
                headers: headers,
              )
            : session.api.sportsAdminUpdate(
                id: _editing!.id,
                body: SportUpdateDto(
                  active: _active,
                  translations: translations,
                  expectedRevision: _editing!.revision,
                ),
                headers: headers,
              ),
      );
      if (!mounted) return;
      _edit(null);
      setState(() => _busy = false);
      await _load();
      if (mounted && !_failed) _show(_top);
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
        Text(s.sportsAdminHelp, key: _top),
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
          Semantics(liveRegion: true, child: Text(s.sportsSaveError)),
        if (_loaded && _items.isEmpty) Text(s.noSports),
        for (final sport in _items)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    sport.translations.isEmpty
                        ? sport.slug
                        : sport.translations
                              .firstWhere(
                                (t) => t.locale == locale,
                                orElse: () => sport.translations.first,
                              )
                              .name,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  Text(sport.active ? s.sportActive : s.sportInactive),
                  TextButton(
                    onPressed: _busy ? null : () => _edit(sport),
                    child: Text(s.editSport),
                  ),
                ],
              ),
            ),
          ),
        if (_cursor != null)
          TextButton(
            onPressed: _busy ? null : () => _load(more: true),
            child: Text(s.loadMore),
          ),
        if (_loaded) ...[
          const SizedBox(height: 24),
          Text(
            _editing == null ? s.createSport : s.editSport,
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          if (_editing != null)
            TextButton(
              onPressed: _busy ? null : () => _edit(null),
              child: Text(s.cancelSportEdit),
            ),
          Form(
            key: _form,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextFormField(
                  controller: _slug,
                  enabled: !_busy && _editing == null,
                  maxLength: 80,
                  decoration: InputDecoration(
                    labelText: s.sportSlug,
                    helperText: s.sportSlugHelp,
                    helperMaxLines: 4,
                  ),
                  validator: (value) =>
                      value == null ||
                          value.trim().length < 2 ||
                          !RegExp(
                            r'^[a-z0-9]+(?:-[a-z0-9]+)*$',
                          ).hasMatch(value.trim())
                      ? s.sportSlugHelp
                      : null,
                ),
                for (final code in _names.keys)
                  Padding(
                    padding: const EdgeInsets.only(top: 16),
                    child: TextFormField(
                      controller: _names[code],
                      enabled: !_busy,
                      maxLength: 100,
                      decoration: InputDecoration(
                        labelText:
                            '${s.sportName} — ${{'uz': 'O‘zbekcha', 'ru': 'Русский', 'en': 'English'}[code]}',
                      ),
                      validator: (value) => (value?.trim().length ?? 0) < 2
                          ? s.businessLengthError
                          : null,
                    ),
                  ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(s.sportActive),
                  subtitle: Text(s.sportInactiveHelp),
                  value: _active,
                  onChanged: _busy
                      ? null
                      : (value) => setState(() => _active = value),
                ),
                FilledButton(
                  onPressed: _busy ? null : _save,
                  child: Text(s.saveSport),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}
