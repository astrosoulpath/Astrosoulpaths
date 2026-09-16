class AiAstroPricing {
  const AiAstroPricing({
    required this.configured,
    required this.isEnabled,
    required this.isFree,
    required this.pricePerQuestion,
    this.pricePerMinute,
    required this.currency,
    required this.label,
  });

  const AiAstroPricing.unconfigured()
    : configured = false,
      isEnabled = false,
      isFree = false,
      pricePerQuestion = null,
      pricePerMinute = null,
      currency = 'INR',
      label = 'Pricing not configured';

  final bool configured;
  final bool isEnabled;
  final bool isFree;
  final double? pricePerQuestion;
  final double? pricePerMinute;
  final String currency;
  final String label;

  String get displayLabel {
    if (!isEnabled) {
      return label;
    }

    if (isFree) {
      return 'Free';
    }

    final minuteRate = pricePerMinute;

    if (minuteRate != null && minuteRate > 0) {
      final amount = minuteRate % 1 == 0
          ? minuteRate.toStringAsFixed(0)
          : minuteRate.toStringAsFixed(2);

      final currencyLabel = currency.trim().toUpperCase() == 'INR'
          ? '\u20B9'
          : currency.trim().toUpperCase();

      return '$currencyLabel$amount/min';
    }

    final questionRate = pricePerQuestion;

    if (questionRate != null && questionRate > 0) {
      final amount = questionRate % 1 == 0
          ? questionRate.toStringAsFixed(0)
          : questionRate.toStringAsFixed(2);

      final currencyLabel = currency.trim().toUpperCase() == 'INR'
          ? '\u20B9'
          : currency.trim().toUpperCase();

      return '$currencyLabel$amount/question';
    }

    return label;
  }

  factory AiAstroPricing.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const AiAstroPricing.unconfigured();
    }

    return AiAstroPricing(
      configured: json['configured'] == true,
      isEnabled: json['isEnabled'] == true,
      isFree: json['isFree'] == true,
      pricePerQuestion: (json['pricePerQuestion'] as num?)?.toDouble(),
      pricePerMinute: json['pricePerMinute'] == null
          ? null
          : double.tryParse(json['pricePerMinute'].toString()),
      currency: (json['currency'] ?? 'INR').toString(),
      label: (json['label'] ?? 'Pricing not configured').toString(),
    );
  }
}

class AiAstroPersona {
  const AiAstroPersona({
    required this.id,
    required this.userId,
    required this.name,
    required this.avatarUrl,
    required this.subtitle,
    required this.description,
    required this.categories,
    required this.initials,
    required this.rating,
    this.totalReviews = 0,
    required this.available,
    required this.experience,
    required this.languages,
    required this.expertise,
    required this.source,
    this.aiPricing = const AiAstroPricing.unconfigured(),
  });

  final String id;
  final String userId;
  final String name;
  final String? avatarUrl;
  final String subtitle;
  final String description;
  final List<String> categories;
  final String initials;

  final double rating;
  final int totalReviews;
  final bool available;
  final int experience;
  final List<String> languages;
  final List<String> expertise;

  final String source;
  final AiAstroPricing aiPricing;

  bool get isDatabaseProfile => source == 'POSTGRESQL_ASTROLOGER_PROFILE';

  factory AiAstroPersona.fromJson(Map<String, dynamic> json) {
    final pricingSource = json['aiPricing'];

    final pricing = pricingSource is Map
        ? AiAstroPricing.fromJson(Map<String, dynamic>.from(pricingSource))
        : const AiAstroPricing.unconfigured();

    return AiAstroPersona(
      id: (json['id'] ?? '').toString(),
      userId: (json['userId'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      avatarUrl: json['avatarUrl']?.toString(),
      subtitle: (json['subtitle'] ?? '').toString(),
      description: (json['description'] ?? '').toString(),
      categories: (json['categories'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(growable: false),
      initials: (json['initials'] ?? '').toString(),
      rating: (json['rating'] as num?)?.toDouble() ?? 0,
      totalReviews: (json['totalReviews'] as num?)?.toInt() ?? 0,
      available: json['available'] == true,
      experience: (json['experience'] as num?)?.toInt() ?? 0,
      languages: (json['languages'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(growable: false),
      expertise: (json['expertise'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(growable: false),
      source: (json['source'] ?? '').toString(),
      aiPricing: pricing,
    );
  }
}

class AiConsultantType {
  const AiConsultantType({
    required this.code,
    required this.name,
    required this.description,
    required this.iconKey,
    required this.sortOrder,
    required this.requiresKundli,
    required this.safetyProfile,
  });

  final String code;
  final String name;
  final String description;
  final String iconKey;
  final int sortOrder;
  final bool requiresKundli;
  final String safetyProfile;

  factory AiConsultantType.fromJson(Map<String, dynamic> json) {
    return AiConsultantType(
      code: (json['code'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      description: (json['description'] ?? '').toString(),
      iconKey: (json['iconKey'] ?? '').toString(),
      sortOrder: (json['sortOrder'] as num?)?.toInt() ?? 0,
      requiresKundli: json['requiresKundli'] == true,
      safetyProfile: (json['safetyProfile'] ?? '').toString(),
    );
  }
}

class AiAstroCatalog {
  const AiAstroCatalog({
    required this.categories,
    required this.personas,
    required this.consultantTypes,
  });

  final List<String> categories;
  final List<AiAstroPersona> personas;
  final List<AiConsultantType> consultantTypes;
}

class AiAstroReview {
  const AiAstroReview({
    required this.id,
    required this.customerName,
    required this.rating,
    required this.review,
    required this.createdAt,
  });

  final String id;
  final String customerName;
  final int rating;
  final String review;
  final DateTime? createdAt;

  factory AiAstroReview.fromJson(Map<String, dynamic> json) {
    return AiAstroReview(
      id: (json['id'] ?? '').toString(),
      customerName: (json['customerName'] ?? 'Astro Soul Path User').toString(),
      rating: (json['rating'] as num?)?.toInt() ?? 0,
      review: (json['review'] ?? '').toString(),
      createdAt: DateTime.tryParse((json['createdAt'] ?? '').toString()),
    );
  }
}

class AiAstroReviewsResult {
  const AiAstroReviewsResult({
    required this.averageRating,
    required this.totalReviews,
    required this.reviews,
  });

  final double averageRating;
  final int totalReviews;
  final List<AiAstroReview> reviews;
}
