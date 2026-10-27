import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AiChatLanguage {
  const AiChatLanguage(this.code, this.label, this.rtl, this.enabled);
  final String code, label;
  final bool rtl, enabled;
}

const aiChatLanguages = <AiChatLanguage>[
  AiChatLanguage('en', 'English', false, true),
  AiChatLanguage('hi', 'हिन्दी', false, true),
  AiChatLanguage('hi-Latn', 'Hinglish', false, true),
  AiChatLanguage('es', 'Español', false, false),
  AiChatLanguage('ar', 'العربية', true, false),
  AiChatLanguage('fr', 'Français', false, false),
  AiChatLanguage('pt', 'Português', false, false),
  AiChatLanguage('bn', 'Bengali', false, false),
  AiChatLanguage('ta', 'Tamil', false, false),
  AiChatLanguage('te', 'Telugu', false, false),
  AiChatLanguage('mr', 'Marathi', false, false),
  AiChatLanguage('gu', 'Gujarati', false, false),
  AiChatLanguage('de', 'Deutsch', false, false),
  AiChatLanguage('it', 'Italiano', false, false),
  AiChatLanguage('ja', 'Japanese', false, false),
  AiChatLanguage('ko', 'Korean', false, false),
  AiChatLanguage('zh', 'Chinese', false, false),
  AiChatLanguage('ru', 'Russian', false, false),
  AiChatLanguage('tr', 'Türkçe', false, false),
  AiChatLanguage('id', 'Bahasa Indonesia', false, false),
  AiChatLanguage('ur', 'اردو', true, false),
];
String normalizeAiChatLanguage(String? code) =>
    code == 'auto' || aiChatLanguages.any((l) => l.code == code && l.enabled)
    ? code!
    : 'auto';
TextDirection aiChatDirection(String code) =>
    aiChatLanguages.any((l) => l.code == code && l.rtl)
    ? TextDirection.rtl
    : TextDirection.ltr;

class AiChatLanguagePreferences {
  AiChatLanguagePreferences({FlutterSecureStorage? storage})
    : _storage = storage ?? const FlutterSecureStorage();
  final FlutterSecureStorage _storage;
  String _key(String id) {
    if (id.trim().isEmpty) throw ArgumentError('Canonical account required');
    return 'asp_ai_chat_language_v1:$id';
  }

  Future<String> read(String id) async =>
      normalizeAiChatLanguage(await _storage.read(key: _key(id)));
  Future<void> write(String id, String code) async {
    if (normalizeAiChatLanguage(code) != code) {
      throw ArgumentError('Language not validated');
    }
    await _storage.write(key: _key(id), value: code);
  }
}

String aiChatLabel(String code, String key) {
  const copy = {
    'en': {
      'empty': 'Ask your first question when you are ready.',
      'error': 'AI could not answer right now. Please try again.',
      'language': 'AI reply language',
      'typing': 'is typing…',
      'question': 'Write your question…',
      'saveError': 'Unable to save chat language. Please try again.',
    },
    'hi': {
      'empty': 'जब आप तैयार हों, अपना पहला प्रश्न पूछें।',
      'error': 'अभी उत्तर नहीं मिल सका। कृपया फिर कोशिश करें।',
      'language': 'AI उत्तर की भाषा',
      'typing': 'उत्तर लिख रहे हैं…',
      'question': 'अपना प्रश्न लिखें…',
      'saveError': 'भाषा सेव नहीं हुई। कृपया फिर कोशिश करें।',
    },
    'hi-Latn': {
      'empty': 'Jab aap taiyaar hon, apna pehla sawaal poochhein.',
      'error': 'Abhi jawab nahi mil saka. Dobara koshish karein.',
      'language': 'AI jawab ki bhasha',
      'typing': 'jawab likh rahe hain…',
      'question': 'Apna sawaal likhein…',
      'saveError': 'Bhasha save nahi hui. Dobara koshish karein.',
    },
  };
  return copy[code]?[key] ?? copy['en']![key] ?? key;
}

TextDirection aiChatMessageDirection(String text) {
  final first = RegExp(
    r'[A-Za-z\u0621-\u064a\u066e-\u06d3\u0900-\u097f]',
  ).firstMatch(text)?.group(0);
  if (first == null) return TextDirection.ltr;
  final value = first.codeUnitAt(0);
  return value >= 0x0600 && value <= 0x06ff
      ? TextDirection.rtl
      : TextDirection.ltr;
}
