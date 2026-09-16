import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../data/auth_portal.dart';
import 'login_screen.dart';

class WelcomeScreen extends StatefulWidget {
  const WelcomeScreen({super.key});

  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen> {
  final PageController _pageController = PageController();
  int _currentPage = 0;

  static const _pages = <_OnboardingPageData>[
    _OnboardingPageData(
      icon: Icons.auto_awesome_rounded,
      eyebrow: 'WELCOME TO ASTRO SOUL PATH',
      title: 'Your stars.\nYour path.',
      description:
          'Discover personalized astrological guidance designed around your journey.',
    ),
    _OnboardingPageData(
      icon: Icons.forum_rounded,
      eyebrow: 'PERSONAL GUIDANCE',
      title: 'Talk to trusted\nastrologers.',
      description:
          'Connect through chat, audio and video consultation whenever you need guidance.',
    ),
    _OnboardingPageData(
      icon: Icons.brightness_2_rounded,
      eyebrow: 'PERSONALIZED FOR YOU',
      title: 'Kundli & insights\nthat feel personal.',
      description:
          'Explore your birth chart, daily guidance and astrology insights in one experience.',
    ),
    _OnboardingPageData(
      icon: Icons.card_giftcard_rounded,
      eyebrow: 'A WARM WELCOME',
      title: 'Begin your journey\nwith confidence.',
      description:
          'Sign in to discover your eligible new-customer welcome benefits and start exploring.',
      isFinal: true,
    ),
  ];

  void _openPortal(AuthPortal portal) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => LoginScreen(portal: portal)),
    );
  }

  Future<void> _next() async {
    if (_currentPage < _pages.length - 1) {
      await _pageController.nextPage(
        duration: const Duration(milliseconds: 420),
        curve: Curves.easeOutCubic,
      );
      return;
    }

    _openPortal(AuthPortal.customer);
  }

  Future<void> _previous() async {
    if (_currentPage <= 0) {
      return;
    }

    await _pageController.previousPage(
      duration: const Duration(milliseconds: 420),
      curve: Curves.easeOutCubic,
    );
  }

  Future<void> _goToFinalPage() async {
    await _pageController.animateToPage(
      _pages.length - 1,
      duration: const Duration(milliseconds: 500),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isFinal = _currentPage == _pages.length - 1;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Stack(
        children: [
          const Positioned.fill(child: _PremiumBackground()),
          SafeArea(
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(22, 12, 22, 0),
                  child: Row(
                    children: [
                      if (_currentPage > 0) ...[
                        IconButton(
                          onPressed: _previous,
                          tooltip: 'Back',
                          visualDensity: VisualDensity.compact,
                          icon: const Icon(
                            Icons.arrow_back_rounded,
                            color: AppColors.gold,
                            size: 22,
                          ),
                        ),
                        const SizedBox(width: 2),
                      ],
                      const _MiniBrand(),
                      const Spacer(),
                      AnimatedOpacity(
                        opacity: isFinal ? 0 : 1,
                        duration: const Duration(milliseconds: 220),
                        child: IgnorePointer(
                          ignoring: isFinal,
                          child: TextButton(
                            onPressed: _goToFinalPage,
                            child: const Text(
                              'Skip',
                              style: TextStyle(
                                color: AppColors.muted,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: PageView.builder(
                    controller: _pageController,
                    physics: const BouncingScrollPhysics(),
                    itemCount: _pages.length,
                    onPageChanged: (index) {
                      setState(() => _currentPage = index);
                    },
                    itemBuilder: (context, index) {
                      return _OnboardingPage(data: _pages[index]);
                    },
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 0, 24, 20),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: List.generate(
                          _pages.length,
                          (index) => AnimatedContainer(
                            duration: const Duration(milliseconds: 260),
                            curve: Curves.easeOut,
                            margin: const EdgeInsets.symmetric(horizontal: 4),
                            width: index == _currentPage ? 28 : 7,
                            height: 7,
                            decoration: BoxDecoration(
                              color: index == _currentPage
                                  ? AppColors.gold
                                  : AppColors.border,
                              borderRadius: BorderRadius.circular(99),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 22),
                      SizedBox(
                        width: double.infinity,
                        height: 58,
                        child: FilledButton(
                          onPressed: _next,
                          style: FilledButton.styleFrom(
                            backgroundColor: AppColors.gold,
                            foregroundColor: AppColors.background,
                            elevation: 0,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(18),
                            ),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                isFinal ? 'Continue as Customer' : 'Continue',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                              const SizedBox(width: 9),
                              const Icon(Icons.arrow_forward_rounded, size: 20),
                            ],
                          ),
                        ),
                      ),
                      if (isFinal) ...[
                        const SizedBox(height: 18),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            _PortalTextButton(
                              label: 'Astrologer Login',
                              onTap: () => _openPortal(AuthPortal.astrologer),
                            ),
                            Container(
                              width: 1,
                              height: 16,
                              margin: const EdgeInsets.symmetric(
                                horizontal: 14,
                              ),
                              color: AppColors.border,
                            ),
                            _PortalTextButton(
                              label: 'Join as Astrologer',
                              onTap: () =>
                                  _openPortal(AuthPortal.joinAstrologer),
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),
                        const Text(
                          'By continuing, you agree to our Terms of Service and Privacy Policy.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: Color(0xFF6F7B96),
                            fontSize: 10.5,
                            height: 1.45,
                          ),
                        ),
                      ] else
                        const SizedBox(height: 14),
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

class _OnboardingPage extends StatelessWidget {
  const _OnboardingPage({required this.data});

  final _OnboardingPageData data;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final availableHeight = constraints.maxHeight;

        final isVeryCompact = availableHeight < 520;
        final isCompact = availableHeight < 620;

        final horizontalPadding = isCompact ? 22.0 : 28.0;
        final verticalPadding = isVeryCompact
            ? 6.0
            : isCompact
            ? 10.0
            : 20.0;

        final welcomeLogoSize = isVeryCompact
            ? 155.0
            : isCompact
            ? 185.0
            : 245.0;

        final heroGap = data.isFinal
            ? (isCompact ? 10.0 : 18.0)
            : (isVeryCompact
                  ? 12.0
                  : isCompact
                  ? 22.0
                  : 44.0);

        final titleSize = data.isFinal
            ? (isCompact ? 24.0 : 28.0)
            : (isVeryCompact
                  ? 27.0
                  : isCompact
                  ? 30.0
                  : 34.0);

        final descriptionSize = isVeryCompact
            ? 12.0
            : isCompact
            ? 13.0
            : 14.0;

        final descriptionHeight = isCompact ? 1.4 : 1.6;

        return SingleChildScrollView(
          physics: const BouncingScrollPhysics(),
          padding: EdgeInsets.fromLTRB(
            horizontalPadding,
            verticalPadding,
            horizontalPadding,
            isCompact ? 8 : 18,
          ),
          child: ConstrainedBox(
            constraints: BoxConstraints(
              minHeight: (availableHeight - (verticalPadding * 2)).clamp(
                0.0,
                double.infinity,
              ),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                SizedBox(height: isCompact ? 2 : 10),

                if (data.eyebrow == 'WELCOME TO ASTRO SOUL PATH')
                  _CompanyWelcomeLogo(size: welcomeLogoSize)
                else
                  Transform.scale(
                    scale: isVeryCompact
                        ? 0.72
                        : isCompact
                        ? 0.84
                        : 1,
                    child: _OrbitingCelestialHero(
                      icon: data.icon,
                      isCompact: data.isFinal || isCompact,
                    ),
                  ),

                SizedBox(height: heroGap),

                if (data.eyebrow == 'WELCOME TO ASTRO SOUL PATH')
                  const _PremiumWelcomeHeading()
                else
                  Text(
                    data.eyebrow,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: AppColors.gold,
                      fontSize: isCompact ? 10 : 11,
                      fontWeight: FontWeight.w900,
                      letterSpacing: isCompact ? 1.35 : 1.55,
                    ),
                  ),

                SizedBox(height: isCompact ? 8 : 14),

                Text(
                  data.title,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: titleSize,
                    height: 1.06,
                    fontWeight: FontWeight.w900,
                    letterSpacing: isCompact ? -0.6 : -1.0,
                  ),
                ),

                SizedBox(height: isCompact ? 10 : 18),

                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 350),
                  child: Text(
                    data.description,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: AppColors.muted,
                      fontSize: descriptionSize,
                      height: descriptionHeight,
                    ),
                  ),
                ),

                if (data.isFinal) ...[
                  SizedBox(height: isCompact ? 8 : 10),
                  const _WelcomeBenefitCard(),
                ],

                SizedBox(height: isCompact ? 6 : 14),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _CompanyWelcomeLogo extends StatelessWidget {
  const _CompanyWelcomeLogo({this.size = 245});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SizedBox.square(
        dimension: size,
        child: ClipOval(
          clipBehavior: Clip.antiAlias,
          child: Transform.scale(
            scale: 1.025,
            child: Image.asset(
              'assets/branding/AstroSoulPathEmblem.png',
              width: size,
              height: size,
              fit: BoxFit.cover,
              alignment: Alignment.center,
              filterQuality: FilterQuality.high,
              isAntiAlias: true,
            ),
          ),
        ),
      ),
    );
  }
}

class _WelcomeBenefitCard extends StatelessWidget {
  const _WelcomeBenefitCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
      decoration: BoxDecoration(
        color: AppColors.surfaceLight.withValues(alpha: 0.92),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.gold.withValues(alpha: 0.45)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x33000000),
            blurRadius: 22,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: const Row(
        children: [
          _BenefitIcon(),
          SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Welcome Benefit',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 15,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                SizedBox(height: 5),
                Text(
                  'New customers can check eligible consultation benefits after sign-in.',
                  style: TextStyle(
                    color: AppColors.muted,
                    fontSize: 11.5,
                    height: 1.45,
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

class _BenefitIcon extends StatelessWidget {
  const _BenefitIcon();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 46,
      height: 46,
      decoration: BoxDecoration(
        color: AppColors.gold.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(14),
      ),
      child: const Icon(Icons.redeem_rounded, color: AppColors.gold, size: 24),
    );
  }
}

class _MiniBrand extends StatelessWidget {
  const _MiniBrand();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: AppColors.surface,
            border: Border.all(color: AppColors.gold.withValues(alpha: 0.8)),
          ),
          child: const Icon(
            Icons.nights_stay_rounded,
            size: 18,
            color: AppColors.gold,
          ),
        ),
        const SizedBox(width: 10),
        const Text(
          'Astro Soul Path',
          style: TextStyle(
            color: AppColors.white,
            fontSize: 14,
            fontWeight: FontWeight.w900,
          ),
        ),
      ],
    );
  }
}

class _PortalTextButton extends StatelessWidget {
  const _PortalTextButton({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
        child: Text(
          label,
          style: const TextStyle(
            color: AppColors.gold,
            fontSize: 11.5,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }
}

class _OrbitingCelestialHero extends StatefulWidget {
  const _OrbitingCelestialHero({required this.icon, required this.isCompact});

  final IconData icon;
  final bool isCompact;

  @override
  State<_OrbitingCelestialHero> createState() => _OrbitingCelestialHeroState();
}

class _OrbitingCelestialHeroState extends State<_OrbitingCelestialHero>
    with SingleTickerProviderStateMixin {
  late final AnimationController _orbitController;

  @override
  void initState() {
    super.initState();

    _orbitController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 12),
    )..repeat();
  }

  @override
  void dispose() {
    _orbitController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final outerSize = widget.isCompact ? 185.0 : 248.0;
    final centerSize = widget.isCompact ? 126.0 : 168.0;

    return SizedBox(
      width: outerSize,
      height: outerSize,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Container(
            width: outerSize,
            height: outerSize,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(
                colors: [
                  Color(0x44F4C45E),
                  Color(0x22172A5F),
                  Color(0x00172A5F),
                ],
              ),
            ),
          ),

          // Outer orbit ring
          Container(
            width: outerSize * 0.92,
            height: outerSize * 0.92,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: AppColors.gold.withValues(alpha: 0.28),
                width: 0.9,
              ),
            ),
          ),

          // Middle orbit ring
          Container(
            width: outerSize * 0.73,
            height: outerSize * 0.73,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: AppColors.gold.withValues(alpha: 0.22),
                width: 0.8,
              ),
            ),
          ),

          AnimatedBuilder(
            animation: _orbitController,
            builder: (context, child) {
              final angle = _orbitController.value * 6.283185307179586;

              return Transform.rotate(
                angle: angle,
                child: SizedBox(
                  width: outerSize * 0.92,
                  height: outerSize * 0.92,
                  child: Stack(
                    children: [
                      Positioned(
                        top: 2,
                        left: outerSize * 0.46 - 8,
                        child: const _OrbitBody(size: 16, icon: Icons.circle),
                      ),
                      Positioned(
                        right: 6,
                        top: outerSize * 0.34,
                        child: const _OrbitBody(size: 13, icon: Icons.circle),
                      ),
                      Positioned(
                        bottom: 10,
                        left: outerSize * 0.20,
                        child: const _OrbitBody(
                          size: 12,
                          icon: Icons.star_rounded,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),

          AnimatedBuilder(
            animation: _orbitController,
            builder: (context, child) {
              final angle = -_orbitController.value * 6.283185307179586 * 1.35;

              return Transform.rotate(
                angle: angle,
                child: SizedBox(
                  width: outerSize * 0.73,
                  height: outerSize * 0.73,
                  child: Stack(
                    children: [
                      Positioned(
                        top: outerSize * 0.08,
                        right: outerSize * 0.12,
                        child: const _OrbitBody(
                          size: 15,
                          icon: Icons.brightness_2_rounded,
                        ),
                      ),
                      Positioned(
                        bottom: outerSize * 0.08,
                        right: outerSize * 0.20,
                        child: const _OrbitBody(size: 10, icon: Icons.circle),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),

          Container(
            width: centerSize,
            height: centerSize,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.surface,
              border: Border.all(
                color: AppColors.gold.withValues(alpha: 0.85),
                width: 1.5,
              ),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x55F4C45E),
                  blurRadius: 38,
                  spreadRadius: 2,
                ),
              ],
            ),
            child: Icon(
              widget.icon,
              size: widget.isCompact ? 50 : 72,
              color: AppColors.gold,
            ),
          ),
        ],
      ),
    );
  }
}

class _OrbitBody extends StatelessWidget {
  const _OrbitBody({required this.size, required this.icon});

  final double size;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size + 8,
      height: size + 8,
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(color: Color(0x88F4C45E), blurRadius: 10, spreadRadius: 1),
        ],
      ),
      child: Icon(icon, size: size, color: AppColors.gold),
    );
  }
}

class _PremiumBackground extends StatefulWidget {
  const _PremiumBackground();

  @override
  State<_PremiumBackground> createState() => _PremiumBackgroundState();
}

class _PremiumBackgroundState extends State<_PremiumBackground>
    with SingleTickerProviderStateMixin {
  late final AnimationController _starController;

  @override
  void initState() {
    super.initState();

    _starController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 18),
    )..repeat();
  }

  @override
  void dispose() {
    _starController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            AppColors.surfaceLight,
            AppColors.surface,
            AppColors.background,
          ],
          stops: [0, 0.46, 1],
        ),
      ),
      child: AnimatedBuilder(
        animation: _starController,
        builder: (context, child) {
          final t = _starController.value;

          return Stack(
            children: [
              Positioned(
                top: -170,
                left: -80,
                right: -80,
                child: Container(
                  height: 370,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [Color(0x331E4E9E), Color(0x001E4E9E)],
                    ),
                  ),
                ),
              ),

              // STATIC STAR FIELD
              const Positioned(top: 95, left: 32, child: _TwinkleStar(size: 3)),
              const Positioned(
                top: 128,
                right: 36,
                child: _TwinkleStar(size: 4),
              ),
              const Positioned(
                top: 178,
                left: 58,
                child: _TwinkleStar(size: 2.5),
              ),
              const Positioned(
                top: 214,
                right: 68,
                child: _TwinkleStar(size: 3),
              ),
              const Positioned(
                top: 270,
                left: 26,
                child: _TwinkleStar(size: 2),
              ),
              const Positioned(
                top: 318,
                right: 35,
                child: _TwinkleStar(size: 4),
              ),
              const Positioned(
                top: 385,
                left: 78,
                child: _TwinkleStar(size: 2.5),
              ),
              const Positioned(
                top: 440,
                right: 92,
                child: _TwinkleStar(size: 3),
              ),
              const Positioned(
                top: 505,
                left: 42,
                child: _TwinkleStar(size: 2),
              ),
              const Positioned(
                top: 565,
                right: 44,
                child: _TwinkleStar(size: 3.5),
              ),
              const Positioned(
                bottom: 245,
                left: 52,
                child: _TwinkleStar(size: 3),
              ),
              const Positioned(
                bottom: 195,
                right: 82,
                child: _TwinkleStar(size: 2),
              ),
              const Positioned(
                bottom: 138,
                left: 105,
                child: _TwinkleStar(size: 2.5),
              ),
              const Positioned(
                bottom: 92,
                right: 38,
                child: _TwinkleStar(size: 3),
              ),

              // DRIFTING STAR 1
              Positioned(
                top: 145 + (t * 38),
                left: 24 + (t * 55),
                child: const _GlowStar(size: 8),
              ),

              // DRIFTING STAR 2 - opposite direction
              Positioned(
                top: 305 - (t * 28),
                right: 18 + (t * 42),
                child: const _GlowStar(size: 6),
              ),

              // DRIFTING STAR 3
              Positioned(
                bottom: 220 + (t * 24),
                left: 70 + (t * 36),
                child: const _GlowStar(size: 5),
              ),

              // SHOOTING STAR - TOP LEFT
              Positioned(
                top: 125 + (t * 95),
                left: -30 + (t * 155),
                child: Transform.rotate(
                  angle: -0.65,
                  child: const _ShootingStar(),
                ),
              ),

              // SHOOTING STAR - RIGHT
              Positioned(
                top: 290 + (t * 120),
                right: -50 + (t * 160),
                child: Transform.rotate(
                  angle: 2.45,
                  child: const _ShootingStar(length: 46),
                ),
              ),

              // SHOOTING STAR - LOWER
              Positioned(
                bottom: 150 + (t * 72),
                left: -40 + (t * 175),
                child: Transform.rotate(
                  angle: -0.55,
                  child: const _ShootingStar(length: 40),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _TwinkleStar extends StatelessWidget {
  const _TwinkleStar({required this.size});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: AppColors.gold.withValues(alpha: 0.72),
        shape: BoxShape.circle,
        boxShadow: const [BoxShadow(color: Color(0xAAF4C45E), blurRadius: 8)],
      ),
    );
  }
}

class _GlowStar extends StatelessWidget {
  const _GlowStar({required this.size});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Icon(
      Icons.auto_awesome_rounded,
      size: size,
      color: AppColors.gold,
      shadows: const [Shadow(color: Color(0xCCF4C45E), blurRadius: 12)],
    );
  }
}

class _ShootingStar extends StatelessWidget {
  const _ShootingStar({this.length = 52});

  final double length;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: length,
      height: 12,
      child: Row(
        children: [
          Container(
            width: length - 10,
            height: 2,
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  Color(0x00F4C45E),
                  Color(0x99F4C45E),
                  Color(0xFFF4C45E),
                ],
              ),
            ),
          ),
          Container(
            width: 8,
            height: 8,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.gold,
              boxShadow: [BoxShadow(color: Color(0xCCF4C45E), blurRadius: 12)],
            ),
          ),
        ],
      ),
    );
  }
}

