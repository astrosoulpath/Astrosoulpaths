import 'dart:async';

import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../data/category_ai_api.dart';

enum AspAiCategory { love, career, marriage, stockMarket, today, business }

class CategoryAiChatScreen extends StatefulWidget {
  const CategoryAiChatScreen({super.key, required this.category});

  final AspAiCategory category;

  @override
  State<CategoryAiChatScreen> createState() => _CategoryAiChatScreenState();
}

class _CategoryAiChatScreenState extends State<CategoryAiChatScreen> {
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _suggestionScrollController = ScrollController();

  Timer? _suggestionTimer;

  final CategoryAiApi _api = CategoryAiApi();

  final List<_CategoryChatMessage> _messages = <_CategoryChatMessage>[];

  bool _isSending = false;
  String? _errorMessage;
  String? _lastFailedQuestion;

  _CategoryConfig get _config => _CategoryConfig.from(widget.category);

  String get _categoryApiKey {
    switch (widget.category) {
      case AspAiCategory.love:
        return 'love';

      case AspAiCategory.career:
        return 'career';

      case AspAiCategory.marriage:
        return 'marriage';

      case AspAiCategory.stockMarket:
        return 'stock_market';

      case AspAiCategory.today:
        return 'today';

      case AspAiCategory.business:
        return 'business';
    }
  }

