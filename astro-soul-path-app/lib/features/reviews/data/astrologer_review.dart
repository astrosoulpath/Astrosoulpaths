class AstrologerReview {
  const AstrologerReview({
    required this.id,
    required this.customerName,
    required this.rating,
    required this.review,
    required this.country,
    required this.countryCode,
    required this.consultationType,
    required this.createdAt,
  });

  factory AstrologerReview.fromJson(Map<String, dynamic> json) {
    return AstrologerReview(
      id: json['id']?.toString().trim() ?? '',
      customerName: json['customerName']?.toString().trim() ?? 'Customer',
      rating: json['rating'] is num
          ? (json['rating'] as num).toInt()
          : int.tryParse(json['rating']?.toString() ?? '') ?? 0,
      review: json['review']?.toString().trim() ?? '',
      country: json['country']?.toString().trim() ?? '',
      countryCode: json['countryCode']?.toString().trim() ?? '',
      consultationType: json['consultationType']?.toString().trim() ?? '',
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? ''),
    );
  }

  final String id;
  final String customerName;
  final int rating;
  final String review;
  final String country;
  final String countryCode;
  final String consultationType;
  final DateTime? createdAt;
}

class AstrologerReviewSummary {
  const AstrologerReviewSummary({
    required this.astrologerId,
    required this.averageRating,
    required this.totalReviews,
    required this.reviews,
  });

  factory AstrologerReviewSummary.fromJson(Map<String, dynamic> json) {
    final rawReviews = json['data'];

    final reviews = rawReviews is List
        ? rawReviews
              .whereType<Map>()
              .map(
                (item) =>
                    AstrologerReview.fromJson(Map<String, dynamic>.from(item)),
              )
              .toList(growable: false)
        : const <AstrologerReview>[];

    return AstrologerReviewSummary(
      astrologerId: json['astrologerId']?.toString().trim() ?? '',
      averageRating: json['averageRating'] is num
          ? (json['averageRating'] as num).toDouble()
          : double.tryParse(json['averageRating']?.toString() ?? '') ?? 0,
      totalReviews: json['totalReviews'] is num
          ? (json['totalReviews'] as num).toInt()
          : int.tryParse(json['totalReviews']?.toString() ?? '') ??
                reviews.length,
      reviews: reviews,
    );
  }

  final String astrologerId;
  final double averageRating;
  final int totalReviews;
  final List<AstrologerReview> reviews;
}
