import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../articles/data/astrology_article.dart';
import '../../../articles/data/astrology_articles_api.dart';
import '../../../articles/presentation/screens/astrology_article_detail_screen.dart';
import '../../../consultations/data/consultation_models.dart';
import '../../../follow/data/follow_api.dart';
import '../../../consultations/presentation/screens/consultation_confirmation_screen.dart';
import '../../data/astrologer_api.dart';
import '../../data/public_astrologer.dart';
import '../widgets/astrologer_detail_extras.dart';
import '../widgets/customer_wallet_badge.dart';

class AstrologerDetailScreen extends StatefulWidget {
  const AstrologerDetailScreen({
    required this.astrologerId,
    this.astrologyQuestionId,
    this.astrologyQuestionText,
    this.astrologyCategorySlug,
    this.isFreeChatIntent = false,
    this.freeChatMinutes = 0,
    super.key,
  });

  final String astrologerId;
  final String? astrologyQuestionId;
  final String? astrologyQuestionText;
  final String? astrologyCategorySlug;

  /// Free-chat navigation intent only.
  /// Actual eligibility and charging remain backend-authoritative.
  final bool isFreeChatIntent;
  final int freeChatMinutes;

  @override
  State<AstrologerDetailScreen> createState() => _AstrologerDetailScreenState();
}

class _AstrologerDetailScreenState extends State<AstrologerDetailScreen> {
  final _astrologerApi = AstrologerApi();
  final _followApi = FollowApi();
  final _articlesApi = AstrologyArticlesApi();

  bool _isFollowing = false;
  bool _followLoading = true;
  bool _followActionLoading = false;
  int _followerCount = 0;
  int _selectedProfileTab = 0;

  List<AstrologyArticle> _profilePosts = const [];
  bool _profilePostsLoading = false;
  bool _profilePostsLoaded = false;
  String _profilePostsError = '';

