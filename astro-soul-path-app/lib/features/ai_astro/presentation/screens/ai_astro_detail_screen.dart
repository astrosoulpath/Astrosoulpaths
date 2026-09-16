import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../data/ai_astro_api.dart';
import '../../data/ai_astro_models.dart';
import 'ai_astro_chat_screen.dart';

class AiAstroDetailScreen extends StatefulWidget {
  const AiAstroDetailScreen({
    required this.persona,
    required this.category,
    required this.consultantType,
    super.key,
  });

  final AiAstroPersona persona;
  final String category;
  final AiConsultantType consultantType;

  @override
  State<AiAstroDetailScreen> createState() => _AiAstroDetailScreenState();
}

class _AiAstroDetailScreenState extends State<AiAstroDetailScreen> {
  final AiAstroApi _api = AiAstroApi();

  AiAstroReviewsResult? _reviews;
  bool _reviewsLoading = true;
  String _reviewsError = '';

  @override
  void initState() {
    super.initState();
    _loadReviews();
  }

  Future<void> _loadReviews() async {
    try {
      final result = await _api.getAstrologerReviews(widget.persona.id);

      if (!mounted) return;

      setState(() {
        _reviews = result;
        _reviewsError = '';
      });
    } on AiAstroApiException catch (error) {
      if (!mounted) return;

      setState(() {
        _reviewsError = error.message;
      });
    } finally {
      if (mounted) {
        setState(() {
          _reviewsLoading = false;
        });
      }
    }
  }

