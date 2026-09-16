import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../wallet/presentation/screens/customer_wallet_screen.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter_tts/flutter_tts.dart';

import '../../data/ai_astro_api.dart';
import '../../data/ai_astro_models.dart';

class AiAstroChatScreen extends StatefulWidget {
  const AiAstroChatScreen({
    super.key,
    required this.persona,
    required this.category,
    required this.consultantType,
  });

  final AiAstroPersona persona;
  final String category;
  final AiConsultantType consultantType;

  @override
  State<AiAstroChatScreen> createState() => _AiAstroChatScreenState();
}

class _AiAstroChatScreenState extends State<AiAstroChatScreen> {
  @override
  void initState() {
    super.initState();
    unawaited(_loadOpeningMessage());
  }

  Future<void> _loadOpeningMessage() async {
    try {
      final opening = await _api.getOpeningMessage(
        personaId: widget.persona.id,
        consultantTypeCode: widget.consultantType.code,
        category: widget.category,
      );

      if (!mounted ||
          !opening.shouldShow ||
          opening.message == null ||
          opening.message!.trim().isEmpty) {
        return;
      }

      setState(() {
        _messages.add(
          _AiMessage(text: opening.message!.trim(), fromUser: false),
        );
      });
    } on AiAstroApiException catch (error) {
      /*
       * Opening message is non-billable and optional UI bootstrap.
       * Do not block the paid chat if greeting retrieval fails.
       */
      debugPrint('AI opening message unavailable: ${error.message}');
    } catch (error) {
      debugPrint('AI opening message failed: $error');
    }
  }

  String get _consultantDisplayName {
    final personaName = widget.persona.name.trim();

    if (personaName.isNotEmpty) {
      return personaName;
    }

    final consultantName = widget.consultantType.name.trim();
    return consultantName.isEmpty ? 'AI Consultant' : consultantName;
  }

  String get _consultantContextText {
    final code = widget.consultantType.code.trim().toUpperCase();

    switch (code) {
      case 'VEDIC_ASTROLOGER':
      case 'KP_ASTROLOGER':
        return 'Answers use your saved birth profile and calculated Kundli data.';

      case 'NUMEROLOGIST':
        return 'Guidance uses your available name, date of birth and numerology context.';

      case 'VAASTU_CONSULTANT':
        return 'Guidance follows Vaastu principles using the property, room, direction and layout details you provide.';

      case 'TAROT_READER':
        return 'Guidance is provided from a reflective Tarot perspective.';

      case 'LIFE_COACH':
        return 'Guidance focuses on practical goals, choices, habits and personal growth.';

      case 'GENERAL_PSYCHOLOGIST':
        return 'Guidance focuses on general emotional wellbeing and psychoeducation.';

      case 'FENG_SHUI_COACH':
        return 'Guidance follows Feng Shui principles using your space and orientation details.';

      case 'AYURVEDIC_CONSULTANT':
        return 'Guidance provides general Ayurvedic wellness education.';

      case 'YOGA_TEACHER':
        return 'Guidance focuses on general yoga, breathing, mobility and relaxation practices.';

      default:
        return widget.consultantType.description.trim().isEmpty
            ? 'Guidance is based on your selected AI consultant.'
            : widget.consultantType.description.trim();
    }
  }

  String get _loadingText {
    return '$_consultantDisplayName is typing...';
  }

  String get _questionHint {
    final code = widget.consultantType.code.trim().toUpperCase();

    switch (code) {
      case 'VEDIC_ASTROLOGER':
        return 'Ask your Vedic astrology question...';
      case 'KP_ASTROLOGER':
        return 'Ask your KP astrology question...';

      case 'NUMEROLOGIST':
        return 'Ask your numerology question...';

      case 'VAASTU_CONSULTANT':
        return 'Ask your Vaastu question...';

      case 'TAROT_READER':
        return 'Ask your Tarot question...';

      case 'LIFE_COACH':
        return 'Ask your life coaching question...';

      case 'GENERAL_PSYCHOLOGIST':
        return 'Ask about your wellbeing...';

      case 'FENG_SHUI_COACH':
        return 'Ask your Feng Shui question...';

      case 'AYURVEDIC_CONSULTANT':
        return 'Ask your Ayurveda wellness question...';

      case 'YOGA_TEACHER':
        return 'Ask your yoga question...';

      default:
        return 'Ask your question...';
    }
  }

  String? _aiTimedClientSessionId;
  Timer? _aiTimedHeartbeatTimer;
  bool _aiTimedStarting = false;
  bool _aiTimedEnding = false;
  bool _aiTimedCanContinue = false;
  bool _aiTimedSessionCompleted = false;

