import 'dart:math' as math;
import 'package:flutter/material.dart';

/// Transparent viewport loader. Keep [child] mounted during requests; no delay
/// is added to the caller's loading state. The exit fade never blocks input.
class GoldenSparkleLoading extends StatelessWidget {
  const GoldenSparkleLoading({
    super.key,
    required this.loading,
    required this.child,
  });
  final bool loading;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final reduced =
        MediaQuery.disableAnimationsOf(context) ||
        MediaQuery.accessibleNavigationOf(context);
    return Stack(
      fit: StackFit.expand,
      children: [
        ExcludeFocus(
          excluding: loading,
          child: AbsorbPointer(absorbing: loading, child: child),
        ),
        if (loading)
          const Positioned.fill(
            child: ModalBarrier(
              dismissible: false,
              color: Colors.transparent,
              barrierSemanticsDismissible: false,
            ),
          ),
        Positioned.fill(
          child: IgnorePointer(
            child: AnimatedSwitcher(
              duration: reduced
                  ? Duration.zero
                  : const Duration(milliseconds: 180),
              child: loading
                  ? const Center(
                      key: ValueKey('golden-loading'),
                      child: GoldenSparkle(),
                    )
                  : const SizedBox.expand(key: ValueKey('golden-ready')),
            ),
          ),
        ),
      ],
    );
  }
}

/// Small native-painted gold sparkle; no image, background, text or particles
/// outside its 64dp bounds. One controller and repaint boundary per loader.
class GoldenSparkle extends StatefulWidget {
  const GoldenSparkle({super.key});
  @override
  State<GoldenSparkle> createState() => _GoldenSparkleState();
}

class _GoldenSparkleState extends State<GoldenSparkle>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  late final AnimationController _motion = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2400),
  );
  bool _foreground = true;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  void _sync() {
    final animate =
        _foreground &&
        TickerMode.valuesOf(context).enabled &&
        !MediaQuery.disableAnimationsOf(context) &&
        !MediaQuery.accessibleNavigationOf(context);
    if (animate && !_motion.isAnimating) _motion.repeat();
    if (!animate) _motion.stop();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _sync();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _foreground = state == AppLifecycleState.resumed;
    _sync();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _motion.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Semantics(
    label: 'Loading',
    liveRegion: true,
    child: RepaintBoundary(
      child: SizedBox(
        width: 64,
        height: 64,
        child: CustomPaint(painter: _SparklePainter(_motion)),
      ),
    ),
  );
}

class _SparklePainter extends CustomPainter {
  _SparklePainter(this.motion) : super(repaint: motion);
  final Animation<double> motion;
  void _star(Canvas canvas, Offset center, double radius, Color color) {
    final path = Path();
    for (var i = 0; i < 8; i++) {
      final angle = i * math.pi / 4 - math.pi / 2;
      final r = i.isEven ? radius : radius * .23;
      final p = center + Offset(math.cos(angle), math.sin(angle)) * r;
      if (i == 0) {
        path.moveTo(p.dx, p.dy);
      } else {
        path.lineTo(p.dx, p.dy);
      }
    }
    path.close();
    canvas.drawPath(
      path,
      Paint()
        ..color = const Color(0xFFFFC33D).withValues(alpha: .65)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 5),
    );
    canvas.drawPath(path, Paint()..color = color);
  }

  @override
  void paint(Canvas canvas, Size size) {
    final phase = motion.value * math.pi * 2;
    canvas.save();
    canvas.translate(size.width / 2, size.height / 2);
    canvas.rotate(math.sin(phase) * .10);
    final pulse = 1 + math.sin(phase) * .07;
    canvas.scale(pulse);
    _star(canvas, const Offset(-3, 3), 18, const Color(0xFFFFD15C));
    _star(canvas, const Offset(17, -17), 8, const Color(0xFFFFE7A3));
    _star(
      canvas,
      Offset(-19, -12 + math.sin(phase) * 2),
      5,
      const Color(0xFFFFC247),
    );
    _star(
      canvas,
      Offset(18, 20 + math.cos(phase) * 2),
      3,
      const Color(0xFFFFE7A3),
    );
    _star(canvas, const Offset(-3, 3), 10, const Color(0xFFFFF6D5));
    canvas.restore();
  }

  @override
  bool shouldRepaint(_SparklePainter oldDelegate) =>
      oldDelegate.motion != motion;
}
