import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';

class GeoApiException implements Exception {
  const GeoApiException(this.message);

  final String message;

  @override
  String toString() => message;
}

class GeoSuggestion {
  const GeoSuggestion({
    required this.city,
    required this.fullName,
    required this.state,
    required this.countryCode,
    required this.country,
    required this.latitude,
    required this.longitude,
    required this.timezone,
    required this.timezoneName,
  });

  final String city;
  final String fullName;
  final String state;
  final String countryCode;
  final String country;
  final double latitude;
  final double longitude;
  final double timezone;
  final String timezoneName;

  factory GeoSuggestion.fromJson(Map<String, dynamic> json) {
    return GeoSuggestion(
      city: json['city']?.toString() ?? '',
      fullName: json['fullname']?.toString() ?? '',
      state: json['state']?.toString() ?? '',
      countryCode: json['countryCode']?.toString() ?? '',
      country: json['country']?.toString() ?? '',
      latitude: _toDouble(json['latitude']),
      longitude: _toDouble(json['longitude']),
      timezone: _toDouble(json['timezone']),
      timezoneName: json['timezoneName']?.toString() ?? '',
    );
  }

  static double _toDouble(Object? value) {
    if (value is num) {
      return value.toDouble();
    }

    return double.tryParse(value?.toString() ?? '') ?? 0;
  }
}

class GeoApi {
  GeoApi({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  Future<List<GeoSuggestion>> searchCity(String query) async {
    final city = query.trim();

    if (city.length < 2) {
      return const [];
    }

    try {
      final response = await _client
          .post(
            Uri.parse('${ApiConfig.baseUrl}/geo/search'),
            headers: const {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            body: jsonEncode({'city': city}),
          )
          .timeout(ApiConfig.requestTimeout);

      final body = _decode(response.body);

      if (response.statusCode < 200 ||
          response.statusCode >= 300 ||
          body['success'] != true) {
        throw GeoApiException(
          _message(body, fallback: 'Unable to search birth place.'),
        );
      }

      final data = body['data'];

      if (data is! List) {
        throw const GeoApiException('Invalid location response from server.');
      }

      return data
          .whereType<Map>()
          .map(
            (item) => GeoSuggestion.fromJson(Map<String, dynamic>.from(item)),
          )
          .where(
            (item) =>
                item.city.isNotEmpty &&
                item.countryCode.isNotEmpty &&
                item.timezoneName.isNotEmpty,
          )
          .toList();
    } on GeoApiException {
      rethrow;
    } catch (_) {
      throw const GeoApiException('Unable to connect to location service.');
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

  String _message(Map<String, dynamic> body, {required String fallback}) {
    final value = body['message'];

    if (value is String && value.trim().isNotEmpty) {
      return value.trim();
    }

    if (value is List && value.isNotEmpty) {
      return value.map((item) => item.toString()).join('\n');
    }

    return fallback;
  }

  void close() {
    _client.close();
  }
}
