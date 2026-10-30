import 'package:flutter/material.dart';

const premiumInk = Color(0xFF14213D);
const premiumIvory = Color(0xFFFFFAF2);
const premiumBorder = Color(0xFFE4D2AA);
const premiumGold = Color(0xFF8B651F);
const premiumMuted = Color(0xFF596174);

/// Text is always rendered by Flutter; artwork never supplies the only label.
class PremiumCategoryTile extends StatelessWidget {
  const PremiumCategoryTile({
    super.key,
    required this.assetPath,
    required this.label,
    required this.onTap,
  });
  final String assetPath, label;
  final VoidCallback onTap;

  static const _labelStyle = TextStyle(
    color: premiumInk,
    fontSize: 14,
    height: 1.3,
    fontWeight: FontWeight.w600,
  );

  static double diameter(BuildContext context) =>
      (MediaQuery.sizeOf(context).width * .18).clamp(64.0, 72.0);

  static double itemWidth(BuildContext context) =>
      104 + (MediaQuery.textScalerOf(context).scale(14) - 14).clamp(0, 140) * 3;

  /// Measure localized labels with the actual scaler, rather than truncating
  /// accessible text or guessing a fixed carousel height.
  static double carouselHeight(BuildContext context, List<String> labels) {
    var labelHeight = 0.0;
    for (final label in labels) {
      final painter = TextPainter(
        text: TextSpan(text: label, style: _labelStyle),
        textDirection: Directionality.of(context),
        textScaler: MediaQuery.textScalerOf(context),
      )..layout(maxWidth: itemWidth(context) - 24);
      if (painter.height > labelHeight) labelHeight = painter.height;
      painter.dispose();
    }
    return (diameter(context) + 6 + 8 + 8 + labelHeight).ceilToDouble();
  }

  @override
  Widget build(BuildContext context) => SizedBox(
    width: itemWidth(context),
    child: Material(
      type: MaterialType.transparency,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Semantics(
          button: true,
          label: label,
          excludeSemantics: true,
          child: Padding(
            padding: const EdgeInsets.all(4),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: diameter(context),
                  height: diameter(context),
                  foregroundDecoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: const Color(0xFFD6AC50),
                      width: 1,
                    ),
                  ),
                  child: ClipOval(
                    child: Image.asset(
                      assetPath,
                      cacheWidth: 288,
                      fit: BoxFit.contain,
                      excludeFromSemantics: true,
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: Theme.of(context).brightness == Brightness.dark
                        ? Theme.of(context).colorScheme.surfaceContainerHighest
                        : const Color(0xFFFFF0D4),
                    borderRadius: BorderRadius.circular(40),
                  ),
                  child: Text(
                    label,
                    textAlign: TextAlign.center,
                    style: _labelStyle.copyWith(
                      color: Theme.of(context).colorScheme.onSurface,
                    ),
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

class PremiumSectionBanner extends StatelessWidget {
  const PremiumSectionBanner({
    super.key,
    required this.title,
    required this.subtitle,
    required this.assetPath,
    required this.icon,
    required this.onTap,
    this.actionLabel = 'View all',
  });
  final String title, subtitle, assetPath, actionLabel;
  final IconData icon;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.fromLTRB(16, 16, 16, 12),
    clipBehavior: Clip.antiAlias,
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(24),
      border: Border.all(color: Theme.of(context).colorScheme.outline),
      image: DecorationImage(
        image: AssetImage(assetPath),
        fit: BoxFit.cover,
        alignment: Alignment.topRight,
      ),
    ),
    child: DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: (Theme.of(context).brightness == Brightness.dark
              ? [
                  Theme.of(context).colorScheme.surface,
                  Theme.of(context).colorScheme.surfaceContainerHighest,
                ]
              : [Color(0xF5FFFAF2), Color(0xDEFFFAF2)]),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: const Color(0xFF8B651F), size: 28),
            const SizedBox(height: 12),
            Text(
              title,
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurface,
                fontSize: 23,
                fontWeight: FontWeight.w800,
                height: 1.2,
              ),
            ),
            const SizedBox(height: 7),
            Text(
              subtitle,
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurface,
                fontSize: 14,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 12),
            FilledButton.icon(
              style: FilledButton.styleFrom(
                backgroundColor: Theme.of(context).colorScheme.onSurface,
                foregroundColor: Colors.white,
                minimumSize: const Size(48, 48),
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 12,
                ),
              ),
              onPressed: onTap,
              icon: const Icon(Icons.arrow_forward_rounded, size: 18),
              label: Text(actionLabel),
            ),
          ],
        ),
      ),
    ),
  );
}

// Circular category presentation keeps labels in localized Flutter widgets.
