import 'dart:math' as math;
import 'package:flutter/material.dart';

const brandNavy = Color(0xFF0B1232);
const brandGold = Color(0xFFE8C578);

/// Vector reconstruction of the existing compass/crescent/soul-path emblem.
/// Geometry is shared by native icon exports and the animated Flutter opening.
class BrandEmblem extends StatelessWidget {
  const BrandEmblem({super.key, this.size = 144});
  final double size;
  @override
  Widget build(BuildContext context) => Semantics(
    label: 'Astro Soul Path',
    image: true,
    child: CustomPaint(
      size: Size.square(size),
      painter: const BrandEmblemPainter(),
    ),
  );
}

class BrandEmblemPainter extends CustomPainter {
  const BrandEmblemPainter({this.monochrome = false});
  final bool monochrome;
  static Path star(double x, double y, double radius, {double vertical = 1}) {
    final p = Path();
    for (var i = 0; i < 8; i++) {
      final angle = -math.pi / 2 + i * math.pi / 4;
      final r = i.isEven ? radius : radius * .23;
      final dx = x + math.cos(angle) * r,
          dy = y + math.sin(angle) * r * vertical;
      if (i == 0) {
        p.moveTo(dx, dy);
      } else {
        p.lineTo(dx, dy);
      }
    }
    return p..close();
  }

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 1000, size.height / 1000);
    if (!monochrome) {
      canvas.drawCircle(
        const Offset(500, 500),
        492,
        Paint()..color = brandNavy,
      );
    }
    final gold = Paint()..color = monochrome ? Colors.white : brandGold;
    if (!monochrome) {
      gold.shader = const LinearGradient(
        colors: [Color(0xFFFFE9AF), Color(0xFFD5A84F), Color(0xFFFFE6A4)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ).createShader(const Rect.fromLTWH(0, 0, 1000, 1000));
    }
    final ring = Paint()
      ..color = gold.color
      ..shader = gold.shader
      ..style = PaintingStyle.stroke
      ..strokeWidth = 9;
    canvas.drawCircle(const Offset(500, 500), 477, ring);
    canvas.drawCircle(const Offset(500, 500), 450, ring..strokeWidth = 3);
    canvas.drawPath(star(500, 355, 167, vertical: 1.4), gold);
    // Diagonal rays preserve the original compass-star silhouette.
    for (final a in [
      math.pi / 4,
      3 * math.pi / 4,
      5 * math.pi / 4,
      7 * math.pi / 4,
    ]) {
      final p = Path()
        ..moveTo(500 + math.cos(a - .04) * 45, 355 + math.sin(a - .04) * 45)
        ..lineTo(500 + math.cos(a) * 142, 355 + math.sin(a) * 142)
        ..lineTo(500 + math.cos(a + .04) * 45, 355 + math.sin(a + .04) * 45)
        ..close();
      canvas.drawPath(p, gold);
    }
    final moon = Path.combine(
      PathOperation.difference,
      Path()..addOval(const Rect.fromLTWH(142, 252, 155, 178)),
      Path()..addOval(const Rect.fromLTWH(184, 222, 155, 180)),
    );
    canvas.drawPath(moon, gold);
    final sweep = Path()
      ..moveTo(665, 438)
      ..cubicTo(711, 556, 236, 598, 309, 740)
      ..cubicTo(344, 804, 530, 826, 739, 848)
      ..cubicTo(537, 810, 413, 773, 398, 722)
      ..cubicTo(356, 623, 718, 570, 665, 438)
      ..close();
    canvas.drawPath(sweep, gold);
    final second = Path()
      ..moveTo(342, 676)
      ..cubicTo(268, 787, 497, 824, 685, 836)
      ..cubicTo(444, 807, 296, 776, 342, 676)
      ..close();
    canvas.drawPath(second, gold);
    for (final point in [
      const Offset(500, 70),
      const Offset(500, 930),
      const Offset(70, 500),
      const Offset(930, 500),
    ]) {
      canvas.drawPath(
        star(
          point.dx,
          point.dy,
          point.dx == 500 ? 42 : 35,
          vertical: point.dx == 500 ? 1.45 : .6,
        ),
        gold,
      );
    }
    for (final point in [
      const Offset(306, 186),
      const Offset(640, 180),
      const Offset(735, 275),
      const Offset(825, 407),
      const Offset(730, 464),
      const Offset(311, 460),
      const Offset(390, 520),
      const Offset(220, 584),
      const Offset(173, 650),
      const Offset(642, 650),
      const Offset(735, 752),
      const Offset(295, 817),
    ]) {
      canvas.drawPath(star(point.dx, point.dy, 15), gold);
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(BrandEmblemPainter oldDelegate) =>
      oldDelegate.monochrome != monochrome;
}
