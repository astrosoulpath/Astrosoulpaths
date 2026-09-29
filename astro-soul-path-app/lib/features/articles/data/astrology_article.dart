class AstrologyArticle {
  const AstrologyArticle({
    required this.id,
    required this.slug,
    required this.category,
    required this.locale,
    required this.title,
    required this.contentMarkdown,
    required this.readingMinutes,
    this.coverImageUrl,
    this.excerpt,
    this.authorName,
    this.festivalTags = const [],
    this.publishedAt,
  });

  final String id;
  final String slug;
  final String? coverImageUrl;
  final String category;
  final List<String> festivalTags;
  final String locale;
  final String title;
  final String? excerpt;
  final String contentMarkdown;
  final String? authorName;
  final int readingMinutes;
  final DateTime? publishedAt;

  factory AstrologyArticle.fromJson(Map<String, dynamic> json) {
    return AstrologyArticle(
      id: json['id']?.toString() ?? '',
      slug: json['slug']?.toString() ?? '',
      coverImageUrl: json['coverImageUrl']?.toString(),
      category: json['category']?.toString() ?? 'ASTROLOGY',
      festivalTags: (json['festivalTags'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
      locale: json['locale']?.toString() ?? 'en',
      title: json['title']?.toString() ?? '',
      excerpt: json['excerpt']?.toString(),
      contentMarkdown: json['contentMarkdown']?.toString() ?? '',
      authorName: json['authorName']?.toString(),
      readingMinutes: (json['readingMinutes'] as num?)?.toInt() ?? 3,
      publishedAt: json['publishedAt'] == null
          ? null
          : DateTime.tryParse(json['publishedAt'].toString()),
    );
  }
}
