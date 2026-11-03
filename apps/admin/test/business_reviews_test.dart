import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:maydon_api_client/api_client.dart';
import 'package:maydon_identity/identity.dart';
import 'package:maydon_localization/localization.dart';
import 'package:maydon_admin/business_reviews.dart';

class FakeApi extends MaydonApi {
  FakeApi() : super(createApiTransport('https://example.test'));
  BusinessReviewDto? decision;
  final business = const BusinessResponse(
    id: 'business',
    legalName: 'Namangan courts',
    status: 'PENDING',
    reviewReason: null,
    createdAt: '2026-11-02',
  );
  @override
  Future<BusinessPageResponse> businessReviewQueue({
    String? cursor,
    Map<String, dynamic>? headers,
  }) async => BusinessPageResponse(
    items: decision == null ? [business] : [],
    nextCursor: null,
  );
  @override
  Future<BusinessEvidenceResponse> businessReviewEvidence({
    required String id,
    Map<String, dynamic>? headers,
  }) async => const BusinessEvidenceResponse(
    evidence: 'Private ownership verification notes',
  );
  @override
  Future<BusinessResponse> businessReviewReview({
    required String id,
    required BusinessReviewDto body,
    Map<String, dynamic>? headers,
  }) async {
    decision = body;
    return business;
  }
}

class FakeSession extends SessionController {
  FakeSession(FakeApi api)
    : super(api: api, credentials: CookieCredentialStore(), web: true);
  @override
  Future<T> authorized<T>(Future<T> Function(Map<String, dynamic>) action) =>
      action({});
}

void main() {
  testWidgets(
    'review loads private evidence, requires a reason and refreshes queue',
    (tester) async {
      final api = FakeApi();
      final session = FakeSession(api);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [sessionProvider.overrideWith((ref) => session)],
          child: const MaterialApp(
            locale: Locale('en'),
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: Scaffold(
              body: SingleChildScrollView(child: BusinessReviews()),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Review application'));
      await tester.pumpAndSettle();
      expect(find.text('Private ownership verification notes'), findsOneWidget);
      await tester.tap(find.text('Approve business'));
      await tester.pumpAndSettle();
      expect(api.decision, null);
      await tester.enterText(
        find.byType(TextFormField),
        'Ownership independently verified.',
      );
      await tester.tap(find.text('Approve business'));
      await tester.pumpAndSettle();
      expect(api.decision?.decision, 'APPROVED');
      expect(find.text('No applications to show.'), findsOneWidget);
      expect(tester.takeException(), null);
    },
  );
}