  @override
  void initState() {
    super.initState();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _startSuggestionAnimation();
    });
  }

  @override
  void dispose() {
    _suggestionTimer?.cancel();
    _messageController.dispose();
    _suggestionScrollController.dispose();
    _api.dispose();
    super.dispose();
  }

  void _startSuggestionAnimation() {
    _suggestionTimer?.cancel();

    _suggestionTimer = Timer.periodic(const Duration(milliseconds: 2200), (_) {
      if (!mounted || !_suggestionScrollController.hasClients) {
        return;
      }

      final position = _suggestionScrollController.position;

      if (position.maxScrollExtent <= 0) {
        return;
      }

      final next = position.pixels + 155;

      if (next >= position.maxScrollExtent) {
        _suggestionScrollController.animateTo(
          0,
          duration: const Duration(milliseconds: 850),
          curve: Curves.easeInOutCubic,
        );
      } else {
        _suggestionScrollController.animateTo(
          next,
          duration: const Duration(milliseconds: 850),
          curve: Curves.easeInOutCubic,
        );
      }
    });
  }

  void _selectSuggestion(String value) {
    if (_isSending) {
      return;
    }

    _messageController.text = value;
    _messageController.selection = TextSelection.collapsed(
      offset: _messageController.text.length,
    );

    unawaited(_submitMessage());
  }

  Future<void> _submitMessage() async {
    final question = _messageController.text.trim();

    if (question.isEmpty || _isSending) {
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

    if (cleanQuestion.isEmpty || _isSending) {
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

    try {
      final response = await _api.ask(
        category: _categoryApiKey,
        question: cleanQuestion,
        language: 'en',
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _messages.add(
          _CategoryChatMessage(text: response.answer, fromUser: false),
        );

        _isSending = false;
        _errorMessage = null;
        _lastFailedQuestion = null;
      });
    } on CategoryAiApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _isSending = false;
        _errorMessage = error.message;
        _lastFailedQuestion = cleanQuestion;
      });
    } catch (_) {
      if (!mounted) {
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

  @override
  Widget build(BuildContext context) {
    final config = _config;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        elevation: 0,
        backgroundColor: AppColors.background,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          onPressed: () => Navigator.of(context).maybePop(),
          icon: const Icon(Icons.arrow_back_rounded, color: AppColors.white),
        ),
        titleSpacing: 2,
        title: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(13),
                border: Border.all(
                  color: AppColors.gold.withValues(alpha: 0.75),
                ),
              ),
              child: Icon(config.icon, color: AppColors.gold, size: 23),
            ),
            const SizedBox(width: 11),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Kundli AI',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: AppColors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  Text(
                    config.subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 14),
            child: Center(
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 11,
                  vertical: 7,
                ),
                decoration: BoxDecoration(
                  color: AppColors.gold.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: AppColors.gold.withValues(alpha: 0.45),
                  ),
                ),
                child: const Row(
                  children: [
                    Icon(
                      Icons.auto_awesome_rounded,
                      size: 14,
                      color: AppColors.gold,
                    ),
                    SizedBox(width: 5),
                    Text(
                      'ASP AI',
                      style: TextStyle(
                        color: AppColors.gold,
                        fontSize: 11,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            Expanded(
              child: CustomScrollView(
                physics: const BouncingScrollPhysics(),
                slivers: [
                  SliverToBoxAdapter(child: _buildHero(config)),
                  SliverToBoxAdapter(child: _buildSuggestionSection(config)),
                  SliverFillRemaining(
                    hasScrollBody: false,
                    child: SingleChildScrollView(
                      keyboardDismissBehavior:
                          ScrollViewKeyboardDismissBehavior.onDrag,
                      child: _buildConversationArea(config),
                    ),
                  ),
                ],
              ),
            ),
            _buildComposer(config),
          ],
        ),
      ),
    );
  }

  Widget _buildHero(_CategoryConfig config) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 14, 18, 12),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 22),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(26),
          border: Border.all(color: AppColors.gold.withValues(alpha: 0.35)),
          boxShadow: [
            BoxShadow(
              color: AppColors.gold.withValues(alpha: 0.06),
              blurRadius: 24,
              offset: const Offset(0, 12),
            ),
          ],
        ),
        child: Column(
          children: [
            Container(
              width: 92,
              height: 92,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.background,
                border: Border.all(color: AppColors.gold, width: 1.4),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.gold.withValues(alpha: 0.18),
                    blurRadius: 22,
                  ),
                ],
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Icon(config.icon, size: 42, color: AppColors.gold),
                  const Positioned(
                    right: 13,
                    top: 12,
                    child: Icon(
                      Icons.auto_awesome,
                      size: 16,
                      color: AppColors.gold,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Text(
              config.heroTitle,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: AppColors.white,
                fontSize: 25,
                height: 1.08,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 9),
            Text(
              config.description,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: AppColors.muted,
                fontSize: 13,
                height: 1.45,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 17),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
              decoration: BoxDecoration(
                color: AppColors.gold.withValues(alpha: 0.09),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: AppColors.gold.withValues(alpha: 0.22),
                ),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.stars_rounded, color: AppColors.gold, size: 16),
                  SizedBox(width: 7),
                  Flexible(
                    child: Text(
                      'Personalized guidance with your Kundli',
                      style: TextStyle(
                        color: AppColors.gold,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSuggestionSection(_CategoryConfig config) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(18, 6, 18, 9),
          child: Text(
            'Popular questions',
            style: TextStyle(
              color: AppColors.white,
              fontSize: 16,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
        SizedBox(
          height: 46,
          child: ListView.separated(
            controller: _suggestionScrollController,
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 18),
            itemCount: config.suggestions.length,
            separatorBuilder: (_, _) => const SizedBox(width: 9),
            itemBuilder: (context, index) {
              final suggestion = config.suggestions[index];

              return InkWell(
                borderRadius: BorderRadius.circular(15),
                onTap: () => _selectSuggestion(suggestion),
                child: Container(
                  constraints: const BoxConstraints(
                    minWidth: 170,
                    maxWidth: 275,
                  ),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(15),
                    border: Border.all(
                      color: AppColors.gold.withValues(alpha: 0.22),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(config.icon, size: 16, color: AppColors.gold),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          suggestion,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
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
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildConversationArea(_CategoryConfig config) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_messages.isEmpty)
            _buildAiBubble(config.welcomeQuestion, icon: config.icon),

          for (final message in _messages) ...[
            if (message.fromUser)
              _buildUserBubble(message.text)
            else
              _buildAiBubble(message.text, icon: config.icon),

            const SizedBox(height: 12),
          ],

          if (_isSending) ...[
            _buildThinkingBubble(config),
            const SizedBox(height: 12),
          ],

          if (_errorMessage != null) ...[
            _buildErrorBubble(),
            const SizedBox(height: 12),
          ],
        ],
      ),
    );
  }

  Widget _buildUserBubble(String text) {
    return Align(
      alignment: Alignment.centerRight,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 320),
        padding: const EdgeInsets.fromLTRB(15, 12, 15, 12),
        decoration: BoxDecoration(
          color: AppColors.gold,
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(18),
            topRight: Radius.circular(5),
            bottomLeft: Radius.circular(18),
            bottomRight: Radius.circular(18),
          ),
        ),
        child: Text(
          text,
          style: const TextStyle(
            color: Colors.black,
            fontSize: 14,
            height: 1.45,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }

  String _cleanAiDisplayText(String value) {
    var cleaned = value.replaceAll('**', '').replaceAll('__', '').trim();

    final lines = cleaned.split('\n');

    cleaned = lines
        .map((line) {
          final trimmed = line.trimLeft();

          if (trimmed.startsWith('###### ')) {
            return trimmed.substring(7);
          }

          if (trimmed.startsWith('##### ')) {
            return trimmed.substring(6);
          }

          if (trimmed.startsWith('#### ')) {
            return trimmed.substring(5);
          }

          if (trimmed.startsWith('### ')) {
            return trimmed.substring(4);
          }

          if (trimmed.startsWith('## ')) {
            return trimmed.substring(3);
          }

          if (trimmed.startsWith('# ')) {
            return trimmed.substring(2);
          }

          return line;
        })
        .join('\n')
        .trim();

    return cleaned;
  }

  Widget _buildAiBubble(String text, {required IconData icon}) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 350),
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(5),
            topRight: Radius.circular(19),
            bottomLeft: Radius.circular(19),
            bottomRight: Radius.circular(19),
          ),
          border: Border.all(color: AppColors.gold.withValues(alpha: 0.18)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 15, color: AppColors.gold),
                const SizedBox(width: 7),
                const Text(
                  'ASP AI',
                  style: TextStyle(
                    color: AppColors.gold,
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 9),
            SelectableText(
              _cleanAiDisplayText(text),
              style: const TextStyle(
                color: AppColors.white,
                fontSize: 14,
                height: 1.55,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildThinkingBubble(_CategoryConfig config) {
    final categoryName = config.subtitle
        .replaceAll(' Astro Assistant', '')
        .replaceAll(' Assistant', '');

    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 350),
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(5),
            topRight: Radius.circular(19),
            bottomLeft: Radius.circular(19),
            bottomRight: Radius.circular(19),
          ),
          border: Border.all(color: AppColors.gold.withValues(alpha: 0.18)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(
              width: 17,
              height: 17,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: AppColors.gold,
              ),
            ),
            const SizedBox(width: 10),
            Flexible(
              child: Text(
                'ASP AI is reading your Kundli for $categoryName...',
                style: const TextStyle(
                  color: AppColors.muted,
                  fontSize: 13,
                  height: 1.4,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorBubble() {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 350),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(17),
          border: Border.all(color: Colors.redAccent.withValues(alpha: 0.35)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _errorMessage ?? 'Something went wrong. Please try again.',
              style: const TextStyle(
                color: AppColors.white,
                fontSize: 13,
                height: 1.45,
              ),
            ),
            const SizedBox(height: 8),
            TextButton.icon(
              onPressed: _isSending
                  ? null
                  : () {
                      unawaited(_retryLastQuestion());
                    },
              style: TextButton.styleFrom(
                foregroundColor: AppColors.gold,
                padding: EdgeInsets.zero,
              ),
              icon: const Icon(Icons.refresh_rounded, size: 17),
              label: const Text(
                'Try again',
                style: TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildComposer(_CategoryConfig config) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.background,
        border: Border(
          top: BorderSide(color: AppColors.gold.withValues(alpha: 0.12)),
        ),
      ),
      padding: EdgeInsets.fromLTRB(
        14,
        10,
        14,
        10 + MediaQuery.paddingOf(context).bottom,
      ),
      child: Row(
        children: [
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(
                  color: AppColors.gold.withValues(alpha: 0.22),
                ),
              ),
              child: TextField(
                controller: _messageController,
                enabled: !_isSending,
                minLines: 1,
                maxLines: 4,
                textInputAction: TextInputAction.send,
                onSubmitted: (_) {
                  if (!_isSending) {
                    unawaited(_submitMessage());
                  }
                },
                style: const TextStyle(
                  color: AppColors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
                decoration: InputDecoration(
                  hintText: config.inputHint,
                  hintStyle: const TextStyle(
                    color: AppColors.muted,
                    fontSize: 13,
                  ),
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 17,
                    vertical: 13,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 9),
          Material(
            color: AppColors.gold,
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: _isSending
                  ? null
                  : () {
                      unawaited(_submitMessage());
                    },
              child: const SizedBox(
                width: 50,
                height: 50,
                child: Icon(Icons.send_rounded, color: Colors.black, size: 24),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CategoryChatMessage {
  const _CategoryChatMessage({required this.text, required this.fromUser});

  final String text;
  final bool fromUser;
}

class _CategoryConfig {
  const _CategoryConfig({
    required this.subtitle,
    required this.heroTitle,
    required this.description,
    required this.welcomeQuestion,
    required this.inputHint,
    required this.icon,
    required this.suggestions,
  });

  final String subtitle;
  final String heroTitle;
  final String description;
  final String welcomeQuestion;
  final String inputHint;
  final IconData icon;
  final List<String> suggestions;

  factory _CategoryConfig.from(AspAiCategory category) {
    switch (category) {
      case AspAiCategory.love:
        return const _CategoryConfig(
          subtitle: 'Love & Relationship Guidance',
          heroTitle: 'Love that understands you',
          description:
              'Explore your love life, emotional patterns, compatibility and relationship timing through personalized Vedic guidance.',
          welcomeQuestion:
              'What would you like to understand about your love life?',
          inputHint: 'Ask your own question about Love & Relationships',
          icon: Icons.favorite_rounded,
          suggestions: <String>[],
        );

      case AspAiCategory.career:
        return const _CategoryConfig(
          subtitle: 'Career Astro Assistant',
          heroTitle: 'Career that talks',
          description:
              'Explore your professional direction, timing, strengths and opportunities through personalized Vedic guidance.',
          welcomeQuestion: 'What do you want to ask about your career?',
          inputHint: 'Ask anything about Career',
          icon: Icons.work_rounded,
          suggestions: <String>[],
        );

      case AspAiCategory.marriage:
        return const _CategoryConfig(
          subtitle: 'Marriage Astro Assistant',
          heroTitle: 'Marriage that talks',
          description:
              'Discuss relationship patterns, marriage timing and compatibility using your personalized Vedic context.',
          welcomeQuestion: 'What do you want to ask about marriage?',
          inputHint: 'Ask anything about Marriage',
          icon: Icons.favorite_rounded,
          suggestions: <String>[],
        );

      case AspAiCategory.stockMarket:
        return const _CategoryConfig(
          subtitle: 'Financial Astrology Assistant',
          heroTitle: 'Market guidance that talks',
          description:
              'Understand financial tendencies and Vedic timing indicators without replacing professional investment advice.',
          welcomeQuestion: 'What do you want to ask about Stock Market?',
          inputHint: 'Ask anything about Stock Market',
          icon: Icons.candlestick_chart_rounded,
          suggestions: <String>[],
        );

      case AspAiCategory.today:
        return const _CategoryConfig(
          subtitle: 'Daily Vedic Assistant',
          heroTitle: 'Today that talks',
          description:
              'Get personalized daily Vedic guidance based on your Kundli context and current astrological influences.',
          welcomeQuestion: 'What do you want to know about today?',
          inputHint: 'Ask anything about Today',
          icon: Icons.event_available_rounded,
          suggestions: <String>[],
        );

      case AspAiCategory.business:
        return const _CategoryConfig(
          subtitle: 'Business Astro Assistant',
          heroTitle: 'Business that talks',
          description:
              'Explore entrepreneurship, business timing, decision patterns and professional strengths through Vedic guidance.',
          welcomeQuestion: 'What do you want to ask about business?',
          inputHint: 'Ask anything about Business',
          icon: Icons.business_center_rounded,
          suggestions: <String>[],
        );
    }
  }
}
