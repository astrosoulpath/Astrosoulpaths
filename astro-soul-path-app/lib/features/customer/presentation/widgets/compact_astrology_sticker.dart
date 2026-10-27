import 'dart:math' as math;
import 'dart:async';
import 'package:flutter/material.dart';
import 'celestial_glass_home.dart';
import 'celestial_zodiac_paths.dart';

enum HomeSticker {
  kundli,
  horoscope,
  ai,
  talk,
  match,
  career,
  love,
  marriage,
  prediction,
}

/// Transparent native artwork: no bitmap plate, card or square behind a feature.
class CompactAstrologySticker extends StatefulWidget {
  const CompactAstrologySticker({
    super.key,
    required this.kind,
    required this.label,
    required this.onTap,
  });
  final HomeSticker kind;
  final String label;
  final VoidCallback onTap;
  @override
  State<CompactAstrologySticker> createState() =>
      _CompactAstrologyStickerState();
}

/// One animation clock shared by the nine Home shortcuts.
class HomeStickerMotion extends StatefulWidget {
  const HomeStickerMotion({
    super.key,
    required this.child,
    this.glassStyle = false,
  });
  final Widget child;
  final bool glassStyle;
  @override
  State<HomeStickerMotion> createState() => _HomeStickerMotionState();
}

class _HomeStickerMotionState extends State<HomeStickerMotion>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  late final AnimationController motion = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 80),
  );
  bool foreground = true, scrolling = false;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  void sync() {
    if (!mounted) return;
    final run =
        foreground &&
        !scrolling &&
        !MediaQuery.disableAnimationsOf(context) &&
        TickerMode.valuesOf(context).enabled;
    if (run && !motion.isAnimating) motion.repeat();
    if (!run && motion.isAnimating) motion.stop();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    sync();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    foreground = state == AppLifecycleState.resumed;
    sync();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    motion.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => _StickerClock(
    motion: motion,
    glassStyle: widget.glassStyle,
    child: NotificationListener<ScrollNotification>(
      onNotification: (notification) {
        if (notification is ScrollStartNotification) scrolling = true;
        if (notification is ScrollEndNotification) scrolling = false;
        sync();
        return false;
      },
      child: widget.child,
    ),
  );
}

class _StickerClock extends InheritedWidget {
  const _StickerClock({
    required this.motion,
    required super.child,
    required this.glassStyle,
  });
  final Animation<double> motion;
  final bool glassStyle;
  @override
  bool updateShouldNotify(_StickerClock oldWidget) =>
      motion != oldWidget.motion || glassStyle != oldWidget.glassStyle;
}

class _CompactAstrologyStickerState extends State<CompactAstrologySticker> {
  bool pressed = false;
  bool _tapLocked = false;
  Timer? _tapUnlock;
  void _tap() {
    if (_tapLocked) return;
    _tapLocked = true;
    try {
      widget.onTap();
    } finally {
      _tapUnlock = Timer(const Duration(milliseconds: 700), () {
        _tapLocked = false;
      });
    }
  }

