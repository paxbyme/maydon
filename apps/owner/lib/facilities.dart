import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:maydon_api_client/api_client.dart';
import 'package:maydon_identity/identity.dart';
import 'package:maydon_localization/localization.dart';

class BusinessFacilityPage extends ConsumerWidget {
  const BusinessFacilityPage({super.key, required this.ownerId});
  final String ownerId;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    return Scaffold(
      appBar: AppBar(title: Text(AppLocalizations.of(context)!.facilities)),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 900),
            child: session.user == null || session.mfaRequired
                ? const AccountPanel()
                : FacilityWorkspace(
                    key: ValueKey('${session.user!.id}:$ownerId'),
                    ownerId: ownerId,
                  ),
          ),
        ),
      ),
    );
  }
}

class FacilityWorkspace extends ConsumerStatefulWidget {
  const FacilityWorkspace({super.key, required this.ownerId});
  final String ownerId;
  @override
  ConsumerState<FacilityWorkspace> createState() => _FacilityWorkspaceState();
}

class _FacilityWorkspaceState extends ConsumerState<FacilityWorkspace> {
  final _form = GlobalKey<FormState>();
  final _listTop = GlobalKey();
  final _address = TextEditingController();
  final _latitude = TextEditingController();
  final _longitude = TextEditingController();
  final _names = {
    for (final locale in ['uz', 'ru', 'en']) locale: TextEditingController(),
  };
  final _descriptions = {
    for (final locale in ['uz', 'ru', 'en']) locale: TextEditingController(),
  };
  final _items = <FacilityResponse>[];
  String? _cursor;
  FacilityResponse? _editing;
  bool _busy = false;
  bool _failed = false;
  bool _missingTranslation = false;
  bool _loaded = false;
  bool _canEdit = false;
  @override
  void initState() {
    super.initState();
    Future.microtask(_load);
  }

