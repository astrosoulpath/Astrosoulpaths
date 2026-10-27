// Compatibility exports for existing Marriage callers/tests. One shared renderer.
import 'kundli_assistant_design.dart';
import 'premium_kundli_ai_presentation.dart';

class MarriageAiPresentation extends PremiumKundliAiPresentation {
  const MarriageAiPresentation({
    super.key,
    required super.controller,
    required super.messages,
    required super.sending,
    required super.grounded,
    required super.onSend,
    required super.onRetry,
    super.error,
    super.freeChat,
  });
  static List<String> get questions => marriageAssistant.questions;
}

class MarriageCelestialHero extends PremiumCelestialHero {
  const MarriageCelestialHero({super.key});
}
