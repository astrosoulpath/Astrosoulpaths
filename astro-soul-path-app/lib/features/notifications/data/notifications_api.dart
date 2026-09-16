import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';
import '../../auth/data/auth_session_store.dart';
import 'app_notification.dart';

class NotificationsApiException implements Exception {
  const NotificationsApiException(this.message);

  final String message;

  @override
  String toString() => message;
}

class NotificationsApi {
  NotificationsApi({http.Client? client, AuthSessionStore? sessionStore})
    : _client = client ?? http.Client(),
      _sessionStore = sessionStore ?? AuthSessionStore();

  final http.Client _client;
  final AuthSessionStore _sessionStore;

  Future<String> _accessToken() async {
    final session = await _sessionStore.read();
    final token = session?.accessToken.trim() ?? '';

    if (token.isEmpty) {
      throw const NotificationsApiException(
        'Please login to access notifications.',
      );
    }

    return token;
  }

  Future<NotificationInbox> getNotifications() async {
    var token = await _accessToken();

    try {
      var response = await _getNotificationsResponse(token);

      // Do not treat an expired access JWT as a logged-out user.
      // Refresh the SAME customer session and retry once.
      if (response.statusCode == 401 || response.statusCode == 403) {
        final refreshedSession = await _sessionStore.forceRefresh();
        final refreshedToken = refreshedSession?.accessToken.trim() ?? '';

        if (refreshedToken.isEmpty) {
          throw const NotificationsApiException(
            'Please login to access notifications.',
          );
        }

        token = refreshedToken;
        response = await _getNotificationsResponse(token);
      }

      final body = _decode(response.body);

      if (response.statusCode == 401 || response.statusCode == 403) {
        throw const NotificationsApiException(
          'Please login to access notifications.',
        );
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw NotificationsApiException(
          _message(body, 'Unable to load notifications.'),
        );
      }

      final data = body['data'];

      if (data is! Map) {
        throw const NotificationsApiException('Invalid notification response.');
      }

      final rawItems = data['items'];

      final items = rawItems is List
          ? rawItems
                .whereType<Map>()
                .map(
                  (item) =>
                      AppNotification.fromJson(Map<String, dynamic>.from(item)),
                )
                .toList(growable: false)
          : const <AppNotification>[];

      final unreadCount =
          int.tryParse(data['unreadCount']?.toString() ?? '') ?? 0;

      return NotificationInbox(items: items, unreadCount: unreadCount);
    } on NotificationsApiException {
      rethrow;
    } catch (_) {
      // Internet/backend timeout must never masquerade as logout.
      throw const NotificationsApiException(
        'Unable to connect to notifications. Please try again.',
      );
    }
  }

  Future<http.Response> _authenticatedNotificationRequest(
    Future<http.Response> Function(String token) request,
  ) async {
    var token = await _accessToken();

    var response = await request(token);

    if (response.statusCode == 401 || response.statusCode == 403) {
      final refreshedSession = await _sessionStore.forceRefresh();
      final refreshedToken = refreshedSession?.accessToken.trim() ?? '';

      if (refreshedToken.isEmpty) {
        throw const NotificationsApiException(
          'Please login to access notifications.',
        );
      }

      token = refreshedToken;
      response = await request(token);
    }

    if (response.statusCode == 401 || response.statusCode == 403) {
      throw const NotificationsApiException(
        'Please login to access notifications.',
      );
    }

    return response;
  }

  Future<http.Response> _getNotificationsResponse(String token) {
    return _client
        .get(
          Uri.parse('${ApiConfig.baseUrl}/notifications'),
          headers: {
            'Accept': 'application/json',
            'Authorization': 'Bearer $token',
          },
        )
        .timeout(ApiConfig.requestTimeout);
  }

  Future<int> getUnreadCount() async {
    final response = await _authenticatedNotificationRequest(
      (token) => _client
          .get(
            Uri.parse('${ApiConfig.baseUrl}/notifications/unread-count'),
            headers: {
              'Accept': 'application/json',
              'Authorization': 'Bearer $token',
            },
          )
          .timeout(ApiConfig.requestTimeout),
    );

    final body = _decode(response.body);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw NotificationsApiException(
        _message(body, 'Unable to load unread notifications.'),
      );
    }

    final data = body['data'];

    if (data is! Map) {
      return 0;
    }

    return int.tryParse(data['unreadCount']?.toString() ?? '') ?? 0;
  }

  Future<void> markAsRead(String notificationId) async {
    final response = await _authenticatedNotificationRequest(
      (token) => _client
          .patch(
            Uri.parse(
              '${ApiConfig.baseUrl}/notifications/$notificationId/read',
            ),
            headers: {
              'Accept': 'application/json',
              'Authorization': 'Bearer $token',
            },
          )
          .timeout(ApiConfig.requestTimeout),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw const NotificationsApiException(
        'Unable to mark notification as read.',
      );
    }
  }

  Future<void> markAllAsRead() async {
    final response = await _authenticatedNotificationRequest(
      (token) => _client
          .patch(
            Uri.parse('${ApiConfig.baseUrl}/notifications/read-all'),
            headers: {
              'Accept': 'application/json',
              'Authorization': 'Bearer $token',
            },
          )
          .timeout(ApiConfig.requestTimeout),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw const NotificationsApiException(
        'Unable to mark notifications as read.',
      );
    }
  }

  Map<String, dynamic> _decode(String source) {
    if (source.trim().isEmpty) {
      return <String, dynamic>{};
    }

    try {
      final decoded = jsonDecode(source);

      if (decoded is Map) {
        return Map<String, dynamic>.from(decoded);
      }
    } catch (_) {}

    return <String, dynamic>{};
  }

  String _message(Map<String, dynamic> body, String fallback) {
    final message = body['message'];

    if (message is String && message.trim().isNotEmpty) {
      return message.trim();
    }

    return fallback;
  }

  void close() {
    _client.close();
  }
}
