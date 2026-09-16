import 'dart:async';

import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../chat/presentation/screens/chat_screen.dart';
import '../../../astrologers/data/public_astrologer.dart';
import '../../data/consultation_api.dart';
import '../../data/consultation_models.dart';

class ConsultationWaitingScreen extends StatefulWidget {
  const ConsultationWaitingScreen({
    required this.result,
    required this.astrologer,
    super.key,
  });

  final StartConsultationResult result;
  final PublicAstrologer astrologer;

  @override
  State<ConsultationWaitingScreen> createState() =>
      _ConsultationWaitingScreenState();
}

class _ConsultationWaitingScreenState extends State<ConsultationWaitingScreen> {
  final _api = ConsultationApi();

  late ConsultationSession _session;
  Timer? _timer;

  int _remainingSeconds = 0;
  int _ticks = 0;
  bool _requestInProgress = false;
  String _error = '';
  ConsultationQueuePosition? _queuePosition;

  String get _status => _session.status.toUpperCase();
  bool get _pending => _status == 'PENDING';
  bool get _active => _status == 'ACTIVE';

  @override
  void initState() {
    super.initState();

    _session = widget.result.session;
    _remainingSeconds = _secondsRemaining();

    _timer = Timer.periodic(const Duration(seconds: 1), (_) => _onTimerTick());

    _refreshStatus(); // Initial queue/status sync
  }

  @override
  void dispose() {
    _timer?.cancel();
    _api.close();
    super.dispose();
  }

  void _onTimerTick() {
    if (!mounted || !_pending) {
      return;
    }

    _ticks += 1;

    setState(() {
      _remainingSeconds = _secondsRemaining();
    });

    if (_remainingSeconds == 0 || _ticks % 3 == 0) {
      _refreshStatus(triggerExpiryCleanup: _remainingSeconds == 0);
    }
  }

  int _secondsRemaining() {
    final expiresAt = _session.expiresAt;

    if (expiresAt == null) {
      return 0;
    }

    final seconds = expiresAt
        .toUtc()
        .difference(DateTime.now().toUtc())
        .inSeconds;

    return seconds > 0 ? seconds : 0;
  }

  Future<void> _refreshStatus({bool triggerExpiryCleanup = false}) async {
    if (_requestInProgress) {
      return;
    }

    _requestInProgress = true;

    try {
      if (triggerExpiryCleanup) {
        await _api.getCurrentConsultation();
      }

      final session = await _api.getConsultationById(_session.id);

      ConsultationQueuePosition? queuePosition;

      if (session.status.toUpperCase() == 'PENDING') {
        try {
          queuePosition = await _api.getQueuePosition(session.id);
        } on ConsultationApiException {
          // Queue metadata must never break the core consultation status flow.
          queuePosition = _queuePosition;
        }
      }

      if (!mounted) {
        return;
      }

      setState(() {
        _session = session;
        _remainingSeconds = _secondsRemaining();
        _queuePosition = queuePosition;
        _error = '';
      });

      if (!_pending) {
        _timer?.cancel();
      }
    } on ConsultationApiException catch (error) {
      if (mounted) {
        setState(() {
          _error = error.message;
        });
      }
    } finally {
      _requestInProgress = false;
    }
  }

