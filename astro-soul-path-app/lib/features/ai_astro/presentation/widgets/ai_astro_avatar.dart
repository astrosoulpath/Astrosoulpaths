import 'package:flutter/material.dart';

class AiAstroAvatar extends StatelessWidget {
  const AiAstroAvatar({
    required this.personaName,
    required this.initials,
    super.key,
  });

  final String personaName;
  final String initials;

  String get _assetPath {
    final name = personaName.toLowerCase();

    if (name.contains('kundli')) {
      return 'assets/stickers/ai_avatars/kundli_guide_ai.png';
    }
    if (name.contains('vedic')) {
      return 'assets/stickers/ai_avatars/vedic_wisdom_ai.png';
    }
    if (name.contains('career')) {
      return 'assets/stickers/ai_avatars/career_compass_ai.png';
    }
    if (name.contains('love')) {
      return 'assets/stickers/ai_avatars/love_harmony_ai.png';
    }
    if (name.contains('cosmic')) {
      return 'assets/stickers/ai_avatars/cosmic_timing_ai.png';
    }
    if (name.contains('numerology')) {
      return 'assets/stickers/ai_avatars/numerology_insight_ai.png';
    }
    if (name.contains('marriage')) {
      return 'assets/stickers/ai_avatars/marriage_path_ai.png';
    }
    if (name.contains('finance')) {
      return 'assets/stickers/ai_avatars/finance_flow_ai.png';
    }
    if (name.contains('wellness')) {
      return 'assets/stickers/ai_avatars/wellness_balance_ai.png';
    }
    return 'assets/stickers/ai_avatars/spiritual_path_ai.png';
  }

  @override
  Widget build(BuildContext context) {
    return ClipOval(
      child: Image.asset(
        _assetPath,
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) => Container(
          color: const Color(0xFFFFF7E5),
          alignment: Alignment.center,
          child: Text(
            initials,
            style: const TextStyle(
              color: Color(0xFF7C5B16),
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
      ),
    );
  }
}
