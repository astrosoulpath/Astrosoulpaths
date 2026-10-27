import 'dart:io';

import 'package:url_launcher/url_launcher.dart';

import '../../app_config/data/app_config_api.dart';
import '../../app_config/data/official_app_links.dart';
import '../../app_config/data/app_config_model.dart';

enum RateAppResult { opened, storeNotConfigured }

class RateAppService {
  const RateAppService({this.appConfigApi = const AppConfigApi()});

  final AppConfigApi appConfigApi;

  Future<RateAppResult> openStoreListing() async {
    final AppConfigModel config;
    try {
      config = await appConfigApi.getPublicConfig();
    } on AppConfigApiException catch (error) {
      if (error.configurationMissing) return RateAppResult.storeNotConfigured;
      rethrow;
    }

    String storeUrl = '';

    if (Platform.isAndroid) {
      storeUrl = config.androidStoreUrl;
    } else if (Platform.isIOS) {
      storeUrl = config.iosStoreUrl;
    }

    if (storeUrl.isEmpty) {
      return RateAppResult.storeNotConfigured;
    }

    final uri = OfficialAppLinks.store(storeUrl, ios: Platform.isIOS);

    if (uri == null) {
      return RateAppResult.storeNotConfigured;
    }

    final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);

    if (!launched) {
      throw Exception('Unable to open app store listing');
    }

    return RateAppResult.opened;
  }
}
