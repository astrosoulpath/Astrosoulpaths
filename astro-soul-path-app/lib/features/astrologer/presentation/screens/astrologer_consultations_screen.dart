import 'dart:async';

import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../calling/presentation/screens/audio_call_screen.dart';
import '../../../chat/presentation/screens/chat_screen.dart';
import '../../data/astrologer_consultations_api.dart';
import '../../../calling/presentation/screens/video_call_screen.dart';

class AstrologerConsultationsScreen extends StatefulWidget {
  const AstrologerConsultationsScreen({super.key});

  @override
  State<AstrologerConsultationsScreen> createState() =>
      _AstrologerConsultationsScreenState();
}

class _AstrologerConsultationsScreenState
    extends State<AstrologerConsultationsScreen>
    with SingleTickerProviderStateMixin {
  final _api = AstrologerConsultationsApi();
  late final TabController _tabController;

  Timer? _pollTimer;
  bool _silentRefreshing = false;
  bool _loading = true;
  bool _actionRunning = false;
  String _error = '';

  List<_ConsultationItem> _current = const [];
  List<_ConsultationItem> _history = const [];

  @override
  void initState() {
    super.initState();

    _tabController = TabController(length: 2, vsync: this);

    _load();

    _pollTimer = Timer.periodic(
      const Duration(seconds: 3),
      (_) => _refreshSilently(),
    );
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _tabController.dispose();
    _api.close();
    super.dispose();
  }

  Future<void> _load() async {
    if (mounted) {
      setState(() {
        _loading = true;
        _error = '';
      });
    }

    try {
      final responses = await Future.wait([
        _api.getCurrent(),
        _api.getHistory(),
      ]);

      final current = _extractItems(responses[0]);
      final history = _extractItems(responses[1]);

      if (!mounted) {
        return;
      }

      setState(() {
        _current = current;
        _history = history;
      });
    } on AstrologerConsultationsApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = error.message;
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  Future<void> _refreshSilently() async {
    if (!mounted || _silentRefreshing || _actionRunning) {
      return;
    }

    final route = ModalRoute.of(context);

    if (route != null && !route.isCurrent) {
      return;
    }

    _silentRefreshing = true;

    try {
      final response = await _api.getCurrent();
      final current = _extractItems(response);

      if (!mounted) {
        return;
      }

      setState(() {
        _current = current;
      });
    } on AstrologerConsultationsApiException {
      // Background polling keeps the last successful state.
      // Manual refresh still displays API errors.
    } finally {
      _silentRefreshing = false;
    }
  }

  List<_ConsultationItem> _extractItems(Map<String, dynamic> response) {
    final data = response['data'];

    final maps = <Map<String, dynamic>>[];

    void collect(dynamic source) {
      if (source is List) {
        for (final item in source) {
          if (item is Map) {
            maps.add(Map<String, dynamic>.from(item));
          }
        }

        return;
      }

      if (source is Map) {
        final map = Map<String, dynamic>.from(source);

        const likelyKeys = [
          'consultations',
          'calls',
          'items',
          'results',
          'current',
          'history',
          'data',
        ];

        var nestedFound = false;

        for (final key in likelyKeys) {
          final nested = map[key];

          if (nested is List) {
            nestedFound = true;
            collect(nested);
          }
        }

        if (!nestedFound &&
            (map.containsKey('id') || map.containsKey('callSessionId'))) {
          maps.add(map);
        }
      }
    }

    collect(data);

    return maps
        .map(_ConsultationItem.fromJson)
        .where((item) => item.id.isNotEmpty)
        .toList();
  }

  Future<void> _accept(_ConsultationItem item) async {
    if (_actionRunning) {
      return;
    }

    setState(() {
      _actionRunning = true;
    });

    try {
      final response = await _api.accept(item.id);

      if (!mounted) {
        return;
      }

      final data = response['data'];

      String chatId = item.callSessionId;

      if (data is Map) {
        final result = Map<String, dynamic>.from(data);
        final call = result['call'];

        if (call is Map) {
          final callMap = Map<String, dynamic>.from(call);

          chatId =
              callMap['callSessionId']?.toString().trim() ??
              callMap['id']?.toString().trim() ??
              chatId;
        }
      }

      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          SnackBar(
            content: Text(
              response['message']?.toString() ?? 'Consultation accepted.',
            ),
            backgroundColor: Colors.green.shade700,
          ),
        );

      await _load();

      if (!mounted || chatId.trim().isEmpty) {
        return;
      }

      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) {
            final normalizedType = item.type.trim().toUpperCase();

            if (normalizedType.contains('VIDEO')) {
              return VideoCallScreen(
                callId: chatId,
                participantName: item.customerName,
              );
            }

            if (normalizedType.contains('AUDIO')) {
              return AudioCallScreen(
                callId: chatId,
                astrologerName: item.customerName,
              );
            }

            return ChatScreen(consultationId: chatId);
          },
        ),
      );

      await _load();
    } on AstrologerConsultationsApiException catch (error) {
      if (mounted) {
        _showError(error.message);
      }
    } finally {
      if (mounted) {
        setState(() {
          _actionRunning = false;
        });
      }
    }
  }

  Future<void> _reject(_ConsultationItem item) async {
    if (_actionRunning) {
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Reject consultation?'),
        content: const Text('This customer request will be rejected.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Reject'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) {
      return;
    }

    setState(() {
      _actionRunning = true;
    });

    try {
      final response = await _api.reject(item.id);

      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          SnackBar(
            content: Text(
              response['message']?.toString() ?? 'Consultation rejected.',
            ),
          ),
        );

      await _load();
    } on AstrologerConsultationsApiException catch (error) {
      if (mounted) {
        _showError(error.message);
      }
    } finally {
      if (mounted) {
        setState(() {
          _actionRunning = false;
        });
      }
    }
  }

  Future<void> _openConsultation(_ConsultationItem item) async {
    final sessionId = item.callSessionId.trim();

    if (sessionId.isEmpty) {
      _showError('This consultation does not have an active session yet.');
      return;
    }

    final normalizedType = item.type.trim().toUpperCase();
    final isVideo = normalizedType.contains('VIDEO');
    final isAudio = normalizedType.contains('AUDIO');

    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) {
          if (isVideo) {
            return VideoCallScreen(
              callId: sessionId,
              participantName: item.customerName,
            );
          }

          if (isAudio) {
            return AudioCallScreen(
              callId: sessionId,
              astrologerName: item.customerName,
            );
          }

          return ChatScreen(consultationId: sessionId);
        },
      ),
    );

    await _load();
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(
        SnackBar(content: Text(message), backgroundColor: Colors.red.shade700),
      );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.white,
        title: const Text(
          'Consultations',
          style: TextStyle(fontWeight: FontWeight.w900),
        ),
        actions: [
          IconButton(
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppColors.gold,
          labelColor: AppColors.gold,
          unselectedLabelColor: AppColors.muted,
          tabs: const [
            Tab(text: 'Current'),
            Tab(text: 'History'),
          ],
        ),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.gold),
            )
          : _error.isNotEmpty
          ? _errorView()
          : TabBarView(
              controller: _tabController,
              children: [
                _consultationList(_current, current: true),
                _consultationList(_history, current: false),
              ],
            ),
    );
  }

  Widget _errorView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.error_outline_rounded,
              color: AppColors.gold,
              size: 48,
            ),
            const SizedBox(height: 14),
            Text(
              _error,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.white),
            ),
            const SizedBox(height: 18),
            FilledButton(onPressed: _load, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }

  Widget _consultationList(
    List<_ConsultationItem> items, {
    required bool current,
  }) {
    if (items.isEmpty) {
      return RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            SizedBox(
              height: 440,
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.chat_bubble_outline_rounded,
                      color: AppColors.gold,
                      size: 50,
                    ),
                    const SizedBox(height: 14),
                    Text(
                      current
                          ? 'No consultation requests'
                          : 'No consultation history',
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      current
                          ? 'New customer requests will appear here.'
                          : 'Completed consultations will appear here.',
                      style: const TextStyle(color: AppColors.muted),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      );
    }

    final activeExists = current && items.any((item) => item.canChat);

    final pendingItems = current
        ? items.where((item) => item.canAccept).toList(growable: false)
        : const <_ConsultationItem>[];

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(14, 16, 14, 30),
        itemCount: items.length,
        itemBuilder: (_, index) {
          final item = items[index];

          final pendingIndex = item.canAccept
              ? pendingItems.indexWhere((pending) => pending.id == item.id)
              : -1;

          final queuePosition = pendingIndex >= 0 ? pendingIndex + 1 : null;

          final canAcceptNow =
              current && item.canAccept && queuePosition == 1 && !activeExists;

          return _ConsultationCard(
            item: item,
            busy: _actionRunning,
            queuePosition: queuePosition,
            waitingForActiveConsultation: item.canAccept && activeExists,
            onAccept: canAcceptNow ? () => _accept(item) : null,
            onReject: item.canReject ? () => _reject(item) : null,
            onChat: item.canChat ? () => _openConsultation(item) : null,
          );
        },
      ),
    );
  }
}

