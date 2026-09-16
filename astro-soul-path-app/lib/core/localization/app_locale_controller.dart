import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

abstract final class AppLocaleController {
  static const FlutterSecureStorage _storage = FlutterSecureStorage();

  static const String _languageKey = 'asp_language_code';

  static const Set<String> supportedLanguageCodes = <String>{
    'en',
    'hi',
    'bn',
    'ta',
    'te',
    'mr',
    'gu',
    'kn',
    'ml',
    'pa',
    'es',
    'fr',
    'de',
    'pt',
    'it',
    'ja',
    'ko',
    'zh',
    'ar',
    'ru',
  };

  static final ValueNotifier<Locale> locale = ValueNotifier<Locale>(
    const Locale('en'),
  );

  static String get languageCode => locale.value.languageCode;

  static String normalizeLanguageCode(String? languageCode) {
    final normalized = languageCode?.trim().toLowerCase() ?? '';

    if (!supportedLanguageCodes.contains(normalized)) {
      return 'en';
    }

    return normalized;
  }

  static Future<void> loadCached() async {
    try {
      final stored = await _storage.read(key: _languageKey);
      final normalized = normalizeLanguageCode(stored);

      if (locale.value.languageCode != normalized) {
        locale.value = Locale(normalized);
      }

      // Repair stale/unsupported persisted values automatically.
      if (stored != null &&
          stored.trim().isNotEmpty &&
          stored.trim().toLowerCase() != normalized) {
        await _storage.write(key: _languageKey, value: normalized);
      }
    } catch (_) {
      // Secure-storage failure must never prevent app startup.
      if (locale.value.languageCode != 'en') {
        locale.value = const Locale('en');
      }
    }
  }

  static Future<void> setLanguage(String languageCode) async {
    final normalized = normalizeLanguageCode(languageCode);

    // Update UI immediately.
    if (locale.value.languageCode != normalized) {
      locale.value = Locale(normalized);
    }

    try {
      // Persist across app restarts.
      await _storage.write(key: _languageKey, value: normalized);
    } catch (_) {
      // UI locale remains active even if local persistence temporarily fails.
    }
  }

  static Future<void> reset() async {
    locale.value = const Locale('en');

    try {
      await _storage.delete(key: _languageKey);
    } catch (_) {
      // Resetting locale must not crash the app.
    }
  }
}
