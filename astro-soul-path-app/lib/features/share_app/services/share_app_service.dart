import 'dart:io';

import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../../app_config/data/app_config_api.dart';

class ShareAppService {
  const ShareAppService({this.appConfigApi = const AppConfigApi()});

  final AppConfigApi appConfigApi;

  Future<void> shareApp(BuildContext context) async {
    final renderObject = context.findRenderObject();
    final box = renderObject is RenderBox ? renderObject : null;

    final origin = box == null
        ? null
        : box.localToGlobal(Offset.zero) & box.size;

    final config = await appConfigApi.getPublicConfig();

    String platformUrl = '';

    if (Platform.isAndroid) {
      platformUrl = config.androidStoreUrl;
    } else if (Platform.isIOS) {
      platformUrl = config.iosStoreUrl;
    }

    final effectiveUrl = platformUrl.isNotEmpty
        ? platformUrl
        : config.websiteUrl;

    if (effectiveUrl.isEmpty) {
      throw Exception('Share URL is not configured');
    }

    final text = config.shareMessage.isNotEmpty
        ? '${config.shareMessage}\n\n$effectiveUrl'
        : effectiveUrl;

    await SharePlus.instance.share(
      ShareParams(
        text: text,
        subject: 'Astro Soul Path',
        sharePositionOrigin: origin,
      ),
    );
  }
}
