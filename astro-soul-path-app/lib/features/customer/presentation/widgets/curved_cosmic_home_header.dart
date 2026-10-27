import 'dart:math' as math;
import 'package:flutter/material.dart';

const _gold = Color(0xFFF0CF7D);
const _ivory = Color(0xFFFFF7E7);

/// Reference-led, paint-only decoration. All live data and actions are supplied.
class CurvedCosmicHomeHeader extends StatelessWidget
    implements PreferredSizeWidget {
  const CurvedCosmicHomeHeader({
    super.key,
    required this.walletLabel,
    required this.unreadCount,
    required this.onWallet,
    required this.onNotifications,
    this.subtitle = 'Trusted Vedic guidance',
    this.textScale = 1,
  });
  final String walletLabel, subtitle;
  final int unreadCount;
  final double textScale;
  final VoidCallback onWallet, onNotifications;
  @override
  Size get preferredSize =>
      Size.fromHeight(174 + math.max(0, textScale - 1) * 180);

  @override
  Widget build(BuildContext context) => Material(
    type: MaterialType.transparency,
    child: Stack(
      fit: StackFit.expand,
      children: [
        const Positioned.fill(
          child: IgnorePointer(
            child: RepaintBoundary(child: CustomPaint(painter: _CosmicSky())),
          ),
        ),
        SafeArea(
          bottom: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(10, 4, 10, 6),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Row(
                  children: [
                    _GlassButton(
                      tooltip: 'Menu',
                      icon: Icons.menu_rounded,
                      onPressed: () => Scaffold.of(context).openDrawer(),
                    ),
                    const SizedBox(width: 8),
                    const SizedBox(
                      width: 38,
                      height: 42,
                      child: CustomPaint(painter: _Lotus()),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: textScale > 1.4
                          ? const SizedBox()
                          : Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Astro Soul Path',
                                  style: TextStyle(
                                    color: _gold,
                                    fontFamily: 'serif',
                                    fontSize: 21,
                                    height: 1.15,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  subtitle,
                                  style: const TextStyle(
                                    color: _ivory,
                                    fontSize: 11,
                                    height: 1.3,
                                  ),
                                ),
                              ],
                            ),
                    ),
                    const SizedBox(width: 6),
                    _GlassButton(
                      tooltip: unreadCount > 0
                          ? 'Notifications, $unreadCount unread'
                          : 'Notifications',
                      icon: Icons.notifications_none_rounded,
                      onPressed: onNotifications,
                      unreadCount: unreadCount,
                    ),
                  ],
                ),
                if (textScale > 1.4) ...[
                  const SizedBox(height: 8),
                  const Text(
                    'Astro Soul Path',
                    style: TextStyle(
                      color: _gold,
                      fontFamily: 'serif',
                      fontSize: 21,
                      height: 1.15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    subtitle,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: _ivory,
                      fontSize: 11,
                      height: 1.3,
                    ),
                  ),
                ],
                const SizedBox(height: 12),
                Align(
                  alignment: Alignment.centerRight,
                  child: Semantics(
                    label: 'Wallet balance $walletLabel',
                    button: true,
                    child: Material(
                      color: _ivory,
                      shape: const StadiumBorder(
                        side: BorderSide(color: _gold, width: 1.5),
                      ),
                      child: InkWell(
                        onTap: onWallet,
                        customBorder: const StadiumBorder(),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 12,
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.account_balance_wallet_rounded,
                                color: Color(0xFFB5842D),
                                size: 22,
                              ),
                              const SizedBox(width: 8),
                              Flexible(
                                child: Text(
                                  walletLabel,
                                  style: const TextStyle(
                                    color: Color(0xFF211B33),
                                    fontWeight: FontWeight.w800,
                                    fontSize: 15,
                                  ),
                                ),
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
          ),
        ),
      ],
    ),
  );
}

class _GlassButton extends StatelessWidget {
  const _GlassButton({
    required this.tooltip,
    required this.icon,
    required this.onPressed,
    this.unreadCount = 0,
  });
  final String tooltip;
  final IconData icon;
  final VoidCallback onPressed;
  final int unreadCount;
  @override
  Widget build(BuildContext context) => Stack(
    clipBehavior: Clip.none,
    children: [
      Container(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: const RadialGradient(
            colors: [Color(0x665D3988), Color(0x77241B43)],
          ),
          border: Border.all(color: _gold.withValues(alpha: .45)),
          boxShadow: const [
            BoxShadow(color: Color(0x227F54C7), blurRadius: 12),
          ],
        ),
        child: IconButton(
          tooltip: tooltip,
          onPressed: onPressed,
          constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
          icon: Icon(icon, color: _gold, size: 26),
        ),
      ),
      if (unreadCount > 0)
        Positioned(
          right: -2,
          top: -2,
          child: IgnorePointer(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
              decoration: BoxDecoration(
                color: const Color(0xFFA42D55),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: _ivory),
              ),
              child: Text(
                unreadCount > 99 ? '99+' : '$unreadCount',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
        ),
    ],
  );
}

class _CosmicSky extends CustomPainter {
  const _CosmicSky();
  Path wave(Size s, double shift) => Path()
    ..moveTo(0, 0)
    ..lineTo(s.width, 0)
    ..lineTo(s.width, s.height * .84 + shift)
    ..cubicTo(
      s.width * .85,
      s.height * 1.03 + shift,
      s.width * .68,
      s.height * .86 + shift,
      s.width * .53,
      s.height * .88 + shift,
    )
    ..cubicTo(
      s.width * .31,
      s.height * .87 + shift,
      s.width * .13,
      s.height * 1.04 + shift,
      0,
      s.height * .82 + shift,
    )
    ..close();
  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final lower = wave(size, 3);
    canvas.drawPath(
      lower,
      Paint()
        ..shader = const LinearGradient(
          colors: [Color(0xFFFFDE80), Color(0xFFC39A64), Color(0xFFFFE6A3)],
        ).createShader(rect),
    );
    final sky = wave(size, 0);
    canvas.save();
    canvas.clipPath(sky);
    canvas.drawRect(
      rect,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFF05091D),
            Color(0xFF171038),
            Color(0xFF35205C),
            Color(0xFF100921),
          ],
        ).createShader(rect),
    );
    final moon = Offset(size.width * .48, size.height * .21);
    final radius = size.height * .65;
    canvas.drawCircle(
      moon,
      radius + 12,
      Paint()
        ..shader = RadialGradient(
          colors: [const Color(0x887F4FC5), const Color(0x007F4FC5)],
        ).createShader(Rect.fromCircle(center: moon, radius: radius + 12)),
    );
    canvas.drawCircle(
      moon,
      radius,
      Paint()
        ..shader = const RadialGradient(
          center: Alignment(.15, -.2),
          colors: [
            Color(0xFFC5A4EB),
            Color(0xFF59357E),
            Color(0xFF33204F),
            Color(0xFF110C26),
          ],
          stops: [0, .18, .68, 1],
        ).createShader(Rect.fromCircle(center: moon, radius: radius)),
    );
    canvas.drawCircle(
      moon,
      radius,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = const Color(0x447F5BB5),
    );
    final center = Offset(size.width * .79, size.height * .58);
    final r = size.height * .65;
    final p = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = .7
      ..color = _gold.withValues(alpha: .28);
    for (final factor in [1.0, .94, .75, .56]) {
      canvas.drawCircle(center, r * factor, p);
    }
    for (var i = 0; i < 12; i++) {
      final a = i * math.pi / 6;
      final unit = Offset(math.cos(a), math.sin(a));
      canvas.drawLine(center + unit * r * .56, center + unit * r * .94, p);
      _zodiac(
        canvas,
        center +
            Offset(math.cos(a + math.pi / 12), math.sin(a + math.pi / 12)) *
                r *
                .84,
        i,
      );
    }
    for (final star in [
      const Offset(.08, .24),
      const Offset(.36, .1),
      const Offset(.64, .24),
      const Offset(.94, .16),
      const Offset(.22, .68),
    ]) {
      final c = Offset(size.width * star.dx, size.height * star.dy);
      final path = Path()
        ..moveTo(c.dx, c.dy - 4)
        ..quadraticBezierTo(c.dx + 1, c.dy - 1, c.dx + 4, c.dy)
        ..quadraticBezierTo(c.dx + 1, c.dy + 1, c.dx, c.dy + 4)
        ..quadraticBezierTo(c.dx - 1, c.dy + 1, c.dx - 4, c.dy)
        ..quadraticBezierTo(c.dx - 1, c.dy - 1, c.dx, c.dy - 4);
      canvas.drawPath(path, Paint()..color = _gold.withValues(alpha: .7));
    }
    canvas.restore();
    canvas.drawPath(
      sky,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = _gold.withValues(alpha: .8),
    );
  }

  @override
  bool shouldRepaint(covariant _CosmicSky oldDelegate) => false;
}

