import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:astro_soul_path/features/auth/data/auth_session_store.dart';
import 'package:astro_soul_path/features/wallet/data/pending_wallet_payment_store.dart';

class _Sessions extends AuthSessionStore {
  String? owner = 'syntheticA';
  @override
  Future<StoredAuthSession?> read() async => owner == null
      ? null
      : StoredAuthSession(
          accessToken: 'synthetic',
          refreshToken: '',
          role: 'CUSTOMER',
          portal: 'customer',
          nextStep: '',
          user: {'id': owner},
          expiresIn: 3600,
        );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  test(
    'pending reference survives reconstruction without storing payment success',
    () async {
      final sessions = _Sessions();
      await PendingWalletPaymentStore(
        sessions: sessions,
      ).save('order_synthetic');
      expect(
        await PendingWalletPaymentStore(sessions: sessions).read(),
        'order_synthetic',
      );
    },
  );
  test(
    'account switching never exposes another customer pending order',
    () async {
      final sessions = _Sessions();
      final old = PendingWalletPaymentStore(sessions: sessions);
      await old.save('order_synthetic');
      sessions.owner = 'syntheticB';
      await expectLater(old.read(), throwsStateError);
      expect(
        await PendingWalletPaymentStore(sessions: sessions).read(),
        isNull,
      );
      sessions.owner = 'syntheticA';
      expect(
        await PendingWalletPaymentStore(sessions: sessions).read(),
        'order_synthetic',
      );
    },
  );
  test('logout blocks reads and writes', () async {
    final sessions = _Sessions()..owner = null;
    final store = PendingWalletPaymentStore(sessions: sessions);
    await expectLater(store.read(), throwsStateError);
    await expectLater(store.save('order_synthetic'), throwsStateError);
  });
  test('terminal reconciliation clears only its matching reference', () async {
    final store = PendingWalletPaymentStore(sessions: _Sessions());
    await store.save('order_synthetic');
    await store.clear('order_foreign');
    expect(await store.read(), 'order_synthetic');
    await store.clear('order_synthetic');
    expect(await store.read(), isNull);
  });
  test('invalid callback reference cannot be persisted', () async {
    final store = PendingWalletPaymentStore(sessions: _Sessions());
    await expectLater(store.save('../arbitrary'), throwsStateError);
    expect(await store.read(), isNull);
  });
}
