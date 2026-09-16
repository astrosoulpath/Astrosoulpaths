import 'package:flutter/material.dart';

import '../../data/ai_astro_api.dart';
import '../../data/ai_astro_models.dart';
import 'ai_astro_detail_screen.dart';
// CUSTOMER_FINAL_PREMIUM_PHASE4

class AiAstroHomeScreen extends StatefulWidget {
  const AiAstroHomeScreen({
    this.initialCategory = 'ALL',
    this.showBackButton = true,
    super.key,
  });

  final String initialCategory;
  final bool showBackButton;

  @override
  State<AiAstroHomeScreen> createState() => _AiAstroHomeScreenState();
}

class _AiAstroHomeScreenState extends State<AiAstroHomeScreen> {
  final AiAstroApi _api = AiAstroApi();

  bool _loading = true;
  String _error = '';
  late String _selectedCategory;

  List<AiAstroPersona> _personas = const [];
  List<AiConsultantType> _consultantTypes = const [];
  String _selectedConsultantTypeCode = '';

  @override
  void initState() {
    super.initState();

    _selectedCategory = widget.initialCategory.trim().toUpperCase();

    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = '';
    });

    try {
      final catalog = await _api.getCatalog();

      if (!mounted) {
        return;
      }

      setState(() {
        _personas = catalog.personas;
        _consultantTypes = catalog.consultantTypes;

        if (_consultantTypes.isNotEmpty &&
            !_consultantTypes.any(
              (item) => item.code == _selectedConsultantTypeCode,
            )) {
          _selectedConsultantTypeCode = _consultantTypes.first.code;
        }
        _loading = false;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = error.toString();
        _loading = false;
      });
    }
  }

  List<AiAstroPersona> get _visiblePersonas {
    if (_selectedCategory == 'ALL') {
      return _personas.where((persona) => persona.available).toList();
    }

    return _personas
        .where(
          (persona) =>
              persona.available &&
              persona.categories.contains(_selectedCategory),
        )
        .toList();
  }

  void _goBackToHome() {
    if (!mounted) {
      return;
    }

    final navigator = Navigator.of(context);

    if (navigator.canPop()) {
      navigator.pop();
    }
  }

  Future<void> _openPersona(AiAstroPersona persona) async {
    var selectedCategory = _selectedCategory;

    if (_consultantTypes.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('AI consultants are not available right now.'),
        ),
      );
      return;
    }

    final selectedConsultantType = _consultantTypes.firstWhere(
      (item) => item.code == _selectedConsultantTypeCode,
      orElse: () => _consultantTypes.first,
    );

    if (selectedCategory.trim().toUpperCase() == 'ALL') {
      selectedCategory = 'GENERAL';
    }

    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => AiAstroDetailScreen(
          persona: persona,
          category: selectedCategory,
          consultantType: selectedConsultantType,
        ),
      ),
    );
  }

  AiConsultantType? get _selectedConsultantType {
    if (_consultantTypes.isEmpty) {
      return null;
    }

    return _consultantTypes.firstWhere(
      (item) => item.code == _selectedConsultantTypeCode,
      orElse: () => _consultantTypes.first,
    );
  }

  @override
  void dispose() {
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return
    // CUSTOMER_SHARED_PREMIUM_BACKGROUND
    Scaffold(
      appBar: widget.showBackButton
          ? AppBar(
              backgroundColor: const Color(0xFF08070D),
              surfaceTintColor: Colors.transparent,
              elevation: 0,
              scrolledUnderElevation: 0,
              centerTitle: false,
              leadingWidth: 64,
              leading: Padding(
                padding: const EdgeInsets.only(left: 16),
                child: Material(
                  color: const Color(0xFF171717),
                  shape: const CircleBorder(),
                  child: InkWell(
                    customBorder: const CircleBorder(),
                    onTap: _goBackToHome,
                    // Back to customer Home
                    child: const SizedBox(
                      width: 44,
                      height: 44,
                      child: Icon(
                        Icons.arrow_back_rounded,
                        color: Color(0xFFFFD21C),
                        size: 25,
                      ),
                    ),
                  ),
                ),
              ),
              title: const Text(
                'AI Astro',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                ),
              ),
            )
          : null,
      backgroundColor: const Color(0xFF050506),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _load,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(18, 18, 18, 12),
                  child: _HeaderCard(consultant: _selectedConsultantType),
                ),
              ),
              if (_loading)
                const SliverFillRemaining(
                  hasScrollBody: false,
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (_error.isNotEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: _ErrorState(message: _error, onRetry: _load),
                )
              else ...[
                if (_consultantTypes.isNotEmpty)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(18, 4, 18, 18),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Choose your AI Specialist',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 6),
                          const Text(
                            'Choose your specialist',
                            style: TextStyle(
                              color: Color(0xFFB9B9C9),
                              fontSize: 13,
                            ),
                          ),
                          const SizedBox(height: 14),
                          SizedBox(
                            height: 126,
                            child: ListView.separated(
                              scrollDirection: Axis.horizontal,
                              itemCount: _consultantTypes.length,
                              separatorBuilder: (context, index) =>
                                  const SizedBox(width: 12),
                              itemBuilder: (context, index) {
                                final consultant = _consultantTypes[index];

                                final selected =
                                    consultant.code ==
                                    _selectedConsultantTypeCode;

                                return InkWell(
                                  borderRadius: BorderRadius.circular(18),
                                  onTap: () {
                                    setState(() {
                                      _selectedConsultantTypeCode =
                                          consultant.code;
                                    });
                                  },
                                  child: AnimatedContainer(
                                    duration: const Duration(milliseconds: 180),
                                    width: 190,
                                    padding: const EdgeInsets.all(14),
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(18),
                                      color: selected
                                          ? const Color(0xFFFFD52E)
                                          : const Color(0xFF23132E),
                                      border: Border.all(
                                        color: selected
                                            ? const Color(0xFFFFEDA2)
                                            : const Color(0xFF9B4AC5),
                                      ),
                                    ),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Icon(
                                              Icons.auto_awesome_rounded,
                                              size: 20,
                                              color: selected
                                                  ? const Color(0xFF071936)
                                                  : const Color(0xFFC9B8FF),
                                            ),
                                            const SizedBox(width: 8),
                                            Expanded(
                                              child: Text(
                                                consultant.name,
                                                maxLines: 2,
                                                overflow: TextOverflow.ellipsis,
                                                style: TextStyle(
                                                  fontSize: 14,
                                                  fontWeight: FontWeight.w800,
                                                  color: selected
                                                      ? const Color(0xFF071936)
                                                      : Colors.white,
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 8),
                                        Expanded(
                                          child: Text(
                                            consultant.description,
                                            maxLines: 3,
                                            overflow: TextOverflow.ellipsis,
                                            style: TextStyle(
                                              height: 1.25,
                                              fontSize: 11.5,
                                              color: selected
                                                  ? const Color(0xFF34415C)
                                                  : const Color(0xFFB9B9C9),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                );
                              },
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                const SliverToBoxAdapter(child: SizedBox(height: 4)),

                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(18, 0, 18, 28),
                  sliver: SliverList.separated(
                    itemCount: _visiblePersonas.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 14),
                    itemBuilder: (context, index) {
                      final persona = _visiblePersonas[index];

                      return _PersonaCard(
                        persona: persona,
                        onTap: () => _openPersona(persona),
                      );
                    },
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _HeaderCard extends StatelessWidget {
  const _HeaderCard({required this.consultant});

  final AiConsultantType? consultant;

  String get _heroDescription {
    final name = consultant?.name.trim().toLowerCase() ?? '';

    if (name.contains('vedic')) {
      return 'Ask about career, marriage, finance, health and life guidance through Vedic astrology.';
    }

    if (name.contains('kp')) {
      return 'Ask precise timing and event-based questions using KP astrology.';
    }

    if (name.contains('numerolog')) {
      return 'Ask about career, relationships, business and personal cycles through numerology.';
    }

    if (name.contains('vaastu') || name.contains('vastu')) {
      return 'Ask about home, office, directions, layout and energy balance through Vaastu.';
    }

    if (name.contains('tarot')) {
      return 'Ask about love, career, choices and current energies through Tarot guidance.';
    }

    if (name.contains('life coach')) {
      return 'Ask about goals, habits, confidence, decisions and personal growth.';
    }

    if (name.contains('psycholog')) {
      return 'Ask about stress, emotions, relationships, habits and practical mental wellbeing.';
    }

    if (name.contains('feng shui')) {
      return 'Ask about home, workspace, placement and energy flow through Feng Shui.';
    }

    if (name.contains('ayurved')) {
      return 'Ask about daily routines, lifestyle balance, food habits and Ayurvedic wellbeing.';
    }

    if (name.contains('yoga')) {
      return 'Ask about yoga practice, breathing, mobility, focus and daily wellbeing.';
    }

    return 'Choose an AI consultant for personalized guidance across astrology, numerology, wellbeing and life decisions.';
  }

  String get _personalizationNote {
    final name = consultant?.name.trim().toLowerCase() ?? '';

    if (name.contains('vedic')) {
      return 'Your saved birth profile and calculated Kundli support personalized Vedic guidance.';
    }

    if (name.contains('kp')) {
      return 'Your saved birth profile and calculated Kundli support personalized KP guidance.';
    }

    if (name.contains('numerolog')) {
      return 'Your saved birth details support personalized numerology guidance.';
    }

    if (name.contains('vaastu') || name.contains('vastu')) {
      return 'Your selected space and consultation topic shape your Vaastu guidance.';
    }

    if (name.contains('tarot')) {
      return 'Your selected question and consultation topic shape your Tarot guidance.';
    }

    if (name.contains('life coach')) {
      return 'Your goals and consultation topic shape practical coaching guidance.';
    }

    if (name.contains('psycholog')) {
      return 'Your concerns and consultation topic shape supportive wellbeing guidance.';
    }

    if (name.contains('feng shui')) {
      return 'Your selected space and consultation topic shape your Feng Shui guidance.';
    }

    if (name.contains('ayurved')) {
      return 'Your wellness goals and consultation topic shape lifestyle guidance.';
    }

    if (name.contains('yoga')) {
      return 'Your goals and consultation topic shape personalized practice guidance.';
    }

    return 'Your selected specialist and consultation topic shape your personalized guidance.';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(26),
        border: Border.all(
          color: const Color(0xFFFFD21C).withValues(alpha: 0.92),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFFFC928).withValues(alpha: 0.20),
            blurRadius: 28,
            spreadRadius: 1,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Stack(
        children: [
          const Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    Color(0xFF351B02),
                    Color(0xFF24103D),
                    Color(0xFF10061C),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
            ),
          ),

          Positioned(
            right: -55,
            top: -70,
            child: Container(
              width: 210,
              height: 210,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    const Color(0xFFFFC928).withValues(alpha: 0.18),
                    const Color(0xFF8B38D1).withValues(alpha: 0.16),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),

          Positioned(
            right: 20,
            bottom: 10,
            child: Opacity(
              opacity: 0.14,
              child: Container(
                width: 125,
                height: 125,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: const Color(0xFFD39AF3),
                    width: 1.2,
                  ),
                ),
                child: const Stack(
                  alignment: Alignment.center,
                  children: [
                    Icon(
                      Icons.auto_awesome_rounded,
                      size: 52,
                      color: Color(0xFFE9C3FF),
                    ),
                    Positioned(
                      top: 14,
                      child: Icon(
                        Icons.star_rounded,
                        size: 18,
                        color: Color(0xFFFFD56A),
                      ),
                    ),
                    Positioned(
                      right: 18,
                      bottom: 24,
                      child: Icon(
                        Icons.star_border_rounded,
                        size: 17,
                        color: Color(0xFFE9C3FF),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 19),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 50,
                      height: 50,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: const LinearGradient(
                          colors: [Color(0xFFFFD66D), Color(0xFFF0B846)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(
                              0xFFFFD36A,
                            ).withValues(alpha: 0.24),
                            blurRadius: 22,
                          ),
                        ],
                      ),
                      child: const Icon(
                        Icons.auto_awesome_rounded,
                        color: Color(0xFF14172B),
                        size: 26,
                      ),
                    ),
                    const SizedBox(width: 13),
                    const Expanded(
                      child: Text(
                        'AI Astro',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 27,
                          letterSpacing: -0.4,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(999),
                        color: const Color(0xFF33220A).withValues(alpha: 0.88),
                        border: Border.all(
                          color: const Color(
                            0xFFFFD21C,
                          ).withValues(alpha: 0.72),
                        ),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.auto_awesome,
                            size: 13,
                            color: Color(0xFFFFD66D),
                          ),
                          SizedBox(width: 5),
                          Text(
                            'Personalized',
                            style: TextStyle(
                              color: Color(0xFFE1D6F5),
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                SizedBox(height: 16),
                SizedBox(
                  width: 285,
                  child: Text(
                    _heroDescription,
                    style: TextStyle(
                      color: Color(0xFFF0EBF7),
                      height: 1.48,
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
                const SizedBox(height: 11),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 11,
                    vertical: 9,
                  ),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(13),
                    color: const Color(0xFF100B17).withValues(alpha: 0.76),
                    border: Border.all(
                      color: const Color(0xFFFFD36A).withValues(alpha: 0.28),
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.stars_rounded,
                        size: 16,
                        color: Color(0xFFD09AF1),
                      ),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _personalizationNote,
                          style: TextStyle(
                            color: Color(0xFFC2B4D7),
                            height: 1.35,
                            fontSize: 11.5,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PersonaCard extends StatelessWidget {
  const _PersonaCard({required this.persona, required this.onTap});

  final AiAstroPersona persona;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final avatarUrl = persona.avatarUrl?.trim();
    final hasAvatar = avatarUrl != null && avatarUrl.isNotEmpty;

    final pricePerMinute = persona.aiPricing.pricePerMinute;
    final currency = persona.aiPricing.currency.trim().toUpperCase();

    final formattedPrice = pricePerMinute != null && pricePerMinute > 0
        ? (pricePerMinute % 1 == 0
              ? pricePerMinute.toStringAsFixed(0)
              : pricePerMinute.toStringAsFixed(2))
        : null;

    final currencyPrefix = currency == 'INR' ? '\u20B9' : '$currency ';

    final priceLabel = formattedPrice != null
        ? '$currencyPrefix$formattedPrice/min'
        : null;

    final card = Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        gradient: const LinearGradient(
          colors: [Color(0xFF090B17), Color(0xFF18112D), Color(0xFF07172C)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(color: const Color(0xFFB85BE5), width: 1.1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.22),
            blurRadius: 22,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(22),
        child: InkWell(
          borderRadius: BorderRadius.circular(22),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 14),
            child: Row(
              children: [
                Container(
                  width: 76,
                  height: 76,
                  padding: const EdgeInsets.all(2.5),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: const LinearGradient(
                      colors: [Color(0xFFFFD21C), Color(0xFFD26AFF)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFFFFD21C).withValues(alpha: 0.20),
                        blurRadius: 14,
                      ),
                    ],
                  ),
                  child: ClipOval(
                    child: hasAvatar
                        ? Image.network(
                            avatarUrl,
                            fit: BoxFit.cover,
                            width: 71,
                            height: 71,
                            errorBuilder: (context, error, stackTrace) {
                              return _PremiumAvatarFallback(
                                initials: persona.initials,
                              );
                            },
                          )
                        : _PremiumAvatarFallback(initials: persona.initials),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        persona.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        persona.subtitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Color(0xFFC092E8),
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 9),
                      Wrap(
                        spacing: 9,
                        runSpacing: 5,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.star_rounded,
                                size: 17,
                                color: Color(0xFFFFC857),
                              ),
                              const SizedBox(width: 3),
                              Text(
                                persona.rating.toStringAsFixed(1),
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                          Text(
                            '${persona.experience} yr exp',
                            style: const TextStyle(
                              color: Color(0xFFAAA6BE),
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.circle,
                                size: 8,
                                color: persona.available
                                    ? const Color(0xFF54D99B)
                                    : const Color(0xFF777F96),
                              ),
                              const SizedBox(width: 5),
                              Text(
                                persona.available ? 'Online' : 'Offline',
                                style: TextStyle(
                                  color: persona.available
                                      ? const Color(0xFF54D99B)
                                      : const Color(0xFF9297A8),
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                Container(
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFFFFE36D), Color(0xFFFFB915)],
                    ),
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFFFFC928).withValues(alpha: 0.20),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 15,
                    vertical: 12,
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text(
                        'Ask AI',
                        style: TextStyle(
                          color: Color(0xFF11182C),
                          fontSize: 13,
                          fontWeight: FontWeight.w900,
                          height: 1,
                        ),
                      ),
                      if (priceLabel != null) ...[
                        const SizedBox(height: 3),
                        Text(
                          priceLabel,
                          style: const TextStyle(
                            color: Color(0xFF11182C),
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            height: 1,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );

    return card;
  }
}

class _PremiumAvatarFallback extends StatelessWidget {
  const _PremiumAvatarFallback({required this.initials});

  final String initials;

  @override
  Widget build(BuildContext context) {
    return Container(
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        gradient: RadialGradient(
          colors: [Color(0xFF392D68), Color(0xFF151633)],
        ),
      ),
      child: Stack(
        alignment: Alignment.center,
        children: [
          const Positioned(
            top: 8,
            right: 10,
            child: Icon(Icons.auto_awesome, size: 15, color: Color(0xFFF7CC61)),
          ),
          Text(
            initials,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final Future<void> Function() onRetry;

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
              color: Color(0xFFFFC928),
              size: 42,
            ),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 14),
            FilledButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}