  String? _aiTimedSessionError;
  double? _aiTimedRatePerMinute;
  int _aiTimedDurationMinutes = 1;
  String _aiTimedCurrency = 'INR';

  DateTime? _aiTimedStartedAt;
  Timer? _aiTimedDisplayTimer;

  int _aiTimedDisplaySeconds = 0;

  final AiAstroApi _api = AiAstroApi();
  final TextEditingController _controller = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  final List<_AiMessage> _messages = [];

  bool _sending = false;
  bool _streamStarted = false;
  bool _aiTimedActivated = false;

  String _createAiTimedClientSessionId() {
    final micros = DateTime.now().toUtc().microsecondsSinceEpoch;

    return 'ai_${micros}_${widget.hashCode.abs()}';
  }

  Future<bool> _ensureAiTimedSession() async {
    if (_aiTimedClientSessionId != null && _aiTimedCanContinue) {
      return true;
    }

    if (_aiTimedStarting) {
      return false;
    }

    _aiTimedStarting = true;

    if (mounted) {
      setState(() {
        _aiTimedSessionError = null;
      });
    }

    try {
      final generatedId = _createAiTimedClientSessionId();

      final started = await _api.startTimedSession(
        clientSessionId: generatedId,
        personaId: widget.persona.id,
        consultantTypeCode: widget.consultantType.code,
        durationMinutes: _aiTimedDurationMinutes,
      );

      final resolvedId = started.clientSessionId.trim().isEmpty
          ? generatedId
          : started.clientSessionId.trim();

      if (!mounted) {
        try {
          await _api.endTimedSession(clientSessionId: resolvedId);
        } catch (_) {
          // Best-effort cleanup when screen was removed
          // while session/start was in flight.
        }

        return false;
      }

      setState(() {
        _aiTimedClientSessionId = resolvedId;
        _aiTimedRatePerMinute = started.ratePerMinute;
        if (started.durationMinutes > 0) {
          _aiTimedDurationMinutes = started.durationMinutes;
        }

        _aiTimedCurrency = started.currency.trim().isEmpty
            ? 'INR'
            : started.currency.trim();

        _aiTimedStartedAt = null;

        _aiTimedDisplaySeconds = 0;
        _aiTimedCanContinue = true;
        _aiTimedSessionError = null;
      });

      return true;
    } catch (error) {
      if (mounted) {
        setState(() {
          _aiTimedCanContinue = false;
          _aiTimedSessionError = error.toString();
        });
      }

      return false;
    } finally {
      _aiTimedStarting = false;
    }
  }

