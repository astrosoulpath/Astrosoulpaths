import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'brand_emblem.dart';

class PremiumStartupSplash extends StatefulWidget {
  const PremiumStartupSplash({super.key});
  @override
  State<PremiumStartupSplash> createState() => _PremiumStartupSplashState();
}

class _PremiumStartupSplashState extends State<PremiumStartupSplash>
    with SingleTickerProviderStateMixin {
  late final AnimationController _intro = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1800),
  );
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      _intro.value = 1;
    } else if (!_intro.isAnimating && _intro.value == 0) {
      _intro.forward();
    }
  }

  @override
  void dispose() {
    _intro.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: brandNavy,
    body: SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(28),
          child: AnimatedBuilder(
            animation: _intro,
            builder: (context, child) {
              final t = Curves.easeOutCubic.transform(
                (_intro.value / .65).clamp(0, 1),
              );
              return Opacity(
                opacity: t,
                child: Transform.scale(
                  scale: .92 + .08 * t,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      RepaintBoundary(
                        child: SizedBox.square(
                          dimension: 220,
                          child: Stack(
                            alignment: Alignment.center,
                            children: [
                              CustomPaint(
                                size: const Size.square(220),
                                painter: _HaloPainter(_intro.value),
                              ),
                              const BrandEmblem(size: 148),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                      const Text(
                        'Astro Soul Path',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontFamily: 'serif',
                          color: Color(0xFFFFE8B0),
                          fontSize: 32,
                          letterSpacing: .4,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 12),
                      const Text(
                        'YOUR STARS. YOUR PATH.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Color(0xFFC3BDD9),
                          fontSize: 11,
                          letterSpacing: 2.5,
                        ),
                      ),
                      const SizedBox(height: 36),
                      Semantics(
                        liveRegion: true,
                        child: const Text(
                          'Preparing your journey',
                          style: TextStyle(
                            color: Color(0xFFBBB7CB),
                            fontSize: 12,
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
      ),
    ),
  );
}

class _HaloPainter extends CustomPainter {
  const _HaloPainter(this.phase);
  final double phase;
  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero), r = size.width * .48;
    canvas.drawCircle(
      center,
      r,
      Paint()
        ..shader = RadialGradient(
          colors: [
            brandGold.withValues(alpha: .15),
            const Color(0xFF6347A6).withValues(alpha: .12),
            Colors.transparent,
          ],
        ).createShader(Rect.fromCircle(center: center, radius: r)),
    );
    for (var i = 0; i < 12; i++) {
      final a = i * math.pi / 6 + .02 * phase;
      final point =
          center + Offset(math.cos(a), math.sin(a)) * (84 + (i % 3) * 8);
      canvas.drawCircle(
        point,
        i.isEven ? 1.4 : .8,
        Paint()
          ..color = brandGold.withValues(
            alpha: .35 + .3 * math.sin(phase * math.pi + i).abs(),
          ),
      );
    }
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: 88),
      -.8 + phase * .08,
      .5,
      false,
      Paint()
        ..color = brandGold.withValues(alpha: .35)
        ..style = PaintingStyle.stroke
        ..strokeWidth = .8,
    );
  }

  @override
  bool shouldRepaint(_HaloPainter oldDelegate) => phase != oldDelegate.phase;
}
