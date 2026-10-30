import 'package:flutter/material.dart';

/// Scoped tokens: do not change the approved Home theme or other portals.
abstract final class CosmicIvory {
  static const background = Color(0xFFFFFAF5);
  static const amethyst = Color(0xFF713FC0);
  static const purple = Color(0xFF251638);
  static const gold = Color(0xFFD9A83E);
  static const lavender = Color(0xFFF2EAFE);
  static const ink = Color(0xFF20233A);
  static const muted = Color(0xFF77758A);
  static const success = Color(0xFF238765);
  static const danger = Color(0xFFD94350);
  static const border = Color(0xFFE9DDF1);

  static BoxDecoration card({
    Color? color,
    BuildContext? context,
  }) => BoxDecoration(
    color:
        color ??
        (context == null
            ? Colors.white
            : Theme.of(context).colorScheme.surface),
    borderRadius: BorderRadius.circular(24),
    border: Border.all(
      color: context == null ? border : Theme.of(context).colorScheme.outline,
    ),
    boxShadow: const [
      BoxShadow(color: Color(0x08251638), blurRadius: 18, offset: Offset(0, 6)),
    ],
  );
}

class CosmicSection extends StatelessWidget {
  const CosmicSection({required this.title, required this.child, super.key});
  final String title;
  final Widget child;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(20),
    decoration: CosmicIvory.card(context: context),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: TextStyle(
            color: Theme.of(context).colorScheme.onSurface,
            fontSize: 20,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 12),
        child,
      ],
    ),
  );
}
