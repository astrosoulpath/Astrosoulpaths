import 'dart:convert';

import 'package:flutter/widgets.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

abstract final class AppStrings {
  static const FlutterSecureStorage _storage = FlutterSecureStorage();

  static final ValueNotifier<int> revision = ValueNotifier<int>(0);

  static final Map<String, Map<String, String>> _remoteTranslations =
      <String, Map<String, String>>{};

  static String _cacheKey(String code) => 'asp_ui_translations_$code';

  static Future<void> installRemoteTranslations(
    String languageCode,
    Map<String, String> translations,
  ) async {
    final code = languageCode.trim().toLowerCase();
    final cleaned = <String, String>{};

    for (final entry in translations.entries) {
      final key = entry.key.trim();
      final value = entry.value.trim();

      if (key.isNotEmpty && value.isNotEmpty) {
        cleaned[key] = value;
      }
    }

    _remoteTranslations[code] = cleaned;

    try {
      await _storage.write(key: _cacheKey(code), value: jsonEncode(cleaned));
    } catch (_) {}

    revision.value++;
  }

  static Future<void> loadCachedTranslations(String languageCode) async {
    final code = languageCode.trim().toLowerCase();

    if (code.isEmpty || code == 'en') {
      return;
    }

    try {
      final raw = await _storage.read(key: _cacheKey(code));

      if (raw == null || raw.trim().isEmpty) {
        return;
      }

      final decoded = jsonDecode(raw);

      if (decoded is! Map) {
        return;
      }

      final values = <String, String>{};

      for (final entry in decoded.entries) {
        final key = entry.key.toString().trim();
        final value = entry.value?.toString().trim() ?? '';

        if (key.isNotEmpty && value.isNotEmpty) {
          values[key] = value;
        }
      }

      _remoteTranslations[code] = values;
      revision.value++;
    } catch (_) {}
  }

  static String _languageCode(BuildContext context) =>
      Localizations.localeOf(context).languageCode.toLowerCase();

