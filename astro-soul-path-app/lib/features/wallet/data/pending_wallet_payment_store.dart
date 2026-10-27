import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../auth/data/auth_session_store.dart';

/// Recovery metadata only; a stored order is never evidence of payment success.
class PendingWalletPaymentStore {
  PendingWalletPaymentStore({
    AuthSessionStore? sessions,
    FlutterSecureStorage? storage,
    this.portal = 'customer',
    this.purpose = 'wallet',
  }) : _sessions = sessions ?? AuthSessionStore(),
       _storage = storage ?? const FlutterSecureStorage(),
       _revision = AuthSessionStore.sessionRevision;

  final AuthSessionStore _sessions;
  final FlutterSecureStorage _storage;
  final int _revision;
  final String portal;
  final String purpose;
  String? _owner;

  Future<String> _key() async {
    final session = await _sessions.read();
    final owner = session?.user['id'];
    if (_revision != AuthSessionStore.sessionRevision ||
        !['customer', 'astrologer'].contains(portal) ||
        !['wallet', 'subscription'].contains(purpose) ||
        (purpose == 'wallet' && portal != 'customer') ||
        session?.portal != portal ||
        owner is! String ||
        owner.isEmpty ||
        (_owner != null && owner != _owner)) {
      throw StateError('Account changed. Reopen the wallet.');
    }
    _owner = owner;
    return purpose == 'wallet'
        ? 'asp_pending_wallet_order_v1_${Uri.encodeComponent(owner)}'
        : 'asp_pending_subscription_order_v1_${portal}_${Uri.encodeComponent(owner)}';
  }

  Future<String?> read() async {
    final key = await _key();
    final order = await _storage.read(key: key);
    await _key();
    return order;
  }

  Future<void> save(String order) async {
    if (!RegExp(r'^order_[A-Za-z0-9]+$').hasMatch(order)) {
      throw StateError('Invalid server payment reference');
    }
    final key = await _key();
    await _storage.write(key: key, value: order);
    await _key();
  }

  Future<void> clear(String expectedOrder) async {
    final key = await _key();
    if (await _storage.read(key: key) != expectedOrder) return;
    await _key();
    await _storage.delete(key: key);
  }
}
