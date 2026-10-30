import 'dart:async';
import 'package:flutter/material.dart';
import '../../../../core/notifications/notification_service.dart';
import '../../../../core/widgets/golden_sparkle_loading.dart';
import '../../../auth/data/auth_session_store.dart';
import '../../../subscription/presentation/screens/subscription_plans_screen.dart';
import '../../data/notifications_api.dart';

class SubscriptionNotificationsBell extends StatefulWidget {
  const SubscriptionNotificationsBell({super.key, required this.audience});
  final SubscriptionAudience audience;
  @override
  State<SubscriptionNotificationsBell> createState() =>
      _SubscriptionNotificationsBellState();
}

class _SubscriptionNotificationsBellState
    extends State<SubscriptionNotificationsBell> {
  final _api = NotificationsApi();
  final _revision = AuthSessionStore.sessionRevision;
  int? _unread;
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await _api.subscriptionReminders();
      if (mounted && _revision == AuthSessionStore.sessionRevision) {
        setState(() => _unread = data['unreadCount'] as int);
      }
    } catch (_) {
      /* An unavailable count is never replaced with a fabricated value. */
    }
  }

  @override
  void dispose() {
    _api.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => IconButton(
    tooltip: _unread == null
        ? 'Subscription notifications'
        : 'Subscription notifications, $_unread unread',
    icon: Badge(
      isLabelVisible: (_unread ?? 0) > 0,
      label: Text((_unread ?? 0).toString()),
      child: const Icon(Icons.notifications_outlined),
    ),
    onPressed: () async {
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) =>
              SubscriptionNotificationsScreen(audience: widget.audience),
        ),
      );
      if (mounted && _revision == AuthSessionStore.sessionRevision) {
        await _load();
      }
    },
  );
}

class SubscriptionNotificationsScreen extends StatefulWidget {
  const SubscriptionNotificationsScreen({super.key, required this.audience});
  final SubscriptionAudience audience;
  @override
  State<SubscriptionNotificationsScreen> createState() =>
      _SubscriptionNotificationsScreenState();
}

