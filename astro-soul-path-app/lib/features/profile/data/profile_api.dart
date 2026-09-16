import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';
import '../../auth/data/auth_session_store.dart';
import 'customer_profile.dart';

class ProfileApiException implements Exception {
  const ProfileApiException(this.message, {this.loginRequired = false});

  final String message;
  final bool loginRequired;

  @override
  String toString() => message;
}

class ProfileApi {
  ProfileApi({http.Client? client, AuthSessionStore? sessionStore})
    : _client = client ?? http.Client(),
      _sessionStore = sessionStore ?? AuthSessionStore();

  final http.Client _client;
  final AuthSessionStore _sessionStore;

  Future<List<CustomerProfile>> getProfiles() async {
    final body = await _request(
      method: 'GET',
      path: '/user/profile',
      fallbackError: 'Failed to load profile.',
    );

    // Production/current-profile APIs may return the profile under
    // `data`, `profile`, or `userProfile`. Support the authenticated
    // backend response without creating any local/dummy profile.
    final rawData = body['data'] ?? body['profile'] ?? body['userProfile'];

    if (rawData == null) {
      return const <CustomerProfile>[];
    }

    if (rawData is Map) {
      return <CustomerProfile>[
        CustomerProfile.fromJson(Map<String, dynamic>.from(rawData)),
      ];
    }

    if (rawData is List) {
      return rawData
          .whereType<Map>()
          .map(
            (item) => CustomerProfile.fromJson(Map<String, dynamic>.from(item)),
          )
          .toList();
    }

    throw const ProfileApiException(
      'The server returned an invalid profile response.',
    );
  }

  Future<CustomerProfile> getProfileById(String profileId) async {
    final id = profileId.trim();

    if (id.isEmpty) {
      throw const ProfileApiException('Profile ID is required.');
    }

    final body = await _request(
      method: 'GET',
      path: '/user/profile',
      fallbackError: 'Failed to load profile.',
    );

    return _readProfile(body);
  }

  Future<CustomerProfile> createProfile({
    required String name,
    required String dob,
    String? tob,
    required bool birthTimeKnown,
    required double lat,
    required double lon,
    required double timezone,
    String? timezoneName,
    String? fullName,
    String? city,
    String? state,
    String? country,
    String? countryCode,
    String? gender,
    String? language,
    String? maritalStatus,
    String? occupation,
    String? avatarUrl,
  }) async {
    final payload = <String, dynamic>{
      'fullName': fullName?.trim().isNotEmpty == true
          ? fullName!.trim()
          : name.trim(),
      'dateOfBirth': dob,
      if (_hasText(tob)) 'timeOfBirth': tob!.trim(),
      'birthTimeKnown': birthTimeKnown,
      'latitude': lat,
      'longitude': lon,
      'timezone': timezone,
      if (_hasText(timezoneName)) 'timezoneName': timezoneName!.trim(),
      if (_hasText(fullName)) 'fullName': fullName!.trim(),
      if (_hasText(city)) 'city': city!.trim(),
      if (_hasText(state)) 'state': state!.trim(),
      if (_hasText(country)) 'country': country!.trim(),
      if (_hasText(countryCode))
        'countryCode': countryCode!.trim().toUpperCase(),
      if (_hasText(gender)) 'gender': gender!.trim().toUpperCase(),
      if (_hasText(language)) 'lang': language!.trim(),
      if (_hasText(maritalStatus)) 'maritalStatus': maritalStatus!.trim(),
      if (_hasText(occupation)) 'occupation': occupation!.trim(),
      if (_hasText(avatarUrl)) 'avatarUrl': avatarUrl!.trim(),
    };

    final body = await _request(
      method: 'POST',
      path: '/user/profile',
      payload: payload,
      fallbackError: 'Failed to create profile.',
    );

    return _readProfile(body);
  }