class _ConsultationItem {
  const _ConsultationItem({
    required this.id,
    required this.callSessionId,
    required this.customerName,
    required this.status,
    required this.type,
    required this.durationMinutes,
    required this.pricePerMinute,
    required this.startedAt,
    required this.createdAt,
    required this.expiresAt,
  });

  factory _ConsultationItem.fromJson(Map<String, dynamic> json) {
    final customer = _asMap(json['customer']);
    final directUser = _asMap(json['user']);
    final customerUser = _asMap(customer['user']);

    final profile = _asMap(
      customer['userProfile'] ??
          customerUser['userProfile'] ??
          directUser['userProfile'],
    );

    final id =
        json['id']?.toString().trim() ??
        json['consultationId']?.toString().trim() ??
        json['callSessionId']?.toString().trim() ??
        '';

    final callSessionId = json['callSessionId']?.toString().trim() ?? id;

    final name =
        profile['fullName']?.toString().trim() ??
        customer['name']?.toString().trim() ??
        customerUser['name']?.toString().trim() ??
        directUser['name']?.toString().trim() ??
        json['customerName']?.toString().trim() ??
        'Customer';

    return _ConsultationItem(
      id: id,
      callSessionId: callSessionId,
      customerName: name.isEmpty ? 'Customer' : name,
      status: json['status']?.toString().trim().toUpperCase() ?? 'UNKNOWN',
      type: _resolveConsultationMode(json),
      durationMinutes:
          (int.tryParse(
                (json['purchasedMinutes'] ??
                        json['durationMinutes'] ??
                        json['duration'] ??
                        0)
                    .toString(),
              ) ??
              0) +
          (int.tryParse((json['extendedMinutes'] ?? 0).toString()) ?? 0),
      pricePerMinute:
          double.tryParse(
            (json['ratePerMinute'] ??
                    json['pricePerMin'] ??
                    json['pricePerMinute'] ??
                    0)
                .toString(),
          ) ??
          0,
      startedAt: DateTime.tryParse(json['startedAt']?.toString() ?? ''),
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? ''),
      expiresAt: DateTime.tryParse(json['expiresAt']?.toString() ?? ''),
    );
  }

  final String id;
  final String callSessionId;
  final String customerName;
  final String status;
  final String type;
  final int durationMinutes;
  final double pricePerMinute;
  final DateTime? startedAt;

  final DateTime? createdAt;
  final DateTime? expiresAt;

  bool get canAccept =>
      status == 'PENDING' || status == 'REQUESTED' || status == 'WAITING';

  bool get canReject => canAccept;

  bool get canChat =>
      callSessionId.isNotEmpty &&
      (status == 'ACTIVE' || status == 'ACCEPTED' || status == 'ONGOING');
}

