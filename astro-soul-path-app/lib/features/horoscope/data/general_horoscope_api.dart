import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';

class GeneralHoroscopeApiException implements Exception {
  const GeneralHoroscopeApiException(this.message);

  final String message;

  @override
  String toString() => message;
}

class GeneralHoroscopeApi {
  GeneralHoroscopeApi({http.Client? client})
    : _client = client ?? http.Client();

  final http.Client _client;

  Future<Map<String, dynamic>> getDaily({
    required String moonSign,
    required DateTime date,
    String languageCode = 'en',
  }) {
    final normalizedSign = moonSign.trim();
    final normalizedLanguage = languageCode.trim().toLowerCase();

    if (normalizedSign.isEmpty) {
      throw const GeneralHoroscopeApiException('Please select a Moon Sign.');
    }

    return _get(
      '/general-horoscope/daily'
      '?moonSign=${Uri.encodeQueryComponent(normalizedSign)}'
      '&date=${_date(date)}'
      '&lang=${Uri.encodeQueryComponent(normalizedLanguage.isEmpty ? 'en' : normalizedLanguage)}',
      fallbackError: 'Unable to load horoscope.',
    );
  }

  Future<Map<String, dynamic>> _getPeriodHoroscope({
    required String endpoint,
    required String moonSign,
    DateTime? date,
    String languageCode = 'en',
  }) {
    final normalizedSign = moonSign.trim();
    final normalizedLanguage = languageCode.trim().toLowerCase();

    if (normalizedSign.isEmpty) {
      throw const GeneralHoroscopeApiException('Please select a Moon Sign.');
    }

    final query = <String>[
      'moonSign=${Uri.encodeQueryComponent(normalizedSign)}',
      'lang=${Uri.encodeQueryComponent(normalizedLanguage.isEmpty ? 'en' : normalizedLanguage)}',
    ];

    if (date != null) {
      query.add('date=${_date(date)}');
    }

    return _get(
      '/general-horoscope/$endpoint?${query.join('&')}',
      fallbackError: 'Unable to load horoscope.',
    );
  }

  Future<Map<String, dynamic>> getWeekly({
    required String moonSign,
    DateTime? date,
    String languageCode = 'en',
  }) {
    return _getPeriodHoroscope(
      endpoint: 'weekly',
      moonSign: moonSign,
      date: date,
      languageCode: languageCode,
    );
  }

  Future<Map<String, dynamic>> getWeeklyLove({
    required String moonSign,
    DateTime? date,
    String languageCode = 'en',
  }) {
    return _getPeriodHoroscope(
      endpoint: 'weekly-love',
      moonSign: moonSign,
      date: date,
      languageCode: languageCode,
    );
  }

  Future<Map<String, dynamic>> getMonthly({
    required String moonSign,
    DateTime? date,
    String languageCode = 'en',
  }) {
    return _getPeriodHoroscope(
      endpoint: 'monthly',
      moonSign: moonSign,
      date: date,
      languageCode: languageCode,
    );
  }

  Future<Map<String, dynamic>> getYearly({
    required String moonSign,
    DateTime? date,
    String languageCode = 'en',
  }) {
    return _getPeriodHoroscope(
      endpoint: 'yearly',
      moonSign: moonSign,
      date: date,
      languageCode: languageCode,
    );
  }

  Future<Map<String, dynamic>> getPanchang({
    required DateTime date,
    String languageCode = 'en',
    double? latitude,
    double? longitude,
    double? timezone,
    String? timezoneName,
    String? place,
  }) {
    final normalizedLanguage = languageCode.trim().toLowerCase();

    final hasLocation =
        latitude != null ||
        longitude != null ||
        timezone != null ||
        (timezoneName?.trim().isNotEmpty ?? false) ||
        (place?.trim().isNotEmpty ?? false);

    if (hasLocation) {
      if (latitude == null || latitude < -90 || latitude > 90) {
        throw const GeneralHoroscopeApiException('Invalid Panchang latitude.');
      }

      if (longitude == null || longitude < -180 || longitude > 180) {
        throw const GeneralHoroscopeApiException('Invalid Panchang longitude.');
      }

      if (timezone == null || timezone < -12 || timezone > 14) {
        throw const GeneralHoroscopeApiException('Invalid Panchang timezone.');
      }
    }

    final query = <String>[
      'date=${_date(date)}',
      'lang=${Uri.encodeQueryComponent(normalizedLanguage.isEmpty ? 'en' : normalizedLanguage)}',
    ];

    if (hasLocation) {
      query.add('lat=$latitude');
      query.add('lon=$longitude');
      query.add('timezone=$timezone');

      final normalizedTimezoneName = timezoneName?.trim() ?? '';
      final normalizedPlace = place?.trim() ?? '';

      if (normalizedTimezoneName.isNotEmpty) {
        query.add(
          'timezoneName=${Uri.encodeQueryComponent(normalizedTimezoneName)}',
        );
      }

      if (normalizedPlace.isNotEmpty) {
        query.add('place=${Uri.encodeQueryComponent(normalizedPlace)}');
      }
    }

    return _get(
      '/general-horoscope/panchang?${query.join('&')}',
      fallbackError: 'Unable to load Panchang.',
    );
  }

  Future<Map<String, dynamic>> _get(
    String path, {
    required String fallbackError,
  }) async {
    try {
      final response = await _client
          .get(
            Uri.parse('${ApiConfig.baseUrl}$path'),
            headers: const {'Accept': 'application/json'},
          )
          .timeout(ApiConfig.requestTimeout);

      final body = _decode(response.body);

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw GeneralHoroscopeApiException(_message(body, fallbackError));
      }

      // Public backend currently returns the payload directly.
      // Keep support for the common {data: {...}} envelope too.
      final data = body['data'];

      if (data is Map<String, dynamic>) {
        return data;
      }

      if (data is Map) {
        return Map<String, dynamic>.from(data);
      }

      return body;
    } on GeneralHoroscopeApiException {
      rethrow;
    } catch (_) {
      throw GeneralHoroscopeApiException(fallbackError);
    }
  }

  Map<String, dynamic> _decode(String source) {
    if (source.trim().isEmpty) {
      return <String, dynamic>{};
    }

    try {
      final decoded = jsonDecode(source);

      if (decoded is Map<String, dynamic>) {
        return decoded;
      }

      if (decoded is Map) {
        return Map<String, dynamic>.from(decoded);
      }
    } catch (_) {}

    return <String, dynamic>{};
  }

  String _message(Map<String, dynamic> body, String fallback) {
    final message = body['message'];

    if (message is String && message.trim().isNotEmpty) {
      return message;
    }

    return fallback;
  }

  String _date(DateTime value) {
    final year = value.year.toString().padLeft(4, '0');
    final month = value.month.toString().padLeft(2, '0');
    final day = value.day.toString().padLeft(2, '0');

    return '$year-$month-$day';
  }

  void close() {
    _client.close();
  }
}
