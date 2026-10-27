import 'dart:async';
import 'dart:convert';
import 'package:flutter/widgets.dart';
import 'package:agora_rtc_engine/agora_rtc_engine.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:astro_soul_path/features/auth/data/auth_session_store.dart';
import 'package:astro_soul_path/features/live/data/live_api.dart';
import 'package:astro_soul_path/features/live/data/live_models.dart';
import 'package:astro_soul_path/features/live/data/live_rtc_service.dart';
import 'package:astro_soul_path/features/live/data/live_v2_api.dart';
import 'package:astro_soul_path/features/live/data/live_v2_socket_service.dart';
import 'package:astro_soul_path/features/live/data/live_v2_flow.dart';

class Sessions extends Fake implements AuthSessionStore {
  String owner = 'canonical';
  int refreshed = 0;
  StoredAuthSession get value => StoredAuthSession(
    accessToken: 'synthetic-auth-token',
    refreshToken: 'refresh',
    role: 'Customer',
    portal: 'customer',
    nextStep: 'dashboard',
    user: {'id': owner},
    expiresIn: 3600,
  );
  @override
  Future<StoredAuthSession?> read() async => value;
  @override
  Future<StoredAuthSession?> forceRefresh() async {
    refreshed++;
    return value;
  }
}

class Storage extends Fake implements FlutterSecureStorage {
  final values = <String, String>{};
  @override
  dynamic noSuchMethod(Invocation i) {
    final key = i.namedArguments[#key] as String;
    if (i.memberName == #read) return Future<String?>.value(values[key]);
    if (i.memberName == #write) {
      values[key] = i.namedArguments[#value] as String;
    }
    if (i.memberName == #delete) values.remove(key);
    return Future<void>.value();
  }
}

class Server {
  final requests = <http.Request>[];
  final connections = <String, Map<String, dynamic>>{};
  bool wrongUid = false;
  bool failOpen = false;
  bool failEnd = false;
  bool rejectHeartbeat = false;
  String status = 'LIVE';
  Map<String, dynamic> rtc(Map<String, dynamic> c) => {
    'appId': 'test-app',
    'token': 'synthetic-rtc-token',
    'uid': wrongUid ? 999 : c['uid'],
    'channelName': 'live-channel',
    'role': c['role'],
    'expiresAt': 2000000000,
  };
  Map<String, dynamic> connection(Map<String, dynamic> c) => {
    'id': c['id'],
    'generation': c['generation'],
    'role': c['role'],
    'leaseExpiresAt': '2030-01-01T00:00:00Z',
  };
  Map<String, dynamic> session() => {
    'id': 'live',
    'astrologerId': 'astro',
    'channelName': 'live-channel',
    'status': status,
    'connectionProtocol': 2,
    'startedAt': '2026-10-14T00:00:00Z',
    'viewerCount': connections.values
        .where((c) => c['closed'] != true && c['role'] == 'SUBSCRIBER')
        .length,
    'astrologer': {
      'id': 'astro',
      'name': 'Host',
      'isVerified': true,
      'rating': 0,
    },
  };
  Map<String, dynamic> bound(Map<String, dynamic> auth) {
    final c = connections.values.firstWhere(
      (c) => c['id'] == auth['connectionId'],
    );
    if (c['bindId'] != auth['resumeRequestId']) {
      c['generation'] = (c['generation'] as int) + 1;
      c['bindId'] = auth['resumeRequestId'];
    }
    return {
      'liveSessionId': 'live',
      'connectionId': c['id'],
      'generation': c['generation'],
    };
  }

  Future<http.Response> handle(http.Request r) async {
    requests.add(r);
    final path = r.url.path;
    if (rejectHeartbeat && path.endsWith('/heartbeat')) {
      return http.Response('{}', 410);
    }
    if (failEnd && path.endsWith('/end')) return http.Response('{}', 500);
    final body = r.body.isEmpty
        ? <String, dynamic>{}
        : Map<String, dynamic>.from(jsonDecode(r.body) as Map);
    if (path.endsWith('/status')) {
      return http.Response(
        jsonEncode({
          'success': true,
          'data': {
            'sessionId': 'live',
            'status': status,
            'endedAt': status == 'ENDED' ? '2026-10-14T01:00:00Z' : null,
            'hostLeaseValid': status == 'LIVE',
            'viewerCount': session()['viewerCount'],
          },
        }),
        200,
      );
    }
    if (path.endsWith('/start') || path.endsWith('/join')) {
      if (failOpen) {
        failOpen = false;
        throw http.ClientException('synthetic network failure');
      }
      final c = connections.putIfAbsent(
        body['joinRequestId'],
        () => {
          'id': liveRequestId(),
          'generation': 1,
          'uid': 100 + connections.length,
          'role': path.endsWith('/start') ? 'PUBLISHER' : 'SUBSCRIBER',
          'closed': false,
        },
      );
      return http.Response(
        jsonEncode({
          'success': true,
          'data': {
            'session': session(),
            'connection': connection(c),
            'rtc': rtc(c),
          },
        }),
        200,
      );
    }
    final cid = path.split('/connections/').length > 1
        ? path.split('/connections/')[1].split('/').first
        : body['connectionId'];
    final c = connections.values.firstWhere((c) => c['id'] == cid);
    if (status == 'ENDED' && path.endsWith('/resume')) {
      return http.Response('{}', 410);
    }
    if (path.endsWith('/resume')) {
      bound({'connectionId': cid, ...body});
    } else if (body['generation'] != c['generation']) {
      return http.Response('{}', 409);
    }
    if (path.endsWith('/end')) {
      status = 'ENDED';
      c['closed'] = true;
    }
    if (path.endsWith('/leave')) c['closed'] = true;
    return http.Response(
      jsonEncode({
        'success': true,
        'data': {'connection': connection(c), 'rtc': rtc(c)},
      }),
      200,
    );
  }
}

LiveRtcCredentials credentials() => const LiveRtcCredentials(
  appId: 'test-app',
  token: 'synthetic-rtc-token',
  channelName: 'live-channel',
  uid: 100,
  role: 'PUBLISHER',
  expiresAt: 2000000000,
);

class InertEngine extends Fake implements RtcEngine {}

class ManualTimer extends Fake implements Timer {
  ManualTimer(this.callback);
  final void Function(Timer) callback;
  bool active = true;
  @override
  bool get isActive => active;
  @override
  void cancel() {
    active = false;
  }

  void fire() {
    if (active) callback(this);
  }
}

class Media extends Fake implements LiveRtcService {
  final calls = <String>[];
  bool failLeave = false;
  Completer<void>? leaveGate;
  @override
  get engine => created ? inert : null;
  final inert = InertEngine();
  bool created = false;
  @override
  Future<void> ensureHostPermissions() async {
    calls.add('permissions');
  }

  @override
  Future<void> connect({
    required LiveRtcCredentials credentials,
    required LiveRtcRole role,
  }) async {
    calls.add('connect:${role.name}');
    created = true;
  }

  @override
  Future<void> leave() async {
    calls.add('leave');
    await leaveGate?.future;
    if (failLeave) throw StateError('test failure');
  }

  @override
  Future<void> dispose() async {
    calls.add('dispose');
    created = false;
  }

  @override
  Future<void> rejoin(LiveRtcCredentials credentials) async {
    calls.add('rejoin');
  }
}

class QuietSocket extends LiveV2SocketService {
  QuietSocket(super.api, this.server);
  final Server server;
  bool _refreshNext = false;
  bool bound = false;
  @override
  bool get isBound => bound;
  @override
  Future<void> connect(String liveSessionId) async {
    final auth = await api.prepareBind(refresh: _refreshNext);
    _refreshNext = false;
    await api.acknowledge(server.bound(auth));
    bound = true;
    onJoined?.call();
    await onBound?.call();
  }

  @override
  Future<void> reconnect({bool refresh = false}) {
    _refreshNext = refresh;
    return connect(api.sessionId);
  }

  @override
  Future<void> dispose() async {
    bound = false;
  }
}

class Transport extends Fake implements io.Socket {
  Transport(this.options, this.server, {this.acknowledge = true});
  final Map<String, dynamic> options;
  final Server server;
  final bool acknowledge;
  final handlers = <String, dynamic Function(dynamic)>{};
  final sent = <String>[];
  Map<String, dynamic>? capturedAuth;
  @override
  bool connected = true;
  @override
  Function() on(String event, dynamic Function(dynamic) handler) {
    handlers[event] = handler;
    return () => handlers.remove(event);
  }

  @override
  io.Socket connect() {
    final void Function(void Function(Map)) f = options['auth'];
    f((proof) {
      capturedAuth = Map<String, dynamic>.from(proof);
      final event = server.bound(capturedAuth!);
      if (acknowledge) handlers['live:connected']?.call(event);
    });
    return this;
  }

  @override
  void emit(String event, [dynamic data]) {
    sent.add(event);
  }

  @override
  dynamic noSuchMethod(Invocation i) {
    if (i.memberName == #disconnect || i.memberName == #dispose) {
      connected = false;
    }
    if (i.memberName == #disconnect) return this;
    return null;
  }
}

void main() {
  late Sessions sessions;
  late Storage storage;
  late Server server;
  late LiveV2Api api;
  setUp(() {
    sessions = Sessions();
    storage = Storage();
    server = Server();
    api = LiveV2Api(
      client: MockClient(server.handle),
      sessions: sessions,
      storage: storage,
    );
  });
  tearDown(() => api.close());
  Future<void> bind() async {
    final proof = await api.prepareBind();
    await api.acknowledge(server.bound(proof));
  }

  test(
    'failed flow opening retries with the persisted request identity',
    () async {
      final flow = LiveV2Flow(
        host: true,
        rtc: Media(),
        api: api,
        socket: QuietSocket(api, server),
      );
      try {
        server.failOpen = true;
        await expectLater(flow.open(), throwsA(isA<LiveApiException>()));
        server.failOpen = false;
        await flow.open();
        final starts = server.requests
            .where((r) => r.url.path.endsWith('/start'))
            .toList();
        expect(starts.length, 2);
        expect(
          jsonDecode(starts[0].body)['joinRequestId'],
          jsonDecode(starts[1].body)['joinRequestId'],
        );
      } finally {
        flow.dispose();
      }
    },
  );
  test('v2 flag is disabled by default', () => expect(liveV2Enabled, false));
  test(
    'foreground recovery waits for an in-flight background RTC leave',
    () async {
      final media = Media();
      final flow = LiveV2Flow(
        host: false,
        rtc: media,
        api: api,
        socket: QuietSocket(api, server),
      );
      addTearDown(flow.dispose);
      await flow.open(id: 'live');
      media.leaveGate = Completer<void>();
      final paused = flow.lifecycle(AppLifecycleState.paused);
      await Future<void>.delayed(Duration.zero);
      final resumed = flow.lifecycle(AppLifecycleState.resumed);
      expect(media.calls.contains('rejoin'), false);
      media.leaveGate!.complete();
      await Future.wait([paused, resumed]);
      expect(media.calls.where((c) => c == 'rejoin').length, 1);
    },
  );
  test(
    'lost bind acknowledgement can be cleaned up after authoritative server end',
    () async {
      await api.open(host: true);
      await api.prepareBind();
      server.status = 'ENDED';
      await api.finish(host: true);
      expect(storage.values, isEmpty);
      expect(server.requests.last.url.path.endsWith('/status'), true);
    },
  );
  test('host start and end send proof but never client UID or role', () async {
    final result = await api.open(host: true, title: 'Title');
    await bind();
    await api.finish(host: true);
    expect(result.rtc.role, 'PUBLISHER');
    expect(server.status, 'ENDED');
    expect(storage.values, isEmpty);
    for (final request in server.requests) {
      if (request.body.isEmpty) continue;
      final body = jsonDecode(request.body) as Map;
      expect(body.containsKey('uid'), false);
      expect(body.containsKey('role'), false);
    }
  });
  test('renewal uses the connection endpoint and preserves UID', () async {
    final initial = await api.open(host: false, id: 'live');
    await bind();
    final renewed = await api.renew();
    expect(renewed.uid, initial.rtc.uid);
    expect(
      server.requests.where((r) => r.url.path.endsWith('/join')).length,
      1,
    );
    expect(server.requests.last.url.path.endsWith('/renew'), true);
  });
  test('changed RTC identity is rejected', () async {
    await api.open(host: false, id: 'live');
    await bind();
    server.wrongUid = true;
    await expectLater(api.renew(), throwsA(isA<LiveApiException>()));
  });
  test(
    'pending bind survives a lost acknowledgement with the same request ID',
    () async {
      await api.open(host: false, id: 'live');
      final first = await api.prepareBind();
      server.bound(first);
      final retry = await api.prepareBind();
      expect(retry['resumeRequestId'], first['resumeRequestId']);
      expect(retry['generation'], first['generation']);
      await api.acknowledge(server.bound(retry));
      expect(api.generation, 2);
    },
  );
  test(
    'saved opening survives API recreation without creating another connection or storing tokens',
    () async {
      final original = await api.open(host: false, id: 'live');
      await bind();
      final restored = LiveV2Api(
        client: MockClient(server.handle),
        sessions: sessions,
        storage: storage,
      );
      addTearDown(restored.close);
      final result = await restored.open(host: false, id: 'live');
      expect(result.rtc.uid, original.rtc.uid);
      expect(restored.connectionId, api.connectionId);
      expect(server.connections.length, 1);
      expect(
        storage.values.values.single.contains('synthetic-auth-token'),
        false,
      );
      expect(
        storage.values.values.single.contains('synthetic-rtc-token'),
        false,
      );
    },
  );
  test('failed initial send retries the same saved join request', () async {
    server.failOpen = true;
    await expectLater(
      api.open(host: false, id: 'live'),
      throwsA(isA<LiveApiException>()),
    );
    final first = jsonDecode(server.requests.first.body) as Map;
    await api.open(host: false, id: 'live');
    expect(
      (jsonDecode(server.requests.last.body) as Map)['joinRequestId'],
      first['joinRequestId'],
    );
    expect(server.connections.length, 1);
  });
  test('account switching fails before a request reaches backend', () async {
    await api.open(host: false, id: 'live');
    await bind();
    final count = server.requests.length;
    sessions.owner = 'foreign';
    await expectLater(api.renew(), throwsA(isA<LiveApiException>()));
    expect(server.requests.length, count);
  });
  test('two devices leave independently', () async {
    await api.open(host: false, id: 'live');
    await bind();
    final first = api.connectionId;
    final other = LiveV2Api(
      client: MockClient(server.handle),
      sessions: sessions,
      storage: Storage(),
    );
    addTearDown(other.close);
    await other.open(host: false, id: 'live');
    await other.acknowledge(server.bound(await other.prepareBind()));
    await api.finish(host: false);
    expect(other.connectionId, isNot(first));
    expect(
      server.connections.values.where((c) => c['closed'] != true).length,
      1,
    );
  });
  test('flow starts once and safely ends even if RTC leave fails', () async {
    final media = Media()..failLeave = true;
    final chat = QuietSocket(api, server);
    // Keep mock server generation aligned with the quiet socket acknowledgement.
    final flow = LiveV2Flow(host: true, rtc: media, api: api, socket: chat);
    addTearDown(flow.dispose);
    await flow.open();
    for (final c in server.connections.values) {
      c['generation'] = api.generation;
    }
    await flow.open();
    expect(media.calls.where((c) => c.startsWith('connect')).length, 1);
    await flow.finish();
    expect(server.status, 'ENDED');
    expect(media.calls, containsAll(['leave', 'dispose']));
  });
  test('heartbeat uses authoritative status and stops while paused', () async {
    final media = Media();
    late ManualTimer timer;
    late Duration interval;
    final flow = LiveV2Flow(
      host: false,
      rtc: media,
      api: api,
      socket: QuietSocket(api, server),
      timerFactory: (duration, callback) {
        interval = duration;
        return timer = ManualTimer(callback);
      },
    );
    addTearDown(flow.dispose);
    await flow.open(id: 'live');
    for (final c in server.connections.values) {
      c['generation'] = api.generation;
    }
    expect(interval, const Duration(seconds: 15));
    timer.fire();
    await Future<void>.delayed(const Duration(milliseconds: 10));
    expect(
      server.requests.where((r) => r.url.path.endsWith('/heartbeat')).length,
      1,
    );
    expect(flow.session!.viewerCount, 1);
    await flow.lifecycle(AppLifecycleState.paused);
    expect(timer.isActive, false);
    timer.fire();
    await flow.tick();
    expect(
      server.requests.where((r) => r.url.path.endsWith('/heartbeat')).length,
      1,
    );
    expect(media.calls, contains('leave'));
  });
  test(
    'foreground recovery reuses the same engine and checks status before reconnect',
    () async {
      final media = Media();
      final flow = LiveV2Flow(
        host: false,
        rtc: media,
        api: api,
        socket: QuietSocket(api, server),
      );
      addTearDown(flow.dispose);
      await flow.open(id: 'live');
      await flow.lifecycle(AppLifecycleState.paused);
      await flow.lifecycle(AppLifecycleState.resumed);
      expect(media.calls.where((c) => c.startsWith('connect')).length, 1);
      expect(media.calls, contains('rejoin'));
      expect(api.generation, 3);
      expect(server.requests.any((r) => r.url.path.endsWith('/status')), true);
    },
  );
  test(
    'failed backend end still stops RTC without claiming the server ended',
    () async {
      final media = Media();
      final flow = LiveV2Flow(
        host: true,
        rtc: media,
        api: api,
        socket: QuietSocket(api, server),
      );
      addTearDown(flow.dispose);
      await flow.open();
      server.failEnd = true;
      await expectLater(flow.finish(), throwsA(isA<LiveApiException>()));
      expect(media.calls, contains('leave'));
      expect(flow.ended, false);
      expect(server.status, 'LIVE');
    },
  );
  test('missed ended event is recovered through the status endpoint', () async {
    final media = Media();
    final flow = LiveV2Flow(
      host: false,
      rtc: media,
      api: api,
      socket: QuietSocket(api, server),
    );
    addTearDown(flow.dispose);
    await flow.open(id: 'live');
    server.status = 'ENDED';
    await flow.refreshStatus();
    expect(flow.ended, true);
    expect(flow.session!.viewerCount, 0);
    expect(media.calls, contains('leave'));
  });
  test(
    'heartbeat rejection still fetches authoritative ended status',
    () async {
      final media = Media();
      final flow = LiveV2Flow(
        host: false,
        rtc: media,
        api: api,
        socket: QuietSocket(api, server),
      );
      addTearDown(flow.dispose);
      await flow.open(id: 'live');
      server.status = 'ENDED';
      server.rejectHeartbeat = true;
      await flow.tick();
      expect(flow.ended, true);
      expect(media.calls, contains('leave'));
    },
  );
  test(
    'authoritative ended state leaves RTC and clears secure opening',
    () async {
      final media = Media();
      final flow = LiveV2Flow(
        host: false,
        rtc: media,
        api: api,
        socket: QuietSocket(api, server),
      );
      addTearDown(flow.dispose);
      await flow.open(id: 'live');
      await flow.authoritativeEnd({
        'sessionId': 'live',
        'status': 'ENDED',
        'endedAt': '2026-10-14T01:00:00Z',
      });
      expect(flow.ended, true);
      expect(flow.session!.status, 'ENDED');
      expect(storage.values, isEmpty);
      expect(media.calls, contains('leave'));
    },
  );
  test(
    'socket binds securely and auth-required refreshes before reconnect',
    () async {
      await api.open(host: false, id: 'live');
      final transports = <Transport>[];
      final chat = LiveV2SocketService(
        api,
        socketFactory: (_, options) {
          final s = Transport(options, server);
          transports.add(s);
          return s;
        },
      );
      addTearDown(chat.dispose);
      await chat.connect('live');
      expect(api.generation, 2);
      expect(chat.isBound, true);
      transports.first.handlers['live:auth-required']!(null);
      await Future<void>.delayed(Duration.zero);
      await Future<void>.delayed(Duration.zero);
      expect(sessions.refreshed, 1);
      expect(transports.length, 2);
      expect(api.generation, 3);
      chat.sendMessage('question');
      expect(transports.last.sent, ['live:message']);
    },
  );
  test('lost socket acknowledgement retries the same pending bind', () async {
    await api.open(host: false, id: 'live');
    final transports = <Transport>[];
    final chat = LiveV2SocketService(
      api,
      ackTimeout: const Duration(milliseconds: 20),
      socketFactory: (_, options) {
        final s = Transport(
          options,
          server,
          acknowledge: transports.isNotEmpty,
        );
        transports.add(s);
        return s;
      },
    );
    addTearDown(chat.dispose);
    final first = chat.connect('live');
    final failed = expectLater(first, throwsA(isA<TimeoutException>()));
    await Future<void>.delayed(Duration.zero);

    await failed;
    await chat.connect('live');
    expect(api.generation, 2);
    expect(
      transports[1].capturedAuth!['resumeRequestId'],
      transports[0].capturedAuth!['resumeRequestId'],
    );
  });
}
