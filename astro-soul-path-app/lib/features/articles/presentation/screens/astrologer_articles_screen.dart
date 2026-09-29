import 'package:flutter/material.dart';

import '../../../auth/data/auth_session_store.dart';
import '../../data/astrologer_articles_api.dart';

class AstrologerArticlesScreen extends StatefulWidget {
  const AstrologerArticlesScreen({super.key});

  @override
  State<AstrologerArticlesScreen> createState() =>
      _AstrologerArticlesScreenState();
}

class _AstrologerArticlesScreenState extends State<AstrologerArticlesScreen> {
  final AstrologerArticlesApi _api = AstrologerArticlesApi();
  final AuthSessionStore _sessionStore = AuthSessionStore();

  bool _loading = true;
  bool _submitting = false;
  String? _error;
  List<Map<String, dynamic>> _articles = const [];

  @override
  void initState() {
    super.initState();
    _loadArticles();
  }

  Future<String> _accessToken() async {
    final session = await _sessionStore.read();
    return session?.accessToken.trim() ?? '';
  }

  Future<void> _loadArticles() async {
    if (mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }

    try {
      final token = await _accessToken();

      if (token.isEmpty) {
        throw const AstrologerArticlesApiException(
          'Login session not found. Please login again.',
        );
      }

      final articles = await _api.getMyArticles(accessToken: token);

      if (!mounted) return;

      setState(() {
        _articles = articles;
        _loading = false;
      });
    } on AstrologerArticlesApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Unable to load your articles.';
        _loading = false;
      });
    }
  }

  String _slugify(String value) {
    return value
        .trim()
        .toLowerCase()
        .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
        .replaceAll(RegExp(r'^-+|-+$'), '');
  }

  String _text(dynamic value) => value?.toString().trim() ?? '';

  String _title(Map<String, dynamic> article) {
    final direct = _text(article['title']);
    if (direct.isNotEmpty) return direct;

    final translations = article['translations'];
    if (translations is List && translations.isNotEmpty) {
      final first = translations.first;
      if (first is Map) {
        final title = _text(first['title']);
        if (title.isNotEmpty) return title;
      }
    }

    return 'Untitled Article';
  }

  String _status(Map<String, dynamic> article) {
    final value = _text(article['status']);
    return value.isEmpty ? 'DRAFT' : value.toUpperCase();
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'PUBLISHED':
        return const Color(0xFF42D392);
      case 'PENDING_REVIEW':
        return const Color(0xFFFFC857);
      case 'REJECTED':
        return const Color(0xFFFF6B6B);
      default:
        return const Color(0xFFB9A8CC);
    }
  }

  Future<void> _openCreateArticle() async {
    final titleController = TextEditingController();
    final excerptController = TextEditingController();
    final contentController = TextEditingController();
    final categoryController = TextEditingController();
    final authorController = TextEditingController();

    final submitted = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF17101F),
      builder: (sheetContext) {
        return Padding(
          padding: EdgeInsets.fromLTRB(
            20,
            20,
            20,
            MediaQuery.of(sheetContext).viewInsets.bottom + 24,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Submit New Article',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Your article will be sent for admin review.',
                  style: TextStyle(color: Color(0xFFC8BBD4)),
                ),
                const SizedBox(height: 20),
                _ArticleField(
                  controller: titleController,
                  label: 'Article title',
                ),
                const SizedBox(height: 12),
                _ArticleField(
                  controller: excerptController,
                  label: 'Short excerpt',
                  maxLines: 3,
                ),
                const SizedBox(height: 12),
                _ArticleField(
                  controller: contentController,
                  label: 'Article content',
                  maxLines: 10,
                ),
                const SizedBox(height: 12),
                _ArticleField(
                  controller: categoryController,
                  label: 'Category (optional)',
                ),
                const SizedBox(height: 12),
                _ArticleField(
                  controller: authorController,
                  label: 'Author name (optional)',
                ),
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: () {
                    final title = titleController.text.trim();
                    final content = contentController.text.trim();

                    if (title.length < 4) {
                      ScaffoldMessenger.of(sheetContext).showSnackBar(
                        const SnackBar(
                          content: Text(
                            'Title must contain at least 4 characters.',
                          ),
                        ),
                      );
                      return;
                    }

                    if (content.length < 40) {
                      ScaffoldMessenger.of(sheetContext).showSnackBar(
                        const SnackBar(
                          content: Text(
                            'Article content must contain at least 40 characters.',
                          ),
                        ),
                      );
                      return;
                    }

                    Navigator.of(sheetContext).pop(true);
                  },
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFFF4C45E),
                    foregroundColor: const Color(0xFF211628),
                    padding: const EdgeInsets.symmetric(vertical: 15),
                  ),
                  child: const Text(
                    'Submit for Review',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );

    if (submitted != true || !mounted) {
      return;
    }

    final title = titleController.text.trim();
    final excerpt = excerptController.text.trim();
    final content = contentController.text.trim();
    final category = categoryController.text.trim();
    final author = authorController.text.trim();

    setState(() => _submitting = true);

    try {
      final token = await _accessToken();

      if (token.isEmpty) {
        throw const AstrologerArticlesApiException(
          'Login session not found. Please login again.',
        );
      }

      await _api.submitArticle(
        accessToken: token,
        slug: _slugify(title),
        title: title,
        excerpt: excerpt,
        contentMarkdown: content,
        category: category,
        authorName: author,
      );

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Article submitted for admin review.')),
      );

      await _loadArticles();
    } on AstrologerArticlesApiException catch (error) {
      if (!mounted) return;

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
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
      backgroundColor: const Color(0xFF0B0713),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0B0713),
        foregroundColor: Colors.white,
        iconTheme: const IconThemeData(color: Colors.white),
        titleTextStyle: const TextStyle(
          color: Colors.white,
          fontSize: 20,
          fontWeight: FontWeight.w800,
        ),
        title: const Text(
          'My Articles',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _submitting ? null : _openCreateArticle,
        backgroundColor: const Color(0xFFF4C45E),
        foregroundColor: const Color(0xFF211628),
        icon: _submitting
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : const Icon(Icons.edit_note_rounded),
        label: Text(_submitting ? 'Submitting...' : 'Post Article'),
      ),
      body: RefreshIndicator(onRefresh: _loadArticles, child: _body()),
    );
  }

  Widget _body() {
    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFFF4C45E)),
      );
    }

    if (_error != null) {
      return ListView(
        padding: const EdgeInsets.all(24),
        children: [
          const SizedBox(height: 100),
          const Icon(
            Icons.article_outlined,
            color: Color(0xFFF4C45E),
            size: 54,
          ),
          const SizedBox(height: 18),
          Text(
            _error!,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white70),
          ),
          const SizedBox(height: 20),
          Center(
            child: OutlinedButton(
              onPressed: _loadArticles,
              child: const Text('Try Again'),
            ),
          ),
        ],
      );
    }

    if (_articles.isEmpty) {
      return ListView(
        padding: const EdgeInsets.all(24),
        children: const [
          SizedBox(height: 100),
          Icon(Icons.auto_stories_outlined, color: Color(0xFFF4C45E), size: 60),
          SizedBox(height: 18),
          Text(
            'No articles yet',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.white,
              fontSize: 21,
              fontWeight: FontWeight.w800,
            ),
          ),
          SizedBox(height: 8),
          Text(
            'Tap Post Article to submit your first astrology article.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Color(0xFFC8BBD4)),
          ),
        ],
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
      itemCount: _articles.length,
      separatorBuilder: (_, _) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final article = _articles[index];
        final status = _status(article);
        final color = _statusColor(status);

        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF17101F),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: const Color(0x33F4C45E)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: const Color(0x1AF4C45E),
                  borderRadius: BorderRadius.circular(13),
                ),
                child: const Icon(
                  Icons.article_rounded,
                  color: Color(0xFFF4C45E),
                ),
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _title(article),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 9,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(30),
                        border: Border.all(
                          color: color.withValues(alpha: 0.45),
                        ),
                      ),
                      child: Text(
                        status.replaceAll('_', ' '),
                        style: TextStyle(
                          color: color,
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
        );
      },
    );
  }
}

class _ArticleField extends StatelessWidget {
  const _ArticleField({
    required this.controller,
    required this.label,
    this.maxLines = 1,
  });

  final TextEditingController controller;
  final String label;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      maxLines: maxLines,
      style: const TextStyle(color: Colors.white),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(color: Color(0xFFC8BBD4)),
        filled: true,
        fillColor: const Color(0xFF211628),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: Color(0x335B4768)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: Color(0xFFF4C45E)),
        ),
      ),
    );
  }
}