  Future<void> _startSelectedAiConsultation() async {
    if (_aiTimedStarting || _aiTimedActivated) {
      return;
    }

    final rate = _aiCatalogRatePerMinute;

    if (rate == null || rate <= 0) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Live AI consultation pricing is unavailable.'),
        ),
      );

      return;
    }

    setState(() {
      _aiTimedSessionCompleted = false;
      _aiTimedSessionError = null;
      _aiTimedDisplaySeconds = 0;
      _aiTimedActivated = false;
    });

    final ready = await _ensureAiTimedSession();

    if (!ready || !mounted) {
      final error =
          _aiTimedSessionError ?? 'Unable to prepare AI consultation.';

      if (error.toUpperCase().contains('INSUFFICIENT_BALANCE')) {
        await _openAiWalletForInsufficientBalance();
      } else if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error)));
      }

      return;
    }

    if (!mounted) {
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Consultation reserved. Ask your first question.'),
      ),
    );
  }

  Future<bool> _activateAiTimedSession() async {
    if (_aiTimedActivated) {
      return true;
    }

    final sessionId = _aiTimedClientSessionId;

    if (sessionId == null || sessionId.trim().isEmpty) {
      return false;
    }

    try {
      final activated = await _api.activateTimedSession(
        clientSessionId: sessionId,
      );

      if (!mounted) {
        return false;
      }

      setState(() {
        _aiTimedStartedAt = activated.startedAt ?? DateTime.now().toUtc();
        _aiTimedRatePerMinute = activated.ratePerMinute;
        if (activated.durationMinutes > 0) {
          _aiTimedDurationMinutes = activated.durationMinutes;
        }
        _aiTimedCurrency = activated.currency.trim().isEmpty
            ? _aiTimedCurrency
            : activated.currency.trim();
        _aiTimedDisplaySeconds = 0;
        _aiTimedActivated = true;
        _aiTimedCanContinue = true;
        _aiTimedSessionError = null;
      });

      _startAiTimedDisplayTimer();
      _startAiTimedHeartbeat();

      return true;
    } catch (error) {
      if (mounted) {
        setState(() {
          _aiTimedSessionError = error.toString();
        });
      }

      return false;
    }
  }

  void _startAiTimedDisplayTimer() {
    _aiTimedDisplayTimer?.cancel();

    _aiTimedDisplayTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) {
        return;
      }

      final startedAt = _aiTimedStartedAt;

      if (startedAt == null) {
        return;
      }

      final elapsed = DateTime.now().toUtc().difference(startedAt).inSeconds;
      final maxSeconds = _aiTimedDurationMinutes * 60;
      final cappedElapsed = elapsed < 0
          ? 0
          : (elapsed > maxSeconds ? maxSeconds : elapsed);

      setState(() {
        _aiTimedDisplaySeconds = cappedElapsed;

        if (cappedElapsed >= _aiTimedDurationMinutes * 60) {
          _aiTimedCanContinue = false;
          _aiTimedSessionCompleted = true;
          _aiTimedSessionError = 'Your AI consultation time has ended.';
        }
      });

      if (cappedElapsed >= _aiTimedDurationMinutes * 60) {
        _aiTimedDisplayTimer?.cancel();
        _aiTimedHeartbeatTimer?.cancel();
        unawaited(_endAiTimedSession());
      }
    });
  }

  void _startAiTimedHeartbeat() {
    _aiTimedHeartbeatTimer?.cancel();

    _aiTimedHeartbeatTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      unawaited(_sendAiTimedHeartbeat());
    });
  }

  Future<void> _sendAiTimedHeartbeat() async {
    final sessionId = _aiTimedClientSessionId;

    if (sessionId == null || sessionId.trim().isEmpty || _aiTimedEnding) {
      return;
    }

    try {
      final heartbeat = await _api.heartbeatTimedSession(
        clientSessionId: sessionId,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        final maxSeconds = _aiTimedDurationMinutes * 60;
        final serverElapsed = heartbeat.elapsedSeconds;

        _aiTimedDisplaySeconds = serverElapsed < 0
            ? 0
            : (serverElapsed > maxSeconds ? maxSeconds : serverElapsed);

        _aiTimedCanContinue = heartbeat.active && heartbeat.canContinue;

        if (!_aiTimedCanContinue) {
          _aiTimedSessionError = 'Your AI consultation time has ended.';
        }
      });

      if (!_aiTimedCanContinue) {
        _aiTimedHeartbeatTimer?.cancel();
      }
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _aiTimedSessionError = error.toString();
      });
    }
  }

  Future<void> _endAiTimedSession() async {
    if (_aiTimedEnding) {
      return;
    }

    final sessionId = _aiTimedClientSessionId;

    _aiTimedHeartbeatTimer?.cancel();
    _aiTimedDisplayTimer?.cancel();
    if (sessionId == null || sessionId.trim().isEmpty) {
      return;
    }

    _aiTimedEnding = true;

    try {
      await _api.endTimedSession(clientSessionId: sessionId);
    } catch (_) {
      // Session end is idempotent server-side.
      // Final production verification will test
      // network-loss recovery separately.
    } finally {
      _aiTimedClientSessionId = null;

      if (!_aiTimedSessionCompleted) {
        _aiTimedRatePerMinute = null;
        _aiTimedDisplaySeconds = 0;
      }

      if (_aiTimedSessionCompleted) {
        _aiTimedDisplaySeconds = _aiTimedDurationMinutes * 60;
      }

      _aiTimedStartedAt = null;
      _aiTimedCanContinue = false;
      _aiTimedActivated = false;
      _aiTimedEnding = false;
    }
  }

  @override
  void dispose() {
    _aiTimedHeartbeatTimer?.cancel();
    unawaited(_endAiTimedSession());
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _openAiWalletForInsufficientBalance() async {
    if (!mounted) return;

    final openWallet = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Insufficient balance'),
        content: const Text(
          'Your wallet needs enough balance for the selected AI consultation duration.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton.icon(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            icon: const Icon(Icons.account_balance_wallet_outlined),
            label: const Text('Add Money'),
          ),
        ],
      ),
    );

    if (openWallet == true && mounted) {
      await Navigator.of(context).push(
        MaterialPageRoute<void>(builder: (_) => const CustomerWalletScreen()),
      );

      if (mounted) {
        setState(() {
          _aiTimedSessionError = null;
        });
      }
    }
  }

  Future<void> _send() async {
    final question = _controller.text.trim();

    if (question.isEmpty || _sending) {
      return;
    }

    if (_aiTimedSessionCompleted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Your AI consultation time has ended.')),
      );

      return;
    }

    FocusScope.of(context).unfocus();

    setState(() {
      _messages.add(_AiMessage(text: question, fromUser: true));

      _controller.clear();
      _sending = true;
      _streamStarted = false;
    });

    _scrollToBottom();

    try {
      final timedSessionReady = await _ensureAiTimedSession();

      if (!timedSessionReady ||
          !_aiTimedCanContinue ||
          _aiTimedClientSessionId == null) {
        final sessionError =
            _aiTimedSessionError ?? 'Unable to start paid AI consultation.';

        final insufficientBalance = sessionError.toUpperCase().contains(
          'INSUFFICIENT_BALANCE',
        );

        if (mounted) {
          setState(() {
            if (_messages.isNotEmpty &&
                _messages.last.fromUser &&
                _messages.last.text == question) {
              _messages.removeLast();
            }

            _sending = false;
            _streamStarted = false;
          });
        }

        if (insufficientBalance) {
          await _openAiWalletForInsufficientBalance();
        } else if (mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text(sessionError)));
        }

        return;
      }

      int? streamedMessageIndex;

      // Start OpenAI immediately, but delay only the first visible
      // assistant text so the consultant feels more naturally responsive.
      const humanTypingDelay = Duration(milliseconds: 450);

      final humanTypingStartedAt = DateTime.now();
      final pendingAiText = StringBuffer();

      final result = await _api.askStream(
        category: widget.category,
        question: question,
        personaId: widget.persona.id,
        consultantTypeCode: widget.consultantType.code,
        clientSessionId: _aiTimedClientSessionId,
        onChunk: (chunk) async {
          if (!mounted || chunk.isEmpty) {
            return;
          }

          final elapsed = DateTime.now().difference(humanTypingStartedAt);

          // Continue receiving the real OpenAI stream immediately.
          // Before the human typing window ends, only buffer its text.
          if (streamedMessageIndex == null && elapsed < humanTypingDelay) {
            pendingAiText.write(chunk);
            return;
          }

          if (streamedMessageIndex == null && !_aiTimedActivated) {
            final activated = await _activateAiTimedSession();

            if (!activated || !mounted) {
              return;
            }
          }
          setState(() {
            if (streamedMessageIndex == null) {
              _streamStarted = true;

              final bufferedText = pendingAiText.toString();
              pendingAiText.clear();

              _messages.add(
                _AiMessage(text: bufferedText + chunk, fromUser: false),
              );

              streamedMessageIndex = _messages.length - 1;
            } else {
              final index = streamedMessageIndex!;

              if (index >= 0 && index < _messages.length) {
                final current = _messages[index];

                _messages[index] = _AiMessage(
                  text: current.text + chunk,
                  fromUser: false,
                  isError: current.isError,
                  kundliGrounded: current.kundliGrounded,
                  createdAt: current.createdAt,
                );
              }
            }
          });

          _scrollToBottom();
        },
      );

      if (!mounted) {
        return;
      }

      // OpenAI can sometimes finish before the visual typing delay.
      // In that case, wait only for the remaining human-feel window.
      if (streamedMessageIndex == null) {
        final elapsed = DateTime.now().difference(humanTypingStartedAt);

        final remaining = humanTypingDelay - elapsed;

        if (remaining.inMilliseconds > 0) {
          await Future<void>.delayed(remaining);
        }

        if (!mounted) {
          return;
        }

        if (!_aiTimedActivated) {
          final activated = await _activateAiTimedSession();

          if (!activated || !mounted) {
            return;
          }
        }
        final bufferedText = pendingAiText.toString();

        if (bufferedText.isNotEmpty) {
          setState(() {
            _streamStarted = true;

            _messages.add(_AiMessage(text: bufferedText, fromUser: false));

            streamedMessageIndex = _messages.length - 1;
          });

          _scrollToBottom();
        }
      }

      if (!_aiTimedActivated && result.answer.trim().isNotEmpty) {
        final activated = await _activateAiTimedSession();

        if (!activated || !mounted) {
          return;
        }
      }
      final finalBubbleParts = _splitAiAnswerIntoChatBubbles(result.answer);

      debugPrint(
        '[AI_BUBBLE_DEBUG] final answer length=${result.answer.length} '
        'parts=${finalBubbleParts.length}',
      );

      for (
        var debugIndex = 0;
        debugIndex < finalBubbleParts.length;
        debugIndex++
      ) {
        debugPrint(
          '[AI_BUBBLE_DEBUG] part[$debugIndex] '
          'length=${finalBubbleParts[debugIndex].length} '
          'text=${finalBubbleParts[debugIndex]}',
        );
      }

      if (finalBubbleParts.isEmpty) {
        throw StateError('AI Astro returned an empty final answer');
      }

      final grounded = result.birthProfileUsed && result.kundliUsed;

      final existingStreamIndex = streamedMessageIndex;

      setState(() {
        if (existingStreamIndex != null &&
            existingStreamIndex >= 0 &&
            existingStreamIndex < _messages.length) {
          _messages[existingStreamIndex] = _AiMessage(
            text: finalBubbleParts.first,
            fromUser: false,
            isError: false,
            kundliGrounded: grounded,
          );
        } else {
          _messages.add(
            _AiMessage(
              text: finalBubbleParts.first,
              fromUser: false,
              kundliGrounded: grounded,
            ),
          );
        }
      });

      _scrollToBottom();

      for (
        var partIndex = 1;
        partIndex < finalBubbleParts.length;
        partIndex++
      ) {
        await Future<void>.delayed(
          Duration(milliseconds: 160 + (partIndex * 35)),
        );

        if (!mounted) {
          return;
        }

        setState(() {
          _messages.add(
            _AiMessage(
              text: finalBubbleParts[partIndex],
              fromUser: false,
              kundliGrounded: grounded,
            ),
          );
        });

        _scrollToBottom();
      }

      if (!mounted) {
        return;
      }

      setState(() {
        _sending = false;
        _streamStarted = false;
      });

      _scrollToBottom();
    } catch (error, stackTrace) {
      debugPrint('AI_ASTRO_STREAM_ERROR: $error');
      debugPrintStack(label: 'AI_ASTRO_STREAM_STACK', stackTrace: stackTrace);

      if (!mounted) {
        return;
      }

      setState(() {
        _messages.add(
          _AiMessage(
            text: 'AI response could not be completed. Please try again.',
            fromUser: false,
            isError: true,
          ),
        );

        _sending = false;
      });

      _scrollToBottom();
    }
  }

  List<String> _splitAiAnswerIntoChatBubbles(String rawAnswer) {
    final normalized = rawAnswer.replaceAll("\r\n", "\n").trim();

    if (normalized.isEmpty) {
      return const <String>[];
    }

    const targetBubbleLength = 150;
    const hardBubbleLength = 185;

    final paragraphs = normalized
        .split(RegExp(r'\n\s*\n'))
        .map((part) => part.trim())
        .where((part) => part.isNotEmpty)
        .toList();

    final pieces = <String>[];

    void splitSentences(String text) {
      final sentences = text
          .split(RegExp(r'(?<=[.!?])\s+'))
          .map((sentence) => sentence.trim())
          .where((sentence) => sentence.isNotEmpty)
          .toList();

      if (sentences.length <= 1) {
        pieces.add(text.trim());
        return;
      }

      final current = StringBuffer();

      for (final sentence in sentences) {
        final nextLength =
            current.length + (current.isEmpty ? 0 : 1) + sentence.length;

        if (current.isNotEmpty && nextLength > targetBubbleLength) {
          pieces.add(current.toString().trim());
          current.clear();
        }

        if (current.isNotEmpty) {
          current.write(' ');
        }

        current.write(sentence);
      }

      if (current.isNotEmpty) {
        pieces.add(current.toString().trim());
      }
    }

    for (final paragraph in paragraphs) {
      if (paragraph.length <= hardBubbleLength) {
        pieces.add(paragraph);
      } else {
        splitSentences(paragraph);
      }
    }

    if (pieces.length == 1 && pieces.first.length > hardBubbleLength) {
      final text = pieces.first;

      pieces.clear();
      splitSentences(text);
    }

    if (pieces.isEmpty) {
      return <String>[normalized];
    }

    if (pieces.length <= 4) {
      return pieces;
    }

    return <String>[
      pieces[0],
      pieces[1],
      pieces[2],
      pieces.sublist(3).join(' '),
    ];
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) {
        return;
      }

      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 280),
        curve: Curves.easeOut,
      );
    });
  }

  String get _aiTimedElapsedLabel {
    final minutes = _aiTimedDisplaySeconds ~/ 60;

    final seconds = _aiTimedDisplaySeconds % 60;

    return '${minutes.toString().padLeft(2, '0')}:'
        '${seconds.toString().padLeft(2, '0')}';
  }

  String get _aiTimedRateLabel {
    final rate = _aiTimedRatePerMinute;

    if (rate == null || rate <= 0) {
      return 'Paid consultation';
    }

    final formattedRate = rate == rate.roundToDouble()
        ? rate.toStringAsFixed(0)
        : rate.toStringAsFixed(2);

    final normalizedCurrency = _aiTimedCurrency.trim().toUpperCase();
    final currencyLabel = normalizedCurrency == 'INR'
        ? '\u20B9'
        : '$normalizedCurrency ';

    return '$currencyLabel$formattedRate/min';
  }

  double? get _aiCatalogRatePerMinute {
    final rate = widget.persona.aiPricing.pricePerMinute;

    if (rate == null || rate <= 0) {
      return null;
    }

    return rate;
  }

  String get _aiSelectedDurationTotalLabel {
    final rate = _aiCatalogRatePerMinute;

    if (rate == null) {
      return 'Price unavailable';
    }

    final total = rate * _aiTimedDurationMinutes;
    final formatted = total == total.roundToDouble()
        ? total.toStringAsFixed(0)
        : total.toStringAsFixed(2);

    final currency = widget.persona.aiPricing.currency.trim().toUpperCase();
    final prefix = currency == 'INR' ? '\u20B9' : '$currency ';

    return '$prefix$formatted total';
  }

  Widget _buildAiDurationPicker() {
    if (_aiTimedActivated ||
        (_aiTimedClientSessionId != null && !_aiTimedSessionCompleted) ||
        _aiTimedStarting) {
      return const SizedBox.shrink();
    }

    const durations = <int>[1, 2, 5, 10];
    final rate = _aiCatalogRatePerMinute;

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(12, 10, 12, 6),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF11172A),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFF30254D)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(
                Icons.auto_awesome_rounded,
                size: 18,
                color: Color(0xFFB995FF),
              ),
              SizedBox(width: 8),
              Text(
                'Choose consultation duration',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            rate == null
                ? 'Live pricing will be verified before the session starts.'
                : '${widget.persona.aiPricing.displayLabel} - Pay only through your wallet',
            style: const TextStyle(color: Color(0xFF949DB5), fontSize: 12),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: durations.map((minutes) {
              final selected = _aiTimedDurationMinutes == minutes;

              return ChoiceChip(
                label: Text('$minutes min'),
                selected: selected,
                onSelected: (value) {
                  if (!value) {
                    return;
                  }

                  setState(() {
                    _aiTimedDurationMinutes = minutes;
                    _aiTimedSessionCompleted = false;
                    _aiTimedSessionError = null;
                    _aiTimedDisplaySeconds = 0;
                  });
                },
                labelStyle: TextStyle(
                  color: selected ? const Color(0xFF180C2E) : Colors.white,
                  fontWeight: FontWeight.w700,
                ),
                selectedColor: const Color(0xFFB995FF),
                backgroundColor: const Color(0xFF191F33),
                side: BorderSide(
                  color: selected
                      ? const Color(0xFFB995FF)
                      : const Color(0xFF313A55),
                ),
                showCheckmark: false,
              );
            }).toList(),
          ),
          const SizedBox(height: 14),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
            decoration: BoxDecoration(
              color: const Color(0xFF0A0F1E),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    '$_aiTimedDurationMinutes minute consultation',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                Text(
                  _aiSelectedDurationTotalLabel,
                  style: const TextStyle(
                    color: Color(0xFFFFD978),
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: rate == null || _aiTimedStarting
                  ? null
                  : _startSelectedAiConsultation,
              icon: _aiTimedStarting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.auto_awesome_rounded),
              label: Text(
                _aiTimedSessionCompleted
                    ? 'Continue Consultation'
                    : 'Start Consultation',
              ),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFB995FF),
                foregroundColor: const Color(0xFF180C2E),
                padding: const EdgeInsets.symmetric(vertical: 14),
                textStyle: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 15,
                ),
              ),
            ),
          ),
          if (_aiTimedSessionCompleted) ...[
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: _openAiWalletForInsufficientBalance,
                icon: const Icon(Icons.account_balance_wallet_outlined),
                label: const Text('Recharge Wallet'),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildAiTimedBillingBar() {
    final hasSession = _aiTimedClientSessionId != null;

    if (!hasSession && !_aiTimedStarting && _aiTimedSessionError == null) {
      return const SizedBox.shrink();
    }

    final statusText = _aiTimedStarting
        ? 'Starting paid session...'
        : _aiTimedSessionCompleted
        ? 'Session ended'
        : _aiTimedActivated
        ? 'Session active'
        : _aiTimedCanContinue
        ? 'Waiting for AI reply...'
        : 'Session unavailable';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _aiTimedRateLabel,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 2),
                Text(
                  _aiTimedSessionError ?? statusText,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Text(
            _aiTimedElapsedLabel,
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF070B17),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0D1220),
        foregroundColor: Colors.white,
        titleSpacing: 4,
        title: Row(
          children: [
            CircleAvatar(
              radius: 18,
              backgroundColor: const Color(0xFF7654B7),
              child: Text(
                widget.persona.initials,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                  fontSize: 12,
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          widget.persona.name,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFF6E4BA8),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Text(
                          'AI',
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          _buildAiDurationPicker(),
          _buildAiTimedBillingBar(),
          Expanded(
            child: ListView(
              controller: _scrollController,
              padding: const EdgeInsets.all(16),
              children: [
                _WelcomeCard(
                  persona: widget.persona,
                  contextText: _consultantContextText,
                  consultantName: _consultantDisplayName,
                ),
                const SizedBox(height: 16),
                ..._messages.map((message) => _MessageBubble(message: message)),
                if (_sending && !_streamStarted)
                  _ThinkingBubble(text: _loadingText),
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Container(
              decoration: const BoxDecoration(
                color: Color(0xFF0D1220),
                border: Border(top: BorderSide(color: Color(0xFF222A40))),
              ),
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: Container(
                      decoration: BoxDecoration(
                        color: const Color(0xFF151B2D),
                        borderRadius: BorderRadius.circular(22),
                        border: Border.all(color: const Color(0xFF2A3350)),
                      ),
                      child: TextField(
                        controller: _controller,
                        enabled:
                            !_sending &&
                            _aiTimedClientSessionId != null &&
                            _aiTimedCanContinue &&
                            !_aiTimedSessionCompleted,
                        maxLines: 5,
                        minLines: 1,
                        textInputAction: TextInputAction.newline,
                        style: const TextStyle(color: Colors.white),
                        decoration: InputDecoration(
                          hintText: _aiTimedSessionCompleted
                              ? 'Choose duration to continue consultation'
                              : _aiTimedClientSessionId == null
                              ? 'Start consultation to begin chatting'
                              : _questionHint,
                          hintStyle: TextStyle(color: Color(0xFF777F96)),
                          border: InputBorder.none,
                          contentPadding: EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 12,
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Material(
                    color: const Color(0xFFB995FF),
                    shape: const CircleBorder(),
                    child: IconButton(
                      onPressed:
                          _sending ||
                              _aiTimedClientSessionId == null ||
                              !_aiTimedCanContinue ||
                              _aiTimedSessionCompleted
                          ? null
                          : _send,
                      icon: _sending
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(
                              Icons.arrow_upward_rounded,
                              color: Color(0xFF160D2C),
                            ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _WelcomeCard extends StatelessWidget {
  const _WelcomeCard({
    required this.persona,
    required this.contextText,
    required this.consultantName,
  });

  final AiAstroPersona persona;
  final String contextText;
  final String consultantName;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF171D31),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFF2A3350)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.auto_awesome_rounded, color: Color(0xFFB995FF)),
              const SizedBox(width: 8),
              Text(
                consultantName,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            persona.description,
            style: const TextStyle(color: Color(0xFFC0C5D2), height: 1.45),
          ),
          const SizedBox(height: 12),
          Text(
            contextText,
            style: TextStyle(
              color: Color(0xFF9B8FC0),
              fontSize: 12,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }
}

class _MessageBubble extends StatefulWidget {
  const _MessageBubble({required this.message});

  final _AiMessage message;

  @override
  State<_MessageBubble> createState() => _MessageBubbleState();
}

class _MessageBubbleState extends State<_MessageBubble> {
  late final FlutterTts _tts;

  bool _speaking = false;

  _AiMessage get message => widget.message;

  @override
  void initState() {
    super.initState();

    _tts = FlutterTts();

    _tts.setCompletionHandler(() {
      if (!mounted) {
        return;
      }

      setState(() {
        _speaking = false;
      });
    });

    _tts.setCancelHandler(() {
      if (!mounted) {
        return;
      }

      setState(() {
        _speaking = false;
      });
    });

    _tts.setErrorHandler((_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _speaking = false;
      });
    });
  }

  @override
  void dispose() {
    _tts.stop();
    super.dispose();
  }

  String _timeLabel(DateTime value) {
    final time = value.toLocal();

    final hour = time.hour % 12 == 0 ? 12 : time.hour % 12;

    final minute = time.minute.toString().padLeft(2, '0');

    final suffix = time.hour >= 12 ? 'PM' : 'AM';

    return '$hour:$minute $suffix';
  }

  Future<void> _copyMessage(BuildContext context) async {
    await Clipboard.setData(ClipboardData(text: message.text));

    if (!context.mounted) {
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Message copied'),
        duration: Duration(milliseconds: 900),
      ),
    );
  }

  String _plainSpeechText(String value) {
    return value
        .replaceAll(RegExp(r'[#*_>`~]'), '')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
  }

  Future<void> _toggleSpeech() async {
    if (_speaking) {
      await _tts.stop();

      if (mounted) {
        setState(() {
          _speaking = false;
        });
      }

      return;
    }

    final speechText = _plainSpeechText(message.text);

    if (speechText.isEmpty) {
      return;
    }

    await _tts.stop();

    await _tts.setSpeechRate(0.48);
    await _tts.setPitch(1.0);
    await _tts.setVolume(1.0);

    if (!mounted) {
      return;
    }

    setState(() {
      _speaking = true;
    });

    await _tts.speak(speechText);
  }

  @override
  Widget build(BuildContext context) {
    final fromUser = message.fromUser;

    final background = fromUser
        ? const Color(0xFF7654B7)
        : message.isError
        ? const Color(0xFF472128)
        : const Color(0xFF171D31);

    final bubble = Container(
      constraints: BoxConstraints(
        maxWidth: MediaQuery.sizeOf(context).width * (fromUser ? 0.76 : 0.78),
      ),
      padding: const EdgeInsets.fromLTRB(13, 11, 13, 8),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.only(
          topLeft: const Radius.circular(18),
          topRight: const Radius.circular(18),
          bottomLeft: Radius.circular(fromUser ? 18 : 5),
          bottomRight: Radius.circular(fromUser ? 5 : 18),
        ),
        border: fromUser
            ? null
            : Border.all(color: const Color(0xFF29314A), width: 0.8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (fromUser || message.isError)
            Text(
              message.text,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 14,
                height: 1.42,
              ),
            )
          else
            MarkdownBody(
              data: message.text,
              selectable: true,
              styleSheet: MarkdownStyleSheet(
                p: const TextStyle(
                  color: Colors.white,
                  height: 1.45,
                  fontSize: 14,
                ),
                strong: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                ),
                em: const TextStyle(
                  color: Color(0xFFD4C7F4),
                  fontStyle: FontStyle.italic,
                ),
                listBullet: const TextStyle(
                  color: Color(0xFFB995FF),
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),

          const SizedBox(height: 6),

          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                _timeLabel(message.createdAt),
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.48),
                  fontSize: 9.5,
                ),
              ),

              if (!fromUser && !message.isError) ...[
                const SizedBox(width: 8),

                InkWell(
                  borderRadius: BorderRadius.circular(20),
                  onTap: () => _copyMessage(context),
                  child: const Padding(
                    padding: EdgeInsets.all(3),
                    child: Icon(
                      Icons.copy_rounded,
                      size: 14,
                      color: Color(0xFFAEB6CA),
                    ),
                  ),
                ),

                const SizedBox(width: 5),

                InkWell(
                  borderRadius: BorderRadius.circular(20),
                  onTap: _toggleSpeech,
                  child: Padding(
                    padding: const EdgeInsets.all(3),
                    child: Icon(
                      _speaking
                          ? Icons.stop_circle_rounded
                          : Icons.volume_up_rounded,
                      size: 15,
                      color: _speaking
                          ? const Color(0xFFFFD978)
                          : const Color(0xFFAEB6CA),
                    ),
                  ),
                ),
              ],
            ],
          ),

          if (message.kundliGrounded) ...[
            const SizedBox(height: 6),

            const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.verified_rounded,
                  size: 13,
                  color: Color(0xFF69D39E),
                ),
                SizedBox(width: 4),
                Text(
                  'Kundli-grounded',
                  style: TextStyle(
                    color: Color(0xFF69D39E),
                    fontSize: 9.5,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );

    return Align(
      alignment: fromUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Padding(
        padding: const EdgeInsets.only(bottom: 7),
        child: fromUser
            ? bubble
            : Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    margin: const EdgeInsets.only(right: 7, bottom: 2),
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: LinearGradient(
                        colors: [Color(0xFFB995FF), Color(0xFF7654B7)],
                      ),
                    ),
                    alignment: Alignment.center,
                    child: const Icon(
                      Icons.auto_awesome_rounded,
                      size: 15,
                      color: Colors.white,
                    ),
                  ),

                  Flexible(child: bubble),
                ],
              ),
      ),
    );
  }
}

class _ThinkingBubble extends StatelessWidget {
  const _ThinkingBubble({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Padding(
        padding: EdgeInsets.symmetric(vertical: 8),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
            SizedBox(width: 10),
            Text(text, style: const TextStyle(color: Color(0xFFA9B0C2))),
          ],
        ),
      ),
    );
  }
}

class _AiMessage {
  _AiMessage({
    required this.text,
    required this.fromUser,
    this.isError = false,
    this.kundliGrounded = false,
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();

  final String text;
  final bool fromUser;
  final bool isError;
  final bool kundliGrounded;
  final DateTime createdAt;
}
