import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';

class AiReceptionistMessage {
  const AiReceptionistMessage({
    required this.id,
    required this.sessionId,
    required this.role,
    required this.content,
    required this.createdAt,
  });

  final String id;
  final String sessionId;
  final String role;
  final String content;
  final DateTime createdAt;

  factory AiReceptionistMessage.fromJson(Map<String, dynamic> json) {
    return AiReceptionistMessage(
      id: json['id']?.toString() ?? '',
      sessionId: json['sessionId']?.toString() ?? '',
      role: json['role']?.toString() ?? '',
      content: json['content']?.toString() ?? '',
      createdAt:
          DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
          DateTime.now(),
    );
  }
}

class AiReceptionistSession {
  const AiReceptionistSession({
    required this.id,
    required this.provider,
    required this.channel,
    required this.status,
    required this.language,
    required this.createdAt,
    this.customerPhone,
    this.startedAt,
    this.endedAt,
  });

  final String id;
  final String provider;
  final String channel;
  final String status;
  final String language;
  final String? customerPhone;
  final DateTime? startedAt;
  final DateTime? endedAt;
  final DateTime createdAt;

  bool get isActive => status == 'ACTIVE';

  factory AiReceptionistSession.fromJson(Map<String, dynamic> json) {
    return AiReceptionistSession(
      id: json['id']?.toString() ?? '',
      provider: json['provider']?.toString() ?? '',
      channel: json['channel']?.toString() ?? '',
      status: json['status']?.toString() ?? '',
      language: json['language']?.toString() ?? 'AUTO',
      customerPhone: json['customerPhone']?.toString(),
      startedAt: DateTime.tryParse(json['startedAt']?.toString() ?? ''),
      endedAt: DateTime.tryParse(json['endedAt']?.toString() ?? ''),
      createdAt:
          DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
          DateTime.now(),
    );
  }
}

class AiReceptionistSystemStatus {
  const AiReceptionistSystemStatus({
    required this.enabled,
    required this.phase,
    required this.productionProviderConfigured,
  });

  final bool enabled;
  final String phase;
  final bool productionProviderConfigured;

  factory AiReceptionistSystemStatus.fromJson(Map<String, dynamic> json) {
    return AiReceptionistSystemStatus(
      enabled: json['enabled'] == true,
      phase: json['phase']?.toString() ?? '',
      productionProviderConfigured:
          json['productionProviderConfigured'] == true,
    );
  }
}

class AiReceptionistProviderHealth {
  const AiReceptionistProviderHealth({
    required this.available,
    required this.provider,
    required this.mode,
  });

  final bool available;
  final String provider;
  final String mode;

  factory AiReceptionistProviderHealth.fromJson(Map<String, dynamic> json) {
    return AiReceptionistProviderHealth(
      available: json['available'] == true,
      provider: json['provider']?.toString() ?? '',
      mode: json['mode']?.toString() ?? '',
    );
  }
}

class AiReceptionistApi {
  const AiReceptionistApi();

  Uri _uri(String path) {
    return Uri.parse('${ApiConfig.baseUrl}$path');
  }

  Future<Map<String, dynamic>> _decode(http.Response response) async {
    final dynamic body = response.body.isEmpty
        ? <String, dynamic>{}
        : jsonDecode(response.body);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      var message = 'Request failed (${response.statusCode})';

      if (body is Map<String, dynamic>) {
        final dynamic apiMessage = body['message'];

        if (apiMessage is String && apiMessage.trim().isNotEmpty) {
          message = apiMessage;
        }

        if (apiMessage is List) {
          message = apiMessage.join(', ');
        }
      }

      throw Exception(message);
    }

    if (body is Map<String, dynamic>) {
      return body;
    }

    throw Exception('Invalid server response');
  }

  Future<AiReceptionistSystemStatus> getStatus() async {
    final response = await http
        .get(_uri('/ai-receptionist/status'))
        .timeout(ApiConfig.requestTimeout);

    return AiReceptionistSystemStatus.fromJson(await _decode(response));
  }

  Future<AiReceptionistProviderHealth> getProviderHealth() async {
    final response = await http
        .get(_uri('/ai-receptionist/provider-health'))
        .timeout(ApiConfig.requestTimeout);

    return AiReceptionistProviderHealth.fromJson(await _decode(response));
  }

  Future<AiReceptionistSession> createSession({
    required String language,
    String? customerPhone,
  }) async {
    final data = <String, dynamic>{'language': language};

    final normalizedPhone = customerPhone?.trim();

    if (normalizedPhone != null && normalizedPhone.isNotEmpty) {
      data['customerPhone'] = normalizedPhone;
    }

    final response = await http
        .post(
          _uri('/ai-receptionist/sessions'),
          headers: const {'Content-Type': 'application/json'},
          body: jsonEncode(data),
        )
        .timeout(ApiConfig.requestTimeout);

    return AiReceptionistSession.fromJson(await _decode(response));
  }

  Future<AiReceptionistMessage> sendMessage({
    required String sessionId,
    required String message,
  }) async {
    final response = await http
        .post(
          _uri('/ai-receptionist/sessions/$sessionId/messages'),
          headers: const {'Content-Type': 'application/json'},
          body: jsonEncode({'message': message.trim()}),
        )
        .timeout(ApiConfig.requestTimeout);

    return AiReceptionistMessage.fromJson(await _decode(response));
  }

  Future<List<AiReceptionistMessage>> getTranscript(String sessionId) async {
    final response = await http
        .get(_uri('/ai-receptionist/sessions/$sessionId/transcript'))
        .timeout(ApiConfig.requestTimeout);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      await _decode(response);
    }

    final dynamic body = jsonDecode(response.body);

    if (body is! List) {
      throw Exception('Invalid transcript response');
    }

    return body
        .whereType<Map<String, dynamic>>()
        .map(AiReceptionistMessage.fromJson)
        .toList();
  }

  Future<AiReceptionistSession> endSession(String sessionId) async {
    final response = await http
        .post(
          _uri('/ai-receptionist/sessions/$sessionId/end'),
          headers: const {'Content-Type': 'application/json'},
        )
        .timeout(ApiConfig.requestTimeout);

    return AiReceptionistSession.fromJson(await _decode(response));
  }
}
