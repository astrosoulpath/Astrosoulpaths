import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../data/astrologer_api.dart';
import '../../data/public_astrologer.dart';
import 'astrologer_detail_screen.dart';
import '../../../astrology_questions/data/astrology_questions_api.dart';
import '../../../astrology_questions/models/astrology_question_models.dart';
// CUSTOMER_FINAL_PREMIUM_PHASE4

class AstrologerSelectionScreen extends StatefulWidget {
  const AstrologerSelectionScreen({
    this.astrologyQuestionId,
    this.astrologyQuestionText,
    this.astrologyCategorySlug,
    this.isFreeChatIntent = false,
    this.freeChatMinutes = 0,
    this.screenTitle = 'Choose Astrologer',
    this.expertiseKeyword,
    this.trendingOnly = false,
    this.showCategoryFilters = false,
    super.key,
  });

  final String? astrologyQuestionId;
  final String? astrologyQuestionText;
  final String? astrologyCategorySlug;

  /// Navigation intent only.
  /// Backend remains the authority for actual free-chat eligibility.
  final bool isFreeChatIntent;
  final int freeChatMinutes;

  /// Used by Home -> VIEW ALL.
  final String screenTitle;

  /// Vedic / Tarot backend filter.
  final String? expertiseKeyword;

  /// Trending keeps backend source but sorts by rating + online status.
  final bool trendingOnly;
  final bool showCategoryFilters;

  @override
  State<AstrologerSelectionScreen> createState() =>
      _AstrologerSelectionScreenState();
}

class _AstrologerSelectionScreenState extends State<AstrologerSelectionScreen> {
  final AstrologerApi _api = AstrologerApi();
  final AstrologyQuestionsApi _categoryApi = AstrologyQuestionsApi();
  final TextEditingController _searchController = TextEditingController();

  List<PublicAstrologer> _astrologers = const [];
  List<AstrologyQuestionCategory> _askCategories = const [];
  String? _selectedCategorySlug;
  bool _categoryLoading = false;
  String _categoryError = '';
  bool _loading = true;
  String _error = '';
  String _search = '';

