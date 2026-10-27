import 'package:flutter/material.dart';
import '../../data/notifications_api.dart';
import 'dart:async';
import '../../../../core/notifications/notification_session_fence.dart';

class NotificationReadingScreen extends StatefulWidget {
  const NotificationReadingScreen({
    super.key,
    required this.readingId,
    this.api,
    this.smartInsight = false,
  });
  final String readingId;
  final NotificationsApi? api;
  final bool smartInsight;
  @override
  State<NotificationReadingScreen> createState() => _ReadingState();
}

class _ReadingState extends State<NotificationReadingScreen>
    with WidgetsBindingObserver {
  late final _api = widget.api ?? NotificationsApi();
  Map<String, dynamic>? _reading;
  String? _error;
  int _revision = 0;
  Timer? _identityWatch;
  final _epoch = NotificationSessionFence.generation;
  bool _expired(Map<String, dynamic>? reading) {
    if (reading == null || !reading.containsKey('expiresAt')) return false;
    final expiry = DateTime.tryParse(reading['expiresAt']?.toString() ?? '');
    return expiry == null || !expiry.isAfter(DateTime.now());
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
    _identityWatch = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted &&
          (NotificationSessionFence.suspended ||
              _epoch != NotificationSessionFence.generation ||
              _expired(_reading))) {
        _revision++;
        setState(() {
          _reading = null;
          _error =
              'This reading is unavailable, expired or no longer authorized.';
        });
        if (NotificationSessionFence.suspended ||
            _epoch != NotificationSessionFence.generation) {
          _identityWatch?.cancel();
        }
      }
    });
  }

  @override
  void didUpdateWidget(covariant NotificationReadingScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.readingId != widget.readingId ||
        oldWidget.smartInsight != widget.smartInsight) {
      _load();
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _load();
    } else {
      _revision++;
      setState(() => _reading = null);
    }
  }

  Future<void> _load() async {
    final revision = ++_revision;
    setState(() {
      _reading = null;
      _error = null;
    });
    try {
      final reading = widget.smartInsight
          ? await _api.getInsight(widget.readingId)
          : await _api.getReading(widget.readingId);
      if (_expired(reading)) throw StateError('Reading expired');
      if (mounted && revision == _revision) {
        setState(() => _reading = reading);
        if (widget.smartInsight) {
          unawaited(
            _api.markInsightOpened(widget.readingId).catchError((_) {}),
          );
        }
      }
    } catch (_) {
      if (mounted && revision == _revision) {
        setState(
          () => _error =
              'This reading is unavailable, expired or no longer authorized.',
        );
      }
    }
  }

  @override
  void dispose() {
    _identityWatch?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    _api.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Your astrology reading')),
    body: _error != null
        ? Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(_error!),
                TextButton(onPressed: _load, child: const Text('Retry')),
              ],
            ),
          )
        : _reading == null
        ? const Center(child: CircularProgressIndicator())
        : Directionality(
            textDirection: _reading!['locale'] == 'ar'
                ? TextDirection.rtl
                : TextDirection.ltr,
            child: ListView(
              padding: const EdgeInsets.all(24),
              children: [
                Text(
                  _reading!['title']?.toString() ?? '',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                Text('${_reading!['date']} · ${_reading!['locale']}'),
                const SizedBox(height: 16),
                Text(_reading!['body']?.toString() ?? ''),
                const SizedBox(height: 16),
                Text(_reading!['advice']?.toString() ?? ''),
                const SizedBox(height: 24),
                Text(_reading!['interpretationNotice']?.toString() ?? ''),
              ],
            ),
          ),
  );
}
