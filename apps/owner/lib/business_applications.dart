import 'package:go_router/go_router.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:maydon_api_client/api_client.dart';
import 'package:maydon_identity/identity.dart';
import 'package:maydon_localization/localization.dart';

class BusinessApplications extends ConsumerStatefulWidget {
  const BusinessApplications({super.key});
  @override
  ConsumerState<BusinessApplications> createState() =>
      _BusinessApplicationsState();
}

class _BusinessApplicationsState extends ConsumerState<BusinessApplications> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _evidence = TextEditingController();
  final _items = <BusinessResponse>[];
  String? _cursor;
  String? _editing;
  bool _busy = false;
  bool _failed = false;
  @override
  void initState() {
    super.initState();
    Future.microtask(_load);
  }

  @override
  void dispose() {
    _name.dispose();
    _evidence.dispose();
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
        (headers) => session.api.businessesList(
          cursor: more ? _cursor : null,
          headers: headers,
        ),
      );
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

  Future<void> _submit() async {
    if (_busy || !_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _failed = false;
    });
    try {
      final session = ref.read(sessionProvider);
      final body = BusinessSubmissionDto(
        legalName: _name.text.trim(),
        evidence: _evidence.text.trim(),
      );
      await session.authorized(
        (headers) => _editing == null
            ? session.api.businessesSubmit(body: body, headers: headers)
            : session.api.businessesResubmit(
                id: _editing!,
                body: body,
                headers: headers,
              ),
      );
      if (!mounted) return;
      _name.clear();
      _evidence.clear();
      _editing = null;
      setState(() => _busy = false);
      await _load();
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = AppLocalizations.of(context)!;
    final verified = ref.watch(sessionProvider).user?.emailVerified ?? false;
    String status(String value) => switch (value) {
      'PENDING' => s.reviewPending,
      'APPROVED' => s.reviewApproved,
      'REJECTED' => s.reviewRejected,
      'SUSPENDED' => s.reviewSuspended,
      _ => s.reviewDraft,
    };
    String? length(String? value, int min, int max) =>
        (value?.trim().length ?? 0) < min || (value?.trim().length ?? 0) > max
        ? s.businessLengthError
        : null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          s.businessApplication,
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton.icon(
            onPressed: _busy ? null : _load,
            icon: const Icon(Icons.refresh),
            label: Text(s.refreshList),
          ),
        ),
        if (_busy) const LinearProgressIndicator(),
        if (_failed) Semantics(liveRegion: true, child: Text(s.businessError)),
        if (!_busy && _items.isEmpty) Text(s.noApplications),
        for (final item in _items)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.legalName,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  Text(status(item.status)),
                  if (item.reviewReason != null) Text(item.reviewReason!),
                  if (item.status == 'APPROVED') ...[
                    Text(s.businessApprovedHelp),
                    FilledButton(
                      onPressed: _busy
                          ? null
                          : () => context.push(
                              '/businesses/${item.id}/facilities',
                            ),
                      child: Text(s.manageFacilities),
                    ),
                  ],
                  if (['REJECTED', 'DRAFT'].contains(item.status))
                    TextButton(
                      onPressed: _busy
                          ? null
                          : () {
                              setState(() {
                                _editing = item.id;
                                _name.text = item.legalName;
                                _evidence.clear();
                              });
                            },
                      child: Text(s.resubmitApplication),
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
        const SizedBox(height: 24),
        if (!verified)
          Text(s.verifyEmail)
        else if (!_items.any((item) => item.status == 'PENDING'))
          Form(
            key: _form,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextFormField(
                  controller: _name,
                  enabled: !_busy,
                  maxLength: 200,
                  decoration: InputDecoration(labelText: s.legalName),
                  validator: (value) => length(value, 2, 200),
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _evidence,
                  enabled: !_busy,
                  minLines: 4,
                  maxLines: 8,
                  maxLength: 5000,
                  decoration: InputDecoration(
                    labelText: s.ownershipEvidence,
                    helperText: s.evidenceHelp,
                    helperMaxLines: 8,
                  ),
                  validator: (value) => length(value, 30, 5000),
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: _busy ? null : _submit,
                  child: Text(s.submitApplication),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