  @override
  void initState() {
    super.initState();
    final initialCategory = widget.astrologyCategorySlug?.trim();
    _selectedCategorySlug =
        initialCategory != null && initialCategory.isNotEmpty
        ? initialCategory
        : null;
    if (widget.showCategoryFilters) {
      _loadAskCategories();
    }
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = '';
    });

    try {
      final result = await _api.getPublicAstrologers(
        expertise: widget.expertiseKeyword,
        category: _selectedCategorySlug,
      );

      final sorted = [...result.astrologers]
        ..sort((a, b) {
          if (widget.trendingOnly) {
            final ratingResult = b.rating.compareTo(a.rating);

            if (ratingResult != 0) {
              return ratingResult;
            }

            if (a.isOnline != b.isOnline) {
              return a.isOnline ? -1 : 1;
            }

            return 0;
          }

          if (a.isOnline != b.isOnline) {
            return a.isOnline ? -1 : 1;
          }

          return b.rating.compareTo(a.rating);
        });

      if (!mounted) return;

      setState(() {
        _astrologers = List.unmodifiable(sorted);
        _loading = false;
      });
    } on AstrologerApiException catch (error) {
      if (!mounted) return;

      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  Future<void> _loadAskCategories() async {
    if (!widget.showCategoryFilters) return;

    setState(() {
      _categoryLoading = true;
      _categoryError = '';
    });

    try {
      final categories = await _categoryApi.getCategories();

      if (!mounted) return;

      setState(() {
        _askCategories = List.unmodifiable(categories);
        _categoryLoading = false;
      });
    } on AstrologyQuestionsApiException catch (error) {
      if (!mounted) return;

      setState(() {
        _categoryError = error.message;
        _categoryLoading = false;
      });
    }
  }

  Future<void> _selectAskCategory(String? slug) async {
    final raw = slug?.trim();
    final next = raw == null || raw.isEmpty ? null : raw;

    if (_selectedCategorySlug == next) return;

    setState(() {
      _selectedCategorySlug = next;
    });

    await _load();
  }

  Widget _buildAskCategories() {
    if (_categoryLoading && _askCategories.isEmpty) {
      return const Padding(
        padding: EdgeInsets.fromLTRB(18, 14, 18, 4),
        child: LinearProgressIndicator(color: AppColors.gold),
      );
    }

    if (_categoryError.isNotEmpty && _askCategories.isEmpty) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(18, 12, 18, 4),
        child: Row(
          children: [
            Expanded(
              child: Text(
                _categoryError,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: AppColors.muted, fontSize: 12),
              ),
            ),
            TextButton(
              onPressed: _loadAskCategories,
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    return SizedBox(
      height: 62,
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
        scrollDirection: Axis.horizontal,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: ChoiceChip(
              label: const Text(
                'All',
                style: TextStyle(fontWeight: FontWeight.w800),
              ),
              selected: _selectedCategorySlug == null,
              onSelected: (_) => _selectAskCategory(null),
              showCheckmark: true,
              checkmarkColor: const Color(0xFF14213D),
              selectedColor: const Color(0xFFF4C542),
              backgroundColor: const Color(0xFFF8F3FF),
              side: BorderSide(
                color: _selectedCategorySlug == null
                    ? const Color(0xFFFFE783)
                    : const Color(0xFFD8C9EA),
                width: 1.1,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
              labelStyle: TextStyle(
                color: _selectedCategorySlug == null
                    ? const Color(0xFF14213D)
                    : const Color(0xFF14213D),
                fontWeight: FontWeight.w800,
              ),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
            ),
          ),
          ..._askCategories.map(
            (category) => Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: ChoiceChip(
                label: Text(
                  category.name,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                selected: _selectedCategorySlug == category.slug,
                onSelected: (_) => _selectAskCategory(category.slug),
                showCheckmark: false,
                selectedColor: const Color(0xFFF4C542),
                backgroundColor: const Color(0xFFF8F3FF),
                side: BorderSide(
                  color: _selectedCategorySlug == category.slug
                      ? const Color(0xFFFFE783)
                      : const Color(0xFFD8C9EA),
                  width: 1.1,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                labelStyle: TextStyle(
                  color: _selectedCategorySlug == category.slug
                      ? const Color(0xFF14213D)
                      : const Color(0xFF14213D),
                  fontWeight: FontWeight.w800,
                ),
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 10,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  List<PublicAstrologer> get _visible {
    final query = _search.trim().toLowerCase();

    if (query.isEmpty) {
      return _astrologers;
    }

    return _astrologers
        .where((astrologer) {
          final searchable = [
            astrologer.name,
            astrologer.primaryExpertise,
            astrologer.languageLabel,
          ].join(' ').toLowerCase();

          return searchable.contains(query);
        })
        .toList(growable: false);
  }

  void _openAstrologer(PublicAstrologer astrologer) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => AstrologerDetailScreen(
          astrologerId: astrologer.id,
          astrologyQuestionId: widget.astrologyQuestionId,
          astrologyQuestionText: widget.astrologyQuestionText,
          astrologyCategorySlug: _selectedCategorySlug,
          isFreeChatIntent: widget.isFreeChatIntent,
          freeChatMinutes: widget.freeChatMinutes,
        ),
      ),
    );
  }

  @override
  void dispose() {
    _searchController.dispose();
    _categoryApi.close();
    _api.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final astrologers = _visible;
    final onlineCount = astrologers.where((item) => item.isOnline).length;

    return
    // CUSTOMER_SHARED_PREMIUM_BACKGROUND
    Scaffold(
      backgroundColor: const Color(0xFFFFF9F1),
      appBar: AppBar(
        elevation: 0,
        backgroundColor: const Color(0xFFFFF9F1),
        foregroundColor: AppColors.white,
        titleSpacing: 16,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.screenTitle,
              style: const TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w900,
                letterSpacing: -0.5,
              ),
            ),
            if (!_loading && _error.isEmpty)
              Text(
                '${astrologers.length} astrologers | $onlineCount online',
                style: const TextStyle(
                  color: AppColors.muted,
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
              ),
          ],
        ),
      ),
      body: Stack(
        children: [
          Positioned.fill(
            child: RefreshIndicator(
              onRefresh: _load,
              color: AppColors.gold,
              child: CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  if (widget.showCategoryFilters)
                    SliverToBoxAdapter(child: _buildAskCategories()),
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                      child: TextField(
                        controller: _searchController,
                        onChanged: (value) {
                          setState(() {
                            _search = value;
                          });
                        },
                        style: const TextStyle(
                          color: AppColors.white,
                          fontWeight: FontWeight.w600,
                        ),
                        decoration: InputDecoration(
                          hintText: 'Search name, expertise or language',
                          hintStyle: const TextStyle(
                            color: AppColors.muted,
                            fontSize: 13,
                          ),
                          prefixIcon: const Icon(
                            Icons.search_rounded,
                            color: AppColors.gold,
                          ),
                          suffixIcon: _search.isEmpty
                              ? null
                              : IconButton(
                                  onPressed: () {
                                    _searchController.clear();

                                    setState(() {
                                      _search = '';
                                    });
                                  },
                                  icon: const Icon(
                                    Icons.close_rounded,
                                    color: AppColors.muted,
                                  ),
                                ),
                          filled: true,
                          fillColor: const Color(0xFFFFFFFF),
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 15,
                          ),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(18),
                            borderSide: BorderSide.none,
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(18),
                            borderSide: const BorderSide(
                              color: Color(0xCCFFC928),
                              width: 1.15,
                            ),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(18),
                            borderSide: const BorderSide(
                              color: Color(0xFFF4C542),
                              width: 1.6,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  if (_loading)
                    const SliverFillRemaining(
                      hasScrollBody: false,
                      child: Center(
                        child: CircularProgressIndicator(color: AppColors.gold),
                      ),
                    )
                  else if (_error.isNotEmpty)
                    SliverFillRemaining(
                      hasScrollBody: false,
                      child: Center(
                        child: Padding(
                          padding: const EdgeInsets.all(28),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.cloud_off_rounded,
                                size: 42,
                                color: AppColors.muted,
                              ),
                              const SizedBox(height: 14),
                              Text(
                                _error,
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  color: AppColors.white,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(height: 18),
                              FilledButton.icon(
                                onPressed: _load,
                                icon: const Icon(Icons.refresh_rounded),
                                label: const Text('Try again'),
                              ),
                            ],
                          ),
                        ),
                      ),
                    )
                  else if (astrologers.isEmpty)
                    const SliverFillRemaining(
                      hasScrollBody: false,
                      child: Center(
                        child: Padding(
                          padding: EdgeInsets.all(24),
                          child: Text(
                            'No astrologers found.',
                            style: TextStyle(
                              color: AppColors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                    )
                  else
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 18),
                      sliver: SliverList.separated(
                        itemCount: astrologers.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 14),
                        itemBuilder: (context, index) {
                          return _ProfessionalAstrologerCard(
                            astrologer: astrologers[index],
                            onTap: () => _openAstrologer(astrologers[index]),
                          );
                        },
                      ),
                    ),

                  // Keep list content clear of the fixed cosmic artwork.
                  const SliverToBoxAdapter(child: SizedBox(height: 245)),
                ],
              ),
            ),
          ),
          const Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: IgnorePointer(child: _AskCosmicFooter()),
          ),
        ],
      ),
    );
  }
}

