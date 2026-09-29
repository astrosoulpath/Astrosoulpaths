import 'package:flutter/material.dart';

import '../../data/astrology_article.dart';

class AstrologyArticleDetailScreen extends StatelessWidget {
  const AstrologyArticleDetailScreen({required this.article, super.key});

  final AstrologyArticle article;

  String get _date {
    final value = article.publishedAt;
    if (value == null) return '';
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return '${months[value.month - 1]} ${value.day}, ${value.year}';
  }

  @override
  Widget build(BuildContext context) {
    final hasCover = article.coverImageUrl?.trim().isNotEmpty == true;

    return Scaffold(
      backgroundColor: const Color(0xFFFFFBF3),
      appBar: AppBar(
        backgroundColor: const Color(0xFFFFFBF3),
        foregroundColor: const Color(0xFF17213A),
        elevation: 0,
        title: const Text(
          'Article',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
        children: [
          if (hasCover)
            ClipRRect(
              borderRadius: BorderRadius.circular(22),
              child: Image.network(
                article.coverImageUrl!,
                height: 220,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => _fallbackCover(),
              ),
            )
          else
            _fallbackCover(),
          const SizedBox(height: 22),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _chip(article.category.replaceAll('_', ' ')),
              if (article.festivalTags.isNotEmpty)
                _chip(article.festivalTags.first.replaceAll('_', ' ')),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            article.title,
            style: const TextStyle(
              color: Color(0xFF17213A),
              fontSize: 29,
              height: 1.13,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 14),
          Text(
            [
              if (article.authorName?.trim().isNotEmpty == true)
                article.authorName!.trim(),
              if (_date.isNotEmpty) _date,
              '${article.readingMinutes} min read',
            ].join('  •  '),
            style: const TextStyle(
              color: Color(0xFF6E6470),
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (article.excerpt?.trim().isNotEmpty == true) ...[
            const SizedBox(height: 22),
            Text(
              article.excerpt!.trim(),
              style: const TextStyle(
                color: Color(0xFF715A27),
                fontSize: 18,
                height: 1.5,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
          const SizedBox(height: 24),
          Text(
            article.contentMarkdown,
            style: const TextStyle(
              color: Color(0xFF303848),
              fontSize: 17,
              height: 1.72,
            ),
          ),
        ],
      ),
    );
  }

  Widget _fallbackCover() {
    return Container(
      height: 220,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        gradient: const LinearGradient(
          colors: [Color(0xFF1A2543), Color(0xFF644C18)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: const Center(
        child: Icon(
          Icons.auto_awesome_rounded,
          size: 72,
          color: Color(0xFFFFD96A),
        ),
      ),
    );
  }

  Widget _chip(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0xFFFFEDB3),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: Color(0xFF765300),
          fontSize: 11,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}
