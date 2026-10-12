import 'package:firebase_core/firebase_core.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Device-local send pacing, not a prediction of Firebase quota recovery.
class PhoneOtpSendCooldown {
  PhoneOtpSendCooldown({
    required this.readDeadline,
    required this.writeDeadline,
    DateTime Function()? now,
  }) : _now = now ?? DateTime.now;

  static const _key = 'asp_phone_otp_send_after';
  static const _storage = FlutterSecureStorage();
  static final shared = PhoneOtpSendCooldown(
    readDeadline: () => _storage.read(key: _key),
    writeDeadline: (value) => _storage.write(key: _key, value: value),
  );

  final Future<String?> Function() readDeadline;
  final Future<void> Function(String) writeDeadline;
  final DateTime Function() _now;
  DateTime? _deadline;
  bool _busy = false;

  int get remainingSeconds {
    final milliseconds = _deadline?.difference(_now()).inMilliseconds ?? 0;
    return milliseconds <= 0 ? 0 : (milliseconds / 1000).ceil();
  }

  Future<void> load() async {
    final stored = await readDeadline();
    if (stored == null) return;
    final value = int.tryParse(stored);
    if (value == null) throw StateError('Invalid saved OTP cooldown');
    final deadline = DateTime.fromMillisecondsSinceEpoch(value);
    if (_deadline == null || deadline.isAfter(_deadline!)) _deadline = deadline;
  }

  Future<T> send<T>(Future<T> Function() request) async {
    if (_busy) throw _blocked();
    _busy = true;
    try {
      await load();
      if (remainingSeconds > 0) throw _blocked();
      _deadline = _now().add(const Duration(seconds: 60));
      // Fail closed if persistence fails; Firebase is never called first.
      await writeDeadline(_deadline!.millisecondsSinceEpoch.toString());
      return await request();
    } finally {
      _busy = false;
    }
  }

  FirebaseException _blocked() => FirebaseException(
    plugin: 'firebase_auth',
    code: 'local-otp-cooldown',
    message: _busy && remainingSeconds == 0
        ? 'A code request is already in progress. Please wait.'
        : 'Wait ${remainingSeconds}s before requesting another code. Firebase may require a longer wait.',
  );
}

String phoneOtpWaitMessage(FirebaseException error, String fallback) {
  if (error.code == 'local-otp-cooldown') {
    return error.message ?? 'Please wait before requesting another code.';
  }
  if (error.code == 'too-many-requests') {
    return 'Firebase has limited verification attempts. Wait before trying again; the local countdown does not mean this restriction has ended.';
  }
  if (error.code == 'quota-exceeded') {
    return 'Firebase SMS quota is exceeded. Try later; waiting for the local countdown does not restore provider quota.';
  }
  if (error.code == 'invalid-phone-number') {
    return 'Enter a valid phone number with its country code.';
  }
  return fallback;
}
