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
  @override
  Widget build(BuildContext context) => SizedBox(
    width:
        104 +
        (MediaQuery.textScalerOf(context).scale(14) - 14).clamp(0, 56) * 6,
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
            padding: const EdgeInsets.all(8),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Image.asset(
                  assetPath,
                  width: 88,
                  height: 88,
                  cacheWidth: 256,
                  fit: BoxFit.contain,
                  excludeFromSemantics: true,
                ),
                const SizedBox(height: 8),
                Text(
                  label,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: premiumInk,
                    fontSize: 14,
                    height: 1.3,
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
      border: Border.all(color: premiumBorder),
      image: DecorationImage(
        image: AssetImage(assetPath),
        fit: BoxFit.cover,
        alignment: Alignment.topRight,
      ),
    ),
    child: DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xF5FFFAF2), Color(0xDEFFFAF2)],
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
              style: const TextStyle(
                color: premiumInk,
                fontSize: 23,
                fontWeight: FontWeight.w800,
                height: 1.2,
              ),
            ),
            const SizedBox(height: 7),
            Text(
              subtitle,
              style: const TextStyle(
                color: Color(0xFF50586A),
                fontSize: 14,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 12),
            FilledButton.icon(
              style: FilledButton.styleFrom(
                backgroundColor: premiumInk,
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
