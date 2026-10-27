import 'dart:math' as math;
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'celestial_zodiac_paths.dart';

abstract final class CelestialHomeStyle {
  static const navy = Color(0xFF151730);
  static const purple = Color(0xFF40245F);
  static const gold = Color(0xFFE5CC97);
  static const ivory = Color(0xFFFFFBF3);
  static const ink = Color(0xFF30233F);
  static BoxDecoration surface({double radius = 24}) => BoxDecoration(
    borderRadius: BorderRadius.circular(radius),
    gradient: const LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [Color(0xF5FFFCF7), Color(0xEDEEE6F5)],
    ),
    border: Border.all(color: const Color(0xB3DCC598)),
    boxShadow: const [
      BoxShadow(color: Color(0x12382050), blurRadius: 16, offset: Offset(0, 5)),
    ],
  );
}

/// Paint-only animation; labels and layout do not rebuild on each tick.
/// Two Home instances at most: hero and Horoscope shortcut, not every card.
class CelestialZodiacWheel extends StatefulWidget {
  const CelestialZodiacWheel({super.key, this.size = 120});
  final double size;
  @override
  State<CelestialZodiacWheel> createState() => _CelestialZodiacWheelState();
}

class _CelestialZodiacWheelState extends State<CelestialZodiacWheel>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  late final AnimationController motion = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 40),
  );
  ScrollPosition? position;
  bool foreground = true, queued = false;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final next = Scrollable.maybeOf(context)?.position;
    if (next != position) {
      position?.removeListener(schedule);
      position = next;
      position?.addListener(schedule);
    }
    schedule();
  }

  void schedule() {
    if (queued || !mounted) return;
    queued = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      queued = false;
      sync();
    });
  }

  void sync() {
    if (!mounted) return;
    final box = context.findRenderObject();
    final visible =
        box is RenderBox &&
        box.hasSize &&
        (box.localToGlobal(Offset.zero) & box.size).overlaps(
          Offset.zero & MediaQuery.sizeOf(context),
        );
    final run =
        visible &&
        foreground &&
        TickerMode.valuesOf(context).enabled &&
        !MediaQuery.disableAnimationsOf(context);
    if (run && !motion.isAnimating) motion.repeat();
    if (!run && motion.isAnimating) motion.stop();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    foreground = state == AppLifecycleState.resumed;
    sync();
  }

  @override
  void dispose() {
    position?.removeListener(schedule);
    WidgetsBinding.instance.removeObserver(this);
    motion.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: RepaintBoundary(
      child: SizedBox.square(
        dimension: widget.size,
        child: CustomPaint(
          key: const ValueKey('celestial-zodiac-ring'),
          painter: CelestialZodiacPainter(motion),
          child: Center(
            child: Icon(
              Icons.nightlight_round,
              size: widget.size * .25,
              color: CelestialHomeStyle.gold,
            ),
          ),
        ),
      ),
    ),
  );
}