  @override
  void dispose() {
    _tapUnlock?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: widget.label,
    onTap: _tap,
    excludeSemantics: true,
    child: Tooltip(
      message: widget.label,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: _tap,
          onHighlightChanged: (v) => setState(() => pressed = v),
          borderRadius: BorderRadius.circular(40),
          splashColor: const Color(0x227E4C98),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 8),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                AnimatedScale(
                  scale: pressed && !MediaQuery.disableAnimationsOf(context)
                      ? .96
                      : 1,
                  duration: const Duration(milliseconds: 140),
                  child: RepaintBoundary(
                    child: SizedBox(
                      width: 48,
                      child: AspectRatio(
                        aspectRatio: 1,
                        child: DecoratedBox(
                          decoration:
                              context
                                      .dependOnInheritedWidgetOfExactType<
                                        _StickerClock
                                      >()
                                      ?.glassStyle ==
                                  true
                              ? BoxDecoration(
                                  shape: BoxShape.circle,
                                  gradient: const LinearGradient(
                                    colors: [
                                      Color(0xFFF1E8FB),
                                      Color(0xFFFFFBF3),
                                    ],
                                  ),
                                  border: Border.all(
                                    color: CelestialHomeStyle.gold,
                                  ),
                                  boxShadow: const [
                                    BoxShadow(
                                      color: Color(0x145A3179),
                                      blurRadius: 8,
                                    ),
                                  ],
                                )
                              : const BoxDecoration(),
                          child:
                              widget.kind == HomeSticker.horoscope &&
                                  context
                                          .dependOnInheritedWidgetOfExactType<
                                            _StickerClock
                                          >()
                                          ?.glassStyle ==
                                      true
                              ? const CelestialZodiacWheel(size: 48)
                              : CustomPaint(
                                  painter: AstrologyStickerPainter(
                                    widget.kind,
                                    MediaQuery.disableAnimationsOf(context)
                                        ? const AlwaysStoppedAnimation(0)
                                        : context
                                                  .dependOnInheritedWidgetOfExactType<
                                                    _StickerClock
                                                  >()
                                                  ?.motion ??
                                              const AlwaysStoppedAnimation(0),
                                  ),
                                ),
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 7),
                Text(
                  widget.label,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Theme.of(context).brightness == Brightness.dark
                        ? const Color(0xFFF5E9D3)
                        : const Color(0xFF35213F),
                    fontSize: 13,
                    height: 1.25,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

class AstrologyStickerPainter extends CustomPainter {
  // Cached vector zodiac signs, independent of emoji fonts and platform colors.
  static final List<Path> _zodiacPaths = celestialZodiacPaths;
  AstrologyStickerPainter(this.kind, this.motion) : super(repaint: motion);
  final HomeSticker kind;
  final Animation<double> motion;
  static const gold = Color(0xFFD7B374),
      plum = Color(0xFF50305F),
      ivory = Color(0xFFFFF1D4);
  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 100, size.height / 100);
    final phase = motion.value * math.pi * 2;
    final stroke = Paint()
      ..color = gold
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..strokeCap = StrokeCap.round;
    final fill = Paint()..color = plum;
    void line(double x, double y, double a, double b) =>
        canvas.drawLine(Offset(x, y), Offset(a, b), stroke);
    void star(double x, double y, double r) {
      final p = Path()
        ..moveTo(x, y - r)
        ..quadraticBezierTo(x + 1, y - 1, x + r, y)
        ..quadraticBezierTo(x + 1, y + 1, x, y + r)
        ..quadraticBezierTo(x - 1, y + 1, x - r, y)
        ..quadraticBezierTo(x - 1, y - 1, x, y - r);
      canvas.drawPath(p, Paint()..color = gold);
    }

    void heart(double x, double y, double r) {
      r *= 1 + .008 * math.sin(phase);
      final p = Path()
        ..moveTo(x, y + r)
        ..cubicTo(x - r * 2, y, x - r, y - r * 1.5, x, y - r * .35)
        ..cubicTo(x + r, y - r * 1.5, x + r * 2, y, x, y + r)
        ..close();
      if (kind == HomeSticker.love) canvas.drawPath(p, fill);
      canvas.drawPath(p, stroke);
    }

    // One restrained accent; no plate, halo or rectangular background.
    star(84, 22, 2 + .3 * math.sin(phase));
    switch (kind) {
      case HomeSticker.kundli:
        final p = Path()
          ..moveTo(50, 16)
          ..lineTo(83, 50)
          ..lineTo(50, 84)
          ..lineTo(17, 50)
          ..close();
        canvas.drawPath(p, fill);
        canvas.drawPath(p, stroke);
        canvas.drawRect(const Rect.fromLTWH(28, 28, 44, 44), stroke);
        line(28, 28, 72, 72);
        line(72, 28, 28, 72);
        line(50, 16, 50, 84);
        line(17, 50, 83, 50);
        star(50, 50, 5);
        star(50 + 14 * math.sin(phase), 28, 2);
      case HomeSticker.horoscope:
        canvas.save();
        canvas.translate(50, 50);
        canvas.rotate(phase);
        canvas.translate(-50, -50);
        canvas.drawCircle(const Offset(50, 50), 31, fill);
        canvas.drawCircle(const Offset(50, 50), 33, stroke);
        canvas.drawCircle(const Offset(50, 50), 24, stroke);
        for (var i = 0; i < 12; i++) {
          final a = i * math.pi / 6;
          line(
            50 + 24 * math.cos(a),
            50 + 24 * math.sin(a),
            50 + 33 * math.cos(a),
            50 + 33 * math.sin(a),
          );
          canvas.save();
          canvas.translate(
            50 + 28 * math.cos(a + .26),
            50 + 28 * math.sin(a + .26),
          );
          canvas.drawPath(
            _zodiacPaths[i],
            Paint()
              ..color = ivory
              ..style = PaintingStyle.stroke
              ..strokeWidth = .75
              ..strokeCap = StrokeCap.round
              ..strokeJoin = StrokeJoin.round,
          );
          canvas.restore();
        }
        canvas.restore();
        final moon = Path.combine(
          PathOperation.difference,
          Path()..addOval(const Rect.fromLTWH(37, 36, 26, 28)),
          Path()..addOval(const Rect.fromLTWH(45, 32, 26, 28)),
        );
        canvas.drawPath(moon, Paint()..color = ivory);
      case HomeSticker.ai:
        canvas.drawCircle(
          const Offset(50, 50),
          23 + .5 * math.sin(phase),
          fill,
        );
        canvas.drawOval(const Rect.fromLTWH(12, 36, 76, 28), stroke);
        star(50, 50, 5);
        star(50 + 38 * math.cos(phase), 50 + 14 * math.sin(phase), 3);
      case HomeSticker.talk:
        final p = Path()
          ..addRRect(
            RRect.fromRectAndRadius(
              const Rect.fromLTWH(20, 25, 60, 43),
              const Radius.circular(18),
            ),
          )
          ..moveTo(34, 68)
          ..lineTo(29, 79)
          ..lineTo(48, 68);
        canvas.drawPath(p, stroke);
        star(50, 46, 9 + .5 * math.sin(phase));
        line(33, 59, 67, 59);
      case HomeSticker.match:
        heart(36, 49, 17);
        heart(64, 49, 17);
        star(50, 30, 4);
        canvas.drawArc(
          const Rect.fromLTWH(21, 20, 58, 62),
          .2,
          1.8,
          false,
          stroke,
        );
      case HomeSticker.love:
        heart(50, 49, 25);
        star(50 + 32 * math.cos(phase), 49 + 27 * math.sin(phase), 3);
      case HomeSticker.career:
        final p = Path()
          ..moveTo(23, 76)
          ..lineTo(23, 55)
          ..lineTo(37, 55)
          ..lineTo(37, 42)
          ..lineTo(52, 42)
          ..lineTo(52, 29)
          ..lineTo(67, 29)
          ..lineTo(67, 76)
          ..close();
        canvas.drawPath(p, fill);
        canvas.drawPath(p, stroke);
        star(72, 23 - 2 * math.sin(phase), 7);
        line(17, 81, 80, 81);
      case HomeSticker.marriage:
        canvas.drawCircle(const Offset(38, 55), 18, Paint()..color = plum);
        canvas.drawCircle(const Offset(38, 55), 22, stroke);
        canvas.drawCircle(const Offset(62, 55), 22, stroke);
        canvas.drawCircle(const Offset(62, 55), 18, stroke);
        final gem = Path()
          ..moveTo(62, 15)
          ..lineTo(71, 25)
          ..lineTo(62, 35)
          ..lineTo(53, 25)
          ..close();
        canvas.drawPath(gem, fill);
        canvas.drawPath(gem, stroke);
        star(62, 25, 3 + .5 * math.sin(phase));
      case HomeSticker.prediction:
        canvas.drawCircle(const Offset(50, 43), 27, fill);
        canvas.drawCircle(const Offset(50, 43), 27, stroke);
        canvas.drawArc(
          const Rect.fromLTWH(29, 22, 42, 42),
          3.3,
          1.2,
          false,
          Paint()
            ..color = ivory
            ..style = PaintingStyle.stroke
            ..strokeWidth = 2,
        );
        final base = Path()
          ..moveTo(35, 70)
          ..lineTo(28, 82)
          ..lineTo(72, 82)
          ..lineTo(65, 70)
          ..close();
        canvas.drawPath(base, fill);
        canvas.drawPath(base, stroke);
        star(52, 42, 8 + .7 * math.sin(phase));
        star(65, 33, 2);
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant AstrologyStickerPainter oldDelegate) =>
      kind != oldDelegate.kind || motion != oldDelegate.motion;
}

class CompactHomeSectionHeading extends StatelessWidget {
  const CompactHomeSectionHeading({
    super.key,
    required this.title,
    required this.onTap,
  });
  final String title;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(18, 12, 12, 4),
    child: Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: Theme.of(context).colorScheme.onSurface,
            ),
          ),
        ),
        TextButton(onPressed: onTap, child: const Text('View all')),
      ],
    ),
  );
}
