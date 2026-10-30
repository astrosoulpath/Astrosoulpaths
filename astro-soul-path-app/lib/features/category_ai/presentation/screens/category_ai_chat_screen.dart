import 'dart:async';

import 'package:flutter/material.dart';
import '../widgets/premium_kundli_ai_presentation.dart';
import '../widgets/kundli_assistant_design.dart';
import '../../../auth/data/auth_session_store.dart';
import '../../../kundli/presentation/screens/customer_kundli_screen.dart';

import '../../../../core/theme/app_theme.dart';
import '../../data/category_ai_api.dart';
import '../../../astrologers/presentation/screens/astrologer_selection_screen.dart';

enum AspAiCategory {
  love,
  career,
  marriage,
  stockMarket,
  today,
  business,
  match,
}

class CategoryAiChatScreen extends StatefulWidget {
  const CategoryAiChatScreen({
    super.key,
    required this.category,
    this.showFreeChatSticker = false,
    this.freeChatMinutes = 0,
    this.onFreeChatStarted,
    this.api,
  });

  final CategoryAiApi? api;
  final AspAiCategory category;
  final bool showFreeChatSticker;
  final int freeChatMinutes;
  final VoidCallback? onFreeChatStarted;

  @override
  State<CategoryAiChatScreen> createState() => _CategoryAiChatScreenState();
}

class _CategoryAiChatScreenState extends State<CategoryAiChatScreen> {
  final TextEditingController _messageController = TextEditingController();

  Timer? _sessionTimer;

  late CategoryAiApi _api;

  final List<_CategoryChatMessage> _messages = <_CategoryChatMessage>[];

  bool _isSending = false;
  String? _errorMessage;
  String? _lastFailedQuestion;
  bool _hideFreeChatSticker = false;
  bool? _marriageGrounded;

  final int _sessionRevision = AuthSessionStore.sessionRevision;
  int _requestGeneration = 0;
  bool _accountChanged = false;
  KundliAssistantDesign get _design => switch (widget.category) {
    AspAiCategory.love => loveAssistant,
    AspAiCategory.career => careerAssistant,
    AspAiCategory.marriage => marriageAssistant,
    AspAiCategory.match => matchAssistant,
    AspAiCategory.stockMarket => marketAssistant,
    AspAiCategory.today => todayAssistant,
    AspAiCategory.business => businessAssistant,
  };

  String get _categoryApiKey => _design.apiKey;

