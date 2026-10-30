import 'dart:math' as math;
import 'dart:async';
import 'package:flutter/material.dart';
import 'brand_emblem.dart';

enum CelestialFeature { kundli, horoscope, aiAstro, predictions }

extension CelestialFeatureArtwork on CelestialFeature {
  String get assetPath =>
      'assets/stickers/home_astrology/${const ['kundli_ai', 'horoscope', 'ai_astro', 'predictions'][index]}-premium.webp';
}

class CelestialFeatureTile extends StatefulWidget {
  const CelestialFeatureTile({
    super.key,
    required this.feature,
    required this.label,
    required this.onTap,
  });
  final CelestialFeature feature;
  final String label;
  final VoidCallback onTap;
  @override
  State<CelestialFeatureTile> createState() => _CelestialFeatureTileState();
}

class _CelestialFeatureTileState extends State<CelestialFeatureTile>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  late final AnimationController _ambient = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 24),
  );
  ScrollPosition? _position;
  Timer? _tapUnlock;
  bool _foreground = true, _pressed = false, _tapLocked = false;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final position = Scrollable.maybeOf(context)?.position;
    if (position != _position) {
      _position?.removeListener(_syncMotion);
      _position = position;
      _position?.addListener(_syncMotion);
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _syncMotion();
      }
    });
  }

  void _syncMotion() {
    if (!mounted) {
      return;
    }
    final box = context.findRenderObject();
    var visible = false;
    if (box is RenderBox && box.hasSize) {
      final y = box.localToGlobal(Offset.zero).dy;
      visible =
          y + box.size.height > 0 && y < MediaQuery.sizeOf(context).height;
    }
    final run =
        visible &&
        _foreground &&
        TickerMode.valuesOf(context).enabled &&
        !MediaQuery.disableAnimationsOf(context);
    if (run && !_ambient.isAnimating) {
      _ambient.repeat();
    } else if (!run && _ambient.isAnimating) {
      _ambient.stop();
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _foreground = state == AppLifecycleState.resumed;
    _syncMotion();
  }

  void _tap() {
    if (_tapLocked) {
      return;
    }
    _tapLocked = true;
    try {
      widget.onTap();
    } finally {
      _tapUnlock = Timer(const Duration(milliseconds: 700), () {
        if (mounted) {
          _tapLocked = false;
        }
      });
    }
  }

  @override
  void dispose() {
    _tapUnlock?.cancel();
    _position?.removeListener(_syncMotion);
    WidgetsBinding.instance.removeObserver(this);
    _ambient.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduced = MediaQuery.disableAnimationsOf(context);
    return Semantics(
      button: true,
      label: widget.label,
      onTap: _tap,
      excludeSemantics: true,
      child: Tooltip(
        message: widget.label,
        child: AnimatedScale(
          scale: _pressed && !reduced ? .96 : 1,
          duration: reduced ? Duration.zero : const Duration(milliseconds: 130),
          child: Material(
            color: Theme.of(context).colorScheme.surfaceContainerLowest,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(22),
              side: const BorderSide(color: Color(0xFFE4D2AA)),
            ),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: _tap,
              onHighlightChanged: (value) {
                setState(() => _pressed = value);
              },
              borderRadius: BorderRadius.circular(22),
              splashColor: brandGold.withValues(alpha: .12),
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 122, minWidth: 48),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    vertical: 7,
                    horizontal: 2,
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      RepaintBoundary(
                        child: AspectRatio(
                          aspectRatio: 1,
                          child: CustomPaint(
                            painter: CelestialFeaturePainter(
                              widget.feature,
                              _ambient,
                              highlighted: _pressed,
                              glowOnly: true,
                            ),
                            child: Padding(
                              padding: const EdgeInsets.all(4),
                              child: Image.asset(
                                widget.feature.assetPath,
                                fit: BoxFit.contain,
                                cacheWidth: 256,
                                excludeFromSemantics: true,
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        widget.label,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: Theme.of(context).colorScheme.onSurface,
                          height: 1.3,
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
    );
  }
}

class CelestialFeaturePainter extends CustomPainter {
  CelestialFeaturePainter(
    this.feature,
    this.animation, {
    this.highlighted = false,
    this.glowOnly = false,
  }) : super(repaint: animation);
  final CelestialFeature feature;
  final Animation<double> animation;
  final bool highlighted;
  final bool glowOnly;
  @override
  void paint(Canvas canvas, Size size) {
    if (glowOnly) {
      final pulse = (math.sin(animation.value * math.pi * 2) + 1) / 2;
      canvas.drawCircle(
        size.center(Offset.zero),
        size.shortestSide * .44,
        Paint()
          ..color = brandGold.withValues(
            alpha: highlighted ? .3 : .06 + pulse * .04,
          )
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 5),
      );
      return;
    }
    canvas.save();
    canvas.scale(size.width / 100, size.height / 100);
    final phase = animation.value * math.pi * 2,
        pulse = (math.sin(phase) + 1) / 2;
    final bounds = RRect.fromRectAndRadius(
      const Rect.fromLTWH(2, 2, 96, 96),
      const Radius.circular(23),
    );
    canvas.drawRRect(
      bounds,
      Paint()
        ..shader = RadialGradient(
          center: const Alignment(-.4, -.4),
          colors: feature == CelestialFeature.aiAstro
              ? [const Color(0xFF49336F), brandNavy]
              : [const Color(0xFF282245), brandNavy],
        ).createShader(const Rect.fromLTWH(0, 0, 100, 100)),
    );
    canvas.drawRRect(
      bounds,
      Paint()
        ..color = brandGold.withValues(alpha: highlighted ? .85 : .28)
        ..style = PaintingStyle.stroke
        ..strokeWidth = highlighted ? 1.8 : .7,
    );
    final gold = Paint()
      ..shader = const LinearGradient(
        colors: [Color(0xFFFFEABD), Color(0xFFBA8A3C), Color(0xFFF4D99B)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ).createShader(const Rect.fromLTWH(10, 10, 80, 80));
    final line = Paint()
      ..color = brandGold
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.1;
    canvas.drawCircle(
      const Offset(50, 50),
      35,
      Paint()
        ..shader = RadialGradient(
          colors: [
            brandGold.withValues(alpha: .04 + .06 * pulse),
            Colors.transparent,
          ],
        ).createShader(const Rect.fromLTWH(15, 15, 70, 70)),
    );
    switch (feature) {
      case CelestialFeature.kundli:
        final p = Path()
          ..addRect(const Rect.fromLTWH(18, 18, 64, 64))
          ..moveTo(50, 18)
          ..lineTo(82, 50)
          ..lineTo(50, 82)
          ..lineTo(18, 50)
          ..close()
          ..moveTo(18, 18)
          ..lineTo(82, 82)
          ..moveTo(82, 18)
          ..lineTo(18, 82);
        canvas.drawPath(p, line..strokeWidth = 1.2);
        canvas.drawPath(
          Path()
            ..moveTo(18, 18)
            ..lineTo(82, 82),
          line..color = brandGold.withValues(alpha: .35 + .4 * pulse),
        );
        for (final p in [
          const Offset(50, 29),
          const Offset(29, 50),
          const Offset(71, 50),
          const Offset(50, 71),
        ]) {
          canvas.drawPath(BrandEmblemPainter.star(p.dx, p.dy, 3.5), gold);
        }
        canvas.drawCircle(const Offset(50, 50), 5, gold);
      case CelestialFeature.horoscope:
        canvas.save();
        canvas.translate(50, 50);
        canvas.rotate(.045 * math.sin(phase));
        canvas.translate(-50, -50);
        canvas.drawCircle(const Offset(50, 50), 36, line);
        canvas.drawCircle(const Offset(50, 50), 24, line..strokeWidth = .6);
        for (var i = 0; i < 12; i++) {
          final a = i * math.pi / 6 - math.pi / 2,
              p = const Offset(50, 50) + Offset(math.cos(a), math.sin(a)) * 30;
          _zodiac(canvas, i, p, .7 + .3 * math.sin(phase + i).abs());
        }
        canvas.drawPath(BrandEmblemPainter.star(50, 50, 15), gold);
        canvas.restore();
      case CelestialFeature.aiAstro:
        canvas.drawCircle(
          const Offset(50, 50),
          21,
          Paint()
            ..shader = RadialGradient(
              colors: [
                const Color(0xFFFFE9B5),
                const Color(0xFF8D6ACA).withValues(alpha: .75),
                const Color(0xFF493569).withValues(alpha: .05),
              ],
            ).createShader(const Rect.fromLTWH(25, 25, 50, 50)),
        );
        for (var i = 0; i < 7; i++) {
          final a = i * math.pi * 2 / 7 + phase,
              p =
                  const Offset(50, 50) +
                  Offset(math.cos(a) * 32, math.sin(a) * 27);
          canvas.drawLine(
            const Offset(50, 50),
            p,
            line
              ..color = brandGold.withValues(alpha: .3)
              ..strokeWidth = .7,
          );
          canvas.drawCircle(p, 2.2, gold);
        }
        canvas.drawOval(
          const Rect.fromLTWH(19, 32, 62, 36),
          line..color = brandGold.withValues(alpha: .7),
        );
      case CelestialFeature.predictions:
        final float = math.sin(phase) * 1.7;
        canvas.save();
        canvas.translate(0, float);
        canvas.drawCircle(
          const Offset(50, 43),
          25,
          Paint()
            ..shader = const RadialGradient(
              center: Alignment(-.35, -.45),
              colors: [Color(0xFFE1D0FF), Color(0xFF766198), Color(0xFF1A183A)],
            ).createShader(const Rect.fromLTWH(25, 18, 50, 50)),
        );
        canvas.drawCircle(
          const Offset(50, 43),
          25,
          line..color = brandGold.withValues(alpha: .8),
        );
        canvas.drawPath(
          BrandEmblemPainter.star(52 + 2 * math.sin(phase), 42, 10),
          gold,
        );
        canvas.drawArc(
          const Rect.fromLTWH(32, 25, 36, 36),
          3.6,
          .8,
          false,
          line..color = const Color(0xFFEEE1FF),
        );
        canvas.restore();
        final base = Path()
          ..moveTo(35, 71)
          ..quadraticBezierTo(50, 78, 65, 71)
          ..lineTo(70, 82)
          ..quadraticBezierTo(50, 89, 30, 82)
          ..close();
        canvas.drawPath(base, gold);
    }
    for (final p in [const Offset(15, 17), const Offset(83, 81)]) {
      canvas.drawPath(BrandEmblemPainter.star(p.dx, p.dy, 2), gold);
    }
    canvas.restore();
  }

  // Stroke geometry, never emoji-font glyphs: identical on Android and iOS.
  void _zodiac(Canvas canvas, int index, Offset center, double alpha) {
    canvas.save();
    canvas.translate(center.dx, center.dy);
    canvas.scale(.75);
    final p = Path();
    switch (index) {
      case 0:
        p.moveTo(0, 4);
        p.lineTo(0, -1);
        p.cubicTo(0, -5, -5, -5, -4, -1);
        p.moveTo(0, -1);
        p.cubicTo(0, -5, 5, -5, 4, -1);
      case 1:
        p.addOval(const Rect.fromLTWH(-2.7, -1.5, 5.4, 5.4));
        p.moveTo(-4, -4);
        p.cubicTo(-4, 0, 4, 0, 4, -4);
      case 2:
        p.moveTo(-4, -4);
        p.quadraticBezierTo(0, -2.5, 4, -4);
        p.moveTo(-4, 4);
        p.quadraticBezierTo(0, 2.5, 4, 4);
        p.moveTo(-2, -3.5);
        p.lineTo(-2, 3.5);
        p.moveTo(2, -3.5);
        p.lineTo(2, 3.5);
      case 3:
        p.addOval(const Rect.fromLTWH(-4, -3, 3, 3));
        p.addOval(const Rect.fromLTWH(1, 0, 3, 3));
        p.moveTo(-2, -3);
        p.quadraticBezierTo(1, -5, 4, -2);
        p.moveTo(2, 3);
        p.quadraticBezierTo(-1, 5, -4, 2);
      case 4:
        p.addOval(const Rect.fromLTWH(-4, 0, 3, 3));
        p.moveTo(-2, 0);
        p.cubicTo(-5, -6, 4, -6, 3, -1);
        p.cubicTo(1, 2, 1, 5, 4, 3);
      case 5:
        p.moveTo(-4, 3);
        p.lineTo(-4, -3);
        p.quadraticBezierTo(-1, -5, -1, 3);
        p.moveTo(-1, -2);
        p.quadraticBezierTo(2, -5, 2, 2);
        p.cubicTo(6, 5, 6, -3, 3, -1);
        p.lineTo(1, 4);
      case 6:
        p.moveTo(-4, 3);
        p.lineTo(4, 3);
        p.moveTo(-4, 0);
        p.lineTo(-2, 0);
        p.cubicTo(-5, -5, 5, -5, 2, 0);
        p.lineTo(4, 0);
      case 7:
        p.moveTo(-4, 3);
        p.lineTo(-4, -3);
        p.quadraticBezierTo(-1, -5, -1, 3);
        p.moveTo(-1, -2);
        p.quadraticBezierTo(2, -5, 2, 2);
        p.quadraticBezierTo(2, 4, 5, 2);
        p.moveTo(3, 1);
        p.lineTo(5, 2);
        p.lineTo(4, 4);
      case 8:
        p.moveTo(-4, 4);
        p.lineTo(4, -4);
        p.moveTo(-1, -4);
        p.lineTo(4, -4);
        p.lineTo(4, 1);
        p.moveTo(-3, -1);
        p.lineTo(1, 3);
      case 9:
        p.moveTo(-4, -3);
        p.lineTo(-2, 3);
        p.lineTo(0, -2);
        p.quadraticBezierTo(3, -5, 2, 1);
        p.cubicTo(-1, 6, 7, 5, 4, 1);
        p.quadraticBezierTo(3, 0, 1, 2);
      case 10:
        for (final y in [-2.0, 2.0]) {
          p.moveTo(-5, y);
          p.lineTo(-3, y - 2);
          p.lineTo(-1, y);
          p.lineTo(1, y - 2);
          p.lineTo(3, y);
          p.lineTo(5, y - 2);
        }
      case 11:
        p.moveTo(-3, -4);
        p.quadraticBezierTo(1, 0, -3, 4);
        p.moveTo(3, -4);
        p.quadraticBezierTo(-1, 0, 3, 4);
        p.moveTo(-3, 0);
        p.lineTo(3, 0);
    }
    canvas.drawPath(
      p,
      Paint()
        ..color = brandGold.withValues(alpha: alpha)
        ..style = PaintingStyle.stroke
        ..strokeWidth = .85
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(CelestialFeaturePainter oldDelegate) =>
      oldDelegate.feature != feature ||
      oldDelegate.highlighted != highlighted ||
      oldDelegate.animation != animation;
}
