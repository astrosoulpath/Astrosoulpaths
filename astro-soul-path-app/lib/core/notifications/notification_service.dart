import 'dart:convert';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'notification_device_api.dart';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  try {
    await Firebase.initializeApp();
  } catch (_) {
    return;
  }

  if (kDebugMode) {
    debugPrint('FCM BACKGROUND MESSAGE: ${message.messageId} ${message.data}');
  }
}

class NotificationService {
  NotificationService._();

  static final NotificationService instance = NotificationService._();

  FirebaseMessaging? _messaging;

  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  final NotificationDeviceApi _deviceApi = NotificationDeviceApi();

  bool _firebaseReady = false;
  bool _initialized = false;

  Future<void> initialize({
    required void Function(Map<String, dynamic> payload) onNotificationTap,
    void Function(Map<String, dynamic> payload)? onForegroundNotification,
  }) async {
    if (_initialized) {
      return;
    }

    const androidSettings = AndroidInitializationSettings(
      '@mipmap/ic_launcher',
    );

    const iosSettings = DarwinInitializationSettings();

    const initializationSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _localNotifications.initialize(
      settings: initializationSettings,
      onDidReceiveNotificationResponse: (response) {
        final payload = _decodePayload(response.payload);

        if (payload.isNotEmpty) {
          onNotificationTap(payload);
        }
      },
    );

    try {
      await Firebase.initializeApp();
      _messaging = FirebaseMessaging.instance;
      _firebaseReady = true;
    } catch (error) {
      _firebaseReady = false;

      if (kDebugMode) {
        debugPrint(
          'Firebase is not configured yet. Notifications remain in setup mode: $error',
        );
      }
    }

    if (!_firebaseReady) {
      _initialized = true;
      return;
    }

    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

    final messaging = _messaging;

    if (messaging == null) {
      _initialized = true;
      return;
    }

    await _requestPermission(messaging);

    FirebaseMessaging.onMessage.listen((message) async {
      await _showForegroundNotification(message);

      final payload = <String, dynamic>{
        ...message.data,
        'title':
            message.notification?.title ??
            message.data['title']?.toString() ??
            'Astro Soul Path',
        'body':
            message.notification?.body ??
            message.data['body']?.toString() ??
            '',
      };

      if (payload['body']?.toString().trim().isNotEmpty == true) {
        onForegroundNotification?.call(payload);
      }
    });

    FirebaseMessaging.onMessageOpenedApp.listen((message) {
      if (message.data.isNotEmpty) {
        onNotificationTap(Map<String, dynamic>.from(message.data));
      }
    });

    final token = await messaging.getToken();

    if (token != null && token.trim().isNotEmpty) {
      try {
        await _deviceApi.registerDevice(fcmToken: token);
      } catch (error) {
        if (kDebugMode) {
          debugPrint('FCM DEVICE REGISTRATION FAILED: $error');
        }
      }
    }

    final initialMessage = await messaging.getInitialMessage();

    if (initialMessage != null && initialMessage.data.isNotEmpty) {
      onNotificationTap(Map<String, dynamic>.from(initialMessage.data));
    }

    messaging.onTokenRefresh.listen((token) async {
      if (kDebugMode) {
        debugPrint('FCM TOKEN REFRESHED: $token');
      }

      try {
        await _deviceApi.registerDevice(fcmToken: token);
      } catch (error) {
        if (kDebugMode) {
          debugPrint('FCM TOKEN REFRESH REGISTRATION FAILED: $error');
        }
      }
    });

    _initialized = true;
  }

  Future<void> _requestPermission(FirebaseMessaging messaging) async {
    await messaging.requestPermission(alert: true, badge: true, sound: true);
  }

  Future<void> _showForegroundNotification(RemoteMessage message) async {
    final notification = message.notification;

    final title =
        notification?.title ??
        message.data['title']?.toString() ??
        'Astro Soul Path';

    final body = notification?.body ?? message.data['body']?.toString() ?? '';

    if (body.isEmpty) {
      return;
    }

    const androidDetails = AndroidNotificationDetails(
      'astro_soul_path_general',
      'Astro Soul Path',
      channelDescription:
          'Astrology guidance, consultation and account notifications',
      importance: Importance.high,
      priority: Priority.high,
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    const details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    await _localNotifications.show(
      id: message.messageId.hashCode,
      title: title,
      body: body,
      notificationDetails: details,
      payload: jsonEncode(message.data),
    );
  }

  Map<String, dynamic> _decodePayload(String? payload) {
    if (payload == null || payload.trim().isEmpty) {
      return const {};
    }

    try {
      final decoded = jsonDecode(payload);

      if (decoded is Map) {
        return Map<String, dynamic>.from(decoded);
      }
    } catch (_) {
      return const {};
    }

    return const {};
  }

  Future<void> syncCurrentDevice() async {
    if (kDebugMode) {
      debugPrint('FCM LOGIN SYNC: started');
    }

    try {
      if (!_firebaseReady) {
        await Firebase.initializeApp();
        _messaging = FirebaseMessaging.instance;
        _firebaseReady = true;
      }

      final messaging = _messaging;

      if (messaging == null) {
        return;
      }

      await _requestPermission(messaging);

      if (kDebugMode) {
        debugPrint('FCM LOGIN SYNC: requesting Firebase token');
      }

      final token = await messaging.getToken();

      if (kDebugMode) {
        debugPrint(
          'FCM LOGIN SYNC: token received = ${token != null && token.trim().isNotEmpty}',
        );
      }

      if (token == null || token.trim().isEmpty) {
        if (kDebugMode) {
          debugPrint('FCM LOGIN SYNC: token unavailable');
        }
        return;
      }

      await _deviceApi.registerDevice(fcmToken: token);

      if (kDebugMode) {
        debugPrint('FCM LOGIN SYNC: device registered');
      }
    } catch (error) {
      // Push registration must never block a successful customer login.
      if (kDebugMode) {
        debugPrint('FCM LOGIN SYNC FAILED: $error');
      }
    }
  }

  Future<String?> getToken() async {
    if (!_firebaseReady) {
      return null;
    }

    return _messaging?.getToken();
  }
}

