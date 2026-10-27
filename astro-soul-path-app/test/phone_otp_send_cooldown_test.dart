import 'dart:async';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/features/auth/data/phone_otp_send_cooldown.dart';

void main() {
  late DateTime now;
  String? stored;
  late PhoneOtpSendCooldown guard;
  PhoneOtpSendCooldown create() => PhoneOtpSendCooldown(
    readDeadline: () async => stored,
    writeDeadline: (value) async => stored = value,
    now: () => now,
  );
  setUp(() {
    now = DateTime.utc(2026);
    stored = null;
    guard = create();
  });
  test(
    'initial send persists deadline before request and duplicate taps are blocked',
    () async {
      final pending = Completer<int>();
      var calls = 0;
      final first = guard.send(() {
        calls++;
        expect(stored, isNotNull);
        return pending.future;
      });
      await expectLater(
        guard.send(() async {
          calls++;
          return 2;
        }),
        throwsA(isA<FirebaseException>()),
      );
      await Future<void>.delayed(Duration.zero);
      now = now.add(const Duration(seconds: 61));
      await expectLater(
        guard.send(() async => 3),
        throwsA(isA<FirebaseException>()),
      );
      pending.complete(1);
      expect(await first, 1);
      expect(calls, 1);
    },
  );
  test('send failure keeps cooldown without automatic retry', () async {
    var calls = 0;
    await expectLater(
      guard.send(() async {
        calls++;
        throw StateError('failed');
      }),
      throwsStateError,
    );
    await expectLater(
      guard.send(() async {
        calls++;
      }),
      throwsA(isA<FirebaseException>()),
    );
    expect(calls, 1);
    expect(guard.remainingSeconds, 60);
  });
  test(
    'screen navigation shares guard and restart restores deadline',
    () async {
      await guard.send(() async => 1);
      await expectLater(
        guard.send(() async => 2),
        throwsA(isA<FirebaseException>()),
      );
      final restarted = create();
      await restarted.load();
      expect(restarted.remainingSeconds, 60);
      await expectLater(
        restarted.send(() async => 3),
        throwsA(isA<FirebaseException>()),
      );
    },
  );
  test(
    'resend allowed only after deadline and preserves caller token',
    () async {
      await guard.send(() async => 1);
      now = now.add(const Duration(seconds: 59));
      await expectLater(
        guard.send(() async => 2),
        throwsA(isA<FirebaseException>()),
      );
      now = now.add(const Duration(seconds: 1));
      final token = 7;
      expect(await guard.send(() async => token), 7);
      expect(guard.remainingSeconds, 60);
    },
  );
  test(
    'provider code preserved and message never promises quota recovery',
    () async {
      final error = FirebaseException(
        plugin: 'firebase_auth',
        code: 'too-many-requests',
      );
      await expectLater(
        guard.send(() async => throw error),
        throwsA(same(error)),
      );
      expect(phoneOtpWaitMessage(error, 'fallback'), contains('does not mean'));
    },
  );
  test('storage failure prevents provider invocation', () async {
    var calls = 0;
    final broken = PhoneOtpSendCooldown(
      readDeadline: () async => null,
      writeDeadline: (_) async => throw StateError('storage'),
      now: () => now,
    );
    await expectLater(
      broken.send(() async {
        calls++;
      }),
      throwsStateError,
    );
    expect(calls, 0);
  });
  test('quota, invalid phone and local cooldown have distinct messages', () {
    expect(
      phoneOtpWaitMessage(
        FirebaseException(plugin: 'firebase_auth', code: 'quota-exceeded'),
        'fallback',
      ),
      contains('quota'),
    );
    expect(
      phoneOtpWaitMessage(
        FirebaseException(
          plugin: 'firebase_auth',
          code: 'invalid-phone-number',
        ),
        'fallback',
      ),
      contains('country code'),
    );
    expect(
      phoneOtpWaitMessage(
        FirebaseException(
          plugin: 'firebase_auth',
          code: 'local-otp-cooldown',
          message: 'Wait locally',
        ),
        'fallback',
      ),
      'Wait locally',
    );
    expect(
      phoneOtpWaitMessage(
        FirebaseException(plugin: 'firebase_auth', code: 'unknown'),
        'Backend request failed',
      ),
      'Backend request failed',
    );
  });
  test(
    'invalid-number failure permits correction without automatic retry',
    () async {
      await expectLater(
        guard.send(
          () async => throw FirebaseException(
            plugin: 'firebase_auth',
            code: 'invalid-phone-number',
          ),
        ),
        throwsA(isA<FirebaseException>()),
      );
      expect(guard.remainingSeconds, 0);
      expect(await guard.send(() async => 'sent'), 'sent');
    },
  );
}
