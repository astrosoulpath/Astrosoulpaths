import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';
import 'astrologer_review.dart';

class ReviewApiException implements Exception {
  const ReviewApiException(this.message);

  final String message;

  @override
  String toString() => message;
}

class ReviewApi {
  ReviewApi({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  Future<AstrologerReviewSummary> getAstrologerReviews(
    String astrologerId,
  ) async {
    final id = astrologerId.trim();

    if (id.isEmpty) {
      throw const ReviewApiException('Astrologer id is required.');
    }

    final uri = Uri.parse('${ApiConfig.baseUrl}/review/astrologer/$id');

    final response = await _client
        .get(uri, headers: const {'Accept': 'application/json'})
        .timeout(ApiConfig.requestTimeout);

    final body = _decode(response.body);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ReviewApiException(_message(body, 'Unable to load reviews.'));
    }

    return AstrologerReviewSummary.fromJson(body);
  }

  Future<Map<String, dynamic>> submitReview({
    required String accessToken,
    required String callSessionId,
    required int rating,
    String? comment,
  }) async {
    final token = accessToken.trim();

    if (token.isEmpty) {
      throw const ReviewApiException('Your login session has expired.');
    }

    final sessionId = callSessionId.trim();

    if (sessionId.isEmpty) {
      throw const ReviewApiException('Consultation id is required.');
    }

    final uri = Uri.parse('${ApiConfig.baseUrl}/review');

    final response = await _client
        .post(
          uri,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $token',
          },
          body: jsonEncode({
            'callSessionId': sessionId,
            'rating': rating,
            if (comment?.trim().isNotEmpty == true) 'comment': comment!.trim(),
          }),
        )
        .timeout(ApiConfig.requestTimeout);

    final body = _decode(response.body);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ReviewApiException(_message(body, 'Unable to submit review.'));
    }

    return body;
  }

  Map<String, dynamic> _decode(String source) {
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
      // handled below
    }

    return <String, dynamic>{};
  }

  String _message(Map<String, dynamic> body, String fallback) {
    final value = body['message'];

    if (value is String && value.trim().isNotEmpty) {
      return value.trim();
    }

    if (value is List && value.isNotEmpty) {
      return value.first.toString();
    }

    return fallback;
  }

  void close() {
    _client.close();
  }
}