  @override
  void initState() {
    super.initState();
    _api = widget.api ?? CategoryAiApi();
    _sessionTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted &&
          !_accountChanged &&
          _sessionRevision != AuthSessionStore.sessionRevision) {
        setState(() {
          _accountChanged = true;
          _requestGeneration++;
          _messages.clear();
          _messageController.clear();
          _marriageGrounded = null;
          _lastFailedQuestion = null;
          _errorMessage = null;
          _isSending = false;
        });
      }
    });
  }

  @override
  void didUpdateWidget(covariant CategoryAiChatScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.category != widget.category) {
      _requestGeneration++;
      _messages.clear();
      _messageController.clear();
      _marriageGrounded = null;
      _lastFailedQuestion = null;
      _errorMessage = null;
      _isSending = false;
    }
  }

  @override
  void dispose() {
    _sessionTimer?.cancel();
    _requestGeneration++;
    _messageController.dispose();
    if (widget.api == null) _api.dispose();
    super.dispose();
  }

  Future<void> _submitMessage() async {
    final question = _messageController.text.trim();

    if (question.isEmpty ||
        _isSending ||
        _accountChanged ||
        _sessionRevision != AuthSessionStore.sessionRevision) {
      return;
    }

    _messageController.clear();

    FocusScope.of(context).unfocus();

    await _sendQuestion(question, addUserMessage: true);
  }

  Future<void> _sendQuestion(
    String question, {
    required bool addUserMessage,
  }) async {
    final cleanQuestion = question.trim();

    if (cleanQuestion.isEmpty ||
        _isSending ||
        _accountChanged ||
        _sessionRevision != AuthSessionStore.sessionRevision) {
      return;
    }

    setState(() {
      if (addUserMessage) {
        _messages.add(
          _CategoryChatMessage(text: cleanQuestion, fromUser: true),
        );
      }

      _isSending = true;
      _errorMessage = null;
      _lastFailedQuestion = null;
    });

    final generation = ++_requestGeneration;
    try {
      final response = await _api.ask(
        category: _categoryApiKey,
        question: cleanQuestion,
        language: 'en',
      );

      if (!mounted ||
          generation != _requestGeneration ||
          _sessionRevision != AuthSessionStore.sessionRevision) {
        return;
      }

      setState(() {
        _marriageGrounded =
            response.grounded &&
            (response.kundliId?.trim().isNotEmpty ?? false) &&
            response.source == 'LOCAL_VEDIC_KUNDLI' &&
            response.category == _categoryApiKey;
        _messages.add(
          _CategoryChatMessage(text: response.answer, fromUser: false),
        );

        _isSending = false;
        _errorMessage = null;
        _lastFailedQuestion = null;
      });
    } on CategoryAiApiException catch (error) {
      if (!mounted ||
          generation != _requestGeneration ||
          _sessionRevision != AuthSessionStore.sessionRevision) {
        return;
      }

      setState(() {
        _isSending = false;
        _errorMessage = error.message;
        _lastFailedQuestion = cleanQuestion;
      });
    } catch (_) {
      if (!mounted ||
          generation != _requestGeneration ||
          _sessionRevision != AuthSessionStore.sessionRevision) {
        return;
      }

      setState(() {
        _isSending = false;
        _errorMessage =
            'ASP AI could not read your Kundli right now. Please try again.';
        _lastFailedQuestion = cleanQuestion;
      });
    }
  }

  Future<void> _retryLastQuestion() async {
    final question = _lastFailedQuestion;

    if (question == null || question.trim().isEmpty || _isSending) {
      return;
    }

    await _sendQuestion(question, addUserMessage: false);
  }

  bool get _canShowFreeChatSticker {
    return widget.showFreeChatSticker &&
        widget.freeChatMinutes > 0 &&
        !_hideFreeChatSticker;
  }

  String get _freeChatStickerAsset {
    switch (widget.category) {
      case AspAiCategory.marriage:
        return 'assets/images/free_chat_stickers/free_chat_avatar_2.png';
      case AspAiCategory.business:
        return 'assets/images/free_chat_stickers/free_chat_avatar_3.png';
      default:
        return 'assets/images/free_chat_stickers/free_chat_avatar_1.png';
    }
  }

  String get _freeChatTopic {
    switch (widget.category) {
      case AspAiCategory.marriage:
        return 'Love & marriage guidance';
      case AspAiCategory.business:
        return 'Business guidance';
      default:
        return '${_design.title} guidance';
    }
  }

  Future<void> _openFreeChat() async {
    final freeChatStarted = await Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(
        builder: (_) => AstrologerSelectionScreen(
          screenTitle: 'Choose Your Vedic Astrologer',
          isFreeChatIntent: true,
          freeChatMinutes: widget.freeChatMinutes,
        ),
      ),
    );

    if (!mounted || freeChatStarted != true) {
      return;
    }

    widget.onFreeChatStarted?.call();

    setState(() {
      _hideFreeChatSticker = true;
    });
  }

  Widget _buildFreeChatSticker() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 0, 18, 14),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Material(
            color: Colors.transparent,
            borderRadius: BorderRadius.circular(22),
            child: InkWell(
              borderRadius: BorderRadius.circular(22),
              onTap: _openFreeChat,
              child: Ink(
                padding: const EdgeInsets.fromLTRB(13, 13, 15, 13),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(22),
                  gradient: const LinearGradient(
                    colors: [Color(0xFF25113F), Color(0xFF552023)],
                  ),
                  border: Border.all(
                    color: AppColors.gold.withValues(alpha: 0.8),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.gold.withValues(alpha: 0.14),
                      blurRadius: 18,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: Image.asset(
                        _freeChatStickerAsset,
                        width: 66,
                        height: 66,
                        fit: BoxFit.cover,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'YOUR FIRST CHAT IS FREE',
                            style: TextStyle(
                              color: AppColors.gold,
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.4,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            _freeChatTopic,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.onSurface,
                              fontSize: 15,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            '${widget.freeChatMinutes} min with a verified astrologer',
                            style: TextStyle(
                              color: Theme.of(
                                context,
                              ).colorScheme.onSurfaceVariant,
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    const Icon(
                      Icons.arrow_forward_rounded,
                      color: AppColors.gold,
                      size: 24,
                    ),
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            top: -8,
            right: -8,
            child: Material(
              color: Theme.of(context).scaffoldBackgroundColor,
              shape: const CircleBorder(),
              child: IconButton(
                tooltip: 'Hide offer',
                onPressed: () {
                  setState(() {
                    _hideFreeChatSticker = true;
                  });
                },
                icon: Icon(
                  Icons.close_rounded,
                  size: 18,
                  color: Theme.of(context).colorScheme.onSurface,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_accountChanged ||
        _sessionRevision != AuthSessionStore.sessionRevision) {
      return Scaffold(
        appBar: AppBar(title: const Text('Kundli AI')),
        body: const Center(
          child: Text(
            'Your account changed. Reopen this assistant to continue.',
          ),
        ),
      );
    }
    return PremiumKundliAiPresentation(
      key: ValueKey(widget.category),
      design: _design,
      controller: _messageController,
      messages: _messages
          .map((m) => (text: m.text, fromUser: m.fromUser))
          .toList(),
      sending: _isSending,
      grounded: _marriageGrounded,
      error: _errorMessage,
      onSend: () => unawaited(_submitMessage()),
      onRetry: () => unawaited(_retryLastQuestion()),
      onBirthDetails: () => Navigator.of(context).push(
        MaterialPageRoute<void>(builder: (_) => const CustomerKundliScreen()),
      ),
      freeChat: _canShowFreeChatSticker ? _buildFreeChatSticker() : null,
    );
  }
}

class _CategoryChatMessage {
  const _CategoryChatMessage({required this.text, required this.fromUser});
  final String text;
  final bool fromUser;
}
