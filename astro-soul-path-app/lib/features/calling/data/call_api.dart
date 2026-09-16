import 'package:flutter/foundation.dart';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';
import '../../auth/data/auth_session_store.dart';
import 'call_models.dart';

class CallApiException implements Exception {
  const CallApiException(this.message, {this.code, this.statusCode});

  final String message;
  final String? code;
  final int? statusCode;

  @override
  String toString() => message;
}

class CallApi {
  CallApi({http.Client? client, AuthSessionStore? sessionStore})
    : _client = client ?? http.Client(),
      _sessionStore = sessionStore ?? AuthSessionStore();

  final http.Client _client;
  final AuthSessionStore _sessionStore;

  Future<CallRtcCredentials> generateRtcToken(String callId) async {
    final normalizedCallId = _normalizeCallId(callId);

    final body = await _request(
      method: 'POST',
      path: '/call/token',
      payload: {'callId': normalizedCallId},
    );

    try {
      return CallRtcCredentials.fromResponse(body);
    } on FormatException catch (error) {
      throw CallApiException(error.message, code: 'INVALID_RTC_RESPONSE');
    }
  }

  Future<CurrentCallSession?> getCurrentCall() async {
    final body = await _request(method: 'GET', path: '/call/current');

    final dynamic rawData = body['data'];

    if (rawData == null) {
      debugPrint('AUDIO_CURRENT_CALL_API data=null');
      return null;
    }

    if (rawData is! Map) {
      debugPrint(
        'AUDIO_CURRENT_CALL_API invalid_data_type=${rawData.runtimeType}',
      );
      return null;
    }

    final data = Map<String, dynamic>.from(rawData);

    // Backend GET /call/current returns:
    // {
    //   success: true,
    //   data: {
    //     call: { ...CallSession }
    //   }
    // }
    //
    // Older responses may expose the CallSession directly under data,
    // so support both shapes without affecting other call endpoints.
    final dynamic rawCall = data['call'] ?? data;

    if (rawCall is! Map) {
      debugPrint(
        'AUDIO_CURRENT_CALL_API call_not_ready '
        'keys=${data.keys.join(",")}',
      );
      return null;
    }

    final callMap = Map<String, dynamic>.from(rawCall);

    final id = callMap['id']?.toString().trim() ?? '';

    if (id.isEmpty) {
      debugPrint(
        'AUDIO_CURRENT_CALL_API missing_call_id '
        'keys=${callMap.keys.join(",")}',
      );
      return null;
    }

    final session = CurrentCallSession.fromJson(callMap);

    debugPrint(
      'AUDIO_CURRENT_CALL_API_OK '
      'id=${session.id} '
      'status=${session.status} '
      'remaining=${session.remainingSeconds} '
      'expiresAt=${session.expiresAt}',
    );

    return session;
  }

  Future<CurrentCallSession?> extendCall(
    String callId, {
    required int minutes,
  }) async {
    final normalizedCallId = _normalizeCallId(callId);

    if (minutes != 5 && minutes != 10) {
      throw const CallApiException(
        'Call can only be extended by 5 or 10 minutes.',
        code: 'INVALID_EXTENSION_MINUTES',
      );
    }

    final body = await _request(
      method: 'POST',
      path: '/call/${Uri.encodeComponent(normalizedCallId)}/extend',
      payload: {'minutes': minutes},
    );

    final data = body['data'];

    if (data == null) {
      return null;
    }

    if (data is Map) {
      final normalizedData = Map<String, dynamic>.from(data);

      final nestedCall = normalizedData['call'];

      if (nestedCall is Map) {
        return CurrentCallSession.fromJson(
          Map<String, dynamic>.from(nestedCall),
        );
      }

      if (normalizedData['id'] != null) {
        return CurrentCallSession.fromJson(normalizedData);
      }
    }

    return null;
  }