// Font-independent zodiac outlines, ornamental only, never chart data.
void _zodiac(Canvas canvas, Offset center, int index) {
  canvas.save();
  canvas.translate(center.dx, center.dy);
  final p = Paint()
    ..color = _gold.withValues(alpha: .5)
    ..style = PaintingStyle.stroke
    ..strokeWidth = 1
    ..strokeCap = StrokeCap.round;
  final path = Path();
  switch (index) {
    case 0:
      path.moveTo(0, 6);
      path.cubicTo(0, -10, -10, -7, -5, -1);
      path.moveTo(0, 6);
      path.cubicTo(0, -10, 10, -7, 5, -1);
    case 1:
      canvas.drawCircle(const Offset(0, 2), 4, p);
      path.moveTo(-5, -6);
      path.quadraticBezierTo(0, 1, 5, -6);
    case 2:
      path.moveTo(-5, -6);
      path.quadraticBezierTo(0, -4, 5, -6);
      path.moveTo(-5, 6);
      path.quadraticBezierTo(0, 4, 5, 6);
      path.moveTo(-3, -5);
      path.lineTo(-3, 5);
      path.moveTo(3, -5);
      path.lineTo(3, 5);
    case 3:
      canvas.drawCircle(const Offset(-3, -2), 2, p);
      canvas.drawCircle(const Offset(3, 2), 2, p);
      path.moveTo(-5, -2);
      path.quadraticBezierTo(0, -9, 6, -3);
      path.moveTo(5, 2);
      path.quadraticBezierTo(0, 9, -6, 3);
    case 4:
      canvas.drawCircle(const Offset(-4, 3), 2, p);
      path.moveTo(-2, 3);
      path.cubicTo(5, 0, -7, -10, 2, -6);
      path.cubicTo(9, -2, 0, 6, 6, 6);
    case 5:
    case 7:
      path.moveTo(-6, 5);
      path.lineTo(-6, -5);
      path.quadraticBezierTo(-3, -9, -2, -3);
      path.lineTo(-2, 5);
      path.moveTo(-2, -3);
      path.quadraticBezierTo(2, -9, 2, -3);
      path.lineTo(2, 5);
      path.quadraticBezierTo(7, 8, 7, 2);
      if (index == 7) {
        path.moveTo(4, 3);
        path.lineTo(7, 2);
        path.lineTo(8, 5);
      } else {
        canvas.drawOval(const Rect.fromLTWH(1, -3, 5, 8), p);
      }
    case 6:
      path.moveTo(-6, 6);
      path.lineTo(6, 6);
      path.moveTo(-6, 1);
      path.lineTo(-3, 1);
      path.cubicTo(-8, -8, 8, -8, 3, 1);
      path.lineTo(6, 1);
    case 8:
      path.moveTo(-5, 6);
      path.lineTo(5, -5);
      path.lineTo(0, -5);
      path.moveTo(5, -5);
      path.lineTo(5, 0);
      path.moveTo(-4, -2);
      path.lineTo(2, 4);
    case 9:
      path.moveTo(-6, -5);
      path.lineTo(-3, 4);
      path.lineTo(0, -4);
      path.cubicTo(3, -8, 0, 8, 5, 5);
      path.cubicTo(10, 0, 1, -1, 1, 4);
    case 10:
      for (final y in [-3.0, 3.0]) {
        path.moveTo(-7, y);
        path.lineTo(-3, y - 3);
        path.lineTo(0, y);
        path.lineTo(3, y - 3);
        path.lineTo(7, y);
      }
    case 11:
      path.moveTo(-5, -6);
      path.quadraticBezierTo(0, 0, -5, 6);
      path.moveTo(5, -6);
      path.quadraticBezierTo(0, 0, 5, 6);
      path.moveTo(-4, 0);
      path.lineTo(4, 0);
  }
  canvas.drawPath(path, p);
  canvas.restore();
}