  Future<CustomerProfile> updateProfile({
    required String profileId,
    String? name,
    String? dob,
    String? tob,
    bool? birthTimeKnown,
    double? lat,
    double? lon,
    double? timezone,
    String? timezoneName,
    String? fullName,
    String? city,
    String? state,
    String? country,
    String? countryCode,
    String? gender,
    String? language,
    String? maritalStatus,
    String? occupation,
    String? avatarUrl,
  }) async {
    final id = profileId.trim();

    if (id.isEmpty) {
      throw const ProfileApiException('Profile ID is required.');
    }

    final payload = <String, dynamic>{
      if (_hasText(name)) 'fullName': name!.trim(),
      if (_hasText(dob)) 'dateOfBirth': dob!.trim(),
      if (_hasText(tob)) 'timeOfBirth': tob!.trim(),
      'birthTimeKnown': ?birthTimeKnown,
      'latitude': ?lat,
      'longitude': ?lon,
      'timezone': ?timezone,
      if (_hasText(timezoneName)) 'timezoneName': timezoneName!.trim(),
      if (_hasText(fullName)) 'fullName': fullName!.trim(),
      if (_hasText(city)) 'city': city!.trim(),
      if (_hasText(state)) 'state': state!.trim(),
      if (_hasText(country)) 'country': country!.trim(),
      if (_hasText(countryCode))
        'countryCode': countryCode!.trim().toUpperCase(),
      if (_hasText(gender)) 'gender': gender!.trim().toUpperCase(),
      if (_hasText(language)) 'lang': language!.trim(),
      if (_hasText(maritalStatus)) 'maritalStatus': maritalStatus!.trim(),
      if (_hasText(occupation)) 'occupation': occupation!.trim(),
      if (_hasText(avatarUrl)) 'avatarUrl': avatarUrl!.trim(),
    };

    if (payload.isEmpty) {
      throw const ProfileApiException('No profile changes to save.');
    }

    final body = await _request(
      method: 'PATCH',
      path: '/user/profile',
      payload: payload,
      fallbackError: 'Failed to update profile.',
    );

    return _readProfile(body);
  }

  Future<void> deleteProfile(String profileId) async {
    final id = profileId.trim();

    if (id.isEmpty) {
      throw const ProfileApiException('Profile ID is required.');
    }

    await _request(
      method: 'DELETE',
      path: '/user/profile',
      fallbackError: 'Failed to delete profile.',
    );
  }

  Future<Map<String, dynamic>> _request({
    required String method,
    required String path,
    Map<String, dynamic>? payload,
    required String fallbackError,
  }) async {
    final session = await _sessionStore.read();
    final accessToken = session?.accessToken.trim() ?? '';

    if (accessToken.isEmpty) {
      throw const ProfileApiException(
        'Please login to continue.',
        loginRequired: true,
      );
    }

    try {
      final request = http.Request(
        method,
        Uri.parse('${ApiConfig.baseUrl}$path'),
      );

      request.headers.addAll({
        'Accept': 'application/json',
        'Authorization': 'Bearer $accessToken',
      });

      if (payload != null) {
        request.headers['Content-Type'] = 'application/json';
        request.body = jsonEncode(payload);
      }

      final streamedResponse = await _client
          .send(request)
          .timeout(ApiConfig.requestTimeout);

      final response = await http.Response.fromStream(streamedResponse);
      final body = _decodeBody(response.body);

      if (response.statusCode == 401) {
        throw const ProfileApiException(
          'Your session has expired. Please login again.',
          loginRequired: true,
        );
      }

      if (response.statusCode < 200 ||
          response.statusCode >= 300 ||
          body['success'] != true) {
        throw ProfileApiException(_readMessage(body, fallback: fallbackError));
      }

      return body;
    } on ProfileApiException {
      rethrow;
    } catch (_) {
      throw const ProfileApiException(
        'Unable to connect to the server. Please try again.',
      );
    }
  }

  CustomerProfile _readProfile(Map<String, dynamic> body) {
    final rawData = body['data'] ?? body['profile'] ?? body['userProfile'];

    if (rawData is Map<String, dynamic>) {
      return CustomerProfile.fromJson(rawData);
    }

    if (rawData is Map) {
      return CustomerProfile.fromJson(Map<String, dynamic>.from(rawData));
    }

    throw const ProfileApiException(
      'The server returned an invalid profile response.',
    );
  }

  Map<String, dynamic> _decodeBody(String source) {
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

  String _readMessage(Map<String, dynamic> body, {required String fallback}) {
    final directMessage = body['message'];

    if (directMessage is String && directMessage.trim().isNotEmpty) {
      return directMessage.trim();
    }

    if (directMessage is List && directMessage.isNotEmpty) {
      return directMessage.map((item) => item.toString()).join('\n');
    }

    final nestedResponse = body['response'];

    if (nestedResponse is Map) {
      final nestedMessage = nestedResponse['message'];

      if (nestedMessage is String && nestedMessage.trim().isNotEmpty) {
        return nestedMessage.trim();
      }
    }

    return fallback;
  }

  static bool _hasText(String? value) {
    return value != null && value.trim().isNotEmpty;
  }

  void close() {
    _client.close();
  }
}
