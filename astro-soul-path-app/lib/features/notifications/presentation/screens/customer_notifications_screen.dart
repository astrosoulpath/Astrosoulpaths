import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import 'dart:async';
import '../../../../core/notifications/notification_session_fence.dart';
import '../../../astrology_questions/presentation/screens/astrology_questions_screen.dart';
import '../../../ai_astro/presentation/screens/ai_astro_home_screen.dart';
import '../../../category_ai/presentation/screens/category_ai_chat_screen.dart';
import '../../../chat/presentation/screens/chat_screen.dart';
import '../../../consultations/presentation/screens/consultation_history_screen.dart';
import '../../../horoscope/presentation/screens/daily_horoscope_screen.dart';
import '../../../kundli/presentation/screens/customer_kundli_screen.dart';
import '../../data/app_notification.dart';
import '../../data/notifications_api.dart';
import '../widgets/horoscope_reminder_tile.dart';
import 'subscription_notifications_screen.dart';
import '../../../subscription/presentation/screens/subscription_plans_screen.dart';
import 'notification_reading_screen.dart';

class CustomerNotificationsScreen extends StatefulWidget {
  const CustomerNotificationsScreen({super.key});

  @override
  State<CustomerNotificationsScreen> createState() =>
      _CustomerNotificationsScreenState();
}

