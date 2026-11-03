import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:maydon_api_client/api_client.dart';
import 'package:maydon_identity/identity.dart';
import 'package:maydon_localization/localization.dart';

class BusinessReviews extends ConsumerStatefulWidget {
  const BusinessReviews({super.key});
  @override
  ConsumerState<BusinessReviews> createState() => _BusinessReviewsState();
}

class _BusinessReviewsState extends ConsumerState<BusinessReviews> {
  final _items = <BusinessResponse>[];
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
      final session = ref.read(sessionProvider);
      final page = await session.authorized(
        (headers) => session.api.businessReviewQueue(
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

  Future<void> _review(BusinessResponse item) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _failed = false;
    });
    var reason = '';
    final form = GlobalKey<FormState>();
    try {
      final session = ref.read(sessionProvider);
      final evidence = await session.authorized(
        (headers) =>
            session.api.businessReviewEvidence(id: item.id, headers: headers),
      );
      if (!mounted) return;
      setState(() => _busy = false);
      var sending = false;
      var failed = false;
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (dialogContext) => StatefulBuilder(
          builder: (context, update) {
            final s = AppLocalizations.of(context)!;
            Future<void> decide(String decision) async {
              if (sending || !form.currentState!.validate()) return;
              update(() {
                sending = true;
                failed = false;
              });
              try {
                await session.authorized(
                  (headers) => session.api.businessReviewReview(
                    id: item.id,
                    body: BusinessReviewDto(
                      decision: decision,
                      reason: reason.trim(),
                    ),
                    headers: headers,
                  ),
                );
                if (context.mounted) Navigator.pop(context);
              } catch (_) {
                if (context.mounted) {
                  update(() {
                    sending = false;
                    failed = true;
                  });
                }
              }
            }

            return PopScope(
              canPop: !sending,
              child: AlertDialog(
                title: Text(item.legalName),
                content: SizedBox(
                  width: 520,
                  child: SingleChildScrollView(
                    child: Form(
                      key: form,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(evidence.evidence),
                          const SizedBox(height: 20),
                          TextFormField(
                            onChanged: (value) => reason = value,
                            enabled: !sending,
                            minLines: 2,
                            maxLines: 5,
                            maxLength: 1000,
                            decoration: InputDecoration(
                              labelText: s.reviewReason,
                            ),
                            validator: (value) =>
                                (value?.trim().length ?? 0) < 5
                                ? s.businessLengthError
                                : null,
                          ),
                          if (failed)
                            Semantics(
                              liveRegion: true,
                              child: Text(s.businessError),
                            ),
                          if (sending) const LinearProgressIndicator(),
                        ],
                      ),
                    ),
                  ),
                ),
                actions: [
                  TextButton(
                    onPressed: sending ? null : () => Navigator.pop(context),
                    child: Text(s.closeReview),
                  ),
                  OutlinedButton(
                    onPressed: sending ? null : () => decide('REJECTED'),
                    child: Text(s.rejectBusiness),
                  ),
                  FilledButton(
                    onPressed: sending ? null : () => decide('APPROVED'),
                    child: Text(s.approveBusiness),
                  ),
                ],
              ),
            );
          },
        ),
      );
    } catch (_) {
      if (mounted) setState(() => _failed = true);
      return;
    } finally {
      if (mounted) setState(() => _busy = false);
    }
    if (mounted) await _load();
  }

  @override
  Widget build(BuildContext context) {
    final s = AppLocalizations.of(context)!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(s.applications, style: Theme.of(context).textTheme.headlineSmall),
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
        if (!_busy && !_failed && _items.isEmpty) Text(s.noApplications),
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
                  TextButton(
                    onPressed: _busy ? null : () => _review(item),
                    child: Text(s.reviewBusiness),
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
      ],
    );
  }
}
