import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as stream_http;

import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';
import '../../auth/data/auth_session_store.dart';
import 'ai_astro_models.dart';

class AiAstroAnswer {
  const AiAstroAnswer({
    required this.conversationId,
    required this.answer,
    required this.category,
    required this.provider,
    required this.model,
    required this.birthProfileUsed,
    required this.kundliUsed,
  });

  final String conversationId;
  final String answer;
  final String category;
  final String provider;
  final String model;
  final bool birthProfileUsed;
  final bool kundliUsed;

  factory AiAstroAnswer.fromJson(Map<String, dynamic> json) {
    final groundingSource = json['grounding'];

    final grounding = groundingSource is Map
        ? Map<String, dynamic>.from(groundingSource)
        : <String, dynamic>{};

    return AiAstroAnswer(
      conversationId: (json['conversationId'] ?? '').toString().trim(),
      answer: (json['answer'] ?? '').toString().trim(),
      category: (json['category'] ?? '').toString(),
      provider: (json['provider'] ?? '').toString(),
      model: (json['model'] ?? '').toString(),
      birthProfileUsed: grounding['birthProfileUsed'] == true,
      kundliUsed: grounding['kundliUsed'] == true,
    );
  }
}

class AiAstroOpeningMessage {
  const AiAstroOpeningMessage({
    required this.shouldShow,
    required this.message,
    required this.conversationId,
  });

  final bool shouldShow;
  final String? message;
  final String? conversationId;

  factory AiAstroOpeningMessage.fromJson(Map<String, dynamic> json) {
    final rawMessage = json['message']?.toString().trim() ?? '';
    final rawConversationId = json['conversationId']?.toString().trim() ?? '';

    return AiAstroOpeningMessage(
      shouldShow: json['shouldShow'] == true,
      message: rawMessage.isEmpty ? null : rawMessage,
      conversationId: rawConversationId.isEmpty ? null : rawConversationId,
    );
  }
}

class AiAstroTimedSessionStart {
  const AiAstroTimedSessionStart({
    required this.clientSessionId,
    required this.ratePerMinute,
    required this.reservedAmount,
    required this.currency,
    required this.startedAt,
    required this.durationMinutes,
  });

  final String clientSessionId;
  final double ratePerMinute;
  final double reservedAmount;
  final String currency;
  final DateTime? startedAt;
  final int durationMinutes;

  factory AiAstroTimedSessionStart.fromJson(Map<String, dynamic> json) {
    final session = json['session'] is Map<String, dynamic>
        ? json['session'] as Map<String, dynamic>
        : <String, dynamic>{};

    final billing = json['billing'] is Map<String, dynamic>
        ? json['billing'] as Map<String, dynamic>
        : <String, dynamic>{};

    return AiAstroTimedSessionStart(
      clientSessionId: (session['clientSessionId'] ?? '').toString().trim(),
      ratePerMinute: _aiAstroDouble(
        billing['ratePerMinute'] ?? session['ratePerMinute'],
      ),
      reservedAmount: _aiAstroDouble(
        session['reservedAmount'] ?? billing['initialReservedAmount'],
      ),
      currency: (billing['currency'] ?? session['currency'] ?? 'INR')
          .toString(),
      startedAt: DateTime.tryParse((session['startedAt'] ?? '').toString()),
      durationMinutes: _aiAstroInt(session['durationMinutes']),
    );
  }
}

class AiAstroTimedHeartbeat {
  const AiAstroTimedHeartbeat({
    required this.active,
    required this.canContinue,
    required this.elapsedSeconds,
    required this.fundedSeconds,
    required this.secondsRemaining,
    required this.reservedAmount,
  });

  final bool active;
  final bool canContinue;
  final int elapsedSeconds;
  final int fundedSeconds;
  final int secondsRemaining;
  final double reservedAmount;

  factory AiAstroTimedHeartbeat.fromJson(Map<String, dynamic> json) {
    final session = json['session'] is Map<String, dynamic>
        ? json['session'] as Map<String, dynamic>
        : <String, dynamic>{};

    return AiAstroTimedHeartbeat(
      active: json['active'] == true,
      canContinue: json['canContinue'] == true,
      elapsedSeconds: _aiAstroInt(session['elapsedSeconds']),
      fundedSeconds: _aiAstroInt(session['fundedSeconds']),
      secondsRemaining: _aiAstroInt(session['secondsRemaining']),
      reservedAmount: _aiAstroDouble(session['reservedAmount']),
    );
  }
}