class CelestialZodiacPainter extends CustomPainter {
  CelestialZodiacPainter(this.motion) : super(repaint: motion);
  final Animation<double> motion;
  @override
  void paint(Canvas canvas, Size size) {
    final radius = math.min(size.width, size.height) / 2;
    canvas.translate(size.width / 2, size.height / 2);
    final pen = Paint()
      ..style = PaintingStyle.stroke
      ..color = CelestialHomeStyle.gold
      ..strokeWidth = math.max(.7, radius / 85);
    canvas.drawCircle(
      Offset.zero,
      radius * .91,
      pen..color = CelestialHomeStyle.gold.withValues(alpha: .7),
    );
    canvas.drawCircle(
      Offset.zero,
      radius * .97,
      pen..color = CelestialHomeStyle.gold.withValues(alpha: .24),
    );
    canvas.save();
    canvas.rotate(motion.value * math.pi * 2);
    canvas.drawCircle(
      Offset.zero,
      radius * .59,
      pen..color = CelestialHomeStyle.gold.withValues(alpha: .6),
    );
    for (var i = 0; i < 12; i++) {
      final angle = i * math.pi / 6;
      canvas.drawLine(
        Offset(math.cos(angle) * radius * .61, math.sin(angle) * radius * .61),
        Offset(math.cos(angle) * radius * .89, math.sin(angle) * radius * .89),
        pen..color = CelestialHomeStyle.gold.withValues(alpha: .35),
      );
      final a = angle + math.pi / 12;
      canvas.save();
      canvas.translate(math.cos(a) * radius * .75, math.sin(a) * radius * .75);
      canvas.scale(radius * .026);
      canvas.drawPath(
        celestialZodiacPaths[i],
        pen
          ..color = CelestialHomeStyle.gold
          ..strokeWidth = .65,
      );
      canvas.restore();
    }
    canvas.restore();
    // A single independent orbit spark; no particle controllers or blur layers.
    final a = -motion.value * math.pi * 4;
    canvas.drawCircle(
      Offset(math.cos(a) * radius * .96, math.sin(a) * radius * .96),
      math.max(1.2, radius * .022),
      Paint()..color = CelestialHomeStyle.ivory,
    );
  }

  @override
  bool shouldRepaint(CelestialZodiacPainter oldDelegate) =>
      motion != oldDelegate.motion;
}

class CelestialHomeHero extends StatelessWidget {
  const CelestialHomeHero({super.key, required this.onExplore});
  final VoidCallback onExplore;
  @override
  Widget build(BuildContext context) => Container(
    key: const ValueKey('celestial-home-hero'),
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(28),
      gradient: const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [CelestialHomeStyle.navy, CelestialHomeStyle.purple],
      ),
      border: Border.all(color: CelestialHomeStyle.gold.withValues(alpha: .65)),
      boxShadow: const [
        BoxShadow(
          color: Color(0x24382050),
          blurRadius: 18,
          offset: Offset(0, 7),
        ),
      ],
    ),
    padding: const EdgeInsets.all(22),
    child: LayoutBuilder(
      builder: (context, constraints) {
        final wide =
            constraints.maxWidth >= 270 &&
            MediaQuery.textScalerOf(context).scale(16) < 24;
        final content = Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: BackdropFilter(
                filter: ui.ImageFilter.blur(sigmaX: 4, sigmaY: 4),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 7,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0x18FFFFFF),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0x40E5CC97)),
                  ),
                  child: const Text(
                    'VEDIC ASTROLOGY',
                    style: TextStyle(
                      color: CelestialHomeStyle.gold,
                      fontSize: 10,
                      letterSpacing: 2,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'Find Clarity',
              style: TextStyle(
                color: CelestialHomeStyle.ivory,
                fontSize: 29,
                fontWeight: FontWeight.w700,
                height: 1.15,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Live a Better Tomorrow',
              style: TextStyle(
                color: CelestialHomeStyle.gold,
                fontSize: 17,
                height: 1.3,
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'Explore astrology, trusted guidance and personalized insights in one place.',
              style: TextStyle(
                color: Color(0xFFE5DDEB),
                fontSize: 13,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: onExplore,
              style: FilledButton.styleFrom(
                backgroundColor: CelestialHomeStyle.gold,
                foregroundColor: CelestialHomeStyle.navy,
                minimumSize: const Size(48, 48),
              ),
              icon: const Icon(Icons.arrow_forward_rounded, size: 18),
              label: const Text('Explore Your Path'),
            ),
          ],
        );
        if (wide) {
          return Row(
            children: [
              Expanded(child: content),
              const SizedBox(width: 18),
              CelestialZodiacWheel(
                size: constraints.maxWidth < 420 ? 112 : 166,
              ),
            ],
          );
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Align(
              alignment: Alignment.centerRight,
              child: CelestialZodiacWheel(size: 112),
            ),
            const SizedBox(height: 8),
            content,
          ],
        );
      },
    ),
  );
}