class _PremiumWelcomeHeading extends StatefulWidget {
  const _PremiumWelcomeHeading();

  @override
  State<_PremiumWelcomeHeading> createState() => _PremiumWelcomeHeadingState();
}

class _PremiumWelcomeHeadingState extends State<_PremiumWelcomeHeading>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  static const _brand = 'ASTRO SOUL PATH';

  @override
  void initState() {
    super.initState();

    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1700),
    )..forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        FadeTransition(
          opacity: CurvedAnimation(
            parent: _controller,
            curve: const Interval(0.0, 0.28, curve: Curves.easeOut),
          ),
          child: const Text(
            'WELCOME TO',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Color(0xFFE9BD55),
              fontSize: 10,
              height: 1,
              fontWeight: FontWeight.w800,
              letterSpacing: 2.8,
            ),
          ),
        ),
        const SizedBox(height: 7),
        FittedBox(
          fit: BoxFit.scaleDown,
          child: AnimatedBuilder(
            animation: _controller,
            builder: (context, child) {
              return Row(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(_brand.length, (index) {
                  final character = _brand[index];

                  if (character == ' ') {
                    return const SizedBox(width: 7);
                  }

                  final start = 0.16 + ((index / _brand.length) * 0.62);
                  final end = (start + 0.20).clamp(0.0, 1.0);

                  final progress = Curves.easeOutCubic.transform(
                    ((_controller.value - start) / (end - start)).clamp(
                      0.0,
                      1.0,
                    ),
                  );

                  return Transform.translate(
                    offset: Offset(0, 7 * (1 - progress)),
                    child: Opacity(
                      opacity: progress,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 0.6),
                        child: Text(
                          character,
                          style: const TextStyle(
                            color: Color(0xFFFFC857),
                            fontSize: 19,
                            height: 1,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.5,
                            shadows: [
                              Shadow(color: Color(0x66F4C45E), blurRadius: 10),
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                }),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _OnboardingPageData {
  const _OnboardingPageData({
    required this.icon,
    required this.eyebrow,
    required this.title,
    required this.description,
    this.isFinal = false,
  });

  final IconData icon;
  final String eyebrow;
  final String title;
  final String description;
  final bool isFinal;
}