  Future<void> _cancel() async {
    if (!_pending || _requestInProgress) {
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Cancel consultation request?'),
        content: const Text('The reserved wallet amount will be released.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Keep Waiting'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Cancel Request'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) {
      return;
    }

    setState(() {
      _requestInProgress = true;
      _error = '';
    });

    try {
      final session = await _api.cancelConsultation(_session.id);

      if (!mounted) {
        return;
      }

      setState(() {
        _session = session;
      });

      _timer?.cancel();
    } on ConsultationApiException catch (error) {
      if (mounted) {
        setState(() {
          _error = error.message;
        });
      }
    } finally {
      _requestInProgress = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !_pending,
      child: Scaffold(
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        appBar: AppBar(
          automaticallyImplyLeading: !_pending,
          backgroundColor: AppColors.background,
          foregroundColor: AppColors.white,
          title: const Text(
            'Consultation Request',
            style: TextStyle(fontWeight: FontWeight.w900),
          ),
        ),
        body: RefreshIndicator(
          onRefresh: _refreshStatus,
          color: AppColors.gold,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(24),
            children: [
              const SizedBox(height: 25),
              Icon(
                _active
                    ? Icons.check_circle_rounded
                    : _pending
                    ? Icons.hourglass_top_rounded
                    : Icons.info_rounded,
                color: _active ? const Color(0xFF7FE39A) : AppColors.gold,
                size: 88,
              ),
              const SizedBox(height: 20),
              Text(
                _title,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: AppColors.white,
                  fontSize: 26,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                _description,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.muted, height: 1.5),
              ),
              if (_pending) ...[
                const SizedBox(height: 25),
                Text(
                  _countdown,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: AppColors.gold,
                    fontSize: 42,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ],
              const SizedBox(height: 28),
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(color: const Color(0x667A8BB8)),
                ),
                child: Column(
                  children: [
                    _StatusRow(
                      label: 'Astrologer',
                      value: widget.astrologer.name,
                    ),
                    _StatusRow(
                      label: 'Mode',
                      value: _session.mode.toUpperCase(),
                    ),
                    _StatusRow(
                      label: 'Duration',
                      value: '${_session.purchasedMinutes} minutes',
                    ),
                    _StatusRow(
                      label: 'Reserved',
                      value: '\u20B9${_formatAmount(_session.amountCharged)}',
                    ),
                    if (_pending && _queuePosition?.position != null)
                      _StatusRow(
                        label: 'Queue position',
                        value: '#${_queuePosition!.position}',
                      ),
                    if (_pending && _queuePosition != null)
                      _StatusRow(
                        label: 'Waiting',
                        value: _queuePosition!.isNext
                            ? 'You are next'
                            : '${_queuePosition!.customersAhead} ahead',
                      ),
                    _StatusRow(label: 'Status', value: _status, last: true),
                  ],
                ),
              ),
              if (_error.isNotEmpty) ...[
                const SizedBox(height: 16),
                Text(
                  _error,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Color(0xFFFF8A84),
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
              const SizedBox(height: 22),
              if (_pending)
                OutlinedButton(
                  onPressed: _requestInProgress ? null : _cancel,
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(54),
                    foregroundColor: const Color(0xFFFF8A84),
                  ),
                  child: Text(
                    _requestInProgress ? 'Please wait...' : 'Cancel Request',
                  ),
                )
              else
                FilledButton(
                  onPressed: () {
                    if (_active) {
                      Navigator.of(context).pushReplacement(
                        MaterialPageRoute<void>(
                          builder: (_) =>
                              ChatScreen(consultationId: _session.id),
                        ),
                      );

                      return;
                    }

                    Navigator.of(context).pop();
                  },
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(54),
                    backgroundColor: AppColors.gold,
                    foregroundColor: AppColors.background,
                  ),
                  child: Text(
                    _active ? 'Continue' : 'Back to Profile',
                    style: const TextStyle(fontWeight: FontWeight.w900),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  String get _countdown {
    final minutes = _remainingSeconds ~/ 60;
    final seconds = _remainingSeconds % 60;

    return '${minutes.toString().padLeft(2, '0')}:'
        '${seconds.toString().padLeft(2, '0')}';
  }

  String get _title => switch (_status) {
    'ACTIVE' => 'Astrologer accepted',
    'EXPIRED' => 'Request expired',
    'REJECTED' => 'Request declined',
    'CANCELLED' => 'Request cancelled',
    _ => 'Waiting for ${widget.astrologer.name}',
  };

  String get _description => switch (_status) {
    'ACTIVE' => 'Your consultation is active and ready.',
    'EXPIRED' =>
      'No response was received. The wallet reservation has been released.',
    'REJECTED' =>
      'The astrologer declined. The wallet reservation has been released.',
    'CANCELLED' =>
      'The request was cancelled and the reservation was released.',
    _ =>
      _queuePosition?.isNext == true
          ? 'You are next in line.'
          : _queuePosition?.position != null
          ? 'Your queue position is #${_queuePosition!.position}.'
          : 'Your ${_session.mode} request was sent successfully.',
  };

  String _formatAmount(double value) => value == value.roundToDouble()
      ? value.toInt().toString()
      : value.toStringAsFixed(2);
}

class _StatusRow extends StatelessWidget {
  const _StatusRow({
    required this.label,
    required this.value,
    this.last = false,
  });

  final String label;
  final String value;
  final bool last;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 13),
      decoration: BoxDecoration(
        border: last
            ? null
            : const Border(bottom: BorderSide(color: Color(0x337A8BB8))),
      ),
      child: Row(
        children: [
          Text(label, style: const TextStyle(color: AppColors.muted)),
          const Spacer(),
          Text(
            value,
            style: const TextStyle(
              color: AppColors.white,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}
