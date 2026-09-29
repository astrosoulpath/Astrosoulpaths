import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/config/api_config.dart';

class FollowApiException implements Exception {
  const FollowApiException(this.message);

  final String message;

  @override
  String toString() => message;
}

class FollowStatus {
  const FollowStatus({required this.followerCount, required this.isFollowing});

  factory FollowStatus.fromJson(Map<String, dynamic> json) {
    final rawCount = json['followerCount'];

    final followerCount = rawCount is num
        ? rawCount.toInt()
        : int.tryParse(rawCount?.toString() ?? '') ?? 0;

    return FollowStatus(
      followerCount: followerCount < 0 ? 0 : followerCount,
      isFollowing: json['isFollowing'] == true,
    );
  }

  final int followerCount;
  final bool isFollowing;
}

class FollowApi {
  FollowApi({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  Future<FollowStatus> getRealStatus(String astrologerId) {
    return _request(
      method: 'GET',
      path: '/follow/astrologers/${_requiredId(astrologerId)}',
    );
  }

  Future<FollowStatus> followReal(String astrologerId) {
    return _request(
      method: 'POST',
      path: '/follow/astrologers/${_requiredId(astrologerId)}',
    );
  }

  Future<FollowStatus> unfollowReal(String astrologerId) {
    return _request(
      method: 'DELETE',
      path: '/follow/astrologers/${_requiredId(astrologerId)}',
    );
  }

  Future<FollowStatus> getAiStatus(String personaId) {
    return _request(
      method: 'GET',
      path: '/follow/ai/${_requiredId(personaId)}',
    );
  }

  Future<FollowStatus> followAi(String personaId) {
    return _request(
      method: 'POST',
      path: '/follow/ai/${_requiredId(personaId)}',
    );
  }

  Future<FollowStatus> unfollowAi(String personaId) {
    return _request(
      method: 'DELETE',
      path: '/follow/ai/${_requiredId(personaId)}',
    );
  }

  String _requiredId(String value) {
    final id = value.trim();

    if (id.isEmpty) {
      throw const FollowApiException('Profile ID is required.');
    }

    return Uri.encodeComponent(id);
  }

  Future<FollowStatus> _request({
    required String method,
    required String path,
  }) async {
    final session = Supabase.instance.client.auth.currentSession;
    final accessToken = session?.accessToken.trim() ?? '';

    if (accessToken.isEmpty) {
      throw const FollowApiException('Please sign in to follow astrologers.');
    }

    final uri = Uri.parse('${ApiConfig.baseUrl}$path');

    final headers = <String, String>{
      'Accept': 'application/json',
      'Authorization': 'Bearer $accessToken',
    };

    late http.Response response;

    try {
      switch (method) {
        case 'GET':
          response = await _client
              .get(uri, headers: headers)
              .timeout(const Duration(seconds: 15));
          break;

        case 'POST':
          response = await _client
              .post(uri, headers: headers)
              .timeout(const Duration(seconds: 15));
          break;

        case 'DELETE':
          response = await _client
              .delete(uri, headers: headers)
              .timeout(const Duration(seconds: 15));
          break;

        default:
          throw const FollowApiException('Unsupported follow request.');
      }
    } on FollowApiException {
      rethrow;
    } catch (_) {
      throw const FollowApiException(
        'Unable to update follow status. Please try again.',
      );
    }

    Map<String, dynamic> body = const {};

    if (response.body.trim().isNotEmpty) {
      try {
        final decoded = jsonDecode(response.body);

        if (decoded is Map) {
          body = Map<String, dynamic>.from(decoded);
        }
      } catch (_) {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          throw FollowApiException(
            'Follow request failed (${response.statusCode}).',
          );
        }
      }
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw FollowApiException(
        _readMessage(
          body,
          fallback: 'Follow request failed (${response.statusCode}).',
        ),
      );
    }

    return FollowStatus.fromJson(body);
  }

  String _readMessage(Map<String, dynamic> body, {required String fallback}) {
    final value = body['message'];

    if (value is String && value.trim().isNotEmpty) {
      return value.trim();
    }

    if (value is List) {
      final messages = value
          .whereType<String>()
          .map((item) => item.trim())
          .where((item) => item.isNotEmpty)
          .toList(growable: false);

      if (messages.isNotEmpty) {
        return messages.join(', ');
      }
    }

    return fallback;
  }
}
