import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';
import '../../auth/data/auth_session_store.dart';
import 'live_models.dart';

class LiveApiException implements Exception {
  const LiveApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

class LiveApi {
  LiveApi({http.Client? client, AuthSessionStore? sessionStore})
    : _client = client ?? http.Client(),
      _sessionStore = sessionStore ?? AuthSessionStore();

  final http.Client _client;
  final AuthSessionStore _sessionStore;

  Uri _uri(String path) {
    return Uri.parse('${ApiConfig.baseUrl}$path');
  }

  Future<Map<String, String>> _headers({bool authenticated = false}) async {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (authenticated) {
      final session = await _sessionStore.read();
      final token = session?.accessToken.trim() ?? '';

      if (token.isEmpty) {
        throw const LiveApiException(
          'Please sign in before joining a live session.',
          statusCode: 401,
        );
      }

      headers['Authorization'] = 'Bearer $token';
    }

    return headers;
  }

  Map<String, dynamic> _decodeBody(http.Response response) {
    if (response.body.trim().isEmpty) {
      return const <String, dynamic>{};
    }

    final decoded = jsonDecode(response.body);

    if (decoded is Map) {
      return Map<String, dynamic>.from(decoded);
    }

    throw const LiveApiException('Invalid live-session response from server.');
  }

  Never _throwApiError(http.Response response, Map<String, dynamic> body) {
    final message =
        body['message']?.toString().trim() ?? 'Live-session request failed.';

    throw LiveApiException(
      message.isEmpty ? 'Live-session request failed.' : message,
      statusCode: response.statusCode,
    );
  }

  Future<List<LiveSession>> getLiveSessions() async {
    final response = await _client.get(
      _uri('/live'),
      headers: await _headers(),
    );

    final body = _decodeBody(response);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      _throwApiError(response, body);
    }

    final raw = body['data'];

    if (raw is! List) {
      return const <LiveSession>[];
    }

    return raw
        .whereType<Map>()
        .map((item) => LiveSession.fromJson(Map<String, dynamic>.from(item)))
        .where((session) => session.isLive)
        .toList(growable: false);
  }

  Future<LiveJoinResult> startLive({String? title}) async {
    final response = await _client.post(
      _uri('/live/start'),
      headers: await _headers(authenticated: true),
      body: jsonEncode({
        if (title != null && title.trim().isNotEmpty) 'title': title.trim(),
      }),
    );

    return _parseJoinResult(response);
  }

  Future<LiveJoinResult> joinLive(String liveSessionId) async {
    final normalized = liveSessionId.trim();

    if (normalized.isEmpty) {
      throw const LiveApiException('Live session ID is required.');
    }

    final response = await _client.post(
      _uri('/live/${Uri.encodeComponent(normalized)}/join'),
      headers: await _headers(authenticated: true),
    );

    return _parseJoinResult(response);
  }

  Future<int> leaveLive(String liveSessionId) async {
    final normalized = liveSessionId.trim();

    if (normalized.isEmpty) {
      return 0;
    }

    final response = await _client.post(
      _uri('/live/${Uri.encodeComponent(normalized)}/leave'),
      headers: await _headers(authenticated: true),
    );

    final body = _decodeBody(response);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      _throwApiError(response, body);
    }

    final data = body['data'];

    if (data is! Map) {
      return 0;
    }

    final viewerCount = data['viewerCount'];

    if (viewerCount is num) {
      return viewerCount.toInt();
    }

    return int.tryParse(viewerCount?.toString() ?? '') ?? 0;
  }

  Future<void> endLive(String liveSessionId) async {
    final normalized = liveSessionId.trim();

    if (normalized.isEmpty) {
      throw const LiveApiException('Live session ID is required.');
    }

    final response = await _client.post(
      _uri('/live/${Uri.encodeComponent(normalized)}/end'),
      headers: await _headers(authenticated: true),
    );

    final body = _decodeBody(response);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      _throwApiError(response, body);
    }
  }

  LiveJoinResult _parseJoinResult(http.Response response) {
    final body = _decodeBody(response);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      _throwApiError(response, body);
    }

    final data = body['data'];

    if (data is! Map) {
      throw const LiveApiException('Live-session response is incomplete.');
    }

    final normalizedData = Map<String, dynamic>.from(data);

    final sessionJson = normalizedData['session'];
    final rtcJson = normalizedData['rtc'];

    if (sessionJson is! Map || rtcJson is! Map) {
      throw const LiveApiException('Live RTC credentials are missing.');
    }

    return LiveJoinResult(
      session: LiveSession.fromJson(Map<String, dynamic>.from(sessionJson)),
      rtc: LiveRtcCredentials.fromJson(Map<String, dynamic>.from(rtcJson)),
    );
  }

  void close() {
    _client.close();
  }
}
