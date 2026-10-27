import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:astro_soul_path/features/auth/data/auth_session_store.dart';
import 'package:astro_soul_path/features/marketplace/data/marketplace_customer_api.dart';
import 'package:astro_soul_path/features/marketplace/data/marketplace_public_api.dart';
import 'package:astro_soul_path/features/marketplace/data/marketplace_seller_api.dart';
import 'package:astro_soul_path/features/marketplace/data/marketplace_money.dart';
import 'package:astro_soul_path/features/marketplace/data/marketplace_session_client.dart';
import 'package:astro_soul_path/features/marketplace/presentation/screens/marketplace_home_screen.dart';
import 'package:astro_soul_path/features/profile/data/profile_api.dart';
import 'package:astro_soul_path/features/profile/data/customer_profile.dart';
import 'package:astro_soul_path/features/marketplace/presentation/marketplace_private_state.dart';
import 'package:astro_soul_path/features/marketplace/presentation/screens/marketplace_seller_finance_screen.dart';

class PrivateProbe extends StatefulWidget {
  const PrivateProbe({super.key});
  @override
  State<PrivateProbe> createState() => PrivateProbeState();
}

int probeEpoch = 0;

class PrivateProbeState extends MarketplacePrivateState<PrivateProbe> {
  @override
  int get sessionRevision => probeEpoch;
  @override
  Widget buildMarketplace(BuildContext context) =>
      const Scaffold(body: Text('Synthetic private order'));
}

class SellerFinance extends MarketplaceSellerApi {
  @override
  Future<Map<String, dynamic>> getEarnings() async => {
    'payoutRequestsEnabled': false,
    'summary': [
      {
        'status': 'AVAILABLE',
        'currency': 'INR',
        '_sum': {'netAmount': '70'},
      },
      {
        'status': 'AVAILABLE',
        'currency': 'USD',
        '_sum': {'netAmount': '35'},
      },
    ],
    'earnings': [
      {
        'currency': 'INR',
        'status': 'AVAILABLE',
        'grossAmount': '100',
        'platformFeeAmount': '30',
        'netAmount': '70',
      },
      {
        'currency': 'USD',
        'status': 'AVAILABLE',
        'grossAmount': '50',
        'platformFeeAmount': '15',
        'netAmount': '35',
      },
    ],
  };
  @override
  Future<List<Map<String, dynamic>>> getPayouts() async => [];
}

class Session extends AuthSessionStore {
  String token = 'synthetic';
  @override
  Future<StoredAuthSession?> read() async => token.isEmpty
      ? null
      : StoredAuthSession(
          accessToken: token,
          refreshToken: '',
          role: 'CUSTOMER',
          portal: 'customer',
          nextStep: '',
          user: {'id': 'synthetic'},
          expiresIn: 3600,
        );
}

class Profiles extends ProfileApi {
  @override
  Future<List<CustomerProfile>> getProfiles() async => [];
}

class Catalogue extends MarketplacePublicApi {
  Catalogue({this.fail = false, this.empty = false});
  final bool fail, empty;
  final List<int?> pages = [];
  @override
  Future<List<Map<String, dynamic>>> getCategories() async => [];
  @override
  Future<List<Map<String, dynamic>>> getCampaigns() async => [];
  @override
  Future<List<Map<String, dynamic>>> getProducts({
    String? search,
    String? categoryId,
    bool featuredOnly = false,
    String? countryCode,
    int? page,
    int limit = 24,
  }) async {
    pages.add(page);
    if (fail) throw const MarketplacePublicApiException('Synthetic offline');
    if (empty) return [];
    return List.generate(
      page == 1 ? 24 : 1,
      (i) => {
        'id': 'p$page-$i',
        'name': 'Synthetic product $page-$i',
        'sellingPrice': '100',
        'currency': 'INR',
        'stock': 1,
        'images': [],
      },
    );
  }
}