class _SubscriptionNotificationsScreenState
    extends State<SubscriptionNotificationsScreen>
    with WidgetsBindingObserver {
  final _api = NotificationsApi();
  final _revision = AuthSessionStore.sessionRevision;
  Timer? _clock;
  final _elapsed = Stopwatch();
  DateTime? _serverClock;
  int _lastMinute = 0;
  Map<String, dynamic>? _data;
  String? _error;
  bool _busy = false;
  bool get _current => mounted && _revision == AuthSessionStore.sessionRevision;
  String get _role => widget.audience == SubscriptionAudience.customer
      ? 'CUSTOMER'
      : 'ASTROLOGER';
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
    _clock = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      if (!_current) {
        setState(() {
          _data = null;
          _error = 'Account changed. Reopen notifications.';
        });
        _clock?.cancel();
      } else if (_data != null &&
          _serverClock != null &&
          _elapsed.elapsed.inMinutes != _lastMinute) {
        _lastMinute = _elapsed.elapsed.inMinutes;
        setState(
          () => _data!['serverNow'] = _serverClock!
              .add(_elapsed.elapsed)
              .toIso8601String(),
        );
      }
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _clock?.cancel();
    _elapsed.stop();
    _api.close();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _current && !_busy) {
      _load();
    }
  }

  Future<void> _load() async {
    if (!_current || _busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final data = await _api.subscriptionReminders();
      if (!_current) return;
      if (data['roleContext'] != _role) {
        throw StateError('Subscription role does not match this portal.');
      }
      _serverClock = DateTime.tryParse(data['serverNow']?.toString() ?? '');
      _elapsed.reset();
      _elapsed.start();
      _lastMinute = 0;
      setState(() => _data = data);
    } catch (_) {
      if (_current) {
        setState(() {
          _data = null;
          _error =
              'Unable to load subscription reminders. Check your connection and retry.';
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _preference(bool enabled) async {
    if (_busy || !_current) return;
    setState(() => _busy = true);
    var saved = false;
    try {
      if (enabled &&
          !await NotificationService.instance.authorizeHoroscopeReminders()) {
        throw StateError('Phone notification permission is required.');
      }
      if (!_current) return;
      final preference = _data?['preference'] as Map?;
      await _api.subscriptionPreference(
        enabled: enabled,
        timezone: preference?['timezone']?.toString() ?? 'UTC',
        quietStart: preference?['quietStart'] as int? ?? 22,
        quietEnd: preference?['quietEnd'] as int? ?? 8,
      );
      saved = true;
    } catch (_) {
      if (_current) {
        setState(
          () => _error =
              'Preference was not saved. Check phone permission and connection.',
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
    if (saved) await _load();
  }

  @override
  Widget build(BuildContext context) {
    final data = _current ? _data : null;
    final reminders = (data?['reminders'] as List? ?? []).whereType<Map>();
    final preference = data?['preference'] as Map?;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Subscription notifications'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _busy ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: GoldenSparkleLoading(
        loading: _busy,
        child: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (_error != null) Text(_error!, semanticsLabel: _error),
              if (data != null) ...[
                SubscriptionExpiryCard(
                  data: data,
                  onRenew: _busy
                      ? null
                      : () async {
                          await Navigator.of(context).push(
                            MaterialPageRoute<void>(
                              builder: (_) => SubscriptionPlansScreen(
                                audience: widget.audience,
                              ),
                            ),
                          );
                          if (_current) await _load();
                        },
                ),
                SwitchListTile.adaptive(
                  title: const Text('Phone expiry reminders'),
                  subtitle: Text(
                    'Quiet hours ${preference?['quietStart'] ?? 22}:00–${preference?['quietEnd'] ?? 8}:00 (${preference?['timezone'] ?? 'UTC'}). Phone permission is also required.',
                  ),
                  value: preference?['pushEnabled'] == true,
                  onChanged: _busy || data['schemaReady'] != true
                      ? null
                      : _preference,
                ),
                if (data['schemaReady'] != true)
                  const Text(
                    'Reminder storage is awaiting activation. Subscription payments are unchanged.',
                  ),
                Text(
                  'History · ${data['unreadCount']} unread',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                if (reminders.isEmpty)
                  const Padding(
                    padding: EdgeInsets.all(24),
                    child: Text('No subscription reminders yet.'),
                  ),
                for (final reminder in reminders)
                  ListTile(
                    leading: Icon(
                      reminder['readAt'] == null
                          ? Icons.notifications_active_outlined
                          : Icons.notifications_none,
                    ),
                    title: Text(reminder['title']?.toString() ?? ''),
                    subtitle: Text(reminder['body']?.toString() ?? ''),
                    onTap: _busy
                        ? null
                        : () async {
                            if (!_current) return;
                            try {
                              await _api.readSubscriptionReminder(
                                reminder['id'].toString(),
                              );
                              await _load();
                            } catch (_) {
                              if (_current) {
                                setState(
                                  () => _error =
                                      'Unable to mark reminder read. Please retry.',
                                );
                              }
                            }
                          },
                  ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Uses authoritative timestamps only; supports narrow layouts and text scaling.
class SubscriptionExpiryCard extends StatelessWidget {
  const SubscriptionExpiryCard({super.key, required this.data, this.onRenew});
  final Map<String, dynamic> data;
  final VoidCallback? onRenew;
  @override
  Widget build(BuildContext context) {
    final subscription = data['subscription'] as Map?;
    final product = data['product'] as Map?;
    final expiry = DateTime.tryParse(
      subscription?['expiresAt']?.toString() ?? '',
    );
    final start = DateTime.tryParse(
      subscription?['startDate']?.toString() ?? '',
    );
    final now = DateTime.tryParse(data['serverNow']?.toString() ?? '');
    final days = expiry != null && now != null
        ? (expiry.difference(now).inMilliseconds / 86400000).ceil().clamp(
            0,
            365,
          )
        : null;
    final progress =
        expiry != null && start != null && now != null && expiry.isAfter(start)
        ? (expiry.difference(now).inMilliseconds /
                  expiry.difference(start).inMilliseconds)
              .clamp(0.0, 1.0)
        : null;
    final customer = data['roleContext'] == 'CUSTOMER';
    return Card(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(22),
        side: const BorderSide(color: Color(0xffc6a45e)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.auto_awesome, color: Color(0xffb18b3f)),
            const SizedBox(height: 8),
            Text(
              product?['title']?.toString() ?? 'Subscription',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(subscription?['status']?.toString() ?? 'No subscription'),
            if (days != null)
              Text(days == 0 ? 'Period ended' : '$days days remaining'),
            if (expiry != null) Text('Expires ${expiry.toLocal()}'),
            if (progress != null)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: LinearProgressIndicator(
                  value: progress,
                  semanticsLabel: 'Subscription time remaining',
                ),
              ),
            if (subscription?['status'] == 'EXPIRED')
              Text(
                customer
                    ? 'Renew to resume personalized daily readings.'
                    : 'Renew to resume authorized Professional Kundli generation.',
              ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: onRenew,
              child: Text(
                customer
                    ? 'Renew for \$1'
                    : 'Renew Professional Kundli · ₹3,500',
              ),
            ),
            const Text(
              'No automatic charge. Payment must be verified before access is extended.',
            ),
          ],
        ),
      ),
    );
  }
}