class AiAstroTimedSessionEnd {
  const AiAstroTimedSessionEnd({
    required this.billableSeconds,
    required this.amountCharged,
    required this.amountReleased,
    required this.currency,
    required this.balanceAfter,
  });

  final int billableSeconds;
  final double amountCharged;
  final double amountReleased;
  final String currency;
  final double balanceAfter;

  factory AiAstroTimedSessionEnd.fromJson(Map<String, dynamic> json) {
    final billing = json['billing'] is Map<String, dynamic>
        ? json['billing'] as Map<String, dynamic>
        : <String, dynamic>{};

    final wallet = json['wallet'] is Map<String, dynamic>
        ? json['wallet'] as Map<String, dynamic>
        : <String, dynamic>{};

    final session = json['session'] is Map<String, dynamic>
        ? json['session'] as Map<String, dynamic>
        : <String, dynamic>{};

    return AiAstroTimedSessionEnd(
      billableSeconds: _aiAstroInt(
        billing['billableSeconds'] ?? session['billableSeconds'],
      ),
      amountCharged: _aiAstroDouble(billing['amountCharged']),
      amountReleased: _aiAstroDouble(billing['amountReleased']),
      currency: (billing['currency'] ?? wallet['currency'] ?? 'INR').toString(),
      balanceAfter: _aiAstroDouble(wallet['balanceAfter']),
    );
  }
}

double _aiAstroDouble(dynamic value) {
  if (value is num) {
    return value.toDouble();
  }

  return double.tryParse(value?.toString() ?? '') ?? 0;
}

int _aiAstroInt(dynamic value) {
  if (value is int) {
    return value;
  }

  if (value is num) {
    return value.toInt();
  }

  return int.tryParse(value?.toString() ?? '') ?? 0;
}

class AiAstroApi {
  AiAstroApi({http.Client? client, AuthSessionStore? sessionStore})
    : _client = client ?? http.Client(),
      _sessionStore = sessionStore ?? AuthSessionStore();

  final http.Client _client;
  final AuthSessionStore _sessionStore;

  Future<AiAstroCatalog> getCatalog() async {
    final uri = Uri.parse('${ApiConfig.baseUrl}/ai-astro/catalog');

    final response = await _client
        .get(uri, headers: const {'Accept': 'application/json'})
        .timeout(ApiConfig.requestTimeout);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AiAstroApiException(
        'Unable to load AI astrologers (${response.statusCode}).',
      );
    }

    final decoded = jsonDecode(response.body);

    if (decoded is! Map<String, dynamic>) {
      throw const AiAstroApiException('Invalid AI Astro catalog response.');
    }

    final categories = (decoded['categories'] as List<dynamic>? ?? const [])
        .map((item) => item.toString())
        .toList(growable: false);

    final personasRaw =
        decoded['personas'] as List<dynamic>? ?? const <dynamic>[];

    final personas = personasRaw
        .whereType<Map<String, dynamic>>()
        .map(AiAstroPersona.fromJson)
        .toList(growable: false);

    final consultantTypesRaw =
        decoded['consultantTypes'] as List<dynamic>? ?? const <dynamic>[];

    final consultantTypes = consultantTypesRaw
        .whereType<Map<String, dynamic>>()
        .map(AiConsultantType.fromJson)
        .where(
          (consultantType) =>
              consultantType.code.isNotEmpty && consultantType.name.isNotEmpty,
        )
        .toList(growable: false);

