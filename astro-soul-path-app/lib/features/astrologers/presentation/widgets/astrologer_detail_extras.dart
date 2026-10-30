import 'cosmic_astrologer_profile.dart';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import '../../../../core/config/api_config.dart';
import '../../../../core/branding/premium_customer_surfaces.dart';
import '../../../reviews/data/astrologer_review.dart';
import '../../../reviews/data/review_api.dart';
import '../../data/public_astrologer.dart';

class AstrologerDetailExtras extends StatefulWidget {
  const AstrologerDetailExtras({
    required this.astrologer,
    required this.onAstrologerTap,
    this.showReviews = true,
    this.showSimilar = true,
    this.reviewApi,
    this.client,
    super.key,
  });

  final PublicAstrologer astrologer;
  final ValueChanged<String> onAstrologerTap;
  final http.Client? client;
  final bool showReviews;
  final bool showSimilar;
  final ReviewApi? reviewApi;

  @override
  State<AstrologerDetailExtras> createState() => _AstrologerDetailExtrasState();
}

class _AstrologerDetailExtrasState extends State<AstrologerDetailExtras> {
  late final _reviewApi = widget.reviewApi ?? ReviewApi();
  late final _client = widget.client ?? http.Client();

  AstrologerReviewSummary? _summary;

  List<PublicAstrologer> _similar = const <PublicAstrologer>[];

  bool _loadingReviews = true;
  bool _loadingSimilar = true;
  bool _reviewError = false;
  int _reviewRequest = 0;
  int _similarRequest = 0;
  bool _similarError = false;

  @override
  void initState() {
    super.initState();

    if (widget.showReviews) {
      _loadReviews();
    }
    if (widget.showSimilar) {
      _loadSimilarAstrologers();
    }
  }

  @override
  void didUpdateWidget(covariant AstrologerDetailExtras oldWidget) {
    super.didUpdateWidget(oldWidget);

    final changed = oldWidget.astrologer.id != widget.astrologer.id;
    if (widget.showReviews && (changed || !oldWidget.showReviews)) {
      _loadReviews();
    }
    if (widget.showSimilar && (changed || !oldWidget.showSimilar)) {
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
    final request = ++_reviewRequest;
    if (mounted) {
      setState(() {
        _loadingReviews = true;
        _reviewError = false;
        _summary = null;
      });
    }

    try {
      final result = await _reviewApi.getAstrologerReviews(
        widget.astrologer.id,
      );

      if (!mounted || request != _reviewRequest) {
        return;
      }

      setState(() {
        _summary = result;
      });
    } catch (_) {
      if (mounted && request == _reviewRequest) {
        setState(() => _reviewError = true);
      }
    } finally {
      if (mounted && request == _reviewRequest) {
        setState(() {
          _loadingReviews = false;
        });
      }
    }
  }

  Future<void> _loadSimilarAstrologers() async {
    final request = ++_similarRequest;
    if (mounted) {
      setState(() {
        _loadingSimilar = true;
        _similarError = false;
        _similar = const [];
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
        throw const FormatException('Recommendations unavailable');
      }

      final decoded = jsonDecode(response.body);

      if (decoded is! Map) {
        throw const FormatException('Invalid recommendations');
      }

      final root = Map<String, dynamic>.from(decoded);

      final rawList = root['data'] ?? root['astrologers'];

      if (rawList is! List) {
        throw const FormatException('Invalid recommendations');
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

      if (!mounted || request != _similarRequest) {
        return;
      }

      setState(() {
        _similar = all.take(5).toList(growable: false);
      });
    } catch (_) {
      if (mounted && request == _similarRequest) {
        setState(() => _similarError = true);
      }
    } finally {
      if (mounted && request == _similarRequest) {
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
      children: [
        if (widget.showReviews) _buildReviews(),
        if (widget.showReviews && widget.showSimilar)
          const SizedBox(height: 26),
        if (widget.showSimilar) _buildSimilar(),
      ],
    );
  }

  Widget _buildReviews() {
    final summary = _summary;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Ratings & Reviews',
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurface,
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
                    color: premiumGold,
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
              child: CircularProgressIndicator(color: premiumGold),
            ),
          )
        else if (_reviewError)
          Column(
            children: [
              Text(
                'Reviews could not be loaded.',
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurface,
                  fontSize: 16,
                ),
              ),
              TextButton(
                onPressed: _loadReviews,
                child: const Text('Try again'),
              ),
            ],
          )
        else if (summary == null || summary.totalReviews == 0)
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Theme.of(context).colorScheme.outline),
            ),
            child: Row(
              children: [
                Icon(Icons.star_border_rounded, color: premiumGold),
                SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'No customer reviews yet.',
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
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
        Text(
          'Similar Astrologers',
          style: TextStyle(
            color: Theme.of(context).colorScheme.onSurface,
            fontSize: 20,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 12),

        if (_loadingSimilar)
          const Center(
            child: Padding(
              padding: EdgeInsets.all(18),
              child: CircularProgressIndicator(color: premiumGold),
            ),
          )
        else if (_similarError)
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Similar astrologers could not be loaded.',
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
              TextButton(
                onPressed: _loadSimilarAstrologers,
                child: const Text('Retry recommendations'),
              ),
            ],
          )
        else if (_similar.isEmpty)
          Text(
            'No similar astrologers available right now.',
            style: TextStyle(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          )
        else
          SizedBox(
            height:
                246 +
                150 *
                    (MediaQuery.textScalerOf(context).scale(1) - 1).clamp(0, 2),
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: _similar.length,
              separatorBuilder: (_, _) => const SizedBox(width: 12),
              itemBuilder: (_, index) {
                final astrologer = _similar[index];

                return CosmicSimilarAstrologer(
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
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
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
                      Expanded(
                        child: Text(
                          'Customer Reviews',
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.onSurface,
                            fontSize: 21,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                      IconButton(
                        onPressed: () => Navigator.pop(context),
                        icon: Icon(
                          Icons.close_rounded,
                          color: Theme.of(context).colorScheme.onSurface,
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
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: premiumGold.withValues(alpha: 0.32)),
      ),
      child: Row(
        children: [
          Text(
            summary.averageRating.toStringAsFixed(1),
            style: TextStyle(
              color: Theme.of(context).colorScheme.onSurface,
              fontSize: 34,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(width: 12),
          const Icon(Icons.star_rounded, color: premiumGold, size: 30),
          const SizedBox(width: 14),
          Expanded(
            child: Text(
              '${summary.totalReviews} customer '
              '${summary.totalReviews == 1 ? 'review' : 'reviews'}',
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
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
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Theme.of(context).colorScheme.outline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 21,
                backgroundColor: Colors.white,
                child: Text(
                  name[0].toUpperCase(),
                  style: const TextStyle(
                    color: premiumGold,
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
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.onSurface,
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
                          color: premiumGold,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              if (_dateLabel.isNotEmpty)
                Text(
                  _dateLabel,
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                    fontSize: 11,
                  ),
                ),
            ],
          ),

          const SizedBox(height: 12),

          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Theme.of(context).colorScheme.outline),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(_consultationIcon, size: 14, color: premiumGold),
                const SizedBox(width: 6),
                Text(
                  _consultationLabel,
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurface,
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
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
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
