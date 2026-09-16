import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../auth/data/auth_session_store.dart';
import '../../data/astrologer_portal_api.dart';

class AstrologerAvailabilityScreen extends StatefulWidget {
  const AstrologerAvailabilityScreen({super.key});

  @override
  State<AstrologerAvailabilityScreen> createState() =>
      _AstrologerAvailabilityScreenState();
}

class _AstrologerAvailabilityScreenState
    extends State<AstrologerAvailabilityScreen> {
  final _api = AstrologerPortalApi();
  final _sessionStore = AuthSessionStore();

  static const _dayNames = <String>[
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];

  bool _loading = true;
  bool _saving = false;
  bool _statusUpdating = false;
  bool _isOnline = false;

  String _timezone = 'Asia/Kolkata';
  String _error = '';

  late List<_AvailabilityDay> _days;

  @override
  void initState() {
    super.initState();

    _days = List.generate(
      7,
      (index) => _AvailabilityDay(
        dayOfWeek: index,
        isEnabled: index >= 1 && index <= 6,
        startTime: '09:00',
        endTime: '21:00',
      ),
    );

    _load();
  }

  @override
  void dispose() {
    _api.close();
    super.dispose();
  }

  Future<String> _token() async {
    final session = await _sessionStore.read();
    return session?.accessToken.trim() ?? '';
  }

  Map<String, dynamic> _data(Map<String, dynamic> response) {
    final data = response['data'];

    if (data is Map<String, dynamic>) {
      return data;
    }

    if (data is Map) {
      return Map<String, dynamic>.from(data);
    }

    return response;
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = '';
    });

    try {
      final token = await _token();

      if (token.isEmpty) {
        throw const AstrologerPortalApiException(
          'Login session not found. Please login again.',
        );
      }

      final response = await _api.getAvailability(accessToken: token);

      final data = _data(response);

      final serverDays = data['days'];

      if (serverDays is List && serverDays.isNotEmpty) {
        final mapped = <int, _AvailabilityDay>{};

        for (final item in serverDays) {
          if (item is! Map) {
            continue;
          }

          final json = Map<String, dynamic>.from(item);

          final dayOfWeek = int.tryParse(json['dayOfWeek']?.toString() ?? '');

          if (dayOfWeek == null || dayOfWeek < 0 || dayOfWeek > 6) {
            continue;
          }

          mapped[dayOfWeek] = _AvailabilityDay(
            dayOfWeek: dayOfWeek,
            isEnabled: json['isEnabled'] == true,
            startTime: json['startTime']?.toString().trim().isNotEmpty == true
                ? json['startTime'].toString()
                : '09:00',
            endTime: json['endTime']?.toString().trim().isNotEmpty == true
                ? json['endTime'].toString()
                : '21:00',
          );
        }

        _days = List.generate(
          7,
          (index) =>
              mapped[index] ??
              _AvailabilityDay(
                dayOfWeek: index,
                isEnabled: false,
                startTime: '09:00',
                endTime: '21:00',
              ),
        );
      }

      if (!mounted) {
        return;
      }

      setState(() {
        _isOnline = data['isOnline'] == true;

        final serverTimezone = data['timezone']?.toString().trim();

        if (serverTimezone != null && serverTimezone.isNotEmpty) {
          _timezone = serverTimezone;
        }
      });
    } on AstrologerPortalApiException catch (error) {
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

  Future<void> _toggleOnline(bool value) async {
    if (_statusUpdating) {
      return;
    }

    final previous = _isOnline;

    setState(() {
      _statusUpdating = true;
      _isOnline = value;
    });

    try {
      final token = await _token();

      await _api.updateStatus(accessToken: token, isOnline: value);
    } on AstrologerPortalApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _isOnline = previous;
      });

      _showError(error.message);
    } finally {
      if (mounted) {
        setState(() {
          _statusUpdating = false;
        });
      }
    }
  }

  Future<void> _pickTime({required int index, required bool start}) async {
    final source = start ? _days[index].startTime : _days[index].endTime;

    final parts = source.split(':');

    final initialTime = TimeOfDay(
      hour: int.tryParse(parts.first) ?? 9,
      minute: parts.length > 1 ? int.tryParse(parts[1]) ?? 0 : 0,
    );

    final selected = await showTimePicker(
      context: context,
      initialTime: initialTime,
    );

    if (selected == null || !mounted) {
      return;
    }

    final formatted =
        '${selected.hour.toString().padLeft(2, '0')}:'
        '${selected.minute.toString().padLeft(2, '0')}';

    setState(() {
      final current = _days[index];

      _days[index] = current.copyWith(
        startTime: start ? formatted : current.startTime,
        endTime: start ? current.endTime : formatted,
      );
    });
  }

  Future<void> _save() async {
    if (_saving) {
      return;
    }

    for (final day in _days) {
      if (day.isEnabled && day.startTime.compareTo(day.endTime) >= 0) {
        _showError(
          '${_dayNames[day.dayOfWeek]} start time must be before end time.',
        );
        return;
      }
    }

    setState(() {
      _saving = true;
    });

    try {
      final token = await _token();

      final response = await _api.updateAvailability(
        accessToken: token,
        timezone: _timezone,
        days: _days
            .map(
              (day) => {
                'dayOfWeek': day.dayOfWeek,
                'isEnabled': day.isEnabled,
                'startTime': day.startTime,
                'endTime': day.endTime,
              },
            )
            .toList(),
      );

      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          SnackBar(
            content: Text(
              response['message']?.toString() ??
                  'Availability updated successfully.',
            ),
            backgroundColor: Colors.green.shade700,
          ),
        );

      await _load();
    } on AstrologerPortalApiException catch (error) {
      if (!mounted) {
        return;
      }

      _showError(error.message);
    } finally {
      if (mounted) {
        setState(() {
          _saving = false;
        });
      }
    }
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
          'Availability',
          style: TextStyle(fontWeight: FontWeight.w900),
        ),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.gold),
            )
          : _error.isNotEmpty
          ? _errorView()
          : _body(),
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
              size: 46,
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

  Widget _body() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 32),
      children: [
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: const Color(0x44F4C45E)),
          ),
          child: Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: _isOnline
                      ? const Color(0x2232CD32)
                      : const Color(0x22F4C45E),
                ),
                child: Icon(
                  _isOnline ? Icons.circle : Icons.circle_outlined,
                  color: _isOnline ? Colors.greenAccent : AppColors.gold,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _isOnline ? 'You are Online' : 'You are Offline',
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Customers can request consultations only when you are available.',
                      style: TextStyle(color: AppColors.muted, fontSize: 12),
                    ),
                  ],
                ),
              ),
              if (_statusUpdating)
                const SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: AppColors.gold,
                  ),
                )
              else
                Switch(value: _isOnline, onChanged: _toggleOnline),
            ],
          ),
        ),

        const SizedBox(height: 18),

        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(18),
          ),
          child: Row(
            children: [
              const Icon(Icons.public_rounded, color: AppColors.gold),
              const SizedBox(width: 12),
              const Expanded(
                child: Text(
                  'Timezone',
                  style: TextStyle(
                    color: AppColors.white,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              Text(_timezone, style: const TextStyle(color: AppColors.muted)),
            ],
          ),
        ),

        const SizedBox(height: 22),

        const Text(
          'Weekly schedule',
          style: TextStyle(
            color: AppColors.white,
            fontSize: 20,
            fontWeight: FontWeight.w900,
          ),
        ),

        const SizedBox(height: 6),

        const Text(
          'Set the hours when you normally accept consultations.',
          style: TextStyle(color: AppColors.muted),
        ),

        const SizedBox(height: 14),

        ...List.generate(_days.length, (index) => _dayCard(index)),

        const SizedBox(height: 12),

        SizedBox(
          height: 54,
          child: FilledButton.icon(
            onPressed: _saving ? null : _save,
            icon: _saving
                ? const SizedBox(
                    width: 19,
                    height: 19,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.save_outlined),
            label: Text(
              _saving ? 'Saving availability...' : 'Save Availability',
            ),
          ),
        ),
      ],
    );
  }

  Widget _dayCard(int index) {
    final day = _days[index];

    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: day.isEnabled
              ? AppColors.gold.withValues(alpha: 0.28)
              : AppColors.muted.withValues(alpha: 0.10),
        ),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: day.isEnabled
                      ? AppColors.gold.withValues(alpha: 0.10)
                      : AppColors.muted.withValues(alpha: 0.06),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  day.isEnabled
                      ? Icons.calendar_today_rounded
                      : Icons.event_busy_outlined,
                  color: day.isEnabled ? AppColors.gold : AppColors.muted,
                  size: 19,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _dayNames[day.dayOfWeek],
                      style: TextStyle(
                        color: day.isEnabled
                            ? AppColors.white
                            : AppColors.muted,
                        fontSize: 15,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      day.isEnabled
                          ? '${day.startTime} - ${day.endTime}'
                          : 'Not available',
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
              Switch(
                value: day.isEnabled,
                onChanged: (value) {
                  setState(() {
                    _days[index] = day.copyWith(isEnabled: value);
                  });
                },
              ),
            ],
          ),
          if (day.isEnabled) ...[
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: _timeButton(
                    label: 'Start',
                    value: day.startTime,
                    onTap: () => _pickTime(index: index, start: true),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _timeButton(
                    label: 'End',
                    value: day.endTime,
                    onTap: () => _pickTime(index: index, start: false),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _timeButton({
    required String label,
    required String value,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(15),
        child: Ink(
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 12),
          decoration: BoxDecoration(
            color: AppColors.background.withValues(alpha: 0.42),
            borderRadius: BorderRadius.circular(15),
            border: Border.all(color: AppColors.gold.withValues(alpha: 0.14)),
          ),
          child: Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: AppColors.gold.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(
                  Icons.schedule_rounded,
                  color: AppColors.gold,
                  size: 17,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      value,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(
                Icons.keyboard_arrow_down_rounded,
                color: AppColors.muted,
                size: 18,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AvailabilityDay {
  const _AvailabilityDay({
    required this.dayOfWeek,
    required this.isEnabled,
    required this.startTime,
    required this.endTime,
  });

  final int dayOfWeek;
  final bool isEnabled;
  final String startTime;
  final String endTime;

  _AvailabilityDay copyWith({
    bool? isEnabled,
    String? startTime,
    String? endTime,
  }) {
    return _AvailabilityDay(
      dayOfWeek: dayOfWeek,
      isEnabled: isEnabled ?? this.isEnabled,
      startTime: startTime ?? this.startTime,
      endTime: endTime ?? this.endTime,
    );
  }
}
