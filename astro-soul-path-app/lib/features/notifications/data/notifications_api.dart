import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';
import '../../auth/data/auth_session_store.dart';
import 'app_notification.dart';
import '../../../core/notifications/notification_session_fence.dart';

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
  String? _owner;
  int? _generation;
  bool _closed = false;

  Future<void> _checkOwner() async {
    final id = (await _sessionStore.read())?.user['id'];
    if (_closed ||
        NotificationSessionFence.suspended ||
        id is! String ||
        id.isEmpty ||
        (_owner != null && _owner != id) ||
        (_generation != null &&
            _generation != NotificationSessionFence.generation)) {
      throw const NotificationsApiException(
        'Account changed. Open notifications again.',
      );
    }
    _owner = id;
    _generation = NotificationSessionFence.generation;
  }

  Future<String> _accessToken() async {
    await _checkOwner();
    final session = await _sessionStore.read();
    final token = session?.accessToken.trim() ?? '';
    if (_closed || session?.user['id'] != _owner) {
      throw const NotificationsApiException(
        'Account changed. Open notifications again.',
      );
    }

    if (token.isEmpty) {
      throw const NotificationsApiException(
        'Please login to access notifications.',
      );
    }

    return token;
  }

  Future<NotificationInbox> getNotifications() async {
    try {
      final response = await _authenticatedNotificationRequest(
        _getNotificationsResponse,
      );

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
    await _checkOwner();

    if (response.statusCode == 401 || response.statusCode == 403) {
      final refreshedSession = await _sessionStore.forceRefresh();
      final refreshedToken = refreshedSession?.accessToken.trim() ?? '';
      await _checkOwner();

      if (refreshedToken.isEmpty) {
        throw const NotificationsApiException(
          'Please login to access notifications.',
        );
      }

      token = refreshedToken;
      response = await request(token);
      await _checkOwner();
    }

    if (response.statusCode == 401 || response.statusCode == 403) {
      throw const NotificationsApiException(
        'Please login to access notifications.',
      );
    }

    return response;
  }

  Future<Map<String, dynamic>> getReading(String id) async {
    if (!RegExp(r'^[a-f0-9]{64}$').hasMatch(id)) {
      throw const NotificationsApiException('Reading unavailable.');
    }
    final response = await _authenticatedNotificationRequest(
      (token) => _client
          .get(
            Uri.parse('${ApiConfig.baseUrl}/notifications/readings/$id'),
            headers: {
              'Accept': 'application/json',
              'Authorization': 'Bearer $token',
            },
          )
          .timeout(ApiConfig.requestTimeout),
    );
    final body = _decode(response.body);
    if (response.statusCode != 200 ||
        body['success'] != true ||
        body['data'] is! Map ||
        body['data']['id'] != id) {
      throw const NotificationsApiException(
        'This reading is unavailable, expired or no longer authorized.',
      );
    }
    return Map<String, dynamic>.from(body['data'] as Map);
  }

  Future<Map<String, dynamic>> getInsight(String id) async {
    if (!RegExp(
      r'^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$',
    ).hasMatch(id)) {
      throw const NotificationsApiException('Insight unavailable.');
    }
    final response = await _authenticatedNotificationRequest(
      (token) => _client
          .get(
            Uri.parse('${ApiConfig.baseUrl}/notifications/insights/$id'),
            headers: {
              'Accept': 'application/json',
              'Authorization': 'Bearer $token',
            },
          )
          .timeout(ApiConfig.requestTimeout),
    );
    final body = _decode(response.body);
    final data = body['data'];
    if (response.statusCode != 200 ||
        body['success'] != true ||
        data is! Map ||
        data['id'] != id ||
        data['title'] is! String ||
        data['body'] is! String) {
      throw const NotificationsApiException('Insight unavailable.');
    }
    return Map<String, dynamic>.from(data);
  }

  Future<void> markInsightOpened(String id) async {
    if (!RegExp(
      r'^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$',
    ).hasMatch(id)) {
      throw const NotificationsApiException('Insight unavailable.');
    }
    final response = await _authenticatedNotificationRequest(
      (token) => _client
          .post(
            Uri.parse('${ApiConfig.baseUrl}/notifications/insights/$id/open'),
            headers: {
              'Accept': 'application/json',
              'Authorization': 'Bearer $token',
            },
          )
          .timeout(ApiConfig.requestTimeout),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw const NotificationsApiException('View could not be recorded.');
    }
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
    _closed = true;
    _client.close();
  }
}
