import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../astrologers/presentation/screens/astrologer_selection_screen.dart';
import '../../data/astrology_questions_api.dart';
import '../../models/astrology_question_models.dart';

class AstrologyQuestionsScreen extends StatefulWidget {
  const AstrologyQuestionsScreen({super.key});

  @override
  State<AstrologyQuestionsScreen> createState() =>
      _AstrologyQuestionsScreenState();
}

class _AstrologyQuestionsScreenState extends State<AstrologyQuestionsScreen> {
  final AstrologyQuestionsApi _api = AstrologyQuestionsApi();

  bool _loading = true;
  String _error = '';
  List<AstrologyQuestionCategory> _categories = const [];

  @override
  void initState() {
    super.initState();
    _loadCategories();
  }

  Future<void> _loadCategories() async {
    setState(() {
      _loading = true;
      _error = '';
    });

    try {
      final categories = await _api.getCategories();

      if (!mounted) return;

      setState(() {
        _categories = categories;
        _loading = false;
      });
    } on AstrologyQuestionsApiException catch (error) {
      if (!mounted) return;

      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  IconData _iconFor(String value) {
    switch (value) {
      case 'favorite':
        return Icons.favorite_rounded;
      case 'diamond':
        return Icons.diamond_rounded;
      case 'work':
        return Icons.work_rounded;
      case 'business_center':
        return Icons.business_center_rounded;
      case 'account_balance_wallet':
        return Icons.account_balance_wallet_rounded;
      case 'health_and_safety':
        return Icons.health_and_safety_rounded;
      case 'school':
        return Icons.school_rounded;
      case 'family_restroom':
        return Icons.family_restroom_rounded;
      case 'child_care':
        return Icons.child_care_rounded;
      case 'home_work':
        return Icons.home_work_rounded;
      case 'flight_takeoff':
        return Icons.flight_takeoff_rounded;
      case 'gavel':
        return Icons.gavel_rounded;
      case 'self_improvement':
        return Icons.self_improvement_rounded;
      case 'auto_awesome':
        return Icons.auto_awesome_rounded;
      default:
        return Icons.help_outline_rounded;
    }
  }

  @override
  void dispose() {
    _api.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.white,
        elevation: 0,
        title: const Text(
          'Ask Astrology Question',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      body: RefreshIndicator(onRefresh: _loadCategories, child: _buildBody()),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return ListView(
        children: [
          SizedBox(height: 260),
          Center(child: CircularProgressIndicator(color: AppColors.gold)),
        ],
      );
    }

    if (_error.isNotEmpty) {
      return ListView(
        padding: const EdgeInsets.all(24),
        children: [
          const SizedBox(height: 120),
          const Icon(
            Icons.error_outline_rounded,
            color: AppColors.gold,
            size: 54,
          ),
          const SizedBox(height: 16),
          Text(
            _error,
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.white, fontSize: 16),
          ),
          const SizedBox(height: 18),
          FilledButton(onPressed: _loadCategories, child: const Text('Retry')),
        ],
      );
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 22, 18, 32),
      children: [
        const Text(
          'What would you like guidance about?',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: AppColors.white,
            fontSize: 24,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 8),
        const Text(
          'Choose a topic and select a question to continue.',
          textAlign: TextAlign.center,
          style: TextStyle(color: Color(0xFFB8C4D8), fontSize: 14),
        ),
        const SizedBox(height: 24),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: _categories.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            crossAxisSpacing: 14,
            mainAxisSpacing: 14,
            childAspectRatio: 0.95,
          ),
          itemBuilder: (context, index) {
            final category = _categories[index];

            return InkWell(
              borderRadius: BorderRadius.circular(20),
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) =>
                        AstrologyQuestionListScreen(category: category),
                  ),
                );
              },
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0x33D7B15B)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 46,
                      height: 46,
                      decoration: BoxDecoration(
                        color: const Color(0x1FD7B15B),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Icon(
                        _iconFor(category.icon),
                        color: AppColors.gold,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      category.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      '${category.questionCount} questions',
                      style: const TextStyle(
                        color: Color(0xFF9DAEC7),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ],
    );
  }
}

class AstrologyQuestionListScreen extends StatefulWidget {
  const AstrologyQuestionListScreen({required this.category, super.key});

  final AstrologyQuestionCategory category;

  @override
  State<AstrologyQuestionListScreen> createState() =>
      _AstrologyQuestionListScreenState();
}

