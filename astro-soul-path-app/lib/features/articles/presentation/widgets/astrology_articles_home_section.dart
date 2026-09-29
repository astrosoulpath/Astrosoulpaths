import 'dart:ui';

import 'package:flutter/material.dart';

import '../../data/astrology_article.dart';
import '../../data/astrology_articles_api.dart';
import '../screens/astrology_article_detail_screen.dart';

class AstrologyArticlesHomeSection extends StatefulWidget {
  const AstrologyArticlesHomeSection({super.key});

  @override
  State<AstrologyArticlesHomeSection> createState() =>
      _AstrologyArticlesHomeSectionState();
}

class _AstrologyArticlesHomeSectionState
    extends State<AstrologyArticlesHomeSection> {
  final _api = AstrologyArticlesApi();
  List<AstrologyArticle> _articles = const [];
  bool _loading = true;
  bool _didLoad = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_didLoad) return;
    _didLoad = true;
    _load();
  }

  Future<void> _load() async {
    final locale = Localizations.localeOf(context);
    final language = locale.languageCode.trim().isEmpty
        ? 'en'
        : locale.languageCode.toLowerCase();
    final country = PlatformDispatcher.instance.locale.countryCode?.trim();

    try {
      final articles = await _api.getPublishedArticles(
        locale: language,
        country: country,
      );

      if (mounted) {
        setState(() {
          _articles = articles;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _api.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Padding(
        padding: EdgeInsets.fromLTRB(20, 18, 20, 8),
        child: LinearProgressIndicator(),
      );
    }

    if (_articles.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(top: 18, bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 20),
            child: Text(
              'Top Articles',
              style: TextStyle(
                color: Color(0xFF17213A),
                fontSize: 23,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 228,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              scrollDirection: Axis.horizontal,
              itemCount: _articles.length,
              separatorBuilder: (_, _) => const SizedBox(width: 12),
              itemBuilder: (context, index) {
                final article = _articles[index];

                return InkWell(
                  borderRadius: BorderRadius.circular(18),
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) =>
                            AstrologyArticleDetailScreen(article: article),
                      ),
                    );
                  },
                  child: Container(
                    width: 190,
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(
                        color: const Color(0xFFF0C857),
                        width: 1.2,
                      ),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x1A7A5A10),
                          blurRadius: 16,
                          offset: Offset(0, 7),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _cover(article),
                        const SizedBox(height: 10),
                        Text(
                          article.category.replaceAll('_', ' '),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Color(0xFF9D7000),
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          article.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Color(0xFF17213A),
                            fontSize: 15,
                            height: 1.16,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const Spacer(),
                        Text(
                          '${article.readingMinutes} min read',
                          style: const TextStyle(
                            color: Color(0xFF756B78),
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
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
      ),
    );
  }

  Widget _cover(AstrologyArticle article) {
    final url = article.coverImageUrl?.trim();

    if (url?.isNotEmpty == true) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Image.network(
          url!,
          width: 168,
          height: 102,
          fit: BoxFit.cover,
          errorBuilder: (_, _, _) => _fallbackCover(),
        ),
      );
    }

    return _fallbackCover();
  }

  Widget _fallbackCover() {
    return Container(
      width: 168,
      height: 102,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        gradient: const LinearGradient(
          colors: [Color(0xFF1A2543), Color(0xFF7B5C15)],
        ),
      ),
      child: const Center(
        child: Icon(
          Icons.auto_awesome_rounded,
          color: Color(0xFFFFD96A),
          size: 36,
        ),
      ),
    );
  }
}