  void _openChat(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => AiAstroChatScreen(
          persona: widget.persona,
          category: widget.category,
          consultantType: widget.consultantType,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final persona = widget.persona;
    final avatar = persona.avatarUrl?.trim();
    final hasAvatar = avatar != null && avatar.isNotEmpty;

    final languages = persona.languages.isEmpty
        ? 'Not specified'
        : persona.languages.join(', ');

    final expertise = persona.expertise.isEmpty
        ? persona.subtitle
        : persona.expertise.join(', ');

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        elevation: 0,
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.white,
        title: const Text(
          'AI Astrologer Details',
          style: TextStyle(fontWeight: FontWeight.w900),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 120),
        children: [
          Container(
            margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            padding: const EdgeInsets.fromLTRB(18, 22, 18, 22),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(28),
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Color(0xFF1B1B1B),
                  Color(0xFF121212),
                  Color(0xFF090909),
                ],
              ),
              border: Border.all(color: const Color(0x66F4C45E)),
            ),
            child: Column(
              children: [
                const _AiVerifiedBadge(),
                const SizedBox(height: 18),

                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Container(
                      width: 126,
                      height: 126,
                      padding: const EdgeInsets.all(3),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: AppColors.gold, width: 2),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x33F4C45E),
                            blurRadius: 25,
                            spreadRadius: 2,
                          ),
                        ],
                      ),
                      child: ClipOval(
                        child: hasAvatar
                            ? Image.network(
                                avatar,
                                fit: BoxFit.cover,
                                errorBuilder: (_, _, _) =>
                                    _AvatarFallback(initials: persona.initials),
                              )
                            : _AvatarFallback(initials: persona.initials),
                      ),
                    ),
                    Positioned(
                      right: 5,
                      bottom: 7,
                      child: Container(
                        width: 20,
                        height: 20,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: persona.available
                              ? const Color(0xFF25D978)
                              : const Color(0xFF707070),
                          border: Border.all(
                            color: AppColors.background,
                            width: 3,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 16),

                Text(
                  persona.name,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 25,
                    fontWeight: FontWeight.w900,
                  ),
                ),

                const SizedBox(height: 5),

                Text(
                  persona.subtitle,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: AppColors.gold,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),

                const SizedBox(height: 18),

                Wrap(
                  alignment: WrapAlignment.center,
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _InfoChip(
                      icon: Icons.star_rounded,
                      text: persona.rating.toStringAsFixed(1),
                    ),
                    _InfoChip(
                      icon: Icons.rate_review_rounded,
                      text: '${persona.totalReviews} Reviews',
                    ),
                    _InfoChip(
                      icon: Icons.workspace_premium_rounded,
                      text: '${persona.experience} Years',
                    ),
                    _InfoChip(
                      icon: persona.available
                          ? Icons.circle
                          : Icons.do_not_disturb_on_rounded,
                      text: persona.available ? 'Online' : 'Offline',
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 18),

          _SectionCard(
            title: 'AI Consultation',
            child: Row(
              children: [
                const Icon(
                  Icons.auto_awesome_rounded,
                  color: AppColors.gold,
                  size: 25,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    persona.aiPricing.displayLabel,
                    style: TextStyle(
                      color: persona.aiPricing.isFree
                          ? const Color(0xFF40D98A)
                          : AppColors.gold,
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ],
            ),
          ),

          _SectionCard(
            title: 'About the AI Astrologer',
            child: Text(
              persona.description.trim().isEmpty
                  ? 'Profile description has not been added yet.'
                  : persona.description.trim(),
              style: const TextStyle(
                color: Color(0xFFD8D8D8),
                height: 1.55,
                fontSize: 14,
              ),
            ),
          ),

          _SectionCard(
            title: 'Profile',
            child: Column(
              children: [
                _DetailRow(
                  icon: Icons.auto_awesome_rounded,
                  label: 'Expertise',
                  value: expertise,
                ),
                _DetailRow(
                  icon: Icons.translate_rounded,
                  label: 'Languages',
                  value: languages,
                ),
                _DetailRow(
                  icon: Icons.history_edu_rounded,
                  label: 'Experience',
                  value: '${persona.experience} years',
                ),
                _DetailRow(
                  icon: Icons.online_prediction_rounded,
                  label: 'Availability',
                  value: persona.available ? 'Online' : 'Offline',
                ),
              ],
            ),
          ),

          if (persona.categories.isNotEmpty)
            _SectionCard(
              title: 'Guidance Categories',
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: persona.categories
                    .map(
                      (item) => Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 11,
                          vertical: 7,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0x14F4C45E),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: const Color(0x44F4C45E)),
                        ),
                        child: Text(
                          item,
                          style: const TextStyle(
                            color: AppColors.gold,
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    )
                    .toList(),
              ),
            ),

          _SectionCard(
            title: 'Customer Reviews',
            child: _reviewsLoading
                ? const Padding(
                    padding: EdgeInsets.symmetric(vertical: 16),
                    child: Center(
                      child: CircularProgressIndicator(color: AppColors.gold),
                    ),
                  )
                : _reviewsError.isNotEmpty
                ? Row(
                    children: [
                      const Expanded(
                        child: Text(
                          'Reviews could not be loaded.',
                          style: TextStyle(color: Color(0xFFBEBEBE)),
                        ),
                      ),
                      TextButton(
                        onPressed: () {
                          setState(() {
                            _reviewsLoading = true;
                            _reviewsError = '';
                          });
                          _loadReviews();
                        },
                        child: const Text('Retry'),
                      ),
                    ],
                  )
                : (_reviews?.reviews.isEmpty ?? true)
                ? const Text(
                    'No customer reviews yet.',
                    style: TextStyle(color: Color(0xFFBEBEBE), fontSize: 13),
                  )
                : Column(
                    children: [
                      Row(
                        children: [
                          const Icon(
                            Icons.star_rounded,
                            color: AppColors.gold,
                            size: 22,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            (_reviews?.averageRating ?? 0).toStringAsFixed(1),
                            style: const TextStyle(
                              color: AppColors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            '(${_reviews?.totalReviews ?? 0} reviews)',
                            style: const TextStyle(
                              color: Color(0xFF999999),
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      ..._reviews!.reviews.map(
                        (review) => _AiReviewTile(review: review),
                      ),
                    ],
                  ),
          ),
          const _SectionCard(
            title: 'AI Guidance',
            child: Text(
              'Your saved birth profile and calculated Kundli are used by the AI astrology system for personalized guidance when available.',
              style: TextStyle(
                color: Color(0xFFBEBEBE),
                height: 1.5,
                fontSize: 13,
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        top: false,
        child: Container(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
          decoration: const BoxDecoration(
            color: AppColors.background,
            border: Border(top: BorderSide(color: Color(0x335E5E5E))),
          ),
          child: SizedBox(
            height: 54,
            child: ElevatedButton.icon(
              onPressed: persona.aiPricing.isEnabled
                  ? () => _openChat(context)
                  : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.gold,
                foregroundColor: Colors.black,
                disabledBackgroundColor: const Color(0xFF444444),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(18),
                ),
              ),
              icon: const Icon(Icons.chat_bubble_rounded),
              label: Text(
                persona.aiPricing.isEnabled
                    ? 'Chat Now'
                    : 'AI Chat Unavailable',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _AiVerifiedBadge extends StatelessWidget {
  const _AiVerifiedBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0x18F4C45E),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0x55F4C45E)),
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.verified_rounded, color: AppColors.gold, size: 16),
          SizedBox(width: 6),
          Text(
            'AI ASTROLOGER',
            style: TextStyle(
              color: AppColors.gold,
              fontSize: 10,
              fontWeight: FontWeight.w900,
              letterSpacing: 0.8,
            ),
          ),
        ],
      ),
    );
  }
}

class _AvatarFallback extends StatelessWidget {
  const _AvatarFallback({required this.initials});

  final String initials;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFF1A1A1A),
      alignment: Alignment.center,
      child: Text(
        initials.isEmpty ? 'AI' : initials,
        style: const TextStyle(
          color: AppColors.gold,
          fontSize: 36,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: AppColors.gold, size: 15),
          const SizedBox(width: 5),
          Text(
            text,
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 14, 16, 0),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF151515),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFF292929)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 17,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 13),
          child,
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: AppColors.gold, size: 20),
          const SizedBox(width: 12),
          SizedBox(
            width: 86,
            child: Text(
              label,
              style: const TextStyle(
                color: Color(0xFF999999),
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                color: AppColors.white,
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AiReviewTile extends StatelessWidget {
  const _AiReviewTile({required this.review});

  final AiAstroReview review;

  @override
  Widget build(BuildContext context) {
    final date = review.createdAt;

    final dateLabel = date == null
        ? ''
        : '${date.day.toString().padLeft(2, '0')}/'
              '${date.month.toString().padLeft(2, '0')}/'
              '${date.year}';

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: const Color(0xFF101010),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF292929)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  review.customerName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              if (dateLabel.isNotEmpty)
                Text(
                  dateLabel,
                  style: const TextStyle(
                    color: Color(0xFF777777),
                    fontSize: 10,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: List.generate(
              5,
              (index) => Icon(
                index < review.rating
                    ? Icons.star_rounded
                    : Icons.star_border_rounded,
                color: AppColors.gold,
                size: 16,
              ),
            ),
          ),
          if (review.review.trim().isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              review.review.trim(),
              style: const TextStyle(
                color: Color(0xFFD0D0D0),
                fontSize: 12,
                height: 1.45,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
