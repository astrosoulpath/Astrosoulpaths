import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';
import 'app_config_model.dart';

class AppConfigApiException implements Exception {
  const AppConfigApiException(
    this.message, {
    this.configurationMissing = false,
  });
  final String message;
  final bool configurationMissing;
  @override
  String toString() => message;
}

class AppConfigApi {
  const AppConfigApi();

  Future<AppConfigModel> getPublicConfig() async {
    final uri = Uri.parse('${ApiConfig.baseUrl}/app-config/public');

    final response = await http
        .get(uri, headers: const {'Accept': 'application/json'})
        .timeout(ApiConfig.requestTimeout);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      if (response.statusCode == 404) {
        try {
          final body = jsonDecode(response.body);
          if (body is Map &&
              body['message'] == 'Public app configuration is not configured') {
            throw const AppConfigApiException(
              'Official app links are not configured.',
              configurationMissing: true,
            );
          }
        } on AppConfigApiException {
          rethrow;
        } catch (_) {
          /* No raw server body exposed. */
        }
      }
      throw AppConfigApiException(
        'Unable to load app configuration. '
        'Status: ${response.statusCode}',
      );
    }

    final decoded = jsonDecode(response.body);

    if (decoded is! Map<String, dynamic>) {
      throw Exception('Invalid app configuration response');
    }

    final data = decoded['data'];

    if (data is! Map<String, dynamic>) {
      throw Exception('App configuration is missing');
    }

    return AppConfigModel.fromJson(data);
  }
}