class _AskCosmicFooter extends StatelessWidget {
  const _AskCosmicFooter();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 245,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.transparent,
                    const Color(0xFFFFF9F1).withValues(alpha: 0.30),
                    const Color(0xFFF0E9FF).withValues(alpha: 0.65),
                    const Color(0xFFFFF9F1),
                  ],
                  stops: const [0.0, 0.36, 0.72, 1.0],
                ),
              ),
            ),
          ),

          // Large deep-purple horizon.
          Positioned(
            left: -100,
            right: -100,
            bottom: -145,
            child: Container(
              height: 250,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  center: const Alignment(0, -0.72),
                  radius: 0.88,
                  colors: [
                    const Color(0xFFD8C8FF).withValues(alpha: 0.65),
                    const Color(0xFF40126F).withValues(alpha: 0.85),
                    const Color(0xFFF8F3FF),
                    const Color(0xFFFFF9F1),
                  ],
                  stops: const [0.0, 0.24, 0.58, 1.0],
                ),
                border: Border.all(
                  color: const Color(0xFFB79BEA).withValues(alpha: 0.42),
                  width: 1.1,
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFCDBAF5).withValues(alpha: 0.35),
                    blurRadius: 34,
                    spreadRadius: 5,
                  ),
                ],
              ),
            ),
          ),

          // Main orbit.
          Positioned(
            bottom: 44,
            child: Container(
              width: 220,
              height: 118,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(120),
                border: Border.all(
                  color: const Color(0xFFF4C542).withValues(alpha: 0.20),
                  width: 1,
                ),
              ),
            ),
          ),

          // Secondary orbit.
          Positioned(
            bottom: 66,
            child: Container(
              width: 150,
              height: 72,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(90),
                border: Border.all(
                  color: const Color(0xFFB79BEA).withValues(alpha: 0.24),
                  width: 1,
                ),
              ),
            ),
          ),

          // Main golden sun.
          Positioned(
            bottom: 78,
            child: Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: const RadialGradient(
                  colors: [
                    Color(0xFFFFFFB0),
                    Color(0xFFFFD73A),
                    Color(0xFFFFA600),
                  ],
                  stops: [0.0, 0.52, 1.0],
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFF4C542).withValues(alpha: 0.58),
                    blurRadius: 30,
                    spreadRadius: 7,
                  ),
                ],
              ),
              child: const Icon(
                Icons.wb_sunny_rounded,
                color: Color(0xFF5A3000),
                size: 43,
              ),
            ),
          ),

          // Moon.
          const Positioned(
            right: 86,
            bottom: 84,
            child: Icon(
              Icons.nightlight_round,
              color: Color(0xFFF4C542),
              size: 28,
            ),
          ),

          // Golden stars.
          const Positioned(
            left: 76,
            bottom: 102,
            child: Icon(Icons.auto_awesome, color: Color(0xFFF4C542), size: 19),
          ),
          const Positioned(
            right: 52,
            bottom: 128,
            child: Icon(Icons.star_rounded, color: Color(0xFFF4C542), size: 13),
          ),
          const Positioned(
            left: 45,
            bottom: 58,
            child: Icon(Icons.star_rounded, color: Color(0xFFCD7DFF), size: 12),
          ),

          Positioned(
            bottom: 16,
            left: 16,
            right: 16,
            child: Container(
              height: 1,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    Colors.transparent,
                    const Color(0xFFF4C542).withValues(alpha: 0.75),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfessionalAstrologerCard extends StatelessWidget {
  const _ProfessionalAstrologerCard({
    required this.astrologer,
    required this.onTap,
  });

  final PublicAstrologer astrologer;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final avatarUrl = astrologer.avatarUrl?.trim();
    final hasAvatar = avatarUrl != null && avatarUrl.isNotEmpty;

    final statusText = !astrologer.isOnline
        ? 'Offline'
        : astrologer.isBusy
        ? 'Wait ~${astrologer.chatWaitMinutes} min'
        : 'Available now';

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(24),
        child: Ink(
          decoration: BoxDecoration(
            color: const Color(0xFFFFFFFF),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(
              color: astrologer.isOnline
                  ? const Color(0xFFF4C542)
                  : const Color(0xFFD8C9EA),
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFFF4C542).withValues(alpha: 0.12),
                blurRadius: 18,
                spreadRadius: 0.5,
                offset: const Offset(0, 7),
              ),
              BoxShadow(
                color: const Color(0xFF7551C9).withValues(alpha: 0.13),
                blurRadius: 24,
                spreadRadius: 1,
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Container(
                      width: 68,
                      height: 68,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: const Color(0xFFF4C542),
                          width: 2.2,
                        ),
                        color: const Color(0xFFFFFFFF),
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: hasAvatar
                          ? Image.network(
                              avatarUrl,
                              fit: BoxFit.cover,
                              errorBuilder: (_, _, _) {
                                return _InitialAvatar(name: astrologer.name);
                              },
                            )
                          : _InitialAvatar(name: astrologer.name),
                    ),
                    Positioned(
                      right: 1,
                      bottom: 3,
                      child: Container(
                        width: 14,
                        height: 14,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: astrologer.isOnline
                              ? const Color(0xFF24D49A)
                              : const Color(0xFF7B8797),
                          border: Border.all(
                            color: const Color(0xFFFFFFFF),
                            width: 2,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              astrologer.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: AppColors.white,
                                fontSize: 16,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0x221F365F),
                              borderRadius: BorderRadius.circular(24),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(
                                  Icons.star_rounded,
                                  size: 14,
                                  color: AppColors.gold,
                                ),
                                const SizedBox(width: 3),
                                Text(
                                  astrologer.ratingLabel,
                                  style: const TextStyle(
                                    color: AppColors.white,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 5),
                      Text(
                        astrologer.primaryExpertise,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.gold,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 5),
                      Text(
                        '${astrologer.experienceLabel} | ${astrologer.languageLabel}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(
                            child: Row(
                              children: [
                                Icon(
                                  astrologer.isOnline
                                      ? Icons.circle
                                      : Icons.circle_outlined,
                                  size: 9,
                                  color: astrologer.isOnline
                                      ? const Color(0xFF24D49A)
                                      : AppColors.muted,
                                ),
                                const SizedBox(width: 5),
                                Expanded(
                                  child: Text(
                                    statusText,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      color: astrologer.isOnline
                                          ? const Color(0xFF65E6BC)
                                          : AppColors.muted,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            astrologer.priceLabel,
                            style: const TextStyle(
                              color: AppColors.gold,
                              fontSize: 14,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(width: 2),
                          const Icon(
                            Icons.chevron_right_rounded,
                            color: AppColors.gold,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _InitialAvatar extends StatelessWidget {
  const _InitialAvatar({required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Text(
        name.trim().isEmpty ? 'A' : name.trim()[0].toUpperCase(),
        style: const TextStyle(
          color: AppColors.gold,
          fontSize: 25,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}