class _CustomerNotificationsScreenState
    extends State<CustomerNotificationsScreen> {
  final NotificationsApi _api = NotificationsApi();

  List<AppNotification> _items = const [];
  bool _loading = true;
  String? _error;
  String _category = 'all';
  Timer? _identityWatch;
  final _epoch = NotificationSessionFence.generation;

  @override
  void initState() {
    super.initState();
    _load();
    _identityWatch = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted &&
          (NotificationSessionFence.suspended ||
              _epoch != NotificationSessionFence.generation)) {
        setState(() {
          _items = const [];
          _error = 'Account changed. Open notifications again.';
        });
        _identityWatch?.cancel();
      }
    });
  }

  @override
  void dispose() {
    _identityWatch?.cancel();
    _api.close();
    super.dispose();
  }

  Future<void> _load() async {
    if (mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }

    try {
      final result = await _api.getNotifications();

      if (!mounted) {
        return;
      }

      setState(() {
        _items = result.items;
        _loading = false;
      });
    } on NotificationsApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = error.message;
        _items = const [];
        _loading = false;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = 'Notifications could not be loaded.';
        _items = const [];
        _loading = false;
      });
    }
  }

  Future<void> _markRead(AppNotification notification) async {
    if (notification.isRead) {
      return;
    }

    try {
      await _api.markAsRead(notification.id);
      await _load();
    } catch (_) {}
  }

  Future<void> _openNotification(AppNotification notification) async {
    await _markRead(notification);

    if (!mounted) {
      return;
    }

    final type =
        notification.type?.trim().toLowerCase() ??
        notification.data?['type']?.toString().trim().toLowerCase() ??
        '';

    final data = notification.data ?? const <String, dynamic>{};

    switch (type) {
      case 'subscription':
        await Navigator.of(context).push(
          MaterialPageRoute<void>(builder: (_) => const DailyHoroscopeScreen()),
        );
        return;

      case 'smart_insight':
      case 'horoscope':
        final isSmartInsight = type == 'smart_insight';
        final readingId =
            data[isSmartInsight ? 'insightId' : 'readingId']?.toString() ?? '';
        if (readingId.isNotEmpty) {
          await Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => NotificationReadingScreen(
                readingId: readingId,
                smartInsight: isSmartInsight,
              ),
            ),
          );
          return;
        }
        if (isSmartInsight) return;
        await Navigator.of(context).push(
          MaterialPageRoute<void>(builder: (_) => const DailyHoroscopeScreen()),
        );
        return;

      case 'kundli':
        await Navigator.of(context).push(
          MaterialPageRoute<void>(builder: (_) => const CustomerKundliScreen()),
        );
        return;

      case 'consultation_cancelled':
      case 'consultation_rejected':
      case 'consultation_expired':
      case 'consultation_ended':
        await Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => const ConsultationHistoryScreen(),
          ),
        );
        return;

      case 'consultation_extended':
      case 'chat_message':
      case 'consultation_accepted':
      case 'consultation_started':
        final consultationId =
            data['consultationId']?.toString().trim().isNotEmpty == true
            ? data['consultationId'].toString().trim()
            : data['callSessionId']?.toString().trim() ?? '';

        if (consultationId.isEmpty) {
          return;
        }

        await Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => ChatScreen(consultationId: consultationId),
          ),
        );
        return;

      case 'marriage':
        await Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) =>
                const CategoryAiChatScreen(category: AspAiCategory.marriage),
          ),
        );
        return;

      case 'career':
      case 'job':
        await Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) =>
                const CategoryAiChatScreen(category: AspAiCategory.career),
          ),
        );
        return;

      case 'love':
      case 'relationship':
        await Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) =>
                const CategoryAiChatScreen(category: AspAiCategory.love),
          ),
        );
        return;

      case 'finance':
        await Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => const AstrologyQuestionsScreen(),
          ),
        );
        return;

      case 'astrology_question':
        await Navigator.of(context).push(
          MaterialPageRoute<void>(builder: (_) => const AiAstroHomeScreen()),
        );
        return;

      default:
        return;
    }
  }

  Future<void> _markAllRead() async {
    try {
      await _api.markAllAsRead();
      await _load();
    } catch (_) {}
  }

  String _timeLabel(DateTime date) {
    final local = date.toLocal();
    final now = DateTime.now();

    final today = DateTime(now.year, now.month, now.day);
    final notificationDay = DateTime(local.year, local.month, local.day);

    final difference = today.difference(notificationDay).inDays;

    final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
    final minute = local.minute.toString().padLeft(2, '0');
    final period = local.hour >= 12 ? 'PM' : 'AM';

    if (difference == 0) {
      return '$hour:$minute $period';
    }

    if (difference == 1) {
      return 'Yesterday';
    }

    return '${local.day}/${local.month}/${local.year}';
  }

  @override
  Widget build(BuildContext context) {
    final hasUnread = _items.any((item) => !item.isRead);

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        elevation: 0,
        title: Text(
          'Notifications',
          style: TextStyle(
            color: Theme.of(context).colorScheme.onSurface,
            fontWeight: FontWeight.w900,
          ),
        ),
        actions: [
          if (hasUnread)
            TextButton(
              onPressed: _markAllRead,
              child: const Text(
                'Mark all read',
                style: TextStyle(
                  color: AppColors.gold,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          const SizedBox(width: 6),
        ],
      ),
      body: Column(
        children: [
          const HoroscopeReminderTile(),
          ListTile(
            leading: const Icon(Icons.notifications_outlined),
            title: const Text('Subscription reminders'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => const SubscriptionNotificationsScreen(
                  audience: SubscriptionAudience.customer,
                ),
              ),
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (final category in [
                  'all',
                  'love',
                  'career',
                  'prosperity',
                  'marriage',
                  'cosmic',
                  'growth',
                  'horoscope',
                ])
                  Padding(
                    padding: const EdgeInsets.all(4),
                    child: ChoiceChip(
                      label: Text(category == 'all' ? 'All' : category),
                      selected: _category == category,
                      onSelected: (_) => setState(() => _category = category),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              color: AppColors.gold,
              onRefresh: _load,
              child: _buildBody(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    final visible = _items
        .where(
          (item) =>
              _category == 'all' ||
              item.type == _category ||
              (item.type == 'smart_insight' &&
                  item.data?['category'] == _category) ||
              (_category == 'prosperity' && item.type == 'finance'),
        )
        .toList();
    if (_loading && _items.isEmpty) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.gold),
      );
    }

    if (_error != null && _items.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const SizedBox(height: 150),
          Icon(
            Icons.notifications_none_rounded,
            color: Theme.of(context).colorScheme.onSurfaceVariant,
            size: 52,
          ),
          const SizedBox(height: 14),
          Text(
            _error!,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 16),
          Center(
            child: FilledButton(
              onPressed: _load,
              child: const Text('Try Again'),
            ),
          ),
        ],
      );
    }

    if (visible.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          SizedBox(height: 160),
          Icon(
            Icons.notifications_none_rounded,
            color: Theme.of(context).colorScheme.onSurfaceVariant,
            size: 58,
          ),
          SizedBox(height: 14),
          Text(
            'No notifications yet',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Theme.of(context).colorScheme.onSurface,
              fontSize: 18,
              fontWeight: FontWeight.w800,
            ),
          ),
          SizedBox(height: 6),
          Text(
            'Your important updates will appear here.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
              fontSize: 13,
            ),
          ),
        ],
      );
    }

    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 24),
      itemCount: visible.length,
      separatorBuilder: (_, _) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final item = visible[index];

        return InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: () => _openNotification(item),
          child: Container(
            padding: const EdgeInsets.all(15),
            decoration: BoxDecoration(
              color: item.isRead
                  ? Theme.of(context).colorScheme.surface
                  : Theme.of(context).colorScheme.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                color: item.isRead
                    ? const Color(0x334D6C91)
                    : const Color(0x9970A0D0),
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: AppColors.gold.withValues(alpha: 0.14),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.notifications_rounded,
                    color: AppColors.gold,
                    size: 21,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              item.title,
                              style: TextStyle(
                                color: Theme.of(context).colorScheme.onSurface,
                                fontSize: 14,
                                fontWeight: item.isRead
                                    ? FontWeight.w700
                                    : FontWeight.w900,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            _timeLabel(item.createdAt),
                            style: TextStyle(
                              color: Theme.of(
                                context,
                              ).colorScheme.onSurfaceVariant,
                              fontSize: 10,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 5),
                      Text(
                        item.body,
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                          fontSize: 12,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
                if (!item.isRead) ...[
                  const SizedBox(width: 8),
                  Container(
                    width: 7,
                    height: 7,
                    decoration: const BoxDecoration(
                      color: AppColors.gold,
                      shape: BoxShape.circle,
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}
