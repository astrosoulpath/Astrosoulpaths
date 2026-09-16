import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import '../core/notifications/notification_service.dart';
import '../core/localization/app_locale_controller.dart';
import '../core/localization/app_strings.dart';
import '../core/theme/app_theme.dart';
import '../core/theme/app_theme_controller.dart';
import '../features/astrology_questions/presentation/screens/astrology_questions_screen.dart';
import '../features/astrologers/presentation/screens/astrologer_detail_screen.dart';
import '../features/category_ai/presentation/screens/category_ai_chat_screen.dart';
import '../features/auth/presentation/auth_gate.dart';
import '../features/chat/presentation/screens/chat_screen.dart';
import '../features/calling/presentation/screens/audio_call_screen.dart';
import '../features/calling/presentation/screens/video_call_screen.dart';
import '../features/consultations/presentation/screens/consultation_history_screen.dart';
import '../features/horoscope/presentation/screens/daily_horoscope_screen.dart';
import '../features/kundli/presentation/screens/customer_kundli_screen.dart';

final GlobalKey<NavigatorState> rootNavigatorKey = GlobalKey<NavigatorState>();

class AstroSoulPathApp extends StatefulWidget {
  const AstroSoulPathApp({super.key});

  @override
  State<AstroSoulPathApp> createState() => _AstroSoulPathAppState();
}

class _AstroSoulPathAppState extends State<AstroSoulPathApp> {
  String? _lastChatNotificationKey;
  DateTime? _lastChatNotificationAt;

  Map<String, dynamic>? _pendingNotificationPayload;

  OverlayEntry? _notificationOverlay;
  Timer? _notificationTimer;