class _Lotus extends CustomPainter {
  const _Lotus();
  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 42, size.height / 46);
    final p = Paint()
      ..style = PaintingStyle.stroke
      ..color = _gold
      ..strokeWidth = 1.2;
    canvas.drawCircle(const Offset(21, 23), 20, p);
    canvas.drawPath(
      Path()
        ..moveTo(21, 35)
        ..cubicTo(7, 27, 20, 16, 21, 12)
        ..cubicTo(23, 17, 34, 27, 21, 35),
      p,
    );
    canvas.drawPath(
      Path()
        ..moveTo(21, 35)
        ..cubicTo(7, 36, 6, 26, 6, 24)
        ..cubicTo(18, 24, 21, 30, 21, 35)
        ..moveTo(21, 35)
        ..cubicTo(35, 36, 36, 26, 36, 24)
        ..cubicTo(24, 24, 21, 30, 21, 35)
        ..moveTo(21, 35)
        ..cubicTo(8, 31, 11, 22, 11, 20)
        ..cubicTo(21, 24, 21, 31, 21, 35)
        ..moveTo(21, 35)
        ..cubicTo(34, 31, 31, 22, 31, 20)
        ..cubicTo(21, 24, 21, 31, 21, 35),
      p,
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _Lotus oldDelegate) => false;
}
