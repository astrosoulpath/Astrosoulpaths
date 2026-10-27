/// Validate configured destinations; never synthesize an unpublished listing.
abstract final class OfficialAppLinks {
  static const androidPackage = 'com.astrosoulpath.astro_soul_path';
  static Uri? website(String value) {
    final uri = Uri.tryParse(value.trim());
    return uri != null &&
            uri.scheme == 'https' &&
            uri.host.isNotEmpty &&
            uri.userInfo.isEmpty
        ? uri
        : null;
  }

  static Uri? store(String value, {required bool ios}) {
    final uri = website(value);
    if (uri == null) return null;
    if (ios) {
      return uri.host == 'apps.apple.com' &&
              RegExp(r'/id[0-9]+/?$').hasMatch(uri.path)
          ? uri
          : null;
    }
    return uri.host == 'play.google.com' &&
            uri.path == '/store/apps/details' &&
            uri.queryParameters['id'] == androidPackage
        ? uri
        : null;
  }
}
