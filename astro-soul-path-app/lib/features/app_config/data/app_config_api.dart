import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';
import 'app_config_model.dart';

class AppConfigApi {
  const AppConfigApi();

  Future<AppConfigModel> getPublicConfig() async {
    final uri = Uri.parse('${ApiConfig.baseUrl}/app-config/public');

    final response = await http
        .get(uri, headers: const {'Accept': 'application/json'})
        .timeout(ApiConfig.requestTimeout);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
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