  @override
  void dispose() {
    for (final c in [
      _address,
      _latitude,
      _longitude,
      ..._names.values,
      ..._descriptions.values,
    ]) {
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
        (headers) => session.api.facilitiesList(
          ownerId: widget.ownerId,
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
        _canEdit = page.canEdit;
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

  void _edit(FacilityResponse? facility) {
    _form.currentState?.reset();
    setState(() {
      _editing = facility;
      _missingTranslation = false;
      _address.text = facility?.address ?? '';
      _latitude.text = facility?.latitude?.toString() ?? '';
      _longitude.text = facility?.longitude?.toString() ?? '';
      for (final c in [..._names.values, ..._descriptions.values]) {
        c.clear();
      }
      for (final translation
          in facility?.translations ?? <FacilityTranslationDto>[]) {
        _names[translation.locale]?.text = translation.name;
        _descriptions[translation.locale]?.text = translation.description;
      }
    });
    if (facility != null) _show(_form);
  }

  Future<void> _save() async {
    if (_busy || !_form.currentState!.validate()) return;
    final translations = [
      for (final locale in _names.keys)
        if (_names[locale]!.text.trim().isNotEmpty)
          FacilityTranslationDto(
            locale: locale,
            name: _names[locale]!.text.trim(),
            description: _descriptions[locale]!.text.trim(),
          ),
    ];
    if (translations.isEmpty) {
      setState(() => _missingTranslation = true);
      return;
    }
    setState(() {
      _busy = true;
      _failed = false;
      _missingTranslation = false;
    });
    try {
      final session = ref.read(sessionProvider);
      final address = _address.text.trim();
      final latitude = num.parse(_latitude.text.trim());
      final longitude = num.parse(_longitude.text.trim());
      await session.authorized(
        (headers) => _editing == null
            ? session.api.facilitiesCreate(
                ownerId: widget.ownerId,
                body: FacilityCreateDto(
                  address: address,
                  latitude: latitude,
                  longitude: longitude,
                  translations: translations,
                ),
                headers: headers,
              )
            : session.api.facilitiesUpdate(
                ownerId: widget.ownerId,
                id: _editing!.id,
                body: FacilityUpdateDto(
                  address: address,
                  latitude: latitude,
                  longitude: longitude,
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
      if (mounted && !_failed) _show(_listTop);
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
    String title(FacilityResponse f) => f.translations.isEmpty
        ? s.facilities
        : f.translations
              .firstWhere(
                (t) => t.locale == locale,
                orElse: () => f.translations.first,
              )
              .name;
    String? coordinate(String? value, num limit) {
      final number = num.tryParse(value?.trim() ?? '');
      return number == null ||
              !number.isFinite ||
              number.abs() > limit ||
              !RegExp(r'^-?\d+(\.\d{1,6})?$').hasMatch(value!.trim())
          ? s.coordinateInvalid
          : null;
    }

    String? length(String? value, int min, int max) =>
        (value?.trim().length ?? 0) < min || (value?.trim().length ?? 0) > max
        ? s.businessLengthError
        : null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(s.facilityDraftHelp, key: _listTop),
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
          Semantics(liveRegion: true, child: Text(s.facilitySaveError)),
        if (_loaded && _items.isEmpty) Text(s.noFacilities),
        for (final facility in _items)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title(facility),
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  Text(facility.address),
                  Text(facility.city),
                  Text(switch (facility.status) {
                    'APPROVED' => s.reviewApproved,
                    'PENDING' => s.reviewPending,
                    'REJECTED' => s.reviewRejected,
                    'SUSPENDED' => s.reviewSuspended,
                    _ => s.reviewDraft,
                  }),
                  if (facility.reviewReason != null)
                    Text(facility.reviewReason!),
                  if (_canEdit &&
                      ['DRAFT', 'REJECTED'].contains(facility.status))
                    TextButton(
                      onPressed: _busy ? null : () => _edit(facility),
                      child: Text(s.editFacility),
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
        if (_loaded && !_canEdit) Text(s.facilityApprovalRequired),
        if (_loaded && _canEdit) ...[
          const SizedBox(height: 24),
          Text(
            _editing == null ? s.createFacility : s.editFacility,
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          if (_editing != null)
            TextButton(
              onPressed: _busy ? null : () => _edit(null),
              child: Text(s.cancelFacilityEdit),
            ),
          Form(
            key: _form,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextFormField(
                  controller: _address,
                  enabled: !_busy,
                  maxLength: 500,
                  decoration: InputDecoration(labelText: s.facilityAddress),
                  validator: (value) => length(value, 5, 500),
                ),
                TextFormField(
                  controller: _latitude,
                  enabled: !_busy,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                    signed: true,
                  ),
                  decoration: InputDecoration(labelText: s.facilityLatitude),
                  validator: (value) => coordinate(value, 90),
                ),
                TextFormField(
                  controller: _longitude,
                  enabled: !_busy,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                    signed: true,
                  ),
                  decoration: InputDecoration(
                    labelText: s.facilityLongitude,
                    helperText: s.coordinateHelp,
                    helperMaxLines: 4,
                  ),
                  validator: (value) => coordinate(value, 180),
                ),
                const SizedBox(height: 24),
                Text(s.facilityTranslationHelp),
                for (final code in _names.keys) ...[
                  const SizedBox(height: 20),
                  Text(
                    {
                      'uz': 'O‘zbekcha',
                      'ru': 'Русский',
                      'en': 'English',
                    }[code]!,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  TextFormField(
                    controller: _names[code],
                    enabled: !_busy,
                    maxLength: 200,
                    decoration: InputDecoration(labelText: s.facilityName),
                    validator: (value) =>
                        value!.trim().isEmpty &&
                            _descriptions[code]!.text.trim().isEmpty
                        ? null
                        : length(value, 2, 200),
                  ),
                  TextFormField(
                    controller: _descriptions[code],
                    enabled: !_busy,
                    minLines: 2,
                    maxLines: 6,
                    maxLength: 5000,
                    decoration: InputDecoration(
                      labelText: s.facilityDescription,
                    ),
                    validator: (value) =>
                        value!.trim().isEmpty &&
                            _names[code]!.text.trim().isEmpty
                        ? null
                        : length(value, 10, 5000),
                  ),
                ],
                if (_missingTranslation)
                  Semantics(
                    liveRegion: true,
                    child: Text(s.facilityTranslationHelp),
                  ),
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: _busy ? null : _save,
                  child: Text(s.saveFacilityDraft),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}
