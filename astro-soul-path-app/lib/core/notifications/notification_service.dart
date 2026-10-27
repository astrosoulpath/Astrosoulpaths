import 'dart:convert';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'notification_device_api.dart';
import 'notification_session_fence.dart';
import 'notification_display_fence.dart';
import 'smart_notification_payload.dart';
import '../../features/auth/data/auth_session_store.dart';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  try {
    await Firebase.initializeApp();
  } catch (_) {
    return;
  }

  if (kDebugMode) {
    debugPrint('FCM background notification received');
  }
}

class NotificationService with WidgetsBindingObserver {
  NotificationService._();

  static final NotificationService instance = NotificationService._();

  FirebaseMessaging? _messaging;

  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  final NotificationDeviceApi _deviceApi = NotificationDeviceApi();

  bool _firebaseReady = false;
  bool _initialized = false;
  Future<void> _deviceOperations = Future.value();

  Future<void> _registerDevice(String token) {
    final generation = NotificationSessionFence.generation;
    final operation = _deviceOperations.then((_) async {
      final settings = await _messaging?.getNotificationSettings();
      if (settings == null ||
          settings.authorizationStatus == AuthorizationStatus.denied ||
          settings.authorizationStatus == AuthorizationStatus.notDetermined) {
        return;
      }
      if (!NotificationSessionFence.suspended &&
          generation == NotificationSessionFence.generation) {
        await _deviceApi.registerDevice(fcmToken: token);
      }
    });
    _deviceOperations = operation.catchError((Object _) {});
    return operation;
  }

  Future<void> unbindCurrentDevice(AuthSessionStore sessions) async {
    NotificationSessionFence.suspend();
    if (_messaging == null && Firebase.apps.isNotEmpty) {
      _messaging = FirebaseMessaging.instance;
      _firebaseReady = true;
    }
    if (!_firebaseReady || _messaging == null) return;
    final session = await sessions.read();
    await _deviceOperations;
    final token = await _messaging!.getToken();
    Object? failure;
    try {
      if (session != null && token != null) {
        await _deviceApi.unregisterDevice(
          fcmToken: token,
          accessToken: session.accessToken,
        );
      }
    } catch (error) {
      failure = error;
    }
    // Rotate the installation token even if the server is unreachable.
    try {
      await _messaging!.deleteToken();
    } catch (error) {
      failure ??= error;
    }
    await _localNotifications.cancelAll();
    if (failure != null) {
      throw StateError('Notification logout could not be confirmed.');
    }
  }

  Future<void> initialize({
    required void Function(Map<String, dynamic> payload) onNotificationTap,
    void Function(Map<String, dynamic> payload)? onForegroundNotification,
  }) async {
    if (_initialized) {
      return;
    }
    WidgetsBinding.instance.addObserver(this);

    const androidSettings = AndroidInitializationSettings('ic_stat_astro');

    const iosSettings = DarwinInitializationSettings();

    const initializationSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _localNotifications.initialize(
      settings: initializationSettings,
      onDidReceiveNotificationResponse: (response) async {
        final payload = _decodePayload(response.payload);
        if (!await _acceptPayload(payload)) return;

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
          'Firebase is not configured yet. Notifications remain in setup mode.',
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
      final fence = NotificationDisplayFence();
      try {
        if (!await fence.display(
          authorize: () => _acceptPayload(message.data),
          show: () => _showForegroundNotification(message),
          clearStale: () =>
              _localNotifications.cancel(id: message.messageId.hashCode),
        )) {
          return;
        }
      } catch (_) {
        return; // Notification plugin/network failure must not become unhandled.
      }

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

      if (fence.current &&
          payload['body']?.toString().trim().isNotEmpty == true) {
        onForegroundNotification?.call(payload);
      }
    });

    FirebaseMessaging.onMessageOpenedApp.listen((message) async {
      if (!await _acceptPayload(message.data)) return;
      if (message.data.isNotEmpty) {
        onNotificationTap(Map<String, dynamic>.from(message.data));
      }
    });

    final token = await messaging.getToken();

    if (token != null && token.trim().isNotEmpty) {
      try {
        await _registerDevice(token);
      } catch (error) {
        if (kDebugMode) {
          debugPrint('FCM device registration failed');
        }
      }
    }

    final initialMessage = await messaging.getInitialMessage();

    if (initialMessage != null &&
        initialMessage.data.isNotEmpty &&
        await _acceptPayload(initialMessage.data)) {
      onNotificationTap(Map<String, dynamic>.from(initialMessage.data));
    }

    messaging.onTokenRefresh.listen((token) async {
      if (kDebugMode) {
        debugPrint('FCM token refreshed');
      }

      try {
        if ((await messaging.getNotificationSettings()).authorizationStatus ==
            AuthorizationStatus.denied) {
          return;
        }
        await _registerDevice(token);
      } catch (error) {
        if (kDebugMode) {
          debugPrint('FCM token refresh registration failed');
        }
      }
    });

    _initialized = true;
  }

  Future<void> _requestPermission(FirebaseMessaging messaging) async {
    await messaging.requestPermission(alert: true, badge: true, sound: true);
  }

  Future<bool> _acceptPayload(Map<String, dynamic> payload) async {
    if (!validSmartNotificationPayload(payload)) return false;
    final generation = NotificationSessionFence.generation;
    final owner = payload['ownerId']?.toString();
    if (owner == null) return true; // Legacy routing remains unchanged.
    if (NotificationSessionFence.suspended) return false;
    final session = await AuthSessionStore().read();
    return generation == NotificationSessionFence.generation &&
        session?.user['id']?.toString() == owner;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      syncCurrentDevice();
    }
  }

  Future<bool> horoscopeNotificationPermissionGranted() async {
    try {
      if (!_firebaseReady) return false;
      final settings = await _messaging!.getNotificationSettings();
      return settings.authorizationStatus == AuthorizationStatus.authorized;
    } catch (_) {
      return false;
    }
  }

  Future<bool> authorizeHoroscopeReminders() async {
    final generation = NotificationSessionFence.generation;
    try {
      if (!_firebaseReady) {
        await Firebase.initializeApp();
        _messaging = FirebaseMessaging.instance;
        _firebaseReady = true;
      }
      final settings = await _messaging!.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      // Provisional iOS delivery is quiet; do not describe it as full consent.
      if (settings.authorizationStatus != AuthorizationStatus.authorized) {
        return false;
      }
      final android = _localNotifications
          .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin
          >();
      if (android != null &&
          await android.requestNotificationsPermission() != true) {
        return false;
      }
      final session = await AuthSessionStore().read();
      if (session == null ||
          generation != NotificationSessionFence.generation) {
        return false;
      }
      NotificationSessionFence.activate();
      await syncCurrentDevice();
      return true;
    } catch (_) {
      return false;
    }
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
    final generation = NotificationSessionFence.generation;
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

      final authorization = await messaging.getNotificationSettings();
      if (authorization.authorizationStatus == AuthorizationStatus.denied) {
        await unbindCurrentDevice(AuthSessionStore());
        return;
      }

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

      if (generation == NotificationSessionFence.generation) {
        await _registerDevice(token);
      }

      if (kDebugMode) {
        debugPrint('FCM LOGIN SYNC: device registered');
      }
    } catch (error) {
      // Push registration must never block a successful customer login.
      if (kDebugMode) {
        debugPrint('FCM login sync failed');
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
