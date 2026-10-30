import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/auth_portal.dart';

class CelestialLoginLayout extends StatelessWidget {
  const CelestialLoginLayout({
    super.key,
    required this.portal,
    required this.busy,
    required this.onGoogle,
    required this.onEmail,
    required this.onBack,
  });
  final AuthPortal portal;
  final bool busy;
  final VoidCallback onGoogle, onEmail, onBack;

  @override
  Widget build(BuildContext context) {
    final reduced = MediaQuery.disableAnimationsOf(context);
    final heading = switch (portal) {
      AuthPortal.customer => 'Consult trusted astrologers.',
      AuthPortal.astrologer => 'Connect with seekers.',
      AuthPortal.joinAstrologer => 'Share your wisdom.',
    };
    final label = switch (portal) {
      AuthPortal.customer => 'CUSTOMER ACCESS',
      AuthPortal.astrologer => 'ASTROLOGER ACCESS',
      AuthPortal.joinAstrologer => 'JOIN AS ASTROLOGER',
    };
    final subtitle = switch (portal) {
      AuthPortal.customer =>
        'Login securely to start chat or call consultation.',
      AuthPortal.astrologer =>
        'Login to manage your consultations, profile and earnings.',
      AuthPortal.joinAstrologer =>
        'Create your astrologer account to start your journey with Astro Soul Path.',
    };
    final trusts = switch (portal) {
      AuthPortal.customer => [
        'Secure Login',
        'Your Data Safe',
        'Verified Experts',
      ],
      AuthPortal.astrologer => [
        'Secure Login',
        'Manage Profile',
        'Grow Your Practice',
      ],
      AuthPortal.joinAstrologer => [
        'Verified Platform',
        'Grow Your Clients',
        'Secure & Trusted',
      ],
    };
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final heroHeight = (constraints.maxHeight * .38).clamp(
              250.0,
              360.0,
            );
            return SingleChildScrollView(
              child: Column(
                children: [
                  Stack(
                    children: [
                      TweenAnimationBuilder<double>(
                        tween: Tween(begin: reduced ? 1 : 0, end: 1),
                        duration: Duration(milliseconds: reduced ? 0 : 700),
                        builder: (context, glow, child) => Opacity(
                          opacity: .7 + .3 * glow,
                          child: SizedBox(
                            height: heroHeight,
                            width: double.infinity,
                            child: RepaintBoundary(
                              child: CustomPaint(
                                painter: _CelestialPainter(portal, glow),
                                child: Align(
                                  alignment: Alignment.bottomCenter,
                                  child: Padding(
                                    padding: const EdgeInsets.only(bottom: 18),
                                    child: Column(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        const Text(
                                          'Astro Soul Path',
                                          textAlign: TextAlign.center,
                                          style: TextStyle(
                                            color: AppColors.goldDark,
                                            fontFamily: 'serif',
                                            fontSize: 27,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                        const SizedBox(height: 5),
                                        const Text(
                                          'GUIDE \u2726 HEAL \u2726 GROW',
                                          style: TextStyle(
                                            color: AppColors.goldDark,
                                            fontSize: 10,
                                            letterSpacing: 2,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                      Positioned(
                        top: 8,
                        left: 12,
                        child: IconButton(
                          tooltip: 'Back',
                          onPressed: onBack,
                          style: IconButton.styleFrom(
                            backgroundColor: Colors.white.withValues(alpha: .9),
                          ),
                          icon: Icon(
                            Icons.arrow_back_rounded,
                            color: Theme.of(context).colorScheme.primary,
                          ),
                        ),
                      ),
                    ],
                  ),
                  TweenAnimationBuilder<double>(
                    tween: Tween(begin: reduced ? 1 : 0, end: 1),
                    duration: Duration(milliseconds: reduced ? 0 : 500),
                    builder: (context, progress, child) => Transform.translate(
                      offset: Offset(0, 12 * (1 - progress)),
                      child: Opacity(opacity: .7 + .3 * progress, child: child),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(18, 0, 18, 24),
                      child: Center(
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 480),
                          child: Container(
                            padding: const EdgeInsets.all(22),
                            decoration: BoxDecoration(
                              color: Theme.of(context).colorScheme.surface,
                              borderRadius: BorderRadius.circular(24),
                              border: Border.all(
                                color: Theme.of(context).colorScheme.outline,
                              ),
                              boxShadow: const [
                                BoxShadow(
                                  color: Color(0x0D42265D),
                                  blurRadius: 20,
                                  offset: Offset(0, 6),
                                ),
                              ],
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Center(
                                  child: CircleAvatar(
                                    radius: 24,
                                    backgroundColor: Theme.of(
                                      context,
                                    ).colorScheme.surfaceContainerHighest,
                                    child: Icon(
                                      switch (portal) {
                                        AuthPortal.customer =>
                                          Icons.groups_outlined,
                                        AuthPortal.astrologer =>
                                          Icons.auto_awesome_outlined,
                                        AuthPortal.joinAstrologer =>
                                          Icons.person_add_alt_1_outlined,
                                      },
                                      color: Theme.of(
                                        context,
                                      ).colorScheme.primary,
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 14),
                                Text(
                                  label,
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(
                                    color: AppColors.goldDark,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 1.4,
                                  ),
                                ),
                                const SizedBox(height: 10),
                                Text(
                                  heading,
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    color: Theme.of(
                                      context,
                                    ).colorScheme.onSurface,
                                    fontSize: 24,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                const SizedBox(height: 10),
                                Text(
                                  subtitle,
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    color: Theme.of(
                                      context,
                                    ).colorScheme.onSurfaceVariant,
                                    fontSize: 14,
                                    height: 1.5,
                                  ),
                                ),
                                const SizedBox(height: 24),
                                DecoratedBox(
                                  decoration: BoxDecoration(
                                    gradient: const LinearGradient(
                                      colors: [
                                        Color(0xFF8D62D9),
                                        Color(0xFF58339E),
                                      ],
                                    ),
                                    borderRadius: BorderRadius.circular(14),
                                  ),
                                  child: FilledButton(
                                    onPressed: busy ? null : onGoogle,
                                    style: FilledButton.styleFrom(
                                      backgroundColor: Colors.transparent,
                                      disabledBackgroundColor:
                                          Colors.transparent,
                                      foregroundColor: Colors.white,
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 14,
                                        vertical: 16,
                                      ),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(14),
                                      ),
                                    ),
                                    child: Row(
                                      children: [
                                        const _GoogleMark(),
                                        const SizedBox(width: 10),
                                        const Expanded(
                                          child: Text(
                                            'Continue with Google',
                                            textAlign: TextAlign.center,
                                          ),
                                        ),
                                        if (busy)
                                          const Icon(
                                            Icons.hourglass_top_rounded,
                                            size: 18,
                                            semanticLabel:
                                                'Authentication in progress',
                                          )
                                        else
                                          const Icon(
                                            Icons.arrow_forward_rounded,
                                            size: 18,
                                          ),
                                      ],
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 12),
                                OutlinedButton(
                                  onPressed: busy ? null : onEmail,
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: Theme.of(
                                      context,
                                    ).colorScheme.primary,
                                    side: BorderSide(
                                      color: Theme.of(
                                        context,
                                      ).colorScheme.primary,
                                    ),
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 14,
                                      vertical: 16,
                                    ),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(14),
                                    ),
                                  ),
                                  child: const Row(
                                    children: [
                                      Icon(Icons.email_outlined),
                                      SizedBox(width: 10),
                                      Expanded(
                                        child: Text(
                                          'Continue with Email',
                                          textAlign: TextAlign.center,
                                        ),
                                      ),
                                      Icon(
                                        Icons.arrow_forward_rounded,
                                        size: 18,
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 22),
                                Wrap(
                                  alignment: WrapAlignment.center,
                                  spacing: 14,
                                  runSpacing: 12,
                                  children: [
                                    for (var i = 0; i < trusts.length; i++)
                                      SizedBox(
                                        width: 100,
                                        child: Column(
                                          children: [
                                            Icon(
                                              [
                                                Icons.lock_outline,
                                                Icons.shield_outlined,
                                                Icons.verified_outlined,
                                              ][i],
                                              color: Theme.of(
                                                context,
                                              ).colorScheme.primary,
                                              size: 18,
                                            ),
                                            const SizedBox(height: 5),
                                            Text(
                                              trusts[i],
                                              textAlign: TextAlign.center,
                                              style: TextStyle(
                                                color: Theme.of(
                                                  context,
                                                ).colorScheme.onSurfaceVariant,
                                                fontSize: 10,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _GoogleMark extends StatelessWidget {
  const _GoogleMark();
  @override
  Widget build(BuildContext context) => Container(
    width: 25,
    height: 25,
    alignment: Alignment.center,
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.surface,
      shape: BoxShape.circle,
    ),
    child: const Text(
      'G',
      style: TextStyle(
        color: Color(0xFF4285F4),
        fontSize: 20,
        fontWeight: FontWeight.w900,
      ),
    ),
  );
}

class _CelestialPainter extends CustomPainter {
  _CelestialPainter(this.portal, this.glow);
  final AuthPortal portal;
  final double glow;
  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    canvas.drawRect(
      rect,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF211640), Color(0xFF5B3D82), AppColors.background],
          stops: [0, .55, 1],
        ).createShader(rect),
    );
    final center = Offset(size.width / 2, size.height * .38);
    final radius = math.min(size.width * .28, size.height * .27);
    final gold = Paint()
      ..color = AppColors.gold.withValues(alpha: .65 + .25 * glow)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    for (final factor in [1.0, 1.12, 1.24]) {
      canvas.drawCircle(center, radius * factor, gold);
    }
    for (var i = 0; i < 12; i++) {
      final angle = i * math.pi / 6;
      final direction = Offset(math.cos(angle), math.sin(angle));
      canvas.drawLine(
        center + direction * (radius * .95),
        center + direction * (radius * 1.12),
        gold,
      );
      canvas.drawCircle(
        center + direction * (radius * 1.18),
        2,
        Paint()..color = AppColors.gold,
      );
    }
    for (var i = 0; i < 24; i++) {
      final x = (i * 73 + 19) % size.width;
      final y = (i * 47 + 11) % (size.height * .65);
      final p = Paint()
        ..color = AppColors.gold.withValues(alpha: .25 + .5 * glow);
      canvas.drawLine(Offset(x - 2, y), Offset(x + 2, y), p);
      canvas.drawLine(Offset(x, y - 2), Offset(x, y + 2), p);
    }
    canvas.drawArc(
      Rect.fromCircle(
        center: Offset(size.width * .83, size.height * .16),
        radius: 12,
      ),
      .5,
      4.7,
      false,
      gold..strokeWidth = 3,
    );
    final silhouette = Paint()
      ..color = const Color(0xFF241936)
      ..style = PaintingStyle.fill;
    if (portal == AuthPortal.joinAstrologer) {
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromCenter(
            center: center,
            width: radius * .9,
            height: radius * .95,
          ),
          const Radius.circular(5),
        ),
        Paint()..color = const Color(0xFFECD4A5),
      );
      canvas.drawLine(
        center + Offset(-radius * .22, radius * .25),
        center + Offset(radius * .3, -radius * .35),
        gold..strokeWidth = 4,
      );
      canvas.drawOval(
        Rect.fromCenter(
          center: center + Offset(radius * .16, -radius * .2),
          width: 13,
          height: radius * .5,
        ),
        gold,
      );
    } else {
      canvas.drawCircle(
        center + Offset(0, -radius * .32),
        radius * .16,
        silhouette,
      );
      canvas.drawOval(
        Rect.fromCenter(
          center: center + Offset(0, radius * .12),
          width: radius * .5,
          height: radius * .7,
        ),
        silhouette,
      );
      if (portal == AuthPortal.customer) {
        canvas.drawOval(
          Rect.fromCenter(
            center: center + Offset(0, radius * .44),
            width: radius * 1.05,
            height: radius * .25,
          ),
          silhouette,
        );
        canvas.drawCircle(
          center,
          radius * .08,
          Paint()
            ..shader =
                const RadialGradient(
                  colors: [Colors.white, AppColors.gold, Colors.transparent],
                ).createShader(
                  Rect.fromCircle(center: center, radius: radius * .08),
                ),
        );
      } else {
        final book = Path()
          ..moveTo(center.dx - radius * .48, center.dy)
          ..lineTo(center.dx, center.dy + radius * .12)
          ..lineTo(center.dx + radius * .48, center.dy)
          ..lineTo(center.dx + radius * .4, center.dy + radius * .4)
          ..lineTo(center.dx, center.dy + radius * .5)
          ..lineTo(center.dx - radius * .4, center.dy + radius * .4)
          ..close();
        canvas.drawPath(book, Paint()..color = const Color(0xFFECD4A5));
      }
    }
  }

  @override
  bool shouldRepaint(_CelestialPainter oldDelegate) =>
      oldDelegate.portal != portal || oldDelegate.glow != glow;
}
