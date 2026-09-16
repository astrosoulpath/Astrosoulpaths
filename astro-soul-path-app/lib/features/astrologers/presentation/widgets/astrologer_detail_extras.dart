import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import '../../../../core/config/api_config.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../reviews/data/astrologer_review.dart';
import '../../../reviews/data/review_api.dart';
import '../../data/public_astrologer.dart';

class AstrologerDetailExtras extends StatefulWidget {
  const AstrologerDetailExtras({
    required this.astrologer,
    required this.onAstrologerTap,
    super.key,
  });

  final PublicAstrologer astrologer;
  final ValueChanged<String> onAstrologerTap;

  @override
  State<AstrologerDetailExtras> createState() => _AstrologerDetailExtrasState();
}

class _AstrologerDetailExtrasState extends State<AstrologerDetailExtras> {
  final _reviewApi = ReviewApi();
  final _client = http.Client();

  AstrologerReviewSummary? _summary;

  List<PublicAstrologer> _similar = const <PublicAstrologer>[];

  bool _loadingReviews = true;
  bool _loadingSimilar = true;

  @override
  void initState() {
    super.initState();

    _loadReviews();
    _loadSimilarAstrologers();
  }

  @override
  void didUpdateWidget(covariant AstrologerDetailExtras oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (oldWidget.astrologer.id != widget.astrologer.id) {
      _loadReviews();
      _loadSimilarAstrologers();
    }
  }

  @override
  void dispose() {
    _reviewApi.close();
    _client.close();
    super.dispose();
  }

