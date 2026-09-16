class AppConfigModel {
  const AppConfigModel({
    required this.shareMessage,
    required this.androidStoreUrl,
    required this.iosStoreUrl,
    required this.websiteUrl,
    required this.aboutTitle,
    required this.aboutDescription,
  });

  final String shareMessage;
  final String androidStoreUrl;
  final String iosStoreUrl;
  final String websiteUrl;
  final String aboutTitle;
  final String aboutDescription;

  factory AppConfigModel.fromJson(Map<String, dynamic> json) {
    return AppConfigModel(
      shareMessage: (json['shareMessage'] as String? ?? '').trim(),
      androidStoreUrl: (json['androidStoreUrl'] as String? ?? '').trim(),
      iosStoreUrl: (json['iosStoreUrl'] as String? ?? '').trim(),
      websiteUrl: (json['websiteUrl'] as String? ?? '').trim(),
      aboutTitle: (json['aboutTitle'] as String? ?? '').trim(),
      aboutDescription: (json['aboutDescription'] as String? ?? '').trim(),
    );
  }
}
