import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../astrology_questions/presentation/screens/astrology_questions_screen.dart';
import '../../../category_ai/presentation/screens/category_ai_chat_screen.dart';
import '../../../chat/presentation/screens/chat_screen.dart';
import '../../../consultations/presentation/screens/consultation_history_screen.dart';
import '../../../horoscope/presentation/screens/daily_horoscope_screen.dart';
import '../../../kundli/presentation/screens/customer_kundli_screen.dart';
import '../../data/app_notification.dart';
import '../../data/notifications_api.dart';

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

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
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
        _loading = false;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = 'Notifications could not be loaded.';
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
      case 'horoscope':
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
      case 'astrology_question':
        await Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => const AstrologyQuestionsScreen(),
          ),
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
        backgroundColor: AppColors.background,
        elevation: 0,
        title: const Text(
          'Notifications',
          style: TextStyle(color: AppColors.white, fontWeight: FontWeight.w900),
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
      body: RefreshIndicator(
        color: AppColors.gold,
        onRefresh: _load,
        child: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
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
          const Icon(
            Icons.notifications_none_rounded,
            color: AppColors.muted,
            size: 52,
          ),
          const SizedBox(height: 14),
          Text(
            _error!,
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.muted),
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

    if (_items.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [
          SizedBox(height: 160),
          Icon(
            Icons.notifications_none_rounded,
            color: AppColors.muted,
            size: 58,
          ),
          SizedBox(height: 14),
          Text(
            'No notifications yet',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppColors.white,
              fontSize: 18,
              fontWeight: FontWeight.w800,
            ),
          ),
          SizedBox(height: 6),
          Text(
            'Your important updates will appear here.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.muted, fontSize: 13),
          ),
        ],
      );
    }

    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 24),
      itemCount: _items.length,
      separatorBuilder: (_, _) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final item = _items[index];

        return InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: () => _openNotification(item),
          child: Container(
            padding: const EdgeInsets.all(15),
            decoration: BoxDecoration(
              color: item.isRead ? AppColors.surface : AppColors.surfaceLight,
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
                                color: AppColors.white,
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
                            style: const TextStyle(
                              color: AppColors.muted,
                              fontSize: 10,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 5),
                      Text(
                        item.body,
                        style: const TextStyle(
                          color: AppColors.muted,
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
