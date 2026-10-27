import 'dart:math' as math;
import 'package:flutter/material.dart';

/// Decorative placeholders only: never a representation of a person's likeness.
class AstrologerDefaultAvatar extends StatelessWidget {
  const AstrologerDefaultAvatar({super.key, required this.astrologerId});
  final String astrologerId;

  static int designFor(String id) {
    var hash = 0;
    for (final unit in id.codeUnits) {
      hash = (hash * 31 + unit) & 0x7fffffff;
    }
    return hash % 5;
  }

  @override
  Widget build(BuildContext context) => Semantics(
    label: 'Illustrated default astrologer avatar',
    image: true,
    child: CustomPaint(
      painter: _CelestialPortrait(designFor(astrologerId)),
      child: const SizedBox.expand(),
    ),
  );
}

class _CelestialPortrait extends CustomPainter {
  const _CelestialPortrait(this.design);
  final int design;
  static const backgrounds = [
    Color(0xFF172842),
    Color(0xFF38483E),
    Color(0xFF51405F),
    Color(0xFF754B42),
    Color(0xFF325A68),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 100, size.height / 100);
    final paint = Paint()..isAntiAlias = true;
    canvas.drawCircle(
      const Offset(50, 50),
      50,
      paint..color = backgrounds[design],
    );
    canvas.drawCircle(
      const Offset(50, 50),
      46,
      paint
        ..color = const Color(0xFFD8BB80)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1,
    );
    paint.style = PaintingStyle.fill;
    for (var i = 0; i < 7; i++) {
      final angle = (i * 45 + design * 12) * math.pi / 180;
      canvas.drawCircle(
        Offset(50 + 37 * math.cos(angle), 50 + 37 * math.sin(angle)),
        i == design ? 1.8 : .8,
        paint..color = const Color(0xFFEAD9AC),
      );
    }
    final shoulders = Path()
      ..moveTo(20, 100)
      ..quadraticBezierTo(22, 70, 50, 70)
      ..quadraticBezierTo(78, 70, 80, 100)
      ..close();
    canvas.drawPath(shoulders, paint..color = const Color(0xFFEADCC6));
    canvas.drawOval(
      Rect.fromCenter(center: const Offset(50, 49), width: 34, height: 43),
      paint
        ..color = Color.lerp(
          const Color(0xFFDCB994),
          const Color(0xFFAC7C60),
          design / 5,
        )!,
    );
    final hair = Path()
      ..moveTo(32, 49)
      ..cubicTo(24, 17, 74, 14, 69, 50)
      ..quadraticBezierTo(64, 33, 49, 33)
      ..quadraticBezierTo(39, 42, 32, 49);
    canvas.drawPath(hair, paint..color = const Color(0xFF292835));
    paint
      ..color = const Color(0xFF55413A)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(const Offset(41, 50), const Offset(44, 50), paint);
    canvas.drawLine(const Offset(56, 50), const Offset(59, 50), paint);
    canvas.drawArc(const Rect.fromLTWH(44, 54, 12, 8), .2, 2.7, false, paint);
    paint.style = PaintingStyle.fill;
    canvas.drawCircle(
      Offset(78, 23 + design.toDouble()),
      6,
      paint..color = const Color(0xFFE4C37D),
    );
    canvas.drawCircle(
      Offset(81, 21 + design.toDouble()),
      5,
      paint..color = backgrounds[design],
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(_CelestialPortrait oldDelegate) =>
      oldDelegate.design != design;
}