class FractionFinance extends SellerFinance {
  @override
  Future<Map<String, dynamic>> getEarnings() async => {
    'payoutRequestsEnabled': false,
    'summary': [
      {
        'status': 'AVAILABLE',
        'currency': 'INR',
        '_sum': {'netAmount': '0.30'},
      },
    ],
    'earnings': [
      {'currency': 'INR', 'status': 'AVAILABLE', 'netAmount': '0.10'},
      {'currency': 'INR', 'status': 'AVAILABLE', 'netAmount': '0.20'},
    ],
  };
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  testWidgets(
    'logout removes private marketplace content within bounded interval',
    (tester) async {
      await tester.pumpWidget(const MaterialApp(home: PrivateProbe()));
      expect(find.text('Synthetic private order'), findsOneWidget);
      probeEpoch++;
      await tester.pump(const Duration(milliseconds: 500));
      expect(find.text('Synthetic private order'), findsNothing);
      expect(find.textContaining('Your account changed'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  testWidgets(
    'seller summary shows currencies separately and disables withdrawals',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(home: MarketplaceSellerFinanceScreen(api: SellerFinance())),
      );
      await tester.pumpAndSettle();
      expect(find.textContaining('INR 70.00'), findsWidgets);
      expect(find.textContaining('USD 35.00'), findsWidgets);
      expect(find.text('Multiple currencies — see breakdown'), findsOneWidget);
      expect(find.text('Withdrawals unavailable'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  testWidgets(
    'available amount uses server aggregate without floating addition',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: MarketplaceSellerFinanceScreen(api: FractionFinance()),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('INR 0.30'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  testWidgets('client bound to old account cannot send a new request', (
    tester,
  ) async {
    await tester.runAsync(() async {
      var calls = 0;
      var epoch = 1;
      final api = MarketplaceCustomerApi(
        sessionStore: Session(),
        client: MarketplaceSessionClient(
          MockClient((r) async {
            calls++;
            return http.Response('{"data":{}}', 200);
          }),
          Session(),
          revisionReader: () => epoch,
        ),
      );
      epoch++;
      await expectLater(
        api.getCart(),
        throwsA(isA<MarketplaceCustomerApiException>()),
      );
      expect(calls, 0);
      api.dispose();
    });
  });
  test('money preserves currency and precision', () {
    expect(marketplaceMoney('3500', 'INR'), 'INR 3500.00');
    expect(marketplaceMoney('12.3', 'USD'), 'USD 12.30');
    expect(marketplaceMoney(null, 'INR'), 'Unavailable');
    expect(marketplaceMoney('1.001', 'INR'), 'Unavailable');
  });
  test('catalogue sends bounded pagination and safe encoded filters', () async {
    final api = MarketplacePublicApi(
      client: MockClient((r) async {
        expect(r.url.queryParameters, containsPair('page', '2'));
        expect(r.url.queryParameters['search'], 'love & light');
        expect(r.url.queryParameters.containsKey('featured'), false);
        return http.Response(jsonEncode({'data': []}), 200);
      }),
    );
    await api.getProducts(page: 2, search: 'love & light');
    api.dispose();
  });
  test('invalid pagination never sends request', () async {
    final api = MarketplacePublicApi(
      client: MockClient((r) async => throw StateError('must not send')),
    );
    await expectLater(
      api.getProducts(page: 0),
      throwsA(isA<MarketplacePublicApiException>()),
    );
    api.dispose();
  });
  test('missing session never sends cart request', () async {
    final s = Session()..token = '';
    final api = MarketplaceCustomerApi(
      sessionStore: s,
      client: MockClient((r) async => throw StateError('must not send')),
    );
    await expectLater(
      api.getCart(),
      throwsA(isA<MarketplaceCustomerApiException>()),
    );
    api.dispose();
  });
  test('401 is not retried, write is never replayed', () async {
    var count = 0;
    final api = MarketplaceCustomerApi(
      sessionStore: Session(),
      client: MockClient((r) async {
        count++;
        return http.Response('{}', 401);
      }),
    );
    await expectLater(
      api.addCartItem(productId: 'p', quantity: 1),
      throwsA(isA<MarketplaceCustomerApiException>()),
    );
    expect(count, 1);
    api.dispose();
  });
  test('cart uses auth and backend totals, no client price', () async {
    final api = MarketplaceCustomerApi(
      sessionStore: Session(),
      client: MockClient((r) async {
        expect(r.headers['Authorization'], 'Bearer synthetic');
        expect(jsonDecode(r.body), {'productId': 'p', 'quantity': 2});
        return http.Response('{"data":{"grandTotal":"200"}}', 200);
      }),
    );
    expect(
      (await api.addCartItem(productId: 'p', quantity: 2))['grandTotal'],
      '200',
    );
    api.dispose();
  });
  testWidgets('logout discards an in-flight private cart response', (
    tester,
  ) async {
    await tester.runAsync(() async {
      final done = Completer<http.Response>();
      final started = Completer<void>();
      var epoch = 1;
      final api = MarketplaceCustomerApi(
        sessionStore: Session(),
        client: MarketplaceSessionClient(
          MockClient((r) {
            started.complete();
            return done.future;
          }),
          Session(),
          revisionReader: () => epoch,
        ),
      );
      final future = api.getCart();
      await started.future;
      epoch++;
      done.complete(http.Response('{"data":{"private":"old"}}', 200));
      await expectLater(
        future,
        throwsA(isA<MarketplaceCustomerApiException>()),
      );
      api.dispose();
    });
  });
  test('seller pause uses authenticated scoped API', () async {
    final api = MarketplaceSellerApi(
      sessionStore: Session(),
      client: MockClient((r) async {
        expect(r.method, 'PATCH');
        expect(r.url.path, '/marketplace/seller/products/p/pause');
        return http.Response('{}', 200);
      }),
    );
    await api.setProductPaused('p', true);
    api.dispose();
  });
  test('unconfirmed payment cannot become order success', () async {
    final api = MarketplaceCustomerApi(
      sessionStore: Session(),
      client: MockClient(
        (r) async => http.Response(
          '{"data":{"orderConfirmed":false,"signatureVerified":true}}',
          200,
        ),
      ),
    );
    await expectLater(
      api.verifyRazorpayPayment(
        orderId: 'o',
        razorpayOrderId: 'r',
        razorpayPaymentId: 'p',
        razorpaySignature: 'synthetic',
      ),
      throwsA(isA<MarketplaceCustomerApiException>()),
    );
    api.dispose();
  });
  test('refund request carries idempotency and minor units only', () async {
    final api = MarketplaceCustomerApi(
      sessionStore: Session(),
      client: MockClient((r) async {
        expect(jsonDecode(r.body), {
          'kind': 'REFUND',
          'amountMinor': 1000,
          'reason': 'Synthetic',
          'idempotencyKey': 'synthetic-key',
        });
        return http.Response('{}', 200);
      }),
    );
    await api.createCase('o', {
      'kind': 'REFUND',
      'amountMinor': 1000,
      'reason': 'Synthetic',
      'idempotencyKey': 'synthetic-key',
    });
    api.dispose();
  });
  for (final width in [360.0, 768.0]) {
    testWidgets('catalogue renders at $width and loads another backend page', (
      tester,
    ) async {
      tester.view.physicalSize = Size(width, 900);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final api = Catalogue();
      await tester.pumpWidget(
        MaterialApp(
          home: MarketplaceHomeScreen(api: api, profileApi: Profiles()),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Synthetic product 1-0'), findsOneWidget);
      await tester.ensureVisible(find.text('Load more products'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Load more products'));
      await tester.pumpAndSettle();
      expect(api.pages, [1, 2]);
      expect(tester.takeException(), isNull);
    });
  }
  testWidgets('empty catalogue shows no fabricated products', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: MarketplaceHomeScreen(
          api: Catalogue(empty: true),
          profileApi: Profiles(),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('No approved products available'), findsOneWidget);
  });
  testWidgets('failed catalogue shows retry', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: MarketplaceHomeScreen(
          api: Catalogue(fail: true),
          profileApi: Profiles(),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Marketplace unavailable'), findsOneWidget);
    expect(find.text('Retry'), findsOneWidget);
  });
}
