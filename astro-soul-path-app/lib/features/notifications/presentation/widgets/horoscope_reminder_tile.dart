import 'dart:async';
import 'package:flutter/material.dart';
import '../../../../core/notifications/horoscope_notification_preferences.dart';
import '../../../../core/notifications/notification_service.dart';
import '../../../auth/data/auth_session_store.dart';
import '../../../subscription/presentation/screens/subscription_plans_screen.dart';

class HoroscopeReminderTile extends StatefulWidget {
  const HoroscopeReminderTile({
    super.key,
    this.load,
    this.save,
    this.authorize,
    this.permission,
    this.openSubscription,
  });
  final Future<HoroscopeNotificationPreference> Function()? load;
  final Future<HoroscopeNotificationPreference> Function(bool)? save;
  final Future<bool> Function()? authorize;
  final Future<bool> Function()? permission;
  final VoidCallback? openSubscription;
  @override
  State<HoroscopeReminderTile> createState() => _HoroscopeReminderTileState();
}

class _HoroscopeReminderTileState extends State<HoroscopeReminderTile>
    with WidgetsBindingObserver {
  final _api = HoroscopeNotificationPreferences();
  HoroscopeNotificationPreference? _preference;
  bool _busy = true;
  bool _permission = false;
  String? _error;
  Timer? _expiry;
  Timer? _identityWatch;
  final _epoch = AuthSessionStore.sessionRevision;

  void _watchExpiry(HoroscopeNotificationPreference preference) {
    _expiry?.cancel();
    final end = preference.expiresAt;
    if (end == null || !preference.eligible) return;
    final remaining = end.difference(DateTime.now());
    _expiry = Timer(remaining.isNegative ? Duration.zero : remaining, () {
      if (mounted) _load();
    });
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
    _identityWatch = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted && _epoch != AuthSessionStore.sessionRevision) {
        _expiry?.cancel();
        _identityWatch?.cancel();
        setState(() {
          _preference = null;
          _busy = false;
          _error = 'Account changed. Reopen notifications.';
        });
      }
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && !_busy) {
      _load();
    }
  }

  Future<void> _load() async {
    if (_epoch != AuthSessionStore.sessionRevision) return;
    final revision = AuthSessionStore.sessionRevision;
    if (mounted) {
      setState(() {
        _busy = true;
        _preference = null;
      });
    }
    try {
      final result = await (widget.load ?? _api.load)();
      final granted =
          result.available &&
          await (widget.permission ??
              NotificationService
                  .instance
                  .horoscopeNotificationPermissionGranted)();
      if (revision != AuthSessionStore.sessionRevision) {
        throw StateError('Session changed');
      }
      if (mounted) {
        setState(() {
          _preference = result;
          _permission = granted;
          _busy = false;
          _error = null;
        });
        _watchExpiry(result);
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _preference = null;
          _busy = false;
          _error = 'Reminder settings unavailable. Reopen to retry.';
        });
      }
    }
  }

  Future<void> _change(bool enabled) async {
    if (_busy || _epoch != AuthSessionStore.sessionRevision) return;
    final revision = AuthSessionStore.sessionRevision;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      if (enabled &&
          !await (widget.authorize ??
              NotificationService.instance.authorizeHoroscopeReminders)()) {
        if (mounted) {
          setState(
            () => _error =
                'Allow notifications in device Settings to enable reminders.',
          );
        }
        return;
      }
      if (!mounted || revision != AuthSessionStore.sessionRevision) return;
      final result = await (widget.save ?? _api.save)(enabled);
      if (mounted && revision == AuthSessionStore.sessionRevision) {
        setState(() {
          _preference = result;
          if (enabled) _permission = true;
        });
        _watchExpiry(result);
      }
    } catch (_) {
      if (mounted) {
        setState(
          () => _error =
              'Reminder preference was not confirmed. Reopen to retry.',
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
          if (revision != AuthSessionStore.sessionRevision) _preference = null;
        });
      }
    }
  }

  @override
  void dispose() {
    _expiry?.cancel();
    _identityWatch?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    _api.close();
    super.dispose();
  }

  bool get _blocked =>
      _preference?.available != true || _preference?.eligible != true;

  String get _blockedReason {
    if (_error != null) {
      return 'Reminder settings could not be confirmed. Check your connection and sign-in, then check status again.';
    }
    final preference = _preference;
    if (preference?.available == false) {
      return 'The server has not activated horoscope reminders. The operator must verify the required database migration and approve reminder rollout. An existing valid subscription does not require another payment to resolve this.';
    }
    if (preference?.subscriptionStatus == 'NONE') {
      return 'No active personalized horoscope subscription was confirmed. View your subscription options to unlock reminders.';
    }
    if (preference?.subscriptionStatus == 'EXPIRED') {
      return 'Your personalized horoscope subscription has expired. View its status and renewal options.';
    }
    return 'The server has not confirmed an eligible personalized horoscope subscription. Check status again or contact support; do not purchase again solely to resolve this message.';
  }

  Future<void> _explainBlocker() async {
    if (_busy || _epoch != AuthSessionStore.sessionRevision) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => SafeArea(
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Why reminders are unavailable',
                  style: Theme.of(sheetContext).textTheme.titleLarge,
                ),
                const SizedBox(height: 12),
                Text(_blockedReason),
                const SizedBox(height: 16),
                if (_preference?.subscriptionStatus == 'NONE' ||
                    _preference?.subscriptionStatus == 'EXPIRED')
                  TextButton(
                    onPressed: () {
                      Navigator.pop(sheetContext);
                      _openSubscription();
                    },
                    child: const Text('View Horoscope subscription'),
                  ),
                TextButton(
                  onPressed: () {
                    Navigator.pop(sheetContext);
                    _load();
                  },
                  child: const Text('Check status again'),
                ),
                TextButton(
                  onPressed: () => Navigator.pop(sheetContext),
                  child: const Text('Close'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _openSubscription() async {
    if (!mounted || _epoch != AuthSessionStore.sessionRevision) return;
    if (widget.openSubscription != null) {
      widget.openSubscription!();
      return;
    }
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => const SubscriptionPlansScreen(
          audience: SubscriptionAudience.customer,
        ),
      ),
    );
    if (mounted) await _load();
  }

  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: !_busy && _blocked ? _explainBlocker : null,
        child: SwitchListTile(
          title: Text(_title),
          value:
              (_preference?.enabled ?? false) &&
              (_preference?.eligible ?? false) &&
              _permission,
          onChanged:
              _busy ||
                  _preference?.available != true ||
                  _preference?.eligible != true
              ? null
              : _change,
        ),
      ),
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _error ??
                  (_busy
                      ? 'Loading reminder settings...'
                      : _preference?.available == false
                      ? 'Reminders are not activated yet.'
                      : _preference?.deliveryReady == false
                      ? 'Reminder delivery is paused. Your saved choice is preserved.'
                      : 'Optional. Uses your selected horoscope language and requires an active subscription. Device notification settings also apply.'),
            ),
            if (!_busy && _blocked)
              TextButton(
                onPressed: _explainBlocker,
                child: const Text('Check reminder availability'),
              ),
            if (_preference?.enabled == true &&
                (!_permission || _preference?.eligible != true))
              TextButton(
                onPressed: _busy ? null : () => _change(false),
                child: const Text('Turn reminders off'),
              ),
          ],
        ),
      ),
    ],
  );

  String get _title {
    final preference = _preference;
    if (preference == null || !preference.available) {
      return 'Daily horoscope reminders';
    }
    if (preference.subscriptionStatus == 'EXPIRED') {
      return 'Renew Horoscope Subscription';
    }
    if (preference.subscriptionStatus == 'NONE') {
      return 'Unlock Daily Horoscope';
    }
    if (!preference.eligible) return 'Daily Horoscope Reminders Unavailable';
    if (!_permission) return 'Enable Notification Permission';
    if (!preference.enabled) return 'Daily Horoscope Reminders Off';
    if (!preference.deliveryReady) return 'Daily Horoscope Reminders Paused';
    return 'Daily Horoscope Reminders Active';
  }
}
