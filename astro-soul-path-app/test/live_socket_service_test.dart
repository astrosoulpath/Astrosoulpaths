import 'dart:async';

import 'package:astro_soul_path/features/auth/data/auth_session_store.dart';
import 'package:astro_soul_path/features/live/data/live_socket_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:socket_io_client/src/manager.dart' as manager;

StoredAuthSession session(String id, String token) => StoredAuthSession(
  accessToken: token,
  refreshToken: 'refresh',
  role: 'Customer',
  portal: 'customer',
  nextStep: 'dashboard',
  user: {'id': id},
  expiresIn: 3600,
);

class Sessions extends Fake implements AuthSessionStore {
  StoredAuthSession? value = session('canonical', 'first-token');
  Future<StoredAuthSession?> Function()? loader;
  @override
  Future<StoredAuthSession?> read() async => loader == null ? value : loader!();
}

class Manager extends Fake implements manager.Manager {
  @override
  Function() on(String event, dynamic Function(dynamic) handler) => () {};
}

class Socket extends Fake implements io.Socket {
  @override
  final manager.Manager io = Manager();
  final handlers = <String, dynamic Function(dynamic)>{};
  final emitted = <String>[];
  @override
  bool connected = true;
  @override
  Function() on(String event, dynamic Function(dynamic) handler) {
    handlers[event] = handler;
    return () => handlers.remove(event);
  }

  @override
  void emit(String event, [dynamic data]) {
    emitted.add(event);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) {
    if (invocation.memberName == #disconnect ||
        invocation.memberName == #dispose) {
      connected = false;
    }
    if (invocation.memberName == #connect ||
        invocation.memberName == #disconnect) {
      return this;
    }
    return null;
  }
}

void main() {
  late Sessions sessions;
  late Socket socket;
  late LiveSocketService service;
  late Map<String, dynamic> options;
  Future<Map?> handshake() async {
    final result = Completer<Map?>();
    final FutureOr<void> Function(void Function(Map)) auth = options['auth'];
    await auth((proof) => result.complete(proof));
    return result.isCompleted ? await result.future : null;
  }

  setUp(() {
    sessions = Sessions();
    socket = Socket();
    service = LiveSocketService(
      sessionStore: sessions,
      socketFactory: (_, opts) {
        options = opts;
        return socket;
      },
    );
  });
  tearDown(() => service.dispose());

  test(
    'joins only after server authentication and room acknowledgement enables messages',
    () async {
      await service.connect('live');
      expect(socket.emitted, isEmpty);
      service.sendMessage('not joined');
      expect(socket.emitted, isEmpty);
      socket.handlers['live:connected']!(null);
      expect(socket.emitted, ['live:join']);
      service.sendMessage('still not joined');
      expect(socket.emitted, ['live:join']);
      socket.handlers['live:joined']!(null);
      service.sendMessage('joined');
      expect(socket.emitted, ['live:join', 'live:message']);
    },
  );

  test(
    'each handshake uses current token of the same canonical account',
    () async {
      await service.connect('live');
      expect(await handshake(), {'token': 'first-token'});
      sessions.value = session('canonical', 'refreshed-token');
      expect(await handshake(), {'token': 'refreshed-token'});
      expect(options['forceNew'], true);
    },
  );

  test('logout fails closed without sending old authentication', () async {
    await service.connect('live');
    sessions.value = null;
    expect(await handshake(), isNull);
    expect(socket.connected, false);
  });

  test('account switch fails closed', () async {
    await service.connect('live');
    sessions.value = session('foreign', 'foreign-token');
    expect(await handshake(), isNull);
    expect(socket.connected, false);
  });

  test('dispose during authentication prevents stale handshake', () async {
    await service.connect('live');
    final pending = Completer<StoredAuthSession?>();
    sessions.loader = () => pending.future;
    final proof = handshake();
    await service.dispose();
    pending.complete(session('canonical', 'stale-token'));
    expect(await proof, isNull);
  });

  test(
    'disconnected sockets do not buffer messages; rejoin is required',
    () async {
      await service.connect('live');
      socket.handlers['live:joined']!(null);
      socket.handlers['disconnect']!('transport close');
      service.sendMessage('stale');
      expect(socket.emitted, isEmpty);
      socket.handlers['live:connected']!(null);
      service.sendMessage('awaiting rejoin');
      expect(socket.emitted, ['live:join']);
      socket.handlers['live:joined']!(null);
      service.sendMessage('restored');
      expect(socket.emitted, ['live:join', 'live:message']);
    },
  );
}
