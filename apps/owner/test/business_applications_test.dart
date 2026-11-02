import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:maydon_api_client/api_client.dart';
import 'package:maydon_identity/identity.dart';
import 'package:maydon_localization/localization.dart';
import 'package:maydon_owner/business_applications.dart';

class FakeApi extends MaydonApi {
  FakeApi() : super(createApiTransport('https://example.test'));
  BusinessSubmissionDto? submitted;
  @override
  Future<BusinessPageResponse> businessesList({
    String? cursor,
    Map<String, dynamic>? headers,
  }) async => BusinessPageResponse(
    items: submitted == null ? [] : [business],
    nextCursor: null,
  );
  final business = const BusinessResponse(
    id: 'business',
    legalName: 'Namangan courts',
    status: 'PENDING',
    reviewReason: null,
    createdAt: '2026-11-02',
  );
  @override
  Future<BusinessResponse> businessesSubmit({
    required BusinessSubmissionDto body,
    Map<String, dynamic>? headers,
  }) async {
    submitted = body;
    return business;
  }
}

class FakeSession extends SessionController {
  FakeSession(FakeApi api)
    : super(api: api, credentials: CookieCredentialStore(), web: true) {
    user = const ProfileResponse(
      id: 'user',
      email: 'owner@example.test',
      displayName: 'Owner',
      locale: 'en',
      emailVerified: true,
      phone: null,
      phoneVerified: false,
      mfaEnabled: false,
    );
  }
  @override
  Future<T> authorized<T>(Future<T> Function(Map<String, dynamic>) action) =>
      action({});
}

void main() {
  testWidgets('owner submits validated private notes and sees pending status', (
    tester,
  ) async {
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
            body: SingleChildScrollView(child: BusinessApplications()),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Submit for review'));
    await tester.pumpAndSettle();
    expect(api.submitted, null);
    await tester.enterText(find.byType(TextFormField).at(0), 'Namangan courts');
    await tester.enterText(
      find.byType(TextFormField).at(1),
      'Ownership registration reference available for independent verification.',
    );
    await tester.ensureVisible(find.text('Submit for review'));
    await tester.tap(find.text('Submit for review'));
    await tester.pumpAndSettle();
    expect(api.submitted?.legalName, 'Namangan courts');
    expect(find.text('Awaiting review'), findsOneWidget);
    expect(find.byType(TextFormField), findsNothing);
    expect(tester.takeException(), null);
  });
}