    return AiAstroCatalog(
      categories: categories,
      personas: personas,
      consultantTypes: consultantTypes,
    );
  }

  Future<AiAstroAnswer> askStream({
    required String category,
    required String question,
    required String personaId,
    required String consultantTypeCode,
    required FutureOr<void> Function(String chunk) onChunk,
    String? clientSessionId,
  }) async {
    final session = await _sessionStore.read();
    final accessToken = session?.accessToken.trim() ?? '';

    final clientRequestId = 'ai-${DateTime.now().microsecondsSinceEpoch}';

    if (accessToken.isEmpty) {
      throw const AiAstroApiException(
        'Please login again to use AI Astro.',
        loginRequired: true,
      );
    }

    final request = stream_http.Request(
      'POST',
      Uri.parse('${ApiConfig.baseUrl}/ai-astro/ask/stream'),
    );

    request.headers.addAll({
      'Accept': 'application/x-ndjson',
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $accessToken',
    });

    request.body = jsonEncode({
      'category': category,
      'question': question,
      'personaId': personaId,
      'consultantTypeCode': consultantTypeCode,
      'clientSessionId': clientSessionId?.trim(),
      'clientRequestId': clientRequestId,
    });

    final response = await _client
        .send(request)
        .timeout(ApiConfig.requestTimeout);

    if (response.statusCode == 401) {
      await response.stream.drain<void>();

      throw const AiAstroApiException(
        'Your login session has expired. Please login again.',
        loginRequired: true,
      );
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final responseText = await response.stream.bytesToString();

      String message = 'AI Astro could not answer right now.';

      if (responseText.trim().isNotEmpty) {
        try {
          final decoded = jsonDecode(responseText);

          if (decoded is Map) {
            final rawMessage = decoded['message'];

            if (rawMessage is List) {
              message = rawMessage.join('\n');
            } else if (rawMessage != null &&
                rawMessage.toString().trim().isNotEmpty) {
              message = rawMessage.toString().trim();
            }
          }
        } catch (_) {}
      }

      throw AiAstroApiException(message);
    }

    AiAstroAnswer? finalAnswer;
    String? streamError;
    var receivedDelta = false;

    final lines = response.stream
        .transform(utf8.decoder)
        .transform(const LineSplitter());

    await for (final line in lines) {
      final trimmed = line.trim();

      if (trimmed.isEmpty) {
        continue;
      }

      Map<String, dynamic> event;

      try {
        final decoded = jsonDecode(trimmed);

        if (decoded is! Map) {
          continue;
        }

        event = Map<String, dynamic>.from(decoded);
      } catch (_) {
        continue;
      }

      final type = event['type']?.toString();

      if (type == 'ready') {
        continue;
      }

      if (type == 'delta') {
        final chunk = event['delta']?.toString() ?? '';

        if (chunk.isEmpty) {
          continue;
        }

        receivedDelta = true;
        await onChunk(chunk);
        continue;
      }

      if (type == 'error') {
        streamError =
            event['message']?.toString().trim() ?? 'AI Astro stream failed.';
        continue;
      }

      if (type == 'done') {
        final resultRaw = event['result'];

        if (resultRaw is Map) {
          final result = Map<String, dynamic>.from(resultRaw);

          finalAnswer = AiAstroAnswer.fromJson(result);
        }
      }
    }

    if (streamError != null && streamError.isNotEmpty) {
      throw AiAstroApiException(streamError);
    }

    if (finalAnswer == null) {
      throw AiAstroApiException(
        receivedDelta
            ? 'AI Astro response could not be finalized.'
            : 'AI Astro returned an empty answer.',
      );
    }

    if (finalAnswer.answer.isEmpty) {
      throw const AiAstroApiException('AI Astro returned an empty answer.');
    }

    return finalAnswer;
  }

  Future<AiAstroAnswer> ask({
    required String category,
    required String question,
    required String personaId,
    required String consultantTypeCode,
    String? clientSessionId,
  }) async {
    final session = await _sessionStore.read();
    final accessToken = session?.accessToken.trim() ?? '';

    // Backend-required idempotency key.
    // 8-100 chars, string, unique for each AI question.
    final clientRequestId = 'ai-${DateTime.now().microsecondsSinceEpoch}';

    if (accessToken.isEmpty) {
      throw const AiAstroApiException(
        'Please login again to use AI Astro.',
        loginRequired: true,
      );
    }

    final response = await _client
        .post(
          Uri.parse('${ApiConfig.baseUrl}/ai-astro/ask'),
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $accessToken',
          },
          body: jsonEncode({
            'category': category,
            'question': question,
            'personaId': personaId,
            'consultantTypeCode': consultantTypeCode,
            'clientSessionId': clientSessionId?.trim(),
            'clientRequestId': clientRequestId,
          }),
        )
        .timeout(const Duration(seconds: 60));

    Map<String, dynamic> body = {};

    if (response.body.trim().isNotEmpty) {
      try {
        final decoded = jsonDecode(response.body);

        if (decoded is Map) {
          body = Map<String, dynamic>.from(decoded);
        }
      } catch (_) {}
    }

    if (response.statusCode == 401) {
      throw const AiAstroApiException(
        'Your login session has expired. Please login again.',
        loginRequired: true,
      );
    }

    if (response.statusCode < 200 ||
        response.statusCode >= 300 ||
        body['success'] != true) {
      final messageSource = body['message'];

      String message;

      if (messageSource is List) {
        message = messageSource.join('\n');
      } else {
        message = messageSource?.toString().trim() ?? '';
      }

      if (message.isEmpty) {
        message = 'AI Astro could not answer right now.';
      }

      throw AiAstroApiException(message);
    }

    final answer = AiAstroAnswer.fromJson(body);

    if (answer.answer.isEmpty) {
      throw const AiAstroApiException('AI Astro returned an empty answer.');
    }

    return answer;
  }

  Future<AiAstroOpeningMessage> getOpeningMessage({
    required String personaId,
    required String consultantTypeCode,
    required String category,
  }) async {
    final session = await _sessionStore.read();
    final accessToken = session?.accessToken.trim() ?? '';

    if (accessToken.isEmpty) {
      throw const AiAstroApiException(
        'Please login again to use AI Astro.',
        loginRequired: true,
      );
    }

    final response = await _client
        .post(
          Uri.parse('${ApiConfig.baseUrl}/ai-astro/opening-message'),
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $accessToken',
          },
          body: jsonEncode({
            'personaId': personaId.trim(),
            'consultantTypeCode': consultantTypeCode.trim(),
            'category': category.trim(),
          }),
        )
        .timeout(ApiConfig.requestTimeout);

    final body = _decodeAiAstroBody(response.body);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AiAstroApiException(
        _aiAstroApiMessage(body, 'Unable to prepare AI consultant greeting.'),
      );
    }

    return AiAstroOpeningMessage.fromJson(body);
  }

  Future<AiAstroTimedSessionStart> startTimedSession({
    required String clientSessionId,
    required String personaId,
    required String consultantTypeCode,
    required int durationMinutes,
  }) async {
    if (durationMinutes < 1 || durationMinutes > 60) {
      throw const AiAstroApiException(
        'Please choose a valid AI consultation duration.',
      );
    }

    final session = await _sessionStore.read();
    final accessToken = session?.accessToken.trim() ?? '';

    if (accessToken.isEmpty) {
      throw const AiAstroApiException(
        'Please login again to use AI Astro.',
        loginRequired: true,
      );
    }

    final response = await _client
        .post(
          Uri.parse('${ApiConfig.baseUrl}/ai-astro/session/start'),
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $accessToken',
          },
          body: jsonEncode({
            'clientSessionId': clientSessionId.trim(),
            'personaId': personaId.trim(),
            'consultantTypeCode': consultantTypeCode.trim(),
            'durationMinutes': durationMinutes,
          }),
        )
        .timeout(ApiConfig.requestTimeout);

    final body = _decodeAiAstroBody(response.body);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AiAstroApiException(
        _aiAstroApiMessage(body, 'Unable to start AI consultation.'),
      );
    }

    return AiAstroTimedSessionStart.fromJson(body);
  }

  Future<AiAstroTimedSessionStart> activateTimedSession({
    required String clientSessionId,
  }) async {
    final session = await _sessionStore.read();
    final accessToken = session?.accessToken.trim() ?? '';

    if (accessToken.isEmpty) {
      throw const AiAstroApiException(
        'Please login again to continue AI Astro.',
        loginRequired: true,
      );
    }

    final response = await _client
        .post(
          Uri.parse('${ApiConfig.baseUrl}/ai-astro/session/activate'),
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $accessToken',
          },
          body: jsonEncode({'clientSessionId': clientSessionId.trim()}),
        )
        .timeout(ApiConfig.requestTimeout);

    final body = _decodeAiAstroBody(response.body);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AiAstroApiException(
        _aiAstroApiMessage(body, 'Unable to activate AI consultation.'),
      );
    }

    return AiAstroTimedSessionStart.fromJson(body);
  }

  Future<AiAstroTimedHeartbeat> heartbeatTimedSession({
    required String clientSessionId,
  }) async {
    final session = await _sessionStore.read();
    final accessToken = session?.accessToken.trim() ?? '';

    if (accessToken.isEmpty) {
      throw const AiAstroApiException(
        'Please login again to continue AI Astro.',
        loginRequired: true,
      );
    }

    final response = await _client
        .post(
          Uri.parse('${ApiConfig.baseUrl}/ai-astro/session/heartbeat'),
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $accessToken',
          },
          body: jsonEncode({'clientSessionId': clientSessionId.trim()}),
        )
        .timeout(ApiConfig.requestTimeout);

    final body = _decodeAiAstroBody(response.body);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AiAstroApiException(
        _aiAstroApiMessage(body, 'Unable to continue AI consultation.'),
      );
    }

    return AiAstroTimedHeartbeat.fromJson(body);
  }

  Future<AiAstroTimedSessionEnd> endTimedSession({
    required String clientSessionId,
  }) async {
    final session = await _sessionStore.read();
    final accessToken = session?.accessToken.trim() ?? '';

    if (accessToken.isEmpty) {
      throw const AiAstroApiException(
        'Please login again to end AI Astro.',
        loginRequired: true,
      );
    }

    final response = await _client
        .post(
          Uri.parse('${ApiConfig.baseUrl}/ai-astro/session/end'),
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $accessToken',
          },
          body: jsonEncode({'clientSessionId': clientSessionId.trim()}),
        )
        .timeout(ApiConfig.requestTimeout);

    final body = _decodeAiAstroBody(response.body);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AiAstroApiException(
        _aiAstroApiMessage(body, 'Unable to end AI consultation.'),
      );
    }

    return AiAstroTimedSessionEnd.fromJson(body);
  }

  Map<String, dynamic> _decodeAiAstroBody(String rawBody) {
    if (rawBody.trim().isEmpty) {
      return <String, dynamic>{};
    }

    try {
      final decoded = jsonDecode(rawBody);

      if (decoded is Map<String, dynamic>) {
        return decoded;
      }
    } catch (_) {
      // Error handling below uses fallback text.
    }

    return <String, dynamic>{};
  }

  String _aiAstroApiMessage(Map<String, dynamic> body, String fallback) {
    final message = body['message'];

    if (message is String && message.trim().isNotEmpty) {
      return message.trim();
    }

    if (message is List && message.isNotEmpty) {
      return message.map((item) => item.toString()).join(', ');
    }

    final error = body['error'];

    if (error is String && error.trim().isNotEmpty) {
      return error.trim();
    }

    return fallback;
  }

  Future<AiAstroReviewsResult> getAstrologerReviews(String astrologerId) async {
    final id = astrologerId.trim();

    if (id.isEmpty) {
      throw const AiAstroApiException(
        'Astrologer ID is required to load reviews.',
      );
    }

    final uri = Uri.parse(
      '${ApiConfig.baseUrl}/review/astrologer/${Uri.encodeComponent(id)}',
    );

    try {
      final response = await _client.get(uri).timeout(ApiConfig.requestTimeout);

      final decoded = jsonDecode(response.body);

      final body = decoded is Map<String, dynamic>
          ? decoded
          : <String, dynamic>{};

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw AiAstroApiException(
          (body['message'] ?? 'Unable to load reviews.').toString(),
        );
      }

      final rawReviews = body['data'];

      final reviews = rawReviews is List
          ? rawReviews
                .whereType<Map>()
                .map(
                  (item) =>
                      AiAstroReview.fromJson(Map<String, dynamic>.from(item)),
                )
                .toList(growable: false)
          : const <AiAstroReview>[];

      return AiAstroReviewsResult(
        averageRating: (body['averageRating'] as num?)?.toDouble() ?? 0,
        totalReviews: (body['totalReviews'] as num?)?.toInt() ?? reviews.length,
        reviews: reviews,
      );
    } on AiAstroApiException {
      rethrow;
    } catch (_) {
      throw const AiAstroApiException(
        'Unable to load astrologer reviews right now.',
      );
    }
  }
}

class AiAstroApiException implements Exception {
  const AiAstroApiException(this.message, {this.loginRequired = false});

  final String message;
  final bool loginRequired;

  @override
  String toString() => message;
}
