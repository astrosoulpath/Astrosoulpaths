import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/features/wallet/data/customer_wallet.dart';
import 'package:astro_soul_path/features/wallet/data/pending_wallet_payment_store.dart';
import 'package:astro_soul_path/features/wallet/data/recharge_pack.dart';
import 'package:astro_soul_path/features/wallet/data/wallet_api.dart';
import 'package:astro_soul_path/features/wallet/presentation/screens/recharge_pack_screen.dart';

class NoPending extends PendingWalletPaymentStore {
  @override
  Future<String?> read() async => null;
}

class Wallet extends WalletApi {
  Wallet({this.fail = false});
  final bool fail;
  int orders = 0;
  @override
  Future<CustomerWallet> getWallet() async {
    if (fail) throw const WalletApiException('Wallet unavailable');
    return CustomerWallet.fromJson({'id': 'fixture-wallet', 'currency': 'INR'});
  }

  @override
  Future<List<RechargePack>> getRechargePacks() async => [];
  @override
  Future<Map<String, dynamic>> createRechargeOrder(double amount) async {
    orders++;
    throw StateError('No checkout is permitted in this widget test');
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('razorpay_flutter'),
          (_) async => null,
        );
  });
  testWidgets(
    'empty catalogue preserves custom recharge without creating orders',
    (tester) async {
      final api = Wallet();
      await tester.pumpWidget(
        MaterialApp(
          home: RechargePackScreen(walletApi: api, pendingStore: NoPending()),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        find.text('No recharge packs are available right now.'),
        findsOneWidget,
      );
      await tester.tap(find.text('Enter your amount'));
      await tester.pumpAndSettle();
      expect(find.byType(TextField), findsOneWidget);
      for (final invalid in ['20', 'NaN']) {
        await tester.enterText(find.byType(TextField), invalid);
        await tester.tap(find.text('Proceed'));
        await tester.pump();
        expect(api.orders, 0);
      }
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets('wallet failure cannot expose a checkout action', (tester) async {
    final api = Wallet(fail: true);
    await tester.pumpWidget(
      MaterialApp(
        home: RechargePackScreen(walletApi: api, pendingStore: NoPending()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Try Again'), findsOneWidget);
    expect(find.text('Enter your amount'), findsNothing);
    expect(api.orders, 0);
    await tester.pumpWidget(const SizedBox());
  });
}