String _resolveConsultationMode(Map<String, dynamic> json) {
  final callSession = _asMap(json['callSession']);
  final session = _asMap(json['session']);
  final consultation = _asMap(json['consultation']);

  final candidates = <dynamic>[
    json['mode'],
    json['consultationMode'],
    json['consultationType'],
    json['callType'],
    json['type'],

    callSession['mode'],
    callSession['consultationMode'],
    callSession['consultationType'],
    callSession['callType'],
    callSession['type'],

    session['mode'],
    session['consultationMode'],
    session['consultationType'],
    session['callType'],
    session['type'],

    consultation['mode'],
    consultation['consultationMode'],
    consultation['consultationType'],
    consultation['callType'],
    consultation['type'],
  ];

  for (final candidate in candidates) {
    final value = candidate?.toString().trim().toUpperCase() ?? '';

    if (value.contains('VIDEO')) {
      return 'VIDEO';
    }

    if (value.contains('AUDIO') || value.contains('CALL')) {
      return 'AUDIO';
    }

    if (value.contains('CHAT')) {
      return 'CHAT';
    }
  }

  return 'CHAT';
}

Map<String, dynamic> _asMap(dynamic value) {
  if (value is Map<String, dynamic>) {
    return value;
  }

  if (value is Map) {
    return Map<String, dynamic>.from(value);
  }

  return <String, dynamic>{};
}

