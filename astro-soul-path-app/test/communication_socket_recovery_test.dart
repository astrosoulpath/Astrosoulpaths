import 'dart:async';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/features/auth/data/auth_session_store.dart';
import 'package:astro_soul_path/features/chat/data/communication_socket_recovery.dart';

StoredAuthSession session(String token, {String id = 'canonical'}) =>
    StoredAuthSession(
      accessToken: token,
      refreshToken: '',
      role: 'CUSTOMER',
      portal: 'customer',
      nextStep: 'DASHBOARD',
      user: {'id': id},
      expiresIn: 3600,
      authProvider: 'firebase',
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test(
    'socket clients wait for server authentication before room registration',
    () {
      final chat = File(
        'lib/features/chat/data/chat_socket_service.dart',
      ).readAsStringSync();
      final connected = chat
          .substring(chat.indexOf('socket!.onConnect('))
          .split("socket!.on('chat:connected'")
          .first;
      expect(connected, isNot(contains("emit('chat:join'")));
      final acknowledged = chat
          .substring(chat.indexOf("socket!.on('chat:connected'"))
          .split('socket!.onDisconnect')
          .first;
      expect(acknowledged, contains("emit('chat:join'"));
      for (final type in ['audio', 'video']) {
        final source = File(
          'lib/features/calling/data/${type}_call_socket_service.dart',
        ).readAsStringSync();
        expect(source, contains("socket.on('call:connected'"));
        expect(source, isNot(contains('socket.onConnect((_) {')));
      }
    },
  );
  test(
    'uses refreshed token before connecting, never stale argument',
    () async {
      final tokens = <String>[];
      var connected = 0;
      final recovery = CommunicationSocketRecovery(
        initialToken: 'stale',
        expectedUserId: 'canonical',
        applyToken: tokens.add,
        connect: () => connected++,
        disconnect: () {},
        readSession: (_) async => session('fresh'),
      );
      await recovery.reconnect();
      expect(tokens, ['fresh']);
      expect(connected, 1);
      recovery.dispose();
    },
  );
  test('concurrent reconnects share refresh and connect once', () async {
    final pending = Completer<StoredAuthSession?>();
    var reads = 0, connections = 0;
    final recovery = CommunicationSocketRecovery(
      random: () => 1,
      initialToken: 'old',
      expectedUserId: 'canonical',
      applyToken: (_) {},
      connect: () => connections++,
      disconnect: () {},
      readSession: (_) {
        reads++;
        return pending.future;
      },
    );
    final a = recovery.reconnect(force: true),
        b = recovery.reconnect(force: true);
    pending.complete(session('fresh'));
    await Future.wait([a, b]);
    expect(reads, 2);
    expect(connections, 1);
    recovery.dispose();
  });
  test('dispose fences a delayed refresh and cannot restore socket', () async {
    final pending = Completer<StoredAuthSession?>();
    var connections = 0;
    final recovery = CommunicationSocketRecovery(
      random: () => 1,
      initialToken: 'old',
      expectedUserId: 'canonical',
      applyToken: (_) {},
      connect: () => connections++,
      disconnect: () {},
      readSession: (_) => pending.future,
    );
    final work = recovery.reconnect();
    recovery.dispose();
    pending.complete(session('fresh'));
    await work;
    expect(connections, 0);
  });
  test('logout during refresh blocks reconnection', () async {
    var reads = 0, connections = 0, disconnections = 0;
    final recovery = CommunicationSocketRecovery(
      random: () => 1,
      initialToken: 'old',
      expectedUserId: 'canonical',
      applyToken: (_) {},
      connect: () => connections++,
      disconnect: () => disconnections++,
      readSession: (_) async => ++reads == 1 ? session('fresh') : null,
    );
    await recovery.reconnect();
    expect(connections, 0);
    expect(disconnections, 1);
    recovery.dispose();
  });
  test('foreign account never receives prior account socket', () async {
    var connections = 0;
    final recovery = CommunicationSocketRecovery(
      random: () => 1,
      initialToken: 'old',
      expectedUserId: 'canonical',
      applyToken: (_) {},
      connect: () => connections++,
      disconnect: () {},
      readSession: (_) async => session('fresh', id: 'foreign'),
    );
    await recovery.reconnect();
    expect(connections, 0);
    recovery.dispose();
  });
  test(
    'provider refresh failure disconnects without using old token',
    () async {
      var connections = 0, disconnections = 0;
      final recovery = CommunicationSocketRecovery(
        random: () => 1,
        initialToken: 'old',
        expectedUserId: 'canonical',
        applyToken: (_) {},
        connect: () => connections++,
        disconnect: () => disconnections++,
        readSession: (_) async => throw StateError('mock provider failure'),
      );
      await recovery.reconnect(force: true);
      expect(connections, 0);
      expect(disconnections, 1);
      recovery.dispose();
    },
  );
  testWidgets(
    'auth-required recovery requests refresh; dispose cancels retries',
    (tester) async {
      final forceReads = <bool>[];
      final recovery = CommunicationSocketRecovery(
        random: () => 1,
        initialToken: 'old',
        expectedUserId: 'canonical',
        applyToken: (_) {},
        connect: () {},
        disconnect: () {},
        readSession: (force) async {
          forceReads.add(force);
          return session('fresh');
        },
      );
      recovery.schedule(force: true);
      await tester.pump(const Duration(seconds: 1));
      expect(forceReads, [true, false]);
      recovery.schedule();
      recovery.dispose();
      await tester.pump(const Duration(seconds: 10));
      expect(forceReads.length, 2);
    },
  );
  testWidgets('rapid transport errors coalesce into bounded retries', (
    tester,
  ) async {
    var reads = 0;
    final recovery = CommunicationSocketRecovery(
      random: () => 1,
      initialToken: 'old',
      expectedUserId: 'canonical',
      applyToken: (_) {},
      connect: () {},
      disconnect: () {},
      readSession: (_) async {
        reads++;
        return session('fresh');
      },
    );
    for (var i = 0; i < 8; i++) {
      recovery.schedule();
      recovery.schedule();
      await tester.pump(const Duration(seconds: 31));
    }
    expect(reads, greaterThan(6));
    recovery.dispose();
  });
  test(
    'typing does not dispose/cancel the voice recorder; disposal remains screen-owned',
    () {
      final source = File(
        'lib/features/chat/presentation/screens/chat_screen.dart',
      ).readAsStringSync();
      for (final name in ['_handleTyping', '_handleRemoteTyping']) {
        final body = source
            .substring(source.indexOf('  void $name('))
            .split('\n  }')
            .first;
        expect(body, isNot(contains('_voiceRecorder.dispose')));
        expect(body, isNot(contains('_voiceRecordingTimer?.cancel')));
      }
      expect('_voiceRecorder.dispose'.allMatches(source).length, 1);
      final background = source
          .substring(source.indexOf('  void _handleAppBackgrounded('))
          .split('\n  }')
          .first;
      expect(background, contains('_cancelVoiceRecording'));
    },
  );
}
