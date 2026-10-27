import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';
import '../../auth/data/auth_session_store.dart';
import 'live_api.dart';
import 'live_models.dart';

// Disabled in all existing builds unless deliberately enabled in a new build.
const liveV2Enabled = bool.fromEnvironment(
  'LIVE_V2_ENABLED',
  defaultValue: false,
);

String liveRequestId() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}

class LiveV2Api {
  LiveV2Api({
    http.Client? client,
    AuthSessionStore? sessions,
    FlutterSecureStorage? storage,
  }) : _client = client ?? http.Client(),
       _sessions = sessions ?? AuthSessionStore(),
       _storage = storage ?? const FlutterSecureStorage();
  final http.Client _client;
  final AuthSessionStore _sessions;
  final FlutterSecureStorage _storage;
  Future<void> _queue = Future.value();
  Map<String, dynamic>? _record;
  String? _owner;
  String? _provider;
  String? _key;
  bool _closed = false;
  LiveRtcCredentials? _originalRtc;

  String get sessionId => _record?['sessionId'] as String? ?? '';
  String get connectionId => _record?['connectionId'] as String? ?? '';
  int get generation => _record?['generation'] as int? ?? 0;
  bool get bindingPending => _record?['bind'] != null;
  bool get hasConnection => connectionId.isNotEmpty;

  Future<T> _serial<T>(Future<T> Function() action) {
    final result = _queue
        .then((_) {
          if (_closed) throw StateError('Live connection closed.');
          return action();
        })
        .catchError((Object error) {
          if (error is LiveApiException) throw error;
          throw const LiveApiException(
            'Unable to verify the Live connection. Please reconnect.',
          );
        });
    _queue = result.then<void>((_) {}, onError: (Object _, StackTrace _) {});
    return result;
  }

  Future<String> _token({bool refresh = false}) async {
    final session = refresh
        ? await _sessions.forceRefresh()
        : await _sessions.read();
    final id = session?.user['id']?.toString().trim() ?? '';
    if (id.isEmpty ||
        session!.accessToken.trim().isEmpty ||
        (_owner != null &&
            (_owner != id || _provider != session.authProvider))) {
      throw const LiveApiException(
        'Sign in again before using Live.',
        statusCode: 401,
      );
    }
    _owner ??= id;
    _provider ??= session.authProvider;
    return session.accessToken.trim();
  }

