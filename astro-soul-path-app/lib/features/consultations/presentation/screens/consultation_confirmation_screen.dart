import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../astrologers/data/public_astrologer.dart';
import '../../../customer/data/customer_consultation_api.dart';
import '../../data/consultation_models.dart';
import 'customer_consultation_waiting_screen.dart';

class ConsultationConfirmationScreen extends StatefulWidget {
  const ConsultationConfirmationScreen({
    required this.profile,
    required this.mode,
    this.astrologyQuestionId,
    this.astrologyQuestionText,
    this.astrologyCategorySlug,
    this.isFreeChatIntent = false,
    this.freeChatMinutes = 0,
    super.key,
  });

  final PublicAstrologerProfile profile;
  final ConsultationMode mode;
  final String? astrologyQuestionId;
  final String? astrologyQuestionText;
  final String? astrologyCategorySlug;

  /// Navigation/UI intent only.
  /// Backend remains authoritative for eligibility and charging.
  final bool isFreeChatIntent;
  final int freeChatMinutes;

  @override
  State<ConsultationConfirmationScreen> createState() =>
      _ConsultationConfirmationScreenState();
}

class _ConsultationConfirmationScreenState
    extends State<ConsultationConfirmationScreen> {
  final _api = CustomerConsultationApi();

  static const _minuteOptions = <int>[1, 2, 3, 5, 10, 15, 20, 30];

  int _selectedMinutes = 1;
  bool _submitting = false;

  PublicAstrologer get _astrologer => widget.profile.astrologer;

  bool get _isAudio => widget.mode == ConsultationMode.audio;
  bool get _isVideo => widget.mode == ConsultationMode.video;

  String get _modeLabel {
    if (_isVideo) {
      return 'Video Consultation';
    }

    if (_isAudio) {
      return 'Audio Consultation';
    }

    return 'Chat Consultation';
  }

  double get _rate => double.tryParse(_astrologer.pricePerMin.toString()) ?? 0;

  double get _total => _rate * _selectedMinutes;

  bool get _isFreeChat =>
      widget.isFreeChatIntent &&
      !_isAudio &&
      !_isVideo &&
      widget.freeChatMinutes > 0;

  int get _effectiveMinutes =>
      _isFreeChat ? widget.freeChatMinutes : _selectedMinutes;

  @override
  void dispose() {
    _api.close();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_submitting) {
      return;
    }

    final astrologerUserId = _astrologer.userId?.trim() ?? '';

    if (astrologerUserId.isEmpty) {
      _showError(
        'This astrologer account is missing its consultation user ID.',
      );
      return;
    }

    if (!_astrologer.isOnline) {
      _showError('This astrologer is currently offline.');
      return;
    }

    setState(() {
      _submitting = true;
    });

    try {
      final result = await _api.startConsultation(
        astrologerUserId: astrologerUserId,
        purchasedMinutes: _effectiveMinutes,
        mode: _isVideo
            ? CustomerConsultationMode.video
            : _isAudio
            ? CustomerConsultationMode.audio
            : CustomerConsultationMode.chat,
      );

      if (!mounted) {
        return;
      }

      await Navigator.of(context).pushReplacement(
        MaterialPageRoute<void>(
          builder: (_) => CustomerConsultationWaitingScreen(
            consultationId: result.consultationId,
            astrologerUserId: astrologerUserId,
            astrologerName: _astrologer.name,
            modeLabel: _modeLabel,
            requestExpiresAt: result.expiresAt,
          ),
        ),
      );
    } on CustomerConsultationApiException catch (error) {
      if (!mounted) {
        return;
      }

      _showError(error.message);
    } finally {
      if (mounted) {
        setState(() {
          _submitting = false;
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
        title: Text(
          _modeLabel,
          style: const TextStyle(fontWeight: FontWeight.w900),
        ),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 20, 18, 32),
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
                  CircleAvatar(
                    radius: 31,
                    backgroundColor: const Color(0x18F4C45E),
                    backgroundImage:
                        _astrologer.avatarUrl != null &&
                            _astrologer.avatarUrl!.trim().isNotEmpty
                        ? NetworkImage(_astrologer.avatarUrl!)
                        : null,
                    child:
                        _astrologer.avatarUrl == null ||
                            _astrologer.avatarUrl!.trim().isEmpty
                        ? const Icon(
                            Icons.person_rounded,
                            color: AppColors.gold,
                            size: 32,
                          )
                        : null,
                  ),

                  const SizedBox(width: 14),

                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _astrologer.name,
                          style: const TextStyle(
                            color: AppColors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 5),
                        Text(
                          _astrologer.primaryExpertise,
                          style: const TextStyle(color: AppColors.muted),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          _astrologer.priceLabel,
                          style: const TextStyle(
                            color: AppColors.gold,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            const Text(
              'Select consultation duration',
              style: TextStyle(
                color: AppColors.white,
                fontSize: 19,
                fontWeight: FontWeight.w900,
              ),
            ),

            const SizedBox(height: 7),

            const Text(
              'You can extend an active consultation later if needed.',
              style: TextStyle(color: AppColors.muted),
            ),

            const SizedBox(height: 16),

            if (_isFreeChat)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0x14F4C45E),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                    color: AppColors.gold.withValues(alpha: 0.45),
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: AppColors.gold.withValues(alpha: 0.14),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.card_giftcard_rounded,
                        color: AppColors.gold,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'YOUR FREE CHAT',
                            style: TextStyle(
                              color: AppColors.gold,
                              fontSize: 12,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.8,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '$_effectiveMinutes min consultation at no charge',
                            style: const TextStyle(
                              color: AppColors.white,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              )
            else
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: _minuteOptions.map((minutes) {
                  final selected = minutes == _selectedMinutes;

                  return ChoiceChip(
                    selected: selected,
                    label: Text('$minutes min'),
                    onSelected: (_) {
                      setState(() {
                        _selectedMinutes = minutes;
                      });
                    },
                  );
                }).toList(),
              ),

            const SizedBox(height: 26),

            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Column(
                children: [
                  _PriceRow(label: 'Consultation', value: _modeLabel),
                  const SizedBox(height: 12),
                  _PriceRow(
                    label: 'Rate',
                    value: _isFreeChat
                        ? 'FREE'
                        : '\u20B9${_rate.toStringAsFixed(0)}/min',
                  ),
                  const SizedBox(height: 12),
                  _PriceRow(label: 'Duration', value: '$_effectiveMinutes min'),
                  const Divider(height: 28),
                  _PriceRow(
                    label: 'Estimated total',
                    value: _isFreeChat
                        ? '\u20B90'
                        : '\u20B9${_total.toStringAsFixed(2)}',
                    highlight: true,
                  ),
                ],
              ),
            ),

            const SizedBox(height: 18),

            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0x14F4C45E),
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    Icons.info_outline_rounded,
                    color: AppColors.gold,
                    size: 20,
                  ),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Your request is first sent to the astrologer. '
                      'The paid consultation starts after the astrologer accepts.',
                      style: TextStyle(color: AppColors.muted, height: 1.4),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 26),

            SizedBox(
              height: 56,
              child: FilledButton.icon(
                onPressed: _submitting ? null : _submit,
                icon: _submitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Icon(
                        _isAudio
                            ? Icons.call_rounded
                            : Icons.chat_bubble_rounded,
                      ),
                label: Text(
                  _submitting
                      ? 'Sending request...'
                      : _isFreeChat
                      ? 'Start Free Chat'
                      : 'Send Consultation Request',
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PriceRow extends StatelessWidget {
  const _PriceRow({
    required this.label,
    required this.value,
    this.highlight = false,
  });

  final String label;
  final String value;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(label, style: const TextStyle(color: AppColors.muted)),
        ),
        Text(
          value,
          style: TextStyle(
            color: highlight ? AppColors.gold : AppColors.white,
            fontWeight: FontWeight.w900,
            fontSize: highlight ? 17 : 14,
          ),
        ),
      ],
    );
  }
}