class _ConsultationCard extends StatelessWidget {
  const _ConsultationCard({
    required this.item,
    required this.busy,
    this.queuePosition,
    this.waitingForActiveConsultation = false,
    this.onAccept,
    this.onReject,
    this.onChat,
  });

  final _ConsultationItem item;
  final bool busy;
  final int? queuePosition;
  final bool waitingForActiveConsultation;
  final VoidCallback? onAccept;
  final VoidCallback? onReject;
  final VoidCallback? onChat;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0x22FFFFFF)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const CircleAvatar(
                radius: 23,
                backgroundColor: Color(0x18F4C45E),
                child: Icon(
                  Icons.person_outline_rounded,
                  color: AppColors.gold,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.customerName,
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${item.type} \u2022 ${item.status}',
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              _StatusChip(status: item.status),
            ],
          ),

          if (queuePosition != null) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0x12F4C45E),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0x28F4C45E)),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.people_alt_outlined,
                    color: AppColors.gold,
                    size: 18,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      waitingForActiveConsultation
                          ? 'Queue #$queuePosition \u2022 Current consultation in progress'
                          : queuePosition == 1
                          ? 'Incoming consultation \u2022 Next request'
                          : 'Queue #$queuePosition \u2022 Waiting for earlier request',
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: 15),

          Row(
            children: [
              Expanded(
                child: _Info(
                  icon: Icons.schedule_rounded,
                  value: item.durationMinutes > 0
                      ? '${item.durationMinutes} min'
                      : '--',
                ),
              ),
              Expanded(
                child: _Info(
                  icon: Icons.currency_rupee_rounded,
                  value: item.pricePerMinute > 0
                      ? '\u20B9${item.pricePerMinute.toStringAsFixed(0)}/min'
                      : '--',
                ),
              ),
            ],
          ),

          if (onAccept != null || onReject != null || onChat != null) ...[
            const SizedBox(height: 16),
            Row(
              children: [
                if (onReject != null)
                  Expanded(
                    child: OutlinedButton(
                      onPressed: busy ? null : onReject,
                      child: const Text('Reject'),
                    ),
                  ),

                if (onReject != null && onAccept != null)
                  const SizedBox(width: 10),

                if (onAccept != null)
                  Expanded(
                    child: FilledButton(
                      onPressed: busy ? null : onAccept,
                      child: const Text('Accept'),
                    ),
                  ),

                if (onChat != null)
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: busy ? null : onChat,
                      icon: const Icon(Icons.chat_bubble_outline_rounded),
                      label: const Text('Open Chat'),
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _Info extends StatelessWidget {
  const _Info({required this.icon, required this.value});

  final IconData icon;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: AppColors.gold, size: 18),
        const SizedBox(width: 6),
        Flexible(
          child: Text(
            value,
            style: const TextStyle(
              color: AppColors.white,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0x18F4C45E),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        status,
        style: const TextStyle(
          color: AppColors.gold,
          fontSize: 10,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}
