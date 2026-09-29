import '../widgets/ai_astro_avatar.dart';
import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../data/ai_astro_api.dart';
import '../../data/ai_astro_models.dart';
import 'ai_astro_chat_screen.dart';

import '../../../follow/data/follow_api.dart';

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
  final _followApi = FollowApi();

  bool _isFollowing = false;
  bool _followLoading = true;
  bool _followActionLoading = false;
  int _followerCount = 0;
  final AiAstroApi _api = AiAstroApi();

  AiAstroReviewsResult? _reviews;
  bool _reviewsLoading = true;
  String _reviewsError = '';

  @override
  void initState() {
    super.initState();
    _loadFollowStatus();
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

  Future<void> _loadFollowStatus() async {
    if (mounted) {
      setState(() {
        _followLoading = true;
      });
    }

    try {
      final status = await _followApi.getAiStatus(widget.persona.id);

      if (!mounted) return;

      setState(() {
        _isFollowing = status.isFollowing;
        _followerCount = status.followerCount;
      });
    } on FollowApiException {
      // Keep the AI profile usable if follow status cannot be loaded.
    } finally {
      if (mounted) {
        setState(() {
          _followLoading = false;
        });
      }
    }
  }

  Future<void> _toggleFollow() async {
    if (_followLoading || _followActionLoading) return;

    setState(() {
      _followActionLoading = true;
    });

    try {
      final status = _isFollowing
          ? await _followApi.unfollowAi(widget.persona.id)
          : await _followApi.followAi(widget.persona.id);

      if (!mounted) return;

      setState(() {
        _isFollowing = status.isFollowing;
        _followerCount = status.followerCount;
      });
    } on FollowApiException catch (error) {
      if (!mounted) return;

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) {
        setState(() {
          _followActionLoading = false;
        });
      }
    }
  }

  String _followersLabel(int count) {
    if (count >= 1000000) {
      final value = count / 1000000;

      return '${value.toStringAsFixed(value >= 10 ? 0 : 1)}M followers';
    }

    if (count >= 1000) {
      final value = count / 1000;

      return '${value.toStringAsFixed(value >= 10 ? 0 : 1)}K followers';
    }

    return '$count ${count == 1 ? 'follower' : 'followers'}';
  }

  Widget _buildFollowRow() {
    final busy = _followLoading || _followActionLoading;

    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          OutlinedButton.icon(
            onPressed: busy ? null : _toggleFollow,
            icon: _followActionLoading
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Icon(
                    _isFollowing
                        ? Icons.check_rounded
                        : Icons.person_add_alt_1_rounded,
                    size: 18,
                  ),
            label: Text(
              _followLoading
                  ? 'Loading...'
                  : (_isFollowing ? 'Following' : 'Follow'),
            ),
            style: OutlinedButton.styleFrom(
              foregroundColor: _isFollowing
                  ? const Color(0xFF6B4E8A)
                  : const Color(0xFF7B3FF2),
              side: BorderSide(
                color: _isFollowing
                    ? const Color(0xFFCDBBE1)
                    : const Color(0xFF9B6BFF),
              ),
              backgroundColor: _isFollowing
                  ? const Color(0xFFF5EFFA)
                  : const Color(0xFFFFF9F1),
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(22),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Text(
            _followLoading ? 'â€” followers' : _followersLabel(_followerCount),
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: Color(0xFF6F6478),
            ),
          ),
        ],
      ),
    );
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
      backgroundColor: const Color(0xFFFFF9F1),
      appBar: AppBar(
        elevation: 0,
        backgroundColor: const Color(0xFFFFF9F1),
        foregroundColor: const Color(0xFF14213D),
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
                  Color(0xFFFFFCF5),
                  Color(0xFFFFF9EB),
                  Color(0xFFFFF2CF),
                ],
              ),
              border: Border.all(color: Color(0x99EFC35A)),
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
                                errorBuilder: (_, _, _) => AiAstroAvatar(
                                  personaName: persona.name,
                                  initials: persona.initials,
                                ),
                              )
                            : AiAstroAvatar(
                                personaName: persona.name,
                                initials: persona.initials,
                              ),
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
                            color: Color(0xFFFFF9F1),
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
                    color: Color(0xFF14213D),
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
                _buildFollowRow(),

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
                color: Color(0xFF465069),
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
                          color: Color(0x26F4C45E),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: Color(0x99EFC35A)),
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
                          style: TextStyle(color: Color(0xFF69738B)),
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
                    style: TextStyle(color: Color(0xFF69738B), fontSize: 13),
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
                              color: Color(0xFF14213D),
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            '(${_reviews?.totalReviews ?? 0} reviews)',
                            style: const TextStyle(
                              color: Color(0xFF69738B),
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
                color: Color(0xFF69738B),
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
            color: Color(0xFFFFF9F1),
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
                disabledBackgroundColor: const Color(0xFFE7D6A9),
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
        color: Color(0x33F4C45E),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Color(0x99EFC35A)),
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

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
      decoration: BoxDecoration(
        color: Color(0xFFFFF6E2),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Color(0xFFEFCB72)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: AppColors.gold, size: 15),
          const SizedBox(width: 5),
          Text(
            text,
            style: const TextStyle(
              color: Color(0xFF14213D),
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
        color: Color(0xFFFFFDF8),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: Color(0xFFEFCB72)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              color: Color(0xFF14213D),
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
                color: Color(0xFF69738B),
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                color: Color(0xFF14213D),
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
        color: Color(0xFFFFFAF0),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Color(0xFFEFCB72)),
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
                    color: Color(0xFF14213D),
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              if (dateLabel.isNotEmpty)
                Text(
                  dateLabel,
                  style: const TextStyle(
                    color: Color(0xFF7A8499),
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
                color: Color(0xFF35415A),
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
