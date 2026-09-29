class AstrologyVideo {
  const AstrologyVideo({
    required this.id,
    required this.youtubeVideoId,
    required this.title,
    required this.category,
    this.thumbnailUrl,
    this.shortDescription,
    this.description,
  });

  final String id;
  final String youtubeVideoId;
  final String title;
  final String category;
  final String? thumbnailUrl;
  final String? shortDescription;
  final String? description;

  String get resolvedThumbnailUrl {
    final supplied = thumbnailUrl?.trim() ?? '';
    return supplied.isNotEmpty
        ? supplied
        : 'https://i.ytimg.com/vi/$youtubeVideoId/hqdefault.jpg';
  }

  factory AstrologyVideo.fromJson(Map<String, dynamic> json) {
    final rawLocalized =
        json['translation'] ?? json['localized'] ?? json['content'] ?? json;

    final localized = rawLocalized is Map
        ? Map<String, dynamic>.from(rawLocalized)
        : json;

    String value(Map<String, dynamic> source, String key) {
      final raw = source[key];
      return raw is String ? raw.trim() : '';
    }

    final title = value(localized, 'title');

    return AstrologyVideo(
      id: value(json, 'id'),
      youtubeVideoId: value(json, 'youtubeVideoId'),
      title: title.isEmpty ? 'Astrology lesson' : title,
      category: value(json, 'category').isEmpty
          ? 'ASTROLOGY_LESSONS'
          : value(json, 'category'),
      thumbnailUrl: value(json, 'thumbnailUrl'),
      shortDescription: value(localized, 'shortDescription'),
      description: value(localized, 'description'),
    );
  }
}
