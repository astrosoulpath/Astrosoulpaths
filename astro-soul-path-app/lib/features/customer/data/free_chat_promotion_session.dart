import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../astrologers/data/public_astrologer.dart';
import 'free_chat_selection.dart';

class FreeChatPromotionSession {
  FreeChatPromotionSession(this.offset, {this.onDismiss});
  final int offset;
  final void Function()? onDismiss;
  bool _dismissed = false;
  bool get dismissed => _dismissed;
  void dismiss() {
    _dismissed = true;
    onDismiss?.call();
  }

  bool _presented = false;
  List<String>? _selection;
  bool claimPresentation() {
    if (_presented || _dismissed) return false;
    _presented = true;
    return true;
  }

  bool get presented => _presented;
  List<PublicAstrologer> select(List<PublicAstrologer> records) {
    final initial = selectFreeChatAstrologers(records, offset);
    if (_selection == null && initial.isNotEmpty) {
      _selection = initial.map((a) => a.id).toList();
    }
    final current = {
      for (final a in selectFreeChatAstrologers(records, 0)) a.id: a,
    };
    // Look up all eligible records, not just the first five of a rotating pool.
    for (final a in records) {
      if (a.isVerified && a.isOnline && !a.isBusy && a.id.isNotEmpty) {
        current[a.id] = a;
      }
    }
    return [
      for (final id in _selection ?? <String>[])
        if (current[id] != null) current[id]!,
    ];
  }
}

/// One session per canonical account/login revision in this app process.
/// Only a rotation cursor survives app restarts, never eligibility or identities.
class FreeChatPromotionSessions {
  FreeChatPromotionSessions({FlutterSecureStorage? storage})
    : _storage = storage ?? const FlutterSecureStorage();
  final FlutterSecureStorage _storage;
  static String? _key;
  static Future<FreeChatPromotionSession>? _session;
  static Future<void> _writes = Future.value();
  static final Set<String> _dismissedAccounts = {};
  Future<FreeChatPromotionSession> open(String userId, int revision) {
    final key = '$revision:$userId';
    if (_key != key || _session == null) {
      _key = key;
      final task = _writes.then((_) => _load(userId));
      _writes = task.then<void>((_) {}, onError: (Object _) {});
      _session = task;
    }
    return _session!;
  }

  Future<FreeChatPromotionSession> _load(String userId) async {
    final key = 'asp_free_chat_rotation_v1_$userId';
    final offset = int.tryParse(await _storage.read(key: key) ?? '') ?? 0;
    await _storage.write(key: key, value: '${offset + 5}');
    final session = FreeChatPromotionSession(
      offset,
      onDismiss: () => _dismissedAccounts.add(userId),
    );
    if (_dismissedAccounts.contains(userId)) session.dismiss();
    return session;
  }
}
