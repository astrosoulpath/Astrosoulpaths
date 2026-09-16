import 'dart:io';

import 'package:url_launcher/url_launcher.dart';

import '../../app_config/data/app_config_api.dart';

enum RateAppResult { opened, storeNotConfigured }

class RateAppService {
  const RateAppService({this.appConfigApi = const AppConfigApi()});

  final AppConfigApi appConfigApi;

  Future<RateAppResult> openStoreListing() async {
    final config = await appConfigApi.getPublicConfig();

    String storeUrl = '';

    if (Platform.isAndroid) {
      storeUrl = config.androidStoreUrl;
    } else if (Platform.isIOS) {
      storeUrl = config.iosStoreUrl;
    }

    if (storeUrl.isEmpty) {
      return RateAppResult.storeNotConfigured;
    }

    final uri = Uri.tryParse(storeUrl);

    if (uri == null || !uri.hasScheme) {
      return RateAppResult.storeNotConfigured;
    }

    final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);

    if (!launched) {
      throw Exception('Unable to open app store listing');
    }

    return RateAppResult.opened;
  }
}