  Future<void> _loadReviews() async {
    if (mounted) {
      setState(() {
        _loadingReviews = true;
      });
    }

    try {
      final result = await _reviewApi.getAstrologerReviews(
        widget.astrologer.id,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _summary = result;
      });
    } catch (_) {
      // Public review section must not block the full profile.
    } finally {
      if (mounted) {
        setState(() {
          _loadingReviews = false;
        });
      }
    }
  }

  Future<void> _loadSimilarAstrologers() async {
    if (mounted) {
      setState(() {
        _loadingSimilar = true;
      });
    }

    try {
      final response = await _client
          .get(
            Uri.parse('${ApiConfig.baseUrl}/astrologer/public'),
            headers: const {'Accept': 'application/json'},
          )
          .timeout(ApiConfig.requestTimeout);

      if (response.statusCode < 200 || response.statusCode >= 300) {
        return;
      }

      final decoded = jsonDecode(response.body);

      if (decoded is! Map) {
        return;
      }

      final root = Map<String, dynamic>.from(decoded);

      final rawList = root['data'] ?? root['astrologers'] ?? const <dynamic>[];

      if (rawList is! List) {
        return;
      }

      final all = rawList
          .whereType<Map>()
          .map(
            (item) =>
                PublicAstrologer.fromJson(Map<String, dynamic>.from(item)),
          )
          .where(
            (item) => item.id.isNotEmpty && item.id != widget.astrologer.id,
          )
          .toList();

      final currentExpertise = widget.astrologer.expertise
          .map((item) => item.trim().toLowerCase())
          .where((item) => item.isNotEmpty)
          .toSet();

      final currentLanguages = widget.astrologer.languages
          .map((item) => item.trim().toLowerCase())
          .where((item) => item.isNotEmpty)
          .toSet();

      int score(PublicAstrologer item) {
        var value = 0;

        final expertise = item.expertise
            .map((e) => e.trim().toLowerCase())
            .toSet();

        final languages = item.languages
            .map((e) => e.trim().toLowerCase())
            .toSet();

        value += expertise.intersection(currentExpertise).length * 10;

        value += languages.intersection(currentLanguages).length * 3;

        if (item.isOnline) {
          value += 2;
        }

        value += item.rating.round();

        return value;
      }

      all.sort((a, b) {
        final scoreCompare = score(b).compareTo(score(a));

        if (scoreCompare != 0) {
          return scoreCompare;
        }

        return b.rating.compareTo(a.rating);
      });

      if (!mounted) {
        return;
      }

      setState(() {
        _similar = all.take(5).toList(growable: false);
      });
    } catch (_) {
      // Similar astrologers are supplementary.
    } finally {
      if (mounted) {
        setState(() {
          _loadingSimilar = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [_buildReviews(), const SizedBox(height: 26), _buildSimilar()],
    );
  }

  Widget _buildReviews() {
    final summary = _summary;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            const Expanded(
              child: Text(
                'Ratings & Reviews',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
            if (summary != null && summary.reviews.isNotEmpty)
              TextButton(
                onPressed: () => _showAllReviews(summary),
                child: const Text(
                  'See all',
                  style: TextStyle(
                    color: AppColors.gold,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 12),

        if (_loadingReviews)
          const Center(
            child: Padding(
              padding: EdgeInsets.all(18),
              child: CircularProgressIndicator(color: AppColors.gold),
            ),
          )
        else if (summary == null || summary.totalReviews == 0)
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppColors.border),
            ),
            child: const Row(
              children: [
                Icon(Icons.star_border_rounded, color: AppColors.gold),
                SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'No customer reviews yet.',
                    style: TextStyle(
                      color: AppColors.muted,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          )
        else ...[
          _RatingSummaryCard(summary: summary),
          const SizedBox(height: 12),
          ...summary.reviews
              .take(3)
              .map(
                (review) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _ReviewCard(review: review),
                ),
              ),
        ],
      ],
    );
  }

  Widget _buildSimilar() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Similar Astrologers',
          style: TextStyle(
            color: AppColors.white,
            fontSize: 20,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 12),

        if (_loadingSimilar)
          const Center(
            child: Padding(
              padding: EdgeInsets.all(18),
              child: CircularProgressIndicator(color: AppColors.gold),
            ),
          )
        else if (_similar.isEmpty)
          const Text(
            'No similar astrologers available right now.',
            style: TextStyle(color: AppColors.muted),
          )
        else
          SizedBox(
            height: 184,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: _similar.length,
              separatorBuilder: (_, _) => const SizedBox(width: 12),
              itemBuilder: (_, index) {
                final astrologer = _similar[index];

                return _SimilarAstrologerCard(
                  astrologer: astrologer,
                  onTap: () => widget.onAstrologerTap(astrologer.id),
                );
              },
            ),
          ),
      ],
    );
  }

  Future<void> _showAllReviews(AstrologerReviewSummary summary) async {
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.background,
      isScrollControlled: true,
      builder: (context) {
        return SafeArea(
          child: FractionallySizedBox(
            heightFactor: 0.86,
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 18, 12, 12),
                  child: Row(
                    children: [
                      const Expanded(
                        child: Text(
                          'Customer Reviews',
                          style: TextStyle(
                            color: AppColors.white,
                            fontSize: 21,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                      IconButton(
                        onPressed: () => Navigator.pop(context),
                        icon: const Icon(
                          Icons.close_rounded,
                          color: AppColors.white,
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(18, 8, 18, 26),
                    itemCount: summary.reviews.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (_, index) =>
                        _ReviewCard(review: summary.reviews[index]),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _RatingSummaryCard extends StatelessWidget {
  const _RatingSummaryCard({required this.summary});

  final AstrologerReviewSummary summary;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.gold.withValues(alpha: 0.32)),
      ),
      child: Row(
        children: [
          Text(
            summary.averageRating.toStringAsFixed(1),
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 34,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(width: 12),
          const Icon(Icons.star_rounded, color: AppColors.gold, size: 30),
          const SizedBox(width: 14),
          Expanded(
            child: Text(
              '${summary.totalReviews} customer '
              '${summary.totalReviews == 1 ? 'review' : 'reviews'}',
              style: const TextStyle(
                color: AppColors.muted,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ReviewCard extends StatelessWidget {
  const _ReviewCard({required this.review});

  final AstrologerReview review;

  String get _countryFlag {
    final code = review.countryCode.trim().toUpperCase();

    if (!RegExp(r'^[A-Z]{2}$').hasMatch(code)) {
      return '';
    }

    return String.fromCharCodes(
      code.codeUnits.map((char) => 0x1F1E6 + char - 65),
    );
  }
  String get _consultationLabel {
    final mode = review.consultationType.toLowerCase();
    if (mode == 'chat') return 'Chat';
    if (mode == 'video') return 'Video Call';
    if (mode == 'audio' || mode == 'call') return 'Call';
    return 'Consultation';
  }

  IconData get _consultationIcon {
    final mode = review.consultationType.toLowerCase();
    if (mode == 'chat') return Icons.chat_bubble_outline_rounded;
    if (mode == 'video') return Icons.videocam_outlined;
    return Icons.call_outlined;
  }

  String get _dateLabel {
    final date = review.createdAt;
    if (date == null) return '';

    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    return '${date.day} ${months[date.month - 1]} ${date.year}';
  }

  @override
  Widget build(BuildContext context) {
    final name = review.customerName.trim().isEmpty
        ? 'Customer'
        : review.customerName.trim();

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 21,
                backgroundColor: AppColors.surfaceLight,
                child: Text(
                  name[0].toUpperCase(),
                  style: const TextStyle(
                    color: AppColors.gold,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              const SizedBox(width: 12),

              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: AppColors.white,
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                        if (_countryFlag.isNotEmpty) ...[
                          const SizedBox(width: 7),
                          Text(
                            _countryFlag,
                            style: const TextStyle(fontSize: 17),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 5),

                    Row(
                      children: List.generate(
                        5,
                        (index) => Icon(
                          index < review.rating
                              ? Icons.star_rounded
                              : Icons.star_border_rounded,
                          size: 17,
                          color: AppColors.gold,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              if (_dateLabel.isNotEmpty)
                Text(
                  _dateLabel,
                  style: const TextStyle(
                    color: AppColors.muted,
                    fontSize: 11,
                  ),
                ),
            ],
          ),

          const SizedBox(height: 12),

          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: 10,
              vertical: 6,
            ),
            decoration: BoxDecoration(
              color: AppColors.surfaceLight,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  _consultationIcon,
                  size: 14,
                  color: AppColors.gold,
                ),
                const SizedBox(width: 6),
                Text(
                  _consultationLabel,
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),

          if (review.review.isNotEmpty) ...[
            const SizedBox(height: 13),
            Text(
              review.review,
              style: const TextStyle(
                color: AppColors.muted,
                fontSize: 14,
                height: 1.55,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
class _SimilarAstrologerCard extends StatelessWidget {
  const _SimilarAstrologerCard({required this.astrologer, required this.onTap});

  final PublicAstrologer astrologer;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final avatar = astrologer.avatarUrl?.trim() ?? '';

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        width: 154,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          children: [
            CircleAvatar(
              radius: 31,
              backgroundColor: AppColors.surfaceLight,
              backgroundImage: avatar.isNotEmpty ? NetworkImage(avatar) : null,
              child: avatar.isEmpty
                  ? Text(
                      astrologer.name.isEmpty
                          ? 'A'
                          : astrologer.name[0].toUpperCase(),
                      style: const TextStyle(
                        color: AppColors.gold,
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                      ),
                    )
                  : null,
            ),
            const SizedBox(height: 9),
            Text(
              astrologer.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppColors.white,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              astrologer.primaryExpertise,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: AppColors.muted, fontSize: 11),
            ),
            const Spacer(),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.star_rounded, size: 15, color: AppColors.gold),
                const SizedBox(width: 3),
                Text(
                  astrologer.ratingLabel,
                  style: const TextStyle(
                    color: AppColors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  width: 7,
                  height: 7,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: astrologer.isOnline
                        ? const Color(0xFF42D468)
                        : AppColors.muted,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}


