import 'dart:async';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/features/auth/data/auth_session_store.dart';
import 'package:astro_soul_path/features/chat/data/communication_socket_recovery.dart';

StoredAuthSession valid() => StoredAuthSession(
  accessToken: 'fresh',
  refreshToken: '',
  role: 'CUSTOMER',
  portal: 'customer',
  nextStep: 'DASHBOARD',
  user: {'id': 'owner'},
  expiresIn: 3600,
  authProvider: 'firebase',
);

void main() {
  for (final jitter in [0.0, 1.0]) {
    testWidgets('jitter $jitter stays within the first backoff window', (
      tester,
    ) async {
      var attempts = 0;
      final recovery = CommunicationSocketRecovery(
        initialToken: 'old',
        expectedUserId: 'owner',
        random: () => jitter,
        applyToken: (_) {},
        connect: () {
          attempts++;
        },
        disconnect: () {},
        readSession: (_) async => valid(),
      );
      recovery.schedule();
      final delay = jitter == 0 ? 800 : 1000;
      await tester.pump(Duration(milliseconds: delay - 1));
      expect(attempts, 0);
      await tester.pump(const Duration(milliseconds: 1));
      expect(attempts, 1);
      recovery.dispose();
    });
  }
  testWidgets(
    'foreground recovery waits for an obsolete in-flight refresh then retries',
    (tester) async {
      final pending = Completer<StoredAuthSession?>();
      var reads = 0, attempts = 0;
      final recovery = CommunicationSocketRecovery(
        initialToken: 'old',
        expectedUserId: 'owner',
        random: () => 1,
        applyToken: (_) {},
        connect: () {
          attempts++;
        },
        disconnect: () {},
        readSession: (_) =>
            ++reads == 1 ? pending.future : Future.value(valid()),
      );
      final work = recovery.reconnect();
      recovery.didChangeAppLifecycleState(AppLifecycleState.paused);
      recovery.didChangeAppLifecycleState(AppLifecycleState.resumed);
      await tester.pump(const Duration(seconds: 2));
      pending.complete(valid());
      await work;
      await tester.pump(const Duration(seconds: 4));
      expect(attempts, 1);
      recovery.dispose();
    },
  );
  testWidgets(
    'long outage retries indefinitely with capped delays; recovers and stops on ack',
    (tester) async {
      var attempts = 0;
      var available = false;
      late CommunicationSocketRecovery recovery;
      recovery = CommunicationSocketRecovery(
        initialToken: 'old',
        expectedUserId: 'owner',
        random: () => 1,
        applyToken: (_) {},
        connect: () {
          attempts++;
          if (available) {
            recovery.connected();
          } else {
            recovery.schedule();
          }
        },
        disconnect: () {},
        readSession: (_) async => valid(),
      );
      await recovery.reconnect();
      for (var i = 0; i < 15; i++) {
        await tester.pump(const Duration(seconds: 31));
      }
      expect(attempts, greaterThan(10));
      available = true;
      await tester.pump(const Duration(seconds: 31));
      final recovered = attempts;
      await tester.pump(const Duration(minutes: 2));
      expect(attempts, recovered);
      recovery.dispose();
    },
  );
  testWidgets('background pauses retries and foreground resumes once', (
    tester,
  ) async {
    var attempts = 0;
    final recovery = CommunicationSocketRecovery(
      initialToken: 'old',
      expectedUserId: 'owner',
      random: () => 1,
      applyToken: (_) {},
      connect: () {
        attempts++;
      },
      disconnect: () {},
      readSession: (_) async => valid(),
    );
    recovery.schedule();
    recovery.didChangeAppLifecycleState(AppLifecycleState.paused);
    await tester.pump(const Duration(minutes: 2));
    expect(attempts, 0);
    recovery.didChangeAppLifecycleState(AppLifecycleState.resumed);
    await tester.pump(const Duration(seconds: 2));
    expect(attempts, 1);
    recovery.dispose();
  });
  testWidgets(
    'logout terminates retries even when disconnect emits another retry',
    (tester) async {
      var attempts = 0;
      late CommunicationSocketRecovery recovery;
      recovery = CommunicationSocketRecovery(
        initialToken: 'old',
        expectedUserId: 'owner',
        applyToken: (_) {},
        connect: () {
          attempts++;
        },
        disconnect: () => recovery.schedule(),
        readSession: (_) async => null,
      );
      await recovery.reconnect();
      await tester.pump(const Duration(minutes: 2));
      recovery.schedule();
      await tester.pump(const Duration(minutes: 2));
      expect(attempts, 0);
      recovery.dispose();
    },
  );
  testWidgets('background fences an in-flight refresh', (tester) async {
    final pending = Completer<StoredAuthSession?>();
    var attempts = 0;
    final recovery = CommunicationSocketRecovery(
      initialToken: 'old',
      expectedUserId: 'owner',
      applyToken: (_) {},
      connect: () {
        attempts++;
      },
      disconnect: () {},
      readSession: (_) => pending.future,
    );
    final work = recovery.reconnect();
    recovery.didChangeAppLifecycleState(AppLifecycleState.paused);
    pending.complete(valid());
    await work;
    expect(attempts, 0);
    recovery.dispose();
  });
}