class _AstrologyQuestionListScreenState
    extends State<AstrologyQuestionListScreen> {
  final AstrologyQuestionsApi _api = AstrologyQuestionsApi();

  bool _loading = true;
  String _error = '';
  List<AstrologyQuestion> _questions = const [];

  @override
  void initState() {
    super.initState();
    _loadQuestions();
  }

  Future<void> _loadQuestions() async {
    setState(() {
      _loading = true;
      _error = '';
    });

    try {
      final result = await _api.getQuestions(widget.category.slug);

      if (!mounted) return;

      setState(() {
        _questions = result.questions;
        _loading = false;
      });
    } on AstrologyQuestionsApiException catch (error) {
      if (!mounted) return;

      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  @override
  void dispose() {
    _api.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.white,
        title: Text(
          widget.category.name,
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.gold),
            )
          : _error.isNotEmpty
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  _error,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.white),
                ),
              ),
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(18, 20, 18, 30),
              children: [
                Text(
                  widget.category.description,
                  style: const TextStyle(
                    color: Color(0xFFB8C4D8),
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 18),
                ..._questions.map(
                  (question) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(16),
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => AstrologyAiAnswerScreen(
                              category: widget.category,
                              question: question,
                            ),
                          ),
                        );
                      },
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: const Color(0x22D7B15B)),
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.chat_bubble_outline_rounded,
                              color: AppColors.gold,
                            ),
                            const SizedBox(width: 13),
                            Expanded(
                              child: Text(
                                question.text,
                                style: const TextStyle(
                                  color: AppColors.white,
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                            const Icon(
                              Icons.chevron_right_rounded,
                              color: Color(0xFF8090A8),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}

class AstrologyAiAnswerScreen extends StatefulWidget {
  const AstrologyAiAnswerScreen({
    required this.category,
    required this.question,
    super.key,
  });

  final AstrologyQuestionCategory category;
  final AstrologyQuestion question;

  @override
  State<AstrologyAiAnswerScreen> createState() =>
      _AstrologyAiAnswerScreenState();
}

class _AstrologyAiAnswerScreenState extends State<AstrologyAiAnswerScreen> {
  final AstrologyQuestionsApi _api = AstrologyQuestionsApi();

  bool _loading = true;
  String _answer = '';
  String _message = '';
  String _error = '';
  bool _configured = false;

  @override
  void initState() {
    super.initState();
    _loadAnswer();
  }

  Future<void> _loadAnswer() async {
    setState(() {
      _loading = true;
      _error = '';
      _answer = '';
      _message = '';
    });

    try {
      final response = await _api.generateAnswer(
        questionId: widget.question.id,
        categorySlug: widget.category.slug,
      );

      if (!mounted) return;

      final rawData = response['data'];
      final data = rawData is Map
          ? Map<String, dynamic>.from(rawData)
          : <String, dynamic>{};

      setState(() {
        _configured = response['configured'] == true;
        _answer = data['answer']?.toString() ?? '';
        _message = data['message']?.toString() ?? '';
        _loading = false;
      });
    } on AstrologyQuestionsApiException catch (error) {
      if (!mounted) return;

      setState(() {
        _error = error.message;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;

      setState(() {
        _error = 'Unable to load astrology guidance.';
        _loading = false;
      });
    }
  }

  @override
  void dispose() {
    _api.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.white,
        title: const Text(
          'Your Astrology Guidance',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.gold),
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(18, 20, 18, 30),
              children: [
                Text(
                  widget.category.name,
                  style: const TextStyle(
                    color: AppColors.gold,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  widget.question.text,
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 22),
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: const Color(0x33D7B15B)),
                  ),
                  child: _error.isNotEmpty
                      ? Text(
                          _error,
                          style: const TextStyle(
                            color: AppColors.white,
                            fontSize: 15,
                          ),
                        )
                      : Text(
                          _configured
                              ? _answer
                              : (_message.isNotEmpty
                                    ? _message
                                    : 'AI astrology guidance is not configured yet.'),
                          style: const TextStyle(
                            color: AppColors.white,
                            fontSize: 16,
                            height: 1.5,
                          ),
                        ),
                ),
                const SizedBox(height: 20),
                FilledButton.icon(
                  onPressed: _loadAnswer,
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('Generate Again'),
                ),
                const SizedBox(height: 12),
                FilledButton.icon(
                  onPressed: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => AstrologerSelectionScreen(
                          astrologyQuestionId: widget.question.id,
                          astrologyQuestionText: widget.question.text,
                          astrologyCategorySlug: widget.category.slug,
                        ),
                      ),
                    );
                  },
                  icon: const Icon(Icons.chat_bubble_rounded),
                  label: const Text('Chat with Astrologer'),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: () {
                    Navigator.of(context).pop();
                  },
                  icon: const Icon(Icons.question_answer_rounded),
                  label: const Text('Ask Another Question'),
                ),
              ],
            ),
    );
  }
}