  @override
  void initState() {
    super.initState();

    AppThemeController.loadCached();
    _loadCachedLocaleTranslations();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initializeNotifications();
    });
  }

  Future<void> _loadCachedLocaleTranslations() async {
    await AppLocaleController.loadCached();

    await AppStrings.loadCachedTranslations(AppLocaleController.languageCode);
  }

  Future<void> _initializeNotifications() async {
    await NotificationService.instance.initialize(
      onNotificationTap: _handleNotificationTap,
      onForegroundNotification: _showForegroundPopup,
    );
  }

  void _handleNotificationTap(Map<String, dynamic> payload) {
    final type = payload['type']?.toString().trim().toLowerCase() ?? '';

    if (kDebugMode) {
      debugPrint('NOTIFICATION TAP PAYLOAD: $payload');
    }

    final navigator = rootNavigatorKey.currentState;

    if (navigator == null) {
      _pendingNotificationPayload = Map<String, dynamic>.from(payload);

      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) {
          return;
        }

        _flushPendingNotificationTap();
      });

      return;
    }

    switch (type) {
      case 'astrologer_online':
        final astrologerId =
            payload['astrologerId']?.toString().trim() ?? '';

        if (astrologerId.isEmpty) {
          if (kDebugMode) {
            debugPrint(
              'Astrologer online notification is missing astrologerId.',
            );
          }
          return;
        }

        navigator.push(
          MaterialPageRoute<void>(
            builder: (_) =>
                AstrologerDetailScreen(astrologerId: astrologerId),
          ),
        );
        break;

      case 'consultation_cancelled':
      case 'consultation_rejected':
      case 'consultation_expired':
      case 'consultation_ended':
        navigator.push(
          MaterialPageRoute<void>(
            builder: (_) => const ConsultationHistoryScreen(),
          ),
        );
        break;

      case 'consultation_extended':
      case 'chat_message':
      case 'consultation_accepted':
      case 'consultation_started':
        final consultationId =
            payload['consultationId']?.toString().trim().isNotEmpty == true
            ? payload['consultationId'].toString().trim()
            : payload['callSessionId']?.toString().trim() ?? '';

        if (consultationId.isEmpty) {
          if (kDebugMode) {
            debugPrint(
              'Consultation notification is missing consultationId/callSessionId.',
            );
          }
          return;
        }

        // #60 notification dedupe:
        // prevent the same chat notification from stacking duplicate screens.
        final notificationKey = '$type:$consultationId';
        final now = DateTime.now();
        final previousAt = _lastChatNotificationAt;

        if (_lastChatNotificationKey == notificationKey &&
            previousAt != null &&
            now.difference(previousAt) < const Duration(seconds: 3)) {
          if (kDebugMode) {
            debugPrint(
              'Duplicate chat notification tap ignored: $notificationKey',
            );
          }
          return;
        }

        _lastChatNotificationKey = notificationKey;
        _lastChatNotificationAt = now;
        final notificationMode =
            payload['mode']?.toString().trim().toUpperCase() ??
            payload['consultationMode']?.toString().trim().toUpperCase() ??
            payload['consultationType']?.toString().trim().toUpperCase() ??
            payload['callType']?.toString().trim().toUpperCase() ??
            payload['type']?.toString().trim().toUpperCase() ??
            '';

        final callSessionId =
            payload['callSessionId']?.toString().trim().isNotEmpty == true
            ? payload['callSessionId'].toString().trim()
            : consultationId;

        final participantName =
            payload['astrologerName']?.toString().trim().isNotEmpty == true
            ? payload['astrologerName'].toString().trim()
            : payload['customerName']?.toString().trim().isNotEmpty == true
            ? payload['customerName'].toString().trim()
            : 'Consultation';

        navigator.push(
          MaterialPageRoute<void>(
            builder: (_) {
              if (notificationMode.contains('VIDEO')) {
                return VideoCallScreen(
                  callId: callSessionId,
                  participantName: participantName,
                );
              }

              if (notificationMode.contains('AUDIO')) {
                return AudioCallScreen(
                  callId: callSessionId,
                  astrologerName: participantName,
                );
              }

              return ChatScreen(consultationId: consultationId);
            },
          ),
        );
        break;
      case 'horoscope':
        navigator.push(
          MaterialPageRoute<void>(builder: (_) => const DailyHoroscopeScreen()),
        );
        break;
      case 'kundli':
        navigator.push(
          MaterialPageRoute<void>(builder: (_) => const CustomerKundliScreen()),
        );
        break;

      case 'marriage':
        navigator.push(
          MaterialPageRoute<void>(
            builder: (_) =>
                const CategoryAiChatScreen(category: AspAiCategory.marriage),
          ),
        );
        break;

      case 'career':
      case 'job':
        navigator.push(
          MaterialPageRoute<void>(
            builder: (_) =>
                const CategoryAiChatScreen(category: AspAiCategory.career),
          ),
        );
        break;

      case 'love':
      case 'relationship':
        navigator.push(
          MaterialPageRoute<void>(
            builder: (_) =>
                const CategoryAiChatScreen(category: AspAiCategory.love),
          ),
        );
        break;

      case 'finance':
      case 'astrology_question':
        navigator.push(
          MaterialPageRoute<void>(
            builder: (_) => const AstrologyQuestionsScreen(),
          ),
        );
        break;

      default:
        if (kDebugMode) {
          debugPrint('Notification has no registered deep-link route: $type');
        }
    }
  }

  void _flushPendingNotificationTap() {
    final payload = _pendingNotificationPayload;

    if (payload == null) {
      return;
    }

    if (rootNavigatorKey.currentState == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          _flushPendingNotificationTap();
        }
      });

      return;
    }

    _pendingNotificationPayload = null;
    _handleNotificationTap(payload);
  }

  void _showForegroundPopup(Map<String, dynamic> payload) {
    final overlay = rootNavigatorKey.currentState?.overlay;

    if (overlay == null) {
      return;
    }

    final title = payload['title']?.toString().trim().isNotEmpty == true
        ? payload['title'].toString().trim()
        : 'Astro Soul Path';

    final body = payload['body']?.toString().trim() ?? '';

    if (body.isEmpty) {
      return;
    }

    _dismissForegroundPopup();

    _notificationOverlay = OverlayEntry(
      builder: (context) {
        return Positioned(
          top: 12,
          left: 14,
          right: 14,
          child: SafeArea(
            child: Material(
              color: Colors.transparent,
              child: GestureDetector(
                onTap: () {
                  _dismissForegroundPopup();
                  _handleNotificationTap(payload);
                },
                child: Container(
                  padding: const EdgeInsets.fromLTRB(16, 14, 10, 14),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceLight,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(
                      color: AppColors.gold.withValues(alpha: 0.75),
                    ),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x66000000),
                        blurRadius: 20,
                        offset: Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: AppColors.gold.withValues(alpha: 0.14),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.auto_awesome_rounded,
                          color: AppColors.gold,
                          size: 24,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: AppColors.white,
                                fontSize: 15,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              body,
                              maxLines: 3,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: AppColors.muted,
                                fontSize: 13,
                                height: 1.35,
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed: _dismissForegroundPopup,
                        visualDensity: VisualDensity.compact,
                        icon: const Icon(
                          Icons.close_rounded,
                          color: AppColors.muted,
                          size: 20,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );

    overlay.insert(_notificationOverlay!);

    _notificationTimer = Timer(
      const Duration(seconds: 6),
      _dismissForegroundPopup,
    );
  }

  void _dismissForegroundPopup() {
    _notificationTimer?.cancel();
    _notificationTimer = null;

    _notificationOverlay?.remove();
    _notificationOverlay = null;
  }

  @override
  void dispose() {
    _dismissForegroundPopup();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<ThemeMode>(
      valueListenable: AppThemeController.themeMode,
      builder: (context, themeMode, _) {
        return ValueListenableBuilder<int>(
          valueListenable: AppStrings.revision,
          builder: (context, _, _) {
            return ValueListenableBuilder<Locale>(
              valueListenable: AppLocaleController.locale,
              builder: (context, locale, _) {
                return MaterialApp(
                  navigatorKey: rootNavigatorKey,
                  title: 'Astro Soul Path',
                  debugShowCheckedModeBanner: false,
                  theme: AppTheme.light,
                  darkTheme: AppTheme.dark,
                  themeMode: themeMode,
                  locale: locale,
                  localizationsDelegates: const [
                    GlobalMaterialLocalizations.delegate,
                    GlobalWidgetsLocalizations.delegate,
                    GlobalCupertinoLocalizations.delegate,
                  ],
                  supportedLocales: const [
                    Locale('en'),
                    Locale('hi'),
                    Locale('bn'),
                    Locale('ta'),
                    Locale('te'),
                    Locale('mr'),
                    Locale('gu'),
                    Locale('kn'),
                    Locale('ml'),
                    Locale('pa'),
                    Locale('es'),
                    Locale('fr'),
                    Locale('de'),
                    Locale('pt'),
                    Locale('it'),
                    Locale('ja'),
                    Locale('ko'),
                    Locale('zh'),
                    Locale('ar'),
                    Locale('ru'),
                  ],
                  home: const AuthGate(),
                );
              },
            );
          },
        );
      },
    );
  }
}