  Future<Map<String, dynamic>> _request(
    String path, {
    Map<String, dynamic>? body,
    bool get = false,
  }) async {
    Future<http.Response> send(String token) {
      final headers = {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
      final uri = Uri.parse('${ApiConfig.baseUrl}/live/v2$path');
      return (get
              ? _client.get(uri, headers: headers)
              : _client.post(
                  uri,
                  headers: headers,
                  body: jsonEncode(body ?? {}),
                ))
          .timeout(ApiConfig.requestTimeout);
    }

    var response = await send(await _token());
    if (response.statusCode == 401) {
      response = await send(await _token(refresh: true));
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      // Do not interpolate raw server bodies, request proofs or tokens.
      throw LiveApiException(
        response.statusCode == 410
            ? 'This Live connection has ended or expired.'
            : 'Live request failed. Please reconnect.',
        statusCode: response.statusCode,
      );
    }
    final decoded = jsonDecode(response.body);
    if (decoded is! Map ||
        decoded['success'] != true ||
        decoded['data'] is! Map) {
      throw StateError('Invalid Live response.');
    }
    return Map<String, dynamic>.from(decoded['data'] as Map);
  }

  Future<Map<String, dynamic>> discoveryPage({
    int offset = 0,
    int limit = 20,
  }) => _serial(() async {
    if (offset < 0 || offset > 10000 || limit < 1 || limit > 50) {
      throw ArgumentError('Invalid Live pagination');
    }
    return _request('?offset=$offset&limit=$limit', get: true);
  });

  Future<void> _save() async {
    if (_closed) throw StateError('Live connection closed.');
    await _storage.write(key: _key!, value: jsonEncode(_record));
  }

  Future<LiveJoinResult> open({
    required bool host,
    String? id,
    String? title,
  }) => _serial(() async {
    await _token();
    final key =
        'asp_live_v2_${Uri.encodeComponent(_owner!)}_${host ? 'host' : 'viewer_${id ?? ''}'}';
    if (_key != null && _key != key) {
      throw StateError('Live opening already selected.');
    }
    _key = key;
    final saved = await _storage.read(key: key);
    if (_record == null) {
      if (saved != null) {
        final parsed = jsonDecode(saved);
        if (parsed is! Map ||
            parsed['owner'] != _owner ||
            parsed['provider'] != _provider ||
            parsed['host'] != host) {
          throw StateError('Invalid saved Live connection.');
        }
        _record = Map<String, dynamic>.from(parsed);
      } else {
        final random = Random.secure();
        _record = {
          'owner': _owner,
          'provider': _provider,
          'host': host,
          'joinRequestId': liveRequestId(),
          'resumeSecret': base64UrlEncode(
            List<int>.generate(32, (_) => random.nextInt(256)),
          ).replaceAll('=', ''),
          if (host) 'title': title?.trim() ?? '',
        };
        await _save(); // Persist before sending: lost responses retry the same opening.
      }
    }
    late Map<String, dynamic> data;
    try {
      data = await _request(
        host ? '/start' : '/${Uri.encodeComponent(id!)}/join',
        body: {
          'joinRequestId': _record!['joinRequestId'],
          'resumeSecret': _record!['resumeSecret'],
          if (host && (_record!['title'] as String).isNotEmpty)
            'title': _record!['title'],
        },
      );
    } on LiveApiException catch (error) {
      if (error.statusCode == 410) await _storage.delete(key: key);
      rethrow;
    }
    if (data['session'] is! Map ||
        data['session']['viewerCount'] is! int ||
        data['session']['viewerCount'] < 0) {
      throw StateError('Invalid Live viewer count.');
    }
    final session = LiveSession.fromJson(
      Map<String, dynamic>.from(data['session'] as Map),
    );
    if (session.connectionProtocol != 2 ||
        !session.isLive ||
        session.id.isEmpty ||
        (!host && session.id != id)) {
      throw StateError('Live protocol mismatch.');
    }
    final rtc = LiveRtcCredentials.fromJson(
      Map<String, dynamic>.from(data['rtc'] as Map),
    );
    if (rtc.role != (host ? 'PUBLISHER' : 'SUBSCRIBER') ||
        rtc.channelName != session.channelName) {
      throw StateError('Live identity mismatch.');
    }
    _checkRtc(rtc);
    final connection = Map<String, dynamic>.from(data['connection'] as Map);
    if (connection['id'] is! String ||
        (connection['id'] as String).isEmpty ||
        connection['generation'] is! int ||
        connection['generation'] < 1 ||
        connection['role'] != rtc.role) {
      throw StateError('Invalid Live connection.');
    }
    if (hasConnection &&
        (connectionId != connection['id'] || sessionId != session.id)) {
      throw StateError('Live connection changed.');
    }
    _record!.addAll({
      'sessionId': session.id,
      'connectionId': connection['id'],
      'generation': connection['generation'],
    });
    // A join/start retry returns the current generation, but may not acknowledge
    // a previously pending socket bind. Preserve its idempotency request.
    await _save();
    return LiveJoinResult(session: session, rtc: rtc);
  });
  void _checkRtc(LiveRtcCredentials rtc) {
    if (rtc.uid <= 0 ||
        rtc.uid > 2000000000 ||
        rtc.appId.isEmpty ||
        rtc.token.isEmpty ||
        rtc.expiresAt <= 0) {
      throw StateError('Invalid Live RTC response.');
    }
    final old = _originalRtc;
    final saved = _record?['rtcIdentity'];
    if (saved is Map &&
        (saved['uid'] != rtc.uid ||
            saved['role'] != rtc.role ||
            saved['channelName'] != rtc.channelName ||
            saved['appId'] != rtc.appId)) {
      throw StateError('Saved Live RTC identity changed.');
    }
    if (old != null &&
        (rtc.uid != old.uid ||
            rtc.role != old.role ||
            rtc.channelName != old.channelName ||
            rtc.appId != old.appId)) {
      throw StateError('Live RTC identity changed.');
    }
    _originalRtc ??= rtc;
    _record?['rtcIdentity'] = {
      'uid': rtc.uid,
      'role': rtc.role,
      'channelName': rtc.channelName,
      'appId': rtc.appId,
    };
  }

  Map<String, dynamic> _proof() {
    if (!hasConnection || generation < 1 || bindingPending) {
      throw StateError('Wait for Live socket binding.');
    }
    return {'resumeSecret': _record!['resumeSecret'], 'generation': generation};
  }

  String get _connectionPath =>
      '/${Uri.encodeComponent(sessionId)}/connections/${Uri.encodeComponent(connectionId)}';
  Future<LiveRtcCredentials> renew() => _serial(() async {
    final data = await _request('$_connectionPath/renew', body: _proof());
    if (data['connection'] is! Map ||
        data['connection']['id'] != connectionId ||
        data['connection']['generation'] != generation) {
      throw StateError('Live generation changed.');
    }
    final rtc = LiveRtcCredentials.fromJson(
      Map<String, dynamic>.from(data['rtc'] as Map),
    );
    _checkRtc(rtc);
    return rtc;
  });
  Future<void> heartbeat() => _serial(() async {
    final data = await _request('$_connectionPath/heartbeat', body: _proof());
    if (data['connection'] is! Map ||
        data['connection']['id'] != connectionId ||
        data['connection']['generation'] != generation) {
      throw StateError('Live generation changed.');
    }
  });
  Future<Map<String, dynamic>> status() => _serial(
    () => _request('/${Uri.encodeComponent(sessionId)}/status', get: true),
  );
  Future<Map<String, dynamic>> prepareBind({bool refresh = false}) => _serial(
    () async {
      final token = await _token(refresh: refresh);
      if (!hasConnection) throw StateError('Open Live before connecting chat.');
      _record!['bind'] ??= {
        'generation': generation,
        'resumeRequestId': liveRequestId(),
      };
      await _save();
      return {
        'token': token,
        'liveSessionId': sessionId,
        'connectionId': connectionId,
        'resumeSecret': _record!['resumeSecret'],
        ...Map<String, dynamic>.from(_record!['bind'] as Map),
      };
    },
  );
  Future<void> acknowledge(Map<String, dynamic> data) => _serial(() async {
    if (data['liveSessionId'] != sessionId ||
        (data['connectionId'] != null &&
            data['connectionId'] != connectionId)) {
      throw StateError('Live acknowledgement mismatch.');
    }
    final pending = _record!['bind'];
    if (pending == null) {
      if (data['generation'] != generation) {
        throw StateError('Stale Live acknowledgement.');
      }
      return;
    }
    if (data['generation'] is! int ||
        data['generation'] != pending['generation'] + 1) {
      throw StateError('Invalid Live generation acknowledgement.');
    }
    _record!['generation'] = data['generation'];
    _record!.remove('bind');
    await _save();
  });
  Future<void> finish({required bool host}) => _serial(() async {
    if (!hasConnection) return;
    try {
      if (bindingPending) {
        final pending = Map<String, dynamic>.from(_record!['bind'] as Map);
        final resumed = await _request(
          '$_connectionPath/resume',
          body: {'resumeSecret': _record!['resumeSecret'], ...pending},
        );
        if (resumed['connection'] is! Map ||
            resumed['connection']['id'] != connectionId ||
            resumed['connection']['generation'] != pending['generation'] + 1) {
          throw StateError('Invalid resume reconciliation.');
        }
        _record!['generation'] = resumed['connection']['generation'];
        _record!.remove('bind');
        await _save();
      }
      final body = _proof();
      await _request(
        host
            ? '/${Uri.encodeComponent(sessionId)}/end'
            : '$_connectionPath/leave',
        body: {...body, if (host) 'connectionId': connectionId},
      );
    } on LiveApiException catch (error) {
      if (error.statusCode != 410) rethrow;
      final state = await _request(
        '/${Uri.encodeComponent(sessionId)}/status',
        get: true,
      );
      if (state['sessionId'] != sessionId ||
          state['status'] != 'ENDED' ||
          DateTime.tryParse('${state['endedAt']}') == null) {
        rethrow;
      }
    }
    await _storage.delete(key: _key!);
  });
  Future<void> forgetEnded() => _serial(() async {
    if (_key != null) await _storage.delete(key: _key!);
  });
  void close() {
    _closed = true;
    _client.close();
  }
}
