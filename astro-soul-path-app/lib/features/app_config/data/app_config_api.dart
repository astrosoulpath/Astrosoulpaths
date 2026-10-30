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

  /// About CMS is public and independent of optional store/link configuration.
  Future<AppConfigModel> getAboutConfig({http.Client? client}) async {
    final response = await (client?.get ?? http.get)(
      Uri.parse('${ApiConfig.baseUrl}/app-config/about'),
      headers: const {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
      },
    ).timeout(ApiConfig.requestTimeout);
    if (response.statusCode != 200) {
      throw const AppConfigApiException('About content is unavailable.');
    }
    final body = jsonDecode(response.body);
    if (body is! Map<String, dynamic> || body['success'] != true) {
      throw const AppConfigApiException('Invalid About response.');
    }
    final data = body['data'];
    final content = data is Map ? data['content'] : null;
    if (content is! Map ||
        content['title'] is! String ||
        content['introduction'] is! String ||
        (content['title'] as String).trim().isEmpty ||
        (content['introduction'] as String).trim().isEmpty) {
      throw const AppConfigApiException('About content is missing.');
    }
    return AppConfigModel(
      shareMessage: '',
      androidStoreUrl: '',
      iosStoreUrl: '',
      websiteUrl: '',
      aboutTitle: (content['title'] as String).trim(),
      aboutDescription: (content['introduction'] as String).trim(),
      aboutSource: body['source'] is String ? body['source'] as String : null,
      aboutSections: {
        for (final key in [
          'mission',
          'vision',
          'services',
          'why',
          'commitment',
        ])
          key: content[key] is String ? (content[key] as String).trim() : '',
      },
    );
  }

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