  Future<CurrentCallSession?> endCall(String callId, {String? reason}) async {
    final normalizedCallId = _normalizeCallId(callId);
    final normalizedReason = reason?.trim() ?? '';

    final body = await _request(
      method: 'POST',
      path: '/call/${Uri.encodeComponent(normalizedCallId)}/end',
      payload: {if (normalizedReason.isNotEmpty) 'reason': normalizedReason},
    );

    final data = body['data'];

    if (data == null) {
      return null;
    }

    if (data is Map) {
      final normalizedData = Map<String, dynamic>.from(data);

      final nestedCall = normalizedData['call'];

      if (nestedCall is Map) {
        return CurrentCallSession.fromJson(
          Map<String, dynamic>.from(nestedCall),
        );
      }

      if (normalizedData['id'] != null) {
        return CurrentCallSession.fromJson(normalizedData);
      }
    }

    return null;
  }

  Future<Map<String, dynamic>> _request({
    required String method,
    required String path,
    Map<String, dynamic>? payload,
  }) async {
    final session = await _sessionStore.read();
    final accessToken = session?.accessToken.trim() ?? '';

    if (accessToken.isEmpty) {
      throw const CallApiException(
        'Please login to use audio calling.',
        code: 'LOGIN_REQUIRED',
        statusCode: 401,
      );
    }

    try {
      final request = http.Request(
        method,
        Uri.parse('${ApiConfig.baseUrl}$path'),
      );

      request.headers.addAll({
        'Accept': 'application/json',
        'Authorization': 'Bearer $accessToken',
      });

      if (payload != null) {
        request.headers['Content-Type'] = 'application/json';
        request.body = jsonEncode(payload);
      }

      final streamedResponse = await _client
          .send(request)
          .timeout(ApiConfig.requestTimeout);

      final response = await http.Response.fromStream(streamedResponse);
      final body = _decodeBody(response.body);

      if (response.statusCode >= 200 &&
          response.statusCode < 300 &&
          body['success'] == true) {
        return body;
      }

      final message = _readMessage(
        body,
        fallback: 'Audio call request failed.',
      );

      throw CallApiException(
        response.statusCode == 401
            ? 'Your session has expired. Please login again.'
            : message,
        code: _errorCode(response.statusCode),
        statusCode: response.statusCode,
      );
    } on CallApiException {
      rethrow;
    } catch (_) {
      throw const CallApiException(
        'Unable to connect to the calling service. Please try again.',
        code: 'CONNECTION_ERROR',
      );
    }
  }

  String _normalizeCallId(String callId) {
    final normalized = callId.trim();

    if (normalized.isEmpty) {
      throw const CallApiException(
        'Consultation ID is required for audio calling.',
        code: 'INVALID_CALL_ID',
      );
    }

    return normalized;
  }

  String _errorCode(int statusCode) {
    return switch (statusCode) {
      401 => 'LOGIN_REQUIRED',
      403 => 'CALL_FORBIDDEN',
      404 => 'CALL_NOT_FOUND',
      409 => 'CALL_CONFLICT',
      _ => 'CALL_ERROR',
    };
  }

  Map<String, dynamic> _decodeBody(String source) {
    if (source.trim().isEmpty) {
      return <String, dynamic>{};
    }

    try {
      final decoded = jsonDecode(source);

      if (decoded is Map<String, dynamic>) {
        return decoded;
      }

      if (decoded is Map) {
        return Map<String, dynamic>.from(decoded);
      }
    } catch (_) {
      // The caller returns a consistent user-facing error.
    }

    return <String, dynamic>{};
  }

  String _readMessage(Map<String, dynamic> body, {required String fallback}) {
    final message = body['message'];

    if (message is String && message.trim().isNotEmpty) {
      return message.trim();
    }

    if (message is List && message.isNotEmpty) {
      return message.map((item) => item.toString()).join('\n');
    }

    return fallback;
  }

  void close() {
    _client.close();
  }
}