  PublicAstrologerProfile? _profile;
  String _error = '';
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadProfile();
    _loadFollowStatus();
  }

  @override
  void dispose() {
    _astrologerApi.close();
    _articlesApi.close();
    super.dispose();
  }

  Future<void> _loadFollowStatus() async {
    if (mounted) {
      setState(() {
        _followLoading = true;
      });
    }

    try {
      final status = await _followApi.getRealStatus(widget.astrologerId);

      if (!mounted) return;

      setState(() {
        _isFollowing = status.isFollowing;
        _followerCount = status.followerCount;
      });
    } on FollowApiException {
      // Profile remains usable even if follow status cannot be loaded.
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
          ? await _followApi.unfollowReal(widget.astrologerId)
          : await _followApi.followReal(widget.astrologerId);

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

  Future<void> _loadProfilePosts() async {
    if (_profilePostsLoading || _profilePostsLoaded) return;

    setState(() {
      _profilePostsLoading = true;
      _profilePostsError = '';
    });

    try {
      final locale = Localizations.localeOf(context).languageCode;

      final posts = await _articlesApi.getAstrologerPublishedArticles(
        astrologerId: widget.astrologerId,
        locale: locale,
        limit: 20,
      );

      if (!mounted) return;

      setState(() {
        _profilePosts = posts;
        _profilePostsLoaded = true;
      });
    } catch (error) {
      if (!mounted) return;

      setState(() {
        _profilePostsError = error.toString();
      });
    } finally {
      if (mounted) {
        setState(() {
          _profilePostsLoading = false;
        });
      }
    }
  }

  Widget _buildProfileTabs() {
    const labels = <String>['About', 'Reviews', 'Services', 'Posts'];

    return Container(
      padding: const EdgeInsets.all(5),
      decoration: BoxDecoration(
        color: const Color(0xFFF7F0FF),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE2D4F3)),
      ),
      child: Row(
        children: List.generate(labels.length, (index) {
          final selected = _selectedProfileTab == index;

          return Expanded(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () {
                if (_selectedProfileTab == index) return;

                setState(() {
                  _selectedProfileTab = index;
                });
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.symmetric(
                  vertical: 11,
                  horizontal: 4,
                ),
                decoration: BoxDecoration(
                  gradient: selected
                      ? const LinearGradient(
                          colors: [Color(0xFF7C4DFF), Color(0xFFB45DE4)],
                        )
                      : null,
                  borderRadius: BorderRadius.circular(14),
                ),
                alignment: Alignment.center,
                child: Text(
                  labels[index],
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: selected ? Colors.white : const Color(0xFF5F536C),
                    fontSize: 12,
                    fontWeight: selected ? FontWeight.w800 : FontWeight.w700,
                  ),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }

  Widget _buildAboutTab(PublicAstrologer astrologer) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFBF5),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE9DDF2)),
      ),
      child: Text(
        astrologer.bio?.isNotEmpty == true
            ? astrologer.bio!
            : 'Biography not provided.',
        style: const TextStyle(
          color: Color(0xFF655C6D),
          height: 1.55,
          fontSize: 14,
        ),
      ),
    );
  }

  Widget _buildReviewsTab(PublicAstrologer astrologer) {
    return AstrologerDetailExtras(
      astrologer: astrologer,
      showReviews: true,
      showSimilar: false,
      onAstrologerTap: (astrologerId) {
        Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => AstrologerDetailScreen(astrologerId: astrologerId),
          ),
        );
      },
    );
  }

  Widget _buildServicesTab(PublicAstrologerProfile profile) {
    final astrologer = profile.astrologer;

    Widget statusBadge(bool available) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
        decoration: BoxDecoration(
          color: available ? const Color(0xFFEAF8EE) : const Color(0xFFF2EFF4),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 7,
              height: 7,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: available
                    ? const Color(0xFF2D9A48)
                    : const Color(0xFF8B8490),
              ),
            ),
            const SizedBox(width: 6),
            Text(
              available ? 'Available' : 'Unavailable',
              style: TextStyle(
                color: available
                    ? const Color(0xFF23783A)
                    : const Color(0xFF746D79),
                fontSize: 12,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      );
    }

    Widget serviceRow({
      required IconData icon,
      required String title,
      required Widget value,
      bool last = false,
    }) {
      return Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 14),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF8EA),
                    borderRadius: BorderRadius.circular(13),
                    border: Border.all(color: const Color(0xFFF0E2C8)),
                  ),
                  child: Icon(icon, color: AppColors.gold, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                      color: Color(0xFF6D6875),
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Flexible(child: value),
              ],
            ),
          ),
          if (!last) const Divider(height: 1, color: Color(0xFFECE7EF)),
        ],
      );
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 17, 16, 4),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFBF7),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFE7D9F3)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0C49365D),
            blurRadius: 16,
            offset: Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.auto_awesome_rounded, color: AppColors.gold, size: 20),
              SizedBox(width: 8),
              Text(
                'Consultation Services',
                style: TextStyle(
                  color: Color(0xFF17223A),
                  fontSize: 19,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          const Text(
            'Choose how you would like to connect.',
            style: TextStyle(
              color: Color(0xFF8A8390),
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 8),

          serviceRow(
            icon: Icons.schedule_rounded,
            title: 'Availability',
            value: Container(
              constraints: const BoxConstraints(maxWidth: 145),
              padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
              decoration: BoxDecoration(
                color: const Color(0xFFEAF8EE),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                profile.availability,
                textAlign: TextAlign.right,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Color(0xFF23783A),
                  fontSize: 12,
                  height: 1.2,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),

          serviceRow(
            icon: Icons.currency_rupee_rounded,
            title: 'Consultation Rate',
            value: Text(
              astrologer.priceLabel,
              textAlign: TextAlign.right,
              style: const TextStyle(
                color: Color(0xFF17223A),
                fontSize: 13,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),

          serviceRow(
            icon: Icons.chat_bubble_rounded,
            title: 'Chat Consultation',
            value: statusBadge(profile.consultationOptions.chat),
          ),

          serviceRow(
            icon: Icons.call_rounded,
            title: 'Audio Call',
            value: statusBadge(profile.consultationOptions.audioCall),
            last: true,
          ),
        ],
      ),
    );
  }

  Widget _buildPostsTab() {
    if (_profilePostsLoading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 32),
        child: Center(child: CircularProgressIndicator()),
      );
    }

    if (_profilePostsError.isNotEmpty) {
      return Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: const Color(0xFFFFFBF7),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: const Color(0xFFE7D9F3)),
        ),
        child: Column(
          children: [
            const Icon(
              Icons.cloud_off_rounded,
              color: Color(0xFF7B5A91),
              size: 30,
            ),
            const SizedBox(height: 8),
            const Text(
              'Unable to load posts right now.',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 10),
            TextButton(
              onPressed: () {
                setState(() {
                  _profilePostsLoaded = false;
                  _profilePostsError = '';
                });
                _loadProfilePosts();
              },
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    if (!_profilePostsLoaded) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _loadProfilePosts();
      });

      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 32),
        child: Center(child: CircularProgressIndicator()),
      );
    }

    if (_profilePosts.isEmpty) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 30),
        decoration: BoxDecoration(
          color: const Color(0xFFFFFBF7),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: const Color(0xFFE7D9F3)),
        ),
        child: const Column(
          children: [
            Icon(
              Icons.auto_stories_rounded,
              size: 34,
              color: Color(0xFF8B6AA3),
            ),
            SizedBox(height: 10),
            Text(
              'No published posts yet.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontWeight: FontWeight.w700,
                color: Color(0xFF493957),
              ),
            ),
          ],
        ),
      );
    }

    return Column(
      children: _profilePosts
          .map((article) {
            final excerpt = article.excerpt?.trim();

            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: InkWell(
                borderRadius: BorderRadius.circular(20),
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) =>
                          AstrologyArticleDetailScreen(article: article),
                    ),
                  );
                },
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFFBF7),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFFE7D9F3)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        article.title,
                        style: const TextStyle(
                          color: Color(0xFF3F3150),
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      if (excerpt?.isNotEmpty == true) ...[
                        const SizedBox(height: 7),
                        Text(
                          excerpt!,
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Color(0xFF75677F),
                            height: 1.4,
                          ),
                        ),
                      ],
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          const Icon(
                            Icons.schedule_rounded,
                            size: 15,
                            color: Color(0xFF8B6AA3),
                          ),
                          const SizedBox(width: 5),
                          Text(
                            '${article.readingMinutes} min read',
                            style: const TextStyle(
                              color: Color(0xFF8B6AA3),
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            );
          })
          .toList(growable: false),
    );
  }

  // ignore: unused_element
  Widget _buildProfileTabPlaceholder({
    required IconData icon,
    required String title,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 28),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFBF5),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE9DDF2)),
      ),
      child: Column(
        children: [
          Icon(icon, color: const Color(0xFF8B67A8), size: 28),
          const SizedBox(height: 8),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Color(0xFF655C6D),
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
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
            _followLoading
                ? 'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â followers'
                : _followersLabel(_followerCount),
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

  Future<void> _loadProfile() async {
    setState(() {
      _isLoading = true;
      _error = '';
    });

    try {
      final profile = await _astrologerApi.getPublicAstrologerById(
        widget.astrologerId,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _profile = profile;
      });
    } on AstrologerApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _profile = null;
        _error = error.message;
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _openConfirmation(
    PublicAstrologerProfile profile,
    ConsultationMode mode,
  ) async {
    final freeChatStarted = await Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(
        builder: (_) => ConsultationConfirmationScreen(
          profile: profile,
          mode: mode,
          astrologyQuestionId: widget.astrologyQuestionId,
          astrologyQuestionText: widget.astrologyQuestionText,
          astrologyCategorySlug: widget.astrologyCategorySlug,
          isFreeChatIntent:
              widget.isFreeChatIntent && mode == ConsultationMode.chat,
          freeChatMinutes: widget.freeChatMinutes,
        ),
      ),
    );

    if (mounted && freeChatStarted == true) {
      Navigator.of(context).pop(true);
      return;
    }

    if (mounted) {
      await _loadProfile();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.white,
        title: const Text(
          'Astrologer Profile',
          style: TextStyle(fontWeight: FontWeight.w900),
        ),
        actions: [
          const CustomerWalletBadge(),
          IconButton(
            onPressed: _loadProfile,
            tooltip: 'Refresh profile',
            icon: const Icon(Icons.refresh_rounded, color: AppColors.gold),
          ),
        ],
      ),
      body: _buildBody(),
      bottomNavigationBar: _buildBottomConsultationBar(),
    );
  }

  Widget? _buildBottomConsultationBar() {
    final profile = _profile;

    if (_isLoading || profile == null || _error.isNotEmpty) {
      return null;
    }

    final astrologer = profile.astrologer;
    final isOnline = astrologer.isOnline;
    final canChat = isOnline && profile.consultationOptions.chat;
    final canAudio = isOnline && profile.consultationOptions.audioCall;

    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
        decoration: const BoxDecoration(
          color: AppColors.background,
          border: Border(top: BorderSide(color: Color(0x447A8BB8))),
          boxShadow: [
            BoxShadow(
              color: Color(0x44000000),
              blurRadius: 18,
              offset: Offset(0, -6),
            ),
          ],
        ),
        child: Row(
          children: [
            Expanded(
              child: _BottomConsultationButton(
                icon: Icons.chat_bubble_rounded,
                title: 'Chat',
                subtitle: astrologer.priceLabel,
                primary: true,
                enabled: canChat,
                onTap: canChat
                    ? () => _openConfirmation(profile, ConsultationMode.chat)
                    : null,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _BottomConsultationButton(
                icon: Icons.call_rounded,
                title: 'Audio',
                subtitle: astrologer.priceLabel,
                primary: false,
                enabled: canAudio,
                onTap: canAudio
                    ? () => _openConfirmation(profile, ConsultationMode.audio)
                    : null,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.gold),
      );
    }

    if (_error.isNotEmpty) {
      return _ProfileError(message: _error, onRetry: _loadProfile);
    }

    final profile = _profile;

    if (profile == null) {
      return const Center(
        child: Text(
          'Astrologer profile is unavailable.',
          style: TextStyle(color: AppColors.white),
        ),
      );
    }

    final astrologer = profile.astrologer;
    final initial = astrologer.name.isEmpty
        ? 'A'
        : astrologer.name[0].toUpperCase();

    return RefreshIndicator(
      onRefresh: _loadProfile,
      color: AppColors.gold,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(bottom: 32),
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(20, 28, 20, 26),
            decoration: const BoxDecoration(
              image: DecorationImage(
                image: AssetImage(
                  'assets/stickers/astrologer_profile_background.png',
                ),
                fit: BoxFit.cover,
                alignment: Alignment.topCenter,
              ),
              borderRadius: BorderRadius.only(
                bottomLeft: Radius.circular(34),
                bottomRight: Radius.circular(34),
              ),
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0x22F4C45E),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: const Color(0x55F4C45E)),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.workspace_premium_rounded,
                            color: AppColors.gold,
                            size: 15,
                          ),
                          SizedBox(width: 5),
                          Text(
                            'VERIFIED ASTROLOGER',
                            style: TextStyle(
                              color: AppColors.gold,
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.7,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                Stack(
                  alignment: Alignment.center,
                  children: [
                    Container(
                      width: 126,
                      height: 126,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: const Color(0x66F4C45E),
                          width: 2,
                        ),
                        boxShadow: const [
                          BoxShadow(
                            blurRadius: 24,
                            spreadRadius: 2,
                            color: Color(0x334F6FAF),
                          ),
                        ],
                      ),
                    ),
                    CircleAvatar(
                      radius: 54,
                      backgroundColor: const Color(0x33F4C45E),
                      backgroundImage: astrologer.avatarUrl == null
                          ? null
                          : NetworkImage(astrologer.avatarUrl!),
                      child: astrologer.avatarUrl == null
                          ? Text(
                              initial,
                              style: const TextStyle(
                                color: AppColors.gold,
                                fontSize: 38,
                                fontWeight: FontWeight.w900,
                              ),
                            )
                          : null,
                    ),
                    Positioned(
                      right: 5,
                      bottom: 5,
                      child: Container(
                        width: 23,
                        height: 23,
                        decoration: BoxDecoration(
                          color: astrologer.isOnline
                              ? const Color(0xFF42D468)
                              : const Color(0xFF7A849B),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: AppColors.surfaceLight,
                            width: 3,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Flexible(
                      child: Text(
                        astrologer.name,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: AppColors.white,
                          fontSize: 27,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                    const SizedBox(width: 7),
                    const Icon(
                      Icons.verified_rounded,
                      color: Color(0xFF55A7FF),
                      size: 23,
                    ),
                  ],
                ),
                const SizedBox(height: 7),
                _buildFollowRow(),
                Text(
                  astrologer.primaryExpertise,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: AppColors.gold,
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 13),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 13,
                    vertical: 7,
                  ),
                  decoration: BoxDecoration(
                    color: astrologer.isOnline
                        ? const Color(0x183FD468)
                        : const Color(0x187A849B),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: astrologer.isOnline
                          ? const Color(0x5542D468)
                          : const Color(0x447A849B),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 7,
                        height: 7,
                        decoration: BoxDecoration(
                          color: astrologer.isOnline
                              ? const Color(0xFF42D468)
                              : const Color(0xFF9AA4B8),
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 7),
                      Text(
                        profile.availability,
                        style: TextStyle(
                          color: astrologer.isOnline
                              ? const Color(0xFF8FE6A6)
                              : AppColors.muted,
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _InformationCard(
                  children: [
                    _DetailRow(
                      icon: Icons.star_rounded,
                      label: 'Rating',
                      value: astrologer.rating > 0
                          ? '${astrologer.ratingLabel} / 5'
                          : 'New astrologer',
                    ),
                    _DetailRow(
                      icon: Icons.workspace_premium_rounded,
                      label: 'Experience',
                      value: astrologer.experienceLabel,
                    ),
                    _DetailRow(
                      icon: Icons.translate_rounded,
                      label: 'Languages',
                      value: astrologer.languageLabel,
                    ),
                    _DetailRow(
                      icon: Icons.currency_rupee_rounded,
                      label: 'Consultation',
                      value: astrologer.priceLabel,
                      isLast: true,
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                _buildProfileTabs(),
                const SizedBox(height: 12),
                if (_selectedProfileTab == 0)
                  _buildAboutTab(astrologer)
                else if (_selectedProfileTab == 1)
                  _buildReviewsTab(astrologer)
                else if (_selectedProfileTab == 2)
                  _buildServicesTab(profile)
                else
                  _buildPostsTab(),
                if (_selectedProfileTab == 0) ...[
                  const SizedBox(height: 22),
                  AstrologerDetailExtras(
                    astrologer: astrologer,
                    showReviews: false,
                    showSimilar: true,
                    onAstrologerTap: (astrologerId) {
                      Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => AstrologerDetailScreen(
                            astrologerId: astrologerId,
                          ),
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 26),
                  const Text(
                    'Consultation Options',
                    style: TextStyle(
                      color: AppColors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 12),
                  GestureDetector(
                    onTap:
                        profile.astrologer.isOnline &&
                            profile.consultationOptions.chat
                        ? () =>
                              _openConfirmation(profile, ConsultationMode.chat)
                        : null,
                    child: _ConsultationOption(
                      icon: Icons.chat_bubble_rounded,
                      label: 'Chat Consultation',
                      available: profile.consultationOptions.chat,
                    ),
                  ),
                  const SizedBox(height: 10),
                  GestureDetector(
                    onTap:
                        profile.astrologer.isOnline &&
                            profile.consultationOptions.audioCall
                        ? () =>
                              _openConfirmation(profile, ConsultationMode.audio)
                        : null,
                    child: _ConsultationOption(
                      icon: Icons.call_rounded,
                      label: 'Audio Consultation',
                      available: profile.consultationOptions.audioCall,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BottomConsultationButton extends StatelessWidget {
  const _BottomConsultationButton({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.primary,
    required this.enabled,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final bool primary;
  final bool enabled;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: BorderRadius.circular(17),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
          decoration: BoxDecoration(
            gradient: enabled
                ? LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: primary
                        ? const [Color(0xFFF4C45E), Color(0xFFDDA83D)]
                        : const [AppColors.surfaceLight, AppColors.surface],
                  )
                : const LinearGradient(
                    colors: [AppColors.surfaceLight, AppColors.surface],
                  ),
            borderRadius: BorderRadius.circular(17),
            border: Border.all(
              color: enabled
                  ? (primary
                        ? const Color(0xFFF8D982)
                        : const Color(0x557A8BB8))
                  : const Color(0x337A8BB8),
            ),
          ),
          child: Row(
            children: [
              Icon(
                icon,
                size: 20,
                color: enabled
                    ? (primary ? AppColors.background : AppColors.gold)
                    : AppColors.muted,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        color: enabled
                            ? (primary ? AppColors.background : AppColors.white)
                            : AppColors.muted,
                        fontSize: 14,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      enabled ? subtitle : 'Unavailable',
                      style: TextStyle(
                        color: enabled
                            ? (primary ? AppColors.border : AppColors.muted)
                            : AppColors.muted,
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.arrow_forward_ios_rounded,
                size: 13,
                color: enabled
                    ? (primary ? AppColors.background : AppColors.gold)
                    : AppColors.muted,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _InformationCard extends StatelessWidget {
  const _InformationCard({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.background, AppColors.surface],
        ),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0x557A8BB8)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x22000000),
            blurRadius: 18,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Column(children: children),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
    this.isLast = false,
  });

  final IconData icon;
  final String label;
  final String value;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 15),
      decoration: BoxDecoration(
        border: isLast
            ? null
            : const Border(bottom: BorderSide(color: Color(0x337A8BB8))),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: const Color(0x18F4C45E),
              borderRadius: BorderRadius.circular(11),
              border: Border.all(color: const Color(0x337A8BB8)),
            ),
            child: Icon(icon, color: AppColors.gold, size: 19),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              label,
              style: const TextStyle(
                color: AppColors.muted,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(
                color: AppColors.white,
                fontSize: 13,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ConsultationOption extends StatelessWidget {
  const _ConsultationOption({
    required this.icon,
    required this.label,
    required this.available,
  });

  final IconData icon;
  final String label;
  final bool available;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
          colors: available
              ? const [AppColors.background, AppColors.surfaceLight]
              : const [AppColors.background, AppColors.surface],
        ),
        borderRadius: BorderRadius.circular(19),
        border: Border.all(
          color: available ? const Color(0x6652D273) : const Color(0x447A8BB8),
          width: 1.2,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: available
                  ? const Color(0x18F4C45E)
                  : const Color(0x147A8BB8),
              borderRadius: BorderRadius.circular(13),
            ),
            child: Icon(
              icon,
              color: available ? AppColors.gold : AppColors.muted,
              size: 21,
            ),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  available
                      ? 'Ready for consultation'
                      : 'Currently unavailable',
                  style: TextStyle(
                    color: available
                        ? const Color(0xFF8FE6A6)
                        : AppColors.muted,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: available
                  ? const Color(0x183FD468)
                  : const Color(0x147A8BB8),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              available ? 'Available' : 'Unavailable',
              style: TextStyle(
                color: available ? const Color(0xFF7FE39A) : AppColors.muted,
                fontSize: 10,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfileError extends StatelessWidget {
  const _ProfileError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.cloud_off_rounded,
              color: Colors.redAccent,
              size: 54,
            ),
            const SizedBox(height: 16),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.white),
            ),
            const SizedBox(height: 18),
            FilledButton(onPressed: onRetry, child: const Text('Try Again')),
          ],
        ),
      ),
    );
  }
}