  static const Map<String, Map<String, String>>
  _translations = <String, Map<String, String>>{
    'Home': <String, String>{
      'hi': '\u0939\u094b\u092e',
      'bn': '\u09b9\u09cb\u09ae',
    },
    'Trusted Vedic guidance': <String, String>{
      'hi':
          '\u0935\u093f\u0936\u094d\u0935\u0938\u0928\u0940\u092f \u0935\u0948\u0926\u093f\u0915 \u092e\u093e\u0930\u094d\u0917\u0926\u0930\u094d\u0936\u0928',
      'bn':
          '\u09ac\u09bf\u09b6\u09cd\u09ac\u09b8\u09cd\u09a4 \u09ac\u09c8\u09a6\u09bf\u0995 \u09a8\u09bf\u09b0\u09cd\u09a6\u09c7\u09b6\u09a8\u09be',
    },
    'My Account': <String, String>{
      'hi': '\u092e\u0947\u0930\u093e \u0916\u093e\u0924\u093e',
      'bn':
          '\u0986\u09ae\u09be\u09b0 \u0985\u09cd\u09af\u09be\u0995\u09be\u0989\u09a8\u09cd\u099f',
    },
    'Change Language': <String, String>{
      'hi': '\u092d\u093e\u0937\u093e \u092c\u0926\u0932\u0947\u0902',
      'bn':
          '\u09ad\u09be\u09b7\u09be \u09aa\u09b0\u09bf\u09ac\u09b0\u09cd\u09a4\u09a8 \u0995\u09b0\u09c1\u09a8',
    },
    'Join as Astrologer': <String, String>{
      'hi':
          '\u091c\u094d\u092f\u094b\u0924\u093f\u0937\u0940 \u0915\u0947 \u0930\u0942\u092a \u092e\u0947\u0902 \u091c\u0941\u0921\u093c\u0947\u0902',
      'bn':
          '\u099c\u09cd\u09af\u09cb\u09a4\u09bf\u09b7\u09c0 \u09b9\u09bf\u09b8\u09c7\u09ac\u09c7 \u09af\u09cb\u0997 \u09a6\u09bf\u09a8',
    },
    'Refresh Profile': <String, String>{
      'hi':
          '\u092a\u094d\u0930\u094b\u092b\u093c\u093e\u0907\u0932 \u0930\u0940\u092b\u094d\u0930\u0947\u0936 \u0915\u0930\u0947\u0902',
      'bn':
          '\u09aa\u09cd\u09b0\u09cb\u09ab\u09be\u0987\u09b2 \u09b0\u09bf\u09ab\u09cd\u09b0\u09c7\u09b6 \u0995\u09b0\u09c1\u09a8',
    },
    'Share App': <String, String>{
      'hi': '\u0910\u092a \u0938\u093e\u091d\u093e \u0915\u0930\u0947\u0902',
      'bn':
          '\u0985\u09cd\u09af\u09be\u09aa \u09b6\u09c7\u09df\u09be\u09b0 \u0995\u09b0\u09c1\u09a8',
    },
    'Rate App': <String, String>{
      'hi':
          '\u0910\u092a \u0915\u094b \u0930\u0947\u091f \u0915\u0930\u0947\u0902',
      'bn':
          '\u0985\u09cd\u09af\u09be\u09aa \u09b0\u09c7\u099f \u0995\u09b0\u09c1\u09a8',
    },
    'About Us': <String, String>{
      'hi':
          '\u0939\u092e\u093e\u0930\u0947 \u092c\u093e\u0930\u0947 \u092e\u0947\u0902',
      'bn':
          '\u0986\u09ae\u09be\u09a6\u09c7\u09b0 \u09b8\u09ae\u09cd\u09aa\u09b0\u09cd\u0995\u09c7',
    },
    'Feedback': <String, String>{
      'hi':
          '\u092a\u094d\u0930\u0924\u093f\u0915\u094d\u0930\u093f\u092f\u093e',
      'bn': '\u09ae\u09a4\u09be\u09ae\u09a4',
    },
    'Logout': <String, String>{
      'hi': '\u0932\u0949\u0917\u0906\u0909\u091f',
      'bn': '\u09b2\u0997\u0986\u0989\u099f',
    },
    'Recommended for you': <String, String>{
      'hi':
          '\u0906\u092a\u0915\u0947 \u0932\u093f\u090f \u0938\u0941\u091d\u093e\u0935',
      'bn':
          '\u0986\u09aa\u09a8\u09be\u09b0 \u099c\u09a8\u09cd\u09af \u09aa\u09cd\u09b0\u09b8\u09cd\u09a4\u09be\u09ac\u09bf\u09a4',
    },
    'Vedic Astrologers': <String, String>{
      'hi':
          '\u0935\u0948\u0926\u093f\u0915 \u091c\u094d\u092f\u094b\u0924\u093f\u0937\u0940',
      'bn':
          '\u09ac\u09c8\u09a6\u09bf\u0995 \u099c\u09cd\u09af\u09cb\u09a4\u09bf\u09b7\u09c0',
    },
    'AI Astrologers': <String, String>{
      'hi':
          '\u090f\u0906\u0908 \u091c\u094d\u092f\u094b\u0924\u093f\u0937\u0940',
      'bn':
          '\u098f\u0986\u0987 \u099c\u09cd\u09af\u09cb\u09a4\u09bf\u09b7\u09c0',
    },
    'View All': <String, String>{
      'hi': '\u0938\u092d\u0940 \u0926\u0947\u0916\u0947\u0902',
      'bn': '\u09b8\u09ac \u09a6\u09c7\u0996\u09c1\u09a8',
    },
    'Consultations': <String, String>{
      'hi': '\u092a\u0930\u093e\u092e\u0930\u094d\u0936',
      'bn': '\u09aa\u09b0\u09be\u09ae\u09b0\u09cd\u09b6',
    },
    'Profile': <String, String>{
      'hi': '\u092a\u094d\u0930\u094b\u092b\u093c\u093e\u0907\u0932',
      'bn': '\u09aa\u09cd\u09b0\u09cb\u09ab\u09be\u0987\u09b2',
    },
    'AI Astro': <String, String>{
      'hi': '\u090f\u0906\u0908 \u090f\u0938\u094d\u091f\u094d\u0930\u094b',
      'bn':
          '\u098f\u0986\u0987 \u0985\u09cd\u09af\u09be\u09b8\u09cd\u099f\u09cd\u09b0\u09cb',
    },
    'Choose your preferred language': <String, String>{
      'hi':
          '\u0905\u092a\u0928\u0940 \u092a\u0938\u0902\u0926\u0940\u0926\u093e \u092d\u093e\u0937\u093e \u091a\u0941\u0928\u0947\u0902',
      'bn':
          '\u0986\u09aa\u09a8\u09be\u09b0 \u09aa\u099b\u09a8\u09cd\u09a6\u09c7\u09b0 \u09ad\u09be\u09b7\u09be \u09ac\u09c7\u099b\u09c7 \u09a8\u09bf\u09a8',
    },
    'Continue': <String, String>{
      'hi': '\u091c\u093e\u0930\u0940 \u0930\u0916\u0947\u0902',
      'bn': '\u099a\u09be\u09b2\u09bf\u09df\u09c7 \u09af\u09be\u09a8',
    },
  };

  static String text(BuildContext context, {required String en, String? hi}) {
    final code = _languageCode(context);

    if (code == 'en') {
      return en;
    }

    final remote = _remoteTranslations[code]?[en];

    if (remote != null && remote.trim().isNotEmpty) {
      return remote;
    }

    final translated = _translations[en]?[code];

    if (translated != null && translated.trim().isNotEmpty) {
      return translated;
    }

    if (code == 'hi' && hi != null && hi.trim().isNotEmpty) {
      return hi;
    }

    return en;
  }
}
